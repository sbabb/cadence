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

// The mote field behind the figure. Ambient texture, nothing more.
//
// These used to rise out of the bar, which had a problem the user spotted: the
// column of motes spanned the full track width regardless of how much fill was
// actually there, so the motion implied a relationship to the data that did not
// exist. Reading them as "steam off the bar" only worked when the bar was full.
// Drifting in place says what is true - this is flair, not information.
//
// Fixed rather than randomised per render, so the field does not reshuffle
// itself every time a number animates.
//
// Each mote runs TWO animations at different durations: a slow positional
// drift and a separate opacity twinkle. Because the periods don't divide into
// each other, the pair takes a long time to return to the same combined state,
// so the loop never announces itself the way a single keyframe track would.
//
// Everything here is data for CSS - position, drift vector, sizes, timings,
// peak opacity. Colour is absent because it isn't per-mote: they all inherit
// --bar-color, so the field is always the colour of the figure it sits behind.
const PARTICLES = [
  // The y values are not free. The readout is figure on top (roughly the first
  // 59%), label under it (to 87%), then the gap above the bar. Out at the
  // edges a mote can sit anywhere, because there is no type there - but in the
  // centre column, where the figure and the label actually are, a 3px square
  // landing on a letter stroke stops looking like atmosphere and starts
  // looking like a dead pixel. So the middle of the field is kept down in the
  // band just above the bar, where it can drift freely without touching text.
  { x: 4, y: 58, size: 3, dx: 4, dy: -5, drift: 7200, twinkle: 4300, delay: 0, peak: 0.3 },
  { x: 11, y: 26, size: 2, dx: -3, dy: 4, drift: 6100, twinkle: 3500, delay: 900, peak: 0.22 },
  { x: 18, y: 80, size: 2, dx: 5, dy: 3, drift: 8300, twinkle: 5200, delay: 2400, peak: 0.26 },
  { x: 25, y: 44, size: 3, dx: -4, dy: -3, drift: 6800, twinkle: 3900, delay: 1300, peak: 0.28 },
  { x: 31, y: 14, size: 2, dx: 3, dy: -4, drift: 7600, twinkle: 4700, delay: 400, peak: 0.24 },
  { x: 38, y: 89, size: 2, dx: -5, dy: 3, drift: 9100, twinkle: 3300, delay: 3100, peak: 0.2 },
  { x: 45, y: 95, size: 3, dx: 4, dy: 4, drift: 6400, twinkle: 5600, delay: 1800, peak: 0.28 },
  { x: 53, y: 87, size: 2, dx: -3, dy: -5, drift: 8700, twinkle: 4100, delay: 600, peak: 0.22 },
  { x: 61, y: 93, size: 2, dx: 5, dy: -3, drift: 7000, twinkle: 3700, delay: 2700, peak: 0.26 },
  { x: 68, y: 32, size: 3, dx: -4, dy: 4, drift: 8000, twinkle: 5000, delay: 1100, peak: 0.28 },
  { x: 75, y: 68, size: 2, dx: 3, dy: 5, drift: 6600, twinkle: 4500, delay: 3400, peak: 0.2 },
  { x: 82, y: 18, size: 2, dx: -5, dy: -4, drift: 8900, twinkle: 3100, delay: 200, peak: 0.24 },
  { x: 89, y: 50, size: 3, dx: 4, dy: 3, drift: 7400, twinkle: 5400, delay: 2000, peak: 0.28 },
  { x: 96, y: 78, size: 2, dx: -3, dy: -4, drift: 6900, twinkle: 4900, delay: 1500, peak: 0.22 }
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
  const isOver = spent > safeLimit
  const remaining = safeLimit - spent
  const overage = isOver ? spent - safeLimit : 0

  // A limit of zero is a real state, not a missing value: overspend early
  // enough and the engine correctly says there is nothing left to spend
  // today. Dividing by it isn't an option, so the two cases are named
  // outright. Getting this wrong was visible - treating the fraction as 0
  // put a GREEN figure directly above the words "over today", because zero
  // spent-fraction is the top of the ramp.
  //
  //   nothing spent against a zero limit -> exactly at the limit (1.0): the
  //     bar empties and goes red, which is true, you have nothing.
  //   anything spent against a zero limit -> as far past the limit as the
  //     ramp goes (2.0): deepest red, and the overage bar fills completely,
  //     because "infinitely over" has no smaller honest depiction.
  const zeroLimit = safeLimit === 0
  const spentFraction = zeroLimit ? (spent > 0 ? 2 : 1) : spent / safeLimit

  const fillFraction = isOver
    ? zeroLimit
      ? OVERAGE_CAP
      : Math.min(OVERAGE_CAP, overage / safeLimit)
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
                    top: `${p.y}%`,
                    width: p.size,
                    height: p.size,
                    '--dx': `${p.dx}px`,
                    '--dy': `${p.dy}px`,
                    '--drift': `${p.drift}ms`,
                    '--twinkle': `${p.twinkle}ms`,
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
