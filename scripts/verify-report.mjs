import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildReportCard, assessmentFor, reportCardFilename } from '../src/utils/reportCard.js'
import { reportCardLayout, CARD_WIDTH } from '../src/utils/reportCardLayout.js'
import { reconcilePeriod, summarizePeriod } from '../src/utils/budgetEngine.js'

// Checks on the report card - what it says about a period, and where that
// lands on the saved image.
//
// The card is reachable for ANY period now, not just the one that happens to
// be closing, and it can leave the app as a PNG that outlives it. Both of
// those raise the cost of being wrong: a screen you can re-open is a screen
// someone will check against their bank, and an image can be sent to someone
// who has no way to audit it. So the figures and the verdict are computed in
// one pure place, and the image's layout is arithmetic a script can walk
// rather than a screenshot of a stylesheet.

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

const period = {
  startDate: '2026-09-03',
  endDate: '2026-09-16', // 14 days, $600
  initialAmount: 600,
  entries: [
    { date: '2026-09-03', amount: 80 },
    { date: '2026-09-04', amount: 20 },
    { date: '2026-09-05', amount: 43 }
  ]
}
const card = buildReportCard(period, reconcilePeriod(period, '2026-09-17'))
const valueOf = (c, label) => c.rows.find((r) => r.label === label).value

// --- 1. WHAT THE CARD SAYS. -----------------------------------------------

check('the card reports the period it was built from', () => {
  assert.equal(card.range, 'Thu Sep 3 -> Wed Sep 16')
  assert.equal(valueOf(card, 'TOTAL SPENT'), '$143')
  assert.equal(valueOf(card, 'TOTAL BUDGET'), '$600')
  assert.equal(valueOf(card, 'DAYS TRACKED'), '3')
  assert.equal(valueOf(card, 'REMAINING AT END'), '$457')
})

check('every row has a label and a printable value', () => {
  assert.ok(card.rows.length >= 6)
  for (const row of card.rows) {
    assert.equal(typeof row.label, 'string')
    assert.equal(typeof row.value, 'string')
    assert.ok(row.label.length > 0, 'a row with no label')
    assert.ok(row.value.length > 0, `${row.label} has no value`)
  }
})

check('the card agrees with the engine rather than recomputing anything', () => {
  const summary = summarizePeriod(period, reconcilePeriod(period, '2026-09-17'))
  assert.equal(valueOf(card, 'DAYS OVER LIMIT'), String(summary.daysOver))
  assert.equal(valueOf(card, 'DAYS UNDER LIMIT'), String(summary.daysUnder))
  assert.equal(valueOf(card, 'DAYS AT LIMIT'), String(summary.daysAtLimit))
})

// --- 2. A PERIOD NOBODY TRACKED. ------------------------------------------
//
// The one place the card could invent a figure, and the app's oldest rule
// says it must not.

check('an untracked period reports no spend figure rather than $0', () => {
  const empty = { ...period, entries: [] }
  const c = buildReportCard(empty, reconcilePeriod(empty, '2026-09-17'))
  assert.equal(valueOf(c, 'TOTAL SPENT'), '—')
  assert.equal(valueOf(c, 'DAYS TRACKED'), '0')
  assert.equal(c.assessment.text, 'NO DAYS TRACKED THIS PERIOD')
  assert.equal(c.assessment.tone, 'neutral')
})

// --- 3. THE VERDICT. ------------------------------------------------------

check('the verdict states the direction and the amount', () => {
  assert.deepEqual(assessmentFor({ daysTracked: 5, remaining: 120 }), {
    text: 'UNDER BUDGET BY $120',
    tone: 'good'
  })
  assert.deepEqual(assessmentFor({ daysTracked: 5, remaining: -130 }), {
    text: 'OVER BUDGET BY $130',
    tone: 'over'
  })
  assert.deepEqual(assessmentFor({ daysTracked: 5, remaining: 0 }), {
    text: 'EXACTLY ON BUDGET',
    tone: 'neutral'
  })
})

check('an overspend is stated as a positive amount in the OVER direction', () => {
  // "OVER BUDGET BY -$130" would be two negatives cancelling into nonsense.
  const v = assessmentFor({ daysTracked: 5, remaining: -130 })
  assert.ok(!v.text.includes('-'), v.text)
})

check('every tone the card can produce has a colour on the image', () => {
  // reportCardImage maps these onto theme variables; a tone with no mapping
  // would silently paint the verdict in the body colour.
  const tones = new Set(
    [120, 0, -130].map((remaining) => assessmentFor({ daysTracked: 1, remaining }).tone)
  )
  tones.add(assessmentFor({ daysTracked: 0, remaining: 600 }).tone)
  const src = readFileSync(new URL('../src/utils/reportCardImage.js', import.meta.url), 'utf8')
  for (const tone of tones) {
    assert.match(src, new RegExp(`\\b${tone}:\\s*'--`), `no colour mapped for the "${tone}" verdict`)
  }
})

// --- 4. THE SAVED FILE. ---------------------------------------------------

check('the filename names the period, not the day it was saved', () => {
  // These pile up in a downloads folder; two cards saved on the same day must
  // not collide, and one saved months later must still say which period.
  assert.equal(reportCardFilename(period), 'cadence-report-2026-09-03.png')
  assert.notEqual(
    reportCardFilename(period),
    reportCardFilename({ startDate: '2026-09-17' })
  )
})

// --- 5. WHERE IT ALL LANDS ON THE IMAGE. ----------------------------------

check('the layout draws every row of the card, label and figure', () => {
  const layout = reportCardLayout(card)
  const drawn = layout.items.filter((i) => i.kind === 'text').map((i) => i.text)
  for (const row of card.rows) {
    assert.ok(drawn.includes(row.label), `${row.label} is missing from the image`)
    assert.ok(drawn.includes(row.value), `${row.label}'s figure is missing from the image`)
  }
  assert.ok(drawn.includes(card.range), 'the image does not say which period it is')
  assert.ok(drawn.includes(card.assessment.text), 'the image has no verdict')
})

check('nothing is drawn outside the image', () => {
  const layout = reportCardLayout(card)
  for (const item of layout.items) {
    const xs = item.kind === 'rule' ? [item.x1, item.x2] : [item.x]
    for (const x of xs) {
      assert.ok(x >= 0 && x <= CARD_WIDTH, `${item.text || 'rule'} sits at x=${x}`)
    }
    assert.ok(item.y > 0 && item.y < layout.height, `${item.text || 'rule'} sits at y=${item.y}`)
  }
})

check('the image grows to fit a card with more rows, rather than clipping', () => {
  const short = reportCardLayout({ ...card, rows: card.rows.slice(0, 3) })
  const long = reportCardLayout({ ...card, rows: [...card.rows, ...card.rows] })
  assert.ok(long.height > short.height)
  // And the last thing on the longer card is still inside it.
  const lowest = Math.max(...long.items.map((i) => i.y))
  assert.ok(lowest < long.height, 'the bottom of the card is cut off')
})

check('rows do not overlap each other', () => {
  const layout = reportCardLayout(card)
  const rowYs = layout.items
    .filter((i) => i.kind === 'text' && card.rows.some((r) => r.label === i.text))
    .map((i) => i.y)
  for (let i = 1; i < rowYs.length; i++) {
    assert.ok(rowYs[i] > rowYs[i - 1], 'two rows share a baseline')
    assert.ok(rowYs[i] - rowYs[i - 1] >= 40, 'two rows are too close to read')
  }
})

check('a label and its figure sit on the same line, at opposite ends', () => {
  const layout = reportCardLayout(card)
  for (const row of card.rows) {
    const label = layout.items.find((i) => i.text === row.label)
    const value = layout.items.find((i) => i.y === label.y && i.align === 'right')
    assert.ok(value, `${row.label} has no figure beside it`)
    assert.equal(value.text, row.value)
    assert.equal(label.align, 'left')
  }
})

// --- 6. THE SCREENS USE IT. -----------------------------------------------

check('the report card screen builds its content from the shared model', () => {
  const src = readFileSync(new URL('../src/components/ReportCard.jsx', import.meta.url), 'utf8')
  assert.match(src, /import \{ buildReportCard \} from '\.\.\/utils\/reportCard\.js'/)
  assert.match(src, /buildReportCard\(period, reconciled\)/)
})

check('the end-of-period recap states the same verdict from the same place', () => {
  // These two screens describe the same period. When they disagreed it was
  // because each worked the verdict out for itself.
  const src = readFileSync(new URL('../src/components/PeriodSummary.jsx', import.meta.url), 'utf8')
  assert.match(src, /assessmentFor\(summary\)/)
  assert.ok(
    !/UNDER BUDGET BY/.test(src),
    'the recap should not spell the verdict out itself'
  )
})

check('the button is the day list\'s footer, inside the table', () => {
  // It hung below the list to begin with, and the gap read as an afterthought
  // bolted to the bottom of the screen. Being INSIDE .day-list is what makes
  // it the period's footer rather than something parked underneath it.
  const src = readFileSync(new URL('../src/components/DayList.jsx', import.meta.url), 'utf8')
  const listOpen = src.indexOf('<div className="day-list">')
  const button = src.indexOf('className="day-list-footer"')
  const listClose = src.lastIndexOf('</div>')
  assert.ok(listOpen !== -1 && button > listOpen, 'the footer is not inside the day list')
  assert.ok(button < listClose, 'the footer is outside the day list')
})

check('every period gets the button, current or finished', () => {
  // One list component serves both, so the footer cannot be given to one and
  // withheld from the other by accident - but both still have to pass it on.
  const dash = readFileSync(new URL('../src/components/Dashboard.jsx', import.meta.url), 'utf8')
  const past = readFileSync(new URL('../src/components/PastPeriodView.jsx', import.meta.url), 'utf8')
  const pager = readFileSync(new URL('../src/components/PeriodPager.jsx', import.meta.url), 'utf8')
  assert.match(dash, /onOpenReportCard=\{onOpenReportCard\}/, 'the current period does not pass it to its list')
  assert.match(past, /onOpenReportCard=\{onOpenReportCard\}/, 'a finished period does not pass it to its list')
  assert.equal(
    (pager.match(/onOpenReportCard=\{openReportCard\}/g) || []).length,
    2,
    'the pager must hand it to BOTH the current period and a finished one'
  )
  assert.match(pager, /onOpenReportCard\(viewIndex\)/, 'the card opens some other period than the one on screen')
})

check('the footer is not hidden behind the editable/read-only distinction', () => {
  // A finished period is the one you are most likely to want a card for, so
  // the footer must not be tied to the rows being tappable.
  // Comments stripped first: this file EXPLAINS that the footer is outside the
  // editable distinction, and a check that reads prose cannot tell the
  // explanation from the thing it describes.
  const src = readFileSync(new URL('../src/components/DayList.jsx', import.meta.url), 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  // Anchored on the button itself and read BACKWARDS to the end of the rows,
  // so the slice cannot be moved by the very edit it is meant to catch.
  const button = src.indexOf('className="day-list-footer"')
  const rowsEnd = src.lastIndexOf('})}', button)
  assert.ok(button !== -1 && rowsEnd !== -1, 'the footer is not where this check can find it')
  const guard = src.slice(rowsEnd, button)
  assert.ok(!guard.includes('editable'), 'the footer is conditional on the list being editable')
})

check('the back button closes the card', () => {
  const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(src, /useBackDismiss\(\(\) => setReportCardIndex\(null\), reportCardIndex !== null\)/)
})

console.log(`\n${checks - failures}/${checks} report card checks passed`)
if (failures > 0) process.exit(1)
