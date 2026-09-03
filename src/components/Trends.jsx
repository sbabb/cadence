import { useMemo } from 'react'
import { reconcilePeriod, summarizePeriod } from '../utils/budgetEngine.js'
import { formatDisplayDate, formatShortDate } from '../utils/dateUtils.js'

// A simple long-term view of every stored period, one bar per period. Each
// bar's height is that period's total-spent-as-a-percentage-of-its-budget,
// capped visually at 100% of the chart column (the numeric percentage
// label above the bar carries the exact figure for anything that ran
// over, so the color+number pairing - never color alone - stays accurate
// even when a bar is clipped). Deliberately just a timeline: no
// interactivity, no filtering, per the brief.
export default function Trends({ periods, today, onBack }) {
  const bars = useMemo(
    () =>
      periods.map((period, idx) => {
        const reconciled = reconcilePeriod(period, today)
        const summary = summarizePeriod(period, reconciled)
        const pct = summary.totalBudget > 0 ? (summary.totalSpent / summary.totalBudget) * 100 : 0
        const isOver = summary.totalSpent > summary.totalBudget
        const isAtLimit = !isOver && summary.totalSpent === summary.totalBudget && summary.totalBudget > 0
        return { period, idx, summary, pct, isOver, isAtLimit }
      }),
    [periods, today]
  )

  return (
    <div className="screen trends-screen">
      <h1 className="screen-title">TRENDS</h1>
      <p className="trends-subtitle">Total spent vs. total budget, one bar per period.</p>

      {bars.length === 0 ? (
        <p className="trends-empty">No periods tracked yet.</p>
      ) : (
        // Every period gets its own fixed-width column laid out in a single
        // horizontally-scrolling row (overflow-x: auto below), so the chart
        // scales the same way whether there are 2 periods or 50 - it never
        // squeezes columns to fit, it just grows wider and scrolls.
        <div className="trends-chart">
          {bars.map(({ period, pct, isOver, isAtLimit }) => {
            const barPct = Math.max(0, Math.min(100, pct))
            const barClass = isOver ? 'trend-bar-over' : isAtLimit ? 'trend-bar-atlimit' : 'trend-bar-under'
            return (
              <div
                className="trend-column"
                key={period.id}
                title={`${formatDisplayDate(period.startDate)} - ${formatDisplayDate(period.endDate)}`}
              >
                <div className="trend-bar-pct">{Math.round(pct)}%</div>
                <div className="trend-bar-track">
                  <div className={`trend-bar ${barClass}`} style={{ height: `${barPct}%` }} />
                </div>
                <div className="trend-column-label">
                  <div>{formatShortDate(period.startDate)}</div>
                  <div>{formatShortDate(period.endDate)}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="trends-legend">
        <span className="trends-legend-item"><span className="trends-legend-swatch trend-bar-under" /> UNDER BUDGET</span>
        <span className="trends-legend-item"><span className="trends-legend-swatch trend-bar-atlimit" /> ON BUDGET</span>
        <span className="trends-legend-item"><span className="trends-legend-swatch trend-bar-over" /> OVER BUDGET</span>
      </div>

      <button className="cancel-button" onClick={onBack}>
        ‹ BACK TO DASHBOARD
      </button>
    </div>
  )
}
