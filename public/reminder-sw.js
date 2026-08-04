self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('still-shell-v1').then((cache) => cache.addAll([
      '/',
      '/manifest.webmanifest',
      '/icons/icon-192.png',
      '/icons/icon-512.png',
    ])),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith('still-shell-') && key !== 'still-shell-v1').map((key) => caches.delete(key)),
    )),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open('still-shell-v1').then((cache) => cache.put('/', copy));
          return response;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  if (new URL(event.request.url).origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open('still-shell-v1').then((cache) => cache.put(event.request, copy));
        return response;
      })),
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const openClient = clients.find((client) => 'focus' in client);
      if (openClient) return openClient.focus();
      return self.clients.openWindow('/');
    }),
  );
});
