/* 中国象棋 PWA 离线缓存 */
const CACHE = 'xiangqi-v1';
const ASSETS = [
  './',
  'index.html',
  'css/style.css',
  'js/rules.js',
  'js/ai.js',
  'js/board.js',
  'js/game.js',
  'js/main.js',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) =>
      hit || fetch(e.request).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return resp;
      }).catch(() => hit)
    )
  );
});
