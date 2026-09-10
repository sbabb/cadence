import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { todayStr, compareDateStr, addDays } from '../utils/dateUtils.js'
import { DEFAULT_THEME } from '../utils/themes.js'
import { CADENCE_OPTIONS } from '../utils/cadence.js'
import {
  reconcilePeriod,
  buildPeriodSchedule,
  daysRemainingInclusive,
  findOverlappingPeriod
} from '../utils/budgetEngine.js'

// Exported so main.jsx can read the saved theme and paint it BEFORE React's
// first render - see the note there about why that has to happen outside the
// component tree.
export const STORAGE_KEY = 'budgetHabitTracker.v1'
const DEFAULT_SETTINGS = { cadence: 'manual', theme: DEFAULT_THEME }

const EMPTY = () => ({ periods: [], settings: { ...DEFAULT_SETTINGS } })

// Returns the data AND whether reading it went wrong, because those are two
// different situations that used to look identical from the outside.
//
// Having never used the app and having lost the file both produced an empty
// state, which the app then presents as the onboarding screen - so a user
// whose storage had been cleared or corrupted was shown a cheerful "let's set
// up your first period" and left to conclude the app had thrown their history
// away without comment. `unreadable` distinguishes them so the UI can say so.
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { data: EMPTY(), unreadable: false }
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.periods)) {
      // Present but not what we wrote - that is data loss, not a fresh start.
      return { data: EMPTY(), unreadable: true }
    }
    const parsedSettings = parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {}
    const settings = { ...DEFAULT_SETTINGS, ...parsedSettings }
    // A cadence this build doesn't offer - an older install, a hand-edited blob,
    // a backup written by a later version - is read back as 'manual' rather than
    // kept verbatim. The derivation already declines to work with an unknown
    // value, so the behaviour is the manual one either way; what this fixes is
    // the Settings picker, which would otherwise show five options with none of
    // them highlighted and no way to tell what is actually set. Same policy the
    // backup importer has always applied to a value it doesn't recognise.
    if (!CADENCE_OPTIONS.some((c) => c.value === settings.cadence)) settings.cadence = 'manual'
    return {
      data: { periods: parsed.periods, settings },
      unreadable: false
    }
  } catch (err) {
    console.error('Failed to load budget data from localStorage:', err)
    return { data: EMPTY(), unreadable: true }
  }
}

// Reports success rather than swallowing the failure.
//
// This is the worst thing that can quietly go wrong in an app with no backend:
// storage full, storage disabled, or a private context that refuses writes, and
// every spend logged for the rest of the day evaporates on reload. It used to
// log to a console no phone user will ever open.
function persistData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  } catch (err) {
    console.error('Failed to save budget data to localStorage:', err)
    return false
  }
}

function makePeriodId() {
  return `period-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

export default function useBudgetData() {
  const initial = useState(loadData)[0]
  const [data, setData] = useState(initial.data)

  // null when storage is behaving. 'read' means what was there could not be
  // parsed; 'write' means a save has failed and anything logged since is only
  // in memory. Dismissible, but re-armed by the next failure.
  const [storageError, setStorageError] = useState(initial.unreadable ? 'read' : null)
  const dismissStorageError = useCallback(() => setStorageError(null), [])
  const [today, setToday] = useState(todayStr())
  // A coarse ticking clock. The final day of a period counts down in hours
  // rather than reporting "1 day", which needs the current time and not just
  // the current date. Thirty seconds is plenty for a minutes-resolution
  // display and costs nothing.
  const [now, setNow] = useState(() => new Date())

  // What is already known to be in storage. Starts as whatever was loaded,
  // which is the whole point - see the effect below.
  const lastPersisted = useRef(initial.data)

  // Persist to localStorage any time the data actually CHANGES. A failed write
  // is surfaced rather than logged; a later successful one clears the warning,
  // since whatever was wrong has evidently passed.
  //
  // The identity check is what stops this firing on mount, and that is a data
  // question rather than a performance one. When loadData() cannot parse what
  // it found, it hands back an empty state and flags `unreadable` - and an
  // unconditional write here then put that empty state straight over the
  // unreadable blob, before the user had even seen the warning about it. The
  // banner told them the old data might still be there and to check before
  // logging anything; by the time they read it, this effect had already
  // overwritten the only copy. Nothing is written now until something the user
  // did changes it, so a corrupted blob survives long enough to be rescued.
  //
  // Comparing by reference rather than with a "first run" flag is deliberate:
  // every state update here builds a new object, so identity is an exact test
  // for "nothing has changed", and it stays correct under StrictMode's
  // double-invoked effects, which a one-shot flag does not.
  useEffect(() => {
    if (data === lastPersisted.current) return
    lastPersisted.current = data
    const ok = persistData(data)
    setStorageError((prev) => (ok ? (prev === 'write' ? null : prev) : 'write'))
  }, [data])

  // Another tab (or another window) writing the same key. Without this the two
  // copies drift apart and whichever saves last silently discards the other's
  // work; with it, both converge on what is actually stored. The event only
  // fires in OTHER documents, so this cannot loop with the effect above.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY || e.newValue === null) return
      const { data: next, unreadable } = loadData()
      if (unreadable) {
        setStorageError('read')
        return
      }
      setData(next)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Keep "today" accurate if the app is left open across midnight, and keep
  // the clock moving for the final-day countdown. Both read the DEVICE's local
  // date and time, so the app always agrees with the phone it's running on.
  useEffect(() => {
    const interval = setInterval(() => {
      const t = todayStr()
      setToday((prev) => (prev !== t ? t : prev))
      setNow(new Date())
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const periods = data.periods
  const currentPeriod = periods.length > 0 ? periods[periods.length - 1] : null

  // Recompute the reconciled view of the current period whenever the
  // underlying data or "today" changes. Days the user never logged are
  // NOT backfilled with a fabricated $0 - they're simply absent, and
  // reconcilePeriod/buildPeriodSchedule treat them as unknown. Only
  // entries the user actually typed in ever get persisted (via
  // logSpend below), so there's nothing to write back here.
  const reconciled = useMemo(() => {
    if (!currentPeriod) return null
    return reconcilePeriod(currentPeriod, today)
  }, [currentPeriod, today])

  const schedule = useMemo(() => {
    if (!currentPeriod || !reconciled) return []
    return buildPeriodSchedule(currentPeriod, today, reconciled)
  }, [currentPeriod, reconciled, today])

  const startPeriod = useCallback(({ initialAmount, startDate, endDate }) => {
    const newPeriod = {
      id: makePeriodId(),
      startDate,
      endDate,
      initialAmount: Math.round(initialAmount),
      entries: []
    }
    setData((prev) => ({
      ...prev,
      periods: [...prev.periods, newPeriod]
    }))
  }, [])

  // Onboarding: the first period and the pay cadence are decided together, so
  // they're written together. Splitting them across two state updates would
  // briefly leave a period stored with the default cadence, which the
  // end-of-period derivation would then read.
  const startFirstPeriod = useCallback(({ initialAmount, startDate, endDate, cadence }) => {
    const newPeriod = {
      id: makePeriodId(),
      startDate,
      endDate,
      initialAmount: Math.round(initialAmount),
      entries: []
    }
    setData((prev) => ({
      periods: [...prev.periods, newPeriod],
      settings: { ...prev.settings, cadence }
    }))
  }, [])

  // Logs (or edits) the spend for ANY day that has already happened -
  // today, or any past day in the current period. Future days are refused:
  // you can't log spend for a day that hasn't happened yet. Because
  // reconcilePeriod always recomputes the whole chronological walk fresh
  // from period.entries, editing a past day automatically recalculates the
  // remaining budget and every dailyLimit from that day forward the next time
  // `schedule`/`todayInfo` are derived - there's no separate "recalculate
  // forward" step to write; it falls out of the engine being a pure
  // function of the full entry list rather than incrementally-cached data.
  const logSpendForDate = useCallback(
    (date, amount) => {
      if (compareDateStr(date, today) > 0) {
        console.warn(`Refusing to log spend for a future date: ${date}`)
        return
      }
      const wholeAmount = Math.max(0, Math.round(amount))
      setData((prev) => {
        const periods = prev.periods
        if (periods.length === 0) return prev
        const lastIdx = periods.length - 1
        const period = periods[lastIdx]
        const existingEntries = period.entries || []
        const withoutDate = existingEntries.filter((e) => e.date !== date)
        const updatedEntries = [...withoutDate, { date, amount: wholeAmount }].sort(
          (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
        )
        const updatedPeriod = { ...period, entries: updatedEntries }
        const nextPeriods = periods.map((p, idx) => (idx === lastIdx ? updatedPeriod : p))
        return { ...prev, periods: nextPeriods }
      })
    },
    [today]
  )

  // Swaps in a whole restored dataset, from an imported backup file.
  //
  // A wholesale replace rather than a merge, and that is a decision rather
  // than a shortcut. Merging would have to answer what happens when the file
  // and the device both have a period covering the same fortnight with
  // different numbers in it, and there is no answer to that which is right
  // often enough to apply without asking. Replace is a thing a person can
  // predict, which matters more here than being clever - the confirm dialog
  // in front of it says exactly what is about to happen.
  //
  // The caller has already validated the shape (see utils/backup.js); this
  // trusts it, and the normal persist effect writes it to storage.
  const replaceAllData = useCallback((next) => {
    setData({
      periods: next.periods,
      settings: { ...DEFAULT_SETTINGS, ...next.settings }
    })
  }, [])

  // Persists the user's optional pay-cadence preference (Settings screen).
  // Purely a suggestion for New Period Setup's default dates - changing it
  // never touches any existing period.
  const setCadence = useCallback((cadence) => {
    setData((prev) => ({ ...prev, settings: { ...prev.settings, cadence } }))
  }, [])

  // Which palette the app is wearing. Lives beside cadence in settings because
  // it's the same kind of thing - a preference that outlives every period -
  // and because it then rides along with the single localStorage write the
  // rest of the data already does.
  const setTheme = useCallback((theme) => {
    setData((prev) => ({ ...prev, settings: { ...prev.settings, theme } }))
  }, [])

  // Edits the ACTIVE period's discretionary amount and/or end date
  // (Settings -> Edit Current Period). Start date is deliberately not
  // editable here - the period has already begun and past entries are
  // anchored to specific dates within its current range. Refuses the edit
  // (returns an error string) if the new end date would be before the
  // start date, or would overlap another stored period; returns null on
  // success. Because reconcilePeriod recomputes everything fresh from
  // period.entries every time, changing the amount or shrinking/growing
  // the end date automatically recalculates every dailyLimit - there's
  // nothing else to update.
  // Validates against `data.periods` directly (rather than inside the
  // setData updater) so the caller gets a synchronous, unambiguous
  // success/failure result back from a single function call.
  const updatePeriodDetails = useCallback(
    ({ initialAmount, endDate }) => {
      const periods = data.periods
      if (periods.length === 0) return 'No active period to edit.'
      const period = periods[periods.length - 1]

      // One day is a valid period - see the note in PeriodSetup.jsx.
      if (compareDateStr(period.startDate, endDate) > 0) {
        return 'End date cannot be before start date.'
      }
      if (findOverlappingPeriod(periods, period.startDate, endDate, period.id)) {
        return 'A period already exists for these dates.'
      }

      setData((prev) => {
        const prevPeriods = prev.periods
        const lastIdx = prevPeriods.length - 1
        const updatedPeriod = {
          ...prevPeriods[lastIdx],
          initialAmount: Math.round(initialAmount),
          endDate
        }
        const nextPeriods = prevPeriods.map((p, idx) => (idx === lastIdx ? updatedPeriod : p))
        return { ...prev, periods: nextPeriods }
      })
      return null
    },
    [data.periods]
  )

  // Ends the active period EARLY (Settings -> Abandon Current Period):
  // truncates its endDate to today (today's own entry, if any, stays
  // included - only days strictly after today are cut off) so the stored
  // record accurately reflects "this period actually ran from X to
  // today." A no-op if today is already on/after the period's existing
  // end date (nothing to abandon). The caller (App.jsx) is responsible for
  // then forcing the real end-of-period summary/setup sequence, since
  // `periodEnded` won't itself flip true until the day AFTER endDate.
  const abandonCurrentPeriod = useCallback(() => {
    setData((prev) => {
      const periods = prev.periods
      if (periods.length === 0) return prev
      const lastIdx = periods.length - 1
      const period = periods[lastIdx]
      if (compareDateStr(today, period.endDate) >= 0) return prev
      const updatedPeriod = { ...period, endDate: today }
      const nextPeriods = periods.map((p, idx) => (idx === lastIdx ? updatedPeriod : p))
      return { ...prev, periods: nextPeriods }
    })
  }, [today])

  // Adds a NEW transaction amount onto today's existing running total
  // (creating today's entry from 0 if nothing's been logged yet). This is
  // the normal "tap to add spend" flow: each tap is a separate transaction
  // that accumulates into one whole-dollar total for the day, rather than
  // replacing it. Since reconcilePeriod only ever sees ONE number per day
  // (that day's total spend), accumulation happens here, before the entry
  // is written - the stored entries model doesn't change shape at all.
  const addSpendToToday = useCallback(
    (amount) => {
      const wholeAmount = Math.max(0, Math.round(amount))
      setData((prev) => {
        const periods = prev.periods
        if (periods.length === 0) return prev
        const lastIdx = periods.length - 1
        const period = periods[lastIdx]
        const existingEntries = period.entries || []
        const existing = existingEntries.find((e) => e.date === today)
        const newTotal = (existing ? existing.amount : 0) + wholeAmount
        const withoutDate = existingEntries.filter((e) => e.date !== today)
        const updatedEntries = [...withoutDate, { date: today, amount: newTotal }].sort(
          (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
        )
        const updatedPeriod = { ...period, entries: updatedEntries }
        const nextPeriods = periods.map((p, idx) => (idx === lastIdx ? updatedPeriod : p))
        return { ...prev, periods: nextPeriods }
      })
    },
    [today]
  )

  const todayInfo = reconciled ? reconciled.todayInfo : null
  const periodEnded = reconciled ? reconciled.periodEnded : false

  const daysRemaining = useMemo(() => {
    if (!currentPeriod || periodEnded) return 0
    // Days from today through the period's end, inclusive - but counted from
    // the period's own start if it somehow hasn't begun yet. Without the
    // clamp, a period starting next week would report every day between now
    // and its end as "remaining", which describes the calendar rather than the
    // period. Periods are only ever created containing today now, so this is
    // belt-and-braces against older stored data.
    const from = compareDateStr(today, currentPeriod.startDate) < 0 ? currentPeriod.startDate : today
    return daysRemainingInclusive(from, currentPeriod.endDate)
  }, [currentPeriod, periodEnded, today])

  const currentRemaining = useMemo(() => {
    if (!todayInfo) return null
    return todayInfo.logged ? todayInfo.remainingAfter : todayInfo.remainingBefore
  }, [todayInfo])

  // What the limit was on the previous day, so the dashboard can show whether
  // today's figure moved. The limit is deliberately stable - small day-to-day
  // variation vanishes at whole-dollar rounding - and without a marker for the
  // days it DOES move, a correctly steady number reads as a broken one.
  const previousDayLimit = useMemo(() => {
    if (!currentPeriod || periodEnded) return null
    const yesterday = addDays(today, -1)
    if (compareDateStr(yesterday, currentPeriod.startDate) < 0) return null
    const asOfYesterday = reconcilePeriod(currentPeriod, yesterday)
    return asOfYesterday.todayInfo ? asOfYesterday.todayInfo.dailyLimit : null
  }, [currentPeriod, periodEnded, today])

  return {
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
    cadence: data.settings.cadence,
    theme: data.settings.theme,
    startPeriod,
    startFirstPeriod,
    logSpendForDate,
    addSpendToToday,
    replaceAllData,
    // The raw stored shape, for the backup export. Everything else on this
    // object is derived; this is the thing that actually gets written.
    rawData: data,
    setCadence,
    setTheme,
    updatePeriodDetails,
    abandonCurrentPeriod
  }
}
