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
// The thresholds are WCAG 2.1 AA, applied to what each token is actually used
// for. Every grey - text, text-mid, text-dim - carries real words, much of it
// small (11-13px labels), so all three are held to AA's 4.5:1 for body text.
// The coloured values are 17-38px and semi-bold, the "large text" case, so
// they are held to 3:1.
//
// Both hold on all THREE grounds, not just the page. The dim greys used to be
// held to 3:1, on the page and a panel only, on the theory that secondary
// text exists to recede. An accessibility audit measured what that let
// through: the most-used label colour in the app at 2.6:1 on the elevated
// panel it most often sits on. Receding is what text-mid and text-dim are
// for; being unreadable is not.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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
const BODY_TEXT = 4.5 // every grey that carries words, dim ones included

// How far apart, in Oklab, neighbouring greys must sit to read as different
// steps rather than one colour twice. The just-noticeable difference is around
// 0.02; this asks for half as much again.
const GREY_STEP = 0.03

// The accents that actually appear in the interface, on any of the three
// grounds. cyan, purple and orange are defined for every theme but the
// stylesheet never paints with them - purple is only a swatch in the theme
// picker, on that theme's own page colour - so they keep the page-and-panel
// check below rather than being held to a ground they never touch.
const ON_SCREEN_ACCENTS = ['green', 'amber', 'red', 'redDeep', 'teal', 'blue']

// Each status colour's twin for use as words. A status colour as a fill, a
// border or a 38px figure is "large" and needs 3:1; the same colour as a
// 13px button label or a day's figures in the list needs 4.5:1, which on a
// light ground it cannot reach and still work as a fill. So the stylesheet
// paints text with these and nothing else - see the stylesheet check at the
// bottom of this file.
const TEXT_TWINS = [
  ['green', 'greenText'],
  ['amber', 'amberText'],
  ['red', 'redText'],
  ['teal', 'tealText'],
  ['blue', 'blueText']
]

// Hue drift allowed between a colour and its text twin. Darkening in OKLCH
// holds hue by construction; a twin that wanders further than this has
// become a different colour, and the meaning goes with it.
const TWIN_HUE_DRIFT = 8

const UI_COMPONENT = 3.0 // WCAG 1.4.11: an input's edge, a focus indicator

console.log('Verifying themes\n')

for (const theme of THEMES) {
  console.log(`${theme.label} (${theme.mode})`)
  const t = theme.tokens

  const grounds = [['bg', t.bg], ['bg-panel', t.bgPanel], ['bg-elevated', t.bgElevated]]

  // 1. Every grey is text, and every one of them has to be readable on every
  //    ground. text-dim carries real words - "unlogged", "tap to log", the
  //    label on every stat box, the hint under every field.
  for (const [name, color] of [['text', t.text], ['text-mid', t.textMid], ['text-dim', t.textDim]]) {
    for (const [groundName, ground] of grounds) {
      check(`${theme.id}: ${name} on ${groundName}`, () => {
        const c = contrast(color, ground)
        assert.ok(c >= BODY_TEXT, `${name} ${color} on ${groundName} ${ground} is ${ratio(c)}, needs ${BODY_TEXT}:1`)
      })
    }
  }

  // 2. Raising the two lower greys to 4.5:1 pushes them up toward text, and
  //    the point of having three is that they are three. They must stay in
  //    order - dim, then mid, then text - and each must sit visibly apart
  //    from its neighbour, or text-mid is just text-dim or text again.
  check(`${theme.id}: text-dim < text-mid < text, visibly`, () => {
    const [cd, cm, ct] = [t.textDim, t.textMid, t.text].map((c) => contrast(c, t.bg))
    assert.ok(cd < cm && cm < ct, `contrast on bg runs dim ${ratio(cd)}, mid ${ratio(cm)}, text ${ratio(ct)}`)
    const lower = perceptualDistance(t.textDim, t.textMid)
    const upper = perceptualDistance(t.textMid, t.text)
    assert.ok(lower >= GREY_STEP, `text-dim and text-mid are only ${lower.toFixed(3)} apart in Oklab`)
    assert.ok(upper >= GREY_STEP, `text-mid and text are only ${upper.toFixed(3)} apart in Oklab`)
  })

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

  //    ...and the ones the interface actually paints with hold on the
  //    elevated panel too - today's row, the stat boxes and the dialogs all
  //    sit on it, and it is the tightest of the three grounds on every theme.
  for (const key of ON_SCREEN_ACCENTS) {
    check(`${theme.id}: ${key} on bg-elevated`, () => {
      const c = contrast(t[key], t.bgElevated)
      assert.ok(c >= LARGE_TEXT, `${key} ${t[key]} on ${t.bgElevated} is ${ratio(c)}, needs ${LARGE_TEXT}:1`)
    })
  }

  // 3b. The text twins: 4.5:1 on every ground, the same colour as the fill
  //     they stand in for, and still green, amber and red to the eye - told
  //     apart from each other and from plain text, or colour has stopped
  //     meaning anything once it is small.
  for (const [fill, twin] of TEXT_TWINS) {
    for (const [groundName, ground] of grounds) {
      check(`${theme.id}: ${twin} on ${groundName}`, () => {
        const c = contrast(t[twin], ground)
        assert.ok(c >= BODY_TEXT, `${twin} ${t[twin]} on ${groundName} ${ground} is ${ratio(c)}, needs ${BODY_TEXT}:1`)
      })
    }
    check(`${theme.id}: ${twin} is still ${fill}`, () => {
      let d = Math.abs(hexToOklch(t[twin]).h - hexToOklch(t[fill]).h)
      if (d > 180) d = 360 - d
      assert.ok(d <= TWIN_HUE_DRIFT, `${twin} ${t[twin]} is ${d.toFixed(1)}deg of hue away from ${fill} ${t[fill]}`)
    })
  }
  check(`${theme.id}: green / amber / red text stay distinct, and distinct from text`, () => {
    const pairs = [
      ['greenText', 'amberText'],
      ['amberText', 'redText'],
      ['greenText', 'redText'],
      ['greenText', 'text'],
      ['amberText', 'text'],
      ['redText', 'text']
    ]
    for (const [a, b] of pairs) {
      const d = perceptualDistance(t[a], t[b])
      assert.ok(d >= 0.1, `${a} ${t[a]} and ${b} ${t[b]} are only ${d.toFixed(3)} apart in Oklab`)
    }
  })

  // 3c. An input's edge is the only thing that says "type here" on an empty
  //     field, so it is held to 3:1 against the page and the panel - the two
  //     grounds a field sits on or is filled with. And focus has to be a
  //     visible change: the blue ring against every ground, and far enough
  //     from the resting edge that turning blue reads as something happening.
  check(`${theme.id}: an input's edge clears ${UI_COMPONENT}:1`, () => {
    for (const [groundName, ground] of [['bg', t.bg], ['bg-panel', t.bgPanel]]) {
      const c = contrast(t.borderField, ground)
      assert.ok(c >= UI_COMPONENT, `border-field ${t.borderField} on ${groundName} ${ground} is ${ratio(c)}`)
    }
  })
  check(`${theme.id}: the focus colour is visible, and a change from the resting edge`, () => {
    for (const [groundName, ground] of grounds) {
      const c = contrast(t.blue, ground)
      assert.ok(c >= UI_COMPONENT, `focus blue ${t.blue} on ${groundName} ${ground} is ${ratio(c)}`)
    }
    const d = perceptualDistance(t.blue, t.borderField)
    assert.ok(d >= 0.1, `focus blue and border-field are only ${d.toFixed(3)} apart in Oklab`)
  })

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
    `mid ${ratio(contrast(t.textMid, t.bg))}`,
    `dim ${ratio(contrast(t.textDim, t.bg))}`,
    `dim on elevated ${ratio(contrast(t.textDim, t.bgElevated))}`,
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

// --- the stylesheet ------------------------------------------------------
//
// The token rules above are only half of it: a perfect -text twin does nothing
// if a rule still paints words with the fill. These read index.css itself.

const CSS = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const RULES = [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim().replace(/\s+/g, ' '), body: m[2] }))
const STATUS = '(green|amber|red|teal|blue)'

check('no text is painted in a status fill - words use the -text twins', () => {
  const offenders = RULES.filter((r) => new RegExp(`(^|[^-\\w])color:\\s*var\\(--${STATUS}\\)`).test(r.body))
  assert.equal(offenders.length, 0, `color: uses a fill in ${offenders.map((r) => r.selector).join(' | ')}`)
})

check('no text sits on a status fill - filled states use the -text twins', () => {
  const offenders = RULES.filter(
    (r) => new RegExp(`background:\\s*var\\(--${STATUS}\\)`).test(r.body) && /(^|[^-\w])color:/.test(r.body)
  )
  assert.equal(offenders.length, 0, `text on a fill in ${offenders.map((r) => r.selector).join(' | ')}`)
})

check("every input's edge is --border-field", () => {
  for (const selector of [".field input[type='date']", '.amount-input-row', '.log-spend-input-row']) {
    const rule = RULES.find((r) => r.selector === selector)
    assert.ok(rule, `no rule for ${selector}`)
    assert.match(rule.body, /border:\s*1px solid var\(--border-field\)/, `${selector} does not use --border-field`)
  }
})

// index.css repeats Tokyo Night on :root as the paint before main.jsx applies
// a theme. A token changed in themes.js and not there shows the old colour
// for a frame - or for good, if it is a token applyTheme never writes.
check(':root defaults match Tokyo Night', () => {
  const root = RULES.find((r) => r.selector === ':root')
  const tokyo = THEMES.find((th) => th.id === 'tokyo-night').tokens
  const vars = Object.fromEntries([...root.body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim().toLowerCase()]))
  const camel = (k) => k.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`)
  for (const [key, value] of Object.entries(tokyo)) {
    if (!value.startsWith('#')) continue
    assert.equal(vars[camel(key)], value.toLowerCase(), `:root --${camel(key)} is ${vars[camel(key)]}, Tokyo Night says ${value}`)
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
