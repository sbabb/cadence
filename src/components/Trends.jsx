import { Fragment, useMemo } from 'react'
import { reconcilePeriod, summarizePeriod } from '../utils/budgetEngine.js'
import { formatDisplayDate, formatShortDate, daysBetweenInclusive } from '../utils/dateUtils.js'

// A simple long-term view of every stored period, one bar per period.
//
// It is also the history NAVIGATION now. Six months of biweekly periods is
// thirteen pages in the pager, and reaching the oldest meant twelve swipes;
// this screen already lays every period out as a discrete, dated, tappable
// object, so tapping a bar jumps there rather than adding a second screen
// about the past. Each
// bar's height is that period's total-spent-as-a-percentage-of-its-budget,
// capped visually at 100% of the chart column (the numeric percentage
// label above the bar carries the exact figure for anything that ran
// over, so the color+number pairing - never color alone - stays accurate
// even when a bar is clipped). Deliberately just a timeline beyond that
// one tap: no filtering, per the brief.
export default function Trends({ periods, today, onJumpToPeriod, onBack }) {
  const referenceYear = Number(today.slice(0, 4))

  const bars = useMemo(
    () =>
      periods.map((period, idx) => {
        const reconciled = reconcilePeriod(period, today)
        const summary = summarizePeriod(period, reconciled)
        const pct = summary.totalBudget > 0 ? (summary.totalSpent / summary.totalBudget) * 100 : 0
        const isOver = summary.totalSpent > summary.totalBudget
        const isAtLimit = !isOver && summary.totalSpent === summary.totalBudget && summary.totalBudget > 0
        // Days between the previous period ending and this one starting.
        // Periods are only ever created for time actually lived through, so a
        // gap is real: months where the app went unused. Drawing the columns
        // flush would silently compress that into a continuous history.
        const prev = idx > 0 ? periods[idx - 1] : null
        const gapDays = prev ? daysBetweenInclusive(prev.endDate, period.startDate) - 2 : 0

        return { period, idx, summary, pct, isOver, isAtLimit, gapDays }
      }),
    [periods, today]
  )

  return (
    <div className="screen trends-screen">
      <h1 className="screen-title">TRENDS</h1>
      <p className="trends-subtitle">
        Total spent vs. total budget, one bar per period. Tap a bar to open that period.
      </p>

      {bars.length === 0 ? (
        <p className="trends-empty">No periods tracked yet.</p>
      ) : (
        // Every period gets its own fixed-width column laid out in a single
        // horizontally-scrolling row (overflow-x: auto below), so the chart
        // scales the same way whether there are 2 periods or 50 - it never
        // squeezes columns to fit, it just grows wider and scrolls.
        <div className="trends-chart">
          {bars.map(({ period, idx, pct, isOver, isAtLimit, gapDays }) => {
            const barPct = Math.max(0, Math.min(100, pct))
            const barClass = isOver ? 'trend-bar-over' : isAtLimit ? 'trend-bar-atlimit' : 'trend-bar-under'
            const isCurrent = idx === periods.length - 1
            const range = `${formatDisplayDate(period.startDate)} - ${formatDisplayDate(period.endDate)}`
            return (
              <Fragment key={period.id}>
                {gapDays > 0 && (
                  <div className="trend-gap" aria-hidden="true">
                    <div className="trend-gap-rule" />
                    <div className="trend-gap-label">
                      {gapDays}d
                      <br />
                      untracked
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  className={`trend-column ${isCurrent ? 'trend-column-current' : ''}`}
                  title={range}
                  onClick={() => onJumpToPeriod(idx)}
                  aria-label={`Open period ${range}`}
                >
                  <div className="trend-bar-pct">{Math.round(pct)}%</div>
                  <div className="trend-bar-track">
                    <div className={`trend-bar ${barClass}`} style={{ height: `${barPct}%` }} />
                  </div>
                  <div className="trend-column-label">
                    <div>{formatShortDate(period.startDate, referenceYear)}</div>
                    <div>{formatShortDate(period.endDate, referenceYear)}</div>
                  </div>
                </button>
              </Fragment>
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
