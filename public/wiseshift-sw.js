// WiseShift's service worker (the team page installed as an app).
// Only for /team. It keeps the page's files on the phone so the app opens
// fast and still opens without signal; it never stores or replays team data
// (Supabase is always asked live, and clocking in always needs internet).
//   Page itself    network first, the saved copy only when offline
//   /assets/*      saved once (their names change with every new version)
//   Everything else (Supabase, maps, fonts) is left alone.
// It also shows push notifications (sent by the send-push Supabase function)
// and opens the app on the right tab when one is tapped.
const CACHE = 'wiseshift-v1'
// The folder this app is served from ('/' or '/wiseshift/'), taken from where it is registered.
const BASE = self.registration.scope
const SHELL = [BASE, `${BASE}app/wiseshift.webmanifest`, `${BASE}app/icon-192.png`, `${BASE}app/icon-512.png`]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // The page: always try for the newest, fall back to the saved one offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((cache) => cache.put(BASE, copy))
          return res
        })
        .catch(() => caches.match(BASE)),
    )
    return
  }

  // Built files and images: from the phone if saved, otherwise fetch and save.
  if (url.pathname.startsWith(new URL('assets/', BASE).pathname) || url.pathname.startsWith(new URL('app/', BASE).pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(CACHE).then((cache) => cache.put(req, copy))
            }
            return res
          }),
      ),
    )
  }
})

// ---------- Push notifications ----------

self.addEventListener('push', (event) => {
  let msg = {}
  try {
    msg = event.data ? event.data.json() : {}
  } catch {
    msg = { body: event.data?.text() }
  }
  event.waitUntil(
    self.registration.showNotification(msg.title || 'WiseShift', {
      body: msg.body || '',
      icon: `${BASE}app/icon-192.png`,
      badge: `${BASE}app/icon-192.png`,
      tag: msg.tag,
      data: { url: msg.url || BASE },
    }),
  )
})

// Tapped: bring the app forward (or open it) on the right tab.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || BASE, BASE).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url.startsWith(BASE))
      if (open) {
        open.navigate(url)
        return open.focus()
      }
      return self.clients.openWindow(url)
    }),
  )
})
