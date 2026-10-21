import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";

import { describe, expect, it } from "vitest";

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

  it("enables navigation preload and removes older Ward Flow caches only", async () => {
    const deleted: string[] = [];
    let preload = false;
    const listeners: Record<string, (event: unknown) => void> = {};
    runInNewContext(WORKER_SOURCE, {
      URL,
      caches: {
        keys: async () => ["ward-flow-static-v0", "ward-flow-static-v1", "ward-flow-static-v2", "someone-elses-cache"],
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
    expect(deleted).toEqual(["ward-flow-static-v0", "ward-flow-static-v1"]);
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
