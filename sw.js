const CACHE = 'azab-fitness-v22';
const FILES = [
  './', './index.html', './styles.css', './app.js',
  './phase1.js', './phase1.css', './nutrition.js', './nutrition.css',
  './phase5.js', './phase5.css', './coach-core.mjs',
  './phase6.js', './phase6.css', './phase6-core.mjs',
  './nutrition-core.mjs', './meal-box-core.mjs', './food-seeds.js', './phase3.js', './phase3.css',
  './wellness-core.mjs', './phase4.js', './phase4.css', './progression-core.mjs',
  './manifest.json', './icon.svg',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key !== CACHE).map(key => caches.delete(key)),
  )));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)
    .then(response => {
      if (response.ok && new URL(event.request.url).origin === location.origin) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
      }
      return response;
    })
    .catch(() => caches.match('./index.html'))));
});
