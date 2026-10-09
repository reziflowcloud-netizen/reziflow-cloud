/* Push-only worker. Deliberately no fetch handler, Cache API or offline storage. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { /* safe generic push */ }
  const safeUrl = typeof payload.url === 'string' && /^\/notifications\/open\/[\w-]{1,100}$/.test(payload.url) ? payload.url : '/dashboard';
  event.waitUntil((async () => {
    await self.registration.showNotification('LegalHub CRM', {
      body: typeof payload.body === 'string' ? payload.body.slice(0, 250) : 'LegalHub CRM',
      icon: '/favicon.png', badge: '/favicon.png',
      tag: typeof payload.tag === 'string' ? payload.tag.slice(0, 100) : 'legalhub',
      data: { url: safeUrl },
    });
    if (Number.isSafeInteger(payload.unread) && payload.unread >= 0) {
      try { if (payload.unread && self.navigator.setAppBadge) await self.navigator.setAppBadge(payload.unread); else if (self.navigator.clearAppBadge) await self.navigator.clearAppBadge(); } catch { /* optional */ }
    }
    for (const client of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) client.postMessage({ type: 'notifications-changed' });
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const path = event.notification.data?.url;
    const safePath = typeof path === 'string' && /^\/notifications\/open\/[\w-]{1,100}$/.test(path) ? path : '/dashboard';
    // Navigation passes through auth and current entity authorization on the server.
    const url = new URL(safePath, self.location.origin).href;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin && 'navigate' in client) {
        await client.navigate(url); await client.focus(); return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
