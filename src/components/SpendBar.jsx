import { useEffect, useMemo, useRef, useState } from 'react'
import { formatMoney } from '../utils/format.js'
import { rampHex } from '../utils/color.js'
import { MOTION, prefersReducedMotion } from '../utils/motion.js'
import useAnimatedValue from '../hooks/useAnimatedValue.js'
import useThemeColors from '../hooks/useThemeColors.js'
import { barGeometry, barLayout } from '../utils/barScale.js'
// The mote field behind the figure. Ambient texture, nothing more.
//
// These used to rise out of the bar, which had a problem the user spotted: the
// column of motes spanned the full track width regardless of how much fill was
// actually there, so the motion implied a relationship to the data that did not
// exist. Reading them as "steam off the bar" only worked when the bar was full.
// Drifting in place says what is true - this is flair, not information.
//
// Randomised fresh on every mount rather than laid out by hand, so the field
// never reads as a designed pattern - but generated once and held in state
// rather than regenerated on every render, so it doesn't reshuffle itself
// every time a number animates.
//
// The centre column - roughly where the big figure and its "remaining today"
// label actually have ink - is excluded outright, at every height, rather than
// squeezed into a narrow band just above the bar the way it used to be. That
// narrow band sat right at the edge of the particle field's own container, and
// a mote landing there could get visually clipped against the track beneath it
// - a dot cut off halfway that read as a dead pixel. Keeping motes out of that
// column entirely removes the bug and the band both, and it costs nothing:
// there's no text out at the edges for a mote to collide with regardless of
// how high or low it drifts.
//
// Each mote runs TWO animations at different durations: a slow positional
// drift and a separate opacity twinkle. Because the periods don't divide into
// each other, the pair takes a long time to return to the same combined state,
// so the loop never announces itself the way a single keyframe track would.
//
// Everything here is data for CSS - position, drift vector, sizes, timings,
// peak opacity. Colour is absent because it isn't per-mote: they all inherit
// --bar-color, so the field is always the colour of the figure it sits behind.
const MOTE_COUNT = 14

// Where the figure and its label actually have ink, horizontally. No mote is
// ever placed in this column, at any height.
//
// It is deliberately wide. The figure is 38px, and a period with a few
// thousand dollars in it renders something like "$2,400" - seven characters
// of a monospaced face is over 160px, which on a 320px phone is half the
// screen. Sizing this column to a typical figure would work until the day the
// number got long. The bands it leaves - 3-25 and 75-97 - are exactly where
// the old hand-placed field had its outermost motes, which were never the
// ones that caused trouble.
const TEXT_COLUMN_MIN_X = 27
const TEXT_COLUMN_MAX_X = 73

// The readout is roughly four times wider than it is tall, so a percentage
// point of x is worth about four of y. Comparing raw percentages would call
// two motes "far apart" when they are stacked almost vertically.
const X_TO_Y_ASPECT = 4
const MIN_SEPARATION = 4.5
const MAX_PLACEMENT_TRIES = 40

const randomBetween = (min, max) => min + Math.random() * (max - min)
const randomSign = () => (Math.random() < 0.5 ? -1 : 1)

function tooClose(candidate, placed) {
  return placed.some((p) => {
    const dx = (candidate.x - p.x) / X_TO_Y_ASPECT
    const dy = candidate.y - p.y
    return Math.sqrt(dx * dx + dy * dy) < MIN_SEPARATION
  })
}

function generateMotes() {
  const motes = []
  for (let i = 0; i < MOTE_COUNT; i += 1) {
    // Alternating rather than a coin flip per mote: fourteen coin flips can
    // easily land eleven-to-three, and a field visibly heavier on one side
    // reads as a mistake rather than as randomness.
    const onLeft = i % 2 === 0

    // Rejected and retried if it lands on top of a mote already placed - two
    // 3px squares a pixel apart read as one brighter blob, not as two motes.
    // The retry gives up rather than looping forever; a rare close pair is a
    // far smaller problem than a hang.
    let x = 0
    let y = 0
    for (let attempt = 0; attempt < MAX_PLACEMENT_TRIES; attempt += 1) {
      x = onLeft ? randomBetween(3, TEXT_COLUMN_MIN_X - 2) : randomBetween(TEXT_COLUMN_MAX_X + 2, 97)
      // Capped short of the field's own bottom edge. The clipped-mote bug
      // lived in that last sliver, and there is nothing down there worth
      // going back for.
      y = randomBetween(8, 82)
      if (!tooClose({ x, y }, motes)) break
    }

    motes.push({
      x,
      y,
      size: Math.random() < 0.5 ? 2 : 3,
      dx: randomSign() * randomBetween(3, 5),
      dy: randomSign() * randomBetween(3, 5),
      drift: Math.round(randomBetween(6000, 9200)),
      twinkle: Math.round(randomBetween(3100, 5600)),
      delay: Math.round(randomBetween(0, 3400)),
      peak: Number(randomBetween(0.2, 0.3).toFixed(2))
    })
  }
  return motes
}

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
  onTap
}) {
  // The four ramp colours belong to whichever theme is active, and they're
  // read during render so the bar can never be a frame behind the palette.
  const rampColors = useThemeColors()

  // Generated once per mount - see the comment above generateMotes().
  const [particles] = useState(generateMotes)

  // All of the bar's arithmetic, and every comment explaining it, lives in
  // barScale.js so a script can check it. See scripts/verify-bar.mjs.
  const { safeLimit, isOver, remaining, overage, spentFraction, fillFraction } = barGeometry(
    spent,
    limit
  )

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
    easing: MOTION.arcSettle.easing
  })

  // Colour trails the width on purpose - it should read as a consequence of
  // the bar moving rather than part of the same gesture.
  const animatedFraction = useAnimatedValue(phase === 'mount' ? 0 : spentFraction, {
    duration: phase === 'entering' ? MOTION.entry.duration : MOTION.colorDrift.duration,
    easing: MOTION.colorDrift.easing
  })

  const animatedAmount = useAnimatedValue(phase === 'mount' ? 0 : isOver ? overage : remaining, {
    duration: phase === 'entering' ? MOTION.entry.duration : MOTION.numberCount.duration,
    easing: MOTION.numberCount.easing
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
        pulseTimerRef.current = setTimeout(() => setPulsing(false), MOTION.thresholdPulse.duration + 40)
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
  }, [isOver, phase, dateLabel])

  useEffect(
    () => () => {
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current)
    },
    []
  )

  const reduced = prefersReducedMotion()
  const breathing = !logged && !reduced && phase === 'live'

  const displayAmount = Math.round(animatedAmount)
  const { widthPercent, zeroLabelPercent, showLane } = barLayout(animatedFill)

  // .bar-fill carries a 2px min-width so a nearly-spent day still shows a
  // sliver of colour rather than vanishing. At EXACTLY zero it has to vanish:
  // "$0 remaining" with two pixels of red still lit is the bar disagreeing
  // with its own figure, on the one day the figure matters most.
  const fillMinWidth = widthPercent > 0 ? undefined : 0

  const shellClasses = ['bar-shell', pulsing ? 'bar-pulsing' : ''].filter(Boolean).join(' ')

  const statusWord = isOver ? 'over' : 'remaining'
  const spokenDay = dateLabel || 'today'
  const ariaLabel = isOver
    ? `${formatMoney(overage)} over the ${formatMoney(safeLimit)} limit for ${spokenDay}. Tap to log spend.`
    : `${formatMoney(remaining)} remaining for ${spokenDay}. Tap to log spend.`

  return (
    <div className={shellClasses} style={{ '--bar-color': fillColor }}>
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
              {particles.map((p, i) => (
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

        {/* Two layouts, one track. See barScale.js for what the track
            means once the day is over.
         *
         * All three pieces are driven off the SAME animated width, so the
         * mark, the end of the red and the start of the lane cannot drift
         * apart by a frame - they are three views of one number. */}
        <div className={`bar-track ${isOver ? 'bar-track-over' : ''}`}>
          {isOver ? (
            <>
              <div
                className="bar-fill"
                style={{ width: `${widthPercent}%`, minWidth: fillMinWidth, background: fillColor }}
              />
              {/* What the day was actually worth, at the same scale, taking up
                  whatever share of today's spending it still accounts for.
                  Dropped entirely when that share rounds to nothing, rather
                  than left as a 2px stub of its own borders. */}
              {showLane && <div className="bar-limit-lane" style={{ left: `${widthPercent}%` }} />}
              <div className="bar-zero-mark" style={{ left: `${widthPercent}%` }} />
            </>
          ) : (
            <div
              className={`bar-fill ${breathing ? 'bar-breathing' : ''}`}
              style={{ width: `${widthPercent}%`, minWidth: fillMinWidth, background: fillColor }}
            />
          )}
        </div>

        {/* Zero, labelled. The mark is the landmark the red is measured from,
            and a mark with no number on it is just a line.
         *
         * The day's limit used to be labelled out at the right end too. It was
         * here to cover for the stat box, which at the time dropped to $0 the
         * moment the day was spent out; now that the box shows the limit
         * again, printing it here as well put the same figure on screen twice
         * within an inch of itself. The lane still shows the limit - that is
         * what its width IS - it just no longer announces it. */}
        {isOver && (
          <div className="bar-scale" aria-hidden="true">
            <span className="bar-scale-zero" style={{ left: `${zeroLabelPercent}%` }}>
              0
            </span>
          </div>
        )}

        {!logged && <div className="bar-hint">tap to log</div>}
      </button>
    </div>
  )
}
