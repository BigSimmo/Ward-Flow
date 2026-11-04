import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { judgeAgainstMain, MAIN_TOLERANCE_KB } from "../scripts/check-script-budget.mjs";
import {
  AUTO_MERGE_MAX_KB,
  canAutoMerge,
  historyEntry,
  perthDate,
  planRaise,
} from "../scripts/ward-ci-public/budget-heal.mjs";
import { decideRun } from "../scripts/ward-ci-public/ci-tidy.mjs";

const budgets = { "/a": 500, "/b": 571.7 };

describe("budget gate: a PR is failed only for growth it caused", () => {
  it("passes a PR that only inherits main's overage (4 Nov: Ward 572.7 against 571.7)", () => {
    const { failing, inherited } = judgeAgainstMain({ "/a": 490, "/b": 572.7 }, { "/a": 490, "/b": 572.7 }, budgets);
    expect(failing).toEqual([]);
    expect(inherited).toEqual([{ route: "/b", kb: 572.7, limit: 571.7, main: 572.7 }]);
  });

  it("allows measurement noise up to the tolerance on top of an over main", () => {
    const kb = 572.7 + MAIN_TOLERANCE_KB;
    expect(judgeAgainstMain({ "/a": 490, "/b": kb }, { "/a": 490, "/b": 572.7 }, budgets).failing).toEqual([]);
  });

  it("fails a PR that grows an already-over route past the tolerance", () => {
    const { failing } = judgeAgainstMain({ "/a": 490, "/b": 574 }, { "/a": 490, "/b": 572.7 }, budgets);
    expect(failing.map(({ route }) => route)).toEqual(["/b"]);
  });

  it("fails a PR that pushes a within-budget main over, however small", () => {
    const { failing } = judgeAgainstMain({ "/a": 500.1, "/b": 570 }, { "/a": 499.9, "/b": 570 }, budgets);
    expect(failing.map(({ route }) => route)).toEqual(["/a"]);
  });

  it("fails every over route when main could not be measured", () => {
    const { failing } = judgeAgainstMain({ "/a": 490, "/b": 572.7 }, undefined, budgets);
    expect(failing.map(({ route }) => route)).toEqual(["/b"]);
  });
});

describe("budget heal: what the bot PR raises", () => {
  it("raises only over routes, to the measured size plus 1 KB, rounded up to 0.1 KB", () => {
    const { budgets: next, raises } = planRaise({ "/a": 480, "/b": 572.73 }, budgets);
    expect(next).toEqual({ "/a": 500, "/b": 573.8 });
    expect(raises).toEqual([{ route: "/b", from: 571.7, to: 573.8, kb: 572.7 }]);
  });

  it("does nothing when main is within budget or a measurement is missing", () => {
    expect(planRaise({ "/a": 500, "/b": 571.7 }, budgets).raises).toEqual([]);
    expect(planRaise({}, budgets).raises).toEqual([]);
  });

  it(`arms auto-merge only when every raise is within ${AUTO_MERGE_MAX_KB} KB`, () => {
    expect(canAutoMerge([{ route: "/b", from: 571.7, to: 576.7, kb: 575.7 }])).toBe(true);
    expect(canAutoMerge([{ route: "/b", from: 571.7, to: 576.8, kb: 575.8 }])).toBe(false);
    expect(canAutoMerge([])).toBe(false);
  });

  it("writes a one-paragraph history entry naming the PR and each raise", () => {
    const text = historyEntry({
      date: "2026-11-04",
      pr: 1410,
      raises: [{ route: "/b", from: 571.7, to: 573.8, kb: 572.7 }],
      sha: "cdbd78ff0000",
    });
    expect(text).toMatch(/^2026-11-04, PR #1410 \(budget heal bot\)\. Main cdbd78f /);
    expect(text).toContain("`/b` 571.7 to 573.8 KB (main measured 572.7 KB)");
    expect(perthDate(new Date("2026-11-04T17:00:00Z"))).toBe("2026-11-05");
  });
});

describe("CI tidy: which runs give their runner slot back", () => {
  const open = new Map([["feature", "new"]]);
  const pr = { event: "pull_request", name: "Ward Flow CI", head_branch: "feature", head_sha: "old" };

  it("cancels any pull-request run whose PR is merged or closed", () => {
    expect(decideRun({ ...pr, head_branch: "merged" }, open).cancel).toBe(true);
    expect(decideRun({ ...pr, event: "pull_request_target", head_branch: "merged" }, open).cancel).toBe(true);
  });

  it("cancels an older head's run only while none of its jobs is running", () => {
    expect(decideRun(pr, open, [{ status: "completed" }, { status: "queued" }]).cancel).toBe(true);
    expect(decideRun(pr, open, [{ status: "in_progress" }]).cancel).toBe(false);
  });

  it("never cancels the current head, main, manual or scheduled runs, or itself", () => {
    expect(decideRun({ ...pr, head_sha: "new" }, open).cancel).toBe(false);
    for (const event of ["push", "workflow_dispatch", "schedule", "workflow_run"])
      expect(decideRun({ ...pr, event, head_branch: "main" }, open).cancel).toBe(false);
    expect(decideRun({ ...pr, name: "Ward Flow CI tidy", head_branch: "merged" }, open).cancel).toBe(false);
  });
});

describe("heal and tidy workflows never run pull-request code", () => {
  for (const file of ["ward-flow-budget-heal.yml", "ward-flow-ci-tidy.yml"]) {
    const code = readFileSync(new URL(`../.github/workflows/${file}`, import.meta.url), "utf8")
      .split("\n")
      .filter((line) => !line.trim().startsWith("#"))
      .join("\n");
    it(`${file} checks out main only and uses no secrets or paid runners`, () => {
      expect([...code.matchAll(/^\s+ref:\s*(.+)$/gm)].map((match) => match[1].trim())).toEqual(["main"]);
      expect(code).not.toMatch(/pull_request\.head|github\.head_ref|refs\/pull\/|secrets\./);
      expect([...code.matchAll(/runs-on: (.+)$/gm)].map((match) => match[1])).toEqual(["ubuntu-24.04"]);
    });
  }
});
