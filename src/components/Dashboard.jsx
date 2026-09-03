import { useEffect, useMemo, useState } from 'react'
import { formatDisplayDate, formatDisplayDateWithDay } from '../utils/dateUtils.js'
import { formatMoney } from '../utils/format.js'
import { projectNextDayLimit } from '../utils/budgetEngine.js'
import ConfirmDialog from './ConfirmDialog.jsx'
import DayList from './DayList.jsx'
import SpendDial from './SpendDial.jsx'
import DialDebugPanel from './DialDebugPanel.jsx'

// The ACTIVE period's view - the only page in the swipeable pager where
// anything is editable. Historical periods render through PastPeriodView
// instead, which is read-only and has none of the dial/dev-tool machinery.
//
// The dial follows a SELECTED day rather than being hardwired to today. It
// starts on today, and tapping any past row moves it there, so a forgotten day
// gets filled in through the same control with the same feedback as today.
// The day list is a picker; the dial is the single place anything is edited.
export default function Dashboard({
  period,
  today,
  todayInfo,
  schedule,
  daysRemaining,
  currentRemaining,
  onLogForDate,
  onEditTotalForDate,
  onResetAll,
  onClearTodayLog,
  onTriggerSummary
}) {
  const [selectedDate, setSelectedDate] = useState(today)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)

  // Snap back to today if the day rolls over while the app is open, or if the
  // period changes underneath us - a stale selection would otherwise point at
  // a date that isn't in the list any more.
  useEffect(() => {
    setSelectedDate(today)
  }, [today, period.id])

  const selectedRow = schedule.find((row) => row.date === selectedDate) || null
  const isTodaySelected = selectedDate === today

  const selectedSpent = selectedRow && selectedRow.logged ? selectedRow.amount : 0
  // A logged past day carries the limit that applied when it was logged, which
  // is the honest number to judge it against. An unlogged day falls back to the
  // current live limit, which buildPeriodSchedule already supplies.
  const selectedLimit = selectedRow && selectedRow.dailyLimit !== null ? selectedRow.dailyLimit : 0
  const selectedLogged = Boolean(selectedRow && selectedRow.logged)

  const todayLimit = todayInfo ? todayInfo.dailyLimit : null

  // On the LAST day of a period, the live dailyLimit necessarily equals
  // whatever's left in the budget (only one day remains to spend it) - which
  // can read as a confusingly large, seemingly-arbitrary "limit" if a lot
  // rolled forward from earlier underspending. On that one day, the stat box
  // shows the period's steady baseline target instead, and the actual
  // rolled-over total gets its own explicit line so neither number is lost.
  const isLastDay = Boolean(todayInfo) && today === period.endDate
  const displayedDailyLimit = isLastDay ? todayInfo.baselineDailyLimit : todayLimit

  // ---- dev-only dial debugging -----------------------------------------
  // Remove this block, the panel import, and the DEV button below together.
  const [debugOpen, setDebugOpen] = useState(false)
  const [debugPercent, setDebugPercent] = useState(0)
  const [debugOverride, setDebugOverride] = useState(false)
  const [debugSpeed, setDebugSpeed] = useState(1)
  const [debugTrigger, setDebugTrigger] = useState(null)

  const fireDebugTrigger = (type) => setDebugTrigger({ type, id: Date.now() })

  // While scrubbing, drive the dial with an EXACT fraction rather than a
  // whole-dollar amount. Real spends are always whole dollars, but a $7 limit
  // would give the scrubber only eight distinct positions - far too coarse to
  // inspect a color ramp - and rounding here would also put the ring a step
  // out of agreement with the figures the panel reports, which is precisely
  // the drift the panel exists to rule out.
  const dialLimit = selectedLimit
  const dialSpent = debugOverride ? dialLimit * (debugPercent / 100) : selectedSpent
  const dialLogged = debugOverride ? debugPercent > 0 : selectedLogged

  const isOverSelected = dialLimit > 0 && dialSpent > dialLimit

  // The consequence of going over is the genuinely actionable fact, and it
  // isn't visible anywhere else on this screen: the overspend doesn't vanish,
  // it shrinks the days that follow. Only meaningful for TODAY - "tomorrow"
  // says nothing useful while you're inspecting a day from last week - and
  // only when there's actually a following day left in the period.
  const tomorrowLimit = useMemo(() => {
    if (!isTodaySelected || !isOverSelected || !todayInfo || daysRemaining <= 1) return null
    const totalDays = schedule.length
    const loggedDays = schedule.filter((row) => row.logged).length + (selectedLogged ? 0 : 1)
    const remainingAfterToday = todayInfo.remainingBefore - dialSpent
    const next = projectNextDayLimit(remainingAfterToday, totalDays, loggedDays)
    // Going over doesn't always visibly cost you tomorrow: the divisor shrinks
    // by a day at the same time the budget does, so a modest overspend against
    // a large remaining budget can land on the same whole-dollar figure.
    // Saying "drops to $7" while today's limit is also $7 would be worse than
    // saying nothing, so the line only appears when there's a real reduction.
    return next < dialLimit ? next : null
  }, [
    isTodaySelected,
    isOverSelected,
    todayInfo,
    daysRemaining,
    schedule,
    selectedLogged,
    dialSpent,
    dialLimit
  ])

  const handleResetConfirmed = () => {
    setResetConfirmOpen(false)
    onResetAll()
  }

  return (
    <div className="screen dashboard-screen">
      <div className="period-range">
        {formatDisplayDateWithDay(period.startDate)} -&gt; {formatDisplayDateWithDay(period.endDate)}
      </div>

      <div className="dial-section">
        <SpendDial
          spent={dialSpent}
          limit={dialLimit}
          logged={dialLogged}
          dateLabel={isTodaySelected ? null : formatDisplayDateWithDay(selectedDate)}
          onTap={() => onLogForDate(selectedDate)}
          speed={debugSpeed}
          debugTrigger={debugTrigger}
        />

        {tomorrowLimit !== null && (
          <p className="dial-over-note">
            Tomorrow&apos;s limit drops to <strong>{formatMoney(tomorrowLimit)}</strong>
          </p>
        )}

        <div className="dial-actions">
          {!isTodaySelected && (
            <button type="button" className="dial-action" onClick={() => setSelectedDate(today)}>
              ‹ BACK TO TODAY
            </button>
          )}
          {selectedLogged && (
            <button
              type="button"
              className="dial-action"
              onClick={() => onEditTotalForDate(selectedDate)}
            >
              EDIT TOTAL
            </button>
          )}
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-box">
          <div className="stat-label">DAYS REMAINING</div>
          <div className="stat-value">{daysRemaining}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">DAILY LIMIT TODAY</div>
          <div className={`stat-value ${displayedDailyLimit < 0 ? 'negative' : ''}`}>
            {formatMoney(displayedDailyLimit)}
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-label">REMAINING</div>
          <div className={`stat-value ${currentRemaining < 0 ? 'negative' : ''}`}>
            {formatMoney(currentRemaining)}
          </div>
        </div>
      </div>

      {isLastDay && (
        <p className="last-day-note">
          Last day of the period - every rolled-over dollar is available today.
          <br />
          TOTAL AVAILABLE TODAY: <strong>{formatMoney(todayLimit)}</strong>
        </p>
      )}

      {!isTodaySelected && (
        <p className="selection-note">
          Showing {formatDisplayDate(selectedDate)} — tap the dial to log or edit that day.
        </p>
      )}

      <DayList
        schedule={schedule}
        editable
        selectedDate={selectedDate}
        onSelectDay={setSelectedDate}
      />

      <div className="dev-reset-section">
        <button type="button" className="dev-reset-button" onClick={() => setResetConfirmOpen(true)}>
          DEV: RESET ALL DATA
        </button>
        <button type="button" className="dev-clear-today-button" onClick={onClearTodayLog}>
          DEV: CLEAR TODAY'S LOG
        </button>
        <button type="button" className="dev-trigger-summary-button" onClick={onTriggerSummary}>
          DEV: TRIGGER PERIOD SUMMARY
        </button>
        <button type="button" className="dev-debug-button" onClick={() => setDebugOpen(true)}>
          DEV: MOTION DEBUG
        </button>
      </div>

      {resetConfirmOpen && (
        <ConfirmDialog
          message="Reset all data? This cannot be undone."
          confirmLabel="CONFIRM"
          cancelLabel="CANCEL"
          danger
          onConfirm={handleResetConfirmed}
          onCancel={() => setResetConfirmOpen(false)}
        />
      )}

      {debugOpen && (
        <DialDebugPanel
          percent={debugPercent}
          onPercentChange={(p) => {
            setDebugPercent(p)
            setDebugOverride(true)
          }}
          overrideActive={debugOverride}
          onToggleOverride={() => setDebugOverride((v) => !v)}
          speed={debugSpeed}
          onSpeedChange={setDebugSpeed}
          onTrigger={fireDebugTrigger}
          limit={dialLimit}
          onClose={() => {
            setDebugOpen(false)
            setDebugOverride(false)
          }}
        />
      )}
    </div>
  )
}
