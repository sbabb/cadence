// Shown after the period summary, only when the gap since the period
// ended is large enough to be worth acknowledging (see LAPSED_THRESHOLD_DAYS
// in App.jsx). Deliberately brief and neutral - one factual sentence, no
// guilt, no backfilling offered, just a clean path back to a fresh period.
export default function LapsedNotice({ gapDays, onContinue }) {
  return (
    <div className="screen lapsed-screen">
      <h1 className="screen-title">WELCOME BACK</h1>
      <p className="lapsed-message">
        Your last period ended {gapDays} {gapDays === 1 ? 'day' : 'days'} ago.
      </p>
      <p className="lapsed-submessage">
        No backfilling needed - let's just set up a fresh period and keep going.
      </p>
      <button className="primary-button" onClick={onContinue}>
        SET UP NEW PERIOD
      </button>
    </div>
  )
}
