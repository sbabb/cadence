import { useEffect, useMemo, useState } from 'react'
import { formatDisplayDate, formatDisplayDateWithDay, formatTimeRemaining } from '../utils/dateUtils.js'
import { formatMoney } from '../utils/format.js'
import { limitStat } from '../utils/limitStat.js'
import DayList from './DayList.jsx'
import SpendBar from './SpendBar.jsx'

// The ACTIVE period's view - the only page in the swipeable pager where
// anything is editable. Historical periods render through PastPeriodView
// instead, which is read-only.
//
// The bar follows a SELECTED day rather than being hardwired to today. It
// starts on today; tapping any past row moves it there so you can look at that
// day, and tapping that row's SPENT figure opens its sheet.
export default function Dashboard({
  period,
  today,
  todayInfo,
  schedule,
  daysRemaining,
  currentRemaining,
  now,
  previousDayLimit,
  onLogForDate,
  homeNonce
}) {
  const [selectedDate, setSelectedDate] = useState(today)
  const [lastDayNoteOpen, setLastDayNoteOpen] = useState(false)

  // Snap back to today if the day rolls over while the app is open, or if the
  // period changes underneath us - a stale selection would otherwise point at
  // a date that isn't in the list any more.
  useEffect(() => {
    setSelectedDate(today)
  }, [today, period.id])

  // Tapping "> CADENCE" in the header brings you home, which includes putting
  // the bar back on today rather than leaving it parked on whichever day you
  // were inspecting.
  useEffect(() => {
    if (homeNonce === undefined) return
    setSelectedDate(today)
    setLastDayNoteOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeNonce])

  const selectedRow = schedule.find((row) => row.date === selectedDate) || null
  const isTodaySelected = selectedDate === today

  const selectedSpent = selectedRow && selectedRow.logged ? selectedRow.amount : 0
  // A logged past day carries the limit that applied when it was logged, which
  // is the honest number to judge it against. An unlogged day falls back to the
  // current live limit, which buildPeriodSchedule already supplies.
  const selectedLimit = selectedRow && selectedRow.dailyLimit !== null ? selectedRow.dailyLimit : 0
  const selectedLogged = Boolean(selectedRow && selectedRow.logged)

  const todayLimit = todayInfo ? todayInfo.dailyLimit : null

  const isLastDay = Boolean(todayInfo) && today === period.endDate
  const todaySpent = todayInfo && todayInfo.logged ? todayInfo.amount : 0

  // The figure in the DAILY LIMIT TODAY box, the note under it and whether the
  // limit moved since yesterday - all one decision, and it lives in
  // src/utils/limitStat.js where a script can check it.
  const dailyLimit = useMemo(
    () =>
      limitStat({
        isLastDay,
        todayLimit,
        baselineDailyLimit: todayInfo ? todayInfo.baselineDailyLimit : null,
        todaySpent,
        previousDayLimit
      }),
    [isLastDay, todayLimit, todayInfo, todaySpent, previousDayLimit]
  )

  // The REMAINING figure states a quantity; this states what the quantity
  // MEANS, which is the thing you actually want at a glance.
  const remainingVerdict =
    currentRemaining === null
      ? null
      : currentRemaining < 0
        ? { word: 'over budget', tone: 'over' }
        : currentRemaining === 0
          ? { word: 'on budget', tone: 'even' }
          : { word: 'under budget', tone: 'under' }

  const isOverSelected = selectedLimit > 0 && selectedSpent > selectedLimit

  // The consequence of going over is the genuinely actionable fact, and it
  // isn't visible anywhere else on this screen: the overspend doesn't vanish,
  // it shrinks the days that follow. Only meaningful for TODAY - "tomorrow"
  // says nothing useful while you're inspecting a day from last week - and
  // only when there's actually a following day left in the period.
  const tomorrowLimit = useMemo(() => {
    if (!isTodaySelected || !isOverSelected || !todayInfo || daysRemaining <= 1) return null
    // The engine already computes this - it is the same number the day list
    // now prints in the LIMIT column of every remaining day, and the two must
    // agree or the sentence contradicts the table directly beneath it.
    const next = todayInfo.forwardDailyLimit
    // Going over doesn't always visibly cost you tomorrow: the divisor shrinks
    // by a day at the same time the budget does, so a modest overspend against
    // a large remaining budget can land on the same whole-dollar figure.
    // Saying "drops to $7" while today's limit is also $7 would be worse than
    // saying nothing, so the line only appears when there's a real reduction.
    return next < selectedLimit ? next : null
  }, [isTodaySelected, isOverSelected, todayInfo, daysRemaining, selectedLimit])

  // Looking at a day and editing it are separate now. Selecting moves the bar;
  // the SPENT figure opens the sheet. Editing still selects first, so the bar
  // is already showing the right day when the sheet closes.
  const handleEditDay = (date) => {
    setSelectedDate(date)
    onLogForDate(date)
  }

  return (
    <div className="screen dashboard-screen">
      <div className="period-range">
        {formatDisplayDateWithDay(period.startDate)} -&gt; {formatDisplayDateWithDay(period.endDate)}
      </div>

      <div className="bar-section">
        <SpendBar
          spent={selectedSpent}
          limit={selectedLimit}
          logged={selectedLogged}
          dateLabel={isTodaySelected ? null : formatDisplayDateWithDay(selectedDate)}
          onTap={() => onLogForDate(selectedDate)}
        />

        {tomorrowLimit !== null && (
          <p className="dial-over-note">
            Tomorrow&apos;s limit drops to <strong>{formatMoney(tomorrowLimit)}</strong>
          </p>
        )}

        {!isTodaySelected && (
          <div className="dial-actions">
            <button type="button" className="dial-action" onClick={() => setSelectedDate(today)}>
              ‹ BACK TO TODAY
            </button>
          </div>
        )}
      </div>

      <div className="stat-grid">
        <div className="stat-box">
          <div className="stat-label">{isLastDay ? 'TIME LEFT' : 'DAYS REMAINING'}</div>
          <div className="stat-value">
            {isLastDay ? formatTimeRemaining(now) : daysRemaining}
          </div>
          <div className="stat-sub">in period</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">DAILY LIMIT TODAY</div>
          <div className="stat-value">
            {formatMoney(dailyLimit.amount)}
          </div>
          {dailyLimit.delta !== null ? (
            <div
              className={`stat-delta ${dailyLimit.delta > 0 ? 'stat-delta-up' : 'stat-delta-down'}`}
            >
              <span className="stat-delta-arrow">{dailyLimit.delta > 0 ? '▲' : '▼'}</span>
              {formatMoney(Math.abs(dailyLimit.delta))}
              <span className="stat-delta-note">vs yesterday</span>
            </div>
          ) : (
            <div className="stat-sub">{dailyLimit.note}</div>
          )}
        </div>
        {isLastDay ? (
          <button
            type="button"
            className="stat-box stat-box-tappable"
            onClick={() => setLastDayNoteOpen((open) => !open)}
            aria-expanded={lastDayNoteOpen}
          >
            <div className="stat-label">REMAINING ✳</div>
            <div className={`stat-value ${currentRemaining < 0 ? 'negative' : ''}`}>
              {formatMoney(currentRemaining)}
            </div>
            {remainingVerdict && (
              <div className={`stat-sub stat-sub-${remainingVerdict.tone}`}>
                {remainingVerdict.word}
              </div>
            )}
          </button>
        ) : (
          <div className="stat-box">
            <div className="stat-label">REMAINING</div>
            <div className={`stat-value ${currentRemaining < 0 ? 'negative' : ''}`}>
              {formatMoney(currentRemaining)}
            </div>
            {remainingVerdict && (
              <div className={`stat-sub stat-sub-${remainingVerdict.tone}`}>
                {remainingVerdict.word}
              </div>
            )}
          </div>
        )}
      </div>

      {/* The final day's explanation is folded behind the REMAINING figure it
          describes, rather than sitting permanently in a banner - it's the same
          information, but it stops costing vertical space on the one day the
          dashboard has the most to say. */}
      {isLastDay && (
        <p className={`last-day-note ${lastDayNoteOpen ? 'last-day-note-open' : ''}`}>
          Last day of the period - every rolled-over dollar is available today, so
          REMAINING is what you have rather than a running balance.
          {dailyLimit.showingBaseline
            ? ' The daily limit beside it is your usual steady target, kept for reference.'
            : ''}
        </p>
      )}

      {!isTodaySelected && (
        <p className="selection-note">
          Showing {formatDisplayDate(selectedDate)} — tap the bar to log or edit that day.
        </p>
      )}

      <DayList
        schedule={schedule}
        editable
        selectedDate={selectedDate}
        onSelectDay={setSelectedDate}
        onEditDay={handleEditDay}
      />
    </div>
  )
}
