// The one failure this app cannot afford to be quiet about.
//
// There is no backend. localStorage is not a cache in front of a server, it is
// the only copy - so a refused write means the spend you just logged exists
// nowhere but this tab's memory, and closing it ends the matter. That used to
// be a console.error, which on a phone is the same as saying nothing.
//
// Deliberately not a modal. The app still works, the numbers on screen are
// still right, and blocking the screen over it would be a worse trade than
// letting someone finish what they were doing while knowing where they stand.
// It sits above everything, states the consequence rather than the cause, and
// can be dismissed - the next failed write puts it straight back.
export default function StorageWarning({ kind, onDismiss }) {
  const message =
    kind === 'write'
      ? 'Changes are not being saved. Your phone or browser is refusing to store data — anything logged now will be gone when you close this tab.'
      : 'Saved data could not be read, so Cadence has started empty. The old data may still be there — avoid logging anything until you have checked, since a new period will overwrite it.'

  return (
    <div className="storage-warning" role="alert">
      <div className="storage-warning-body">
        <span className="storage-warning-label">
          {kind === 'write' ? 'NOT SAVING' : 'COULD NOT READ SAVED DATA'}
        </span>
        <span className="storage-warning-text">{message}</span>
      </div>
      <button type="button" className="storage-warning-dismiss" onClick={onDismiss} aria-label="Dismiss">
        ✕
      </button>
    </div>
  )
}
