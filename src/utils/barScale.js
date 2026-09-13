// The spend bar's geometry, as arithmetic - no React, no DOM, no colour.
//
// This lives apart from the component for one reason: the bar has been wrong
// three times (a fixed zero mark with an invented reservoir behind it, a
// cascade bug that anchored the overage to the wrong edge, a duplicated
// label), and every one of them reached a phone before anyone saw it. The
// component cannot be checked by a script. This can, and scripts/verify-bar.mjs
// does.
//
// Everything here is a fraction of the track's width, 0 at the left edge and
// 1 at the right.

// How far the zero mark is allowed to travel before it stops.
//
// This is a RENDERING FLOOR, not a budget for overspending. Past this point
// the day's limit would round away to nothing and the mark would sit on the
// track's right edge with no lane left to mark the edge OF. It corresponds to
// being roughly 15x over, far enough out that the bar stopped being the thing
// carrying the information long before.
export const MAX_ZERO_MARK = 0.94

// One day's spend against one day's limit, resolved into everything the bar
// needs to draw itself.
//
// UNDER BUDGET the track is a quantity: the fill is what's LEFT, anchored at
// the left edge, retreating as you spend and hitting zero width exactly when
// the money runs out.
//
// OVER BUDGET the whole track is what you SPENT today, divided at zero: the
// red to the left of the mark is the money that was not budgeted, the outlined
// lane to the right is the money that was, both to the same scale. So the
// overage's share - and therefore the mark - is overage / (limit + overage).
// Spending more does not fill empty room, because there is none; it moves the
// boundary, pushing the mark rightwards and squeezing the day's limit into a
// smaller share of what you actually spent.
//
// The two layouts hand over invisibly. At the instant of crossing, the
// under-budget fill is zero wide at the left edge and so is the overage, and
// the mark starts life in that same spot - so `fillFraction` is continuous
// through the boundary even though its MEANING flips there.
export function barGeometry(spent, limit) {
  const safeLimit = limit > 0 ? limit : 0
  const isOver = spent > safeLimit
  const remaining = safeLimit - spent
  const overage = isOver ? spent - safeLimit : 0

  // A limit of zero is a real state, not a missing value: overspend early
  // enough and the engine correctly says there is nothing left to spend
  // today, and every day after it in the period says the same. Dividing by it
  // isn't an option, so the two cases are named outright. Getting this wrong
  // was visible - treating the fraction as 0 put a GREEN figure directly above
  // the words "over today", because zero spent-fraction is the top of the ramp.
  //
  //   nothing spent against a zero limit -> exactly at the limit (1.0): the
  //     bar empties and goes red, which is true, you have nothing.
  //   anything spent against a zero limit -> as far past the limit as the
  //     ramp goes (2.0): deepest red.
  const zeroLimit = safeLimit === 0
  const spentFraction = zeroLimit ? (spent > 0 ? 2 : 1) : spent / safeLimit

  // A limit of $0 has no budgeted share at all, so the mark goes to the far
  // end and the lane disappears, rather than being clamped to a sliver that
  // would misstate it. The bar deliberately stops discriminating here: once
  // the period's money is gone, $0 is the whole truth about what today's
  // budget was, and there is no smaller honest depiction of it.
  const fillFraction = isOver
    ? zeroLimit
      ? 1
      : Math.min(MAX_ZERO_MARK, overage / (safeLimit + overage))
    : Math.max(0, 1 - spentFraction)

  return { safeLimit, isOver, remaining, overage, zeroLimit, spentFraction, fillFraction }
}

// Where the pieces go, given an already-animated fill width. Taking the
// animated value rather than recomputing from the raw numbers is the point:
// the red's right edge, the zero mark and the lane's left edge are three
// views of ONE number, so they cannot drift apart by a frame.
//
// `lanePercent` is what is left of the track after the red. Below half a
// percent the lane is dropped entirely rather than drawn as a 2px stub of its
// own borders.
export function barLayout(animatedFill) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(animatedFill) ? animatedFill : 0))
  const widthPercent = clamped * 100
  const lanePercent = 100 - widthPercent

  // The "0" caption rides the mark, but it is centred on its own position, so
  // at a small overage - where the mark is still close to the left edge - it
  // would hang off the side of the track. Held far enough in to stay whole; a
  // pixel or two of disagreement with the mark matters far less than half a
  // character disappearing.
  const zeroLabelPercent = Math.max(3, Math.min(97, widthPercent))

  return { widthPercent, lanePercent, zeroLabelPercent, showLane: lanePercent > 0.5 }
}
