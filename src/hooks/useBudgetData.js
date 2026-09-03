import { useCallback, useEffect, useMemo, useState } from 'react'
import { todayStr, compareDateStr } from '../utils/dateUtils.js'
import {
  reconcilePeriod,
  buildPeriodSchedule,
  daysRemainingInclusive,
  findOverlappingPeriod
} from '../utils/budgetEngine.js'

const STORAGE_KEY = 'budgetHabitTracker.v1'
const DEFAULT_SETTINGS = { cadence: 'manual' }

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { periods: [], settings: { ...DEFAULT_SETTINGS } }
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.periods)) return { periods: [], settings: { ...DEFAULT_SETTINGS } }
    const parsedSettings = parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {}
    return {
      periods: parsed.periods,
      settings: { ...DEFAULT_SETTINGS, ...parsedSettings }
    }
  } catch (err) {
    console.error('Failed to load budget data from localStorage:', err)
    return { periods: [], settings: { ...DEFAULT_SETTINGS } }
  }
}

function persistData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (err) {
    console.error('Failed to save budget data to localStorage:', err)
  }
}

function makePeriodId() {
  return `period-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

export default function useBudgetData() {
  const [data, setData] = useState(loadData)
  const [today, setToday] = useState(todayStr())

  // Persist to localStorage any time the data changes.
  useEffect(() => {
    persistData(data)
  }, [data])

  // Keep "today" accurate if the app is left open across midnight.
  useEffect(() => {
    const interval = setInterval(() => {
      const t = todayStr()
      setToday((prev) => (prev !== t ? t : prev))
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

  // DEV TOOL: wipes every period/entry this app has ever stored and drops
  // the user straight back to Period Setup. Not part of the real product -
  // wired up only so the dashboard's "DEV: RESET ALL DATA" button has
  // something to call; remove alongside that button before shipping.
  const resetAllData = useCallback(() => {
    try {
      localStorage.clear()
    } catch (err) {
      console.error('Failed to clear localStorage:', err)
    }
    setData({ periods: [], settings: { ...DEFAULT_SETTINGS } })
  }, [])

  // Persists the user's optional pay-cadence preference (Settings screen).
  // Purely a suggestion for New Period Setup's default dates - changing it
  // never touches any existing period.
  const setCadence = useCallback((cadence) => {
    setData((prev) => ({ ...prev, settings: { ...prev.settings, cadence } }))
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

      if (compareDateStr(period.startDate, endDate) >= 0) {
        return 'End date must be after start date.'
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

  // DEV TOOL: removes ONLY today's logged entry (if any) - the single
  // running-total record that addSpendToToday/logSpendForDate maintain -
  // leaving the period's dates, discretionary amount, and every other
  // day's entries untouched. This wipes the entire accumulated total back
  // to nothing (today returns to its NOT LOGGED state), not just today's
  // most recent tap. No confirmation needed - unlike the full reset, this
  // only ever affects the one entry the user is actively iterating on
  // while testing. Remove alongside the "DEV: CLEAR TODAY'S LOG" button
  // before shipping.
  const clearTodayLog = useCallback(() => {
    setData((prev) => {
      const periods = prev.periods
      if (periods.length === 0) return prev
      const lastIdx = periods.length - 1
      const period = periods[lastIdx]
      const existingEntries = period.entries || []
      if (!existingEntries.some((e) => e.date === today)) return prev
      const updatedEntries = existingEntries.filter((e) => e.date !== today)
      const updatedPeriod = { ...period, entries: updatedEntries }
      const nextPeriods = periods.map((p, idx) => (idx === lastIdx ? updatedPeriod : p))
      return { ...prev, periods: nextPeriods }
    })
  }, [today])

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

  return {
    today,
    periods,
    currentPeriod,
    reconciled,
    periodEnded,
    todayInfo,
    schedule,
    daysRemaining,
    currentRemaining,
    cadence: data.settings.cadence,
    startPeriod,
    startFirstPeriod,
    logSpendForDate,
    addSpendToToday,
    resetAllData,
    clearTodayLog,
    setCadence,
    updatePeriodDetails,
    abandonCurrentPeriod
  }
}
