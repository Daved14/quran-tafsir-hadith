const CACHE_NAME = 'quran-app-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/quran.html',
    '/tools.html',
    '/adhan.html',
    '/settings.html',
    '/install.html',
    '/css/styles.css',
    '/js/app.js',
    '/icons/icon-180x180.png',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png'
];

// التثبيت
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

// جلب الموارد
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});

// تحديث الكاش
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );
        })
    );
});