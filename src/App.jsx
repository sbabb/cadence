import { useEffect, useMemo, useState } from 'react'
import useBudgetData from './hooks/useBudgetData'
import { ThemeColorsContext } from './hooks/useThemeColors.js'
import { applyTheme, getTheme, rampColorsFor } from './utils/themes.js'
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
    now,
    previousDayLimit,
    periods,
    currentPeriod,
    reconciled,
    periodEnded,
    todayInfo,
    schedule,
    daysRemaining,
    currentRemaining,
    cadence,
    theme,
    startPeriod,
    startFirstPeriod,
    logSpendForDate,
    addSpendToToday,
    resetAllData,
    clearTodayLog,
    setCadence,
    setTheme,
    updatePeriodDetails,
    abandonCurrentPeriod
  } = useBudgetData()

  // main.jsx has already painted the stored theme before this component ever
  // rendered; this effect is what keeps it current afterwards, when the user
  // picks a different one in Settings.
  const activeTheme = useMemo(() => getTheme(theme), [theme])
  useEffect(() => {
    applyTheme(activeTheme)
  }, [activeTheme])

  // Derived during render, not in an effect, so the bar is never one frame
  // behind the palette around it. See useThemeColors.js.
  const rampColors = useMemo(() => rampColorsFor(activeTheme), [activeTheme])

  // The date currently open in the spend sheet, or null when it's closed. The
  // sheet itself decides whether a number is added or set outright - it has
  // the day's running total on screen, which is the context that makes the
  // choice obvious. App just records which day is being edited.
  const [editingDate, setEditingDate] = useState(null)

  // Bumped whenever the header is tapped. Screens watch it to return to their
  // resting state - the dashboard uses it to put the bar back on today.
  const [homeNonce, setHomeNonce] = useState(0)

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

  const handleConfirmSpend = (amount, mode) => {
    if (mode === 'add') {
      // addSpendToToday only ever touches today; any other day accumulates by
      // adding to the figure already recorded there.
      if (editingDate === today) {
        addSpendToToday(amount)
      } else {
        const existing = editingRow && editingRow.logged ? editingRow.amount : 0
        logSpendForDate(editingDate, existing + amount)
      }
    } else {
      logSpendForDate(editingDate, amount)
    }
    setEditingDate(null)
  }

  const openLogForDate = (date) => setEditingDate(date)

  // Tapping the header. Returns to the dashboard from wherever you are and
  // signals the screens to reset. Deliberately NOT a page reload: there's no
  // server, so nothing needs re-fetching, and reloading would only disguise a
  // bug rather than fix it.
  const goHome = () => {
    setShowTrends(false)
    setShowSettings(false)
    setDevForceSummary(false)
    setEditingDate(null)
    setHomeNonce((n) => n + 1)
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
        theme={theme}
        onUpdatePeriodDetails={updatePeriodDetails}
        onSetCadence={setCadence}
        onSetTheme={setTheme}
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
          now={now}
          previousDayLimit={previousDayLimit}
          onLogForDate={openLogForDate}
          homeNonce={homeNonce}
          onResetAll={resetAllData}
          onClearTodayLog={clearTodayLog}
          onTriggerSummary={() => setDevForceSummary(true)}
        />
        {editingDate && (
          <LogSpend
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
    <ThemeColorsContext.Provider value={rampColors}>
      <div className="app-shell">
        <button type="button" className="ascii-header" onClick={goHome} aria-label="Cadence — back to today">
          {'>'} CADENCE
        </button>
        {screen}
      </div>
    </ThemeColorsContext.Provider>
  )
}
