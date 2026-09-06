// Core calculation engine for the daily spend habit tracker.
//
// Design: the discretionary amount is a budget for the ENTIRE pay period, and
// every day's limit is computed against the FULL period, not just whatever
// calendar days happen to be left:
//
//   dailyLimit = ceil(remainingBudget / (totalPeriodDays - daysActuallyLogged))
//
// The remaining budget only ever shrinks when the user explicitly logs a spend.
// `daysActuallyLogged` only counts days that have a real, user-entered
// entry. A day nobody logged - whether it's still in the future, or a past
// day the user simply never opened the app for - does NOT shrink the
// divisor and does NOT touch the budget. Its share of the period's budget just
// stays in the pool for whichever day next gets tracked, instead of
// getting redistributed across a shrinking handful of calendar days.
//
// This is what keeps the daily limit anchored to "$500 over 14 days is
// ~$36/day" even if a few days go untracked, rather than spiking every
// time a day passes without a log entry. It also means: if every day in
// the period gets logged (the expected, regularly-tracked case), the math
// reduces to exactly "remaining budget / calendar days left" at every step -
// including the last day, which still absorbs whatever's left over.
//
// Whole dollars only: every limit is rounded UP (Math.ceil) to the nearest
// whole dollar, per the "no cents, always round up" rule. Raw logged spend
// amounts are whole-dollar integers the user enters directly.

import { compareDateStr, addDays, daysBetweenInclusive } from './dateUtils.js'

// Round up to the nearest whole dollar (ceil = "round up" toward +Infinity,
// which also does the sensible thing for negative/over-budget pots).
export function ceilDollars(n) {
  return Math.ceil(n)
}

export function daysRemainingInclusive(fromDateStr, endDateStr) {
  return daysBetweenInclusive(fromDateStr, endDateStr)
}

// Two inclusive date ranges overlap (including exact duplicates and
// partial overlaps) whenever each range's start falls on or before the
// other's end.
export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return compareDateStr(aStart, bEnd) <= 0 && compareDateStr(bStart, aEnd) <= 0
}

// Finds an existing stored period whose date range overlaps (or exactly
// matches) the given [startDate, endDate] - used to block creating a
// duplicate/conflicting period. `excludePeriodId` lets the CURRENT
// period's own record be skipped when checking a proposed edit to ITS
// dates against every other stored period. Returns the conflicting
// period, or null if there's no overlap.
export function findOverlappingPeriod(periods, startDate, endDate, excludePeriodId) {
  for (const period of periods || []) {
    if (excludePeriodId && period.id === excludePeriodId) continue
    if (rangesOverlap(startDate, endDate, period.startDate, period.endDate)) {
      return period
    }
  }
  return null
}

// Which of a period's logged days would fall outside a proposed new date
// range. Shrinking the end date does not delete anything - the entries stay in
// storage and come back if the range is widened again - but they vanish from
// every screen in the meantime, and an edit that silently removes days you
// logged is exactly the kind of thing an app should ask about first.
export function entriesOutsideRange(period, startDate, endDate) {
  return (period.entries || [])
    .filter((e) => compareDateStr(e.date, startDate) < 0 || compareDateStr(e.date, endDate) > 0)
    .map((e) => e.date)
    .sort(compareDateStr)
}

// What the daily limit becomes on the NEXT tracked day, given where the budget
// and the logged-day count stand right now. Same formula the engine uses
// everywhere else - stated separately here because the dashboard needs to show
// the consequence of an overspend ("tomorrow drops to $28") at the moment it
// happens, rather than leaving the user to discover it tomorrow.
export function projectNextDayLimit(remaining, totalDays, loggedDays) {
  const divisor = Math.max(1, totalDays - loggedDays)
  return dailyLimitFor(remaining, divisor)
}

// The daily limit, floored at zero.
//
// The division can go negative - overspend hard enough and there is less than
// nothing left to spread over the days that remain. The arithmetic is right,
// but "-$38" is not a limit: a limit is the most you may spend, and the most
// you may spend is never less than nothing. Left unclamped it also propagated
// into the display as a negative figure in the LIMIT column of every remaining
// day, and drove the spend bar's colour ramp to a fraction of zero - which
// rendered a green figure directly above the words "over today".
//
// The depth of the hole is not lost by clamping: it lives in `remainingBefore`
// / `finalRemaining`, which is what the REMAINING box has always shown.
export function dailyLimitFor(budget, daysRemaining) {
  return Math.max(0, ceilDollars(budget / daysRemaining))
}

// Walks a period's EXPLICITLY LOGGED entries (and only those - unlogged
// days are never fabricated) in chronological order, producing:
//   - entries: finalized {date, amount, dailyLimit, remainingAfter} rows,
//     one per day the user actually logged, each carrying the dailyLimit
//     that applied when it was logged.
//   - todayInfo: the live, not-yet-committed info for today - its computed
//     dailyLimit and the budget available before today's spend is applied - or
//     null if today falls outside the period (period already ended).
//   - periodEnded: true once today's date is after the period's end date.
//   - totalDays: the full period length, for reference.
//
// Days with no logged entry (past or future) simply have no row here; the
// caller (buildPeriodSchedule) is responsible for rendering those as
// unknown/blank rather than treating them as a fabricated $0.
//
// This function is pure and does not mutate `period`.
export function reconcilePeriod(period, todayStr) {
  const { startDate, endDate, initialAmount, entries } = period
  const totalDays = daysBetweenInclusive(startDate, endDate)
  const periodEnded = compareDateStr(todayStr, endDate) > 0

  // The FLAT, un-rolled-over daily target implied by the period's original
  // budget and length alone - e.g. a $200/14-day period always has a $15
  // baseline, no matter how spending actually went. This is distinct from
  // the LIVE `dailyLimit` below, which rolls surplus/deficit forward and,
  // on the last day, necessarily collapses to "whatever's left" (only one
  // day remains to spend the whole rolled-over budget). The dashboard uses
  // this alongside the live number on the final day, when the live number
  // can otherwise look like an unexplained spike rather than the natural
  // result of earlier underspending.
  const baselineDailyLimit = ceilDollars(initialAmount / totalDays)

  // Only entries that actually fall inside the period count, deduplicated
  // by date (last one wins - matches how logSpend() upserts today's entry)
  // and sorted chronologically so the running budget/logged-day-count builds
  // up in the order the days actually occurred.
  const byDate = new Map()
  for (const e of entries || []) {
    if (compareDateStr(e.date, startDate) >= 0 && compareDateStr(e.date, endDate) <= 0) {
      byDate.set(e.date, e)
    }
  }
  const sortedEntries = [...byDate.values()].sort((a, b) => compareDateStr(a.date, b.date))

  const finalizedEntries = []
  let runningBudget = initialAmount
  let loggedDaysSoFar = 0 // count of explicitly logged days strictly before "today"

  for (const entry of sortedEntries) {
    if (compareDateStr(entry.date, todayStr) >= 0) break // today/future handled below

    const daysRemaining = Math.max(1, totalDays - loggedDaysSoFar)
    const dailyLimit = dailyLimitFor(runningBudget, daysRemaining)
    const remainingAfter = runningBudget - entry.amount
    finalizedEntries.push({ date: entry.date, amount: entry.amount, dailyLimit, remainingAfter })
    runningBudget = remainingAfter
    loggedDaysSoFar += 1
  }

  let todayInfo = null
  if (!periodEnded) {
    const daysRemaining = Math.max(1, totalDays - loggedDaysSoFar)
    const dailyLimit = dailyLimitFor(runningBudget, daysRemaining)
    const todayEntry = sortedEntries.find((e) => e.date === todayStr)

    if (todayEntry) {
      const remainingAfter = runningBudget - todayEntry.amount
      finalizedEntries.push({
        date: todayStr,
        amount: todayEntry.amount,
        dailyLimit,
        remainingAfter
      })
      todayInfo = {
        logged: true,
        amount: todayEntry.amount,
        dailyLimit,
        baselineDailyLimit,
        remainingBefore: runningBudget,
        remainingAfter
      }
      runningBudget = remainingAfter
    } else {
      todayInfo = {
        logged: false,
        amount: null,
        dailyLimit,
        baselineDailyLimit,
        remainingBefore: runningBudget,
        remainingAfter: null
      }
    }
  }

  return {
    entries: finalizedEntries,
    todayInfo,
    periodEnded,
    finalRemaining: runningBudget,
    totalDays
  }
}

// Rolls a period's reconciled entries up into the handful of aggregate
// numbers an end-of-period recap or a trend chart needs. Pure and works
// identically whether the period has actually ended (reconciled with the
// real "today", past its endDate) or is still in progress (used by the
// DEV: TRIGGER PERIOD SUMMARY preview) - it only ever looks at whatever
// entries reconcilePeriod already finalized, never at unlogged days.
export function summarizePeriod(period, reconciled) {
  const loggedEntries = reconciled.entries
  let totalSpent = 0
  let daysOver = 0
  let daysUnder = 0
  let daysAtLimit = 0

  for (const entry of loggedEntries) {
    totalSpent += entry.amount
    if (entry.amount > entry.dailyLimit) daysOver += 1
    else if (entry.amount < entry.dailyLimit) daysUnder += 1
    else daysAtLimit += 1
  }

  return {
    totalSpent,
    totalBudget: period.initialAmount,
    daysTracked: loggedEntries.length,
    daysOver,
    daysUnder,
    daysAtLimit,
    remaining: reconciled.finalRemaining
  }
}

// Builds the full day-by-day display schedule for the whole period (start
// date through end date), for rendering the dashboard's day list.
//
// - A day the user explicitly logged (past or today) shows its real spend
//   and the dailyLimit that applied at the time - `logged: true`.
// - Today, if not yet logged, has no spend yet, but its dailyLimit IS
//   known (it's exactly what's computable right now).
// - Any other day with no logged entry - a genuinely untracked past day,
//   or a day still in the future - is `isUnknown: true`. Its spend is
//   unknowable, but its Limit column still shows a real number: the
//   CURRENT live daily limit (the same number "Daily Limit Today" shows),
//   as a reference point for what that day's target is/was, rather than
//   leaving the column blank.
//
// `isPast` / `isToday` / `isFuture` are mutually exclusive and cover every
// row. The UI uses `isPast` to decide which rows are editable (only past
// days, logged or not, can be tapped to log/edit a spend - future days
// never can, and today has its own dedicated entry point).
export function buildPeriodSchedule(period, todayStr, reconciled) {
  const { startDate, endDate } = period
  const entryByDate = new Map(reconciled.entries.map((e) => [e.date, e]))
  // Fallback Limit for any day with no entry of its own: the current live
  // daily limit. null only in the (practically unreachable from the
  // dashboard) case where the period has already ended.
  const fallbackLimit = reconciled.todayInfo ? reconciled.todayInfo.dailyLimit : null

  const rows = []
  let cursor = startDate
  while (compareDateStr(cursor, endDate) <= 0) {
    const cmp = compareDateStr(cursor, todayStr)
    const isPast = cmp < 0
    const isToday = cmp === 0
    const isFuture = cmp > 0

    if (isToday && reconciled.todayInfo && !reconciled.todayInfo.logged) {
      rows.push({
        date: cursor,
        amount: null,
        dailyLimit: reconciled.todayInfo.dailyLimit,
        isToday: true,
        isPast: false,
        isFuture: false,
        isUnknown: false,
        logged: false
      })
    } else if (entryByDate.has(cursor)) {
      const e = entryByDate.get(cursor)
      rows.push({
        date: cursor,
        amount: e.amount,
        dailyLimit: e.dailyLimit,
        isToday,
        isPast,
        isFuture,
        isUnknown: false,
        logged: true
      })
    } else {
      rows.push({
        date: cursor,
        amount: null,
        dailyLimit: fallbackLimit,
        isToday,
        isPast,
        isFuture,
        isUnknown: true,
        logged: false
      })
    }
    cursor = addDays(cursor, 1)
  }
  return rows
}
