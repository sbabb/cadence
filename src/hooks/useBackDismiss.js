import { useEffect, useRef } from 'react'
import { createBackStack } from '../utils/backStack.js'

// Registers a dismissible layer, so the Android back button (or back swipe,
// or a browser's back arrow) closes it instead of leaving the app.
//
//     useBackDismiss(onCancel)            an overlay: open while it is mounted
//     useBackDismiss(onBack, showSettings)  a screen: open while the flag says
//
// Two forms because the app has two different kinds of thing, and the
// difference is not cosmetic.
//
// OVERLAYS - the spend sheet, the confirm dialogs - are rendered on top of
// whatever is showing and unmount when they close, so being mounted IS being
// open. They register themselves, which means the next dialog anyone adds
// gets correct back behaviour by being a dialog rather than by somebody
// remembering a central list.
//
// SCREENS - Settings, Trends, the FAQ - cannot do that, because App renders
// exactly one at a time. Opening the FAQ from Settings unmounts Settings even
// though the user has gone one level DEEPER and Settings is still open behind
// it. A screen that registered itself would therefore un-register on the way
// down and re-register on the way back up, which pushes a history entry in
// response to a back press - and Chrome on Android reads that as a site
// trying to trap the user, marks the new entry skippable, and skips straight
// past it on the next back. In a standalone PWA that means the app closes.
//
// So screens pass the flag that actually says whether they are open, and App
// - which owns those flags - registers them. The call order in App is the
// order back takes them off.
//
// The callback is read through a ref so that a component re-rendering with a
// fresh closure - which they all do constantly - does not tear down and
// re-push a history entry underneath the user's thumb.

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

export default function useBackDismiss(onDismiss, isOpen = true) {
  const latest = useRef(onDismiss)
  latest.current = onDismiss

  useEffect(() => {
    if (!isOpen) return undefined
    return getStack().open(() => latest.current())
  }, [isOpen])
}
