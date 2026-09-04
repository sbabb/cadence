// Color math for the spend dial.
//
// Everything here exists to solve one problem: blending green -> amber -> red
// in a way that looks continuous rather than lurching. Naive RGB interpolation
// averages the three channels independently, which is perceptually wrong - the
// midpoint between green and red sags into a muddy olive and reads noticeably
// darker than either end.
//
// OKLCH (the cylindrical form of Oklab) is built so equal numeric steps look
// like equal visual steps. Its three components are Lightness, Chroma
// (vividness) and Hue (an angle). Rotating hue at a fixed L and C keeps
// perceived brightness genuinely steady the whole way round, so a sweep from
// green (~145deg) to red (~25deg) passes cleanly through yellow and orange -
// which means the amber midpoint of the dial's ramp comes out for free, purely
// as a consequence of taking the short way round the hue wheel.
//
// The conversion math below is Bjorn Ottosson's Oklab, unchanged.

function clamp01(n) {
  return n < 0 ? 0 : n > 1 ? 1 : n
}

// sRGB channel (0-1, gamma encoded) -> linear light
function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

// linear light -> sRGB channel (0-1, gamma encoded)
function linearToSrgb(c) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
}

export function hexToRgb(hex) {
  const clean = hex.replace('#', '')
  return {
    r: parseInt(clean.slice(0, 2), 16) / 255,
    g: parseInt(clean.slice(2, 4), 16) / 255,
    b: parseInt(clean.slice(4, 6), 16) / 255
  }
}

export function rgbToHex({ r, g, b }) {
  const to255 = (c) => Math.round(clamp01(c) * 255).toString(16).padStart(2, '0')
  return `#${to255(r)}${to255(g)}${to255(b)}`
}

// sRGB -> Oklab. The cube roots are what make the space perceptual: they
// approximate the eye's non-linear response to light.
export function rgbToOklab({ r, g, b }) {
  const lr = srgbToLinear(r)
  const lg = srgbToLinear(g)
  const lb = srgbToLinear(b)

  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb

  const l_ = Math.cbrt(l)
  const m_ = Math.cbrt(m)
  const s_ = Math.cbrt(s)

  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_
  }
}

export function oklabToRgb({ L, a, b }) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b

  const l = l_ * l_ * l_
  const m = m_ * m_ * m_
  const s = s_ * s_ * s_

  return {
    r: linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
  }
}

// Oklab's a/b axes are cartesian; OKLCH restates them as chroma (distance from
// grey) and hue (angle), which is what makes interpolation intuitive.
export function oklabToOklch({ L, a, b }) {
  const c = Math.sqrt(a * a + b * b)
  let h = (Math.atan2(b, a) * 180) / Math.PI
  if (h < 0) h += 360
  return { l: L, c, h }
}

export function oklchToOklab({ l, c, h }) {
  const rad = (h * Math.PI) / 180
  return { L: l, a: c * Math.cos(rad), b: c * Math.sin(rad) }
}

export function hexToOklch(hex) {
  return oklabToOklch(rgbToOklab(hexToRgb(hex)))
}

export function oklchToHex({ l, c, h }) {
  return rgbToHex(oklabToRgb(oklchToOklab({ l, c, h })))
}

// Blends two OKLCH colors, taking the SHORTEST way round the hue wheel. This
// direction choice is the whole ballgame: green -> red the short way passes
// through yellow and orange (what we want), while the long way would swing
// through cyan, blue and magenta.
export function mixOklch(a, b, t) {
  const amount = clamp01(t)
  let deltaH = b.h - a.h
  if (deltaH > 180) deltaH -= 360
  if (deltaH < -180) deltaH += 360

  let h = a.h + deltaH * amount
  if (h < 0) h += 360
  if (h >= 360) h -= 360

  return {
    l: a.l + (b.l - a.l) * amount,
    c: a.c + (b.c - a.c) * amount,
    h
  }
}

// The bar's color ramp, deliberately weighted rather than linear.
//
// A straight 0-100% map with amber at the midpoint would have you looking at
// orange by the time you'd spent 70% of a perfectly normal day's budget, which
// reads as a warning when nothing is wrong. Instead green holds most of the
// way and the escalation is back-loaded: spending your allowance as intended
// should feel unremarkable, and the color should only tighten as you approach
// the edge. Sanity check against the brief: $35 of a $50 limit is 0.70, which
// lands 20% of the way from green to amber - "mostly green, a bit of amber."
//
// The POSITIONS below are fixed; the COLORS come from whichever theme is
// active. That split is the point: switching theme should change what red
// looks like, never when red starts.
export const RAMP_POSITIONS = [
  { at: 0.0, key: 'green', label: 'green' },
  { at: 0.65, key: 'green', label: 'green (held)' },
  { at: 0.9, key: 'amber', label: 'amber' },
  { at: 1.0, key: 'red', label: 'red' }
]

// Tokyo Night's, so a caller that hasn't been handed a theme still gets the
// app's default ramp rather than nothing.
export const DEFAULT_RAMP_COLORS = {
  green: '#9ece6a',
  amber: '#e0af68',
  red: '#f7768e',
  redDeep: '#db4b4b'
}

// hexToOklch runs six cube roots per conversion and rampHex is called on every
// animation frame, so the converted stops are built once per palette and kept.
// Keyed on the colors themselves rather than on a theme id, so the cache can't
// go stale if a palette is ever edited in place.
const rampCache = new Map()

function compiledRamp(colors) {
  const c = colors || DEFAULT_RAMP_COLORS
  const key = `${c.green}|${c.amber}|${c.red}|${c.redDeep}`
  let compiled = rampCache.get(key)
  if (!compiled) {
    compiled = {
      stops: RAMP_POSITIONS.map((pos) => ({
        at: pos.at,
        label: pos.label,
        hex: c[pos.key],
        oklch: hexToOklch(c[pos.key])
      })),
      // Past the limit the hue stops moving (it's already red - there's
      // nowhere meaningful left to go) and the color deepens instead, so
      // being $5 over and being $200 over don't look identical.
      over: hexToOklch(c.redDeep)
    }
    rampCache.set(key, compiled)
  }
  return compiled
}

// The ramp's stops as the debug panel wants to display them: position, hex,
// and the name of the colour at that position.
export function rampStops(colors) {
  return compiledRamp(colors).stops.map(({ at, hex, label }) => ({ at, hex, label }))
}

// spentFraction: the day's spend as a fraction of the day's limit. 0 = nothing
// spent, 1 = exactly at the limit, >1 = over. Returns an OKLCH color.
export function rampOklch(spentFraction, colors) {
  const { stops, over } = compiledRamp(colors)
  const t = Number.isFinite(spentFraction) ? Math.max(0, spentFraction) : 0

  if (t >= 1) {
    // 1.0 -> 2.0 (100% over) deepens the red, then holds.
    const overT = clamp01(t - 1)
    return mixOklch(stops[stops.length - 1].oklch, over, overT)
  }

  for (let i = 0; i < stops.length - 1; i += 1) {
    const from = stops[i]
    const to = stops[i + 1]
    if (t >= from.at && t <= to.at) {
      const span = to.at - from.at
      const local = span === 0 ? 0 : (t - from.at) / span
      return mixOklch(from.oklch, to.oklch, local)
    }
  }

  return stops[0].oklch
}

export function rampHex(spentFraction, colors) {
  return oklchToHex(rampOklch(spentFraction, colors))
}
