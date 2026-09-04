import { useMemo, useRef } from 'react'
import { reconcilePeriod, buildPeriodSchedule } from '../utils/budgetEngine.js'
import { TrendsIcon, SettingsIcon } from './Icons.jsx'
import Dashboard from './Dashboard.jsx'
import PastPeriodView from './PastPeriodView.jsx'

// Horizontal finger movement (in px) required before a touch gesture counts
// as a deliberate swipe rather than an incidental tap or vertical scroll.
const SWIPE_THRESHOLD_PX = 50

// Every stored period is a full page. Swiping/tapping LEFT steps back in
// time (older periods); swiping/tapping RIGHT steps forward toward the
// present. The rightmost page (highest index) is always the current,
// still-in-progress period - `viewIndex` is owned by the parent (App.jsx)
// so it can snap back to that rightmost page whenever a new period starts.
export default function PeriodPager({
  periods,
  today,
  viewIndex,
  onViewIndexChange,
  onOpenTrends,
  onOpenSettings,
  activeTodayInfo,
  activeSchedule,
  activeDaysRemaining,
  activeCurrentRemaining,
  now,
  previousDayLimit,
  onLogForDate,
  homeNonce,
  onResetAll,
  onClearTodayLog,
  onTriggerSummary
}) {
  const activeIndex = periods.length - 1
  const isActivePeriod = viewIndex === activeIndex
  const period = periods[viewIndex]

  // Only ever recompute reconcile/schedule for a PAST period being viewed -
  // the active period's numbers are already computed live by useBudgetData
  // and passed straight through, so swiping back in time never touches or
  // recalculates anything about today's own in-progress period.
  const pastReconciled = useMemo(() => {
    if (isActivePeriod) return null
    return reconcilePeriod(period, today)
  }, [isActivePeriod, period, today])
  const pastSchedule = useMemo(() => {
    if (isActivePeriod || !pastReconciled) return null
    return buildPeriodSchedule(period, today, pastReconciled)
  }, [isActivePeriod, period, today, pastReconciled])

  const touchStartX = useRef(null)
  const touchStartY = useRef(null)

  const goPrevious = () => {
    if (viewIndex > 0) onViewIndexChange(viewIndex - 1)
  }
  const goNext = () => {
    if (viewIndex < periods.length - 1) onViewIndexChange(viewIndex + 1)
  }

  const handleTouchStart = (e) => {
    const t = e.touches[0]
    touchStartX.current = t.clientX
    touchStartY.current = t.clientY
  }
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return
    const t = e.changedTouches[0]
    const dx = t.clientX - touchStartX.current
    const dy = t.clientY - touchStartY.current
    touchStartX.current = null
    touchStartY.current = null
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy)) return
    // Swipe LEFT (finger moves toward the left edge) -> step back in time.
    // Swipe RIGHT -> step forward toward the current period.
    if (dx < 0) goPrevious()
    else goNext()
  }

  return (
    <div className="period-pager" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="pager-header">
        {/* Always visible, even with a single period, so the swipe/arrow
            navigation is discoverable from day one rather than only
            appearing once a second period exists. Both arrows naturally
            end up disabled when there's just one period, since viewIndex
            0 is simultaneously the first AND last page. */}
        <div className="pager-nav">
          <button
            type="button"
            className="pager-arrow"
            onClick={goPrevious}
            disabled={viewIndex === 0}
            aria-label="Previous period"
          >
            ‹
          </button>
          {/* Deliberately terse. "PERIOD 1 OF 1" is wider than the row can
              spare once TRENDS and SETTINGS are touch-sized, and letting it
              ellipsis away to "PERIOD 1 ..." was worse than shortening it
              honestly. Flanked by arrows, "1 / 1" is unambiguous. */}
          <span className="pager-indicator">
            {viewIndex + 1} / {periods.length}
          </span>
          <button
            type="button"
            className="pager-arrow"
            onClick={goNext}
            disabled={viewIndex === periods.length - 1}
            aria-label="Next period"
          >
            ›
          </button>
        </div>
        <div className="pager-header-actions">
          <button type="button" className="trends-button" onClick={onOpenTrends}>
            <TrendsIcon />
            TRENDS
          </button>
          <button type="button" className="settings-button" onClick={onOpenSettings}>
            <SettingsIcon />
            SETTINGS
          </button>
        </div>
      </div>

      {isActivePeriod ? (
        <Dashboard
          key={period.id}
          period={period}
          today={today}
          todayInfo={activeTodayInfo}
          schedule={activeSchedule}
          daysRemaining={activeDaysRemaining}
          currentRemaining={activeCurrentRemaining}
          now={now}
          previousDayLimit={previousDayLimit}
          onLogForDate={onLogForDate}
          homeNonce={homeNonce}
          onResetAll={onResetAll}
          onClearTodayLog={onClearTodayLog}
          onTriggerSummary={onTriggerSummary}
        />
      ) : (
        <PastPeriodView key={period.id} period={period} schedule={pastSchedule} reconciled={pastReconciled} />
      )}
    </div>
  )
}
