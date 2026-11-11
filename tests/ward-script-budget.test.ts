import { createServer } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import { removePathSync } from "../scripts/retryable-fs.mjs";

import {
  formatReport,
  LEGACY_MOVEMENT_REDIRECT,
  overBudget,
  pageAssets,
  REPORT_ROUTES,
  reportSizes,
  routeKb,
  scriptSources,
  validateBudgets,
} from "../scripts/check-script-budget.mjs";
import scriptBudget from "../script-budget.json";
import { movementHref } from "../src/components/ward-management/shell/ward-facade";
import { encodeRecordAddress } from "../src/components/ward-management/shell/ward-record-address";

type Fixture = { status?: number; type?: string; body?: string; location?: string; stall?: boolean };

async function strictBudgetGate(measuredStatus: number, event = "push", treeError = false) {
  const directory = mkdtempSync(join(tmpdir(), "ward-strict-budget-"));
  const tree = "a".repeat(40);
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.doMock("node:child_process", () => ({
    execFileSync: vi.fn((_command: string, args: string[]) => {
      if (treeError && args.includes("HEAD^{tree}")) throw new Error("Synthetic unreadable tree");
      return args.includes("HEAD^{tree}") ? tree : "b".repeat(40);
    }),
    spawnSync: vi.fn((_command: string, args: string[]) => ({
      // No subprocess is started. The inherited-overage path has a successful judgement,
      // but deliberately mismatched dependency inputs prevent a second build.
      status: args.includes("--write") ? measuredStatus : args.includes("--judge") ? 0 : 1,
    })),
  }));
  vi.resetModules();
  try {
    const { gate } = await import("../scripts/ward-ci-public/budget-gate.mjs");
    const status = gate({ root: process.cwd(), event, outDir: directory });
    return { status, tree, notices: log.mock.calls.map((call) => call.join(" ")) };
  } finally {
    vi.doUnmock("node:child_process");
    vi.resetModules();
    log.mockRestore();
    error.mockRestore();
    removePathSync(directory, { recursive: true, force: true });
  }
}

describe("strict budget evidence producer", () => {
  it.each(["push", "pull_request", "workflow_dispatch"])(
    "records strict tree compliance only after a clean %s measurement",
    async (event) => {
      const result = await strictBudgetGate(0, event);
      expect(result.status).toBe(0);
      expect(result.notices).toContain(`::notice title=Ward strict budget tree::${result.tree}`);
    },
  );

  it("does not turn an inherited-overage PR warning into strict compliance evidence", async () => {
    const result = await strictBudgetGate(2, "pull_request");
    expect(result.status).toBe(0);
    expect(result.notices.some((notice) => notice.includes("Ward strict budget tree"))).toBe(false);
  });

  it.each([1, 2])("emits no strict receipt after measurement failure %s", async (status) => {
    const result = await strictBudgetGate(status);
    expect(result.status).toBe(status);
    expect(result.notices.some((notice) => notice.includes("Ward strict budget tree"))).toBe(false);
  });

  it("fails closed when a successful measurement cannot identify its tree", async () => {
    await expect(strictBudgetGate(0, "push", true)).rejects.toThrow("Synthetic unreadable tree");
  });
});

async function withPages(
  fixtures: Record<string, Fixture>,
  check: (base: string, requests: string[]) => Promise<void>,
) {
  const requests: string[] = [];
  const server = createServer((request, response) => {
    const path = request.url ?? "/";
    requests.push(path);
    const fixture = fixtures[path];
    response.writeHead(fixture?.status ?? (fixture ? 200 : 404), {
      "content-type": fixture?.type ?? "text/html",
      ...(fixture?.location ? { location: fixture.location } : {}),
    });
    if (fixture?.stall) {
      response.flushHeaders();
      response.write("/* synthetic stalled asset */");
      return;
    }
    response.end(fixture?.body ?? "");
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Fixture server has no port");
    await check(`http://127.0.0.1:${address.port}`, requests);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

const page = '<script src="/_next/static/chunks/a.js?dpl=test&amp;v=1"></script>';
const chunk = "console.log('synthetic budget fixture');";
const asset = { type: "application/javascript; charset=utf-8", body: chunk };

describe("phone script budget", () => {
  it("collects each Next static script once", () => {
    const html =
      '<script src="/_next/static/chunks/a.js" async=""></script><script src="/_next/static/chunks/a.js"></script>' +
      '<script src="/_next/static/chunks/b.js"></script><script src="https://example.test/x.js"></script>';
    expect(scriptSources(html)).toEqual(["/_next/static/chunks/a.js", "/_next/static/chunks/b.js"]);
  });

  it("skips nomodule scripts that modern phones never download", () => {
    const html =
      '<script src="/_next/static/chunks/polyfills.js" noModule=""></script>' +
      '<script nomodule src="/_next/static/chunks/legacy.js"></script><script src="/_next/static/chunks/main.js"></script>';
    expect(scriptSources(html)).toEqual(["/_next/static/chunks/main.js"]);
  });

  it("counts parsed script elements rather than HTML examples or attribute text", () => {
    expect(
      scriptSources(
        '<!-- <script src="/_next/static/comment.js"></script> -->' +
          "<script>const example = '<script src=\"/_next/static/example.js\">';</script>" +
          '<script data-note=" nomodule " src="/_next/static/real.js"></script>' +
          '<script data-note=">" src="/_next/static/quoted.js"></script>',
      ),
    ).toEqual(["/_next/static/real.js", "/_next/static/quoted.js"]);
  });

  it("counts executable HTML scripts, including modules with nomodule, rather than data blocks", () => {
    expect(
      scriptSources(
        '<script type="application/json" src="/_next/static/data.js"></script>' +
          '<script type="importmap" src="/_next/static/map.js"></script>' +
          '<script type="text/javascript; charset=utf-8" src="/_next/static/parameters.js"></script>' +
          '<script language="vbscript" src="/_next/static/legacy-data.js"></script>' +
          '<script type="MODULE" nomodule src="/_next/static/module.js"></script>' +
          '<script type="text/javascript" src="/_next/static/classic.js"></script>' +
          '<script type="" language="vbscript" src="/_next/static/empty-type.js"></script>' +
          '<svg><script src="/_next/static/svg.js"></script></svg>' +
          '<template><script src="/_next/static/template.js"></script></template>',
      ),
    ).toEqual(["/_next/static/module.js", "/_next/static/classic.js", "/_next/static/empty-type.js"]);
  });

  it("aborts a stalled asset body using a fresh request deadline", async () => {
    const controllers: AbortController[] = [];
    const deadline = vi.spyOn(AbortSignal, "timeout").mockImplementation(() => {
      const controller = new AbortController();
      controllers.push(controller);
      return controller.signal;
    });
    try {
      await withPages(
        {
          "/a": { body: page },
          "/_next/static/chunks/a.js?dpl=test&v=1": { type: "application/javascript", stall: true },
        },
        async (base, requests) => {
          const measured = routeKb(base, "/a").then(
            (value) => ({ value, error: undefined }),
            (error) => ({ value: undefined, error }),
          );
          await vi.waitFor(() => expect(requests).toContain("/_next/static/chunks/a.js?dpl=test&v=1"));
          expect(deadline).toHaveBeenCalledWith(10_000);
          expect(controllers).toHaveLength(2);
          controllers[1]!.abort(new DOMException("synthetic request deadline", "TimeoutError"));
          const result = await measured;
          expect(result.error).toMatchObject({ name: "TimeoutError" });
        },
      );
    } finally {
      deadline.mockRestore();
    }
  });

  it("reports only the routes over their budget", () => {
    expect(overBudget({ "/a": 500, "/b": 611 }, { "/a": 585, "/b": 610 })).toEqual([
      { route: "/b", kb: 611, limit: 610 },
    ]);
  });

  it("reads query-bearing, single-quoted and unquoted script sources without counting other tags", () => {
    expect(
      scriptSources(
        page +
          '<script src="/_next/static/chunks/a.js?dpl=test&amp;v=1#boot"></script>' +
          `<script src='/_next/static/b.js?v=2'></script><script src=/_next/static/c.js></script><img src="/_next/static/ignored.js"><script data-src="/_next/static/also-ignored.js"></script>`,
      ),
    ).toEqual(["/_next/static/chunks/a.js?dpl=test&v=1", "/_next/static/b.js?v=2", "/_next/static/c.js"]);
  });

  it.each([
    undefined,
    null,
    {},
    [],
    { "/a": 0 },
    { "/a": -1 },
    { "/a": "5" },
    { "/a": NaN },
    { "/a": Infinity },
    { "//elsewhere/a": 5 },
    { "/a?changed=1": 5 },
    { "": 5 },
    { "/\\example.test/a": 5 },
    { "/ward-flow/movements/../../ward-flow": 5 },
  ])("rejects invalid budgets: %j", (budgets) => {
    expect(() => validateBudgets(budgets)).toThrow();
  });

  it.each([
    undefined,
    {},
    { "/a": undefined },
    { "/a": 0 },
    { "/a": -1 },
    { "/a": "1" },
    { "/a": NaN },
    { "/a": Infinity },
    { "/a": 1, "/extra": 1 },
  ])("rejects incomplete or invalid measurements: %j", (measured) => {
    expect(() => overBudget(measured, { "/a": 5 })).toThrow();
  });

  it("accepts a measurement exactly at its budget", () => {
    expect(overBudget({ "/a": 5 }, { "/a": 5 })).toEqual([]);
  });

  it("counts the queried script once and retains fractional KB when comparing budgets", async () => {
    await withPages(
      { "/a": { body: page + page }, "/_next/static/chunks/a.js?dpl=test&v=1": asset },
      async (base, requests) => {
        const kb = await routeKb(base, "/a");
        expect(kb).toBe(gzipSync(Buffer.from(chunk), { level: 9 }).length / 1024);
        expect(overBudget({ "/a": kb }, { "/a": kb - 0.001 })).toHaveLength(1);
        expect(requests).toEqual(["/a", "/_next/static/chunks/a.js?dpl=test&v=1"]);
      },
    );
  });

  it.each([{ body: "<html>No scripts</html>" }, { body: page, type: "application/json" }])(
    "rejects pages without valid script measurement evidence: %j",
    async (fixture) => {
      await withPages({ "/a": fixture }, async (base) => {
        await expect(routeKb(base, "/a")).rejects.toThrow(/no Next static scripts|expected an HTML page/);
      });
    },
  );

  it.each([
    { type: "text/html", body: "<html>Fallback page</html>" },
    { type: "application/javascript", body: "" },
    { status: 307, location: "/small.js" },
    { status: 404 },
  ])("rejects invalid asset responses: %j", async (fixture) => {
    await withPages(
      { "/a": { body: page }, "/_next/static/chunks/a.js?dpl=test&v=1": fixture },
      async (base, requests) => {
        await expect(routeKb(base, "/a")).rejects.toThrow(/did not return JavaScript|was empty|answered/);
        expect(requests).toHaveLength(2);
      },
    );
  });

  it("keeps the legacy movement redirect paired with the configured route and movementHref", () => {
    expect(LEGACY_MOVEMENT_REDIRECT.destination).toBe(movementHref("WF-001"));
    expect(Object.keys(scriptBudget.budgets)).toContain(LEGACY_MOVEMENT_REDIRECT.route);
  });

  it("preserves the configured movement's exact record-address redirect", async () => {
    const legacy = "/ward-flow/movements/WF-001";
    const canonical = `/ward-flow/movements/${encodeRecordAddress("WF-001")}`;
    await withPages(
      {
        [legacy]: { status: 307, location: canonical },
        [canonical]: { body: page },
        "/_next/static/chunks/a.js?dpl=test&v=1": asset,
      },
      async (base, requests) => {
        expect(await routeKb(base, legacy)).toBeGreaterThan(0);
        expect(requests).toEqual([legacy, canonical, "/_next/static/chunks/a.js?dpl=test&v=1"]);
      },
    );
  });

  it.each([
    ["/a", "/login"],
    ["/ward-flow/movements/WF-001", "/login"],
    ["/ward-flow/movements/WF-001", "http://127.0.0.1:1/ward-flow/movements/1nfzcp26wc0g"],
    ["/ward-flow/movements/WF-001", "/ward-flow/movements/1nfzcp26wc0g?other=record"],
    ["/ward-flow/movements/WF-001", "/mockups/ward-flow/movements/1nfzcp26wc0g"],
  ])("rejects unexpected route redirects from %s to %s", async (route, location) => {
    await withPages({ [route]: { status: 307, location } }, async (base, requests) => {
      await expect(routeKb(base, route)).rejects.toThrow(/answered 307|unexpected redirect destination/);
      expect(requests).toEqual([route]);
    });
  });
});

// Performance audit WF-01, WF-02, WF-06 and WF-18 (11 November 2026): sizes the budget did not see,
// reported beside it and never judged.
describe("report-only sizes", () => {
  it("lists stylesheets and preloaded script the script count leaves out", () => {
    const html =
      '<link rel="stylesheet" href="/_next/static/css/a.css" data-precedence="next">' +
      '<link rel="stylesheet" href="/_next/static/css/a.css">' +
      '<link rel="preload" as="script" href="/_next/static/chunks/p.js">' +
      '<link rel="modulepreload" href="/_next/static/chunks/m.js">' +
      '<link rel="preload" as="font" href="/_next/static/media/f.woff2">' +
      '<link rel="stylesheet" href="https://example.test/x.css">';
    expect(pageAssets(html)).toEqual({
      stylesheets: ["/_next/static/css/a.css"],
      preloads: ["/_next/static/chunks/p.js", "/_next/static/chunks/m.js"],
    });
  });

  it("measures script, stylesheets, uncounted preloads and the shared shell, and records a failed page", async () => {
    const css = "body{color:red}";
    const shell = '<script src="/_next/static/chunks/a.js"></script>';
    await withPages(
      {
        "/one": { body: `${shell}<link rel="stylesheet" href="/_next/static/css/a.css">` },
        "/two": {
          body: `${shell}<script src="/_next/static/chunks/b.js"></script><link rel="preload" as="script" href="/_next/static/chunks/a.js"><link rel="preload" as="script" href="/_next/static/chunks/p.js">`,
        },
        "/_next/static/chunks/a.js": asset,
        "/_next/static/chunks/b.js": asset,
        "/_next/static/chunks/p.js": asset,
        "/_next/static/css/a.css": { type: "text/css", body: css },
      },
      async (base) => {
        const report = await reportSizes(base, ["/one", "/two"], ["/missing"]);
        const kb = (body: string) => Math.round((gzipSync(Buffer.from(body), { level: 9 }).length / 1024) * 10) / 10;
        expect(report.routes["/one"]).toEqual({
          budgeted: true,
          scriptKb: kb(chunk),
          cssKb: kb(css),
          cssFiles: 1,
          preloadKb: 0,
          preloadFiles: 0,
        });
        expect(report.routes["/two"]).toMatchObject({ preloadFiles: 1, cssFiles: 0 });
        expect(report.routes["/missing"]).toEqual({ budgeted: false, error: "/missing answered 404" });
        expect(report.sharedScriptKb).toBe(kb(chunk));
        expect(formatReport(report)).toContain("| /missing | no | not measured: /missing answered 404 | | |");
      },
    );
  });

  it("keeps a budgeted page whose stylesheet fails in the shared shell, and omits the total when a budgeted page cannot be read", async () => {
    const pages = {
      "/one": {
        body: '<script src="/_next/static/chunks/a.js"></script><script src="/_next/static/chunks/b.js"></script>',
      },
      "/two": {
        body: '<script src="/_next/static/chunks/a.js"></script><link rel="stylesheet" href="/_next/static/css/gone.css">',
      },
      "/_next/static/chunks/a.js": asset,
      "/_next/static/chunks/b.js": asset,
    };
    await withPages(pages, async (base) => {
      const kb = (body: string) => Math.round((gzipSync(Buffer.from(body), { level: 9 }).length / 1024) * 10) / 10;
      const report = await reportSizes(base, ["/one", "/two"], []);
      expect(report.routes["/two"]).toMatchObject({ budgeted: true, error: expect.stringContaining("gone.css") });
      // Only a.js is on both budgeted pages; b.js must not count as shared.
      expect(report.sharedScriptKb).toBe(kb(chunk));

      const unreadable = await reportSizes(base, ["/one", "/missing"], []);
      expect(unreadable.sharedScriptKb).toBeUndefined();
      expect(formatReport(unreadable)).not.toContain("shared shell");
    });
  });

  it("reports the heavy unbudgeted triage page", () => {
    expect(REPORT_ROUTES).toContain("/ward-flow/people/PT-028/triage");
    for (const route of REPORT_ROUTES) expect(Object.keys(scriptBudget.budgets)).not.toContain(route);
  });
});
