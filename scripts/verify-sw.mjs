// Checks on public/sw.js - specifically the decision it makes about whether
// the app opens at all.
//
// This is the one file in the project with no user interface and the largest
// blast radius: get it wrong and the app is a blank screen on a phone that is
// working perfectly, or it is pinned to a build from three deploys ago with no
// way for the user to say otherwise. None of that is visible from a screenshot
// and none of it reproduces on a fast desk connection, which is exactly the
// argument the theme and engine suites already make for checking arithmetic
// rather than squinting at the result.
//
// The worker is loaded into a stubbed environment rather than imported: it is
// written against service worker globals (`self.registration`, `caches`,
// `Response.error`) that plain Node does not have. The stubs below are the
// smallest set that the file actually touches.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import vm from 'node:vm'

const here = dirname(fileURLToPath(import.meta.url))
const SW_PATH = join(here, '..', 'public', 'sw.js')
const SOURCE = readFileSync(SW_PATH, 'utf8')

const SCOPE = 'https://sbabb.github.io/cadence/'

let passed = 0
let failed = 0

function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1
      console.log(`PASS: ${name}`)
    })
    .catch((err) => {
      failed += 1
      console.error(`FAIL: ${name}`)
      console.error(err)
      process.exitCode = 1
    })
}

// --- the smallest service worker environment sw.js will run in -------------

class FakeResponse {
  constructor(body, { status = 200, isError = false } = {}) {
    this.body = body
    this.status = status
    this.ok = status >= 200 && status < 300
    this.isError = isError
  }

  clone() {
    return new FakeResponse(this.body, { status: this.status, isError: this.isError })
  }
}

FakeResponse.error = () => new FakeResponse(null, { status: 0, isError: true })

class FakeCache {
  constructor(store) {
    this.store = store
  }

  async match(request) {
    const key = typeof request === 'string' ? request : request.url
    return this.store.get(key) || undefined
  }

  async put(request, response) {
    const key = typeof request === 'string' ? request : request.url
    this.store.set(key, response)
  }

  async addAll(urls) {
    for (const url of urls) this.store.set(url, new FakeResponse(`cached:${url}`))
  }
}

function makeCaches() {
  const buckets = new Map()
  return {
    buckets,
    api: {
      async open(name) {
        if (!buckets.has(name)) buckets.set(name, new Map())
        return new FakeCache(buckets.get(name))
      },
      async match(request) {
        const key = typeof request === 'string' ? request : request.url
        for (const bucket of buckets.values()) {
          if (bucket.has(key)) return bucket.get(key)
        }
        return undefined
      },
      async keys() {
        return [...buckets.keys()]
      },
      async delete(name) {
        return buckets.delete(name)
      }
    }
  }
}

// Loads sw.js into a fresh sandbox and hands back the pieces a test drives.
// `timeoutMs` rewrites the navigation timer so the suite runs in milliseconds
// instead of seconds; the real value is asserted separately below.
function loadWorker({ fetchImpl, timeoutMs = 40 }) {
  const source = SOURCE.replace(
    /const NAVIGATION_TIMEOUT_MS = \d+/,
    `const NAVIGATION_TIMEOUT_MS = ${timeoutMs}`
  )
  assert.ok(source.includes(`= ${timeoutMs}`), 'the timeout constant should have been rewritten')

  const listeners = new Map()
  const cacheStorage = makeCaches()

  const self = {
    registration: { scope: SCOPE },
    location: { origin: 'https://sbabb.github.io' },
    clients: { claim: async () => {} },
    skipWaiting: () => {},
    addEventListener: (type, fn) => listeners.set(type, fn)
  }

  const sandbox = {
    self,
    caches: cacheStorage.api,
    fetch: fetchImpl,
    Response: FakeResponse,
    URL,
    setTimeout,
    clearTimeout,
    console
  }
  vm.createContext(sandbox)
  vm.runInContext(source, sandbox, { filename: 'sw.js' })

  // Drives one request through the fetch listener the way the browser does,
  // and reports what the worker chose to answer with. `responded` stays false
  // when the worker declined to intercept at all.
  const dispatch = (request) => {
    let responded = false
    let answer
    const waits = []
    const event = {
      request,
      respondWith: (p) => {
        responded = true
        answer = p
      },
      waitUntil: (p) => waits.push(p)
    }
    listeners.get('fetch')(event)
    return { responded, answer, settled: () => Promise.allSettled(waits) }
  }

  const install = async () => {
    const waits = []
    listeners.get('install')({ waitUntil: (p) => waits.push(p) })
    await Promise.all(waits)
  }

  return { dispatch, install, cacheStorage, listeners }
}

const navigation = (url = SCOPE) => ({ url, method: 'GET', mode: 'navigate' })
const asset = (url) => ({ url, method: 'GET', mode: 'no-cors' })

const never = () => new Promise(() => {})
const after = (ms, value) => new Promise((resolve) => setTimeout(() => resolve(value), ms))

// --- navigation: the path that decides whether the app opens ---------------

await check('a healthy network serves the live build, not the cached one', async () => {
  const fresh = new FakeResponse('fresh index.html')
  const { dispatch, install } = loadWorker({ fetchImpl: async () => fresh })
  await install()

  const { responded, answer } = dispatch(navigation())
  assert.equal(responded, true, 'navigations must be intercepted')
  const got = await answer
  assert.equal(got.body, 'fresh index.html')
})

await check('a healthy navigation refreshes the cached shell on the way past', async () => {
  const { dispatch, install, cacheStorage } = loadWorker({
    fetchImpl: async () => new FakeResponse('build 2')
  })
  await install()

  const { answer, settled } = dispatch(navigation())
  await answer
  await settled()

  const cached = await cacheStorage.api.match(SCOPE)
  assert.equal(cached.body, 'build 2', 'the next launch should find the newer build cached')
})

await check('offline falls straight back to the cached shell', async () => {
  const { dispatch, install } = loadWorker({
    fetchImpl: async () => {
      throw new TypeError('Failed to fetch')
    }
  })
  await install()

  const started = Date.now()
  const { answer } = dispatch(navigation())
  const got = await answer
  assert.equal(got.body, `cached:${SCOPE}`)
  // The whole point of a fast rejection is that it does not sit out the timer.
  assert.ok(Date.now() - started < 30, `offline should not wait for the timeout (took ${Date.now() - started}ms)`)
})

await check('a stalled network gives up and opens from cache instead of hanging', async () => {
  const { dispatch, install } = loadWorker({ fetchImpl: never, timeoutMs: 40 })
  await install()

  const { answer } = dispatch(navigation())
  const got = await answer
  assert.equal(got.body, `cached:${SCOPE}`, 'a hung request must not become a blank screen')
})

await check('a slow-but-alive network still refreshes the cache for next launch', async () => {
  // The request that lost the race is the one that matters afterwards: it is
  // what makes the launch AFTER this one current.
  const { dispatch, install, cacheStorage } = loadWorker({
    fetchImpl: () => after(80, new FakeResponse('build 3')),
    timeoutMs: 40
  })
  await install()

  const { answer, settled } = dispatch(navigation())
  assert.equal((await answer).body, `cached:${SCOPE}`, 'this launch is served from cache')
  await settled()
  assert.equal((await cacheStorage.api.match(SCOPE)).body, 'build 3', 'the next one is not')
})

await check('a deploy-window error page never replaces a working cached app', async () => {
  for (const status of [404, 500, 502, 503]) {
    const { dispatch, install } = loadWorker({
      fetchImpl: async () => new FakeResponse(`<h1>${status}</h1>`, { status })
    })
    await install()

    const { answer, settled } = dispatch(navigation())
    const got = await answer
    assert.equal(got.body, `cached:${SCOPE}`, `${status} should fall back to cache`)
    await settled()
  }
})

await check('an error page is never written into the cache', async () => {
  const { dispatch, install, cacheStorage } = loadWorker({
    fetchImpl: async () => new FakeResponse('<h1>404</h1>', { status: 404 })
  })
  await install()

  const { answer, settled } = dispatch(navigation())
  await answer
  await settled()

  const cached = await cacheStorage.api.match(SCOPE)
  assert.equal(cached.body, `cached:${SCOPE}`, 'the good copy must survive a bad response')
})

await check('with nothing cached, a slow network is still awaited rather than failed', async () => {
  const { dispatch } = loadWorker({
    fetchImpl: () => after(80, new FakeResponse('first ever load')),
    timeoutMs: 40
  })
  // Deliberately no install(): a first run whose cache is empty.
  const { answer, settled } = dispatch(navigation())
  const got = await answer
  assert.equal(got.body, 'first ever load', 'there is no cache to fall back to, so waiting is correct')
  await settled()
})

await check('with nothing cached and no network, the failure is honest', async () => {
  const { dispatch } = loadWorker({
    fetchImpl: async () => {
      throw new TypeError('Failed to fetch')
    }
  })
  const { answer } = dispatch(navigation())
  const got = await answer
  assert.equal(got.isError, true, 'a real network error is the only truthful answer')
})

// --- assets/: the cache-first half, unchanged but worth pinning -----------

await check('fingerprinted assets are served from cache without touching the network', async () => {
  let calls = 0
  const { dispatch, install, cacheStorage } = loadWorker({
    fetchImpl: async () => {
      calls += 1
      return new FakeResponse('from network')
    }
  })
  await install()

  const url = `${SCOPE}assets/index-a1b2c3d4.js`
  const cache = await cacheStorage.api.open('cadence-v2')
  await cache.put({ url }, new FakeResponse('from cache'))

  const { answer } = dispatch(asset(url))
  assert.equal((await answer).body, 'from cache')
  assert.equal(calls, 0, 'a fingerprinted URL can never have changed, so it must not be refetched')
})

await check('an uncached asset is fetched and kept', async () => {
  const { dispatch, install, cacheStorage } = loadWorker({
    fetchImpl: async () => new FakeResponse('freshly fetched')
  })
  await install()

  const url = `${SCOPE}assets/index-99999999.css`
  const { answer } = dispatch(asset(url))
  assert.equal((await answer).body, 'freshly fetched')
  await new Promise((resolve) => setTimeout(resolve, 5))
  assert.equal((await cacheStorage.api.match(url)).body, 'freshly fetched')
})

// --- public/: same name forever, so it has to be asked about again ---------

await check('a changed manifest reaches an app that already cached the old one', async () => {
  // Shipped cache-first, the manifest and icons were pinned at whatever the
  // phone saw first. A real Chromium showed it: rename the app on the server,
  // reload three times, and the installed copy still had the old name.
  const { dispatch, install, cacheStorage } = loadWorker({
    fetchImpl: async () => new FakeResponse('manifest v2')
  })
  await install()

  const url = `${SCOPE}manifest.webmanifest`
  const cache = await cacheStorage.api.open('cadence-v2')
  await cache.put({ url }, new FakeResponse('manifest v1'))

  const { answer, settled } = dispatch(asset(url))
  assert.equal((await answer).body, 'manifest v1', 'this launch answers from cache, without waiting')
  await settled()
  assert.equal((await cacheStorage.api.match(url)).body, 'manifest v2', 'the next launch has the new one')
})

await check('offline, the manifest and icons still come from cache', async () => {
  const { dispatch, install, cacheStorage } = loadWorker({
    fetchImpl: async () => {
      throw new TypeError('Failed to fetch')
    }
  })
  await install()

  const url = `${SCOPE}icons/icon-192.png`
  const cache = await cacheStorage.api.open('cadence-v2')
  await cache.put({ url }, new FakeResponse('icon'))

  const { answer, settled } = dispatch(asset(url))
  assert.equal((await answer).body, 'icon')
  const results = await settled()
  assert.ok(
    results.every((r) => r.status === 'fulfilled'),
    'a refresh that fails offline must not surface as an error'
  )
})

await check('non-GET requests and other origins are left entirely alone', async () => {
  const { dispatch, install } = loadWorker({ fetchImpl: async () => new FakeResponse('x') })
  await install()

  const post = dispatch({ url: SCOPE, method: 'POST', mode: 'navigate' })
  assert.equal(post.responded, false, 'a POST is not ours to answer')

  const other = dispatch({ url: 'https://example.com/thing.js', method: 'GET', mode: 'no-cors' })
  assert.equal(other.responded, false, 'another origin is not ours to answer')
})

// --- the shipped constants, as opposed to the ones the tests rewrote -------

await check('the shipped timeout is a real-world value, not a test one', async () => {
  const match = SOURCE.match(/const NAVIGATION_TIMEOUT_MS = (\d+)/)
  assert.ok(match, 'sw.js should declare NAVIGATION_TIMEOUT_MS')
  const ms = Number(match[1])
  // Long enough that any working connection wins outright, short enough that
  // nobody watches a blank screen wondering whether the app is broken.
  assert.ok(ms >= 1000 && ms <= 5000, `${ms}ms is outside the sensible range`)
})

await check('the app shell is keyed to the worker scope, so a subpath deploy works', async () => {
  const { cacheStorage, install } = loadWorker({ fetchImpl: async () => new FakeResponse('x') })
  await install()
  const cached = await cacheStorage.api.match(SCOPE)
  assert.ok(cached, 'installing should cache the shell at the scope, not at the origin root')
})

console.log(`\n${passed}/${passed + failed} service worker checks passed`)
