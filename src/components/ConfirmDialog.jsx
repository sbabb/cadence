// Generic centered confirm/cancel dialog. Used for destructive actions
// (currently just the dev-only "reset all data" button) where a plain
// browser confirm() would look out of place against the terminal styling
// and can't be restyled to signal danger.
export default function ConfirmDialog({
  message,
  confirmLabel = 'CONFIRM',
  cancelLabel = 'CANCEL',
  danger,
  onConfirm,
  onCancel
}) {
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
