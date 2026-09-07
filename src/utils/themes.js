// The four palettes, and the machinery that swaps between them.
//
// The stylesheet already had one rule that made this cheap: no component picks
// its own hex, everything reads a custom property off :root. So a theme is
// just a different set of values for those properties, written onto
// documentElement at runtime. Nothing in the CSS needs to know a theme system
// exists.
//
// Two of the tokens here are new, and were hardcoded in index.css until now:
// the over-budget track tint and the modal scrims. They had to move, because
// a wine-dark track and a near-black scrim are both wrong on a light theme.
//
// Four palettes, ordered darkest to lightest - which is the order they appear
// in the picker, and is asserted by scripts/verify-themes.mjs so it cannot
// drift as palettes come and go.
//
// Three are the published ones - Tokyo Night, Nord, Catppuccin Latte - rather
// than hand-mixed variants, because these are IDE themes people already know
// by sight, and the whole point is that picking "Nord" gives you the Nord you
// were expecting. Slate is the exception and is ours: there is no canonical
// neutral grey to borrow, and the gap it fills is a light theme with no hue in
// it at all.
//
// Gruvbox Dark and Catppuccin Mocha were removed. Nothing has to migrate for
// that: getTheme() falls back to the default for an id it does not recognise,
// and parseBackup() does the same for a theme name inside an imported file, so
// a user or a backup still naming one of them lands on Tokyo Night rather than
// on an error.
//
// Three structural rules every theme has to keep, or the UI stops making
// sense:
//   - bg / bg-panel / bg-elevated must be visibly separable, in that order of
//     prominence. On light themes that means panels get DARKER, not lighter;
//     the CSS handles this on its own given correct tokens.
//   - green / amber / red must be distinguishable side by side, and legible
//     against bg. They carry meaning; they are not decoration.
//   - red-deep must actually be deeper than red. The bar's overage colour
//     interpolates toward it, and a "deep" red that's lighter than the red it
//     starts from would run the ramp backwards.
//
// Contrast against these rules is checked by scripts/verify-themes.mjs rather
// than by eye.

const TOKEN_VARS = {
  bg: '--bg',
  bgPanel: '--bg-panel',
  bgElevated: '--bg-elevated',
  border: '--border',
  borderBright: '--border-bright',
  text: '--text',
  textMid: '--text-mid',
  textDim: '--text-dim',
  green: '--green',
  amber: '--amber',
  red: '--red',
  redDeep: '--red-deep',
  teal: '--teal',
  blue: '--blue',
  cyan: '--cyan',
  purple: '--purple',
  orange: '--orange',
  trackOver: '--track-over',
  scrim: '--scrim',
  scrimStrong: '--scrim-strong'
}

export const THEMES = [
  {
    id: 'tokyo-night',
    label: 'TOKYO NIGHT',
    detail: 'Deep indigo. The original.',
    mode: 'dark',
    tokens: {
      bg: '#1a1b26',
      bgPanel: '#1f2335',
      bgElevated: '#292e42',
      border: '#2f3549',
      borderBright: '#3b4261',
      text: '#c0caf5',
      textMid: '#787c99',
      textDim: '#636c97',
      green: '#9ece6a',
      amber: '#e0af68',
      red: '#f7768e',
      redDeep: '#db4b4b',
      teal: '#73daca',
      blue: '#7aa2f7',
      cyan: '#7dcfff',
      purple: '#bb9af7',
      orange: '#ff9e64',
      trackOver: '#3a2230',
      scrim: 'rgba(13, 14, 20, 0.80)',
      scrimStrong: 'rgba(13, 14, 20, 0.88)'
    }
  },
  {
    id: 'nord',
    label: 'NORD',
    detail: 'Cold, muted, low contrast.',
    mode: 'dark',
    tokens: {
      // Nord's own #2e3440 is the usual background, but it's a pale ground
      // for a dark theme and Nord's accents are deliberately muted - on it,
      // Nord red lands at 2.75:1, which is not a colour you can read a number
      // in. Dropping to the darker Polar Night shade and sliding everything
      // else up one keeps every published Nord colour intact and buys the
      // whole palette the contrast it needs.
      bg: '#242933',
      bgPanel: '#2a303b',
      bgElevated: '#3b4252',
      border: '#4c566a',
      borderBright: '#616e88',
      text: '#eceff4',
      textMid: '#c2ccdb',
      textDim: '#98a3b8',
      green: '#a3be8c',
      amber: '#ebcb8b',
      // Nord 11 (#bf616a) is the DEEP end here rather than the base red. It's
      // the darkest rose that still clears 3:1 on a Polar Night ground, so
      // there's nothing legible left below it - the base red has to sit above
      // it instead, which is also the right way round: the deep one is the
      // one you're meant to see only when things have gone badly.
      red: '#d3777f',
      redDeep: '#bf616a',
      teal: '#8fbcbb',
      blue: '#81a1c1',
      cyan: '#88c0d0',
      purple: '#b48ead',
      orange: '#d08770',
      trackOver: '#42303a',
      scrim: 'rgba(24, 28, 36, 0.84)',
      scrimStrong: 'rgba(24, 28, 36, 0.91)'
    }
  },
  {
    id: 'slate',
    label: 'SLATE',
    detail: 'Neutral grey. Light without the tint.',
    mode: 'light',
    tokens: {
      // A true neutral: every grey here has r == g == b, so the chrome carries
      // no hue whatsoever and the only colour on screen is colour that means
      // something. That is the whole idea of this palette, and it is why the
      // accents below are muted rather than vivid - full-strength colour on a
      // colourless ground reads as though it wandered in from another app.
      //
      // Light like Latte, but a clear step darker: #dcdcdc against Latte's
      // #eff1f5 is 1.21:1, which is enough that the two never look like the
      // same choice made twice in the picker.
      bg: '#dcdcdc',
      bgPanel: '#d0d0d0',
      bgElevated: '#c2c2c2',
      border: '#a4a4a4',
      borderBright: '#888888',
      text: '#1c1c1c',
      textMid: '#454545',
      textDim: '#585858',
      // Chosen by search rather than by eye - see scripts/verify-themes.mjs
      // for the rules they had to satisfy. A light ground is the hard case for
      // this app: every status colour has to clear 3:1 on BOTH the page and a
      // panel, which forces them dark, while green/amber/red still have to be
      // told apart from each other once they are. All three clear the 3:1 bar
      // with most of a stop to spare on the tighter of the two grounds, and
      // sit close enough together that no one of them shouts over the rest.
      green: '#20702c',
      // Deliberately a touch lighter and more chromatic than the even-contrast
      // set the search settled on. At equal contrast with green and red this
      // colour lands on brown, and brown does not say "close to your limit" -
      // amber has to look like amber or the middle of the ramp means nothing.
      amber: '#8a6410',
      red: '#b33344',
      redDeep: '#8c172c',
      teal: '#1e6464',
      blue: '#175098',
      cyan: '#1b5a75',
      purple: '#6d3d8d',
      orange: '#8e3518',
      // The over-budget track: enough pink to read as wrong, pale enough that
      // the deep red fill still stands off it.
      trackOver: '#e3c4ca',
      // Dark scrims on a light theme, same reasoning as Latte's - a pale wash
      // over pale content leaves the dialog floating in fog.
      scrim: 'rgba(28, 28, 28, 0.55)',
      scrimStrong: 'rgba(28, 28, 28, 0.66)'
    }
  },
  {
    id: 'catppuccin-latte',
    label: 'CATPPUCCIN LATTE',
    detail: 'Light. Readable in daylight.',
    mode: 'light',
    tokens: {
      // Elevation inverts on a light theme: panels sit DARKER than the page,
      // not lighter. The stylesheet needs no changes for this - it only ever
      // asks for "the panel colour", never for "a bit lighter than the bg".
      bg: '#eff1f5',
      bgPanel: '#e6e9ef',
      bgElevated: '#dce0e8',
      border: '#bcc0cc',
      borderBright: '#9ca0b0',
      text: '#4c4f69',
      textMid: '#6c6f85',
      textDim: '#808395',
      // Latte's own accents, not the dark themes' - Tokyo Night's #9ece6a on
      // white is barely there. These are darker and more saturated precisely
      // so they survive being put on a pale ground.
      green: '#379720',
      amber: '#b97601',
      red: '#d20f39',
      redDeep: '#a10b2c',
      teal: '#179299',
      blue: '#1e66f5',
      cyan: '#0c8dc0',
      purple: '#8839ef',
      orange: '#e05a0b',
      trackOver: '#f3d3da',
      // A light scrim over light content would leave the dialog floating in
      // fog, so the scrim stays dark here too - just weaker, because there's
      // less brightness to hold back.
      scrim: 'rgba(76, 79, 105, 0.55)',
      scrimStrong: 'rgba(76, 79, 105, 0.66)'
    }
  }
]

export const DEFAULT_THEME = 'tokyo-night'

export function getTheme(id) {
  return THEMES.find((t) => t.id === id) || THEMES.find((t) => t.id === DEFAULT_THEME)
}

// The four colours the spend bar's OKLCH ramp interpolates between. Pulled out
// separately because the ramp is computed in JavaScript, not CSS, so it can't
// read the custom properties - it has to be handed the values.
export function rampColorsFor(theme) {
  const t = theme.tokens
  return { green: t.green, amber: t.amber, red: t.red, redDeep: t.redDeep }
}

// Writes a theme onto the document. Setting properties on documentElement
// beats swapping a stylesheet or a body class: the cascade already resolves
// every colour in the app through these names, so one assignment per token
// repaints everything at once, with no flash and no specificity fight.
export function applyTheme(theme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  Object.entries(TOKEN_VARS).forEach(([key, cssVar]) => {
    root.style.setProperty(cssVar, theme.tokens[key])
  })
  root.setAttribute('data-theme', theme.id)
  root.style.colorScheme = theme.mode

  // Android colours the system UI from this, so leaving it on Tokyo Night's
  // indigo would put a navy strip above a Latte-white app.
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme.tokens.bg)
}
