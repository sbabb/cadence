import useBackDismiss from '../hooks/useBackDismiss.js'

// Generic centered confirm/cancel dialog. Used for the three actions that
// can lose data - importing a backup over everything, abandoning the current
// period, and narrowing a period past days that already have spending logged
// - where a plain browser confirm() would look out of place against the
// terminal styling and can't be restyled to signal danger.
export default function ConfirmDialog({
  message,
  confirmLabel = 'CONFIRM',
  cancelLabel = 'CANCEL',
  danger,
  onConfirm,
  onCancel
}) {
  // Back dismisses the dialog, which is what every other dialog on the
  // phone does. It sits above whatever opened it, so this closes the
  // dialog only and leaves that screen where it was.
  useBackDismiss(onCancel)

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onCancel()
  }

  return (
    <div className="confirm-backdrop" onClick={handleBackdropClick}>
      <div className={`confirm-dialog ${danger ? 'confirm-dialog-danger' : ''}`}>
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button
            className={`confirm-button ${danger ? 'confirm-button-danger' : ''}`}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </button>
          <button className="cancel-button" onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
