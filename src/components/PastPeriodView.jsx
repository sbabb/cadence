import { formatDisplayDateWithDay } from '../utils/dateUtils.js'
import { formatMoney } from '../utils/format.js'
import { summarizePeriod } from '../utils/budgetEngine.js'
import DayList from './DayList.jsx'

// A completed, historical period viewed by swiping left in the pager.
// Entirely read-only - no today-tile, no edit-total link, no dev tools,
// and DayList renders with `editable={false}` so tapping a row does
// nothing. Completed periods are a permanent record, not something you
// rewrite by swiping back to them.
export default function PastPeriodView({ period, schedule, reconciled, onOpenReportCard }) {
  const summary = summarizePeriod(period, reconciled)

  return (
    <div className="screen past-period-screen">
      <div className="period-range">
        {formatDisplayDateWithDay(period.startDate)} -&gt; {formatDisplayDateWithDay(period.endDate)}
      </div>
      <div className="past-period-badge">PERIOD COMPLETED</div>

      <div className="stat-grid">
        <div className="stat-box">
          <div className="stat-label">TOTAL SPENT</div>
          <div className="stat-value">{formatMoney(summary.totalSpent)}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">TOTAL BUDGET</div>
          <div className="stat-value">{formatMoney(summary.totalBudget)}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">REMAINING AT END</div>
          <div className={`stat-value ${summary.remaining < 0 ? 'negative' : ''}`}>
            {formatMoney(summary.remaining)}
          </div>
        </div>
      </div>

      <DayList schedule={schedule} editable={false} onOpenReportCard={onOpenReportCard} />
    </div>
  )
}
