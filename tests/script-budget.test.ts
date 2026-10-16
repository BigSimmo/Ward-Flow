import { describe, expect, it } from "vitest";

import { overBudget, scriptSources } from "../scripts/check-script-budget.mjs";

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
});
