import { createServer } from "node:http";
import { gzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";

import {
  budgetTable,
  budgetWarnings,
  GROWTH_WARNING_KB,
  LEGACY_MOVEMENT_REDIRECT,
  NEAR_CEILING_WARNING_KB,
  overBudget,
  reportBudgets,
  routeKb,
  scriptSources,
  validateBudgets,
} from "../scripts/check-script-budget.mjs";
import scriptBudget from "../script-budget.json";
import { movementHref } from "../src/components/ward-management/shell/ward-facade";
import { encodeRecordAddress } from "../src/components/ward-management/shell/ward-record-address";

type Fixture = { status?: number; type?: string; body?: string; location?: string; stall?: boolean };

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
    { "/a": null },
    { "/a": [5, 15] },
    { "/a": {} },
    { "/a": { baseline: 5 } },
    { "/a": { ceiling: 15 } },
    { "/a": { baseline: 5, ceiling: 15, limit: 15 } },
    { "/a": { baseline: 0, ceiling: 15 } },
    { "/a": { baseline: -1, ceiling: 15 } },
    { "/a": { baseline: 5, ceiling: "15" } },
    { "/a": { baseline: NaN, ceiling: 15 } },
    { "/a": { baseline: 5, ceiling: Infinity } },
    { "/a": { baseline: 16, ceiling: 15 } },
    { "//elsewhere/a": { baseline: 5, ceiling: 15 } },
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

  describe("baseline and ceiling (D-96)", () => {
    const budgets = { "/a": { baseline: 500, ceiling: 510 }, "/b": { baseline: 600, ceiling: 610 } };

    it("reads both shapes into a baseline and ceiling per route", () => {
      expect(validateBudgets({ "/a": { baseline: 500, ceiling: 510 }, "/b": 600 })).toEqual({
        "/a": { baseline: 500, ceiling: 510 },
        "/b": { baseline: 600, ceiling: 600 },
      });
      expect(validateBudgets({ "/a": { baseline: 510, ceiling: 510 } })).toEqual({
        "/a": { baseline: 510, ceiling: 510 },
      });
    });

    it("fails only the route over its ceiling, not one merely above its baseline", () => {
      expect(overBudget({ "/a": 509, "/b": 610.1 }, budgets)).toEqual([{ route: "/b", kb: 610.1, limit: 610 }]);
      expect(overBudget({ "/a": 510, "/b": 600 }, budgets)).toEqual([]);
    });

    it("warns when a route has grown more than 3 KB since its baseline", () => {
      expect(GROWTH_WARNING_KB).toBe(3);
      expect(budgetWarnings({ "/a": 503, "/b": 600 }, budgets)).toEqual([]);
      const warnings = budgetWarnings({ "/a": 503.1, "/b": 600 }, budgets);
      expect(warnings).toEqual([expect.objectContaining({ route: "/a", kind: "grown", kb: 503.1 })]);
      expect(warnings[0]!.message).toMatch(/grown 3\.1 KB since the last tidy/);
    });

    it("warns when a route is within 2 KB of its ceiling", () => {
      expect(NEAR_CEILING_WARNING_KB).toBe(2);
      const tight = { "/a": { baseline: 507, ceiling: 510 } };
      expect(budgetWarnings({ "/a": 507.9 }, tight)).toEqual([]);
      expect(budgetWarnings({ "/a": 508 }, tight)).toEqual([
        expect.objectContaining({ route: "/a", kind: "near-ceiling", ceiling: 510 }),
      ]);
    });

    it("gives both warnings when a route has grown and is near its ceiling, and none once over it", () => {
      expect(budgetWarnings({ "/a": 509, "/b": 600 }, budgets).map(({ kind }) => kind)).toEqual([
        "grown",
        "near-ceiling",
      ]);
      expect(budgetWarnings({ "/a": 511, "/b": 600 }, budgets)).toEqual([]);
    });

    it("prints a table for every route and passes quietly while each route is near its baseline", () => {
      const log = vi.fn();
      const error = vi.fn();
      expect(reportBudgets({ "/a": 501.25, "/b": 599 }, budgets, { log, error, annotate: true })).toBe(0);
      const output = log.mock.calls.map(([line]) => String(line)).join("\n");
      expect(output).toContain(budgetTable({ "/a": 501.25, "/b": 599 }, budgets));
      expect(output).toMatch(/\/a\s+501\.3\s+500\.0\s+510\.0\s+8\.8/);
      expect(output).toMatch(/\/b\s+599\.0\s+600\.0\s+610\.0\s+11\.0/);
      expect(output).not.toMatch(/warning/i);
      expect(error).not.toHaveBeenCalled();
    });

    it("warns with a GitHub annotation and a plain line, without failing", () => {
      const log = vi.fn();
      const error = vi.fn();
      expect(reportBudgets({ "/a": 504, "/b": 600 }, budgets, { log, error, annotate: true })).toBe(0);
      const lines = log.mock.calls.map(([line]) => String(line));
      expect(lines.filter((line) => line.startsWith("::warning "))).toHaveLength(1);
      expect(lines.filter((line) => line.startsWith("Warning: /a has grown 4.0 KB"))).toHaveLength(1);
      expect(error).not.toHaveBeenCalled();
      const plain = vi.fn();
      reportBudgets({ "/a": 504, "/b": 600 }, budgets, { log: plain, error });
      expect(plain.mock.calls.some(([line]) => String(line).startsWith("::"))).toBe(false);
    });

    it("fails over a ceiling and says not to raise it", () => {
      const log = vi.fn();
      const error = vi.fn();
      expect(reportBudgets({ "/a": 500, "/b": 612 }, budgets, { log, error, annotate: true })).toBe(1);
      const lines = error.mock.calls.map(([line]) => String(line));
      expect(lines[0]).toMatch(/^::error /);
      expect(lines[1]).toMatch(/^Over ceiling: \/b is 612\.0 KB, over its 610 KB ceiling\. Do not raise the ceiling/);
    });

    it("keeps every configured ceiling at or above its baseline", () => {
      const normalised = validateBudgets(scriptBudget.budgets);
      for (const { baseline, ceiling } of Object.values(normalised)) expect(ceiling).toBeGreaterThanOrEqual(baseline);
    });
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
