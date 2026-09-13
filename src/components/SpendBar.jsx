import { useEffect, useMemo, useRef, useState } from 'react'
import { formatMoney } from '../utils/format.js'
import { rampHex } from '../utils/color.js'
import { MOTION, prefersReducedMotion } from '../utils/motion.js'
import useAnimatedValue from '../hooks/useAnimatedValue.js'
import useThemeColors from '../hooks/useThemeColors.js'

// Where the $0 boundary sits once the day has gone over, as a fraction of the
// track's width.
//
// Under budget the track is one continuous thing: a fill anchored left that
// retreats as you spend, hitting zero width at the left edge exactly when the
// money runs out. Past that point it stops being a quantity and becomes a
// NUMBER LINE. The mark is zero; the quarter of the track to its right is the
// day's limit, drawn as an empty outline - "the bar was $50, and it is gone";
// everything to the left of the mark is the hole, and the overage fills it
// LEFTWARDS from the mark.
//
// The direction reversal is the entire signal. The old behaviour refilled the
// same track left-to-right in red, which looks identical to progress - the
// bar got fuller the worse things got. Growing the other way off a fixed
// landmark cannot be mistaken for that.
//
// 0.75 is a scale choice as much as a layout one: with the limit occupying the
// remaining quarter at matching dollars-per-pixel, the overage bar reaches the
// track's left edge at exactly 3x the day's limit. Deeper than that and it
// stays full and the figure carries the magnitude, which is the same bargain
// the ring and the old overage bar both struck.
const ZERO_MARK = 0.75

// The day's limit, in track fractions. Also the scale: this much width is
// worth exactly one daily limit, on BOTH sides of the mark.
const LIMIT_LANE = 1 - ZERO_MARK

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

  // One animated width serves both layouts, and the handover between them is
  // invisible for a reason worth keeping: at the instant of crossing, the
  // under-budget fill is zero wide at the left edge and the overage bar is
  // zero wide at the mark. Nothing jumps, because there is nothing there to
  // jump - only the zero mark and the empty limit lane arrive.
  const overageFraction = zeroLimit
    ? ZERO_MARK
    : Math.min(ZERO_MARK, (overage / safeLimit) * LIMIT_LANE)

  const fillFraction = isOver ? overageFraction : Math.max(0, 1 - spentFraction)

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
  const widthPercent = Math.max(0, Math.min(1, animatedFill)) * 100

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

        {/* Two layouts, one track. See the note on ZERO_MARK for why going
            over swaps the geometry rather than just recolouring it. */}
        <div className={`bar-track ${isOver ? 'bar-track-over' : ''}`}>
          {isOver ? (
            <>
              {/* The overdraft zone is tinted along its whole length, not just
                  where the fill has reached, so a $5 overspend still reads as
                  "you are in this territory now" rather than as a stray sliver
                  floating in an empty track. */}
              <div className="bar-over-zone" style={{ right: `${LIMIT_LANE * 100}%` }} />
              <div className="bar-limit-lane" style={{ width: `${LIMIT_LANE * 100}%` }} />
              <div
                className="bar-fill bar-fill-over"
                style={{
                  width: `${widthPercent}%`,
                  // Pinned by its RIGHT edge to the mark, so the width grows
                  // leftwards - the whole point of the layout.
                  right: `${LIMIT_LANE * 100}%`,
                  background: fillColor
                }}
              />
              <div className="bar-zero-mark" style={{ left: `${ZERO_MARK * 100}%` }} />
            </>
          ) : (
            <div
              className={`bar-fill ${breathing ? 'bar-breathing' : ''}`}
              style={{ width: `${widthPercent}%`, background: fillColor }}
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
            <span className="bar-scale-zero" style={{ left: `${ZERO_MARK * 100}%` }}>
              0
            </span>
          </div>
        )}

        {!logged && <div className="bar-hint">tap to log</div>}
      </button>
    </div>
  )
}
