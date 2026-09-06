import { DEFAULT_THEME, THEMES } from './themes.js'
import { CADENCE_OPTIONS } from './cadence.js'

// Backup files: the app's only answer to "what happens if this phone dies".
//
// Everything lives in localStorage, which is durable enough day to day but has
// no recourse at all if it goes - a new phone, a cleared site, a browser
// swapped. This module is the way data gets out of the app and back into it.
//
// The file is wrapped in an ENVELOPE rather than being the raw stored blob.
// That costs four lines and buys the ability to change how the app stores
// things - a native build putting this in SQLite, say - without invalidating
// every backup anyone has already saved. The envelope names the app and the
// format version; whatever reads it can then decide what it is looking at
// instead of guessing.
export const BACKUP_FORMAT_VERSION = 1
const BACKUP_APP_ID = 'cadence'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const isRealDate = (s) => {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

const isWholeMoney = (n) => typeof n === 'number' && Number.isFinite(n)

// What a backup contains, in the terms the confirm dialog needs: enough for
// someone to recognise their own data before they agree to overwrite what is
// on the device with it.
export function summarizeData(data) {
  const periods = Array.isArray(data.periods) ? data.periods : []
  let loggedDays = 0
  let earliest = null
  let latest = null
  for (const p of periods) {
    loggedDays += Array.isArray(p.entries) ? p.entries.length : 0
    if (earliest === null || p.startDate < earliest) earliest = p.startDate
    if (latest === null || p.endDate > latest) latest = p.endDate
  }
  return { periods: periods.length, loggedDays, earliest, latest }
}

export function buildBackup(data) {
  return {
    app: BACKUP_APP_ID,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      periods: data.periods,
      settings: data.settings
    }
  }
}

export function backupFilename(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return `cadence-backup-${stamp}.json`
}

// Deliberately strict, and deliberately specific about WHY it refused.
//
// Import replaces everything. A file that is subtly wrong - a period with no
// end date, an entry whose amount is a string - would either crash a screen
// later or, worse, quietly produce wrong numbers in an app whose entire job is
// being right about numbers. Better to refuse at the door and say what was
// wrong with it than to accept something shaped almost like data.
//
// Unknown themes and cadences are the one exception: those are display
// preferences, so an unrecognised value falls back to the default rather than
// rejecting a file full of perfectly good spend history.
export function parseBackup(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: "That file isn't readable as a backup - it may not be the right file." }
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: "That file isn't a Cadence backup." }
  }
  if (parsed.app !== BACKUP_APP_ID) {
    return { ok: false, error: "That file isn't a Cadence backup." }
  }
  if (typeof parsed.formatVersion !== 'number' || parsed.formatVersion > BACKUP_FORMAT_VERSION) {
    return {
      ok: false,
      error: 'That backup was made by a newer version of Cadence than this one. Update the app, then import it.'
    }
  }
  const payload = parsed.data
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.periods)) {
    return { ok: false, error: "That backup is missing its periods and can't be imported." }
  }

  const periods = []
  for (let i = 0; i < payload.periods.length; i += 1) {
    const p = payload.periods[i]
    const where = `Period ${i + 1}`
    if (!p || typeof p !== 'object') return { ok: false, error: `${where} in that backup is not readable.` }
    if (typeof p.id !== 'string' || p.id === '') return { ok: false, error: `${where} has no identifier.` }
    if (!isRealDate(p.startDate) || !isRealDate(p.endDate)) {
      return { ok: false, error: `${where} has a start or end date that isn't a real date.` }
    }
    if (p.endDate < p.startDate) return { ok: false, error: `${where} ends before it starts.` }
    if (!isWholeMoney(p.initialAmount) || p.initialAmount < 0) {
      return { ok: false, error: `${where} has no usable budget amount.` }
    }
    const rawEntries = p.entries === undefined ? [] : p.entries
    if (!Array.isArray(rawEntries)) return { ok: false, error: `${where} has an unreadable list of logged days.` }

    const entries = []
    const seen = new Set()
    for (const e of rawEntries) {
      if (!e || typeof e !== 'object') return { ok: false, error: `${where} has a logged day that isn't readable.` }
      if (!isRealDate(e.date)) return { ok: false, error: `${where} has a logged day with an invalid date.` }
      if (!isWholeMoney(e.amount) || e.amount < 0) {
        return { ok: false, error: `${where} has a logged day with an invalid amount.` }
      }
      // Two records for one day would make the running total depend on array
      // order, which is not a thing the app should ever be sensitive to.
      if (seen.has(e.date)) return { ok: false, error: `${where} has the same day logged twice.` }
      seen.add(e.date)
      entries.push({ date: e.date, amount: Math.round(e.amount) })
    }
    entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

    periods.push({
      id: p.id,
      startDate: p.startDate,
      endDate: p.endDate,
      initialAmount: Math.round(p.initialAmount),
      entries
    })
  }

  // The app treats the LAST period as the current one, so the order they are
  // stored in is load-bearing rather than cosmetic.
  periods.sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0))

  const rawSettings = payload.settings && typeof payload.settings === 'object' ? payload.settings : {}
  const themeOk = THEMES.some((t) => t.id === rawSettings.theme)
  const cadenceOk = CADENCE_OPTIONS.some((c) => c.value === rawSettings.cadence)

  const data = {
    periods,
    settings: {
      theme: themeOk ? rawSettings.theme : DEFAULT_THEME,
      cadence: cadenceOk ? rawSettings.cadence : 'manual'
    }
  }

  return {
    ok: true,
    data,
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : null,
    summary: summarizeData(data)
  }
}
