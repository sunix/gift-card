const CACHE_NAME = 'gift-card-manager-v2.0.1';
const NETWORK_TIMEOUT_MS = 4000; // 4 seconds timeout for network requests
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './barcode.js',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/bwip-js@3/dist/bwip-js.min.js'
];

// Install service worker and cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Activate service worker and clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first with timeout, fallback to cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    new Promise((resolve, reject) => {
      let timeoutId;
      let timeoutCleared = false;
      
      const clearTimeoutOnce = () => {
        if (!timeoutCleared) {
          clearTimeout(timeoutId);
          timeoutCleared = true;
        }
      };

      const timeoutPromise = new Promise((_, timeoutReject) => {
        timeoutId = setTimeout(() => {
          clearTimeoutOnce();
          timeoutReject(new Error('Network timeout'));
        }, NETWORK_TIMEOUT_MS);
      });

      Promise.race([
        fetch(event.request)
          .then((response) => {
            clearTimeoutOnce();
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response to cache it
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              })
              .catch((error) => {
                console.error('Failed to cache response:', error);
              });

            return response;
          })
          .catch((error) => {
            clearTimeoutOnce();
            throw error;
          }),
        timeoutPromise
      ])
      .then(resolve)
      .catch(reject);
    })
    .catch((error) => {
      // Log error for debugging
      console.error('Network request failed:', error.message, 'for', event.request.url);
      
      // Network failed or timed out, try cache
      return caches.match(event.request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            console.log('Serving from cache:', event.request.url);
            return cachedResponse;
          }
          // Both network and cache failed
          return new Response('Content unavailable - Please try again later', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain'
            })
          });
        });
    })
  );
});
