import { useEffect, useMemo, useRef, useState } from 'react'
import { formatMoney } from '../utils/format.js'
import { rampHex } from '../utils/color.js'
import { MOTION, prefersReducedMotion } from '../utils/motion.js'
import useAnimatedValue from '../hooks/useAnimatedValue.js'
import useThemeColors from '../hooks/useThemeColors.js'

// How far past the limit the overage bar keeps growing before it gives up and
// stays full. Being 100% over fills it completely; beyond that the figure
// carries the magnitude, the same rule the ring used.
const OVERAGE_CAP = 1

// The rising field behind the figure. Reverse rain: sharp little squares
// drifting up out of the bar and fading before they reach the readout.
//
// Fixed rather than randomised on each mount, for two reasons. A field
// regenerated every render would reshuffle itself every time a number
// animated, which is the opposite of ambient. And a hand-placed set can be
// checked: the x positions are irregular enough not to read as a grid, and no
// rise exceeds the height of the block above the bar, so nothing escapes past
// the figure and needs clipping.
//
// Everything here is data for CSS - position, travel, size, timing, peak
// opacity - handed over as custom properties. The colour isn't listed because
// it isn't per-particle: they all inherit --bar-color, which is the same value
// driving the fill and the figure, so the field is always exactly the colour
// of the number it sits behind.
const PARTICLES = [
  { x: 4, rise: 46, size: 3, dur: 3200, delay: 0, peak: 0.3 },
  { x: 11, rise: 34, size: 2, dur: 2600, delay: 900, peak: 0.24 },
  { x: 18, rise: 58, size: 3, dur: 3800, delay: 400, peak: 0.32 },
  { x: 25, rise: 28, size: 2, dur: 2200, delay: 1700, peak: 0.22 },
  { x: 32, rise: 50, size: 3, dur: 3400, delay: 1100, peak: 0.28 },
  { x: 38, rise: 38, size: 2, dur: 2900, delay: 200, peak: 0.26 },
  { x: 45, rise: 62, size: 3, dur: 4000, delay: 2100, peak: 0.3 },
  { x: 52, rise: 32, size: 2, dur: 2500, delay: 700, peak: 0.22 },
  { x: 59, rise: 48, size: 3, dur: 3600, delay: 1500, peak: 0.28 },
  { x: 66, rise: 36, size: 2, dur: 2800, delay: 300, peak: 0.24 },
  { x: 72, rise: 56, size: 3, dur: 3700, delay: 1900, peak: 0.3 },
  { x: 79, rise: 30, size: 2, dur: 2400, delay: 1300, peak: 0.22 },
  { x: 87, rise: 52, size: 3, dur: 3300, delay: 600, peak: 0.28 },
  { x: 94, rise: 40, size: 2, dur: 3000, delay: 2400, peak: 0.26 }
]

// The spend bar. Replaces the dial, which was legible but cost 196px of
// vertical space and pushed the day list off the first screen.
//
// The fill is anchored LEFT and always shows the same thing the big figure
// shows. Under budget that's what's left, so it retreats as you spend; over
// budget it's the overage, so it grows again from zero. That reversal at the
// boundary is the signal - the same idea as the ring running backwards, but in
// a form where left-to-right growth reads naturally as accumulation.
//
// Deliberately NOT a filling "progress" bar. An empty bar at the start of the
// day would mean no colour at all for most of the day, and colour presence is
// most of what this component is for.
//
// Knows nothing about periods or storage: one day's spend, that day's limit,
// whether anything was logged, and the label to put on it.
export default function SpendBar({
  spent,
  limit,
  logged,
  dateLabel,
  onTap,
  speed = 1,
  debugTrigger
}) {
  // The four ramp colours belong to whichever theme is active, and they're
  // read during render so the bar can never be a frame behind the palette.
  const rampColors = useThemeColors()

  const safeLimit = limit > 0 ? limit : 0
  const spentFraction = safeLimit > 0 ? spent / safeLimit : 0
  const isOver = spent > safeLimit
  const remaining = safeLimit - spent
  const overage = isOver ? spent - safeLimit : 0

  const fillFraction = isOver
    ? Math.min(OVERAGE_CAP, safeLimit > 0 ? overage / safeLimit : 0)
    : Math.max(0, 1 - spentFraction)

  // ---- entry sequencing -------------------------------------------------
  const [phase, setPhase] = useState('mount')

  useEffect(() => {
    if (phase !== 'mount') return undefined
    const raf = requestAnimationFrame(() => setPhase('entering'))
    return () => cancelAnimationFrame(raf)
  }, [phase])

  useEffect(() => {
    if (phase !== 'entering') return undefined
    const timer = setTimeout(() => setPhase('live'), MOTION.entry.duration + 60)
    return () => clearTimeout(timer)
  }, [phase])

  const fillTarget = phase === 'mount' ? 0 : fillFraction
  const fillDuration = phase === 'entering' ? MOTION.entry.duration : MOTION.arcSettle.duration

  const animatedFill = useAnimatedValue(fillTarget, {
    duration: fillDuration,
    easing: MOTION.arcSettle.easing,
    speed
  })

  // Colour trails the width on purpose - it should read as a consequence of
  // the bar moving rather than part of the same gesture.
  const animatedFraction = useAnimatedValue(phase === 'mount' ? 0 : spentFraction, {
    duration: phase === 'entering' ? MOTION.entry.duration : MOTION.colorDrift.duration,
    easing: MOTION.colorDrift.easing,
    speed
  })

  const animatedAmount = useAnimatedValue(phase === 'mount' ? 0 : isOver ? overage : remaining, {
    duration: phase === 'entering' ? MOTION.entry.duration : MOTION.numberCount.duration,
    easing: MOTION.numberCount.easing,
    speed
  })

  const fillColor = useMemo(
    () => rampHex(animatedFraction, rampColors),
    [animatedFraction, rampColors]
  )

  // ---- one-shot and continuous motion -----------------------------------
  const [pressed, setPressed] = useState(false)
  const [pulsing, setPulsing] = useState(false)
  const pulseTimerRef = useRef(null)

  const firePulse = () => {
    setPulsing(false)
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setPulsing(true)
        pulseTimerRef.current = setTimeout(
          () => setPulsing(false),
          MOTION.thresholdPulse.duration / (speed || 1) + 40
        )
      })
    })
  }

  // Fires only on the crossing itself, and only for the SAME day - selecting a
  // different day flips `isOver` exactly the way a real overspend does, but
  // nothing was spent, so a thump there would be meaningless.
  const wasOverRef = useRef(isOver)
  const lastDateRef = useRef(dateLabel)
  useEffect(() => {
    const sameDay = lastDateRef.current === dateLabel
    if (sameDay && isOver && !wasOverRef.current && phase === 'live') firePulse()
    wasOverRef.current = isOver
    lastDateRef.current = dateLabel
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOver, phase, dateLabel])

  useEffect(
    () => () => {
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current)
    },
    []
  )

  // Dev-only hook for the motion debug panel.
  useEffect(() => {
    if (!debugTrigger) return
    if (debugTrigger.type === 'thresholdPulse') firePulse()
    if (debugTrigger.type === 'entry') setPhase('mount')
    if (debugTrigger.type === 'tap') {
      setPressed(true)
      setTimeout(() => setPressed(false), MOTION.tapPress.duration / (speed || 1))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debugTrigger])

  const reduced = prefersReducedMotion()
  const breathing = !logged && !reduced && phase === 'live'

  const displayAmount = Math.round(animatedAmount)
  const widthPercent = Math.max(0, Math.min(1, animatedFill)) * 100

  const shellClasses = ['bar-shell', pulsing ? 'bar-pulsing' : ''].filter(Boolean).join(' ')

  const statusWord = isOver ? 'over' : 'remaining'
  const spokenDay = dateLabel || 'today'
  const ariaLabel = isOver
    ? `${formatMoney(overage)} over the limit for ${spokenDay}. Tap to log spend.`
    : `${formatMoney(remaining)} remaining for ${spokenDay}. Tap to log spend.`

  return (
    <div className={shellClasses} style={{ '--bar-color': fillColor, '--motion-speed': speed }}>
      <button
        type="button"
        className="bar-button"
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        onClick={onTap}
        aria-label={ariaLabel}
        style={{ transform: `scale(${pressed ? 0.985 : 1})` }}
      >
        {/* The readout and the field it sits in front of. Grouped so the
            particles have something to be absolutely positioned against, and
            so they rise exactly the height of the text block above the bar
            and no further. */}
        <div className="bar-readout">
          {!reduced && (
            <div className="bar-particles" aria-hidden="true">
              {PARTICLES.map((p, i) => (
                <span
                  key={i}
                  className="bar-particle"
                  style={{
                    left: `${p.x}%`,
                    width: p.size,
                    height: p.size,
                    '--rise': `${-p.rise}px`,
                    '--dur': `${p.dur}ms`,
                    '--delay': `${p.delay}ms`,
                    '--peak': p.peak
                  }}
                />
              ))}
            </div>
          )}

          <div className="bar-figure" style={{ color: fillColor }}>
            {formatMoney(displayAmount)}
          </div>
          <div className="bar-label">
            {statusWord}
            {dateLabel ? <span className="bar-label-date">{dateLabel}</span> : ' today'}
          </div>
        </div>

        {/* Tinting the whole track when over means the state is unmistakable
            even at a tiny overage, where the fill itself is only a sliver. */}
        <div className={`bar-track ${isOver ? 'bar-track-over' : ''}`}>
          <div
            className={`bar-fill ${breathing ? 'bar-breathing' : ''}`}
            style={{ width: `${widthPercent}%`, background: fillColor }}
          />
        </div>

        {!logged && <div className="bar-hint">tap to log</div>}
      </button>
    </div>
  )
}
