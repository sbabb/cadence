import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { limitStat } from '../src/utils/limitStat.js'
import { reconcilePeriod } from '../src/utils/budgetEngine.js'

// Checks on the DAILY LIMIT TODAY stat box.
//
// This suite exists because that box shipped saying "$43 / usual target" on a
// day when the budget was $130 in the hole and today's row in the list right
// beneath it said $0. Nothing in the repo could have caught it: the rule lived
// inside a React component, where no script could reach it. It lives in
// src/utils/limitStat.js now, and the rule it got wrong is check 1.

let checks = 0
let failures = 0

function check(name, fn) {
  checks += 1
  try {
    fn()
  } catch (err) {
    failures += 1
    console.error(`FAIL: ${name}`)
    console.error(`  ${err.message}`)
  }
}

// --- 1. THE BUG. ----------------------------------------------------------
//
// Spend the budget out and the last day's live limit is $0. The box must say
// so. The baseline is what the days were WORTH, not what is left to spend.
check('last day, budget spent out: the box shows $0, not the baseline', () => {
  const stat = limitStat({
    isLastDay: true,
    todayLimit: 0,
    baselineDailyLimit: 43,
    todaySpent: 36,
    previousDayLimit: 0
  })
  assert.equal(stat.amount, 0)
  assert.equal(stat.showingBaseline, false)
  assert.notEqual(stat.note, 'usual target')
})

// The same day before anything is logged. Nothing spent today is not a reason
// to advertise a limit that does not exist.
check('last day, budget already gone, nothing logged today: still $0', () => {
  const stat = limitStat({
    isLastDay: true,
    todayLimit: 0,
    baselineDailyLimit: 43,
    todaySpent: 0,
    previousDayLimit: 0
  })
  assert.equal(stat.amount, 0)
  assert.equal(stat.showingBaseline, false)
})

// --- 2. What the substitution is actually for. ----------------------------
check('last day, big surplus rolled forward: the box shows the steady baseline', () => {
  const stat = limitStat({
    isLastDay: true,
    todayLimit: 140,
    baselineDailyLimit: 43,
    todaySpent: 0,
    previousDayLimit: 45
  })
  assert.equal(stat.amount, 43)
  assert.equal(stat.showingBaseline, true)
  assert.equal(stat.note, 'usual target')
})

check('the baseline never replaces a live limit that is merely equal to it', () => {
  const stat = limitStat({
    isLastDay: true,
    todayLimit: 43,
    baselineDailyLimit: 43,
    todaySpent: 0,
    previousDayLimit: 43
  })
  assert.equal(stat.amount, 43)
  assert.equal(stat.showingBaseline, false)
})

// Under the baseline but not at zero - a partial shortfall. The honest figure
// is the live one: it is the number today is judged against, and the number
// today's row in the day list prints.
check('last day, some budget left but under the baseline: the live figure stands', () => {
  const stat = limitStat({
    isLastDay: true,
    todayLimit: 12,
    baselineDailyLimit: 43,
    todaySpent: 0,
    previousDayLimit: 20
  })
  assert.equal(stat.amount, 12)
  assert.equal(stat.showingBaseline, false)
})

// --- 3. The box and the day list can never disagree. ----------------------
//
// The invariant the bug broke, stated directly: off the last day the figure IS
// the live limit, and on the last day it only ever differs by being SMALLER
// than the live one. It may never claim more is spendable than there is.
check('the box never shows more than the live limit allows', () => {
  for (const isLastDay of [false, true]) {
    for (let todayLimit = 0; todayLimit <= 300; todayLimit += 3) {
      for (const baselineDailyLimit of [0, 1, 15, 43, 200]) {
        const { amount } = limitStat({ isLastDay, todayLimit, baselineDailyLimit })
        assert.ok(
          amount <= todayLimit,
          `last=${isLastDay} live=$${todayLimit} baseline=$${baselineDailyLimit} showed $${amount}`
        )
        if (!isLastDay) assert.equal(amount, todayLimit)
      }
    }
  }
})

// --- 4. The note under the figure. ----------------------------------------
check('zero reads as nothing left, never as steady', () => {
  for (const todaySpent of [0, 1, 500]) {
    const { note } = limitStat({
      isLastDay: false,
      todayLimit: 0,
      baselineDailyLimit: 43,
      todaySpent
    })
    assert.equal(note, 'nothing left', `spent $${todaySpent} today`)
  }
})

check('spending the day out says so; spending under it holds steady', () => {
  const base = { isLastDay: false, todayLimit: 40, baselineDailyLimit: 43, previousDayLimit: 40 }
  assert.equal(limitStat({ ...base, todaySpent: 40 }).note, 'spent out')
  assert.equal(limitStat({ ...base, todaySpent: 55 }).note, 'spent out')
  assert.equal(limitStat({ ...base, todaySpent: 39 }).note, 'steady')
  assert.equal(limitStat({ ...base, todaySpent: 0 }).note, 'steady')
})

// --- 5. The delta. --------------------------------------------------------
check('the delta reports the live movement, and survives a spent-out day', () => {
  assert.equal(
    limitStat({
      isLastDay: false,
      todayLimit: 30,
      baselineDailyLimit: 43,
      todaySpent: 60,
      previousDayLimit: 45
    }).delta,
    -15
  )
  assert.equal(
    limitStat({
      isLastDay: false,
      todayLimit: 48,
      baselineDailyLimit: 43,
      todaySpent: 0,
      previousDayLimit: 45
    }).delta,
    3
  )
})

check('an unmoved limit reports no delta, so the note gets the slot', () => {
  const stat = limitStat({
    isLastDay: false,
    todayLimit: 45,
    baselineDailyLimit: 43,
    todaySpent: 0,
    previousDayLimit: 45
  })
  assert.equal(stat.delta, null)
  assert.equal(stat.note, 'steady')
})

check('the static baseline has nothing to compare against, so never a delta', () => {
  const stat = limitStat({
    isLastDay: true,
    todayLimit: 140,
    baselineDailyLimit: 43,
    todaySpent: 0,
    previousDayLimit: 45
  })
  assert.equal(stat.delta, null)
})

check('no first day delta, since there is no yesterday to compare against', () => {
  assert.equal(
    limitStat({ isLastDay: false, todayLimit: 43, baselineDailyLimit: 43, previousDayLimit: null })
      .delta,
    null
  )
})

// --- 6. Outside a period there is no figure to show. ----------------------
check('a null live limit produces a blank box rather than a fabricated zero', () => {
  const stat = limitStat({ isLastDay: false, todayLimit: null, baselineDailyLimit: 43 })
  assert.equal(stat.amount, null)
  assert.equal(stat.note, null)
  assert.equal(stat.delta, null)
})

// --- 7. End to end, against the engine that feeds it. ---------------------
//
// The numbers above are hand-written. This one is the user's own period, run
// through reconcilePeriod, so the box is checked against what the app will
// actually hand it rather than against my arithmetic.
check("the reported period's last day: engine says $0, so the box says $0", () => {
  const spends = {
    '2026-09-03': 6,
    '2026-09-04': 160,
    '2026-09-05': 22,
    '2026-09-07': 77,
    '2026-09-09': 30,
    '2026-09-10': 39,
    '2026-09-11': 30,
    '2026-09-12': 116,
    '2026-09-13': 208,
    '2026-09-15': 6,
    '2026-09-16': 36
  }
  const period = {
    id: 'p',
    startDate: '2026-09-03',
    endDate: '2026-09-16',
    initialAmount: 600,
    entries: Object.entries(spends).map(([date, amount]) => ({ date, amount }))
  }
  const r = reconcilePeriod(period, '2026-09-16')
  assert.equal(r.todayInfo.baselineDailyLimit, 43, 'baseline should be ceil(600/14)')
  assert.equal(r.todayInfo.dailyLimit, 0, 'engine should have the live limit floored at zero')
  assert.equal(r.todayInfo.remainingAfter, -130, 'and the hole should be $130 deep')

  const stat = limitStat({
    isLastDay: true,
    todayLimit: r.todayInfo.dailyLimit,
    baselineDailyLimit: r.todayInfo.baselineDailyLimit,
    todaySpent: r.todayInfo.amount,
    previousDayLimit: 0
  })
  assert.equal(stat.amount, 0, 'the screenshot showed $43 here')
})

// --- 8. The component actually uses it. -----------------------------------
//
// Every check above is worthless if Dashboard.jsx still computes the figure
// itself. That is precisely the failure that reaches a phone silently.
check('Dashboard.jsx takes its figure from limitStat and nowhere else', () => {
  const src = readFileSync(new URL('../src/components/Dashboard.jsx', import.meta.url), 'utf8')
  assert.match(src, /import \{ limitStat \} from '\.\.\/utils\/limitStat\.js'/)
  assert.match(src, /limitStat\(\{/)
  assert.ok(
    !/baselineDailyLimit\s*:\s*\w+\s*\?/.test(src.replace(/limitStat\(\{[^}]*\}\)/gs, '')),
    'the baseline substitution should not be re-implemented in the component'
  )
})

console.log(`\n${checks - failures}/${checks} stat box checks passed`)
if (failures > 0) process.exit(1)
