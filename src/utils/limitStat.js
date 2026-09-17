// What the DAILY LIMIT TODAY stat box says - the figure and the word under it.
//
// This lives apart from the component for the same reason the bar's geometry
// does: the rule has real branches, the component cannot be checked by a
// script, and this can. scripts/verify-stats.mjs does.
//
// The rule it encodes, in one sentence: the box shows the day's live limit -
// the same number today's row in the day list shows - except on the last day
// of a period, where the live limit is inflated by everything that rolled
// forward and the steady baseline is the more useful figure.

// The figure, plus the note and the delta that go beneath it.
//
//   isLastDay           today is the period's final day
//   todayLimit          the live limit today is judged against, or null
//   baselineDailyLimit  the flat budget/totalDays target, never rolled over
//   todaySpent          logged so far today (0 if nothing is logged)
//   previousDayLimit    yesterday's live limit, or null if there isn't one
//
// Returns { amount, note, delta, showingBaseline }. `delta` is null unless the
// limit actually moved; the caller shows the note in its place when it does.
export function limitStat({
  isLastDay,
  todayLimit,
  baselineDailyLimit,
  todaySpent = 0,
  previousDayLimit = null
}) {
  if (todayLimit === null || todayLimit === undefined) {
    return { amount: null, note: null, delta: null, showingBaseline: false }
  }

  // On the last day the live limit necessarily equals whatever is left in the
  // budget - only one day remains to spend it - so underspending all period
  // lands a large, seemingly-arbitrary number in a box labelled "limit". That
  // is the case the baseline substitution exists for, and it is the ONLY case:
  // it applies when the rollover pushed the limit UP.
  //
  // It used to apply to the whole last day unconditionally, which meant that
  // spending the budget out printed the period's usual target - $43 - in a box
  // labelled DAILY LIMIT TODAY on a day when there was nothing left to spend,
  // while today's row in the list directly beneath it said $0. A number that
  // says you may spend $43 when you may not is worse than a big one that needs
  // explaining, so below the baseline the live figure stands.
  const showingBaseline = Boolean(isLastDay) && todayLimit > baselineDailyLimit
  const amount = showingBaseline ? baselineDailyLimit : todayLimit

  // Whether the limit moved since yesterday. It is designed to hold steady - a
  // few dollars of variance spread over the remaining days rounds away to
  // nothing - but an unchanging number gives no sign it is alive, so the days
  // it DOES move are marked. Meaningless against the static baseline, which
  // has nothing to compare against.
  //
  // It deliberately survives a spent-out day: the day a limit moves is exactly
  // the day you want told about it, and being over budget is no reason to
  // withhold the fact.
  const moved = showingBaseline || previousDayLimit === null ? 0 : todayLimit - previousDayLimit
  const delta = moved === 0 ? null : moved

  return { amount, delta, showingBaseline, note: noteFor(amount, showingBaseline, todaySpent) }
}

// The word under the figure, when there is no delta to put there. The limit
// holding steady is the designed-for case, not a missing value, so the slot
// says so rather than sitting empty beside two boxes that have something in
// theirs.
function noteFor(amount, showingBaseline, todaySpent) {
  if (showingBaseline) return 'usual target'
  // Zero is not a limit holding steady, it is the budget being gone, and
  // "steady" read as reassurance on the one screen that should not reassure.
  if (amount === 0) return 'nothing left'
  if (todaySpent > 0 && todaySpent >= amount) return 'spent out'
  return 'steady'
}
