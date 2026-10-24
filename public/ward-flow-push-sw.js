/*
 * Ward Flow service worker: phone alerts (feature 4) and the offline fallback (PWA plan, Oct 2026).
 * Registered on every Ward Flow load (shell/ward-pwa-registration.tsx) and by the phone alerts
 * switch (shell/ward-phone-push.ts), both with scope /ward-flow, so Home is covered too.
 *
 * Push: shows the notification the Ward Flow server sent and opens Ward Flow when it is tapped. It
 * shows only the server's generic words (a count, a site and "Synthetic demo data"), checked against
 * the exact templates the server builds (PS-13), and opens only a Ward Flow path on this site.
 *
 * Caching (D-18): only static files, never pages or data. `wardFlowCacheRule` decides, and it is
 * unit-tested (tests/ward-pwa-worker.test.ts). Kept: the build's hashed files under /_next/static
 * (scripts, styles, fonts), the app icons and the manifest, and one static offline page with no
 * data. Never kept: a page (HTML), a React Server Components payload, anything under /api, or any
 * other request. A page is always fetched from the network; only when that fails is the offline
 * page shown in its place.
 */
const WARD_FLOW_PATH = "/ward-flow";
const ALERTS_PATH = `${WARD_FLOW_PATH}/alerts`;
const FALLBACK = { title: "Ward Flow: act now", body: "Open Alerts to review. Synthetic demo data." };
// The only words a push may show: the templates pushPayload builds in backend/ward-flow/push.mjs.
// Anything else, such as free text that could name a person, is replaced by FALLBACK (PS-13). A site
// is allowed only as a short plain label.
const PUSH_WHERE = "(?:Ward Flow network|\\d{1,5} sites|[A-Za-z0-9][A-Za-z0-9 '&.()-]{0,59})";
const PUSH_TITLES = [
  /^Ward Flow: \d{1,5} new act now items?$/,
  /^Ward Flow: \d{1,5} new or changed transport jobs?$/,
  /^Ward Flow: \d{1,5} updates? for your team$/,
];
const PUSH_BODIES = [
  new RegExp(`^${PUSH_WHERE}\\. Open (?:Alerts|Transport jobs) to review\\. Synthetic demo data\\.$`),
  /^A referral answered, or a client admitted or discharged\. Open Alerts to review\. Synthetic demo data\.$/,
];
// Must match WARD_PWA_OPEN_MESSAGE in shell/ward-pwa-registration.tsx.
const OPEN_MESSAGE = "ward-flow-open";

// Bump the version when the precache list or the caching rules change: activate deletes the rest.
const CACHE_PREFIX = "ward-flow-static-";
const STATIC_CACHE = `${CACHE_PREFIX}v2`;
const OFFLINE_URL = "/ward-flow-offline.html";
// Best effort: a missing icon must not stop the worker installing, or phone alerts would stop too.
const PRECACHE_OPTIONAL = ["/icon.svg", "/icons/icon-192", "/icons/maskable-192"];
// Old build files pile up across deploys; keep the newest few hundred.
const STATIC_CACHE_LIMIT = 300;

/** Ward Flow itself or a page under it; not a sibling such as /mockups/ward-flow-digest. */
function insideWardFlow(pathname) {
  return pathname === WARD_FLOW_PATH || pathname.startsWith(`${WARD_FLOW_PATH}/`);
}

/** Static files whose path is not hashed: icons and the manifest. Refreshed in the background. */
function staticAssetPath(pathname) {
  return (
    pathname === "/icon.svg" ||
    pathname.startsWith("/icons/") ||
    pathname === "/apple-icon" ||
    pathname.startsWith("/apple-icon.") ||
    pathname === "/manifest.webmanifest" ||
    pathname === OFFLINE_URL
  );
}

/**
 * What this worker may do with a request: "navigate" (network first, offline page only on a
 * network failure, never stored), "immutable" (hashed build file: cache first), "asset" (icon or
 * manifest: cached copy first, refreshed in the background) or null (left to the browser, never
 * stored). `request` needs `method`, `url`, `mode` and `headers.get`.
 */
function wardFlowCacheRule(request, origin) {
  if (!request || request.method !== "GET") return null;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  if (request.mode === "navigate") return insideWardFlow(url.pathname) ? "navigate" : null;
  // React Server Components payloads carry page data: never cached, whatever the path.
  const header = (name) =>
    request.headers && typeof request.headers.get === "function" ? request.headers.get(name) : null;
  if (header("RSC") !== null || header("Next-Router-Prefetch") !== null || url.searchParams.has("_rsc")) return null;
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return null;
  if (url.pathname.startsWith("/_next/static/")) return "immutable";
  if (staticAssetPath(url.pathname)) return "asset";
  return null;
}

/**
 * Whether a response for a cacheable request may be stored: a plain same-origin 200 that is not a
 * page or a Server Components payload and does not forbid storing. A hashed build file must also
 * say it is immutable, which only a production build does, so the dev server is never cached.
 */
function wardFlowResponseMayBeCached(response, rule) {
  if (!response || response.status !== 200 || response.type !== "basic") return false;
  const type = (response.headers.get("Content-Type") || "").toLowerCase();
  if (type.includes("text/x-component")) return false;
  if (type.includes("text/html")) return false;
  const control = (response.headers.get("Cache-Control") || "").toLowerCase();
  if (control.includes("no-store") || control.includes("private")) return false;
  if (rule === "immutable" && !control.includes("immutable")) return false;
  return true;
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

/** Push words only when they are short and match one of the server's templates; else the fallback. */
function pushText(value, fallback, limit, templates) {
  const text = shortText(value, fallback, limit);
  return templates.some((template) => template.test(text)) ? text : fallback;
}

// Only hashed build files are trimmed: the offline page and icons were added first at install, so
// trimming oldest-first across every entry would evict them before any old build file.
async function trimStaticCache(cache) {
  const keys = (await cache.keys()).filter((key) => new URL(key.url).pathname.startsWith("/_next/static/"));
  const extra = keys.length - STATIC_CACHE_LIMIT;
  if (extra > 0) await Promise.all(keys.slice(0, extra).map((key) => cache.delete(key)));
}

async function store(request, response, rule) {
  if (!wardFlowResponseMayBeCached(response, rule)) return;
  const cache = await caches.open(STATIC_CACHE);
  await cache.put(request, response);
  if (rule === "immutable") await trimStaticCache(cache);
}

async function fromNetworkFirst(event) {
  try {
    const preloaded = await event.preloadResponse;
    if (preloaded) return preloaded;
    return await fetch(event.request);
  } catch {
    // Only a network failure lands here: a server error page is shown as the server sent it.
    const offline = await caches.match(OFFLINE_URL, { cacheName: STATIC_CACHE });
    return offline || Response.error();
  }
}

async function fromCacheFirst(event) {
  const hit = await caches.match(event.request, { cacheName: STATIC_CACHE });
  if (hit) return hit;
  const response = await fetch(event.request);
  event.waitUntil(store(event.request, response.clone(), "immutable").catch(() => undefined));
  return response;
}

async function fromCacheThenRefresh(event) {
  const hit = await caches.match(event.request, { cacheName: STATIC_CACHE });
  const refresh = fetch(event.request).then((response) => {
    event.waitUntil(store(event.request, response.clone(), "asset").catch(() => undefined));
    return response;
  });
  if (!hit) return refresh;
  event.waitUntil(refresh.catch(() => undefined));
  return hit;
}

self.addEventListener("install", (event) => {
  // No skipWaiting here: a new version waits until the person taps Reload on the page's notice,
  // which posts SKIP_WAITING, so code never changes under them mid-task.
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
      await Promise.all(
        PRECACHE_OPTIONAL.map((path) => cache.add(new Request(path, { cache: "reload" })).catch(() => undefined)),
      );
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== STATIC_CACHE)
          .map((name) => caches.delete(name)),
      );
      // Starts the page request while the worker wakes, so pages load no slower with it.
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const rule = wardFlowCacheRule(event.request, self.location.origin);
  if (rule === "navigate") event.respondWith(fromNetworkFirst(event));
  else if (rule === "immutable") event.respondWith(fromCacheFirst(event));
  else if (rule === "asset") event.respondWith(fromCacheThenRefresh(event));
  // Anything else: no respondWith, so the browser fetches it as if there were no worker.
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = pushText(data.title, FALLBACK.title, 120, PUSH_TITLES);
  const body = pushText(data.body, FALLBACK.body, 240, PUSH_BODIES);
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
      // Every open Ward Flow window, including one this worker does not control yet (F-11), so a tap
      // reuses it rather than opening a second Ward Flow window.
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (!insideWardFlow(new URL(client.url).pathname)) continue;
        let focused;
        try {
          focused = await client.focus();
        } catch {
          continue; // A window that cannot be focused: try the next, or open a new one below.
        }
        try {
          if (!("navigate" in focused)) throw new Error("No navigate");
          await focused.navigate(target);
        } catch {
          // navigate() refuses a window this worker does not control: ask the page to go there
          // itself (shell/ward-pwa-registration.tsx listens for this message).
          focused.postMessage({ type: OPEN_MESSAGE, url: target });
        }
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});
