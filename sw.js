/* Перевал: работа без интернета и обновления.
   При каждом обновлении приложения увеличивайте номер версии ниже. */
const VERSION = 'pereval-v9-2';
const RUNTIME = 'pereval-runtime';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './icons/icon-v4.svg', './icons/icon-192-v4.png', './icons/icon-512-v4.png',
  './icons/maskable-192-v4.png', './icons/maskable-512-v4.png',
  './icons/apple-touch-icon-v4.png', './icons/favicon-32-v4.png'
];
const RUNTIME_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'commons.wikimedia.org', 'upload.wikimedia.org'];

self.addEventListener('install', e => {
  /* cache: 'reload' — берём файлы прямо с сервера, а не из кэша браузера */
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== RUNTIME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    const isPage = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
    if (isPage) {
      /* страница: сначала сеть (свежая версия), без сети — из кэша */
      e.respondWith((async () => {
        const cache = await caches.open(VERSION);
        try {
          const r = await Promise.race([fetch(req, { cache: 'no-cache' }), timeout(4000)]);
          if (r.ok) cache.put('./index.html', r.clone());
          return r;
        } catch (err) {
          return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
        }
      })());
      return;
    }
    /* значки и прочее: из кэша, в фоне обновляем */
    e.respondWith(caches.open(VERSION).then(async cache => {
      const hit = await cache.match(req, { ignoreSearch: true });
      const net = fetch(req).then(r => { if (r.ok) cache.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }

  if (RUNTIME_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.open(RUNTIME).then(async cache => {
      const hit = await cache.match(req);
      if (hit) return hit;
      try { const r = await fetch(req); if (r.ok || r.type === 'opaque') cache.put(req, r.clone()); return r; }
      catch (err) { return hit || Response.error(); }
    }));
  }
});
