import { useRef, useState } from 'react'
import { formatDisplayDate } from '../utils/dateUtils.js'
import { CADENCE_OPTIONS } from '../utils/cadence.js'
import { THEMES } from '../utils/themes.js'
import ConfirmDialog from './ConfirmDialog.jsx'

// Reached from the dashboard's header (PeriodPager's "SETTINGS" button).
// Four independent sections: editing the active period's amount/end date, the
// optional pay-cadence preference, the colour theme, and abandoning the active
// period early. Each is self-contained - editing the period and abandoning it
// are mutually exclusive actions a user would take on separate visits, so
// there is no shared form state between them.
//
// The destructive one stays last, on its own, below everything you might
// actually have come here to do.
export default function Settings({
  period,
  cadence,
  theme,
  onUpdatePeriodDetails,
  onSetCadence,
  onSetTheme,
  onAbandonPeriod,
  onBack
}) {
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
        <h2 className="settings-section-title">THEME</h2>
        <p className="settings-section-hint">
          Applies immediately and is remembered. The green/amber/red the spend bar mixes through comes from the
          theme too, so the bar always belongs to the palette around it.
        </p>
        <div className="theme-options">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`theme-option ${theme === t.id ? 'theme-option-selected' : ''}`}
              onClick={() => onSetTheme(t.id)}
              aria-pressed={theme === t.id}
            >
              <span className="theme-option-text">
                <span className="theme-option-label">{t.label}</span>
                <span className="theme-option-detail">{t.detail}</span>
              </span>
              {/* Drawn in the theme's OWN colours rather than the active
                  ones, so the row is a preview instead of a name you have to
                  select before you can see. The strip sits on that theme's
                  background for the same reason - Nord's green against Nord's
                  slate is a different proposition from Nord's green against
                  white. */}
              <span
                className="theme-swatches"
                style={{ background: t.tokens.bg, borderColor: t.tokens.border }}
                aria-hidden="true"
              >
                {['green', 'amber', 'red', 'blue', 'purple'].map((key) => (
                  <span key={key} className="theme-swatch" style={{ background: t.tokens[key] }} />
                ))}
              </span>
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
