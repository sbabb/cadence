import { useEffect, useMemo, useRef, useState } from 'react'
import { formatMoney } from '../utils/format.js'
import { rampHex } from '../utils/color.js'
import { MOTION, prefersReducedMotion } from '../utils/motion.js'
import useAnimatedValue from '../hooks/useAnimatedValue.js'

// Geometry. The ring is described once here and everything else derives from
// it, so changing the size doesn't require re-deriving the dash math.
const SIZE = 240
const CENTER = SIZE / 2
const RADIUS = 92
const STROKE = 16
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

// How far past the limit the overage ring keeps sweeping before it gives up
// and just stays full. Being 100% over fills the ring completely; beyond that
// the arc would start lapping itself, which tells you nothing, so the number
// carries the magnitude from there on.
const OVERAGE_CAP = 1

// The dial. Deliberately knows nothing about periods, budgets, or storage - it
// takes one day's spend, that day's limit and whether anything was logged, and
// renders. It doesn't even know WHICH day it's showing beyond the label it's
// handed. Everything contextual (what tomorrow's limit becomes, which period
// this is, which day is selected) belongs to whatever renders it. That
// boundary is what lets the dial follow a selected day without changing, and
// what makes it swappable for a Rive-rendered version later.
//
// `dateLabel` is null when showing today, and a formatted date otherwise.
// `debugTrigger` is dev-only: the motion debug panel uses it to fire the
// time-based animations on demand. Remove it alongside the panel before
// shipping.
export default function SpendDial({
  spent,
  limit,
  logged,
  dateLabel,
  onTap,
  speed = 1,
  debugTrigger
}) {
  const safeLimit = limit > 0 ? limit : 0
  const spentFraction = safeLimit > 0 ? spent / safeLimit : 0
  const isOver = spent > safeLimit
  const remaining = safeLimit - spent
  const overage = isOver ? spent - safeLimit : 0

  // Under budget the ring shows what's LEFT and depletes as you spend. Over
  // budget it shows the overage instead, and grows again - see the transform
  // on the overage circle for why that reads as passing through zero rather
  // than refilling.
  const arcFraction = isOver
    ? Math.min(OVERAGE_CAP, safeLimit > 0 ? overage / safeLimit : 0)
    : Math.max(0, 1 - spentFraction)

  // ---- entry sequencing -------------------------------------------------
  // 'mount' pins the arc at empty for one frame so the entry sweep has
  // somewhere to come from; 'entering' runs that sweep at its own slower
  // curve; 'live' hands over to the everyday settle timing.
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

  const arcTarget = phase === 'mount' ? 0 : arcFraction
  const arcDuration = phase === 'entering' ? MOTION.entry.duration : MOTION.arcSettle.duration

  const animatedArc = useAnimatedValue(arcTarget, {
    duration: arcDuration,
    easing: MOTION.arcSettle.easing,
    speed
  })

  // Color trails the sweep on purpose (see MOTION.colorDrift): it should read
  // as a consequence of the ring moving, not as part of the same gesture.
  const animatedFraction = useAnimatedValue(phase === 'mount' ? 0 : spentFraction, {
    duration: phase === 'entering' ? MOTION.entry.duration : MOTION.colorDrift.duration,
    easing: MOTION.colorDrift.easing,
    speed
  })

  const animatedAmount = useAnimatedValue(phase === 'mount' ? 0 : (isOver ? overage : remaining), {
    duration: phase === 'entering' ? MOTION.entry.duration : MOTION.numberCount.duration,
    easing: MOTION.numberCount.easing,
    speed
  })

  const ringColor = useMemo(() => rampHex(animatedFraction), [animatedFraction])

  // ---- one-shot and continuous motion -----------------------------------
  const [pressed, setPressed] = useState(false)
  const [pulsing, setPulsing] = useState(false)
  const pulseTimerRef = useRef(null)

  const firePulse = () => {
    setPulsing(false)
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current)
    // Two frames of "off" so restarting the CSS animation actually restarts it
    // rather than continuing the existing one.
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

  // Fires only on the crossing itself. Sitting at over-budget is a state, not
  // an event - it shouldn't keep pulsing at you.
  //
  // The date is tracked alongside so that SELECTING a different day can't
  // trigger it. Switching from an under-budget day to an over-budget one
  // changes `isOver` exactly the way a real overspend does, but nothing was
  // spent - the user just looked at another day, and a celebratory thump
  // there would be meaningless.
  const wasOverRef = useRef(isOver)
  const lastDateRef = useRef(dateLabel)
  useEffect(() => {
    const sameDay = lastDateRef.current === dateLabel
    if (sameDay && isOver && !wasOverRef.current && phase === 'live') firePulse()
    wasOverRef.current = isOver
    lastDateRef.current = dateLabel
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOver, phase, dateLabel])

  useEffect(() => () => {
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current)
  }, [])

  // Dev-only hook for the debug panel.
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

  const dashOffset = CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, animatedArc)))
  const displayAmount = Math.round(animatedAmount)

  const shellClasses = [
    'dial-shell',
    breathing ? 'dial-breathing' : '',
    pulsing ? 'dial-pulsing' : ''
  ]
    .filter(Boolean)
    .join(' ')

  // When the dial is showing a day other than today, the date has to be on it
  // - otherwise the numbers are unattributed and you can't tell at a glance
  // which day you're about to edit. A full weekday-and-date on one line is
  // wider than the ring's interior, so it goes on its own second line rather
  // than spilling over the stroke.
  const statusWord = isOver ? 'over' : 'remaining'
  const spokenDay = dateLabel || 'today'
  const ariaLabel = isOver
    ? `${formatMoney(overage)} over the limit for ${spokenDay}. Tap to log spend.`
    : `${formatMoney(remaining)} remaining for ${spokenDay}. Tap to log spend.`

  return (
    <div className={shellClasses} style={{ '--dial-color': ringColor, '--motion-speed': speed }}>
      <button
        type="button"
        className="dial-button"
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        onClick={onTap}
        aria-label={ariaLabel}
        style={{ transform: `scale(${pressed ? 0.97 : 1})` }}
      >
        <svg className="dial-svg" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
          <circle
            className="dial-track"
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
          />
          <circle
            className="dial-arc"
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke={ringColor}
            strokeWidth={STROKE}
            strokeLinecap="butt"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            // Under budget: rotate so the arc starts at twelve o'clock and
            // runs clockwise. Over budget: additionally mirror horizontally,
            // which turns the same clockwise sweep into a counter-clockwise
            // one. The reversal is the point - the ring visibly runs backwards
            // through zero rather than appearing to refill.
            transform={
              isOver
                ? `translate(${SIZE},0) scale(-1,1) rotate(-90 ${CENTER} ${CENTER})`
                : `rotate(-90 ${CENTER} ${CENTER})`
            }
          />
        </svg>

        <div className="dial-center">
          <div className="dial-amount" style={{ color: ringColor }}>
            {formatMoney(displayAmount)}
          </div>
          <div className="dial-label">
            {dateLabel ? (
              <>
                {statusWord}
                <span className="dial-label-date">{dateLabel}</span>
              </>
            ) : (
              `${statusWord} today`
            )}
          </div>
          {!logged && <div className="dial-hint">tap to log</div>}
        </div>
      </button>
    </div>
  )
}
