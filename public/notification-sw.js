/* Push-only worker. Deliberately no fetch handler, Cache API or offline storage. */
const PILOT_WORKER_VERSION = 'pilot-click-diag-1';
const pilotInstanceId = self.crypto.randomUUID();
function pilotTrace(notification, pending) {
  const path = notification?.url;
  if (notification?.pilotDiagnostics !== true || typeof path !== 'string' || !/^\/notifications\/open\/[0-9a-f-]{36}$/.test(path)) return () => {};
  const notificationId = path.slice('/notifications/open/'.length);
  return stage => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    pending.push(fetch('/api/notifications/pilot-diagnostics', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify({ notificationId, workerVersion: PILOT_WORKER_VERSION, instanceId: pilotInstanceId, stage }),
    }).catch(() => undefined).finally(() => clearTimeout(timer)));
  };
}
self.addEventListener('message', event => {
  if (event.data?.type === 'legalhub:pilot-worker-check') event.ports[0]?.postMessage({ workerVersion: PILOT_WORKER_VERSION, instanceId: pilotInstanceId });
});
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
      data: { url: safeUrl, pilotDiagnostics: payload.pilotDiagnostics === true, workerVersion: PILOT_WORKER_VERSION },
    });
    const pending = [];
    pilotTrace({ url: safeUrl, pilotDiagnostics: payload.pilotDiagnostics }, pending)('push-received');
    if (Number.isSafeInteger(payload.unread) && payload.unread >= 0) {
      try { if (payload.unread && self.navigator.setAppBadge) await self.navigator.setAppBadge(payload.unread); else if (self.navigator.clearAppBadge) await self.navigator.clearAppBadge(); } catch { /* optional */ }
    }
    for (const client of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) client.postMessage({ type: 'notifications-changed' });
    await Promise.allSettled(pending);
  })());
});
async function openInNotificationClient(client, path, url, trace) {
  // Wake suspended Home Screen windows before requesting navigation. A failed
  // focus must not abort the authenticated resolver or its fallback.
  try { await client.focus(); trace('focus-ok'); } catch { trace('focus-failed'); }
  const handled = await new Promise(resolve => {
    const channel = new MessageChannel();
    const finish = value => {
      clearTimeout(timer); channel.port1.close(); channel.port2.close(); resolve(value);
    };
    const timer = setTimeout(() => finish(false), 1000);
    channel.port1.onmessage = event => finish(event.data === 'notification-open-accepted');
    try { client.postMessage({ type: 'legalhub:notification-open', path }, [channel.port2]); }
    catch { finish(false); }
  });
  trace(handled ? 'page-ack' : 'page-timeout');
  if (handled) return true;
  try {
    const navigated = await client.navigate(url);
    if (!navigated) { trace('navigate-null'); return false; }
    trace('navigate-ok');
    try { await navigated.focus(); } catch { /* already opened by the OS */ }
    return true;
  } catch { trace('navigate-failed'); return false; }
}
self.addEventListener('notificationclick', event => {
  const pending = [];
  const trace = pilotTrace(event.notification.data, pending);
  trace('click-start');
  event.notification.close();
  event.waitUntil((async () => {
    try {
      const path = event.notification.data?.url;
      const safePath = typeof path === 'string' && /^\/notifications\/open\/[\w-]{1,100}$/.test(path) ? path : '/dashboard';
      // Navigation passes through auth and current entity authorization on the server.
      const url = new URL(safePath, self.location.origin).href;
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      trace('clients-found');
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && 'navigate' in client) {
          if (await openInNotificationClient(client, safePath, url, trace)) return;
        }
      }
      try { trace((await self.clients.openWindow(url)) ? 'open-window' : 'open-window-null'); }
      catch { trace('open-window-failed'); }
    } finally { await Promise.allSettled(pending); }
  })());
});
