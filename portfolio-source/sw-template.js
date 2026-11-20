const prefix = 'mjc-os-static-';
const cacheName = prefix + 'CACHE_VERSION';
const files = CACHE_FILES;
const controlUrl = new URL('/sw-state.json', self.location.origin).href;
let statusCheck;
let retirement;

function releaseIsRetired() {
  if (!statusCheck) {
    statusCheck = (async () => {
      try {
        const response = await fetch(controlUrl, { cache: 'no-store' });
        if (response.status === 404 || response.status === 410) return true;
        if (!response.ok) return false;
        return (await response.json()).enabled === false;
      } catch {
        return false;
      }
    })().finally(() => { statusCheck = undefined; });
  }
  return statusCheck;
}

function retire() {
  if (!retirement) retirement = (async () => {
    await self.registration.unregister();
    for (const key of await caches.keys()) {
      if (key.startsWith(prefix)) await caches.delete(key);
    }
  })();
  return retirement;
}

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
  if (event.data?.type === 'ACTIVATE_UPDATE') event.waitUntil(self.skipWaiting());
  if (event.data?.type === 'CHECK_RELEASE') {
    event.waitUntil((async () => {
      if (!await releaseIsRetired()) return;
      await retire();
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) {
        const path = new URL(client.url).pathname;
        if (path !== '/game' && !path.startsWith('/game/')) client.postMessage({ type: 'OS_ROLLBACK' });
      }
    })());
  }
});

function documentKey(path) {
  if (path.endsWith('/')) return path + 'index.html';
  return path.endsWith('.html') ? path : path + '/index.html';
}

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (retirement || request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/game/') ||
      url.pathname === '/game' || request.headers.has('Range') || /\.(?:mp4|aac|pdf|vcf)$/.test(url.pathname) ||
      url.pathname.startsWith('/assets/ice.')) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(cacheName);
      const key = documentKey(url.pathname);
      try {
        // Request fresh HTML even when a prior navigation filled the offline cache.
        const response = await fetch(request, { cache: 'no-cache' });
        if (retirement || await releaseIsRetired()) {
          await retire();
          return response.ok ? response : Response.redirect(new URL('/', self.location.origin), 302);
        }
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
      if (retirement) return fetch(request);
      const saved = await cache.match(url.pathname);
      if (saved) return saved;
      return fetch(request);
    }));
  }
});
