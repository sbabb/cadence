import { useCallback, useEffect, useState } from 'react'

// Asking the browser not to throw the data away.
//
// By default a browser treats site storage as disposable: under storage
// pressure it evicts whatever it likes, and an app whose entire history lives
// in localStorage is exactly the kind of thing that gets evicted. One API call
// moves it into the "persistent" bucket, which is exempt from that sweep.
//
// It is not a guarantee and it is not a backup - the user can still clear site
// data deliberately, which is why export exists - but it removes the failure
// mode where a phone quietly drops the data with nobody having asked it to.
//
// Chrome decides silently, on engagement: it grants this readily to an app
// that has been installed to the home screen, which is the state most Cadence
// users will be in. That is why this retries on every load rather than asking
// once and recording the refusal - "denied" today becomes "granted" the day
// the app is installed, with nothing else changing.
async function query() {
  if (!navigator.storage || typeof navigator.storage.persisted !== 'function') return 'unsupported'
  try {
    return (await navigator.storage.persisted()) ? 'granted' : 'denied'
  } catch {
    return 'unsupported'
  }
}

async function request() {
  if (!navigator.storage || typeof navigator.storage.persist !== 'function') return 'unsupported'
  try {
    if (await navigator.storage.persisted()) return 'granted'
    return (await navigator.storage.persist()) ? 'granted' : 'denied'
  } catch {
    return 'unsupported'
  }
}

// `enabled` gates the FIRST request on the user having something worth
// protecting. Firefox shows a permission prompt for this, and putting one in
// front of somebody who has not yet created their first period would be
// asking to protect nothing.
export default function usePersistentStorage(enabled) {
  const [status, setStatus] = useState('unknown')

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const result = enabled ? await request() : await query()
      if (!cancelled) setStatus(result)
    }
    run()
    return () => {
      cancelled = true
    }
  }, [enabled])

  // Exposed so Settings can offer a retry - the answer legitimately changes
  // once the app is installed to the home screen.
  const retry = useCallback(async () => {
    const result = await request()
    setStatus(result)
    return result
  }, [])

  return { status, retry }
}
