// Shared whole-dollar money formatting used across every screen (dashboard
// stats, day list, log-spend sheet, period summary, trend chart). Keeping
// this in one place means the "$" / "-$" / rounding rules can only ever
// mean one thing app-wide.
// Grouped with separators: at 38px in the hero figure, "$2400" and "$24000"
// take a beat to tell apart, and a mistyped amount can put eight digits up
// there. Whole dollars only, so there is never a decimal part to worry about.
// en-US is pinned deliberately rather than following the device - the "$" is
// hardcoded everywhere, so borrowing another locale's grouping would produce
// a currency that exists nowhere.
export function formatMoney(n) {
  if (n === null || n === undefined) return '--'
  const rounded = Math.round(n)
  const grouped = Math.abs(rounded).toLocaleString('en-US')
  return rounded < 0 ? `-$${grouped}` : `$${grouped}`
}
