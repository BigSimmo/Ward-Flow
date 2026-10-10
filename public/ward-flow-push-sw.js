/*
 * Ward Flow phone alerts (feature 4). Shows the notification the Ward Flow server sent and opens
 * Ward Flow when it is tapped. Registered from Settings with scope /mockups/ward-flow/ only.
 *
 * There is deliberately no fetch handler: this worker never intercepts, caches or stores pages or
 * data. It shows only the server's generic words (a count, a site and "Synthetic demo data"), and
 * opens only a Ward Flow path on this site.
 */
const WARD_FLOW_PATH = "/mockups/ward-flow";
const ALERTS_PATH = `${WARD_FLOW_PATH}/alerts`;
const FALLBACK = { title: "Ward Flow: act now", body: "Open Alerts to review. Synthetic demo data." };

/** Ward Flow itself or a page under it; not a sibling such as /mockups/ward-flow-digest. */
function insideWardFlow(pathname) {
  return pathname === WARD_FLOW_PATH || pathname.startsWith(`${WARD_FLOW_PATH}/`);
}

function wardFlowPath(value) {
  if (typeof value !== "string") return ALERTS_PATH;
  try {
    const url = new URL(value, self.location.origin);
    if (url.origin === self.location.origin && insideWardFlow(url.pathname)) return url.pathname;
  } catch {
    // Not a URL: use Alerts.
  }
  return ALERTS_PATH;
}

function shortText(value, fallback, limit) {
  return typeof value === "string" && value.trim() && value.length <= limit ? value : fallback;
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = shortText(data.title, FALLBACK.title, 120);
  const body = shortText(data.body, FALLBACK.body, 240);
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192",
      badge: "/icons/monochrome-192",
      tag: "ward-flow-act-now",
      // A new act-now item should buzz even when an earlier one is still showing. The server's
      // outbox retries only the device whose send failed, so a retry never re-buzzes another one.
      renotify: true,
      data: { url: wardFlowPath(data.url) },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = wardFlowPath(event.notification.data && event.notification.data.url);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        const open = new URL(client.url);
        if (open.origin !== self.location.origin || !insideWardFlow(open.pathname)) continue;
        try {
          const focused = await client.focus();
          if ("navigate" in focused) await focused.navigate(target);
          return;
        } catch {
          // A window that cannot be focused or navigated: open a new one below.
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
