// Backup format checks. Dependency-free, same as the other two verify
// scripts: `node scripts/verify-backup.mjs`.
//
// This file is here because import REPLACES everything. Every other bug in
// this app is recoverable by editing a number; accepting a malformed backup
// is the one that can destroy a history silently, and the one place the app
// takes a file from outside itself. So the rejections are tested as carefully
// as the happy path.

import assert from 'node:assert/strict'
import { buildBackup, parseBackup, summarizeData, BACKUP_FORMAT_VERSION } from '../src/utils/backup.js'

let checks = 0
const check = (label, fn) => {
  try {
    fn()
    checks += 1
  } catch (err) {
    console.error(`FAILED: ${label}`)
    throw err
  }
}

const sample = {
  periods: [
    {
      id: 'period-1',
      startDate: '2026-08-01',
      endDate: '2026-08-14',
      initialAmount: 700,
      entries: [
        { date: '2026-08-02', amount: 40 },
        { date: '2026-08-01', amount: 55 }
      ]
    },
    {
      id: 'period-2',
      startDate: '2026-08-15',
      endDate: '2026-08-28',
      initialAmount: 650,
      entries: [{ date: '2026-08-15', amount: 0 }]
    }
  ],
  settings: { cadence: 'biweekly', theme: 'slate' }
}

const roundTrip = (data) => parseBackup(JSON.stringify(buildBackup(data)))

// ---- the happy path --------------------------------------------------------

check('a backup round-trips without losing anything', () => {
  const result = roundTrip(sample)
  assert.equal(result.ok, true)
  assert.equal(result.data.periods.length, 2)
  assert.equal(result.data.settings.theme, 'slate')
  assert.equal(result.data.settings.cadence, 'biweekly')
  assert.equal(result.data.periods[0].initialAmount, 700)
})

check('entries come back sorted by date regardless of how they were stored', () => {
  const result = roundTrip(sample)
  assert.deepEqual(
    result.data.periods[0].entries.map((e) => e.date),
    ['2026-08-01', '2026-08-02']
  )
})

check('periods come back oldest-first, since the app treats the last as current', () => {
  const reversed = { ...sample, periods: [sample.periods[1], sample.periods[0]] }
  const result = roundTrip(reversed)
  assert.equal(result.data.periods[0].id, 'period-1')
  assert.equal(result.data.periods[1].id, 'period-2')
})

check('an explicit $0 day survives - it means "tracked, spent nothing"', () => {
  const result = roundTrip(sample)
  assert.equal(result.data.periods[1].entries.length, 1)
  assert.equal(result.data.periods[1].entries[0].amount, 0)
})

check('a period with no entries key at all is treated as untracked, not rejected', () => {
  const noEntries = { periods: [{ ...sample.periods[0], entries: undefined }], settings: {} }
  const result = roundTrip(noEntries)
  assert.equal(result.ok, true)
  assert.deepEqual(result.data.periods[0].entries, [])
})

check('an empty app exports and imports cleanly', () => {
  const result = roundTrip({ periods: [], settings: { cadence: 'manual', theme: 'tokyo-night' } })
  assert.equal(result.ok, true)
  assert.deepEqual(result.data.periods, [])
})

check('the envelope names the app and its format version', () => {
  const envelope = buildBackup(sample)
  assert.equal(envelope.app, 'cadence')
  assert.equal(envelope.formatVersion, BACKUP_FORMAT_VERSION)
  assert.ok(typeof envelope.exportedAt === 'string' && envelope.exportedAt.includes('T'))
})

check('the summary counts what the confirm dialog claims it counts', () => {
  const s = summarizeData(sample)
  assert.equal(s.periods, 2)
  assert.equal(s.loggedDays, 3)
  assert.equal(s.earliest, '2026-08-01')
  assert.equal(s.latest, '2026-08-28')
})

// ---- display preferences degrade, they do not reject -----------------------

check('an unknown theme falls back rather than rejecting real spend history', () => {
  const odd = { ...sample, settings: { cadence: 'biweekly', theme: 'solarized-whatever' } }
  const result = roundTrip(odd)
  assert.equal(result.ok, true)
  assert.equal(result.data.settings.theme, 'tokyo-night')
})

check('an unknown cadence falls back to manual', () => {
  const odd = { ...sample, settings: { cadence: 'fortnightly-ish', theme: 'slate' } }
  const result = roundTrip(odd)
  assert.equal(result.ok, true)
  assert.equal(result.data.settings.cadence, 'manual')
})

// ---- everything that must be refused ---------------------------------------

const mustReject = (label, mutate) =>
  check(`rejects: ${label}`, () => {
    const broken = mutate(JSON.parse(JSON.stringify(buildBackup(sample))))
    const result = parseBackup(typeof broken === 'string' ? broken : JSON.stringify(broken))
    assert.equal(result.ok, false, 'should have been refused')
    assert.ok(typeof result.error === 'string' && result.error.length > 0, 'needs a readable reason')
  })

mustReject('a file that is not JSON at all', () => 'this is my grocery list')
mustReject('JSON that is not an object', () => '[1, 2, 3]')
mustReject('some other app\'s export', (b) => ({ ...b, app: 'ynab' }))
mustReject('a backup from a newer version of the app', (b) => ({ ...b, formatVersion: BACKUP_FORMAT_VERSION + 1 }))
mustReject('a missing data payload', (b) => ({ ...b, data: undefined }))
mustReject('periods that are not a list', (b) => ({ ...b, data: { ...b.data, periods: 'none' } }))
mustReject('a period with no id', (b) => {
  b.data.periods[0].id = ''
  return b
})
mustReject('a start date that is not a date', (b) => {
  b.data.periods[0].startDate = 'last tuesday'
  return b
})
mustReject('a date that looks right but does not exist', (b) => {
  b.data.periods[0].startDate = '2026-02-30'
  return b
})
mustReject('a period that ends before it starts', (b) => {
  b.data.periods[0].endDate = '2026-07-01'
  return b
})
mustReject('a budget amount that is not a number', (b) => {
  b.data.periods[0].initialAmount = '700'
  return b
})
mustReject('a negative budget', (b) => {
  b.data.periods[0].initialAmount = -50
  return b
})
mustReject('a logged day with an invalid date', (b) => {
  b.data.periods[0].entries[0].date = '08/01/2026'
  return b
})
mustReject('a logged amount that is not a number', (b) => {
  b.data.periods[0].entries[0].amount = 'forty'
  return b
})
mustReject('a negative logged amount', (b) => {
  b.data.periods[0].entries[0].amount = -1
  return b
})
mustReject('the same day logged twice', (b) => {
  b.data.periods[0].entries.push({ date: b.data.periods[0].entries[0].date, amount: 12 })
  return b
})
mustReject('an entry that is not an object', (b) => {
  b.data.periods[0].entries.push(42)
  return b
})

console.log(`${checks}/${checks} backup checks passed`)
