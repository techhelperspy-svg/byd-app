const CACHE = 'ptm-v5';
const STATIC = ['manifest.json', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Never cache index.html or sw.js - always fetch fresh
  if (
    url.pathname === '/' ||
    url.pathname === '/index.html' ||
    url.pathname.includes('sw.js')
  ) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Never cache any proxy API calls (SOAP + OData)
  if (
    url.pathname.includes('/sync') ||
    url.pathname.includes('/confirm') ||
    url.pathname.includes('/task-query') ||
    url.pathname.includes('/task-confirm')
  ) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Cache-first for icons and manifest only
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      });
    })
  );
});
