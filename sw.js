const CACHE_NAME = 'aurafy-cache-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/css/index.css',
  '/css/layout.css',
  '/css/components.css',
  '/css/player.css',
  '/css/animations.css',
  '/js/app.js',
  '/js/ui.js',
  '/js/data.js',
  '/js/player.js',
  '/js/ai.js',
  '/js/localFiles.js',
  '/js/spotify.js',
  '/js/visualizer.js',
  '/favicon.svg',
  '/manifest.json'
];

// Cache all core files during installation
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Try caching all assets, tolerate failure of single items gracefully
        return Promise.allSettled(
          ASSETS.map(asset => cache.add(asset).catch(err => {
            console.warn(`[Service Worker] Failed to cache: ${asset}`, err);
          }))
        );
      })
      .then(() => self.skipWaiting())
  );
});

// Clean up old caches on activation
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Cache-first for static resources, Network-first/Proxy-pass for APIs
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // APIs and external audio files should bypass client-side cache
  if (url.pathname.startsWith('/api/') || url.hostname.includes('saavn') || url.hostname.includes('groq')) {
    e.respondWith(fetch(e.request));
  } else {
    e.respondWith(
      caches.match(e.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Serve from cache and update in background if it's a static file
          fetch(e.request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(e.request, networkResponse));
            }
          }).catch(() => {});
          return cachedResponse;
        }

        return fetch(e.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            const cacheCopy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, cacheCopy));
          }
          return networkResponse;
        });
      }).catch(() => {
        // Fallback for HTML navigation requests
        if (e.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      })
    );
  }
});
