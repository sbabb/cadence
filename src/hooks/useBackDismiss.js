import { useEffect, useRef } from 'react'
import { createBackStack } from '../utils/backStack.js'

// Registers the calling component as the top dismissible layer for as long as
// it is mounted, so the Android back button (or back swipe, or a browser's
// back arrow) closes it.
//
//     useBackDismiss(onBack)
//
// That is the whole API, and it works because every overlay in this app is
// already rendered conditionally - Settings, the FAQ, the spend sheet and the
// confirm dialogs all unmount when they close. Mounted therefore means open,
// so the hook needs no isOpen argument to get wrong, and the order layers
// mount in is the order back takes them off. Nothing has to be declared in a
// central list either, which matters more than it sounds: the next dialog
// anyone adds gets correct back behaviour by being a dialog, rather than by
// somebody remembering to register it somewhere else in the tree.
//
// The layer is registered once per mount. The callback is read through a ref
// so that a component re-rendering with a fresh closure - which they all do
// constantly - does not tear down and re-push a history entry underneath the
// user's thumb.

let stack = null

function getStack() {
  if (stack) return stack
  // Built on first use rather than at import, so this module stays safe to
  // load outside a browser (the verify scripts and any headless render import
  // the component tree without a window).
  stack = createBackStack(window.history)
  window.addEventListener('popstate', (event) => stack.handlePopState(event.state))
  stack.start()
  return stack
}

export default function useBackDismiss(onDismiss) {
  const latest = useRef(onDismiss)
  latest.current = onDismiss

  useEffect(() => getStack().open(() => latest.current()), [])
}
