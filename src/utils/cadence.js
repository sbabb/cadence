// Pay cadence: turning "I get paid every fortnight, last on the 20th" into
// actual period dates.
//
// The central idea is that a cadence is a RULE, not a set of records. From a
// payday and a frequency you can work out which period contains any given
// date, arithmetically, whenever you need it. So the app never stores periods
// ahead of time - it derives the one you're in and materialises only that.
// Storing future periods would break `currentPeriod` (defined as the last
// entry in the array), fill the pager with blank pages and put empty bars in
// Trends. It would also mean fabricating records the user never lived through,
// which is the same mistake the engine already refuses to make with unlogged
// days.

import { addDays, compareDateStr, parseDateStr } from './dateUtils.js'

// The four that cover almost everyone, plus an escape hatch. Bi-weekly and
// semi-monthly are labelled with their yearly counts on purpose: they sound
// interchangeable and aren't, and picking the wrong one silently misaligns
// every period from then on.
export const CADENCE_OPTIONS = [
  { value: 'weekly', label: 'EVERY WEEK', detail: '52 pay periods a year' },
  { value: 'biweekly', label: 'EVERY 2 WEEKS', detail: '26 pay periods a year' },
  { value: 'twice-monthly', label: 'TWICE A MONTH', detail: '24 pay periods — 1st and 16th' },
  { value: 'monthly', label: 'ONCE A MONTH', detail: '12 pay periods a year' },
  { value: 'manual', label: 'SOMETHING ELSE', detail: "I'll set my own dates each time" }
]

export const DEFAULT_CADENCE = 'biweekly'

function pad2(n) {
  return String(n).padStart(2, '0')
}

function dateStrFrom(year, monthIndex0, day) {
  return `${year}-${pad2(monthIndex0 + 1)}-${pad2(day)}`
}

function daysInMonth(year, monthIndex0) {
  // Day 0 of the FOLLOWING month is the last day of this one.
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate()
}

// The next payday STRICTLY after the given one. Everything else in this file
// is built on top of this, so the awkward cases only have to be right once.
//
// Note that weekly and biweekly are pure day arithmetic, deliberately. Adding
// 14 days repeatedly is what produces the real-world quirk of bi-weekly pay:
// 26 periods across 12 months means twice a year a calendar month contains
// three paydays. Month-aware logic would fight that; day arithmetic gets it
// right without trying.
export function nextPaydayAfter(paydayStr, cadence) {
  if (!paydayStr) return null

  switch (cadence) {
    case 'weekly':
      return addDays(paydayStr, 7)
    case 'biweekly':
      return addDays(paydayStr, 14)
    case 'twice-monthly': {
      // Paydays are the 1st and the 16th.
      const d = parseDateStr(paydayStr)
      const year = d.getUTCFullYear()
      const month = d.getUTCMonth()
      const day = d.getUTCDate()
      if (day < 16) return dateStrFrom(year, month, 16)
      const nextMonth = month === 11 ? 0 : month + 1
      const nextYear = month === 11 ? year + 1 : year
      return dateStrFrom(nextYear, nextMonth, 1)
    }
    case 'monthly': {
      // Same day next month, clamped so the 31st doesn't overshoot February.
      const d = parseDateStr(paydayStr)
      const year = d.getUTCFullYear()
      const month = d.getUTCMonth()
      const day = d.getUTCDate()
      const nextMonth = month === 11 ? 0 : month + 1
      const nextYear = month === 11 ? year + 1 : year
      return dateStrFrom(nextYear, nextMonth, Math.min(day, daysInMonth(nextYear, nextMonth)))
    }
    default:
      return null
  }
}

// A pay period runs from a payday up to the day before the next one, so the
// periods tile the calendar with no gaps and no overlaps.
export function derivePeriodFromPayday(paydayStr, cadence) {
  const next = nextPaydayAfter(paydayStr, cadence)
  if (!next) return null
  return { startDate: paydayStr, endDate: addDays(next, -1) }
}

// Rolls forward from a known payday until it finds the period containing
// `todayStr`, and returns only that one.
//
// This is what makes a stale start date harmless: enter a paycheck from three
// months ago and you get the period you're actually in now, not an expired one
// and not three months of invented empty history.
export function derivePeriodContaining(lastPaydayStr, cadence, todayStr) {
  if (!lastPaydayStr || !todayStr || cadence === 'manual') return null

  let payday = lastPaydayStr
  // Generous ceiling - weekly pay needs ~52 steps a year - but bounded so a
  // bad cadence value can never spin forever.
  for (let i = 0; i < 600; i += 1) {
    const period = derivePeriodFromPayday(payday, cadence)
    if (!period) return null
    if (compareDateStr(todayStr, period.endDate) <= 0) return period
    payday = nextPaydayAfter(payday, cadence)
    if (!payday) return null
  }
  return null
}

// The period to offer once the current one has finished.
//
// Walks payday-aligned periods forward, skipping any that would overlap the
// period just completed. That skip matters after a period was ABANDONED early:
// its stored end date no longer lines up with the pay cycle, so the naively
// derived period would overlap it and be rejected by the duplicate check.
//
// If ending early left a gap - the previous period is over but the next payday
// hasn't arrived - there is no aligned period containing today, and inventing
// one that hasn't started would be wrong. Instead we offer the remainder: the
// day after the old period through to the day before the next payday. That is
// exactly what the calendar looks like from where the user is standing.
//
// The gap always starts the day AFTER the previous period ends, never simply
// on `todayStr`. Those are the same date in the ordinary case - you come back
// the next morning - but they diverge the moment a period is abandoned, which
// truncates its end date to TODAY. Anchoring the gap to today there returned a
// period starting on a day the old one still occupies: an overlap this
// function exists to prevent, which the duplicate check then rejected, leaving
// the setup screen refusing dates it had pre-filled itself. Where the clamp
// closes the gap entirely, the aligned period below is the right answer and
// gets returned instead of a backwards one-day range.
export function deriveNextPeriod(previousPeriod, cadence, todayStr) {
  if (!previousPeriod || !todayStr || cadence === 'manual') return null

  // The earliest a new period may begin without overlapping the old one.
  const earliestStart = addDays(previousPeriod.endDate, 1)

  let payday = previousPeriod.startDate
  for (let i = 0; i < 600; i += 1) {
    const period = derivePeriodFromPayday(payday, cadence)
    if (!period) return null

    if (compareDateStr(period.startDate, previousPeriod.endDate) > 0) {
      const from = compareDateStr(todayStr, earliestStart) < 0 ? earliestStart : todayStr
      if (compareDateStr(from, period.startDate) < 0) {
        return { startDate: from, endDate: addDays(period.startDate, -1) }
      }
      if (compareDateStr(from, period.endDate) <= 0) return period
    }

    payday = nextPaydayAfter(payday, cadence)
    if (!payday) return null
  }
  return null
}
