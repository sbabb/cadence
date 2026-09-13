// Checks src/utils/backStack.js - the thing that decides what the Android
// back button does.
//
// Back is not a feature you can eyeball. Every failure looks identical from
// the sofa ("I pressed back"), and the two ways it goes wrong are opposites:
// too few history entries and back throws the user out of the app mid-task;
// too many and back appears to do nothing, sometimes several times in a row,
// which reads as a frozen app. Both depend on ORDERING - a history traversal
// is asynchronous, React unmounts in batches - so both are exactly the kind
// of bug that behaves on a desk and misbehaves on a phone.
//
// So the browser is modelled instead of driven. Below is a fake history that
// keeps a real entry list (including discarding forward entries on a push,
// which a real browser does and which one of these checks depends on), a fake
// React that mounts and unmounts in commits, and a two-queue event loop that
// keeps the microtask/macrotask distinction: the stack coalesces its work in
// a microtask, and a popstate arrives as a macrotask, so a microtask always
// runs first. Getting that order wrong is precisely the bug this is here to
// catch, so the model has to be honest about it.
//
//   node scripts/verify-backstack.mjs

import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createBackStack } from '../src/utils/backStack.js'

const here = dirname(fileURLToPath(import.meta.url))
const COMPONENTS = join(here, '..', 'src', 'components')

let passed = 0
let failed = 0

function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1
      console.log(`PASS: ${name}`)
    })
    .catch((err) => {
      failed += 1
      console.error(`FAIL: ${name}`)
      console.error(err)
      process.exitCode = 1
    })
}

// --- a browser, roughly ----------------------------------------------------

function createHarness({ initialEntries = [null] } = {}) {
  const micro = []
  const macro = []

  // Entry 0 is the page the app was first loaded on. Pushing discards
  // anything forward of the current position, same as a real browser - and,
  // also as in a real browser, going BACK does not discard anything, which is
  // why the checks below measure the position rather than the list length.
  const entries = [...initialEntries]
  let index = entries.length - 1
  let exits = 0
  let onPop = null

  const history = {
    get state() {
      return entries[index]
    },
    pushState(state) {
      entries.length = index + 1
      entries.push(state)
      index = entries.length - 1
    },
    go(delta) {
      const next = index + delta
      if (next < 0) {
        // Back past the entry the app opened on. On Android this is the app
        // closing, which is correct there and a bug anywhere else.
        exits += 1
        return
      }
      if (next === index) return
      index = next
      macro.push(() => onPop(entries[index]))
    }
  }

  const stack = createBackStack(history, { schedule: (fn) => micro.push(fn) })
  onPop = (state) => stack.handlePopState(state)

  // --- a React, roughly ----------------------------------------------------
  //
  // `open` is what App.jsx's booleans say should be on screen; `mounted` is
  // what actually is. A commit reconciles them the way React does: cleanups
  // for everything leaving run first, then effects for everything arriving,
  // all in one synchronous pass.

  const open = []
  const mounted = []
  let scheduled = false

  function commit() {
    scheduled = false
    for (let i = mounted.length - 1; i >= 0; i -= 1) {
      if (!open.includes(mounted[i].name)) {
        mounted[i].close()
        mounted.splice(i, 1)
      }
    }
    for (const name of open) {
      if (!mounted.some((m) => m.name === name)) {
        mounted.push({ name, close: stack.open(() => setOpen(open.filter((n) => n !== name))) })
      }
    }
  }

  function setOpen(next) {
    open.length = 0
    open.push(...next)
    if (scheduled) return
    scheduled = true
    micro.push(commit)
  }

  async function settle() {
    let guard = 0
    while (micro.length || macro.length) {
      assert.ok((guard += 1) < 200, 'the event loop never went quiet')
      while (micro.length) micro.shift()()
      if (macro.length) macro.shift()()
    }
  }

  return {
    stack,
    settle,
    show: (...names) => setOpen(names),
    // The user presses back / swipes back.
    pressBack: () => history.go(-1),
    // Chrome lets you long-press back (and right-click it on a desktop) to
    // jump several entries at once.
    jumpBack: (n) => history.go(-n),
    get onScreen() {
      return mounted.map((m) => m.name)
    },
    get entries() {
      return entries.length - 1
    },
    get position() {
      return index
    },
    get exits() {
      return exits
    }
  }
}

// --- the entries exist at all ----------------------------------------------

await check('opening a screen adds exactly one history entry', async () => {
  const h = createHarness()
  h.show('settings')
  await h.settle()
  assert.deepEqual(h.onScreen, ['settings'])
  assert.equal(h.entries, 1, 'one layer open should mean one entry pushed')
  assert.equal(h.position, 1)
})

await check('back closes the screen instead of leaving the app', async () => {
  const h = createHarness()
  h.show('settings')
  await h.settle()
  h.pressBack()
  await h.settle()
  assert.deepEqual(h.onScreen, [], 'Settings should have closed')
  assert.equal(h.exits, 0, 'the app must not have been left')
  assert.equal(h.position, 0, 'and history should be back at the entry it started on')
})

await check('back at the dashboard leaves the app, as it should', async () => {
  const h = createHarness()
  await h.settle()
  h.pressBack()
  await h.settle()
  assert.equal(h.exits, 1, 'nothing is open, so back belongs to Android')
})

// --- nesting ---------------------------------------------------------------

await check('back takes off the top layer only', async () => {
  const h = createHarness()
  h.show('settings')
  await h.settle()
  h.show('settings', 'confirm')
  await h.settle()
  assert.equal(h.entries, 2)

  h.pressBack()
  await h.settle()
  assert.deepEqual(h.onScreen, ['settings'], 'the dialog closes, Settings stays')
  assert.equal(h.exits, 0)

  h.pressBack()
  await h.settle()
  assert.deepEqual(h.onScreen, [], 'a second back closes Settings')
  assert.equal(h.exits, 0)

  h.pressBack()
  await h.settle()
  assert.equal(h.exits, 1, 'only the third back leaves')
})

await check('a screen that replaces another keeps the depth honest', async () => {
  // Settings -> FAQ. App.jsx renders one screen at a time, so opening the FAQ
  // unmounts Settings and mounts the FAQ in the SAME commit even though the
  // user experiences it as going one level deeper. Depth must not drift.
  const h = createHarness()
  h.show('settings')
  await h.settle()
  h.show('faq')
  await h.settle()
  assert.equal(h.entries, 1, 'one screen is open, so one entry')

  h.pressBack()
  await h.settle()
  assert.deepEqual(h.onScreen, [], 'the FAQ closed')
  assert.equal(h.exits, 0, 'and back did not leave the app')
})

// --- closing from inside the app -------------------------------------------

await check('the in-app BACK button takes its history entry with it', async () => {
  // The regression that makes back feel broken: close Settings by tapping
  // BACK, and if the entry is left behind, the next back press appears to do
  // nothing at all.
  const h = createHarness()
  h.show('settings')
  await h.settle()
  h.show()
  await h.settle()
  assert.equal(h.position, 0, 'the entry should have been unwound')

  h.pressBack()
  await h.settle()
  assert.equal(h.exits, 1, 'with nothing open, back leaves - it does not sit there doing nothing')
})

await check('closing two layers at once unwinds both entries', async () => {
  // Tapping the header goes home from anywhere, which can close a screen and
  // a dialog in a single commit.
  const h = createHarness()
  h.show('settings')
  await h.settle()
  h.show('settings', 'confirm')
  await h.settle()
  assert.equal(h.entries, 2)

  h.show()
  await h.settle()
  assert.equal(h.position, 0, 'both entries unwound in one traversal')

  h.pressBack()
  await h.settle()
  assert.equal(h.exits, 1)
})

await check('confirming an action that also closes its screen unwinds both', async () => {
  // Settings -> Abandon Period: the dialog confirms, and App closes Settings
  // in the same update, so the dialog and the screen unmount together and the
  // period summary - which is not dismissible, being a step forward rather
  // than a layer on top - takes their place.
  const h = createHarness()
  h.show('settings')
  await h.settle()
  h.show('settings', 'confirm')
  await h.settle()
  h.show()
  await h.settle()
  assert.equal(h.position, 0, 'neither entry should survive the confirm')

  h.pressBack()
  await h.settle()
  assert.equal(h.exits, 1, 'back from the summary belongs to Android, not to us')
})

// --- the awkward ones ------------------------------------------------------

await check('a back gesture that jumps several entries closes everything above it', async () => {
  // Long-pressing back picks an entry out of a list rather than stepping one
  // at a time. Whatever it lands on, everything above it is gone as far as
  // the browser is concerned, so the app has to agree - which is why the
  // entry itself carries its depth, rather than the stack counting presses.
  const h = createHarness()
  h.show('settings')
  await h.settle()
  h.show('settings', 'confirm')
  await h.settle()
  assert.equal(h.position, 2)

  h.jumpBack(2)
  await h.settle()
  assert.deepEqual(h.onScreen, [], 'both layers should have closed, not just the top one')
  assert.equal(h.position, 0)
  assert.equal(h.exits, 0)
})

await check('unwinding past some layers leaves the ones below still open', async () => {
  // The mirror of the above: land in the MIDDLE of the stack and exactly the
  // layers above that point close. Counting down by one per popstate gets
  // this wrong in the direction that empties the screen.
  const h = createHarness()
  h.show('a')
  await h.settle()
  h.show('a', 'b')
  await h.settle()
  h.show('a', 'b', 'c')
  await h.settle()
  assert.equal(h.position, 3)

  h.jumpBack(2)
  await h.settle()
  assert.deepEqual(h.onScreen, ['a'], 'two layers off, the bottom one stays')
  assert.equal(h.position, 1)

  h.pressBack()
  await h.settle()
  assert.deepEqual(h.onScreen, [])
  assert.equal(h.exits, 0)
})

await check('closing several layers while one stays open unwinds only theirs', async () => {
  const h = createHarness()
  h.show('a')
  await h.settle()
  h.show('a', 'b')
  await h.settle()
  h.show('a', 'b', 'c')
  await h.settle()

  h.show('a')
  await h.settle()
  assert.deepEqual(h.onScreen, ['a'])
  assert.equal(h.position, 1, 'two entries unwound, the first left alone')

  h.pressBack()
  await h.settle()
  assert.deepEqual(h.onScreen, [], 'and back still closes what is left')
  assert.equal(h.exits, 0)
})

await check('opening and closing repeatedly does not leak entries', async () => {
  const h = createHarness()
  for (let i = 0; i < 5; i += 1) {
    h.show('sheet')
    await h.settle()
    h.show()
    await h.settle()
  }
  assert.equal(h.position, 0, 'history should be exactly where it started')
  assert.equal(h.exits, 0)
})

await check('opening and closing within one commit leaves nothing behind', async () => {
  // Both updates land before the stack ever gets to move history, so it must
  // conclude there is nothing to do rather than pushing and then unwinding.
  const h = createHarness()
  h.show('sheet')
  h.show()
  await h.settle()
  assert.equal(h.entries, 0)
  assert.equal(h.position, 0)
  assert.equal(h.exits, 0)
})

await check('a back press while a close is already in flight lands somewhere sane', async () => {
  const h = createHarness()
  h.show('settings', 'confirm')
  await h.settle()
  assert.equal(h.entries, 2)

  // The dialog is dismissed in-app and the user swipes back before the
  // traversal that removes its entry has been delivered.
  h.show('settings')
  h.pressBack()
  await h.settle()
  assert.equal(h.exits, 0, 'no amount of racing should throw the user out')
  assert.ok(h.onScreen.length <= 1, 'and nothing should be left stranded on screen')
})

await check('entries left over from before a reload are wound off at startup', async () => {
  // Refreshing with Settings open leaves the browser several entries deep
  // while React starts again at the dashboard. Without this, the next back
  // presses would each appear to do nothing.
  const h = createHarness({ initialEntries: [null, { cadenceDepth: 1 }, { cadenceDepth: 2 }] })
  h.stack.start()
  await h.settle()
  assert.equal(h.position, 0, 'startup should return to the entry the app was loaded on')

  h.pressBack()
  await h.settle()
  assert.equal(h.exits, 1, 'so the very first back press leaves, rather than doing nothing twice')
})

await check('a history entry that is not ours is treated as depth zero', async () => {
  // Another page on the same origin, or a browser restoring a session, can
  // hand us a state object we did not write. It must not be read as depth.
  const h = createHarness({ initialEntries: [{ somethingElse: 7 }] })
  h.stack.start()
  await h.settle()
  assert.equal(h.position, 0, 'nothing to unwind')
  h.show('settings')
  await h.settle()
  assert.equal(h.position, 1)
})

await check('history is moved after the commit settles, never during it', async () => {
  // The harness above injects its own scheduler, so this is the one check
  // that exercises the real one. React unmounts several layers in a single
  // commit and each cleanup reports in separately; doing the work as each
  // arrives would fire a traversal per layer, and a traversal is
  // asynchronous - a push landing in the middle of one is how history ends up
  // somewhere nobody asked for. So the stack waits for the commit to finish
  // and then moves once.
  const pushes = []
  const gos = []
  const stack = createBackStack({
    state: null,
    pushState: (state) => pushes.push(state),
    go: (delta) => gos.push(delta)
  })

  const closeA = stack.open(() => {})
  const closeB = stack.open(() => {})
  assert.deepEqual(pushes, [], 'nothing should move while the commit is still running')
  await Promise.resolve()
  assert.equal(pushes.length, 2, 'then both entries arrive')

  closeA()
  closeB()
  assert.deepEqual(gos, [], 'and closing two layers has not moved anything yet either')
  await Promise.resolve()
  assert.deepEqual(gos, [-2], 'one traversal for both, rather than two racing each other')
})

// --- and that anything dismissible is actually plugged in ------------------

await check('every screen with a way out registers for the back button', async () => {
  // The checks above prove the machine works. This one proves things are
  // connected to it, which is the failure that would otherwise reach a phone
  // silently: the next dialog anyone adds looks completely normal, behaves
  // correctly to every tap, and quietly throws the user out of the app when
  // they swipe back.
  //
  // The rule is the prop name. A component taking `onBack` or `onCancel` is
  // by definition a layer with something underneath it, so back belongs to
  // it. StorageWarning is the deliberate exception and takes `onDismiss`
  // instead: it is a banner sitting inside the current screen rather than a
  // layer over it, so there is nothing for back to uncover.
  const missing = []
  for (const file of readdirSync(COMPONENTS).filter((f) => f.endsWith('.jsx'))) {
    const src = readFileSync(join(COMPONENTS, file), 'utf8')
    const signature = src.match(/^export default function (\w+)\(([\s\S]*?)\)\s*\{/m)
    if (!signature) continue
    const [, name, props] = signature
    const dismiss = ['onBack', 'onCancel'].find((p) => new RegExp(`\\b${p}\\b`).test(props))
    if (!dismiss) continue
    const call = src.match(/useBackDismiss\((\w+)\)/)
    if (!call) missing.push(`${name} takes ${dismiss} but never calls useBackDismiss`)
    else if (call[1] !== dismiss) {
      missing.push(`${name} registers ${call[1]} for the back button, not its ${dismiss}`)
    }
  }
  assert.deepEqual(missing, [], `\n  ${missing.join('\n  ')}`)
})

console.log(`\n${passed}/${passed + failed} back button checks passed`)
