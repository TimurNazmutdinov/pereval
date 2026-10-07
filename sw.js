/* Перевал: работа без интернета.
   При обновлении приложения увеличьте номер версии ниже (v1 → v2),
   тогда у всех появится предложение обновиться. */
const VERSION = 'pereval-v1';
const RUNTIME = 'pereval-runtime';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
  './icons/maskable-192.png', './icons/maskable-512.png',
  './icons/apple-touch-icon.png', './icons/favicon-32.png'
];
/* шрифты и фото в шапке: кэшируем при первой загрузке */
const RUNTIME_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'commons.wikimedia.org', 'upload.wikimedia.org'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== RUNTIME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data === 'skip') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* сам Перевал: сразу из кэша, а в фоне подтягиваем свежую версию */
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.open(VERSION).then(async cache => {
        const hit = await cache.match(req, { ignoreSearch: true }) ||
                    (req.mode === 'navigate' ? await cache.match('./index.html') : undefined);
        const net = fetch(req).then(r => { if (r.ok) cache.put(req, r.clone()); return r; }).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  /* шрифты и фото */
  if (RUNTIME_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.open(RUNTIME).then(async cache => {
        const hit = await cache.match(req);
        if (hit) return hit;
        try { const r = await fetch(req); if (r.ok || r.type === 'opaque') cache.put(req, r.clone()); return r; }
        catch (err) { return hit || Response.error(); }
      })
    );
  }
  /* погода, карты, прокладка маршрутов идут напрямую в сеть;
     офлайн-карты Перевал хранит сам, в памяти браузера */
});
