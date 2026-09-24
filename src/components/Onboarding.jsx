import { useRef, useState } from 'react'
import { compareDateStr, formatDisplayDate, daysBetweenInclusive } from '../utils/dateUtils.js'
import { CADENCE_OPTIONS, DEFAULT_CADENCE, derivePeriodContaining } from '../utils/cadence.js'

// First run only. Asks three things the user actually knows off the top of
// their head, rather than three abstract ones:
//
//   when were you last paid / how often / how much can you spend
//
// and derives the pay period from those. The previous version asked for a
// start date, an end date and an amount, which is the same information
// restated as a puzzle.
//
// Manual stays available as a fifth cadence option ("something else"), because
// irregular and freelance income is real and user-defined periods were this
// app's founding principle - the cadence just makes the common case one
// question shorter instead of replacing the general one.
export default function Onboarding({ today, onComplete }) {
  const [lastPaid, setLastPaid] = useState('')
  const [cadence, setCadence] = useState(DEFAULT_CADENCE)
  const [amountInput, setAmountInput] = useState('')
  const [manualEnd, setManualEnd] = useState('')
  const [error, setError] = useState('')

  const lastPaidRef = useRef(null)
  const manualEndRef = useRef(null)

  const openPicker = (ref) => {
    const el = ref.current
    if (!el) return
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker()
        return
      } catch {
        // fall through to focus
      }
    }
    el.focus()
  }

  const handleAmountChange = (e) => {
    setAmountInput(e.target.value.replace(/[^0-9]/g, ''))
  }

  const isManual = cadence === 'manual'

  // Live preview of what they'll actually get, so the derived dates are
  // visible before committing rather than appearing as a surprise afterwards.
  const previewPeriod =
    !isManual && lastPaid && compareDateStr(lastPaid, today) <= 0
      ? derivePeriodContaining(lastPaid, cadence, today)
      : isManual && lastPaid && manualEnd && compareDateStr(lastPaid, manualEnd) <= 0
        ? { startDate: lastPaid, endDate: manualEnd }
        : null

  const previewDays = previewPeriod ? daysBetweenInclusive(previewPeriod.startDate, previewPeriod.endDate) : null

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    const amount = parseInt(amountInput, 10)
    if (!amountInput || Number.isNaN(amount) || amount <= 0) {
      setError('Enter an amount greater than $0.')
      return
    }
    if (!lastPaid) {
      setError(isManual ? 'A start date is required.' : 'Enter the date you were last paid.')
      return
    }

    // "When were you last paid" gets misread as "when are you next paid"
    // often enough to be worth catching by name rather than quietly deriving
    // a period that hasn't started.
    if (compareDateStr(lastPaid, today) > 0) {
      setError(
        isManual
          ? 'A period cannot start in the future.'
          : "That date is in the future. Enter the last payday you actually received, not your next one."
      )
      return
    }

    if (isManual) {
      if (!manualEnd) {
        setError('An end date is required.')
        return
      }
      // One day is a valid period - see the note in PeriodSetup.jsx.
      if (compareDateStr(lastPaid, manualEnd) > 0) {
        setError('End date cannot be before start date.')
        return
      }
      if (compareDateStr(manualEnd, today) < 0) {
        setError('That period has already ended. Pick an end date of today or later.')
        return
      }
      onComplete({
        initialAmount: amount,
        startDate: lastPaid,
        endDate: manualEnd,
        cadence
      })
      return
    }

    const period = derivePeriodContaining(lastPaid, cadence, today)
    if (!period) {
      setError('Could not work out a pay period from that date. Try "something else" and set the dates yourself.')
      return
    }

    onComplete({
      initialAmount: amount,
      startDate: period.startDate,
      endDate: period.endDate,
      cadence
    })
  }

  return (
    <div className="screen onboarding-screen">
      <h1 className="screen-title">SET UP CADENCE</h1>
      <p className="onboarding-intro">Three questions and you&apos;re tracking.</p>

      {/* noValidate: the date field keeps its `max` so the native picker won't
          offer future dates, but browser-native validation bubbles are left
          switched off - they're unstyled, they'd look wrong against this
          typeface, and they'd pre-empt the specific explanation below about
          having entered the NEXT payday rather than the last one. */}
      <form className="setup-form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <span className="field-label">
            {isManual ? '1 — WHEN DOES THIS PERIOD START?' : '1 — WHEN WERE YOU LAST PAID?'}
          </span>
          <div className="date-input-row">
            <input
              ref={lastPaidRef}
              type="date"
              max={today}
              value={lastPaid}
              onChange={(e) => setLastPaid(e.target.value)}
            />
            <button type="button" className="date-picker-button" onClick={() => openPicker(lastPaidRef)}>
              PICK DATE
            </button>
          </div>
          {!isManual && (
            <span className="field-hint">The payday you already received, not your next one.</span>
          )}
        </div>

        <div className="field">
          <span className="field-label">2 — HOW OFTEN ARE YOU PAID?</span>
          <div className="cadence-options">
            {CADENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`cadence-option ${cadence === opt.value ? 'cadence-option-selected' : ''}`}
                onClick={() => setCadence(opt.value)}
              >
                <span className="cadence-option-label">{opt.label}</span>
                <span className="cadence-option-detail">{opt.detail}</span>
              </button>
            ))}
          </div>
        </div>

        {isManual && (
          <div className="field">
            <span className="field-label">WHEN DOES IT END?</span>
            <div className="date-input-row">
              <input
                ref={manualEndRef}
                type="date"
                value={manualEnd}
                onChange={(e) => setManualEnd(e.target.value)}
              />
              <button type="button" className="date-picker-button" onClick={() => openPicker(manualEndRef)}>
                PICK DATE
              </button>
            </div>
          </div>
        )}

        <label className="field">
          <span className="field-label">3 — HOW MUCH CAN YOU SPEND THIS PERIOD?</span>
          <div className="amount-input-row">
            <span className="dollar-sign">$</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="0"
              value={amountInput}
              onChange={handleAmountChange}
            />
          </div>
          <span className="field-hint">Discretionary money only - after rent, bills and savings.</span>
        </label>

        {previewPeriod && (
          <p className="setup-hint">
            This period: {formatDisplayDate(previewPeriod.startDate)} -&gt;{' '}
            {formatDisplayDate(previewPeriod.endDate)} ({previewDays} {previewDays === 1 ? 'day' : 'days'})
          </p>
        )}

        {error && <p className="error-text">{error}</p>}

        <button type="submit" className="primary-button">
          START TRACKING
        </button>
      </form>
    </div>
  )
}
