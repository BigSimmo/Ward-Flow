// Audit M85 (10 November 2026): the monthly script size record, and the rule that a raise or trim
// re-runs the screen's accessibility and journey tests. The switched-off budget recheck job and the
// 5 KB guard belong to another thread and are not tested here.
import { describe, expect, it } from "vitest";

import { classifyChanges } from "../scripts/ward-ci-public/plan.mjs";
import { HEADER, recordMonth } from "../scripts/ward-flow/script-size-trend.mjs";

const sha = "d".repeat(40);
const measurement = {
  measured: { "/ward-flow": 561.24, "/ward-flow/ed": 520.06 },
  budgets: { "/ward-flow": 570, "/ward-flow/ed": 529.6 },
};

describe("M85: monthly phone script size record", () => {
  it("writes one row per screen from CI's measurement", () => {
    expect(recordMonth("", measurement, { month: "2026-11", sha })).toBe(
      `${HEADER}\n2026-11,${sha},/ward-flow,561.2,570.0\n2026-11,${sha},/ward-flow/ed,520.1,529.6\n`,
    );
  });

  it("keeps earlier months and replaces a re-recorded month instead of doubling it", () => {
    const october = recordMonth("", measurement, { month: "2026-10", sha });
    const november = recordMonth(october, measurement, { month: "2026-11", sha });
    const again = recordMonth(november, { ...measurement, measured: { "/ward-flow": 559 } }, { month: "2026-11", sha });
    expect(again.split("\n").filter((line) => line.startsWith("2026-10"))).toHaveLength(2);
    expect(again.split("\n").filter((line) => line.startsWith("2026-11"))).toEqual([
      `2026-11,${sha},/ward-flow,559.0,570.0`,
    ]);
  });

  it("refuses a bad month, a short commit or an empty measurement", () => {
    expect(() => recordMonth("", measurement, { month: "2026-13", sha })).toThrow(/YYYY-MM/u);
    expect(() => recordMonth("", measurement, { month: "2026-11", sha: "abc1234" })).toThrow(/SHA/u);
    expect(() => recordMonth("", { measured: {}, budgets: {} }, { month: "2026-11", sha })).toThrow(/no routes/u);
  });
});

describe("M85: a raise or trim re-runs the browser checks", () => {
  // The release gate (journeys and the axe sweep) runs when the plan's browser flag is set.
  it("runs the browser suite for a PR that only raises a budget and records why", () => {
    const plan = classifyChanges([
      { status: "M", file: "script-budget.json" },
      { status: "A", file: "docs/script-budget-history/2026-11-10-pr9999-example.md" },
    ]);
    expect(plan.browser).toBe(true);
    expect(plan.build).toBe(true);
  });

  it("runs the browser suite for a trim, which changes screen source", () => {
    const plan = classifyChanges([
      { status: "M", file: "src/components/ward-management/shell/ward-workspace-host.tsx" },
      { status: "M", file: "script-budget.json" },
    ]);
    expect(plan.browser).toBe(true);
  });
});
