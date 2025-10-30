const CACHE_NAME = 'gift-card-manager-v2.0.1';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './barcode.js',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/bwip-js@3/dist/bwip-js.min.js'
];

// Install service worker (skip caching)
self.addEventListener('install', (event) => {
  console.log('Service worker installed (caching disabled)');
  self.skipWaiting();
});

// Activate service worker (skip cache cleanup)
self.addEventListener('activate', (event) => {
  console.log('Service worker activated (caching disabled)');
  self.clients.claim();
});

// Fetch event - skip cache, always use network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      // If network fails, return a fallback
      return new Response('Offline - Please check your connection', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: new Headers({
          'Content-Type': 'text/plain'
        })
      });
    })
  );
});
