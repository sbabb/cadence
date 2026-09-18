// The spend sheet's one rule about the text in its amount field:
//
//   AN EMPTY FIELD IS NOT AN AMOUNT.
//
// It reads like a triviality and it is not, because "" and "0" parse to the
// same number and mean opposite things. "0" is a claim about the day - I
// spent nothing - and the app records it, shows it with its own styling in
// the day list, and counts it as a day tracked. "" is the absence of a claim.
//
// Treating the two as one shipped a real bug. The sheet opens with the field
// focused, which opens the Android keyboard; the natural way to dismiss a
// keyboard you did not mean to summon is the checkmark key, and the checkmark
// key submits the sheet's form. One dismissed keyboard wrote a $0 entry for a
// day the user had not touched - which counted toward the report card's
// totals, and moved the limit on every day that followed.
//
// Returns null for "no amount here", so the caller has something it cannot
// accidentally do arithmetic with. A number - including 0 - means the user
// actually said something.
export function amountFromInput(raw) {
  if (typeof raw !== 'string') return null
  // The field only ever accepts digits, but parsing defensively means this
  // function answers the question correctly for any string, not just the
  // ones today's input happens to produce.
  const digits = raw.replace(/[^0-9]/g, '')
  if (digits === '') return null
  return parseInt(digits, 10)
}
