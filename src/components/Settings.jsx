import { useRef, useState } from 'react'
import { formatDisplayDate } from '../utils/dateUtils.js'
import { CADENCE_OPTIONS } from '../utils/cadence.js'
import { entriesOutsideRange } from '../utils/budgetEngine.js'
import { THEMES } from '../utils/themes.js'
import { parseBackup } from '../utils/backup.js'
import { exportBackup, readTextFile } from '../utils/fileTransfer.js'
import ConfirmDialog from './ConfirmDialog.jsx'

// Reached from the dashboard's header (PeriodPager's "SETTINGS" button).
// Five independent sections: editing the active period's amount/end date, the
// optional pay-cadence preference, the colour theme, backup, and abandoning
// the active period early. Each is self-contained - editing the period and
// abandoning it are mutually exclusive actions a user would take on separate
// visits, so there is no shared form state between them.
//
// The destructive one stays last, on its own, below everything you might
// actually have come here to do.
export default function Settings({
  period,
  cadence,
  theme,
  rawData,
  storageStatus,
  onRecheckStorage,
  onImportData,
  onUpdatePeriodDetails,
  onSetCadence,
  onSetTheme,
  onAbandonPeriod,
  onOpenFaq,
  onBack
}) {
  const [amountInput, setAmountInput] = useState(String(period.initialAmount))
  const [endDate, setEndDate] = useState(period.endDate)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [abandonConfirmOpen, setAbandonConfirmOpen] = useState(false)
  // Set to the pending {initialAmount, endDate} when saving would push logged
  // days outside the period, so the confirm dialog has something to apply
  // once the user says yes.
  const [hideConfirm, setHideConfirm] = useState(null)

  const endDateRef = useRef(null)
  const fileInputRef = useRef(null)

  // Backup state, kept apart from the period-editing state above: they are
  // different errands and an error from one has no business appearing under
  // the other.
  const [backupNote, setBackupNote] = useState('')
  const [backupError, setBackupError] = useState('')
  // The validated contents of a chosen file, held while the user confirms.
  const [pendingImport, setPendingImport] = useState(null)

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

    // Shrinking the end date past days that were already logged doesn't
    // delete them - they stay in storage and return if the range is widened -
    // but they disappear from every screen, which is not something to do to
    // someone without asking.
    const orphaned = entriesOutsideRange(period, period.startDate, endDate)
    if (orphaned.length > 0) {
      setHideConfirm({ initialAmount: amount, endDate, dates: orphaned })
      return
    }

    applyUpdate({ initialAmount: amount, endDate })
  }

  const applyUpdate = ({ initialAmount, endDate: newEndDate }) => {
    const result = onUpdatePeriodDetails({ initialAmount, endDate: newEndDate })
    if (result) {
      setError(result)
    } else {
      setSaved(true)
    }
  }

  const handleExport = async () => {
    setBackupError('')
    setBackupNote('')
    const result = await exportBackup(rawData)
    if (result === 'failed') {
      setBackupError('Could not write the backup file. Try again, or use a different browser.')
    } else if (result === 'shared') {
      setBackupNote('Backup sent.')
    } else if (result === 'downloaded') {
      setBackupNote('Backup saved to your downloads.')
    }
    // 'cancelled' says nothing: backing out of the share sheet is a choice,
    // not an error, and reporting it as one would be wrong.
  }

  const handleFileChosen = async (e) => {
    const file = e.target.files && e.target.files[0]
    // Cleared so that choosing the SAME file again still fires a change event
    // - otherwise a failed import can't be retried without picking a
    // different file first.
    e.target.value = ''
    if (!file) return
    setBackupError('')
    setBackupNote('')
    try {
      const parsed = parseBackup(await readTextFile(file))
      if (!parsed.ok) {
        setBackupError(parsed.error)
        return
      }
      setPendingImport(parsed)
    } catch {
      setBackupError('Could not read that file.')
    }
  }

  const handleImportConfirmed = () => {
    const pending = pendingImport
    setPendingImport(null)
    onImportData(pending.data)
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
        <h2 className="settings-section-title">BACKUP</h2>
        <p className="settings-section-hint">
          Everything you log lives on this device only - nothing is sent anywhere, and there is no account to
          sign back into. That is the trade for an app with no sign-up, and it means a backup file is the only
          way your history survives a new phone or a cleared browser.
        </p>
        <div className="backup-actions">
          <button type="button" className="backup-button" onClick={handleExport}>
            EXPORT BACKUP
          </button>
          <button type="button" className="backup-button" onClick={() => fileInputRef.current?.click()}>
            IMPORT BACKUP
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFileChosen}
          className="visually-hidden-input"
          tabIndex={-1}
          aria-hidden="true"
        />

        {backupError && <p className="error-text">{backupError}</p>}
        {backupNote && !backupError && <p className="settings-saved-text">{backupNote}</p>}

        {/* Whether the browser has agreed to keep this data out of its
            automatic cleanup. Worth saying plainly, because the answer is
            actionable: installing the app to the home screen is usually what
            flips it. */}
        {storageStatus === 'granted' && (
          <p className="storage-status storage-status-ok">
            ✓ This browser is keeping your data safe from automatic cleanup.
          </p>
        )}
        {storageStatus === 'denied' && (
          <p className="storage-status">
            This browser may clear your data if the device runs low on space. Installing Cadence to your home
            screen usually earns it protected status.{' '}
            <button type="button" className="storage-recheck" onClick={onRecheckStorage}>
              CHECK AGAIN
            </button>
          </p>
        )}
        {storageStatus === 'unsupported' && (
          <p className="storage-status">
            This browser can&apos;t protect app data from automatic cleanup. Export a backup now and then.
          </p>
        )}
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">QUESTIONS</h2>
        <p className="settings-section-hint">
          What the app does, where your data lives, whether it is safe to install, and what to do when
          something looks wrong. It is the same document as FAQ.md in the repository, and it works offline -
          which is the point, since the moment someone asks is usually the moment you are standing next to
          them rather than at a computer.
        </p>
        <button type="button" className="faq-link-button" onClick={onOpenFaq}>
          READ THE ANSWERS
        </button>
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">ABANDON CURRENT PERIOD</h2>
        <p className="settings-section-hint">
          Ends the current period today instead of on its scheduled end date and shows you its summary. Today
          still belongs to the period you are closing, so the next one begins tomorrow - Cadence will offer it
          then, the same way it would after any period ends.
        </p>
        <button type="button" className="abandon-period-button" onClick={() => setAbandonConfirmOpen(true)}>
          ABANDON CURRENT PERIOD
        </button>
      </section>

      <button className="cancel-button" onClick={onBack}>
        ‹ BACK TO DASHBOARD
      </button>

      {hideConfirm && (
        <ConfirmDialog
          message={
            `${hideConfirm.dates.length} logged ${hideConfirm.dates.length === 1 ? 'day' : 'days'} ` +
            `(${hideConfirm.dates.slice(0, 3).map(formatDisplayDate).join(', ')}` +
            `${hideConfirm.dates.length > 3 ? `, +${hideConfirm.dates.length - 3} more` : ''}) ` +
            'fall outside the new dates and will stop appearing. Nothing is deleted — widening the ' +
            'period again brings them back.'
          }
          confirmLabel="SAVE ANYWAY"
          cancelLabel="CANCEL"
          onConfirm={() => {
            const pending = hideConfirm
            setHideConfirm(null)
            applyUpdate(pending)
          }}
          onCancel={() => setHideConfirm(null)}
        />
      )}

      {pendingImport && (
        <ConfirmDialog
          message={
            `This backup holds ${pendingImport.summary.periods} ` +
            `${pendingImport.summary.periods === 1 ? 'period' : 'periods'} and ` +
            `${pendingImport.summary.loggedDays} logged ` +
            `${pendingImport.summary.loggedDays === 1 ? 'day' : 'days'}` +
            (pendingImport.summary.earliest
              ? `, ${formatDisplayDate(pendingImport.summary.earliest)} to ${formatDisplayDate(pendingImport.summary.latest)}`
              : '') +
            '. Importing REPLACES everything currently on this device, which cannot be undone.'
          }
          confirmLabel="REPLACE MY DATA"
          cancelLabel="CANCEL"
          danger
          onConfirm={handleImportConfirmed}
          onCancel={() => setPendingImport(null)}
        />
      )}

      {abandonConfirmOpen && (
        <ConfirmDialog
          message="Abandon the current period? It will end today and you'll see its summary. Today still counts toward it, so your next period starts tomorrow."
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
