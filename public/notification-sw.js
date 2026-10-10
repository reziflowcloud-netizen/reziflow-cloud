/* Push-only worker. Deliberately no fetch handler, Cache API or offline storage. */
const PILOT_WORKER_VERSION = 'notification-click-unified-1';
const pilotInstanceId = self.crypto.randomUUID();
function notificationNavigationTarget(rawPath) {
  const path = typeof rawPath === 'string' && /^\/notifications\/open\/[\w-]{1,100}$/.test(rawPath) ? rawPath : '/dashboard';
  return { path, url: new URL(path, self.location.origin).href };
}
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
  const target = notificationNavigationTarget(payload.url);
  event.waitUntil((async () => {
    await self.registration.showNotification('LegalHub CRM', {
      body: typeof payload.body === 'string' ? payload.body.slice(0, 250) : 'LegalHub CRM',
      icon: '/favicon.png', badge: '/favicon.png',
      tag: typeof payload.tag === 'string' ? payload.tag.slice(0, 100) : 'legalhub',
      // Use the physically verified WebKit navigation option for every type.
      // Older browsers ignore it and use the shared notificationclick strategy.
      // Diagnostics only controls telemetry; it never selects navigation.
      navigate: target.url,
      data: { url: target.path, pilotDiagnostics: payload.pilotDiagnostics === true, workerVersion: PILOT_WORKER_VERSION },
    });
    const pending = [];
    pilotTrace({ url: target.path, pilotDiagnostics: payload.pilotDiagnostics }, pending)('push-received');
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
  let focused = false;
  try { await client.focus(); focused = true; trace('focus-ok'); } catch { trace('focus-failed'); }
  // A native activation or a repeated click may already have opened the resolver.
  if (focused && client.url === url) return true;
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
async function navigateNotification(target, trace) {
  let windows = [];
  try { windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true }); } catch { /* openWindow still has the intended URL */ }
  trace('clients-found');
  const candidates = windows.filter(client => {
    try { return new URL(client.url).origin === self.location.origin && client.frameType !== 'nested' && 'navigate' in client; }
    catch { return false; }
  });
  candidates.sort((a, b) => Number(b.url === target.url) - Number(a.url === target.url));
  for (const client of candidates) {
    if (await openInNotificationClient(client, target.path, target.url, trace)) return true;
  }
  try {
    const opened = await self.clients.openWindow(target.url);
    trace(opened ? 'open-window' : 'open-window-null');
    try { await opened?.focus(); } catch { /* an opened window must not trigger a second open */ }
    return !!opened;
  } catch { trace('open-window-failed'); return false; }
}
// Coalesce concurrent/rapid duplicate activations of the same notification.
// The cache is bounded, ephemeral and only covers navigation (not event dedupe).
const notificationClicks = new Map();
function openNotification(target, trace) {
  const now = Date.now();
  for (const [path, click] of notificationClicks) if (click.expiresAt <= now) notificationClicks.delete(path);
  const existing = notificationClicks.get(target.path);
  if (existing) return existing.pending;
  if (notificationClicks.size >= 50) return navigateNotification(target, trace);
  const click = { expiresAt: Infinity, pending: null };
  click.pending = navigateNotification(target, trace).then(opened => {
    if (opened) click.expiresAt = Date.now() + 2000;
    else notificationClicks.delete(target.path);
    return opened;
  }, () => { notificationClicks.delete(target.path); });
  notificationClicks.set(target.path, click);
  return click.pending;
}
self.addEventListener('notificationclick', event => {
  const pending = [];
  const trace = pilotTrace(event.notification.data, pending);
  trace('click-start');
  event.notification.close();
  event.waitUntil((async () => {
    try {
      // Navigation passes through auth and current entity authorization on the server.
      await openNotification(notificationNavigationTarget(event.notification.data?.url), trace);
    } finally { await Promise.allSettled(pending); }
  })());
});
