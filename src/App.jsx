import { useEffect, useMemo, useState } from 'react'
import useBudgetData from './hooks/useBudgetData'
import usePersistentStorage from './hooks/usePersistentStorage.js'
import useBackDismiss from './hooks/useBackDismiss.js'
import { ThemeColorsContext } from './hooks/useThemeColors.js'
import { applyTheme, getTheme, rampColorsFor } from './utils/themes.js'
import { formatDisplayDateWithDay, daysBetweenInclusive, compareDateStr } from './utils/dateUtils.js'
import { deriveNextPeriod } from './utils/cadence.js'
import Onboarding from './components/Onboarding'
import PeriodSetup from './components/PeriodSetup'
import PeriodPager from './components/PeriodPager'
import LogSpend from './components/LogSpend'
import PeriodSummary from './components/PeriodSummary'
import LapsedNotice from './components/LapsedNotice'
import Trends from './components/Trends'
import Settings from './components/Settings'
import Faq from './components/Faq'
import StorageWarning from './components/StorageWarning'

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
    storageError,
    dismissStorageError,
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
    replaceAllData,
    rawData,
    setCadence,
    setTheme,
    updatePeriodDetails,
    abandonCurrentPeriod
  } = useBudgetData()

  // Ask the browser to keep this app's storage out of its automatic cleanup,
  // but only once there is a period worth protecting - see the hook.
  const { status: storageStatus, retry: recheckStorage } = usePersistentStorage(periods.length > 0)

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

  const [showTrends, setShowTrends] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  // Opened from Settings and returns there, so the back stack stays honest.
  const [showFaq, setShowFaq] = useState(false)

  // What the back button closes, outermost first.
  //
  // These live here rather than inside the three screens because App renders
  // exactly ONE of them at a time: opening the FAQ unmounts Settings even
  // though the user has gone a level deeper and Settings is still open behind
  // it. A screen that registered on its own mount would therefore drop off
  // the stack on the way down and add itself back on the way up - pushing a
  // history entry in response to a back press, which Chrome on Android reads
  // as back-trapping. It marks that entry skippable, the next back skips past
  // it to the launch entry, and a standalone PWA at the launch entry closes.
  //
  // The flags below are the honest answer to "is this screen open", and they
  // stay true while something is stacked on top. The call order is the order
  // back takes them off; the spend sheet and the confirm dialogs register
  // themselves, since for those being mounted really does mean being open.
  useBackDismiss(() => setShowTrends(false), showTrends)
  useBackDismiss(() => setShowSettings(false), showSettings)
  useBackDismiss(() => setShowFaq(false), showFaq)

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
    setShowFaq(false)
    setEditingDate(null)
    setHomeNonce((n) => n + 1)
  }

  // The summary's CONTINUE normally leads to setting up the period that
  // follows. There is one case where it must not: the summary is also reached
  // from Settings -> Abandon Current Period, which ends the period TODAY
  // rather than in the past, so today is still inside the period just closed.
  // Nothing can be set up from there - a period starting today would overlap
  // the one being closed, and one starting tomorrow has not begun, so the
  // dashboard would have no row for today and no limit to show. Going back to
  // the dashboard is the honest answer: the abandoned period runs out its last
  // day, and tomorrow the ordinary end-of-period flow offers the next one
  // exactly as it would have anyway.
  const handleSummaryContinue = () => {
    if (currentPeriod && compareDateStr(currentPeriod.endDate, today) >= 0) {
      setEndFlowStep(null)
      return
    }
    const gapDays = currentPeriod ? daysBetweenInclusive(currentPeriod.endDate, today) - 1 : 0
    setEndFlowStep(gapDays >= LAPSED_THRESHOLD_DAYS ? 'lapsed' : 'setup')
  }

  // Settings -> Import Backup. The file has already been validated and the
  // user has already confirmed the replace; what is left is putting the app
  // back into a sane resting state around the new data, since whatever was on
  // screen a moment ago referred to periods that no longer exist.
  const handleImportData = (next) => {
    replaceAllData(next)
    setEndFlowStep(null)
    setEditingDate(null)
    setViewIndex(Math.max(0, next.periods.length - 1))
    setShowSettings(false)
    setShowTrends(false)
    setHomeNonce((n) => n + 1)
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

  // The spend sheet outranks the end-of-period sequence.
  //
  // A period ends at midnight, and the 30-second tick notices within half a
  // minute. If that lands while the sheet is open, the summary screen replaces
  // the pager, the sheet unmounts with it, and whatever was half-typed is
  // gone. Nothing is lost by waiting: `endFlowStep` is already set and the
  // summary appears the moment the sheet closes.
  const sheetOpen = Boolean(editingDate)

  let screen
  if (needsOnboarding) {
    screen = <Onboarding today={today} onComplete={startFirstPeriod} />
  } else if (endFlowStep === 'summary' && !sheetOpen) {
    screen = (
      <PeriodSummary
        period={currentPeriod}
        reconciled={reconciled}
        rawData={rawData}
        onContinue={handleSummaryContinue}
      />
    )
  } else if (endFlowStep === 'lapsed' && !sheetOpen) {
    const gapDays = daysBetweenInclusive(currentPeriod.endDate, today) - 1
    screen = <LapsedNotice gapDays={gapDays} onContinue={() => setEndFlowStep('setup')} />
  } else if (endFlowStep === 'setup' && !sheetOpen) {
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
  } else if (showTrends) {
    screen = (
      <Trends
        periods={periods}
        today={today}
        onJumpToPeriod={(idx) => {
          setViewIndex(idx)
          setShowTrends(false)
        }}
        onBack={() => setShowTrends(false)}
      />
    )
  } else if (showFaq) {
    screen = <Faq onBack={() => setShowFaq(false)} />
  } else if (showSettings) {
    screen = (
      <Settings
        period={currentPeriod}
        cadence={cadence}
        theme={theme}
        rawData={rawData}
        storageStatus={storageStatus}
        onRecheckStorage={recheckStorage}
        onImportData={handleImportData}
        onUpdatePeriodDetails={updatePeriodDetails}
        onSetCadence={setCadence}
        onSetTheme={setTheme}
        onAbandonPeriod={handleAbandonPeriod}
        onOpenFaq={() => setShowFaq(true)}
        onBack={() => setShowSettings(false)}
      />
    )
  } else {
    screen = (
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
      />
    )
  }

  return (
    <ThemeColorsContext.Provider value={rampColors}>
      <div className="app-shell">
        <button type="button" className="ascii-header" onClick={goHome} aria-label="Cadence — back to today">
          {'>'} CADENCE
        </button>
        {storageError && <StorageWarning kind={storageError} onDismiss={dismissStorageError} />}
        {screen}
        {sheetOpen && (
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
      </div>
    </ThemeColorsContext.Provider>
  )
}
