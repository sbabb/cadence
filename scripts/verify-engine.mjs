import assert from 'node:assert/strict'
import {
  daysBetweenInclusive,
  addDays,
  todayStr,
  compareDateStr,
  formatShortDate
} from '../src/utils/dateUtils.js'
import {
  reconcilePeriod,
  buildPeriodSchedule,
  summarizePeriod,
  rangesOverlap,
  findOverlappingPeriod,
  projectNextDayLimit,
  dailyLimitFor,
  entriesOutsideRange
} from '../src/utils/budgetEngine.js'
import { parseDateStr } from '../src/utils/dateUtils.js'
import {
  nextPaydayAfter,
  derivePeriodFromPayday,
  derivePeriodContaining,
  deriveNextPeriod
} from '../src/utils/cadence.js'
import { hexToOklch, oklchToHex, rampHex, rampOklch } from '../src/utils/color.js'

function scenario(name, fn) {
  try {
    fn()
    console.log(`PASS: ${name}`)
  } catch (err) {
    console.error(`FAIL: ${name}`)
    console.error(err)
    process.exitCode = 1
  }
}

// --- Pay periods are fully user-defined (no fixed 1st-15th / 16th-end
// calendar split) - the engine must work for ANY start/end date the user
// picks, of any length. ---
scenario('engine handles an arbitrary user-defined period (23 days, mid-month start)', () => {
  const period = {
    startDate: '2026-08-07',
    endDate: '2026-08-29', // 23 days, nothing to do with calendar halves
    initialAmount: 230,
    entries: []
  }
  assert.equal(daysBetweenInclusive(period.startDate, period.endDate), 23)
  const r = reconcilePeriod(period, '2026-08-07')
  assert.equal(r.todayInfo.dailyLimit, 10) // 230/23 = 10
})

scenario('engine handles a short user-defined period (5 days) spanning a month boundary', () => {
  const period = {
    startDate: '2026-08-29',
    endDate: '2026-09-02', // crosses into the next month, still just 5 days
    initialAmount: 100,
    entries: []
  }
  assert.equal(daysBetweenInclusive(period.startDate, period.endDate), 5)
  const r = reconcilePeriod(period, '2026-08-29')
  assert.equal(r.todayInfo.dailyLimit, 20) // 100/5 = 20
})

scenario('engine handles a single-day period', () => {
  const period = {
    startDate: '2026-08-15',
    endDate: '2026-08-15',
    initialAmount: 42,
    entries: []
  }
  const r = reconcilePeriod(period, '2026-08-15')
  assert.equal(r.todayInfo.dailyLimit, 42)
})

scenario('a period start date after its end date is caught by validation logic', () => {
  // This is what PeriodSetup.jsx's handleSubmit guards against before ever
  // calling startPeriod/reconcilePeriod.
  assert.equal(compareDateStr('2026-08-20', '2026-08-05') > 0, true)
})

// --- Day counting ---
scenario('daysBetweenInclusive basic', () => {
  assert.equal(daysBetweenInclusive('2026-08-01', '2026-08-15'), 15)
  assert.equal(daysBetweenInclusive('2026-08-15', '2026-08-15'), 1)
})

// --- Core engine: day 1 (nothing logged yet) ---
scenario('day 1 of period: limit = budget / total days', () => {
  const period = {
    startDate: '2026-08-01',
    endDate: '2026-08-15', // 15 days
    initialAmount: 150,
    entries: []
  }
  const r = reconcilePeriod(period, '2026-08-01')
  assert.equal(r.todayInfo.logged, false)
  assert.equal(r.todayInfo.dailyLimit, 10) // 150/15 = 10
  assert.equal(r.todayInfo.remainingBefore, 150)
  assert.equal(r.periodEnded, false)
})

// --- Underspend rolls surplus forward ---
scenario('underspend on day 1 raises day 2 limit', () => {
  const period = {
    startDate: '2026-08-01',
    endDate: '2026-08-10', // 10 days, $100 -> $10/day
    initialAmount: 100,
    entries: [{ date: '2026-08-01', amount: 5 }] // spent $5 instead of $10
  }
  const r = reconcilePeriod(period, '2026-08-02')
  // remaining budget after day1 = 95, days remaining on day2 = 9 -> ceil(95/9) = 11
  assert.equal(r.todayInfo.dailyLimit, 11)
  assert.equal(r.todayInfo.remainingBefore, 95)
})

// --- Overspend rolls deficit forward ---
scenario('overspend on day 1 lowers day 2 limit', () => {
  const period = {
    startDate: '2026-08-01',
    endDate: '2026-08-10',
    initialAmount: 100,
    entries: [{ date: '2026-08-01', amount: 20 }] // overspent by $10
  }
  const r = reconcilePeriod(period, '2026-08-02')
  // remaining budget after day1 = 80, days remaining = 9 -> ceil(80/9) = 9
  assert.equal(r.todayInfo.dailyLimit, 9)
  assert.equal(r.todayInfo.remainingBefore, 80)
})

// --- BUG FIX: unlogged days must NOT be fabricated as $0 data points, and
// must NOT shrink the "days remaining" divisor. The discretionary amount is
// a budget for the ENTIRE period; today's limit divides by (total days minus
// days actually logged), so a gap in tracking doesn't spike the number. ---
scenario('BUG 2 FIX: unlogged past days do not inflate today\'s limit ($500/14 stays ~$36 even after a 3-day gap)', () => {
  const period = {
    startDate: '2026-08-01',
    endDate: '2026-08-14', // 14 days
    initialAmount: 500,
    entries: [] // days 1-3 were never opened/logged at all
  }
  const day1 = reconcilePeriod(period, '2026-08-01')
  assert.equal(day1.todayInfo.dailyLimit, 36) // ceil(500/14) = 35.71 -> 36

  // Checking in on day 4 after 3 completely untracked days: full-period
  // math should still apply, NOT budget / calendar-days-remaining (which
  // would wrongly balloon to ceil(500/11) = 46).
  const day4 = reconcilePeriod(period, '2026-08-04')
  assert.equal(day4.todayInfo.dailyLimit, 36)
  assert.equal(day4.todayInfo.remainingBefore, 500) // untouched - nothing was ever logged
  assert.equal(day4.entries.length, 0) // no fabricated entries for the skipped days
})

scenario('BUG 2 FIX: an explicit $0 log still counts as a tracked day (unlike simply not logging)', () => {
  const period = {
    startDate: '2026-08-01',
    endDate: '2026-08-05', // 5 days, $50 -> $10/day baseline
    initialAmount: 50,
    entries: [{ date: '2026-08-01', amount: 0 }] // user deliberately logged $0 spent
  }
  const r = reconcilePeriod(period, '2026-08-02')
  // day1 counts as logged (1 tracked day), budget untouched (spent $0):
  // divisor = 5 - 1 = 4, limit = ceil(50/4) = 13 (a bit of real rollover,
  // since day1's specific $10 allotment is now confirmed unspent)
  assert.equal(r.entries.length, 1)
  assert.equal(r.entries[0].amount, 0)
  assert.equal(r.entries[0].dailyLimit, 10) // ceil(50/5) at the time it was logged
  assert.equal(r.todayInfo.remainingBefore, 50)
  assert.equal(r.todayInfo.dailyLimit, 13)
})

scenario('BUG 2 FIX: a mix of tracked and untracked days only rolls forward the tracked deviation', () => {
  const period = {
    startDate: '2026-08-01',
    endDate: '2026-08-14', // 14 days, baseline $36/day
    initialAmount: 500,
    entries: [{ date: '2026-08-01', amount: 20 }] // day1 logged, underspent by 16; days 2-3 untracked
  }
  const r = reconcilePeriod(period, '2026-08-04')
  // 1 tracked day so far -> divisor = 14 - 1 = 13; budget = 500 - 20 = 480
  assert.equal(r.todayInfo.dailyLimit, 37) // ceil(480/13) = 36.9 -> 37
})

// --- Editing today's entry (log once, edit same day) ---
scenario('logging today twice overwrites (edit), not duplicates', () => {
  const period = {
    startDate: '2026-08-01',
    endDate: '2026-08-05',
    initialAmount: 50,
    entries: [{ date: '2026-08-01', amount: 8 }]
  }
  // simulate an edit: replace day1 entry with a new amount, as the hook's
  // logSpend() does (filter out existing entry for today, push new one)
  const editedEntries = period.entries.filter((e) => e.date !== '2026-08-01')
  editedEntries.push({ date: '2026-08-01', amount: 12 })
  const edited = { ...period, entries: editedEntries }
  const r = reconcilePeriod(edited, '2026-08-01')
  assert.equal(r.todayInfo.amount, 12)
  assert.equal(r.todayInfo.remainingAfter, 38)
})

// --- Period end detection ---
scenario('period end detected once today passes end date', () => {
  const period = {
    startDate: '2026-08-01',
    endDate: '2026-08-15',
    initialAmount: 150,
    entries: []
  }
  const r = reconcilePeriod(period, '2026-08-16')
  assert.equal(r.periodEnded, true)
  assert.equal(r.todayInfo, null)
  // nothing was ever logged this period, so nothing is fabricated either
  assert.equal(r.entries.length, 0)
})

// --- Last day of period gets the entire remaining budget ---
scenario('last day of period: limit = entire remaining budget', () => {
  const period = {
    startDate: '2026-08-01',
    endDate: '2026-08-05',
    initialAmount: 50,
    entries: [
      { date: '2026-08-01', amount: 10 },
      { date: '2026-08-02', amount: 10 },
      { date: '2026-08-03', amount: 10 },
      { date: '2026-08-04', amount: 5 }
    ]
  }
  // remaining budget = 50 - 35 = 15, today is last day (day 5), daysRemaining=1
  const r = reconcilePeriod(period, '2026-08-05')
  assert.equal(r.todayInfo.dailyLimit, 15)
  assert.equal(r.todayInfo.remainingBefore, 15)
})

// --- FEATURE: baselineDailyLimit is the flat budget/totalDays target, held
// constant across the whole period regardless of rollover, distinct from
// the live `dailyLimit` (which the dashboard swaps in for on the final day
// so a big rolled-over number doesn't masquerade as an inflated "limit"). ---
scenario('baselineDailyLimit stays constant across the period regardless of under/overspend rollover', () => {
  const period = {
    startDate: '2026-08-01',
    endDate: '2026-08-10', // 10 days, $100 -> $10/day baseline
    initialAmount: 100,
    entries: [{ date: '2026-08-01', amount: 2 }] // big underspend on day 1
  }
  const day1 = reconcilePeriod(period, '2026-08-01')
  assert.equal(day1.todayInfo.baselineDailyLimit, 10)
  const day2 = reconcilePeriod(period, '2026-08-02')
  // live dailyLimit rolls the surplus forward (98 left / 9 days = 10.9 -> 11)...
  assert.equal(day2.todayInfo.dailyLimit, 11)
  // ...but the baseline stays exactly what it was on day 1: budget/totalDays.
  assert.equal(day2.todayInfo.baselineDailyLimit, 10)
})

scenario('baselineDailyLimit on the last day differs from the live dailyLimit when a big surplus rolled forward', () => {
  const period = {
    startDate: '2026-08-01',
    endDate: '2026-08-05', // 5 days, $50 -> $10/day baseline
    initialAmount: 50,
    entries: [
      { date: '2026-08-01', amount: 0 },
      { date: '2026-08-02', amount: 0 },
      { date: '2026-08-03', amount: 0 },
      { date: '2026-08-04', amount: 0 } // nothing spent all period - everything rolls to day 5
    ]
  }
  const r = reconcilePeriod(period, '2026-08-05')
  assert.equal(r.todayInfo.dailyLimit, 50) // the live number: the entire budget, all due today
  assert.equal(r.todayInfo.baselineDailyLimit, 10) // the steady, un-rolled-over target
})

// --- Rounding always rounds UP ---
scenario('daily limit always rounds up (ceil), never down', () => {
  const period = {
    startDate: '2026-08-01',
    endDate: '2026-08-03', // 3 days
    initialAmount: 100, // 100/3 = 33.33
    entries: []
  }
  const r = reconcilePeriod(period, '2026-08-01')
  assert.equal(r.todayInfo.dailyLimit, 34) // ceil(33.33) = 34, not 33
})

// --- BUG 1 FIX: untracked days (past or future) never show a fabricated
// $0 SPEND. Spend stays unknown (amount: null - the UI renders "unlogged"
// for past, "--" for future). Limit is a DIFFERENT story (per the later
// "every row shows a dollar Limit" fix below): every row, tracked or not,
// gets a real dailyLimit figure to display. ---
scenario('schedule never fabricates a $0 SPEND for untracked days (past or future)', () => {
  const period = {
    startDate: '2026-08-01',
    endDate: '2026-08-05',
    initialAmount: 50,
    entries: []
  }
  const r = reconcilePeriod(period, '2026-08-01')
  const schedule = buildPeriodSchedule(period, '2026-08-01', r)
  assert.equal(schedule.length, 5)
  const future = schedule.find((row) => row.date === '2026-08-03')
  assert.equal(future.isFuture, true)
  assert.equal(future.isPast, false)
  assert.equal(future.isUnknown, true)
  assert.equal(future.amount, null) // rendered as "--" in the UI, not $0
})

scenario('schedule marks untracked PAST days unknown for spend, but flags them isPast (editable)', () => {
  const period = {
    startDate: '2026-08-01',
    endDate: '2026-08-05',
    initialAmount: 50,
    entries: [] // days 1-2 never logged; checking in on day 3
  }
  const r = reconcilePeriod(period, '2026-08-03')
  const schedule = buildPeriodSchedule(period, '2026-08-03', r)
  const day1 = schedule.find((row) => row.date === '2026-08-01')
  const day2 = schedule.find((row) => row.date === '2026-08-02')
  for (const row of [day1, day2]) {
    assert.equal(row.isFuture, false) // these days have already happened
    assert.equal(row.isPast, true) // -> the UI makes these rows clickable
    assert.equal(row.isUnknown, true) // but nobody tracked them: spend blank
    assert.equal(row.amount, null)
    assert.equal(row.logged, false)
  }
  // today (day 3), not yet logged, is a DIFFERENT case: not "past", and its
  // limit IS known (it's live/computable right now), only spend is pending.
  const day3 = schedule.find((row) => row.date === '2026-08-03')
  assert.equal(day3.isToday, true)
  assert.equal(day3.isPast, false)
  assert.equal(day3.isUnknown, false)
  assert.equal(day3.amount, null)
  assert.equal(day3.dailyLimit, 10) // ceil(50 / (5 total days - 0 logged so far)) = 10
})

// --- FIX: every row's Limit column shows a real dollar figure, never a
// dash - untracked days (past or future) fall back to the CURRENT live
// daily limit as a reference point. ---
scenario('every schedule row has a non-null dailyLimit, including untracked past AND future days', () => {
  const period = {
    startDate: '2026-08-01',
    endDate: '2026-08-14', // 14 days, $500 -> $36/day baseline
    initialAmount: 500,
    entries: [] // nothing logged at all; checking in on day 4
  }
  const r = reconcilePeriod(period, '2026-08-04')
  const schedule = buildPeriodSchedule(period, '2026-08-04', r)
  for (const row of schedule) {
    assert.notEqual(row.dailyLimit, null, `row ${row.date} should not have a null dailyLimit`)
  }
  // Untracked past day, today, AND a future day should all show the SAME
  // current live limit ($36) as their reference figure right now.
  assert.equal(schedule.find((row) => row.date === '2026-08-01').dailyLimit, 36) // past, unlogged
  assert.equal(schedule.find((row) => row.date === '2026-08-04').dailyLimit, 36) // today, unlogged
  assert.equal(schedule.find((row) => row.date === '2026-08-10').dailyLimit, 36) // future
})

// --- FEATURE: editing a PAST day's logged amount recalculates the budget and
// every dailyLimit from that day forward, including today's live limit.
// This falls out for free from reconcilePeriod always recomputing the
// whole chronological walk fresh - there's no separate "propagate forward"
// step to get wrong. ---
scenario('editing a past day\'s logged amount recalculates everything from that day forward', () => {
  const period = {
    startDate: '2026-08-01',
    endDate: '2026-08-10', // 10 days, $100 -> $10/day baseline
    initialAmount: 100,
    entries: [
      { date: '2026-08-01', amount: 10 },
      { date: '2026-08-02', amount: 10 }
    ]
  }
  const before = reconcilePeriod(period, '2026-08-03')
  assert.equal(before.todayInfo.dailyLimit, 10) // 80 left / 8 days = 10

  // User taps day 1's row and corrects it from $10 -> $40 (a big overspend
  // they'd mis-logged). This is exactly what logSpendForDate does under
  // the hood: replace that date's entry, nothing else.
  const correctedEntries = period.entries.map((e) =>
    e.date === '2026-08-01' ? { ...e, amount: 40 } : e
  )
  const after = reconcilePeriod({ ...period, entries: correctedEntries }, '2026-08-03')

  // Day 1's own record reflects the correction:
  assert.equal(after.entries[0].amount, 40)
  // Day 2's dailyLimit is recalculated too (budget entering day2 is now 60,
  // not 90, so day2's limit - still divided by 9 remaining days at that
  // point - drops from 10 to ceil(60/9) = 6.67 -> 7):
  assert.equal(after.entries[1].dailyLimit, 7)
  assert.equal(after.entries[1].remainingAfter, 50) // 60 - 10 spent on day2
  // And today's (day 3) live limit reflects the correction too - it was
  // $10/day before the edit, now drops to ceil(50 / (10 total - 2 logged))
  // = ceil(50/8) = 6.25 -> 7, because day1's overspend ate into the budget:
  assert.equal(after.todayInfo.remainingBefore, 50)
  assert.equal(after.todayInfo.dailyLimit, 7)
})

scenario('addDays / date math sanity across month boundary', () => {
  assert.equal(addDays('2026-08-31', 1), '2026-09-01')
  assert.equal(addDays('2024-02-28', 1), '2024-02-29') // leap year
  assert.equal(addDays('2023-02-28', 1), '2023-03-01') // non-leap year
})

scenario('todayStr returns a well-formed date string', () => {
  assert.match(todayStr(), /^\d{4}-\d{2}-\d{2}$/)
})

// --- CADENCE FEATURE: summarizePeriod() rolls a period's reconciled
// entries up into the aggregate numbers the end-of-period summary and the
// trends bar chart both need (total spent, days over/under/at limit,
// remaining budget). ---
scenario('summarizePeriod rolls up totals, over/under/at-limit day counts, and remaining budget', () => {
  const period = {
    startDate: '2026-08-01',
    endDate: '2026-08-05', // 5 days, $50 -> $10/day baseline
    initialAmount: 50,
    entries: [
      { date: '2026-08-01', amount: 10 }, // exactly at that day's $10 limit
      { date: '2026-08-02', amount: 5 }, // under limit
      { date: '2026-08-03', amount: 15 }, // over limit
      { date: '2026-08-04', amount: 0 } // deliberate $0, under limit
      // day 5 never logged
    ]
  }
  // Reconcile from AFTER the period ends so every entry is finalized and
  // finalRemaining reflects the true end-of-period budget.
  const r = reconcilePeriod(period, '2026-08-06')
  assert.equal(r.periodEnded, true)

  const summary = summarizePeriod(period, r)
  assert.equal(summary.totalSpent, 30) // 10 + 5 + 15 + 0
  assert.equal(summary.totalBudget, 50)
  assert.equal(summary.daysTracked, 4)
  assert.equal(summary.daysOver, 1) // day 3
  assert.equal(summary.daysUnder, 2) // day 2 and day 4 ($0 counts as under, not its own bucket here)
  assert.equal(summary.daysAtLimit, 1) // day 1
  assert.equal(summary.remaining, 20) // 50 - 30
})

scenario('summarizePeriod on a period with nothing logged: zero spent, full budget still remaining', () => {
  const period = {
    startDate: '2026-08-01',
    endDate: '2026-08-05',
    initialAmount: 50,
    entries: []
  }
  const r = reconcilePeriod(period, '2026-08-06')
  const summary = summarizePeriod(period, r)
  assert.equal(summary.totalSpent, 0)
  assert.equal(summary.daysTracked, 0)
  assert.equal(summary.daysOver, 0)
  assert.equal(summary.daysUnder, 0)
  assert.equal(summary.daysAtLimit, 0)
  assert.equal(summary.remaining, 50) // nothing spent -> full budget still "remaining"
})

scenario('summarizePeriod works on a still-active period too (DEV: TRIGGER PERIOD SUMMARY preview)', () => {
  const period = {
    startDate: '2026-08-01',
    endDate: '2026-08-10', // still in progress
    initialAmount: 100,
    entries: [{ date: '2026-08-01', amount: 20 }]
  }
  const r = reconcilePeriod(period, '2026-08-03') // today is mid-period, not ended
  assert.equal(r.periodEnded, false)
  const summary = summarizePeriod(period, r)
  assert.equal(summary.totalSpent, 20)
  assert.equal(summary.daysTracked, 1)
  // the remaining figure reflects the budget as of "now", not a true period-end value
  // - correct for a live preview, which is exactly what the dev button is.
  assert.equal(summary.remaining, 80)
})

// --- DUPLICATE PERIOD PREVENTION: rangesOverlap / findOverlappingPeriod ---
scenario('rangesOverlap: identical date ranges overlap', () => {
  assert.equal(rangesOverlap('2026-08-01', '2026-08-14', '2026-08-01', '2026-08-14'), true)
})

scenario('rangesOverlap: partial overlap (new period starts inside an existing one)', () => {
  assert.equal(rangesOverlap('2026-08-10', '2026-08-24', '2026-08-01', '2026-08-14'), true)
})

scenario('rangesOverlap: one range fully contains the other', () => {
  assert.equal(rangesOverlap('2026-08-01', '2026-08-31', '2026-08-10', '2026-08-12'), true)
})

scenario('rangesOverlap: adjacent ranges (back-to-back, no shared day) do not overlap', () => {
  assert.equal(rangesOverlap('2026-08-01', '2026-08-14', '2026-08-15', '2026-08-28'), false)
})

scenario('rangesOverlap: ranges sharing exactly one boundary day DO overlap (inclusive)', () => {
  assert.equal(rangesOverlap('2026-08-01', '2026-08-15', '2026-08-15', '2026-08-28'), true)
})

scenario('rangesOverlap: completely disjoint ranges do not overlap', () => {
  assert.equal(rangesOverlap('2026-08-01', '2026-08-05', '2026-09-01', '2026-09-05'), false)
})

scenario('findOverlappingPeriod: detects a conflict against a stored period', () => {
  const periods = [
    { id: 'p1', startDate: '2026-08-01', endDate: '2026-08-14' },
    { id: 'p2', startDate: '2026-08-15', endDate: '2026-08-28' }
  ]
  const conflict = findOverlappingPeriod(periods, '2026-08-10', '2026-08-20')
  assert.equal(conflict.id, 'p1') // first match wins
})

scenario('findOverlappingPeriod: returns null when no stored period conflicts', () => {
  const periods = [{ id: 'p1', startDate: '2026-08-01', endDate: '2026-08-14' }]
  assert.equal(findOverlappingPeriod(periods, '2026-08-15', '2026-08-28'), null)
})

scenario('findOverlappingPeriod: excludePeriodId lets a period skip comparing against itself', () => {
  const periods = [
    { id: 'p1', startDate: '2026-08-01', endDate: '2026-08-14' },
    { id: 'p2', startDate: '2026-08-15', endDate: '2026-08-28' }
  ]
  // Editing p2's own end date to shrink it still overlaps itself trivially -
  // excludePeriodId must skip that self-comparison so only OTHER periods
  // are checked (this is exactly what updatePeriodDetails relies on).
  assert.equal(findOverlappingPeriod(periods, '2026-08-15', '2026-08-20', 'p2'), null)
  // But it must still catch a real conflict against a DIFFERENT period:
  const conflict = findOverlappingPeriod(periods, '2026-08-05', '2026-08-20', 'p2')
  assert.equal(conflict.id, 'p1')
})

scenario('findOverlappingPeriod: empty/undefined periods list never throws, returns null', () => {
  assert.equal(findOverlappingPeriod([], '2026-08-01', '2026-08-14'), null)
  assert.equal(findOverlappingPeriod(undefined, '2026-08-01', '2026-08-14'), null)
})

// --- PAY CADENCE: periods are DERIVED from a payday rule, never stored ahead ---
scenario("cadence derives the user's real bi-weekly period (paid Aug 20, today Aug 31)", () => {
  assert.equal(nextPaydayAfter('2026-08-20', 'biweekly'), '2026-09-03')
  const period = derivePeriodContaining('2026-08-20', 'biweekly', '2026-08-31')
  assert.deepEqual(period, { startDate: '2026-08-20', endDate: '2026-09-02' })
  assert.equal(daysBetweenInclusive(period.startDate, period.endDate), 14)
})

scenario('bi-weekly is pure day arithmetic, so three paydays can fall in one month', () => {
  // 26 periods across 12 months means this happens twice a year. Month-aware
  // logic would fight it; adding 14 days repeatedly gets it right for free.
  let payday = '2026-01-02'
  const january = []
  while (payday.startsWith('2026-01')) {
    january.push(payday)
    payday = nextPaydayAfter(payday, 'biweekly')
  }
  assert.deepEqual(january, ['2026-01-02', '2026-01-16', '2026-01-30'])
})

scenario('a stale paycheck date rolls forward to the period containing today', () => {
  // Entering a payday from three months ago must not produce an expired
  // period, and must not fabricate the empty months in between either.
  const period = derivePeriodContaining('2026-06-01', 'biweekly', '2026-08-31')
  assert.equal(compareDateStr(period.startDate, '2026-08-31') <= 0, true)
  assert.equal(compareDateStr('2026-08-31', period.endDate) <= 0, true)
  assert.deepEqual(period, { startDate: '2026-08-24', endDate: '2026-09-06' })
})

scenario('weekly / twice-monthly / monthly derive sensible period lengths', () => {
  assert.deepEqual(derivePeriodFromPayday('2026-08-20', 'weekly'), {
    startDate: '2026-08-20',
    endDate: '2026-08-26'
  })
  assert.deepEqual(derivePeriodFromPayday('2026-08-01', 'twice-monthly'), {
    startDate: '2026-08-01',
    endDate: '2026-08-15'
  })
  assert.deepEqual(derivePeriodFromPayday('2026-08-16', 'twice-monthly'), {
    startDate: '2026-08-16',
    endDate: '2026-08-31'
  })
  assert.deepEqual(derivePeriodFromPayday('2026-08-20', 'monthly'), {
    startDate: '2026-08-20',
    endDate: '2026-09-19'
  })
})

scenario('monthly clamps the day-of-month across shorter months, and rolls the year', () => {
  assert.equal(nextPaydayAfter('2026-01-31', 'monthly'), '2026-02-28')
  assert.equal(nextPaydayAfter('2026-12-10', 'monthly'), '2027-01-10')
})

scenario('manual cadence derives nothing - the user sets their own dates', () => {
  assert.equal(derivePeriodContaining('2026-08-20', 'manual', '2026-08-31'), null)
  assert.equal(nextPaydayAfter('2026-08-20', 'manual'), null)
})

scenario('an unrecognised cadence derives nothing rather than throwing', () => {
  // Whatever is in storage is not necessarily something this build offers: an
  // older install, a hand-edited blob, a backup from a future version. It has
  // to degrade to the manual path - the setup screen arrives unfilled - rather
  // than crash the end-of-period flow on the one morning it is load-bearing.
  assert.equal(nextPaydayAfter('2026-08-20', 'fortnightly-ish'), null)
  assert.equal(derivePeriodFromPayday('2026-08-20', 'fortnightly-ish'), null)
  assert.equal(derivePeriodContaining('2026-08-20', 'fortnightly-ish', '2026-08-31'), null)
  assert.equal(
    deriveNextPeriod({ startDate: '2026-08-01', endDate: '2026-08-15' }, 'fortnightly-ish', '2026-08-16'),
    null
  )
})

// --- DIAL: semi-monthly, which is the one cadence defined by calendar dates ---
scenario('twice-monthly derives BOTH paydays from the one date the user gave', () => {
  // The schedules people are actually on. Each is entered from either half of
  // the pair, because onboarding asks for the last payday and that is a coin
  // flip as to which one it is.
  const schedules = [
    ['2026-01-01', ['2026-01-16', '2026-02-01', '2026-02-16']],
    ['2026-01-16', ['2026-02-01', '2026-02-16', '2026-03-01']],
    ['2026-01-05', ['2026-01-20', '2026-02-05', '2026-02-20']],
    ['2026-01-20', ['2026-02-05', '2026-02-20', '2026-03-05']],
    ['2026-01-10', ['2026-01-25', '2026-02-10', '2026-02-25']]
  ]
  for (const [start, expected] of schedules) {
    let payday = start
    for (const want of expected) {
      payday = nextPaydayAfter(payday, 'twice-monthly')
      assert.equal(payday, want, `${start}: expected ${want}`)
    }
  }
})

scenario('the 15th and the LAST day tracks the length of each month by itself', () => {
  // The case a day number cannot express, and the reason the pair carries a
  // symbol rather than a 31: the last payday of the month is the 31st, the
  // 30th, the 28th or the 29th, and a user should never have to correct it.
  let payday = '2026-01-15'
  const expected = [
    '2026-01-31', '2026-02-15', '2026-02-28', '2026-03-15', '2026-03-31',
    '2026-04-15', '2026-04-30', '2026-05-15', '2026-05-31'
  ]
  for (const want of expected) {
    payday = nextPaydayAfter(payday, 'twice-monthly')
    assert.equal(payday, want)
  }
  // February gains its 29th in a leap year without anything being told about it.
  assert.equal(nextPaydayAfter('2028-02-15', 'twice-monthly'), '2028-02-29')
  assert.equal(nextPaydayAfter('2028-02-29', 'twice-monthly'), '2028-03-15')
  // And the year rolls over from either half of the pair.
  assert.equal(nextPaydayAfter('2026-12-16', 'twice-monthly'), '2027-01-01')
  assert.equal(nextPaydayAfter('2026-12-31', 'twice-monthly'), '2027-01-15')
})

scenario('a twice-monthly schedule never wanders as it is rolled forward', () => {
  // The property the whole design rests on. The callers step one payday at a
  // time, re-deriving the pair from wherever they have got to, so both members
  // of a pair MUST derive that same pair back. If they don't, a schedule
  // silently migrates to a different one after a month or two - which is
  // exactly what the hardcoded 1st-and-16th version did to everybody not on it.
  const lastDayOf = (dateStr) => {
    const d = parseDateStr(dateStr)
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  }

  for (const start of ['2026-01-01', '2026-01-16', '2026-01-15', '2026-01-31',
                       '2026-01-05', '2026-01-20', '2026-01-10', '2026-01-25']) {
    // Which two slots this schedule should keep for good, taken from its own
    // first full month rather than assumed.
    let payday = start
    const first = nextPaydayAfter(payday, 'twice-monthly')
    const second = nextPaydayAfter(first, 'twice-monthly')
    const slots = [first, second].map((d) => (Number(d.slice(8)) === lastDayOf(d) ? 'last' : d.slice(8))).sort()

    payday = start
    const perMonth = new Map()
    for (let i = 0; i < 48; i += 1) {
      payday = nextPaydayAfter(payday, 'twice-monthly')
      const month = payday.slice(0, 7)
      perMonth.set(month, (perMonth.get(month) || 0) + 1)
      const day = Number(payday.slice(8))
      const slot = day === lastDayOf(payday) ? 'last' : payday.slice(8)
      assert.equal(
        slots.includes(slot),
        true,
        `${start}: payday ${payday} fell outside the ${slots.join(' / ')} schedule it started on`
      )
    }
    // Twice a month, every month - which is what makes it 24 a year and not 26.
    // The first and last months of the window are partial, so they are exempt.
    const complete = [...perMonth.entries()].slice(1, -1)
    for (const [month, count] of complete) {
      assert.equal(count, 2, `${start}: ${month} had ${count} paydays rather than 2`)
    }
    assert.equal(complete.length >= 22, true, `${start}: expected roughly two years of months`)
  }
})

scenario('the next period follows the one that just ended, with no gap and no overlap', () => {
  const previous = { startDate: '2026-08-20', endDate: '2026-09-02' }
  const next = deriveNextPeriod(previous, 'biweekly', '2026-09-03')
  assert.deepEqual(next, { startDate: '2026-09-03', endDate: '2026-09-16' })
  assert.equal(rangesOverlap(previous.startDate, previous.endDate, next.startDate, next.endDate), false)
  assert.equal(addDays(previous.endDate, 1), next.startDate)
})

scenario('coming back after several missed pay cycles lands on the CURRENT period, not the next one', () => {
  const previous = { startDate: '2026-08-20', endDate: '2026-09-02' }
  const next = deriveNextPeriod(previous, 'biweekly', '2026-10-20')
  // Sep 3, Sep 17 and Oct 1 all passed unlived - they are not invented.
  assert.deepEqual(next, { startDate: '2026-10-15', endDate: '2026-10-28' })
  assert.equal(compareDateStr('2026-10-20', next.startDate) >= 0, true)
  assert.equal(compareDateStr('2026-10-20', next.endDate) <= 0, true)
})

scenario('abandoning a period early offers the remainder up to the next payday', () => {
  // Abandoning truncates the end date, so it no longer lines up with the pay
  // cycle. The naive derivation would overlap it; instead the gap between
  // today and the next payday becomes its own short catch-up period.
  const abandoned = { startDate: '2026-08-20', endDate: '2026-08-25' }
  const next = deriveNextPeriod(abandoned, 'biweekly', '2026-08-26')
  assert.deepEqual(next, { startDate: '2026-08-26', endDate: '2026-09-02' })
  assert.equal(rangesOverlap(abandoned.startDate, abandoned.endDate, next.startDate, next.endDate), false)
})

scenario('abandoning today never offers a period that overlaps the day just closed', () => {
  // Abandon truncates the end date to TODAY, so today is still inside the
  // period being closed. Anchoring the replacement to today produced a period
  // starting on a day the old one still occupied - an overlap the duplicate
  // check then rejected, which left the setup screen refusing dates it had
  // pre-filled itself. The gap has to start the day AFTER the old period.
  const abandonedToday = { startDate: '2026-09-01', endDate: '2026-09-06' }
  const next = deriveNextPeriod(abandonedToday, 'biweekly', '2026-09-06')
  assert.deepEqual(next, { startDate: '2026-09-07', endDate: '2026-09-14' })
  assert.equal(
    rangesOverlap(abandonedToday.startDate, abandonedToday.endDate, next.startDate, next.endDate),
    false
  )
})

scenario('abandoning ON the last day offers the next aligned period, not a backwards one', () => {
  // Here the clamp closes the gap completely: the day after the old period IS
  // the next payday. The aligned period is the answer; the gap branch would
  // have returned a range ending the day before it starts.
  const lastDay = { startDate: '2026-09-01', endDate: '2026-09-14' }
  const next = deriveNextPeriod(lastDay, 'biweekly', '2026-09-14')
  assert.deepEqual(next, { startDate: '2026-09-15', endDate: '2026-09-28' })
  assert.equal(compareDateStr(next.startDate, next.endDate) < 0, true, 'a period must not end before it starts')
  assert.equal(rangesOverlap(lastDay.startDate, lastDay.endDate, next.startDate, next.endDate), false)
})

scenario('no cadence ever offers a period overlapping the one it follows', () => {
  // The property that matters, swept rather than spot-checked: whatever the
  // cadence and whenever the user comes back - including the same day they
  // abandoned - the offer never collides with the period just closed.
  for (const cadence of ['weekly', 'biweekly', 'twice-monthly', 'monthly']) {
    for (const endDate of ['2026-09-06', '2026-09-14', '2026-09-30']) {
      const previous = { startDate: '2026-09-01', endDate }
      for (const today of [endDate, addDays(endDate, 1), addDays(endDate, 9)]) {
        const next = deriveNextPeriod(previous, cadence, today)
        if (!next) continue
        const where = `${cadence}, ended ${endDate}, opened ${today}`
        assert.equal(
          rangesOverlap(previous.startDate, previous.endDate, next.startDate, next.endDate),
          false,
          `${where}: overlaps the previous period`
        )
        assert.equal(compareDateStr(next.startDate, next.endDate) <= 0, true, `${where}: ends before it starts`)
        // Once the old period is genuinely over, the offer must contain today -
        // that is what the dashboard needs to have a row and a limit to show.
        if (compareDateStr(today, previous.endDate) > 0) {
          assert.equal(compareDateStr(next.startDate, today) <= 0, true, `${where}: starts after today`)
          assert.equal(compareDateStr(today, next.endDate) <= 0, true, `${where}: ends before today`)
        }
      }
    }
  }
})

scenario('derived periods always contain today, which is what keeps future-dated periods impossible', () => {
  for (const cadence of ['weekly', 'biweekly', 'twice-monthly', 'monthly']) {
    for (const today of ['2026-08-31', '2026-09-15', '2027-01-01']) {
      const period = derivePeriodContaining('2026-08-20', cadence, today)
      assert.ok(period, `${cadence} should derive a period for ${today}`)
      assert.equal(compareDateStr(period.startDate, today) <= 0, true, `${cadence}/${today} starts too late`)
      assert.equal(compareDateStr(today, period.endDate) <= 0, true, `${cadence}/${today} ends too early`)
    }
  }
})

// --- DIAL: OKLCH color conversion and the weighted ramp ---
scenario('OKLCH conversion round-trips every palette color exactly', () => {
  for (const hex of ['#9ece6a', '#e0af68', '#f7768e', '#73daca', '#7aa2f7', '#1a1b26', '#c0caf5', '#ffffff', '#000000']) {
    assert.equal(oklchToHex(hexToOklch(hex)), hex, `${hex} should survive a round trip`)
  }
})

scenario('ramp holds green through the first 65% of the daily limit', () => {
  // Spending your allowance as intended shouldn't look like a warning, so the
  // escalation is deliberately back-loaded rather than linear.
  for (const t of [0, 0.2, 0.4, 0.6, 0.65]) {
    assert.equal(rampHex(t), '#9ece6a', `at ${t} the ring should still be green`)
  }
})

scenario('ramp at 70% spent is mostly green with a little amber mixed in', () => {
  // The brief's own worked example: $35 of a $50 limit.
  const hex = rampHex(35 / 50)
  assert.notEqual(hex, '#9ece6a') // it has started moving...
  const { h } = rampOklch(35 / 50)
  const green = hexToOklch('#9ece6a').h
  const amber = hexToOklch('#e0af68').h
  // ...but only about a fifth of the way from green toward amber.
  const progress = (green - h) / (green - amber)
  assert.ok(progress > 0.1 && progress < 0.3, `expected ~20% of the way to amber, got ${(progress * 100).toFixed(1)}%`)
})

scenario('ramp hits amber exactly at the limit approach and red exactly at the limit', () => {
  assert.equal(rampHex(0.9), '#e0af68')
  assert.equal(rampHex(1), '#f7768e')
})

scenario('ramp deepens past the limit, then holds rather than running away', () => {
  const atLimit = rampHex(1)
  const justOver = rampHex(1.25)
  const wayOver = rampHex(2)
  const absurdlyOver = rampHex(8)
  assert.notEqual(justOver, atLimit) // being over is visibly distinct from being exactly at
  assert.equal(wayOver, '#db4b4b')
  assert.equal(absurdlyOver, wayOver) // clamped - $200 over and $2000 over look the same
})

scenario('ramp takes the SHORT way round the hue wheel (through yellow, never through blue)', () => {
  // This is the whole reason for interpolating in OKLCH. Going the long way
  // would swing green -> cyan -> blue -> magenta -> red, which would be both
  // hideous and meaningless. Hue must fall monotonically from green (~130deg)
  // to red (~10deg) without ever increasing.
  const greenHue = hexToOklch('#9ece6a').h
  const redHue = hexToOklch('#f7768e').h
  let previous = Infinity
  for (let t = 0; t <= 1.0001; t += 0.02) {
    const { h } = rampOklch(t)
    assert.ok(h <= greenHue + 0.5, `hue ${h.toFixed(1)} at t=${t.toFixed(2)} went past green`)
    assert.ok(h >= redHue - 0.5, `hue ${h.toFixed(1)} at t=${t.toFixed(2)} went past red`)
    assert.ok(h <= previous + 0.5, `hue increased at t=${t.toFixed(2)} - took the long way round`)
    previous = h
  }
})

// --- DIAL: what an overspend does to the days that follow ---
scenario('projectNextDayLimit restates the engine formula for the day after today', () => {
  // $100 budget over 10 days. Today (the 1st tracked day) blows $40 of it.
  // 60 left, 9 untracked days remain -> ceil(60/9) = 7.
  assert.equal(projectNextDayLimit(60, 10, 1), 7)
})

scenario('projectNextDayLimit never divides by zero on the final tracked day', () => {
  assert.equal(projectNextDayLimit(25, 5, 5), 25)
  assert.equal(projectNextDayLimit(25, 5, 9), 25) // more logged than total: still safe
})

scenario('overspending today visibly shrinks tomorrow (the number the dial surfaces)', () => {
  const period = {
    startDate: '2026-08-01',
    endDate: '2026-08-10', // 10 days, $100 -> $10/day baseline
    initialAmount: 100,
    entries: [{ date: '2026-08-01', amount: 35 }] // way over today's $10
  }
  const r = reconcilePeriod(period, '2026-08-01')
  assert.equal(r.todayInfo.dailyLimit, 10)
  const tomorrow = projectNextDayLimit(r.todayInfo.remainingAfter, 10, 1)
  assert.equal(r.todayInfo.remainingAfter, 65)
  assert.equal(tomorrow, 8) // ceil(65/9) = 7.2 -> 8; the user sees the cost immediately
})

// ---------------------------------------------------------------------------
// Round 15: the edge cases. Every one of these is a real situation that
// produced a wrong answer or a silent one before it was written down here.
// ---------------------------------------------------------------------------

scenario('a limit can never be negative - it floors at zero', () => {
  // Overspend hard enough and remaining goes below zero, so the division does
  // too. "-$38" is not a limit; the most you may spend is never less than
  // nothing. The size of the hole survives in `remainingBefore`.
  assert.equal(dailyLimitFor(-500, 9), 0)
  assert.equal(dailyLimitFor(0, 9), 0)
  assert.equal(dailyLimitFor(90, 9), 10)
  assert.equal(projectNextDayLimit(-500, 14, 5), 0)
})

scenario('blowing the whole budget on day one leaves a zero limit, not a negative one', () => {
  const period = {
    startDate: '2026-09-01',
    endDate: '2026-09-14',
    initialAmount: 400,
    entries: [{ date: '2026-09-01', amount: 900 }]
  }
  const r = reconcilePeriod(period, '2026-09-06')
  assert.equal(r.todayInfo.dailyLimit, 0)
  // The debt is still stated, just not as a "limit".
  assert.equal(r.todayInfo.remainingBefore, -500)
  // And every remaining day inherits the floored figure rather than -$38.
  const schedule = buildPeriodSchedule(period, '2026-09-06', r)
  assert.ok(schedule.every((row) => row.dailyLimit === null || row.dailyLimit >= 0))
})

scenario('a period spanning a daylight-saving change still counts whole days', () => {
  // US DST ends 2026-11-01, so this range contains a 25-hour day. Date maths
  // that drifted by an hour would report 15 days, and every daily limit in
  // November would be wrong by a fifteenth.
  assert.equal(daysBetweenInclusive('2026-10-25', '2026-11-07'), 14)
  assert.equal(addDays('2026-10-31', 2), '2026-11-02')
  const period = {
    startDate: '2026-10-25',
    endDate: '2026-11-07',
    initialAmount: 420,
    entries: []
  }
  const r = reconcilePeriod(period, '2026-11-02')
  assert.equal(r.totalDays, 14)
  assert.equal(r.todayInfo.dailyLimit, 30)
})

scenario('the spring-forward direction is safe too', () => {
  // US DST begins 2027-03-14 - a 23-hour day, the direction that most often
  // makes naive date maths lose a day entirely.
  assert.equal(daysBetweenInclusive('2027-03-08', '2027-03-21'), 14)
  assert.equal(addDays('2027-03-13', 1), '2027-03-14')
  assert.equal(addDays('2027-03-14', 1), '2027-03-15')
})

scenario('travelling backwards across a date line does not corrupt the period', () => {
  // Fly east to west and the device clock can hand back YESTERDAY. An entry
  // already logged is then dated in the future relative to "today". It must be
  // ignored for the running total rather than counted or double-counted.
  const period = {
    startDate: '2026-09-01',
    endDate: '2026-09-14',
    initialAmount: 280, // $20/day flat
    entries: [
      { date: '2026-09-01', amount: 20 },
      { date: '2026-09-02', amount: 20 },
      { date: '2026-09-03', amount: 50 } // "tomorrow" after the clock moves back
    ]
  }
  const r = reconcilePeriod(period, '2026-09-02')
  // Only Sep 1 is strictly before today, so only it is finalized.
  assert.equal(r.entries.length, 2) // Sep 1, plus today's own logged entry
  assert.ok(r.entries.every((e) => compareDateStr(e.date, '2026-09-02') <= 0))
  // The future entry is untouched and uncounted - not deleted, not applied.
  assert.equal(r.todayInfo.remainingAfter, 240)
})

scenario('a future-dated entry reappears correctly once that day arrives', () => {
  const period = {
    startDate: '2026-09-01',
    endDate: '2026-09-14',
    initialAmount: 280,
    entries: [
      { date: '2026-09-01', amount: 20 },
      { date: '2026-09-02', amount: 20 },
      { date: '2026-09-03', amount: 50 }
    ]
  }
  const r = reconcilePeriod(period, '2026-09-03')
  assert.equal(r.todayInfo.logged, true)
  assert.equal(r.todayInfo.amount, 50)
  assert.equal(r.todayInfo.remainingAfter, 190) // 280 - 20 - 20 - 50
})

scenario('entriesOutsideRange finds exactly the days an edit would hide', () => {
  const period = {
    startDate: '2026-09-01',
    endDate: '2026-09-14',
    entries: [
      { date: '2026-09-02', amount: 10 },
      { date: '2026-09-09', amount: 10 },
      { date: '2026-09-12', amount: 10 }
    ]
  }
  assert.deepEqual(entriesOutsideRange(period, '2026-09-01', '2026-09-14'), [])
  assert.deepEqual(entriesOutsideRange(period, '2026-09-01', '2026-09-10'), ['2026-09-12'])
  assert.deepEqual(entriesOutsideRange(period, '2026-09-01', '2026-09-05'), ['2026-09-09', '2026-09-12'])
})

scenario('hidden days are hidden, not destroyed - widening the range restores them', () => {
  const entries = [
    { date: '2026-09-02', amount: 10 },
    { date: '2026-09-12', amount: 40 }
  ]
  const shrunk = { startDate: '2026-09-01', endDate: '2026-09-10', initialAmount: 200, entries }
  const widened = { startDate: '2026-09-01', endDate: '2026-09-14', initialAmount: 200, entries }
  assert.equal(reconcilePeriod(shrunk, '2026-09-20').finalRemaining, 190)
  assert.equal(reconcilePeriod(widened, '2026-09-20').finalRemaining, 150)
})

scenario('a period nobody ever opened reports nothing tracked, not zero spent', () => {
  const period = { startDate: '2026-07-01', endDate: '2026-07-14', initialAmount: 400, entries: [] }
  const summary = summarizePeriod(period, reconcilePeriod(period, '2026-07-20'))
  assert.equal(summary.daysTracked, 0)
  // totalSpent is 0 arithmetically, but daysTracked is what the UI must branch
  // on - the difference between "spent nothing" and "we do not know".
  assert.equal(summary.totalSpent, 0)
  assert.equal(summary.remaining, 400)
})

scenario('a one-day period is valid and does not divide by zero', () => {
  const period = { startDate: '2026-09-06', endDate: '2026-09-06', initialAmount: 60, entries: [] }
  const r = reconcilePeriod(period, '2026-09-06')
  assert.equal(r.totalDays, 1)
  assert.equal(r.todayInfo.dailyLimit, 60)
  assert.equal(r.todayInfo.baselineDailyLimit, 60)
})

scenario('short dates carry a year only when they leave the reference year', () => {
  // Without this, a chart crossing New Year renders two periods twelve months
  // apart as the same label.
  assert.equal(formatShortDate('2026-01-05', 2026), '1/5')
  assert.equal(formatShortDate('2025-01-05', 2026), '1/5/25')
  assert.equal(formatShortDate('2027-12-31', 2026), '12/31/27')
})

console.log('\nAll engine verification scenarios completed.')
