import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { overBudget, routeKb, scriptSources, validateBudgets } from "../scripts/check-script-budget.mjs";
import { encodeRecordAddress } from "../src/components/ward-management/shell/ward-record-address";

const BASE = "http://127.0.0.1:3210";
const ROUTE = "/ward-flow";
const SCRIPT = "/_next/static/chunks/a.js";
const HTML = `<script src="${SCRIPT}"></script>`;

function responseAt(url: string, body: string | null, status = 200) {
  const response = new Response(body, { status });
  Object.defineProperty(response, "url", { value: url });
  return response;
}

describe("phone script budget", () => {
  it("collects each Next static script once", () => {
    const html =
      '<script src="/_next/static/chunks/a.js" async=""></script><script src="/_next/static/chunks/a.js"></script>' +
      '<script src="/_next/static/chunks/b.js"></script><script src="https://example.test/x.js"></script>';
    expect(scriptSources(html)).toEqual(["/_next/static/chunks/a.js", "/_next/static/chunks/b.js"]);
  });

  it("reports only the routes over their budget", () => {
    expect(overBudget({ "/a": 500, "/b": 611 }, { "/a": 585, "/b": 610 })).toEqual([
      { route: "/b", kb: 611, limit: 610 },
    ]);
  });

  it.each([
    undefined,
    null,
    [],
    {},
    { "/a": 0 },
    { "/a": -1 },
    { "/a": NaN },
    { "/a": Infinity },
    { "/a": "5" },
    { "": 5 },
    { "//example.test/a": 5 },
    { "/\\example.test/a": 5 },
  ])("refuses invalid budget configuration %j before measurement", (budgets) => {
    expect(() => validateBudgets(budgets)).toThrow(/budget/i);
  });

  it.each([{}, { "/a": undefined }, { "/a": NaN }, { "/a": Infinity }, { "/a": -1 }, { "/a": "5" }])(
    "refuses an absent or invalid measurement %j instead of reporting a pass",
    (measured) => {
      expect(() => overBudget(measured, { "/a": 5 })).toThrow(/measurement/);
    },
  );

  it("accepts a measurement exactly at its budget", () => {
    expect(overBudget({ "/a": 5 }, { "/a": 5 })).toEqual([]);
  });

  it("budgets the canonical movement page directly, preserving its existing limit", () => {
    const { budgets } = JSON.parse(readFileSync(new URL("../script-budget.json", import.meta.url), "utf8"));
    expect(() => validateBudgets(budgets)).not.toThrow();
    expect(budgets[`/ward-flow/movements/${encodeRecordAddress("WF-001")}`]).toBe(624);
    expect(budgets).not.toHaveProperty("/ward-flow/movements/WF-001");
  });

  it("measures a declared script and requests both resources without following redirects", async () => {
    const request = vi.fn<typeof fetch>(async (url) =>
      responseAt(String(url), String(url).endsWith(SCRIPT) ? "console.log('synthetic');" : HTML),
    );
    // This tiny synthetic script gzips to less than half a KB and rounds down; it is still
    // a real measurement, unlike a page that names no script at all.
    expect(await routeKb(BASE, ROUTE, request)).toBe(0);
    expect(request.mock.calls.map(([url, init]) => [url, init?.redirect])).toEqual([
      [BASE + ROUTE, "manual"],
      [BASE + SCRIPT, "manual"],
    ]);
  });

  it("refuses a successful page with no script inventory", async () => {
    const request = vi.fn<typeof fetch>(async (url) => responseAt(String(url), "<main>Unavailable</main>"));
    await expect(routeKb(BASE, ROUTE, request)).rejects.toThrow(/names no Next static scripts/);
    expect(request).toHaveBeenCalledOnce();
  });

  it("refuses a route redirect rather than measuring the destination page", async () => {
    const request = vi.fn<typeof fetch>(async (url) => responseAt(String(url), null, 307));
    await expect(routeKb(BASE, ROUTE, request)).rejects.toThrow(/answered 307/);
    expect(request).toHaveBeenCalledOnce();
  });

  it("refuses a response belonging to a different route", async () => {
    const request = vi.fn<typeof fetch>(async () => responseAt(BASE + "/sign-in", HTML));
    await expect(routeKb(BASE, ROUTE, request)).rejects.toThrow(/expected/);
    expect(request).toHaveBeenCalledOnce();
  });

  it.each([307, 404])("refuses script status %i instead of counting a redirect or error body", async (status) => {
    const request = vi.fn<typeof fetch>(async (url) =>
      responseAt(String(url), String(url).endsWith(SCRIPT) ? null : HTML, String(url).endsWith(SCRIPT) ? status : 200),
    );
    await expect(routeKb(BASE, ROUTE, request)).rejects.toThrow(`answered ${status}`);
  });
});
