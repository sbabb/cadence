// Every timing and curve the bar uses, defined once, in one place.
//
// This is deliberately a data table rather than values scattered through the
// components: the whole motion spec can be read off in one screen and retyped
// into Rive's interpolation panel without hunting through CSS. The CSS-driven
// animations in index.css are kept in step with it by hand - the durations
// there are the same numbers written again, because CSS cannot read this
// file.
//
// Curves are cubic-bezier control points, same four numbers Rive and CSS both
// take. Two families are in use:
//   - [0.16, 1, 0.30, 1]      expo-out. Fast commit, long gentle arrival.
//                             Everything that settles into a new value.
//   - [0.34, 1.56, 0.64, 1]   back-out. Overshoots past the target and comes
//                             back. Everything that should feel like an
//                             impact rather than a transition.

export const MOTION = {
  // Value-driven: these interpolate a number toward a new target.
  arcSettle: {
    label: 'Arc settle',
    duration: 520,
    easing: [0.16, 1, 0.3, 1],
    note: 'Bar sweeps to its new length'
  },
  colorDrift: {
    label: 'Color drift',
    duration: 680,
    easing: [0.16, 1, 0.3, 1],
    note: 'Deliberately slower than the arc, so color reads as a consequence of the sweep rather than part of it'
  },
  numberCount: {
    label: 'Number count',
    duration: 520,
    easing: [0.16, 1, 0.3, 1],
    note: 'Center figure counts rather than snapping'
  },

  // Time-driven: these play as animations in their own right. These four are
  // the ones worth rebuilding in Rive - they are motion, not data.
  entry: {
    label: 'Entry',
    duration: 720,
    easing: [0.16, 1, 0.3, 1],
    note: 'Bar sweeps out from empty on mount, number counts up'
  },
  idleBreathe: {
    label: 'Idle breathe',
    duration: 2600,
    easing: [0.42, 0, 0.58, 1],
    loop: true,
    note: 'Only while today is unlogged. Stops the moment something is logged'
  },
  tapPress: {
    label: 'Tap press',
    duration: 140,
    easing: [0.4, 0, 1, 1],
    note: 'Scale to 0.97 on pointer down'
  },
  tapRelease: {
    label: 'Tap release',
    duration: 260,
    easing: [0.34, 1.56, 0.64, 1],
    note: 'Springs back past 1.0 and settles'
  },
  thresholdPulse: {
    label: 'Threshold pulse',
    duration: 420,
    easing: [0.34, 1.56, 0.64, 1],
    note: 'One shot, fires only on the transition from under to over. Never repeats while over'
  }
}

// Solves a cubic bezier curve for y given x, the same way browsers do for CSS
// transitions. The curve is defined by two control points; the first and last
// are pinned at (0,0) and (1,1). We need x -> y (not the parametric t -> y),
// so we Newton-Raphson our way to the t that produces the x we were asked
// about, then evaluate y at that t.
export function cubicBezier(x1, y1, x2, y2) {
  const A = (a, b) => 1 - 3 * b + 3 * a
  const B = (a, b) => 3 * b - 6 * a
  const C = (a) => 3 * a

  const calc = (t, a, b) => ((A(a, b) * t + B(a, b)) * t + C(a)) * t
  const slope = (t, a, b) => 3 * A(a, b) * t * t + 2 * B(a, b) * t + C(a)

  return function ease(x) {
    if (x <= 0) return 0
    if (x >= 1) return 1
    // Linear curves need no solving, and dividing by a zero slope below would
    // be unpleasant.
    if (x1 === y1 && x2 === y2) return x

    let t = x
    for (let i = 0; i < 8; i += 1) {
      const currentX = calc(t, x1, x2) - x
      const currentSlope = slope(t, x1, x2)
      if (Math.abs(currentX) < 1e-6) break
      if (Math.abs(currentSlope) < 1e-6) break
      t -= currentX / currentSlope
    }
    return calc(t, y1, y2)
  }
}

const easingCache = new Map()

// Curves get reused every frame, so build each solver once.
export function easingFn(easing) {
  const key = easing.join(',')
  if (!easingCache.has(key)) {
    easingCache.set(key, cubicBezier(easing[0], easing[1], easing[2], easing[3]))
  }
  return easingCache.get(key)
}

// The OS-level "I don't want things moving" setting. Respected everywhere:
// animated values snap to their targets and the looping breathe never starts.
export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
