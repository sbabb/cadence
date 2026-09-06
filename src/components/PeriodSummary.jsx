import { useState } from 'react'
import { formatDisplayDateWithDay } from '../utils/dateUtils.js'
import { formatMoney } from '../utils/format.js'
import { summarizePeriod } from '../utils/budgetEngine.js'
import { exportBackup } from '../utils/fileTransfer.js'

// Shown once, automatically, right after a period's end date passes and
// before the new-period prompt - the natural end-of-period recap. The numbers
// come from the pure summarizePeriod() helper: factual, no guilt-tripping
// language.
export default function PeriodSummary({ period, reconciled, rawData, onContinue }) {
  const summary = summarizePeriod(period, reconciled)
  const [backupNote, setBackupNote] = useState('')

  // Offered here because this is the one moment the app knows something has
  // just been completed - a period closing is the natural time to take a
  // copy, and it is the only prompt of its kind in the app. Stated as a fact
  // about how the app stores things, not as a warning, and skipping it costs
  // nothing but a tap on CONTINUE.
  const handleExport = async () => {
    const result = await exportBackup(rawData)
    if (result === 'failed') setBackupNote('Could not write the backup file.')
    else if (result === 'shared') setBackupNote('Backup sent.')
    else if (result === 'downloaded') setBackupNote('Backup saved to your downloads.')
  }
  const { totalSpent, totalBudget, daysTracked, daysOver, daysUnder, daysAtLimit, remaining } = summary

  let assessment
  let assessmentClass
  if (daysTracked === 0) {
    assessment = 'NO DAYS TRACKED THIS PERIOD'
    assessmentClass = 'assessment-neutral'
  } else if (remaining > 0) {
    assessment = `UNDER BUDGET BY ${formatMoney(remaining)}`
    assessmentClass = 'assessment-good'
  } else if (remaining === 0) {
    assessment = 'EXACTLY ON BUDGET'
    assessmentClass = 'assessment-neutral'
  } else {
    assessment = `OVER BUDGET BY ${formatMoney(Math.abs(remaining))}`
    assessmentClass = 'assessment-over'
  }

  return (
    <div className="screen summary-screen">
      <h1 className="screen-title">PERIOD SUMMARY</h1>
      <p className="summary-range">
        {formatDisplayDateWithDay(period.startDate)} -&gt; {formatDisplayDateWithDay(period.endDate)}
      </p>

      <div className="summary-stat-list">
        <div className="summary-stat-row">
          <span className="summary-stat-label">TOTAL SPENT</span>
          {/* A period nobody logged did not have $0 spent - it has no figure
              at all. Printing $0 under a headline that says NO DAYS TRACKED
              contradicts it, and fabricating a zero is the one thing this
              app has never done anywhere else. */}
          <span className="summary-stat-value">{daysTracked === 0 ? '—' : formatMoney(totalSpent)}</span>
        </div>
        <div className="summary-stat-row">
          <span className="summary-stat-label">TOTAL BUDGET</span>
          <span className="summary-stat-value">{formatMoney(totalBudget)}</span>
        </div>
        <div className="summary-stat-row">
          <span className="summary-stat-label">DAYS OVER LIMIT</span>
          <span className="summary-stat-value">{daysOver}</span>
        </div>
        <div className="summary-stat-row">
          <span className="summary-stat-label">DAYS UNDER LIMIT</span>
          <span className="summary-stat-value">{daysUnder}</span>
        </div>
        <div className="summary-stat-row">
          <span className="summary-stat-label">DAYS AT LIMIT</span>
          <span className="summary-stat-value">{daysAtLimit}</span>
        </div>
        <div className="summary-stat-row">
          <span className="summary-stat-label">REMAINING AT END</span>
          <span className="summary-stat-value">{formatMoney(remaining)}</span>
        </div>
      </div>

      <div className={`summary-assessment ${assessmentClass}`}>{assessment}</div>

      <div className="summary-backup">
        <p className="summary-backup-hint">
          Your history lives on this device only. A good moment to keep a copy.
        </p>
        <button type="button" className="backup-button" onClick={handleExport}>
          EXPORT BACKUP
        </button>
        {backupNote && <p className="settings-saved-text">{backupNote}</p>}
      </div>

      <button className="primary-button" onClick={onContinue}>
        CONTINUE
      </button>
    </div>
  )
}
