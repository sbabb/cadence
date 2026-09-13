import { useState } from 'react'
import { formatMoney } from '../utils/format.js'
import useKeyboardInset from '../hooks/useKeyboardInset.js'
import useBackDismiss from '../hooks/useBackDismiss.js'

// The spend sheet. Both ways of recording a number live here now:
//
//   ADD       - the everyday action. Each tap is another transaction and it
//               accumulates onto whatever the day already holds.
//   SET TOTAL - the correction. Overwrites the day's figure outright.
//
// These used to be decided BEFORE the sheet opened, with "EDIT TOTAL" sitting
// on the dashboard as a permanent link. Out of context it was unexplainable -
// the user who commissioned it asked what it was. Here the day's running total
// is on screen directly above the buttons, so "add 20" versus "set total to
// 20" needs no explanation at all.
//
// SET TOTAL only appears once the day HAS a total. On an empty day the two
// actions are arithmetically identical, so offering both would be a choice
// without a difference. That also makes the rule uniform: it depends on
// whether the day has a figure, not on whether the day is today, so a past day
// can now be added to as well as overwritten.
export default function LogSpend({ currentTotal, alreadyLogged, dailyLimit, isToday, dateLabel, onConfirm, onCancel }) {
  // Back cancels the sheet rather than leaving the app - the same as
  // CANCEL, and the same as tapping the backdrop.
  useBackDismiss(onCancel)

  const [amountInput, setAmountInput] = useState('')

  // The sheet is anchored to the bottom of the screen, which is exactly where
  // the Android keyboard opens. On browsers that shrink the layout viewport
  // this reads 0 and nothing moves; everywhere else it's the height of the
  // keyboard, and the backdrop pads itself by that much so SET TOTAL and
  // CANCEL sit above it instead of behind it.
  const keyboardInset = useKeyboardInset()

  const handleAmountChange = (e) => {
    setAmountInput(e.target.value.replace(/[^0-9]/g, ''))
  }

  const amount = amountInput === '' ? 0 : parseInt(amountInput, 10)

  // Submitting the FORM is the add. That's what makes the phone keyboard's
  // checkmark work: without a form there was nothing for it to submit, so the
  // key did nothing and the keyboard had to be dismissed by hand first.
  const handleSubmit = (e) => {
    e.preventDefault()
    onConfirm(amount, 'add')
  }

  const handleSetTotal = () => {
    onConfirm(amount, 'replace')
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onCancel()
  }

  return (
    <div
      className="log-spend-backdrop"
      onClick={handleBackdropClick}
      style={{ paddingBottom: keyboardInset }}
    >
      <form
        className={`log-spend-sheet ${keyboardInset > 0 ? 'log-spend-sheet-lifted' : ''}`}
        onSubmit={handleSubmit}
      >
        <div className="log-spend-title">{isToday ? 'TODAY' : dateLabel}</div>

        <div className="log-spend-context">
          DAILY LIMIT {formatMoney(dailyLimit)}
          {alreadyLogged && (
            <>
              {' · '}
              <span className="log-spend-logged">LOGGED {formatMoney(currentTotal)}</span>
            </>
          )}
        </div>

        <div className="log-spend-input-row">
          <span className="dollar-sign">$</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            enterKeyHint="done"
            placeholder="0"
            value={amountInput}
            onChange={handleAmountChange}
            autoFocus
            aria-label="Amount"
          />
        </div>

        <button type="submit" className="primary-button">
          {alreadyLogged ? 'ADD' : 'LOG SPEND'}
        </button>

        <div className="log-spend-secondary">
          {alreadyLogged && (
            <button type="button" className="cancel-button" onClick={handleSetTotal}>
              SET TOTAL
            </button>
          )}
          <button type="button" className="cancel-button" onClick={onCancel}>
            CANCEL
          </button>
        </div>
      </form>
    </div>
  )
}
