import { useEffect, useRef, useState } from 'react'
import { easingFn, prefersReducedMotion } from '../utils/motion.js'

// Drives a number toward a target over time, returning the current in-between
// value on every frame.
//
// Why this rather than a CSS transition: the bar needs the intermediate
// value, not just the endpoints. The fill's colour is recomputed from the
// eased fraction each frame and the centre figure counts through real
// numbers. A CSS transition would animate the visual result while leaving
// JavaScript ignorant of it.
//
// Retargeting mid-flight is handled by restarting from wherever the value
// currently is rather than from the old target, so a second spend logged
// before the first has settled continues smoothly instead of jumping back.
export default function useAnimatedValue(target, { duration, easing, speed = 1, enabled = true }) {
  const [value, setValue] = useState(target)
  const frameRef = useRef(null)
  const fromRef = useRef(target)
  const startRef = useRef(0)
  // Mirrors `value` without making the effect depend on it - reading state
  // inside the effect would restart the animation on every frame it sets.
  const currentRef = useRef(target)

  useEffect(() => {
    if (!enabled || prefersReducedMotion() || duration <= 0) {
      currentRef.current = target
      setValue(target)
      return undefined
    }

    if (currentRef.current === target) return undefined

    const ease = easingFn(easing)
    const scaledDuration = Math.max(1, duration / (speed || 1))
    fromRef.current = currentRef.current
    startRef.current = performance.now()

    const step = (now) => {
      const elapsed = now - startRef.current
      const progress = Math.min(1, elapsed / scaledDuration)
      const eased = ease(progress)
      const next = fromRef.current + (target - fromRef.current) * eased

      currentRef.current = next
      setValue(next)

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step)
      } else {
        currentRef.current = target
        setValue(target)
      }
    }

    frameRef.current = requestAnimationFrame(step)
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [target, duration, easing, speed, enabled])

  return value
}
