import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";

import { afterEach, describe, expect, it, vi } from "vitest";

// The backend's payload builder, loaded by address so the website's type check does not take in the
// untyped backend module. The tests below run its real output through the worker.
type PushPayload = { title: string; body: string; url: string; tag: string };
const { pushPayload } = (await import(new URL("../backend/ward-flow/push.mjs", import.meta.url).href)) as {
  pushPayload: (alerts: readonly { id: string; site: string | null; kind?: string }[]) => PushPayload;
};

/**
 * PWA plan items 4, 6, 12 and 13 (Oct 2026): what `public/ward-flow-push-sw.js` may keep.
 *
 * D-18: pages and data are never kept on a device. The worker stores only the build's hashed static
 * files, the app icons, the manifest and one static offline page, and fetches every page from the
 * network. These tests run the worker's own decision functions, loaded from the shipped file.
 */

type RequestLike = { method: string; url: string; mode: string; headers: { get(name: string): string | null } };
type ResponseLike = { status: number; type: string; headers: { get(name: string): string | null } };
type Rule = "navigate" | "immutable" | "asset" | null;

const ORIGIN = "https://ward.example";
const WORKER_SOURCE = readFileSync(join(process.cwd(), "public/ward-flow-push-sw.js"), "utf8");
const OFFLINE_PAGE = readFileSync(join(process.cwd(), "public/ward-flow-offline.html"), "utf8");
const CURRENT_CACHE = `ward-flow-static-${/const CACHE_VERSION = "([^"]+)";/.exec(WORKER_SOURCE)?.[1]}-${
  /const OFFLINE_PAGE_REVISION = "([0-9a-f]+)";/.exec(WORKER_SOURCE)?.[1]
}`;

/** H-0308: the worker's offline page revision, recomputed from the shipped page. */
function offlinePageRevision(html: string) {
  return createHash("sha256").update(html.replace(/\r\n/g, "\n")).digest("hex").slice(0, 12);
}

function loadWorker() {
  const listeners: Record<string, (event: unknown) => void> = {};
  const skipped: string[] = [];
  const context: Record<string, unknown> = {
    URL,
    Request: class {
      constructor(
        readonly url: string,
        readonly init?: unknown,
      ) {}
    },
    self: {
      location: { origin: ORIGIN },
      addEventListener: (type: string, listener: (event: unknown) => void) => {
        listeners[type] = listener;
      },
      skipWaiting: () => skipped.push("skipWaiting"),
      clients: { claim: async () => {} },
      registration: {},
    },
  };
  runInNewContext(WORKER_SOURCE, context);
  return {
    listeners,
    skipped,
    rule: context.wardFlowCacheRule as (request: RequestLike, origin: string) => Rule,
    mayStore: context.wardFlowResponseMayBeCached as (response: ResponseLike, rule: Rule) => boolean,
  };
}

function headers(values: Record<string, string> = {}) {
  const lower = Object.fromEntries(Object.entries(values).map(([key, value]) => [key.toLowerCase(), value]));
  return { get: (name: string) => lower[name.toLowerCase()] ?? null };
}

function request(path: string, { method = "GET", mode = "cors", header = {} as Record<string, string> } = {}) {
  return { method, url: new URL(path, ORIGIN).href, mode, headers: headers(header) };
}

function response(contentType: string, cacheControl: string, { status = 200, type = "basic" } = {}): ResponseLike {
  return { status, type, headers: headers({ "Content-Type": contentType, "Cache-Control": cacheControl }) };
}

const IMMUTABLE = "public, max-age=31536000, immutable";

describe("the worker's caching rule (D-18)", () => {
  const { rule } = loadWorker();

  it.each([
    ["/_next/static/chunks/app-1a2b3c.js", "immutable"],
    ["/_next/static/css/4d5e6f.css", "immutable"],
    ["/_next/static/media/geist-latin.0a1b2c.woff2", "immutable"],
    ["/icons/icon-192", "asset"],
    ["/icons/startup-1170x2532", "asset"],
    ["/icon.svg", "asset"],
    ["/apple-icon", "asset"],
    ["/manifest.webmanifest", "asset"],
    ["/ward-flow-offline.html", "asset"],
  ] as const)("keeps the static file %s (%s)", (path, expected) => {
    expect(rule(request(path), ORIGIN)).toBe(expected);
  });

  it.each([
    "/api/health",
    "/api/local-project-id",
    "/api",
    "/ward-flow",
    "/ward-flow/referrals",
    "/ward-flow/beds?ward=rph",
    "/ward-flow-push-sw.js",
    "/screenshots/home-narrow.webp",
    "/icons-elsewhere/thing",
    "/_next/image?url=%2Ficon.svg&w=64&q=75",
    "/_next/data/build/page.json",
  ])("never keeps %s", (path) => {
    expect(rule(request(path), ORIGIN)).toBeNull();
  });

  it("never keeps a Server Components payload, even on a static-looking path", () => {
    expect(rule(request("/ward-flow/referrals", { header: { RSC: "1" } }), ORIGIN)).toBeNull();
    expect(rule(request("/_next/static/chunks/app.js", { header: { RSC: "1" } }), ORIGIN)).toBeNull();
    expect(rule(request("/icons/icon-192", { header: { "Next-Router-Prefetch": "1" } }), ORIGIN)).toBeNull();
    expect(rule(request("/_next/static/chunks/app.js?_rsc=abc12"), ORIGIN)).toBeNull();
    expect(rule(request("/ward-flow?_rsc=abc12"), ORIGIN)).toBeNull();
  });

  it("leaves other methods and other sites alone", () => {
    expect(rule(request("/_next/static/chunks/app.js", { method: "POST" }), ORIGIN)).toBeNull();
    expect(rule(request("/api/workspace", { method: "PUT" }), ORIGIN)).toBeNull();
    expect(rule(request("https://zakzoemeedfepxcstsou.supabase.co/rest/v1/board"), ORIGIN)).toBeNull();
    expect(rule(request("https://cdn.example/_next/static/chunks/app.js"), ORIGIN)).toBeNull();
  });

  it("takes Ward Flow page loads network first, and ignores a sibling such as ward-flow-digest", () => {
    expect(rule(request("/ward-flow", { mode: "navigate" }), ORIGIN)).toBe("navigate");
    expect(rule(request("/ward-flow/alerts", { mode: "navigate" }), ORIGIN)).toBe("navigate");
    expect(rule(request("/mockups/ward-flow-digest", { mode: "navigate" }), ORIGIN)).toBeNull();
    expect(rule(request("/", { mode: "navigate" }), ORIGIN)).toBeNull();
  });
});

describe("what the worker may store from a response", () => {
  const { mayStore } = loadWorker();

  it("stores a production build file, an icon and the manifest", () => {
    expect(mayStore(response("application/javascript", IMMUTABLE), "immutable")).toBe(true);
    expect(mayStore(response("font/woff2", IMMUTABLE), "immutable")).toBe(true);
    expect(mayStore(response("image/png", "public, max-age=86400"), "asset")).toBe(true);
    expect(mayStore(response("application/manifest+json", "public, max-age=0, must-revalidate"), "asset")).toBe(true);
  });

  it("never stores a page or a Server Components payload, whatever the path said", () => {
    expect(mayStore(response("text/html; charset=utf-8", IMMUTABLE), "immutable")).toBe(false);
    expect(mayStore(response("text/html", "public, max-age=86400"), "asset")).toBe(false);
    expect(mayStore(response("text/x-component", IMMUTABLE), "immutable")).toBe(false);
  });

  it("never stores a response that forbids it, an error, or another site's opaque reply", () => {
    expect(mayStore(response("application/javascript", "no-store"), "immutable")).toBe(false);
    expect(mayStore(response("image/png", "private, max-age=60"), "asset")).toBe(false);
    expect(mayStore(response("image/png", "public", { status: 404 }), "asset")).toBe(false);
    expect(mayStore(response("image/png", "public", { status: 206 }), "asset")).toBe(false);
    expect(mayStore(response("image/png", "public", { type: "opaque", status: 0 }), "asset")).toBe(false);
  });

  it("does not store the dev server's build files, which are not marked immutable", () => {
    expect(mayStore(response("application/javascript", "no-cache, must-revalidate"), "immutable")).toBe(false);
  });
});

describe("static cache trim", () => {
  it("evicts only old build files, never the offline page or the icons", async () => {
    const context: Record<string, unknown> = {
      URL,
      self: { location: { origin: ORIGIN }, addEventListener: () => {}, registration: {} },
    };
    runInNewContext(WORKER_SOURCE, context);
    const trim = context.trimStaticCache as (cache: unknown) => Promise<void>;
    // A top-level const is not visible on the vm context, so read the limit from the source.
    const limit = Number(/const STATIC_CACHE_LIMIT = (\d+);/.exec(WORKER_SOURCE)?.[1]);
    expect(limit).toBeGreaterThan(0);
    // Insertion order, as Cache.keys() returns it: the install precache first, then build files.
    const entries = ["/ward-flow-offline.html", "/icon.svg", "/icons/icon-192"]
      .concat(Array.from({ length: limit + 5 }, (_, index) => `/_next/static/chunks/${index}.js`))
      .map((path) => ({ url: new URL(path, ORIGIN).href }));
    const deleted: string[] = [];
    await trim({
      keys: async () => entries,
      delete: async (key: { url: string }) => deleted.push(new URL(key.url).pathname),
    });
    expect(deleted).toEqual(Array.from({ length: 5 }, (_, index) => `/_next/static/chunks/${index}.js`));
  });
});

describe("worker lifecycle", () => {
  it("does not take over on install: a new version waits for SKIP_WAITING from the page", () => {
    expect(WORKER_SOURCE).not.toMatch(/addEventListener\("install"[\s\S]{0,400}skipWaiting\(\)/);
    const worker = loadWorker();
    worker.listeners.message({ data: { type: "something-else" } });
    expect(worker.skipped).toEqual([]);
    worker.listeners.message({ data: { type: "SKIP_WAITING" } });
    expect(worker.skipped).toEqual(["skipWaiting"]);
  });

  it("has every handler the page relies on", () => {
    const worker = loadWorker();
    expect(Object.keys(worker.listeners).sort()).toEqual(
      ["activate", "fetch", "install", "message", "notificationclick", "push"].sort(),
    );
  });

  it("names its cache after the current offline page, so a changed page reaches installed devices (H-0308)", () => {
    const revision = /const OFFLINE_PAGE_REVISION = "([0-9a-f]+)";/.exec(WORKER_SOURCE)?.[1];
    // If this fails, the offline page changed: set OFFLINE_PAGE_REVISION to the expected value.
    expect(revision).toBe(offlinePageRevision(OFFLINE_PAGE));
    expect(offlinePageRevision(`${OFFLINE_PAGE}<!-- edited -->`)).not.toBe(revision);
    expect(WORKER_SOURCE).toContain("const STATIC_CACHE = `${CACHE_PREFIX}${CACHE_VERSION}-${OFFLINE_PAGE_REVISION}`;");
  });

  it("enables navigation preload and removes older Ward Flow caches only", async () => {
    const deleted: string[] = [];
    let preload = false;
    const listeners: Record<string, (event: unknown) => void> = {};
    runInNewContext(WORKER_SOURCE, {
      URL,
      caches: {
        keys: async () => [
          "ward-flow-static-v0",
          "ward-flow-static-v1",
          "ward-flow-static-v2",
          CURRENT_CACHE,
          "someone-elses-cache",
        ],
        delete: async (name: string) => deleted.push(name),
      },
      self: {
        location: { origin: ORIGIN },
        addEventListener: (type: string, listener: (event: unknown) => void) => {
          listeners[type] = listener;
        },
        clients: { claim: async () => {} },
        registration: {
          navigationPreload: {
            enable: async () => {
              preload = true;
            },
          },
        },
      },
    });
    let work: Promise<unknown> = Promise.resolve();
    listeners.activate({ waitUntil: (promise: Promise<unknown>) => (work = promise) });
    await work;
    expect(deleted).toEqual(["ward-flow-static-v0", "ward-flow-static-v1", "ward-flow-static-v2"]);
    expect(preload).toBe(true);
  });

  it("shows the static offline page only when a page load fails on the network", async () => {
    const offline = { offline: true };
    const served = { page: true };
    const respond = async (fetchResult: () => Promise<unknown>) => {
      const listeners: Record<string, (event: unknown) => void> = {};
      runInNewContext(WORKER_SOURCE, {
        URL,
        fetch: fetchResult,
        AbortController,
        setTimeout,
        clearTimeout,
        Response: { error: () => ({ error: true }) },
        caches: { match: async (url: string) => (url === "/ward-flow-offline.html" ? offline : undefined) },
        self: {
          location: { origin: ORIGIN },
          addEventListener: (type: string, listener: (event: unknown) => void) => {
            listeners[type] = listener;
          },
        },
      });
      let reply: Promise<unknown> = Promise.resolve(undefined);
      listeners.fetch({
        request: request("/ward-flow/referrals", { mode: "navigate" }),
        preloadResponse: Promise.resolve(undefined),
        respondWith: (promise: Promise<unknown>) => (reply = promise),
        waitUntil: () => {},
      });
      return reply;
    };
    expect(await respond(async () => served)).toBe(served);
    expect(
      await respond(async () => {
        throw new TypeError("Failed to fetch");
      }),
    ).toBe(offline);
  });

  it("does not answer a request it may not keep, so the browser fetches it as normal", () => {
    const listeners: Record<string, (event: unknown) => void> = {};
    runInNewContext(WORKER_SOURCE, {
      URL,
      self: {
        location: { origin: ORIGIN },
        addEventListener: (type: string, listener: (event: unknown) => void) => {
          listeners[type] = listener;
        },
      },
    });
    let answered = false;
    for (const path of ["/api/health", "/ward-flow/beds?_rsc=1"]) {
      listeners.fetch({ request: request(path), respondWith: () => (answered = true) });
    }
    expect(answered).toBe(false);
  });
});

describe("what a push may show (PS-13)", () => {
  const FALLBACK = { title: "Ward Flow: act now", body: "Open Alerts to review. Synthetic demo data." };

  async function shown(data: unknown) {
    const { title, options } = await notified(data);
    return { title, body: options.body, url: options.data.url };
  }

  async function notified(data: unknown, extra: Record<string, unknown> = {}) {
    const listeners: Record<string, (event: unknown) => void> = {};
    const notes: {
      title: string;
      options: { body: string; tag: string; renotify: boolean; data: { url: string } };
    }[] = [];
    runInNewContext(WORKER_SOURCE, {
      URL,
      ...extra,
      self: {
        location: { origin: ORIGIN },
        addEventListener: (type: string, listener: (event: unknown) => void) => {
          listeners[type] = listener;
        },
        registration: {
          showNotification: async (title: string, options: (typeof notes)[number]["options"]) => {
            notes.push({ title, options });
          },
        },
      },
    });
    let work: Promise<unknown> = Promise.resolve();
    listeners.push({ data: { json: () => data }, waitUntil: (promise: Promise<unknown>) => (work = promise) });
    await work;
    expect(notes).toHaveLength(1);
    return notes[0];
  }

  it("re-buzzes only for act-now; a job or team update replaces its slot quietly (A8-07)", async () => {
    const renotify: Record<string, boolean> = {};
    for (const kind of ["act-now", "job", "community"]) {
      const payload = pushPayload([{ id: `synthetic-${kind}`, site: "Royal Perth Hospital", kind }]);
      renotify[kind] = (await notified(payload)).options.renotify;
    }
    expect(renotify).toEqual({ "act-now": true, job: false, community: false });
    // An unknown tag falls back to the act-now slot, so it re-buzzes as act-now does.
    const good = pushPayload([{ id: "x", site: "Royal Perth Hospital", kind: "job" }]);
    expect((await notified({ ...good, tag: "ward-flow-other" })).options.renotify).toBe(true);
  });

  it("records only the time and kind of each push for Settings, never its words (A8-07)", async () => {
    const puts: { cache: string; key: string; record: unknown; type: string | null }[] = [];
    const caches = {
      open: async (cache: string) => ({
        put: async (key: string, value: Response) =>
          puts.push({ cache, key, record: await value.json(), type: value.headers.get("Content-Type") }),
      }),
    };
    const before = Date.now();
    await notified(pushPayload([{ id: "synthetic-job", site: "Royal Perth Hospital", kind: "job" }]), {
      caches,
      Response,
    });
    expect(puts).toHaveLength(1);
    const [{ cache, key, record, type }] = puts;
    expect(cache).toBe("ward-flow-last-push");
    // Its own cache, outside CACHE_PREFIX, so activate never deletes it.
    expect(cache.startsWith("ward-flow-static-")).toBe(false);
    expect(key).toBe("/ward-flow/__last-push");
    expect(type).toBe("application/json");
    expect(Object.keys(record as object).sort()).toEqual(["at", "kind"]);
    const { at, kind } = record as { at: string; kind: string };
    expect(kind).toBe("jobs");
    expect(Date.parse(at)).toBeGreaterThanOrEqual(before - 1000);
    expect(JSON.stringify(record)).not.toMatch(/Royal Perth|synthetic-job|transport/i);
  });

  it("still shows the notification when the time cannot be recorded (A8-07)", async () => {
    const caches = {
      open: async () => {
        throw new Error("QuotaExceededError");
      },
    };
    const payload = pushPayload([{ id: "x", site: "Royal Perth Hospital" }]);
    expect((await notified(payload, { caches, Response })).title).toBe(payload.title);
  });

  it("shows each kind in its own slot, so a transport job never replaces a red alert (M158)", async () => {
    const tags: string[] = [];
    for (const kind of ["act-now", "job", "community"]) {
      const payload = pushPayload([{ id: `synthetic-${kind}`, site: "Royal Perth Hospital", kind }]);
      const { options } = await notified(payload);
      expect(options.tag).toBe(payload.tag);
      tags.push(options.tag);
    }
    expect(new Set(tags).size).toBe(3);
    // Only the server's own tags pick a slot; anything else, or none, is the act-now slot.
    const good = pushPayload([{ id: "x", site: "Royal Perth Hospital" }]);
    for (const tag of [undefined, "Synthetic Person", "ward-flow-other", 7])
      expect((await notified({ ...good, tag })).options.tag).toBe("ward-flow-act-now");
  });

  it.each([
    ["act now, one site", [{ id: "bed-pull-WF-004", site: "Royal Perth Hospital" }]],
    [
      "act now, two sites",
      [
        { id: "x", site: "Royal Perth Hospital" },
        { id: "y", site: "Fiona Stanley Hospital" },
      ],
    ],
    ["act now, no site", [{ id: "x", site: null }]],
    [
      "transport jobs",
      [
        { id: "job:WF-005:abc", site: "Peel Health Campus", kind: "job" },
        { id: "job:WF-006:def", site: "Peel Health Campus", kind: "job" },
      ],
    ],
    ["team update", [{ id: "community:1", site: "Royal Perth Hospital", kind: "community" }]],
  ])("shows the server's own %s payload as sent", async (_label, alerts) => {
    const payload = pushPayload(alerts);
    expect(await shown(payload)).toEqual({ title: payload.title, body: payload.body, url: payload.url });
  });

  it.each([
    ["free text", "Synthetic Person Example UM100001 arrived", "Synthetic Person Example UM100001 arrived"],
    [
      "a name inside the template",
      "Ward Flow: 1 new act now item for Synthetic Person",
      "Synthetic Person. Open Alerts to review. Synthetic demo data. Call UM100001",
    ],
    [
      "a long site",
      "Ward Flow: 2 new act now items in bed 2",
      `${"A".repeat(61)}. Open Alerts to review. Synthetic demo data.`,
    ],
    [
      "a site with other characters",
      "Ward Flow: 3 new act now items: Synthetic Person",
      "Ward 4: Synthetic Person, bed 2. Open Alerts to review. Synthetic demo data.",
    ],
  ])("shows the fallback words for %s", async (_label, title, body) => {
    expect(await shown({ title, body, url: "/ward-flow/alerts" })).toEqual({ ...FALLBACK, url: "/ward-flow/alerts" });
  });

  it("checks the title and body separately, and keeps the length limits", async () => {
    const good = pushPayload([{ id: "x", site: "Royal Perth Hospital" }]);
    expect(await shown({ ...good, title: "Synthetic Person Example" })).toMatchObject({
      title: FALLBACK.title,
      body: good.body,
    });
    expect(await shown({ ...good, body: "Synthetic Person Example" })).toMatchObject({
      title: good.title,
      body: FALLBACK.body,
    });
    expect(await shown({})).toMatchObject(FALLBACK);
    const long = `Ward Flow: 1 new act now item${" ".repeat(100)}`;
    expect(await shown({ title: long, body: good.body })).toMatchObject({ title: FALLBACK.title });
  });
});

describe("the offline page", () => {
  const html = readFileSync(join(process.cwd(), "public/ward-flow-offline.html"), "utf8");

  it("is static: no script, no data, and a plain link to try again", () => {
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/\bon[a-z]+=/i);
    expect(html).toMatch(/<a class="retry" href="">Try again<\/a>/);
    expect(html).toContain("Ward Flow needs a connection");
    expect(html).toMatch(/made-up demo data/);
    expect(html).toContain("prefers-color-scheme: dark");
  });

  it("retries by itself every 15 seconds without script, so it clears when the network returns (P041)", () => {
    expect(html).toMatch(/<meta http-equiv="refresh" content="15" \/>/);
  });

  it("points staff to the latest printed or saved downtime pack (fix plan item 9)", () => {
    expect(html).toMatch(/latest downtime pack/);
    expect(html).toMatch(/printed copy, or the PDF saved/);
  });

  it("uses plain wording: no em dashes or semicolons in what it says", () => {
    const words = html
      .replace(/<style[\s\S]*?<\/style>/, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<[^>]+>/g, " ");
    expect(words).not.toMatch(/[—;]/);
  });
});

/** Execute the shipped navigation handler with controlled network replies and its real timers. */
function navigationProbe(preloadResponse: Promise<unknown>, signal?: AbortSignal) {
  let resolveFetch!: (response: unknown) => void;
  let rejectFetch!: (reason: unknown) => void;
  const fetchReply = new Promise((resolve, reject) => {
    resolveFetch = resolve;
    rejectFetch = reject;
  });
  const fetchRequest = vi.fn<(request: unknown, options?: { signal: AbortSignal }) => Promise<unknown>>(
    () => fetchReply,
  );
  const offline = { offline: true };
  const context: Record<string, unknown> = {
    URL,
    AbortController,
    setTimeout,
    clearTimeout,
    Response: { error: () => ({ error: true }) },
    fetch: fetchRequest,
    caches: { match: async () => offline },
    self: { location: { origin: ORIGIN }, addEventListener: () => {} },
  };
  runInNewContext(WORKER_SOURCE, context);
  const navigate = context.fromNetworkFirst as (event: unknown) => Promise<unknown>;
  const result = navigate({
    request: { ...request("/ward-flow/capacity", { mode: "navigate" }), signal },
    preloadResponse,
  });
  let settled = false;
  void result.then(() => (settled = true));
  return { result, fetchRequest, resolveFetch, rejectFetch, offline, settled: () => settled };
}

describe("bounded navigation recovery", () => {
  afterEach(() => vi.useRealTimers());

  it("uses one 15-second header budget even when navigation preload never settles", async () => {
    vi.useFakeTimers();
    let resolvePreload!: (response: unknown) => void;
    const preloaded = new Promise((resolve) => (resolvePreload = resolve));
    const probe = navigationProbe(preloaded);
    await vi.advanceTimersByTimeAsync(14_999);
    expect(probe.settled()).toBe(false);

    await vi.advanceTimersByTimeAsync(1);

    expect(probe.settled()).toBe(true);
    expect(await probe.result).toBe(probe.offline);
    expect(probe.fetchRequest).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    const cancel = vi.fn(async () => undefined);
    resolvePreload({ body: { cancel } });
    await vi.advanceTimersByTimeAsync(0);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(probe.fetchRequest).not.toHaveBeenCalled();
  });

  it("aborts a pending worker fetch at the shared deadline and releases a late body", async () => {
    vi.useFakeTimers();
    const probe = navigationProbe(Promise.resolve(undefined));
    await vi.advanceTimersByTimeAsync(0);
    expect(probe.fetchRequest).toHaveBeenCalledTimes(1);
    const signal = probe.fetchRequest.mock.calls[0][1]?.signal;
    expect(signal?.aborted ?? false).toBe(false);
    await vi.advanceTimersByTimeAsync(15_000);

    expect(probe.settled()).toBe(true);
    expect(await probe.result).toBe(probe.offline);
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    const cancel = vi.fn(async () => undefined);
    probe.resolveFetch({ body: { cancel } });
    await vi.advanceTimersByTimeAsync(0);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it.each([200, 500])("passes through a %s reply before the deadline and clears its timer", async (status) => {
    vi.useFakeTimers();
    const probe = navigationProbe(Promise.resolve(undefined));
    await vi.advanceTimersByTimeAsync(14_999);
    const response = { status };
    probe.resolveFetch(response);
    await vi.advanceTimersByTimeAsync(0);

    expect(await probe.result).toBe(response);
    expect(vi.getTimerCount()).toBe(0);
    expect(probe.fetchRequest.mock.calls[0][1]?.signal.aborted ?? false).toBe(false);
  });

  it("uses a successful preload without a duplicate fetch and clears its timer", async () => {
    vi.useFakeTimers();
    const response = { status: 200 };
    const probe = navigationProbe(Promise.resolve(response));

    expect(await probe.result).toBe(response);
    expect(probe.fetchRequest).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("opens recovery on a network rejection and clears its timer", async () => {
    vi.useFakeTimers();
    const probe = navigationProbe(Promise.resolve(undefined));
    await vi.advanceTimersByTimeAsync(0);
    probe.rejectFetch(new TypeError("Failed to fetch"));
    await vi.advanceTimersByTimeAsync(0);

    expect(await probe.result).toBe(probe.offline);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["before", "during", "after headers"])(
    "preserves original navigation cancellation %s fetch",
    async (when) => {
      vi.useFakeTimers();
      const source = new AbortController();
      if (when === "before") source.abort();
      const probe = navigationProbe(Promise.resolve(undefined), source.signal);
      await vi.advanceTimersByTimeAsync(0);
      const [input, options] = probe.fetchRequest.mock.calls[0];
      const signal = options?.signal ?? (input as { signal?: AbortSignal }).signal;
      if (when === "after headers") {
        probe.resolveFetch({ status: 200 });
        await probe.result;
      }
      if (when !== "before") source.abort();

      expect(signal?.aborted).toBe(true);
      // This fetch fixture records the signal; release it explicitly instead of pretending it
      // implements the browser's cancellation machinery.
      if (when !== "after headers") {
        probe.rejectFetch(new TypeError("Navigation aborted"));
        await probe.result;
      }
      expect(vi.getTimerCount()).toBe(0);
    },
  );
});
