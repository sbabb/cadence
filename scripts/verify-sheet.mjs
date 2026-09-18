import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { amountFromInput } from '../src/utils/spendInput.js'

// Checks on the spend sheet's reading of its own amount field.
//
// This suite exists because the sheet shipped treating an empty field as $0.
// The sheet opens with the field focused, the Android keyboard opens with it,
// and the keyboard's checkmark submits the form - so dismissing a keyboard you
// did not mean to summon recorded a $0 spend for a day you had not touched.
// It was reported from the phone as the first day of a new period reading $43
// while every day behind it read $47: a stray entry nobody made, repricing the
// rest of the period. Check 1 is the rule it got wrong.

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

check('an empty field is not an amount', () => {
  assert.equal(amountFromInput(''), null)
})

check('a deliberately typed zero IS an amount, and it is zero', () => {
  // The distinction the bug collapsed. A typed 0 is a real claim about the
  // day - nothing spent - and the app has always recorded those.
  assert.equal(amountFromInput('0'), 0)
})

check('null and 0 are told apart by identity, not by truthiness', () => {
  // `if (!amount)` would treat a logged zero-spend day as an empty field and
  // reintroduce the bug from the other side.
  assert.notEqual(amountFromInput('0'), amountFromInput(''))
  assert.equal(amountFromInput('0') === null, false)
})

// --- 2. ORDINARY READINGS. ------------------------------------------------

check('plain digits read as whole dollars', () => {
  assert.equal(amountFromInput('6'), 6)
  assert.equal(amountFromInput('43'), 43)
  assert.equal(amountFromInput('1234'), 1234)
})

check('leading zeros do not change the figure', () => {
  assert.equal(amountFromInput('007'), 7)
  assert.equal(amountFromInput('00'), 0)
})

// --- 3. NOTHING-SHAPED INPUT IS NOTHING. ----------------------------------

check('a field holding no digits at all is not an amount', () => {
  for (const raw of [' ', '   ', '$', '.', '-', 'abc', '$.']) {
    assert.equal(amountFromInput(raw), null, `"${raw}" should not read as an amount`)
  }
})

check('a missing or non-string value is not an amount', () => {
  for (const raw of [null, undefined, 0, 6, {}, []]) {
    assert.equal(amountFromInput(raw), null)
  }
})

check('digits mixed with junk still read, rather than being thrown away', () => {
  assert.equal(amountFromInput('$6'), 6)
  assert.equal(amountFromInput('6 '), 6)
})

// --- 4. THE SHEET ACTUALLY USES IT. ---------------------------------------
//
// The rule being right in this file is worth nothing if the component still
// does its own parsing - which is exactly how the bug survived.

check('LogSpend.jsx reads its field through amountFromInput and nowhere else', () => {
  const src = readFileSync(new URL('../src/components/LogSpend.jsx', import.meta.url), 'utf8')
  assert.match(src, /import \{ amountFromInput \} from '\.\.\/utils\/spendInput\.js'/)
  assert.match(src, /amountFromInput\(amountInput\)/)
  assert.ok(
    !/parseInt\(amountInput/.test(src),
    'the sheet should not parse the field itself'
  )
  assert.ok(
    !/amountInput === ''/.test(src),
    'the sheet should not test the field for emptiness itself'
  )
})

check('neither confirm path can fire without an amount', () => {
  const src = readFileSync(new URL('../src/components/LogSpend.jsx', import.meta.url), 'utf8')
  // Both handlers must bail before calling onConfirm.
  for (const handler of ['handleSubmit', 'handleSetTotal']) {
    const body = src.slice(src.indexOf(`const ${handler} =`))
    const guard = body.indexOf('if (!hasAmount) return')
    const confirm = body.indexOf('onConfirm(')
    assert.ok(guard !== -1, `${handler} has no empty-field guard`)
    assert.ok(guard < confirm, `${handler} confirms before checking the field`)
  }
})

check('an empty sheet shows its buttons unarmed rather than silently ignoring taps', () => {
  const src = readFileSync(new URL('../src/components/LogSpend.jsx', import.meta.url), 'utf8')
  const disabled = src.match(/disabled=\{!hasAmount\}/g) || []
  assert.equal(disabled.length, 2, 'both LOG SPEND/ADD and SET TOTAL should disable while empty')
})

console.log(`\n${checks - failures}/${checks} spend sheet checks passed`)
if (failures > 0) process.exit(1)
