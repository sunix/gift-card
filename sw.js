const CACHE_NAME = 'gift-card-manager-v2.0.2';
const NETWORK_TIMEOUT_MS = 4000; // 4 seconds timeout for network requests
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './barcode.js',
  './i18n.js',
  './i18n/en.json',
  './i18n/fr.json',
  './i18n/uk.json',
  './i18n/ru.json',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
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

// Fetch event - cache first for navigation, network first for other resources
self.addEventListener('fetch', (event) => {
  // Check if this is a navigation request (opening the app)
  const isNavigationRequest = event.request.mode === 'navigate';
  
  if (isNavigationRequest) {
    // For navigation requests, use cache-first strategy to ensure app loads quickly
    event.respondWith(
      caches.match(event.request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            console.log('Serving navigation from cache:', event.request.url);
            
            // Update cache in background
            fetch(event.request)
              .then((response) => {
                if (response && response.ok) {
                  caches.open(CACHE_NAME)
                    .then((cache) => {
                      cache.put(event.request, response.clone());
                    });
                }
              })
              .catch(() => {
                // Network update failed, but we already served from cache
              });
            
            return cachedResponse;
          }
          
          // No cache, try network
          return fetch(event.request)
            .then((response) => {
              if (response && response.ok) {
                const responseToCache = response.clone();
                caches.open(CACHE_NAME)
                  .then((cache) => {
                    cache.put(event.request, responseToCache);
                  });
              }
              return response;
            })
            .catch(() => {
              // Both cache and network failed for navigation
              return new Response(
                '<!DOCTYPE html><html><head><title>App Unavailable</title></head><body><h1>App Unavailable</h1><p>Please check your connection and try again.</p></body></html>',
                {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: new Headers({
                    'Content-Type': 'text/html'
                  })
                }
              );
            });
        })
    );
  } else {
    // For non-navigation requests, use network-first with timeout strategy
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
              // Use response.ok to properly handle all response types including opaque
              if (!response || !response.ok) {
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
  }
});
