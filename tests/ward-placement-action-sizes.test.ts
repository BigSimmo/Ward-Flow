import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * Design audit (Josh, 1 Nov 2026): every Accept, Pull and Decline is a placement decision and keeps a
 * full 48px button on phones and touch screens (`data-placement-action`, kit
 * `src/components/wf/button.module.css`). These are the buttons the audit found without it.
 */
const read = (file: string) => readFileSync(`src/components/ward-management/${file}`, "utf8");

/** The opening tag of the element carrying `data-testid="<id>"` (the id may be a template). */
function tagWith(source: string, testId: string): string {
  const at = source.indexOf(testId);
  expect(at, `${testId} is in the source`).toBeGreaterThan(-1);
  const start = Math.max(
    source.lastIndexOf("<button", at),
    source.lastIndexOf("<Button", at),
    source.lastIndexOf("<Link", at),
  );
  return source.slice(start, source.indexOf(">\n", at));
}

describe("placement decisions keep 48px on phones", () => {
  it.each([
    ["ward/ward-answer-view.tsx", "ward-decline-toggle-${activeMovement.id}", "decline"],
    ["ward/ward-answer-view.tsx", "ward-accept-${activeMovement.id}", ""],
    ["referrals/referral-board.tsx", '"ward-referral-pull-bed"', ""],
    ["referrals/referral-board.tsx", '"ward-referral-hold-bed"', ""],
    ["referrals/referral-match-not-a-bed.tsx", '"ward-referral-match-decline-open"', "decline"],
    ["referrals/referral-match-not-a-bed.tsx", '"ward-referral-match-decline-community_team"', "decline"],
    ["referrals/referral-match-not-a-bed.tsx", '"ward-referral-match-accept-community_team"', ""],
  ])("%s %s carries data-placement-action", (file, testId, value) => {
    const tag = tagWith(read(file), testId);
    expect(tag).toMatch(value ? /data-placement-action="decline"/u : /data-placement-action(?!=)/u);
  });

  it("marks every Accept and Decline on the not-a-bed question, phone sheet and desktop alike", () => {
    const source = read("referrals/referral-match-not-a-bed.tsx");
    for (const id of [
      "ward-referral-match-decline-emergency_department",
      "ward-referral-match-accept-emergency_department",
      "ward-referral-match-confirm-accept-emergency_department",
    ]) {
      const tags = source.split(`data-testid="${id}"`).slice(1);
      expect(tags.length, id).toBe(2);
      for (const after of tags) expect(after.slice(0, after.indexOf(">"))).toContain("data-placement-action");
    }
  });

  it("Pull the bed on the patient's transit card uses the kit button, so it takes the 48px rule", () => {
    const source = read("patients/patient-transit-operations.tsx");
    const pull = source.slice(
      source.lastIndexOf("<button", source.indexOf("Pull the bed\n")),
      source.indexOf("Pull the bed\n"),
    );
    expect(pull).toContain('className={buttonClass({ variant: "pri" })}');
    expect(pull).toContain("data-placement-action");
  });

  it("the not-a-bed buttons keep 48px even in a narrow window with a mouse", () => {
    const css = read("referrals/referrals.module.css");
    const rule = css.slice(css.lastIndexOf("@media (max-width: 48rem), (pointer: coarse) {"));
    expect(rule).toMatch(/\.matchPanel \[data-placement-action\]/u);
    expect(rule).toMatch(/min-height:\s*max\(3rem,/u);
    // Last in the file, so the compact (pointer: fine) faces above cannot undercut it.
    expect(css.lastIndexOf("min-height: var(--wf-h-md)")).toBeLessThan(
      css.lastIndexOf(".matchPanel [data-placement-action]"),
    );
  });
});
