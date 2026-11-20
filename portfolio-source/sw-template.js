const prefix = 'mjc-os-static-';
const cacheName = prefix + 'CACHE_VERSION';
const files = CACHE_FILES;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(files)));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith(prefix) && key !== cacheName) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();
});

function documentKey(path) {
  if (path.endsWith('/')) return path + 'index.html';
  return path.endsWith('.html') ? path : path + '/index.html';
}

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/game/') ||
      url.pathname === '/game' || request.headers.has('Range') || /\.(?:mp4|aac|pdf|vcf)$/.test(url.pathname) ||
      url.pathname.startsWith('/assets/ice.')) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(cacheName);
      const key = documentKey(url.pathname);
      try {
        // Request fresh HTML even when a prior navigation filled the offline cache.
        const response = await fetch(request, { cache: 'no-cache' });
        if (response.ok && files.includes(key)) await cache.put(key, response.clone());
        return response;
      } catch {
        return await cache.match(key) || await cache.match('/offline.html');
      }
    })());
    return;
  }
  if (files.includes(url.pathname)) {
    event.respondWith(caches.open(cacheName).then(async cache => {
      const saved = await cache.match(url.pathname);
      if (saved) return saved;
      return fetch(request);
    }));
  }
});
