/* Push-only worker. Deliberately no fetch handler, Cache API or offline storage. */
const PILOT_WORKER_VERSION = 'notification-click-existing-window-2';
const pilotInstanceId = self.crypto.randomUUID();
function notificationNavigationTarget(rawPath) {
  const path = typeof rawPath === 'string' && /^\/notifications\/open\/[\w-]{1,100}$/.test(rawPath) ? rawPath : '/dashboard';
  return { path, url: new URL(path, self.location.origin).href };
}
function notificationWindow(client) {
  try { return new URL(client.url).origin === self.location.origin && client.frameType !== 'nested'; }
  catch { return false; }
}
function restoredSettingsWindow(client) {
  return notificationWindow(client) && /^\/settings(?:\/|$)/.test(new URL(client.url).pathname);
}
async function notificationDisplayWindows() {
  let timer;
  try {
    return await Promise.race([
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }),
      new Promise(resolve => { timer = setTimeout(() => resolve([]), 500); }),
    ]);
  } catch { return []; } finally { clearTimeout(timer); }
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
    // Bound this lookup so unavailable client enumeration cannot stall display.
    const windows = await notificationDisplayWindows();
    // A native action URL may suppress notificationclick in WebKit. For an
    // existing (including suspended) window, retain the JS click event so it
    // can navigate the resolver instead of merely restoring the previous page.
    // This is window-state selection for ALL types, never a push_test branch.
    const useNativeLaunch = !windows.some(notificationWindow);
    await self.registration.showNotification('LegalHub CRM', {
      body: typeof payload.body === 'string' ? payload.body.slice(0, 250) : 'LegalHub CRM',
      icon: '/favicon.png', badge: '/favicon.png',
      tag: typeof payload.tag === 'string' ? payload.tag.slice(0, 100) : 'legalhub',
      ...(useNativeLaunch ? { navigate: target.url } : {}),
      data: { url: target.path, pilotDiagnostics: payload.pilotDiagnostics === true, workerVersion: PILOT_WORKER_VERSION },
    });
    const pending = [];
    pilotTrace({ url: target.path, pilotDiagnostics: payload.pilotDiagnostics }, pending)('push-received');
    if (Number.isSafeInteger(payload.unread) && payload.unread >= 0) {
      try { if (payload.unread && self.navigator.setAppBadge) await self.navigator.setAppBadge(payload.unread); else if (self.navigator.clearAppBadge) await self.navigator.clearAppBadge(); } catch { /* optional */ }
    }
    for (const client of windows.filter(notificationWindow)) {
      try { client.postMessage({ type: 'notifications-changed' }); } catch { /* suspended/closed page */ }
    }
    await Promise.allSettled(pending);
  })());
});
async function openInNotificationClient(client, path, url, trace) {
  if (client.url === url) {
    try { await client.focus(); trace('focus-ok'); return true; } catch { /* retry through resolver */ }
  }
  // Navigate before focus: restoring the old Settings page is not a completed
  // click. Client navigation follows the server's auth/access/read resolver.
  try {
    const navigated = await client.navigate(url);
    if (navigated && !restoredSettingsWindow(navigated)) {
      trace('navigate-ok');
      try { await navigated.focus(); } catch { /* navigation has been requested */ }
      return true;
    }
    trace(navigated ? 'navigate-failed' : 'navigate-null');
  } catch { trace('navigate-failed'); }
  // WebKit can expose an inert client during activation. Wake it and let the
  // page request the very same resolver when native client navigation fails.
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
  return false;
}
async function navigateNotification(target, trace) {
  let windows = [];
  try { windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true }); } catch { /* openWindow still has the intended URL */ }
  trace('clients-found');
  const candidates = windows.filter(client => notificationWindow(client) && typeof client.navigate === 'function');
  candidates.sort((a, b) => Number(b.url === target.url) - Number(a.url === target.url));
  for (const client of candidates) {
    if (await openInNotificationClient(client, target.path, target.url, trace)) return true;
  }
  try {
    const opened = await self.clients.openWindow(target.url);
    trace(opened ? 'open-window' : 'open-window-null');
    // Some WebKit activations return a restored existing window. Settings is
    // never a resolver outcome; do not accept that as a successful open.
    if (opened && restoredSettingsWindow(opened)) {
      return await openInNotificationClient(opened, target.path, target.url, trace);
    }
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
