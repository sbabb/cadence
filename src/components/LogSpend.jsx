import { useState } from 'react'

// One sheet, three flows, distinguished by `mode`:
//  - mode 'add' (the dashboard's main today-tile): logs a NEW transaction
//    that gets ADDED onto today's existing running total. The amount
//    field always starts BLANK here - it's a fresh transaction amount,
//    never the total itself, so there's nothing sensible to pre-fill.
//  - mode 'replace' + isToday (the "EDIT TOTAL" link): lets the user
//    manually overwrite today's exact running total to correct a mistake.
//    Pre-filled with the current total; whatever's confirmed REPLACES it.
//  - mode 'replace' + a past date (tapping a day-list row): same
//    set-the-exact-value semantics as EDIT TOTAL, but for a historical day.
// `dateLabel` is the already-formatted display date, used for past days.
export default function LogSpend({
  mode,
  initialAmount,
  currentTotal,
  alreadyLogged,
  dailyLimit,
  isToday,
  dateLabel,
  onConfirm,
  onCancel
}) {
  const [amountInput, setAmountInput] = useState(
    mode === 'replace' && initialAmount ? String(initialAmount) : ''
  )

  const handleAmountChange = (e) => {
    const digitsOnly = e.target.value.replace(/[^0-9]/g, '')
    setAmountInput(digitsOnly)
  }

  const handleConfirm = () => {
    const amount = amountInput === '' ? 0 : parseInt(amountInput, 10)
    onConfirm(amount)
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onCancel()
  }

  let title
  if (mode === 'add') {
    title = "ADD TO TODAY'S SPEND"
  } else if (isToday) {
    title = "EDIT TODAY'S TOTAL"
  } else {
    const verb = alreadyLogged ? 'EDIT' : 'LOG'
    title = `${verb} SPEND — ${dateLabel}`
  }

  const confirmLabel = mode === 'add' ? 'ADD' : 'CONFIRM'

  return (
    <div className="log-spend-backdrop" onClick={handleBackdropClick}>
      <div className="log-spend-sheet">
        <div className="log-spend-title">{title}</div>
        <div className="log-spend-limit">DAILY LIMIT: ${Math.round(dailyLimit)}</div>
        {mode === 'add' && currentTotal > 0 && (
          <div className="log-spend-limit">CURRENT TOTAL: ${Math.round(currentTotal)}</div>
        )}

        <div className="log-spend-input-row">
          <span className="dollar-sign">$</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="0"
            value={amountInput}
            onChange={handleAmountChange}
            autoFocus
          />
        </div>

        <button className="primary-button" onClick={handleConfirm}>
          {confirmLabel}
        </button>
        <button className="cancel-button" onClick={onCancel}>
          CANCEL
        </button>
      </div>
    </div>
  )
}
