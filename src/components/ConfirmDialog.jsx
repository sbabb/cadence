import { useEffect, useId, useRef, useState } from 'react'
import useBackDismiss from '../hooks/useBackDismiss.js'

// Generic centered confirm/cancel dialog. Used for the three actions that
// can lose data - importing a backup over everything, abandoning the current
// period, and narrowing a period past days that already have spending logged
// - where a plain browser confirm() would look out of place against the
// terminal styling and can't be restyled to signal danger.
//
// It behaves as a modal to everything that isn't a finger, too. A screen
// reader is told a dialog has opened and what it says (alertdialog, labelled
// by the message); Escape cancels, the same as Back and the backdrop; Tab
// cycles between the two buttons instead of wandering off into the screen
// behind; and when it closes, focus goes back to whatever opened it (see
// `opener` below).
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

  const messageId = useId()
  const dialogRef = useRef(null)

  // Whatever had focus when the dialog opened - normally the button that
  // opened it - so it can be handed back on close and a keyboard user carries
  // on from where they were rather than from the top of the page. Read on the
  // first render because it has to be: autoFocus below moves focus into the
  // dialog during the commit, before any effect runs.
  const [opener] = useState(() => (typeof document === 'undefined' ? null : document.activeElement))

  // Read through a ref for the same reason useBackDismiss does: the parent
  // hands over a fresh closure on every render, and the listener below should
  // not be torn down and re-added underneath the user each time.
  const cancelRef = useRef(onCancel)
  useEffect(() => {
    cancelRef.current = onCancel
  }, [onCancel])

  useEffect(() => {
    const dialogNode = dialogRef.current
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        cancelRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const dialog = dialogRef.current
      if (!dialog) return
      const focusable = [...dialog.querySelectorAll('button:not([disabled])')]
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const inside = dialog.contains(document.activeElement)
      if (e.shiftKey && (!inside || document.activeElement === first)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      // Only on a real close. StrictMode unmounts and remounts every effect
      // once in development with the DOM left standing, and handing focus
      // back then would pull it straight out of a dialog that is still open.
      if (dialogNode && dialogNode.isConnected) return
      // Skipped when the opener went away with the dialog, as the Abandon
      // button does when confirming it closes Settings.
      if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus()
    }
  }, [opener])

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onCancel()
  }

  // Focus lands on the safe choice when the action is destructive, so a
  // reflexive Enter backs out rather than replacing everything or ending the
  // period. A harmless confirmation still starts on its confirm button.
  return (
    <div className="confirm-backdrop" onClick={handleBackdropClick}>
      <div
        ref={dialogRef}
        className={`confirm-dialog ${danger ? 'confirm-dialog-danger' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={messageId}
      >
        <p id={messageId} className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button
            type="button"
            className={`confirm-button ${danger ? 'confirm-button-danger' : ''}`}
            onClick={onConfirm}
            autoFocus={!danger}
          >
            {confirmLabel}
          </button>
          <button type="button" className="cancel-button" onClick={onCancel} autoFocus={Boolean(danger)}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
