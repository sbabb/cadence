// Makes the Android back button (and the back swipe, and a desktop browser's
// back arrow) close whatever is on top instead of leaving the app.
//
// Cadence has no router. Every screen is a boolean in App.jsx, which is the
// right shape for an app this size but means the browser has no idea anything
// happened when you open Settings - there is one history entry for the whole
// session, so back goes wherever you were BEFORE Cadence. On a phone that is
// the home screen. You tap SETTINGS, swipe back, and the app disappears.
//
// The fix is one history entry per layer that is on screen. This module owns
// the correspondence between the two and nothing else:
//
//     layers on screen  <-->  history entries we have pushed
//
// It is deliberately not a router. Nothing here knows what a layer IS, no URL
// ever changes (which matters - the service worker caches by URL, and a made
// up path would be a cache miss on reload), and no screen reads its state
// from history. The only question this answers is "how many things are open",
// so the browser can take one off.
//
// Each pushed entry records its own depth, and that recorded number - not
// anything we remember - is the truth on the way back. A popstate says "you
// are now at depth 1", so everything above depth 1 gets dismissed. That makes
// the whole thing self-correcting: a jump of several entries at once, a
// gesture that arrives while a close is already in flight, an entry left over
// from before a reload - all of them land somewhere consistent instead of
// leaving the counter drifting one out for the rest of the session.

const DEPTH_KEY = 'cadenceDepth'

export function createBackStack(history, { schedule } = {}) {
  // Dismissible layers, outermost first. Each is { dismiss }, and identity
  // matters - a layer is removed by the exact object it registered with, so
  // two of the same kind of dialog can never unregister each other.
  const layers = []

  // How many entries we have pushed. Normally equal to layers.length; the gap
  // between them is what sync() closes.
  let depth = 0

  let pending = false
  const defer = schedule || ((fn) => queueMicrotask(fn))

  // True from the moment start() asks the browser to wind stale entries off
  // until that traversal lands. The popstate it produces is ours, and reading
  // it as the user pressing back is what used to close the first screen you
  // opened after a reload - see start() and handlePopState below.
  let winding = false

  // React can unmount several layers in a single commit - tapping the header
  // closes Settings and the FAQ together - and each cleanup would otherwise
  // fire its own history.go(-1). Two traversals racing each other is exactly
  // the kind of thing that works on a laptop and not on a phone, so the work
  // is coalesced: settle the whole commit first, then move history once.
  function schedule_() {
    if (pending) return
    pending = true
    defer(flush)
  }

  function flush() {
    pending = false
    sync()
  }

  function sync() {
    // Nothing is pushed while the startup wind-back is in flight. An entry
    // pushed into the middle of a traversal lands somewhere nobody asked for,
    // and the layer that wanted it gets its entry the moment the traversal
    // finishes instead.
    if (winding) return
    const want = layers.length
    if (want === depth) return
    if (want > depth) {
      while (depth < want) {
        depth += 1
        // No URL argument: the entry is a bookmark in the session, not an
        // address. Passing one would rewrite the location bar and break the
        // service worker's cache key on the next reload.
        history.pushState({ [DEPTH_KEY]: depth }, '')
      }
      return
    }
    const back = depth - want
    // Set the counter BEFORE traversing. history.go is asynchronous and the
    // popstate it causes runs through handlePopState like any other; by then
    // the books must already balance, or that handler will conclude a layer
    // still needs dismissing and close one too many.
    depth = want
    history.go(-back)
  }

  // Called by a layer when it appears. Returns the function that unregisters
  // it, which is exactly the shape a React effect wants to return.
  function open(dismiss) {
    const layer = { dismiss }
    layers.push(layer)
    schedule_()
    return () => {
      const i = layers.indexOf(layer)
      if (i !== -1) layers.splice(i, 1)
      schedule_()
    }
  }

  // The user pressed back. The entry we landed on names the depth it belongs
  // to; everything above it is now closed as far as the browser is concerned,
  // so the app has to catch up.
  function handlePopState(state) {
    const raw = state && state[DEPTH_KEY]
    const target = Number.isFinite(raw) && raw > 0 ? raw : 0

    // Our own wind-back landing, not a back press. Nothing is dismissed: the
    // entries this cleared belong to a session that ended at the reload, and
    // any layer that opened while the traversal was in flight is still very
    // much on screen and still needs an entry of its own.
    if (winding) {
      winding = false
      depth = target
      schedule_()
      return
    }

    depth = target
    while (layers.length > target) {
      const top = layers.pop()
      // Popped before dismissing rather than after. dismiss() is a React
      // state update whose cleanup will try to remove this same layer, and
      // taking it out first means that cleanup is a no-op instead of a second
      // removal - and if some future caller's dismiss did nothing at all,
      // this loop still terminates.
      top.dismiss()
    }
  }

  // Entries survive a reload; the app's state does not. Refresh the page with
  // Settings open and the browser is sitting three entries deep while React
  // has just rendered the dashboard, so the next two back presses would
  // appear to do nothing at all before the third finally left. Wind them back
  // off at startup so the app always begins level.
  function start() {
    const raw = history.state && history.state[DEPTH_KEY]
    const stale = Number.isFinite(raw) && raw > 0 ? raw : 0
    if (stale <= 0) return
    winding = true
    // The books are balanced BEFORE the traversal, for the same reason sync()
    // does it: the popstate this causes arrives asynchronously and must find
    // a counter that already agrees with where history is going.
    depth = 0
    history.go(-stale)
  }

  return {
    open,
    handlePopState,
    start,
    flush,
    // Reading room for the tests; nothing in the app needs these.
    get depth() {
      return depth
    },
    get size() {
      return layers.length
    }
  }
}
