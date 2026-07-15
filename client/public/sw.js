// PK Food Service Worker — Web Push handler
// This file must live at the root of the served origin (/sw.js)
// so its scope covers the entire app.

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'PK Food', body: event.data.text(), url: '/' };
  }

  const title = payload.title ?? 'PK Food';
  const options = {
    body: payload.body ?? '',
    icon: '/logo.jpeg',
    badge: '/logo.jpeg',
    data: { url: payload.url ?? '/' },
    // Keep the notification visible until the user acts on it.
    requireInteraction: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url ?? '/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus an existing tab that belongs to this origin.
        for (const client of clientList) {
          if ('focus' in client) {
            return client.focus();
          }
        }
        // No existing tab — open a new one.
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      }),
  );
});
