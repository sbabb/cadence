// Date utilities for the budget habit tracker.
// All dates are represented as plain 'YYYY-MM-DD' strings ("date strings").
// Internally we anchor to UTC noon when doing arithmetic so DST shifts in the
// user's local timezone can never push a date across a day boundary.

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function pad2(n) {
  return String(n).padStart(2, '0')
}

// Today's date string in the user's LOCAL timezone (this is a daily habit
// app, so "today" must follow the user's local calendar day, not UTC).
export function todayStr() {
  const now = new Date()
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

// Parse a 'YYYY-MM-DD' string into a UTC Date anchored at noon (safe for
// day-level arithmetic; avoids DST edge cases entirely).
export function parseDateStr(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
}

// Compares two date strings. Works via plain string comparison since the
// format is zero-padded ISO (YYYY-MM-DD), which sorts lexicographically the
// same as chronologically.
export function compareDateStr(a, b) {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

export function addDays(dateStr, n) {
  const d = parseDateStr(dateStr)
  d.setUTCDate(d.getUTCDate() + n)
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}

// Inclusive day count between two date strings (from <= to). Returns 0 if
// `from` is after `to`.
export function daysBetweenInclusive(fromStr, toStr) {
  if (compareDateStr(fromStr, toStr) > 0) return 0
  const from = parseDateStr(fromStr)
  const to = parseDateStr(toStr)
  const diffMs = to.getTime() - from.getTime()
  return Math.round(diffMs / 86400000) + 1
}

// Short display form, e.g. "Aug 16".
export function formatDisplayDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${d}`
}

// Short display form with weekday, e.g. "Sun Aug 16".
export function formatDisplayDateWithDay(dateStr) {
  const dow = parseDateStr(dateStr).getUTCDay()
  return `${DAY_NAMES[dow]} ${formatDisplayDate(dateStr)}`
}

// Very compact numeric form, e.g. "8/16" - used where space is tight, such
// as a Trends chart bar's date-range label (two of these stacked, one for
// the period's start and one for its end).
export function formatShortDate(dateStr) {
  const [, m, d] = dateStr.split('-').map(Number)
  return `${m}/${d}`
}
