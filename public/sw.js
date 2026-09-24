// Minimal service worker. Two jobs: make the app genuinely usable offline -
// which it has always claimed to be, having no backend at all - and satisfy
// the last of the browser's install criteria so the phone offers "install"
// rather than a bookmark.
//
// The caching strategy is split deliberately, because getting this wrong is
// how a web app becomes impossible to update on someone's phone:
//
//   navigation requests -> NETWORK FIRST, but on a timer. index.html is the
//     one file whose name never changes, so a cached copy would pin the app to
//     an old build forever. Fall back to cache when offline - or when the
//     network is merely awful, which is the case a plain network-first handles
//     badly: an app that works offline has no business showing a blank screen
//     while a stalled request runs its course.
//
//   assets/ -> CACHE FIRST. Vite fingerprints every asset it emits
//     (index-a1b2c3d4.js), so a given URL's content can never change. Cached
//     copies are safe by construction, and a new build simply requests new
//     names.
//
//   everything else -> CACHE, THEN REFRESH. The manifest and the icons come
//     from public/ and keep the same name forever, which is the navigation
//     problem again in a smaller file. Served cache-first they were pinned at
//     whatever the phone first saw: a renamed app or a redrawn icon never
//     reached anyone who had already installed it. They are answered from
//     cache so opening offline still works, and refetched behind that answer
//     so the next launch has the current copy.
//
// Bump CACHE_VERSION to evict everything on the next load.

// Bumped when the cache's SHAPE changes, not just its contents - v2 keys the
// app shell by the worker's own scope rather than by the origin root, so v1
// entries would be looked up under URLs this version never writes.
const CACHE_VERSION = 'cadence-v2'

// Where this copy of the app actually lives - "https://host/" at a domain
// root, "https://host/cadence/" under a project path. Everything below is
// relative to it, so one build is installable from anywhere.
const APP_SHELL = self.registration.scope

// Vite's output directory, and the only place a file name carries a hash of
// its contents. Nothing outside it is safe to serve without asking again.
const ASSETS = `${APP_SHELL}assets/`

// How long a navigation waits for the network before the cached shell is served
// instead. Long enough that a normal connection always wins it outright, short
// enough that a bad one never holds the app hostage: the point of caching the
// shell is that opening it can be instant.
const NAVIGATION_TIMEOUT_MS = 3000

self.addEventListener('install', (event) => {
  // Take over immediately rather than waiting for every old tab to close.
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll([APP_SHELL])))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// Fetches a navigation and refreshes the cached copy on the way past.
//
// Never rejects, and never resolves to anything but a usable shell: a network
// failure and a bad status both come back as null, so callers can race this
// without catching, and a rejection cannot escape into an unhandled promise
// once the response has already been served from cache instead.
//
// Treating a non-OK status as a miss matters most in the minutes around a
// deploy. Pages can answer a request with a 404 or a 502 while it swaps the
// site over, and serving that to someone who has a perfectly good copy of the
// app cached would replace their tracker with an error page over an event that
// resolves itself in seconds. The old copy is the better answer, and the next
// launch picks up the new one.
function fetchAndRecache(request) {
  return fetch(request)
    .then((response) => {
      if (!response.ok) return null
      const copy = response.clone()
      caches
        .open(CACHE_VERSION)
        .then((cache) => cache.put(request, copy))
        .catch(() => {})
      return response
    })
    .catch(() => null)
}

// Fetches anything that isn't a navigation and keeps a good answer. Unlike a
// navigation, a bad status is passed through as it is: with no cached copy to
// prefer, the real 404 is more honest than inventing a network error.
function fetchAndKeep(request) {
  return fetch(request).then((response) => {
    // Opaque and error responses are not worth keeping.
    if (response.ok) {
      const copy = response.clone()
      caches
        .open(CACHE_VERSION)
        .then((cache) => cache.put(request, copy))
        .catch(() => {})
    }
    return response
  })
}

async function navigate(request, network) {
  // Offline resolves null immediately rather than waiting out the timer, so
  // being genuinely offline stays as fast as it is today.
  const timeout = new Promise((resolve) => setTimeout(resolve, NAVIGATION_TIMEOUT_MS, null))
  const fresh = await Promise.race([network, timeout])
  if (fresh) return fresh

  const cache = await caches.open(CACHE_VERSION)
  const hit = (await cache.match(request)) || (await cache.match(APP_SHELL))
  if (hit) return hit

  // Nothing cached, and the network slow, gone, or answering with an error:
  // there is nothing left to wait for but the request already in flight, and
  // nothing honest to show if it never arrives.
  return (await network) || Response.error()
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  if (new URL(request.url).origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    // Started once and awaited twice - as the thing the timeout races, and
    // again as the last resort if there turns out to be nothing cached.
    const network = fetchAndRecache(request)
    // When the timeout wins, this request outlives the response it lost to,
    // and that is the whole point: it finishes in the background and leaves
    // the new build in the cache, so the launch after this one is current.
    // waitUntil is what stops the worker being killed before it lands.
    event.waitUntil(network)
    event.respondWith(navigate(request, network))
    return
  }

  if (request.url.startsWith(ASSETS)) {
    event.respondWith(caches.match(request).then((hit) => hit || fetchAndKeep(request)))
    return
  }

  // Started whether or not the cache answers, because refreshing the cached
  // copy is the whole point. Its failure is caught here, where nothing is
  // waiting on it, so being offline with a cached copy is not an error.
  const network = fetchAndKeep(request)
  event.waitUntil(network.catch(() => {}))
  event.respondWith(caches.match(request).then((hit) => hit || network))
})
