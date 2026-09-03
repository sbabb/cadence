import { useRef, useState } from 'react'
import { formatDisplayDate } from '../utils/dateUtils.js'
import { CADENCE_OPTIONS } from '../utils/cadence.js'
import ConfirmDialog from './ConfirmDialog.jsx'

// Reached from the dashboard's header (PeriodPager's "SETTINGS" button).
// Three independent sections: editing the active period's amount/end date,
// the optional pay-cadence preference, and abandoning the active period
// early. Each is self-contained - editing the period and abandoning it are
// mutually exclusive actions a user would take on separate visits, so there
// is no shared form state between them.
export default function Settings({ period, cadence, onUpdatePeriodDetails, onSetCadence, onAbandonPeriod, onBack }) {
  const [amountInput, setAmountInput] = useState(String(period.initialAmount))
  const [endDate, setEndDate] = useState(period.endDate)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [abandonConfirmOpen, setAbandonConfirmOpen] = useState(false)

  const endDateRef = useRef(null)

  // Same "PICK DATE" affordance pattern used by PeriodSetup - see that
  // component for why this exists instead of relying on the tiny native
  // calendar glyph alone.
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
    const digitsOnly = e.target.value.replace(/[^0-9]/g, '')
    setAmountInput(digitsOnly)
    setSaved(false)
  }

  const handleEndDateChange = (e) => {
    setEndDate(e.target.value)
    setSaved(false)
  }

  const handleSave = (e) => {
    e.preventDefault()
    setError('')
    setSaved(false)

    const amount = parseInt(amountInput, 10)
    if (!amountInput || Number.isNaN(amount) || amount <= 0) {
      setError('Enter a discretionary amount greater than $0.')
      return
    }
    if (!endDate) {
      setError('An end date is required.')
      return
    }

    const result = onUpdatePeriodDetails({ initialAmount: amount, endDate })
    if (result) {
      setError(result)
    } else {
      setSaved(true)
    }
  }

  const handleAbandonConfirmed = () => {
    setAbandonConfirmOpen(false)
    onAbandonPeriod()
  }

  return (
    <div className="screen settings-screen">
      <h1 className="screen-title">SETTINGS</h1>

      <section className="settings-section">
        <h2 className="settings-section-title">EDIT CURRENT PERIOD</h2>
        <p className="settings-section-hint">
          Started {formatDisplayDate(period.startDate)}. The start date can&apos;t be changed once a period is
          underway - only the amount and end date.
        </p>
        <form className="setup-form" onSubmit={handleSave}>
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
              />
            </div>
          </label>

          <div className="field">
            <span className="field-label">PAY PERIOD END DATE</span>
            <div className="date-input-row">
              <input ref={endDateRef} type="date" value={endDate} onChange={handleEndDateChange} />
              <button type="button" className="date-picker-button" onClick={() => openPicker(endDateRef)}>
                📅 PICK DATE
              </button>
            </div>
          </div>

          {error && <p className="error-text">{error}</p>}
          {saved && !error && <p className="settings-saved-text">Saved.</p>}

          <button type="submit" className="primary-button">
            SAVE
          </button>
        </form>
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">PAY CADENCE</h2>
        <p className="settings-section-hint">
          Used to work out your next period when this one ends. Changing it never alters the period you&apos;re in -
          and the dates always stay editable before you start the next one.
        </p>
        <div className="cadence-options">
          {CADENCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`cadence-option ${cadence === opt.value ? 'cadence-option-selected' : ''}`}
              onClick={() => onSetCadence(opt.value)}
            >
              <span className="cadence-option-label">{opt.label}</span>
              <span className="cadence-option-detail">{opt.detail}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">ABANDON CURRENT PERIOD</h2>
        <p className="settings-section-hint">
          Ends the current period today instead of on its scheduled end date, then walks through the usual period
          summary before setting up the next one.
        </p>
        <button type="button" className="abandon-period-button" onClick={() => setAbandonConfirmOpen(true)}>
          ABANDON CURRENT PERIOD
        </button>
      </section>

      <button className="cancel-button" onClick={onBack}>
        ‹ BACK TO DASHBOARD
      </button>

      {abandonConfirmOpen && (
        <ConfirmDialog
          message="Abandon the current period? It will end today, and you'll see its summary before setting up the next one."
          confirmLabel="ABANDON PERIOD"
          cancelLabel="CANCEL"
          danger
          onConfirm={handleAbandonConfirmed}
          onCancel={() => setAbandonConfirmOpen(false)}
        />
      )}
    </div>
  )
}
