const CACHE_NAME = 'teleflow-v2';
const APP_SHELL = ['./', './index.html', './manifest.json', './favicon.svg', './icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  // Navigations: always try the network first so a fresh deploy is picked up,
  // falling back to the cached shell when the app is offline.
  if (request.mode === 'navigate') {
    // `no-store` matters: GitHub Pages serves HTML with a ten minute cache, and a
    // cached index.html pins the whole app to an old build.
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match('./index.html').then((cached) => cached || caches.match('./')))
    );
    return;
  }

  // The HTML entry is only ever used as an offline fallback, never as the
  // answer to a live navigation.
  if (request.destination === 'document' || request.url.endsWith('/index.html')) {
    event.respondWith(fetch(request, { cache: 'no-store' }).catch(() => caches.match('./index.html').then((c) => c || fetch(request))));
    return;
  }

  // Static assets are content-hashed by the build, so serving them from the cache
  // is both fast and safe: a new build ships new file names.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request, { cache: 'no-store' })
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
