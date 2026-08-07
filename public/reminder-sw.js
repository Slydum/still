const SHELL_CACHE = 'still-shell-v3';
const APP_SCOPE_URL = new URL(self.registration.scope);
const APP_SHELL_URL = new URL('./', APP_SCOPE_URL).toString();

function appUrl(path = '/') {
  const normalized = path === '/' ? './' : path.replace(/^\//, '');
  return new URL(normalized, APP_SCOPE_URL).toString();
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll([
      APP_SHELL_URL,
      appUrl('/manifest.webmanifest'),
      appUrl('/icons/icon-192.png'),
      appUrl('/icons/icon-512.png'),
    ])),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith('still-shell-') && key !== SHELL_CACHE).map((key) => caches.delete(key)),
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
          if (response.ok) {
            const copy = response.clone();
            void caches.open(SHELL_CACHE).then((cache) => cache.put(APP_SHELL_URL, copy));
          }
          return response;
        })
        .catch(() => caches.match(APP_SHELL_URL)),
    );
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin === self.location.origin && requestUrl.pathname.startsWith(APP_SCOPE_URL.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })),
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  let targetPath = event.notification.data?.url || '/notifications';
  if (event.action === 'check-in-now') targetPath = '/?checkin=now';
  if (event.action === 'snooze-check-in') targetPath = '/?checkin=snooze';
  const targetUrl = appUrl(targetPath);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const openClient = clients.find((client) => 'focus' in client);
      if (openClient) return openClient.navigate(targetUrl).then(() => openClient.focus());
      return self.clients.openWindow(targetUrl);
    }),
  );
});
