import { useEffect, useState } from 'react'
import useBudgetData from './hooks/useBudgetData'
import { formatDisplayDateWithDay, daysBetweenInclusive } from './utils/dateUtils.js'
import { deriveNextPeriod } from './utils/cadence.js'
import Onboarding from './components/Onboarding'
import PeriodSetup from './components/PeriodSetup'
import PeriodPager from './components/PeriodPager'
import LogSpend from './components/LogSpend'
import PeriodSummary from './components/PeriodSummary'
import LapsedNotice from './components/LapsedNotice'
import Trends from './components/Trends'
import Settings from './components/Settings'

// A gap of this many days or more between a period ending and the user
// next opening the app gets the extra "welcome back" acknowledgment
// (LapsedNotice) before the new-period prompt. Anything shorter (checking
// in the next day or two) skips straight to setup - that's just the
// ordinary rhythm of one period ending and the next beginning, not a lapse
// worth calling out.
const LAPSED_THRESHOLD_DAYS = 3

export default function App() {
  const {
    today,
    periods,
    currentPeriod,
    reconciled,
    periodEnded,
    todayInfo,
    schedule,
    daysRemaining,
    currentRemaining,
    cadence,
    startPeriod,
    startFirstPeriod,
    logSpendForDate,
    addSpendToToday,
    resetAllData,
    clearTodayLog,
    setCadence,
    updatePeriodDetails,
    abandonCurrentPeriod
  } = useBudgetData()

  // The date string currently open in the Log Spend sheet, or null when the
  // sheet is closed. `logMode` controls what CONFIRM does with the entered
  // number: 'add' accumulates onto that day's existing running total (the
  // everyday flow for today - each tap is a new transaction), 'replace' sets
  // the exact total (correcting today via EDIT TOTAL, or filling in a past
  // day, where you're recalling a total rather than adding to one).
  const [editingDate, setEditingDate] = useState(null)
  const [logMode, setLogMode] = useState('add')

  // Drives the post-period-end interstitial sequence: null means "nothing
  // to show, render the normal pager." Once the active period's end date
  // passes, this snaps to 'summary' and only ever advances forward as the
  // user taps through (summary -> maybe 'lapsed' -> 'setup').
  const [endFlowStep, setEndFlowStep] = useState(null)
  useEffect(() => {
    if (periodEnded) {
      setEndFlowStep((prev) => (prev === null ? 'summary' : prev))
    } else {
      setEndFlowStep(null)
    }
  }, [periodEnded])

  // DEV TOOL: forces the PeriodSummary screen open for the active period
  // regardless of whether it's actually ended. Remove alongside its button.
  const [devForceSummary, setDevForceSummary] = useState(false)

  const [showTrends, setShowTrends] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Which period page is currently visible in the swipeable pager. Always
  // snaps back to the newest period whenever one is added (the rightmost
  // page is always "current"), but otherwise persists as the user swipes
  // back through history.
  const [viewIndex, setViewIndex] = useState(() => Math.max(0, periods.length - 1))
  useEffect(() => {
    setViewIndex(Math.max(0, periods.length - 1))
  }, [periods.length])

  const needsOnboarding = !currentPeriod

  const handleStartPeriod = (periodInput) => {
    startPeriod(periodInput)
    // Normally the periodEnded-watching effect above resets endFlowStep to
    // null on its own once a new period starts (periodEnded flips true ->
    // false). But when the PREVIOUS period was abandoned rather than ending
    // naturally, its endDate was truncated to exactly today, so its
    // periodEnded was already false going in - starting the new period
    // leaves periodEnded false -> false, the effect's dependency never
    // changes, and endFlowStep would otherwise stay stuck on 'setup'
    // forever. Resetting it directly here covers both cases unconditionally.
    setEndFlowStep(null)
  }

  const handleConfirmSpend = (amount) => {
    if (logMode === 'add') {
      addSpendToToday(amount)
    } else {
      logSpendForDate(editingDate, amount)
    }
    setEditingDate(null)
  }

  // Tapping the dial. Today accumulates (each tap is another transaction as
  // the day goes on); a past day is set outright, because you're recalling a
  // day's total rather than adding to one in progress.
  const openLogForDate = (date) => {
    setLogMode(date === today ? 'add' : 'replace')
    setEditingDate(date)
  }

  // The EDIT TOTAL link under the dial - always an exact overwrite, for
  // whichever day the dial is currently showing.
  const openEditTotalForDate = (date) => {
    setLogMode('replace')
    setEditingDate(date)
  }

  const handleSummaryContinue = () => {
    const gapDays = currentPeriod ? daysBetweenInclusive(currentPeriod.endDate, today) - 1 : 0
    setEndFlowStep(gapDays >= LAPSED_THRESHOLD_DAYS ? 'lapsed' : 'setup')
  }

  // Settings -> Abandon Current Period: truncates the active period's end
  // date to today, then manually forces the same end-of-period summary flow
  // a natural period end would trigger (periodEnded won't flip true on its
  // own from this, since today still equals the new endDate).
  const handleAbandonPeriod = () => {
    abandonCurrentPeriod()
    setEndFlowStep('summary')
    setShowSettings(false)
  }

  // With a cadence set, the next period is derived rather than asked for: the
  // setup screen arrives pre-filled with the dates AND the previous amount, so
  // the recurring case is a confirm rather than a form. Everything stays
  // editable - payday is exactly when your discretionary amount might have
  // changed, which is the reason this isn't a silent rollover.
  const previousPeriod = periods.length > 0 ? periods[periods.length - 1] : null
  const nextPeriodDates = previousPeriod ? deriveNextPeriod(previousPeriod, cadence, today) : null
  const nextPeriodAmount = previousPeriod ? previousPeriod.initialAmount : null

  // The schedule row for whichever date is currently open in the sheet, used
  // to pre-fill the existing amount and show that day's applicable limit.
  const editingRow = editingDate ? schedule.find((row) => row.date === editingDate) : null
  const editingCurrentTotal = editingRow && editingRow.logged ? editingRow.amount : 0

  let screen
  if (needsOnboarding) {
    screen = <Onboarding today={today} onComplete={startFirstPeriod} />
  } else if (endFlowStep === 'summary') {
    screen = <PeriodSummary period={currentPeriod} reconciled={reconciled} onContinue={handleSummaryContinue} />
  } else if (endFlowStep === 'lapsed') {
    const gapDays = daysBetweenInclusive(currentPeriod.endDate, today) - 1
    screen = <LapsedNotice gapDays={gapDays} onContinue={() => setEndFlowStep('setup')} />
  } else if (endFlowStep === 'setup') {
    screen = (
      <PeriodSetup
        isNewPeriod
        today={today}
        periods={periods}
        initialDates={nextPeriodDates}
        initialAmount={nextPeriodAmount}
        onStart={handleStartPeriod}
      />
    )
  } else if (devForceSummary) {
    screen = (
      <PeriodSummary
        period={currentPeriod}
        reconciled={reconciled}
        onContinue={() => setDevForceSummary(false)}
        devForced
      />
    )
  } else if (showTrends) {
    screen = <Trends periods={periods} today={today} onBack={() => setShowTrends(false)} />
  } else if (showSettings) {
    screen = (
      <Settings
        period={currentPeriod}
        cadence={cadence}
        onUpdatePeriodDetails={updatePeriodDetails}
        onSetCadence={setCadence}
        onAbandonPeriod={handleAbandonPeriod}
        onBack={() => setShowSettings(false)}
      />
    )
  } else {
    screen = (
      <>
        <PeriodPager
          periods={periods}
          today={today}
          viewIndex={viewIndex}
          onViewIndexChange={setViewIndex}
          onOpenTrends={() => setShowTrends(true)}
          onOpenSettings={() => setShowSettings(true)}
          activeTodayInfo={todayInfo}
          activeSchedule={schedule}
          activeDaysRemaining={daysRemaining}
          activeCurrentRemaining={currentRemaining}
          onLogForDate={openLogForDate}
          onEditTotalForDate={openEditTotalForDate}
          onResetAll={resetAllData}
          onClearTodayLog={clearTodayLog}
          onTriggerSummary={() => setDevForceSummary(true)}
        />
        {editingDate && (
          <LogSpend
            mode={logMode}
            initialAmount={editingCurrentTotal}
            currentTotal={editingCurrentTotal}
            alreadyLogged={Boolean(editingRow && editingRow.logged)}
            dailyLimit={editingRow ? editingRow.dailyLimit : 0}
            isToday={editingDate === today}
            dateLabel={formatDisplayDateWithDay(editingDate)}
            onConfirm={handleConfirmSpend}
            onCancel={() => setEditingDate(null)}
          />
        )}
      </>
    )
  }

  return (
    <div className="app-shell">
      <pre className="ascii-header">{'>'} CADENCE</pre>
      {screen}
    </div>
  )
}
