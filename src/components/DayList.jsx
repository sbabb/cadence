import { formatDisplayDateWithDay } from '../utils/dateUtils.js'
import { formatMoney } from '../utils/format.js'

// Renders one period's day-by-day list. Shared between the active period
// (Dashboard.jsx, `editable`) and a historical period being viewed in the
// swipeable pager (PastPeriodView.jsx, read-only) - the row content and
// color coding are identical either way; only whether rows respond to taps
// differs.
//
// In an editable list, tapping a row SELECTS that day: the dial above swings
// to show it, and the dial becomes the place you log or edit its spend. The
// row list is therefore a day picker, not a second editing surface.
export default function DayList({ schedule, editable, selectedDate, onSelectDay }) {
  return (
    <div className="day-list">
      <div className="day-list-header">
        <span className="day-row-date">DATE</span>
        <span className="day-row-spent">SPENT</span>
        <span className="day-row-limit">LIMIT</span>
      </div>
      {schedule.map((row) => {
        // Spent column: a real logged amount always wins. Otherwise the
        // wording tells you WHY there's nothing to show - "unlogged" for
        // a past day you had the chance to track and didn't, "NOT
        // LOGGED" for today (still actionable), "--" for a day that
        // hasn't happened yet.
        let spentDisplay
        if (row.logged) {
          spentDisplay = formatMoney(row.amount)
        } else if (row.isToday) {
          spentDisplay = 'NOT LOGGED'
        } else if (row.isPast) {
          spentDisplay = 'unlogged'
        } else {
          spentDisplay = '—'
        }

        // Limit column always shows a real dollar figure now (never a
        // dash) - buildPeriodSchedule guarantees every row has either its
        // own historical limit or the current live limit as a fallback.
        const limitDisplay = row.dailyLimit === null ? '—' : formatMoney(row.dailyLimit)

        // Status colour applies to ANY row with a real logged amount,
        // today very much included. It used to skip today on the grounds
        // that the "this is today" highlight took precedence, but today is
        // marked by its left border and background rather than by text
        // colour, so there was never a genuine conflict - and leaving
        // today's row neutral while the dial above it sat in red was the
        // app contradicting itself for the whole day. A deliberate $0 log
        // is checked first: it's its own achievement, not "under limit" in
        // the same sense as a small spend.
        let statusClass = ''
        if (row.logged) {
          if (row.amount === 0) statusClass = 'day-row-zero'
          else if (row.amount < row.dailyLimit) statusClass = 'day-row-under'
          else if (row.amount > row.dailyLimit) statusClass = 'day-row-over'
          else statusClass = 'day-row-atlimit'
        }

        // Today and past days can be selected in an editable list. Future
        // days can't - there's nothing to look at and nothing to log.
        const selectable = editable && !row.isFuture
        const isSelected = selectable && row.date === selectedDate

        const rowClassName = [
          'day-row',
          row.isToday ? 'day-row-today' : '',
          row.isUnknown ? 'day-row-unknown' : '',
          statusClass,
          selectable ? 'day-row-clickable' : '',
          isSelected ? 'day-row-selected' : ''
        ]
          .filter(Boolean)
          .join(' ')

        return (
          <div
            key={row.date}
            className={rowClassName}
            onClick={selectable ? () => onSelectDay(row.date) : undefined}
            role={selectable ? 'button' : undefined}
            tabIndex={selectable ? 0 : undefined}
            aria-pressed={selectable ? isSelected : undefined}
            onKeyDown={
              selectable
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelectDay(row.date)
                    }
                  }
                : undefined
            }
          >
            <span className="day-row-date">{formatDisplayDateWithDay(row.date)}</span>
            <span className="day-row-spent">{spentDisplay}</span>
            <span className="day-row-limit">{limitDisplay}</span>
          </div>
        )
      })}
    </div>
  )
}
