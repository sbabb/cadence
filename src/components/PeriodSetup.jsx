import { useId, useRef, useState } from 'react'
import { compareDateStr, formatDisplayDate, daysBetweenInclusive } from '../utils/dateUtils.js'
import { findOverlappingPeriod } from '../utils/budgetEngine.js'

// Pay periods are entirely user-defined: there is no fixed 1st-15th /
// 16th-end-of-month split. The user manually picks a start date, an end
// date, and a discretionary amount every time a period is set up - this
// screen never pre-fills or guesses those dates on their behalf (unless a
// pay cadence is configured in Settings, in which case `initialDates`
// pre-fills the fields as a starting suggestion the user can still freely
// override - see App.jsx for how that's computed).
export default function PeriodSetup({
  isNewPeriod,
  today,
  periods,
  initialDates,
  initialAmount,
  onStart
}) {
  // With a cadence configured, everything arrives pre-filled - dates derived
  // from the pay rule, amount carried over from last period - so the recurring
  // case is a confirmation rather than a form. All of it stays editable:
  // payday is precisely when the amount might have changed.
  const [amountInput, setAmountInput] = useState(initialAmount ? String(initialAmount) : '')
  const [startDate, setStartDate] = useState(initialDates ? initialDates.startDate : '')
  const [endDate, setEndDate] = useState(initialDates ? initialDates.endDate : '')
  const [error, setError] = useState('')

  const startDateRef = useRef(null)
  const endDateRef = useRef(null)

  // The visible caption is the date field's <label>, tied to it by id, so a
  // screen reader announces "Pay period start date" rather than just "date".
  // Not the whole row wrapped in a <label>: that would fold PICK DATE's text
  // into the field's name as well.
  const startDateId = useId()
  const endDateId = useId()

  // Native date inputs render their calendar affordance as a tiny icon
  // that's easy to miss, especially on mobile. Give each field an explicit
  // "PICK DATE" button that programmatically opens the same native picker
  // (showPicker()), so it's obvious at a glance that the field is tappable.
  // Not every browser supports showPicker() yet - fall back to just
  // focusing the field (which still lets the user open/type the date)
  // rather than throwing.
  const openPicker = (ref) => {
    const el = ref.current
    if (!el) return
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker()
        return
      } catch {
        // fall through to focus fallback below
      }
    }
    el.focus()
  }

  const handleAmountChange = (e) => {
    const raw = e.target.value
    // Allow the field to be cleared/typed into freely, but strip anything
    // that isn't a digit so only whole dollars can ever be entered.
    const digitsOnly = raw.replace(/[^0-9]/g, '')
    setAmountInput(digitsOnly)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    const amount = parseInt(amountInput, 10)
    if (!amountInput || Number.isNaN(amount) || amount <= 0) {
      setError('Enter a discretionary amount greater than $0.')
      return
    }
    if (!startDate || !endDate) {
      setError('Both a start date and an end date are required.')
      return
    }
    // A single-day period is legitimate, not a typo. The engine handles one
    // day without dividing by zero, and the cadence derivation genuinely
    // produces one: abandon a weekly period the day before payday and the
    // catch-up remainder offered is exactly one day long. Insisting the end
    // date be strictly LATER rejected dates the app had pre-filled itself.
    if (compareDateStr(startDate, endDate) > 0) {
      setError('End date cannot be before start date.')
      return
    }
    // A period must contain today. Scheduling one to begin later sounds
    // harmless but quietly breaks the app's central assumption - the dial
    // would compute a daily limit for a period that hasn't started, and the
    // day list would have no "today" row at all. Cadence-derived periods
    // always contain today by construction, so this only ever catches
    // hand-entered dates.
    if (today && compareDateStr(startDate, today) > 0) {
      setError('A period cannot start in the future.')
      return
    }
    if (today && compareDateStr(endDate, today) < 0) {
      setError('That period has already ended. Pick an end date of today or later.')
      return
    }
    if (findOverlappingPeriod(periods, startDate, endDate)) {
      setError('A period already exists for these dates.')
      return
    }

    onStart({ initialAmount: amount, startDate, endDate })
  }

  // `<=`, because one day is a valid period - see handleSubmit.
  const datesValid = startDate && endDate && compareDateStr(startDate, endDate) <= 0
  const periodLength = datesValid ? daysBetweenInclusive(startDate, endDate) : null

  return (
    <div className="screen setup-screen">
      {isNewPeriod ? (
        <>
          <p className="setup-message">Previous pay period ended.</p>
          <h1 className="screen-title">NEW PERIOD SETUP</h1>
        </>
      ) : (
        <h1 className="screen-title">PERIOD SETUP</h1>
      )}

      <form className="setup-form" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field-label">DISCRETIONARY AMOUNT ($, WHOLE DOLLARS)</span>
          <div className="amount-input-row">
            <span className="dollar-sign">$</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="0"
              value={amountInput}
              onChange={handleAmountChange}
              autoFocus
            />
          </div>
        </label>

        <div className="field">
          <label className="field-label" htmlFor={startDateId}>PAY PERIOD START DATE</label>
          <div className="date-input-row">
            <input
              id={startDateId}
              ref={startDateRef}
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <button
              type="button"
              className="date-picker-button"
              onClick={() => openPicker(startDateRef)}
              aria-label="Pick date: pay period start date"
            >
              📅 PICK DATE
            </button>
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor={endDateId}>PAY PERIOD END DATE</label>
          <div className="date-input-row">
            <input
              id={endDateId}
              ref={endDateRef}
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            <button
              type="button"
              className="date-picker-button"
              onClick={() => openPicker(endDateRef)}
              aria-label="Pick date: pay period end date"
            >
              📅 PICK DATE
            </button>
          </div>
        </div>

        {datesValid && (
          <p className="setup-hint">
            {formatDisplayDate(startDate)} -&gt; {formatDisplayDate(endDate)} ({periodLength}{' '}
            {periodLength === 1 ? 'day' : 'days'})
          </p>
        )}

        {error && <p className="error-text">{error}</p>}

        <button type="submit" className="primary-button">
          START PERIOD
        </button>
      </form>
    </div>
  )
}
