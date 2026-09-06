// Minimal service worker. Two jobs: make the app genuinely usable offline -
// which it has always claimed to be, having no backend at all - and satisfy
// the last of the browser's install criteria so the phone offers "install"
// rather than a bookmark.
//
// The caching strategy is split deliberately, because getting this wrong is
// how a web app becomes impossible to update on someone's phone:
//
//   navigation requests -> NETWORK FIRST. index.html is the one file whose
//     name never changes, so a cached copy would pin the app to an old build
//     forever. Fall back to cache only when actually offline.
//
//   everything else -> CACHE FIRST. Vite fingerprints every asset it emits
//     (index-a1b2c3d4.js), so a given URL's content can never change. Cached
//     copies are safe by construction, and a new build simply requests new
//     names.
//
// Bump CACHE_VERSION to evict everything on the next load.

const CACHE_VERSION = 'cadence-v1'

self.addEventListener('install', (event) => {
  // Take over immediately rather than waiting for every old tab to close.
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(['/'])))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  if (new URL(request.url).origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy))
          return response
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match('/')))
    )
    return
  }

  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((response) => {
          // Opaque and error responses are not worth keeping.
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy))
          }
          return response
        })
    )
  )
})
