import assert from 'node:assert/strict'
import { barGeometry, barLayout, MAX_ZERO_MARK } from '../src/utils/barScale.js'

// Checks on the spend bar's geometry.
//
// This suite exists because the bar shipped broken three times in a row - a
// fixed zero mark with an invented reservoir behind it, a CSS cascade bug that
// anchored the overage to the wrong edge, and a figure printed twice - and
// nothing in the repo could have caught any of it. The cascade bug is still
// beyond a script's reach. The arithmetic is not, and the arithmetic is where
// the design decisions actually live.

let checks = 0
let failures = 0

function check(name, fn) {
  checks += 1
  try {
    fn()
  } catch (err) {
    failures += 1
    console.error(`FAIL: ${name}`)
    console.error(`  ${err.message}`)
  }
}

const pct = (n) => `${(n * 100).toFixed(1)}%`

// --- 1. The invariant the reservoir bug violated. --------------------------
//
// Over budget, the red and the limit lane between them account for the ENTIRE
// track. Any shortfall is unexplained track, and unexplained track in a bar
// about overspending reads as room still to spend.
check('over budget, red + limit lane always fill the whole track', () => {
  for (let limit = 1; limit <= 200; limit += 7) {
    for (let over = 1; over <= 600; over += 11) {
      const { fillFraction } = barGeometry(limit + over, limit)
      const lane = 1 - fillFraction
      assert.ok(fillFraction > 0, `$${over} over $${limit} drew no red`)
      assert.ok(lane >= 0, `$${over} over $${limit} overflowed the track`)
      assert.equal(
        Number((fillFraction + lane).toFixed(10)),
        1,
        `$${over} over $${limit} left a gap in the track`
      )
    }
  }
})

// --- 2. The scale is the one the design claims. ----------------------------
check('the zero mark sits at the overage share of everything spent today', () => {
  // $50 blown by $35: 35/85.
  assert.equal(barGeometry(85, 50).fillFraction.toFixed(4), (35 / 85).toFixed(4))
  // $50 blown by $150: the three-to-one split the bar was first drawn from.
  assert.equal(barGeometry(200, 50).fillFraction, 0.75)
  // Blown by exactly the limit: dead centre.
  assert.equal(barGeometry(100, 50).fillFraction, 0.5)
})

check('spending more moves the boundary rather than filling empty room', () => {
  let previous = -1
  for (let over = 1; over <= 700; over += 1) {
    const { fillFraction } = barGeometry(50 + over, 50)
    assert.ok(
      fillFraction >= previous,
      `going from $${over - 1} to $${over} over moved the mark backwards`
    )
    previous = fillFraction
  }
})

check('the limit lane shrinks as the overage grows, and never inverts', () => {
  const laneAt = (over) => 1 - barGeometry(50 + over, 50).fillFraction
  assert.ok(laneAt(10) > laneAt(50), 'lane did not shrink between $10 and $50 over')
  assert.ok(laneAt(50) > laneAt(200), 'lane did not shrink between $50 and $200 over')
  assert.ok(laneAt(200) > 0, 'lane vanished at a depth the scale still covers')
})

// --- 3. The handover between the two layouts. ------------------------------
//
// The fill's MEANING flips at the boundary - what's left, then what's over -
// but its width must not jump, or the bar visibly lurches on the one event it
// exists to report.
check('the fill is continuous through the moment of going over', () => {
  assert.equal(barGeometry(50, 50).fillFraction, 0, 'exactly at the limit should be empty')
  const justOver = barGeometry(51, 50).fillFraction
  assert.ok(justOver > 0 && justOver < 0.03, `a $1 overspend jumped to ${pct(justOver)}`)
})

check('under budget the fill is what is left, anchored left', () => {
  assert.equal(barGeometry(0, 50).fillFraction, 1)
  assert.equal(barGeometry(25, 50).fillFraction, 0.5)
  assert.equal(barGeometry(45, 50).fillFraction.toFixed(2), '0.10')
  assert.equal(barGeometry(50, 50).fillFraction, 0)
})

// --- 4. The zero-limit regime. ---------------------------------------------
//
// Once the period's budget is gone every remaining day's limit is $0, so this
// is not a rare edge - it is the whole back half of an overspent period. The
// bar deliberately stops discriminating there: $0 is the entire truth about
// what today's budget was.
check('a zero limit draws all red and no lane, at any spend', () => {
  for (const spent of [1, 5, 40, 200, 5000]) {
    const g = barGeometry(spent, 0)
    assert.equal(g.isOver, true, `$${spent} against a $0 limit did not read as over`)
    assert.equal(g.fillFraction, 1, `$${spent} against a $0 limit left a lane`)
    assert.equal(barLayout(g.fillFraction).showLane, false)
  }
})

check('nothing spent against a zero limit is at the limit, not under it', () => {
  const g = barGeometry(0, 0)
  assert.equal(g.isOver, false)
  assert.equal(g.fillFraction, 0, 'an empty $0 day should draw an empty bar')
  // 1.0 is the top of the colour ramp - red. Treating it as 0 once put a GREEN
  // figure above the words "over today".
  assert.equal(g.spentFraction, 1)
})

check('a negative limit is treated as zero, never as a negative scale', () => {
  const g = barGeometry(10, -40)
  assert.equal(g.safeLimit, 0)
  assert.equal(g.overage, 10)
  assert.equal(g.fillFraction, 1)
})

// --- 5. The clamp is a rendering floor, and nothing on screen implies it. ---
check('the mark stops at the rendering floor rather than reaching the edge', () => {
  for (const over of [5000, 50000, 1e9]) {
    const { fillFraction } = barGeometry(50 + over, 50)
    assert.equal(fillFraction, MAX_ZERO_MARK, `$${over} over pushed past the floor`)
  }
  // Far enough out to be unreachable in practice: ~15x over.
  const ratio = MAX_ZERO_MARK / (1 - MAX_ZERO_MARK)
  assert.ok(ratio > 12, `the floor bites at only ${ratio.toFixed(1)}x over`)
})

// --- 6. Every fraction the component can be handed is drawable. ------------
check('no input produces NaN, Infinity or an out-of-range fraction', () => {
  const inputs = [0, 1, 50, 1e6, -1, 0.5, NaN, Infinity, -Infinity]
  for (const spent of inputs) {
    for (const limit of inputs) {
      const { fillFraction } = barGeometry(spent, limit)
      const layout = barLayout(fillFraction)
      assert.ok(
        Number.isFinite(layout.widthPercent),
        `spent ${spent} / limit ${limit} gave a non-finite width`
      )
      assert.ok(
        layout.widthPercent >= 0 && layout.widthPercent <= 100,
        `spent ${spent} / limit ${limit} gave ${layout.widthPercent}%`
      )
    }
  }
})

// --- 7. The three pieces are three views of one number. --------------------
check('the mark, the end of the red and the start of the lane never disagree', () => {
  for (let f = 0; f <= 1.0001; f += 0.01) {
    const { widthPercent, lanePercent } = barLayout(f)
    assert.equal(
      Number((widthPercent + lanePercent).toFixed(9)),
      100,
      `at ${pct(f)} the lane did not start where the red ended`
    )
  }
})

check('the zero caption stays on the track at both extremes', () => {
  assert.equal(barLayout(0).zeroLabelPercent, 3)
  assert.equal(barLayout(1).zeroLabelPercent, 97)
  assert.equal(barLayout(0.5).zeroLabelPercent, 50)
})

check('a non-finite animated value still lays out', () => {
  for (const bad of [NaN, Infinity, -Infinity, undefined]) {
    const layout = barLayout(bad)
    assert.ok(Number.isFinite(layout.widthPercent), `${bad} produced a non-finite width`)
  }
})

console.log()
console.log(`${checks - failures}/${checks} spend bar checks passed`)
if (failures > 0) process.exitCode = 1
