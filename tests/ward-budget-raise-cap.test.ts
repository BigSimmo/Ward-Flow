import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { judgeRaiseCap, raisesOverCap, RAISE_CAP_KB } from "../scripts/ward-ci-public/budget-raise-cap.mjs";

// D-82 (a PR may raise a phone size limit by up to 5 KB per screen without asking), enforced by the
// guard D-121 item 5 adds. The script compares the PR's script-budget.json with the PR base; above
// the cap it needs the PR's own docs/script-budget-history/ file to record Josh's yes.

const root = path.resolve(import.meta.dirname, "..");
const base = { "/ward-flow": 560.0, "/ward-flow/ed": 520.0 };

describe("phone limit raise cap (D-82, D-121 item 5)", () => {
  it("allows a raise up to 5 KB per screen, and any lowering", () => {
    expect(RAISE_CAP_KB).toBe(5);
    expect(raisesOverCap(base, { "/ward-flow": 565.0, "/ward-flow/ed": 500.0 })).toEqual([]);
  });

  it("flags a screen raised by more than 5 KB, and ignores a new screen", () => {
    expect(raisesOverCap(base, { "/ward-flow": 565.1, "/ward-flow/new": 900 })).toEqual([
      { route: "/ward-flow", from: 560.0, to: 565.1, raise: 5.1 },
    ]);
  });

  it("passes a raise above the cap only when the PR's history file records Josh's approval", () => {
    const headBudgets = { "/ward-flow": 567.0 };
    expect(judgeRaiseCap({ baseBudgets: base, headBudgets, historyTexts: [] }).ok).toBe(false);
    expect(
      judgeRaiseCap({ baseBudgets: base, headBudgets, historyTexts: ["Raised the board 560.0 to 567.0. Trims tried."] })
        .ok,
    ).toBe(false);
    expect(
      judgeRaiseCap({
        baseBudgets: base,
        headBudgets,
        historyTexts: ["The 7 KB raise is above the 5 KB a PR may add; Josh approved it (decision card, 9 Nov 2026)."],
      }).ok,
    ).toBe(true);
  });

  it("runs in the main Ward Flow workflow against the PR base", () => {
    const workflow = readFileSync(path.join(root, ".github/workflows/ward-flow.yml"), "utf8");
    expect(workflow).toMatch(
      /- name: Check the 5 KB phone limit raise cap\n\s+env:\n\s+WARD_BASE_SHA: .+\n\s+run: node scripts\/ward-ci-public\/budget-raise-cap\.mjs/u,
    );
  });
});
