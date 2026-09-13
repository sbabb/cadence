// Checks every palette against the rules a theme has to keep, so a new one
// can't be added by taste alone.
//
// Contrast is the part that genuinely needs a machine. Tokyo Night's green
// (#9ece6a) looks fine and IS fine on #1a1b26; the same green on Latte's
// #eff1f5 is 1.7:1, which is invisible, and no amount of squinting at a
// screenshot reliably tells you that before a user does. Everything here is
// arithmetic on the published tokens - no browser, no rendering, runs with
// plain `node`.
//
//   node scripts/verify-themes.mjs
//
// The thresholds are deliberately not a flat WCAG AA sweep. AA's 4.5:1 is
// written for body text at normal weight; this app's coloured values are
// 17-38px and semi-bold, which is the "large text" case at 3:1. So large
// figures are held to 3.0, ordinary UI text to 4.5, and the two dim greys -
// which exist precisely to recede - to 3.0 as secondary text.

import assert from 'node:assert/strict'
import { THEMES, rampColorsFor } from '../src/utils/themes.js'
import { hexToOklch, rampHex } from '../src/utils/color.js'

let checks = 0
let failures = 0

function check(name, fn) {
  checks += 1
  try {
    fn()
  } catch (err) {
    failures += 1
    console.error(`  FAIL  ${name}\n        ${err.message}`)
  }
}

// --- WCAG relative luminance and contrast ratio -------------------------

function channel(c) {
  const v = c / 255
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

function luminance(hex) {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(a, b) {
  const la = luminance(a)
  const lb = luminance(b)
  const light = Math.max(la, lb)
  const dark = Math.min(la, lb)
  return (light + 0.05) / (dark + 0.05)
}

function ratio(n) {
  return `${n.toFixed(2)}:1`
}

// Perceptual distance in Oklab, which is what "these two look different"
// actually means. Euclidean distance in Lab space; ~0.10 is a clear,
// unmistakable difference at these sizes.
function perceptualDistance(a, b) {
  const A = hexToOklch(a)
  const B = hexToOklch(b)
  const ha = (A.h * Math.PI) / 180
  const hb = (B.h * Math.PI) / 180
  const dL = A.l - B.l
  const da = A.c * Math.cos(ha) - B.c * Math.cos(hb)
  const db = A.c * Math.sin(ha) - B.c * Math.sin(hb)
  return Math.sqrt(dL * dL + da * da + db * db)
}

// --- the rules ----------------------------------------------------------

const LARGE_TEXT = 3.0 // the spend figure, stat values, screen titles
const BODY_TEXT = 4.5 // ordinary UI text
const SECONDARY = 3.0 // the dim greys, which are meant to recede

console.log('Verifying themes\n')

for (const theme of THEMES) {
  console.log(`${theme.label} (${theme.mode})`)
  const t = theme.tokens

  // 1. Body text has to be properly readable on both the page and a panel.
  for (const [name, ground] of [['bg', t.bg], ['bg-panel', t.bgPanel], ['bg-elevated', t.bgElevated]]) {
    check(`${theme.id}: text on ${name}`, () => {
      const c = contrast(t.text, ground)
      assert.ok(c >= BODY_TEXT, `text ${t.text} on ${ground} is ${ratio(c)}, needs ${BODY_TEXT}:1`)
    })
  }

  // 2. The two greys recede on purpose, but "receding" and "unreadable" are
  //    different things. text-dim carries real words - "unlogged", "tap to
  //    log", the hint under every field.
  for (const [name, color] of [['text-mid', t.textMid], ['text-dim', t.textDim]]) {
    check(`${theme.id}: ${name} on bg`, () => {
      const c = contrast(color, t.bg)
      assert.ok(c >= SECONDARY, `${name} ${color} on ${t.bg} is ${ratio(c)}, needs ${SECONDARY}:1`)
    })
    check(`${theme.id}: ${name} on bg-panel`, () => {
      const c = contrast(color, t.bgPanel)
      assert.ok(c >= SECONDARY, `${name} ${color} on ${t.bgPanel} is ${ratio(c)}, needs ${SECONDARY}:1`)
    })
  }

  // 3. The status colours. These are the whole point of the app's colour and
  //    they appear as large figures, day-row values, and the bar itself.
  for (const [name, color] of [
    ['green', t.green],
    ['amber', t.amber],
    ['red', t.red],
    ['red-deep', t.redDeep],
    ['blue', t.blue],
    ['teal', t.teal],
    ['cyan', t.cyan],
    ['purple', t.purple],
    ['orange', t.orange]
  ]) {
    check(`${theme.id}: ${name} on bg`, () => {
      const c = contrast(color, t.bg)
      assert.ok(c >= LARGE_TEXT, `${name} ${color} on ${t.bg} is ${ratio(c)}, needs ${LARGE_TEXT}:1`)
    })
    check(`${theme.id}: ${name} on bg-panel`, () => {
      const c = contrast(color, t.bgPanel)
      assert.ok(c >= LARGE_TEXT, `${name} ${color} on ${t.bgPanel} is ${ratio(c)}, needs ${LARGE_TEXT}:1`)
    })
  }

  // 4. Green, amber and red have to be told apart FROM EACH OTHER, not just
  //    from the background. A theme where amber and red both land on burnt
  //    orange would pass every contrast check above and still be useless.
  check(`${theme.id}: green / amber / red are mutually distinct`, () => {
    const pairs = [
      ['green', t.green, 'amber', t.amber],
      ['amber', t.amber, 'red', t.red],
      ['green', t.green, 'red', t.red]
    ]
    for (const [an, a, bn, b] of pairs) {
      const d = perceptualDistance(a, b)
      assert.ok(d >= 0.1, `${an} ${a} and ${bn} ${b} are only ${d.toFixed(3)} apart in Oklab`)
    }
  })

  // 5. red-deep has to be genuinely deeper than red, or the overage ramp runs
  //    backwards and being $200 over looks LIGHTER than being $1 over.
  check(`${theme.id}: red-deep is darker than red`, () => {
    const red = hexToOklch(t.red)
    const deep = hexToOklch(t.redDeep)
    assert.ok(
      deep.l < red.l - 0.03,
      `red-deep ${t.redDeep} (L ${deep.l.toFixed(3)}) is not meaningfully darker than red ${t.red} (L ${red.l.toFixed(3)})`
    )
  })

  // 6. The three grounds have to be separable, and in the right order for the
  //    theme's mode - light themes invert elevation.
  check(`${theme.id}: grounds are separable and correctly ordered`, () => {
    const [lb, lp, le] = [luminance(t.bg), luminance(t.bgPanel), luminance(t.bgElevated)]
    if (theme.mode === 'dark') {
      assert.ok(lb < lp && lp < le, 'dark themes must get lighter: bg < panel < elevated')
    } else {
      assert.ok(lb > lp && lp > le, 'light themes must get darker: bg > panel > elevated')
    }
    assert.ok(
      contrast(t.bg, t.bgElevated) >= 1.12,
      `bg ${t.bg} and bg-elevated ${t.bgElevated} are ${ratio(contrast(t.bg, t.bgElevated))} apart - not visibly different`
    )
  })

  // 7. Borders carry state in this design, so they have to be visible against
  //    the surfaces they sit on rather than merely present.
  check(`${theme.id}: borders are visible`, () => {
    const c = contrast(t.border, t.bg)
    assert.ok(c >= 1.2, `border ${t.border} on ${t.bg} is ${ratio(c)}`)
    const cb = contrast(t.borderBright, t.bgPanel)
    assert.ok(cb >= 1.3, `border-bright ${t.borderBright} on ${t.bgPanel} is ${ratio(cb)}`)
  })

  // 8. Walk the ACTUAL ramp this theme produces, at the resolution the bar
  //    animates through it, and require every colour along the way to stay
  //    legible. This is the check that would catch a theme whose green and
  //    red are both fine but whose OKLCH midpoint dips into something dark.
  check(`${theme.id}: every colour along the ramp stays legible`, () => {
    const colors = rampColorsFor(theme)
    let worst = { c: Infinity, at: null, hex: null }
    for (let i = 0; i <= 200; i += 1) {
      const at = i / 100
      const hex = rampHex(at, colors)
      const c = contrast(hex, t.bg)
      if (c < worst.c) worst = { c, at, hex }
    }
    assert.ok(
      worst.c >= LARGE_TEXT,
      `ramp dips to ${ratio(worst.c)} at ${Math.round(worst.at * 100)}% spent (${worst.hex})`
    )
  })

  // 9. The ramp must not reverse direction on the way from green to red. It
  //     goes green -> yellow -> orange -> red by taking the short way round
  //     the hue wheel; a theme whose green sits on the far side would send it
  //     through cyan and blue instead, which is a completely different and
  //     much worse-looking animation.
  check(`${theme.id}: ramp hue travels green -> amber -> red without detour`, () => {
    const colors = rampColorsFor(theme)
    const greenH = hexToOklch(colors.green).h
    const redH = hexToOklch(colors.red).h
    let delta = redH - greenH
    if (delta > 180) delta -= 360
    if (delta < -180) delta += 360
    assert.ok(
      Math.abs(delta) <= 180,
      `green ${colors.green} to red ${colors.red} is ${delta.toFixed(0)}deg apart`
    )
    // Every step along the way has to stay chromatic. A ramp that passes
    // through grey has lost the thing it exists to communicate.
    for (let i = 0; i <= 100; i += 5) {
      const { c } = hexToOklch(rampHex(i / 100, colors))
      assert.ok(c >= 0.04, `ramp desaturates to chroma ${c.toFixed(3)} at ${i}% spent`)
    }
  })

  // Report the numbers, not just a tick - it's the figures that tell you a
  // theme is scraping past rather than comfortably clear.
  const summary = [
    `text ${ratio(contrast(t.text, t.bg))}`,
    `dim ${ratio(contrast(t.textDim, t.bg))}`,
    `green ${ratio(contrast(t.green, t.bg))}`,
    `amber ${ratio(contrast(t.amber, t.bg))}`,
    `red ${ratio(contrast(t.red, t.bg))}`
  ].join(' · ')
  console.log(`  ${summary}\n`)
}

// The picker renders THEMES in array order, so the array IS the running order,
// and "darkest to lightest" is a property of it rather than a note in a
// comment. Asserted because it is exactly the kind of thing that decays: the
// next palette gets appended to the end of the list, where it is easiest to
// type, rather than dropped into the position its background belongs in.
check('themes run darkest to lightest', () => {
  const order = THEMES.map((t) => ({ id: t.id, l: luminance(t.tokens.bg) }))
  for (let i = 1; i < order.length; i += 1) {
    assert.ok(
      order[i].l > order[i - 1].l,
      `${order[i].id} (bg luminance ${order[i].l.toFixed(3)}) should sit after something darker, ` +
        `but follows ${order[i - 1].id} (${order[i - 1].l.toFixed(3)})`
    )
  }
})

// Two themes a user cannot tell apart in the picker are one theme and a
// puzzle. Adjacent entries are the pair most at risk, since the list is sorted
// by exactly the quantity being compared.
check('adjacent themes are visibly different from each other', () => {
  for (let i = 1; i < THEMES.length; i += 1) {
    const a = THEMES[i - 1]
    const b = THEMES[i]
    const c = contrast(a.tokens.bg, b.tokens.bg)
    assert.ok(
      c >= 1.15,
      `${a.id} and ${b.id} backgrounds are only ${ratio(c)} apart - they will read as the same choice`
    )
  }
})

// Ids have to be unique - they're the persisted value, and a duplicate would
// silently make one theme unreachable.
check('theme ids are unique', () => {
  const ids = THEMES.map((t) => t.id)
  assert.equal(new Set(ids).size, ids.length, 'duplicate theme id')
})

// Every theme must define every token, or applyTheme writes `undefined` into a
// custom property and that part of the UI falls back to whatever the last
// theme left behind.
check('every theme defines every token', () => {
  const expected = Object.keys(THEMES[0].tokens)
  for (const theme of THEMES) {
    const got = Object.keys(theme.tokens)
    assert.deepEqual(got.sort(), [...expected].sort(), `${theme.id} has a different token set`)
    for (const key of expected) {
      assert.ok(theme.tokens[key], `${theme.id} is missing ${key}`)
    }
  }
})

console.log(`${checks - failures}/${checks} checks passed`)
if (failures > 0) {
  console.error(`\n${failures} FAILED`)
  process.exit(1)
}
