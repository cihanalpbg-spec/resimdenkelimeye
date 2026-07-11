const CACHE_NAME = 'resimden-ingilizceye-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/assets/logo.png',
  '/assets/background.png',
  '/assets/icon-192.png',
  '/assets/icon-512.png'
];

// Install Service Worker and cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching shell assets...');
        return cache.addAll(ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Service Worker and clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('Clearing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch events: Cache-First with Network fallback (for app shells)
self.addEventListener('fetch', event => {
  // Skip non-GET requests or API requests (e.g. POST /api/upload, GET /api/words)
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }

  // Bypass chrome-extension or external analytics request calls
  if (!event.request.url.startsWith(self.location.origin) && !event.request.url.includes('googleapis.com') && !event.request.url.includes('gstatic.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Serve from cache, and fetch update in background (Stale-While-Revalidate)
          fetch(event.request).then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse));
            }
          }).catch(() => {/* Ignore network check errors when offline */});
          
          return cachedResponse;
        }

        // Network fallback
        return fetch(event.request).then(networkResponse => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        });
      })
  );
});
