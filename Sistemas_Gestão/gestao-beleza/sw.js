const CACHE_NAME = 'gestao-beleza-v1';
const ASSETS_TO_CACHE = [
    './index.html',
    './css/styles.css',
    './js/app_core.js',
    './manifest.json',
    'https://unpkg.com/lucide@latest',
    'https://cdn.tailwindcss.com'
];

// Install Event
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Activate Event
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    return caches.delete(key);
                }
            }));
        })
    );
});

// Fetch Event
self.addEventListener('fetch', (e) => {
    // Network First Strategy for HTML (to get updates)
    if (e.request.mode === 'navigate') {
        e.respondWith(
            fetch(e.request).catch(() => {
                return caches.match('./index.html');
            })
        );
        return;
    }

    // Stale While Revalidate for assets
    e.respondWith(
        caches.match(e.request).then((cachedResponse) => {
            const fetchPromise = fetch(e.request).then((networkResponse) => {
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(e.request, networkResponse.clone());
                });
                return networkResponse;
            });
            return cachedResponse || fetchPromise;
        })
    );
});
