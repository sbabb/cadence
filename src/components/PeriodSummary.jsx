import { formatDisplayDateWithDay } from '../utils/dateUtils.js'
import { formatMoney } from '../utils/format.js'
import { summarizePeriod } from '../utils/budgetEngine.js'

// Shown two ways: (1) automatically, once, right after a period's end date
// passes and before the new-period prompt - the natural end-of-period
// recap; (2) on demand via the "DEV: TRIGGER PERIOD SUMMARY" button, which
// previews this same screen for the still-in-progress active period so the
// UI can be checked without waiting for a period to actually end
// (`devForced`). Either way the numbers come from the same pure
// summarizePeriod() helper - factual, no guilt-tripping language.
export default function PeriodSummary({ period, reconciled, onContinue, devForced }) {
  const summary = summarizePeriod(period, reconciled)
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
      <h1 className="screen-title">{devForced ? 'PERIOD SUMMARY (PREVIEW)' : 'PERIOD SUMMARY'}</h1>
      <p className="summary-range">
        {formatDisplayDateWithDay(period.startDate)} -&gt; {formatDisplayDateWithDay(period.endDate)}
      </p>

      <div className="summary-stat-list">
        <div className="summary-stat-row">
          <span className="summary-stat-label">TOTAL SPENT</span>
          <span className="summary-stat-value">{formatMoney(totalSpent)}</span>
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

      <button className="primary-button" onClick={onContinue}>
        {devForced ? 'CLOSE' : 'CONTINUE'}
      </button>
    </div>
  )
}
