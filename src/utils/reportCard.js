// What a period's report card says.
//
// The end-of-period recap has always existed, but it was shown exactly once
// - in the moment a period closed - and then it was gone. This module is that
// same recap turned into something you can go back and look at, for any
// period, and save as an image.
//
// It is pure and returns a plain content model: the numbered rows, the verdict
// line and the filename. Two things render it - the React screen and the
// canvas that produces the image - and they must never disagree about what the
// period actually did, so neither of them is allowed to decide any of it.

import { formatMoney } from './format.js'
import { formatDisplayDateWithDay } from './dateUtils.js'
import { summarizePeriod } from './budgetEngine.js'

// A day nobody logged did not have $0 spent - it has no figure at all.
// Printing $0 under a headline that says NO DAYS TRACKED contradicts it, and
// fabricating a zero is the one thing this app has never done anywhere else.
const NO_FIGURE = '—'

// The verdict line: what the period's remaining budget MEANS, in the words
// the recap has always used.
export function assessmentFor(summary) {
  if (summary.daysTracked === 0) {
    return { text: 'NO DAYS TRACKED THIS PERIOD', tone: 'neutral' }
  }
  if (summary.remaining > 0) {
    return { text: `UNDER BUDGET BY ${formatMoney(summary.remaining)}`, tone: 'good' }
  }
  if (summary.remaining === 0) {
    return { text: 'EXACTLY ON BUDGET', tone: 'neutral' }
  }
  return { text: `OVER BUDGET BY ${formatMoney(Math.abs(summary.remaining))}`, tone: 'over' }
}

// Saved images pile up in a downloads folder, so the name has to say which
// period it is without being opened. The START date does that; the date the
// file happened to be saved does not.
export function reportCardFilename(period) {
  return `cadence-report-${period.startDate}.png`
}

export function buildReportCard(period, reconciled) {
  const summary = summarizePeriod(period, reconciled)
  const tracked = summary.daysTracked > 0

  return {
    title: 'PERIOD REPORT',
    range: `${formatDisplayDateWithDay(period.startDate)} -> ${formatDisplayDateWithDay(period.endDate)}`,
    rows: [
      { label: 'TOTAL SPENT', value: tracked ? formatMoney(summary.totalSpent) : NO_FIGURE },
      { label: 'TOTAL BUDGET', value: formatMoney(summary.totalBudget) },
      { label: 'DAYS TRACKED', value: String(summary.daysTracked) },
      { label: 'DAYS OVER LIMIT', value: String(summary.daysOver) },
      { label: 'DAYS UNDER LIMIT', value: String(summary.daysUnder) },
      { label: 'DAYS AT LIMIT', value: String(summary.daysAtLimit) },
      { label: 'REMAINING AT END', value: formatMoney(summary.remaining) }
    ],
    assessment: assessmentFor(summary),
    // The image carries no app around it, so it has to say what it is.
    footer: 'CADENCE',
    filename: reportCardFilename(period),
    summary
  }
}
