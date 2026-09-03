// Shared whole-dollar money formatting used across every screen (dashboard
// stats, day list, log-spend sheet, period summary, trend chart). Keeping
// this in one place means the "$" / "-$" / rounding rules can only ever
// mean one thing app-wide.
export function formatMoney(n) {
  if (n === null || n === undefined) return '--'
  const rounded = Math.round(n)
  return rounded < 0 ? `-$${Math.abs(rounded)}` : `$${rounded}`
}
