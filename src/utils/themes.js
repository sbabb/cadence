// The three palettes, and the machinery that swaps between them.
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
// Three palettes, ordered darkest to lightest - which is the order they appear
// in the picker, and is asserted by scripts/verify-themes.mjs so it cannot
// drift as palettes come and go.
//
// Two are published ones - Tokyo Night and Catppuccin Latte - rather than
// hand-mixed variants, because these are IDE themes people already know by
// sight. Slate is the exception and is ours: there is no canonical neutral
// grey to borrow, and the gap it fills is a light theme with no hue in it at
// all. The borrowed two are no longer quite their published selves, though:
// both published greys fail WCAG AA as body text, and a few Latte accents fell
// just short of 3:1 on the elevated panel, so those tokens have been moved
// until they pass. Recognisable beats canonical; readable beats both.
//
// Nord, Gruvbox Dark and Catppuccin Mocha were removed. Nothing has to
// migrate for that: getTheme() falls back to the default for an id it does
// not recognise, and parseBackup() does the same for a theme name inside an
// imported file, so a user or a backup still naming one of them lands on Tokyo
// Night rather than on an error.
//
// Five structural rules every theme has to keep, or the UI stops making
// sense:
//   - bg / bg-panel / bg-elevated must be visibly separable, in that order of
//     prominence. On light themes that means panels get DARKER, not lighter;
//     the CSS handles this on its own given correct tokens.
//   - text, text-mid and text-dim are all real words, so all three clear
//     WCAG AA's 4.5:1 on bg, bg-panel AND bg-elevated - the elevated panel is
//     the tightest ground and the one the dim labels most often sit on. They
//     still have to read as three steps, dim < mid < text.
//   - green / amber / red must be distinguishable side by side, and clear 3:1
//     on all three grounds. They carry meaning; they are not decoration.
//   - each status colour has a -text twin for when it is used as WORDS, which
//     is most of the time: a button label, an error, a day's figures in the
//     list. Those are small, so AA wants 4.5:1, and on a light ground that is
//     darker than the colour can be and still work as the bar or a border. So
//     fills, borders, the bar and big figures take the colour; text takes its
//     -text twin. Where the colour already clears 4.5 - all of Tokyo Night -
//     the twin is the same value.
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
  borderField: '--border-field',
  text: '--text',
  textMid: '--text-mid',
  textDim: '--text-dim',
  green: '--green',
  amber: '--amber',
  red: '--red',
  redDeep: '--red-deep',
  teal: '--teal',
  blue: '--blue',
  greenText: '--green-text',
  amberText: '--amber-text',
  redText: '--red-text',
  tealText: '--teal-text',
  blueText: '--blue-text',
  cyan: '--cyan',
  purple: '--purple',
  orange: '--orange',
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
      // The outline of an input. Kept apart from border-bright, which is also
      // hover borders, dashed dividers and a disabled arrow's colour - raising
      // that to 3:1 would make all of those shout. An empty field has nothing
      // else to show where it is, so its edge alone is held to WCAG's 3:1 for
      // UI components, against the page and the panel it sits on.
      borderField: '#666e90',
      text: '#c0caf5',
      // Lifted from the published #787c99 / #636c97, which read at 3.3:1 and
      // 2.6:1 on the elevated panel - fine for a code editor's comments, not
      // for the only label under a figure. Now 6.0:1 and 4.5:1 there.
      textMid: '#abadbf',
      textDim: '#8e94b4',
      green: '#9ece6a',
      amber: '#e0af68',
      red: '#f7768e',
      redDeep: '#db4b4b',
      teal: '#73daca',
      blue: '#7aa2f7',
      // Every accent here already clears 4.5:1 on all three grounds, so the
      // text twins are the fills themselves.
      greenText: '#9ece6a',
      amberText: '#e0af68',
      redText: '#f7768e',
      tealText: '#73daca',
      blueText: '#7aa2f7',
      cyan: '#7dcfff',
      purple: '#bb9af7',
      orange: '#ff9e64',
      scrim: 'rgba(13, 14, 20, 0.80)',
      scrimStrong: 'rgba(13, 14, 20, 0.88)'
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
      // The greys are Grey Fog's, an Omarchy desktop theme, so the app sits on
      // the same ground as the desktop it was written on. With only three
      // palettes left this one carries the whole middle of the range by itself,
      // and a darker ground is what makes that middle read as a third choice
      // rather than a dimmer Latte: #d6d6d6 against Latte's #eff1f5 is 1.29:1,
      // where the older #dcdcdc managed 1.21 against a 1.15 floor.
      bg: '#d6d6d6',
      bgPanel: '#c8c8c8',
      bgElevated: '#bababa',
      border: '#9c9c9c',
      borderBright: '#7a7a7a',
      borderField: '#6c6c6c',
      text: '#1c1c1c',
      textMid: '#383838',
      textDim: '#4a4a4a',
      // Chosen by search rather than by eye - see scripts/verify-themes.mjs
      // for the rules they had to satisfy. A light ground is the hard case for
      // this app: every status colour has to clear 3:1 on the page, a panel
      // AND the elevated panel, which forces them dark, while green/amber/red
      // still have to be told apart from each other once they are. On the
      // elevated panel, the tightest of the three, all three sit just over
      // the line (3.0-3.2:1), close enough together that no one of them
      // shouts over the rest.
      green: '#20702c',
      // Still a touch more chromatic than the even-contrast set the search
      // settled on. At equal contrast with green and red this colour lands on
      // brown, and brown does not say "close to your limit" - amber has to
      // look like amber or the middle of the ramp means nothing. It was
      // lighter again (#8a6410) until the elevated panel was held to 3:1 too,
      // which it missed at 2.8; this is the least darkening that clears it.
      amber: '#825f0f',
      red: '#b33344',
      redDeep: '#8c172c',
      teal: '#1e6464',
      blue: '#175098',
      // Same hue as each fill, darkened only as far as 4.5:1 on the elevated
      // panel needs. That is a long way on a mid-grey ground: amber in
      // particular lands close to olive here, the brown the note above
      // warns about. It is the price of small amber text being readable on
      // #bababa at all; the bar and the big figures keep the brighter fill.
      greenText: '#005716',
      amberText: '#624501',
      redText: '#940e2c',
      tealText: '#035354',
      blueText: '#0e4990',
      cyan: '#1b5a75',
      purple: '#6d3d8d',
      orange: '#8e3518',
      // The over-budget track: enough pink to read as wrong, pale enough that
      // the deep red fill still stands off it. Stepped down with the ground.
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
      borderField: '#7f8392',
      text: '#4c4f69',
      // Darkened from the published #6c6f85 / #808395, which fell to 3.7:1
      // and 2.8:1 on the elevated panel. Latte's own text is only 6:1 there,
      // so clearing 4.5 leaves the three greys close together; they still run
      // dim < mid < text, which the verify script holds them to.
      textMid: '#56586a',
      textDim: '#606270',
      // Latte's own accents, not the dark themes' - Tokyo Night's #9ece6a on
      // white is barely there. These are darker and more saturated precisely
      // so they survive being put on a pale ground. Green, amber and teal are
      // each nudged a shade darker than published (#379720, #b97601,
      // #179299), which sat at 2.8:1 on the elevated panel; now 3.0:1.
      green: '#35921f',
      amber: '#b27101',
      red: '#d20f39',
      redDeep: '#a10b2c',
      teal: '#168d94',
      blue: '#1e66f5',
      // Same hue as each fill, darkened only as far as 4.5:1 on the elevated
      // panel needs - which on Latte's pale grounds is a shade, not a stop.
      greenText: '#1d7201',
      amberText: '#8b5702',
      redText: '#c70234',
      tealText: '#046e74',
      blueText: '#0c56e4',
      cyan: '#0c8dc0',
      purple: '#8839ef',
      orange: '#e05a0b',
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
