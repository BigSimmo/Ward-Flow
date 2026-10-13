import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A1-2 (audit 13 Oct 2026): on a phone the Ward answer's Decline and Accept in principle bar sat
 * at bottom: 0, under the dock, so taps reached Referrals and Tasks instead. It now seats on the
 * dock's flat edge, as Handover and Patient bars do.
 */
const css = readFileSync(
  path.join(process.cwd(), "src/components/ward-management/ward/ward-answer-view.module.css"),
  "utf8",
);

function phoneDecisionRule(): string {
  const start = css.indexOf("Decline and Accept in principle stay at the bottom of the screen.");
  expect(start).toBeGreaterThan(-1);
  const rule = css.slice(css.indexOf(".decisionArea {", start));
  return rule.slice(0, rule.indexOf("}"));
}

describe("Ward answer decision bar on phone", () => {
  it("rests on the dock's flat edge, not the foot of the screen", () => {
    const rule = phoneDecisionRule();
    expect(rule).toMatch(/bottom:\s*var\(--wf-dock-top,\s*0px\);/u);
    expect(rule).not.toMatch(/bottom:\s*0;/u);
  });

  it("sits under the dock's layer so the + hump draws over it", () => {
    expect(phoneDecisionRule()).toMatch(/z-index:\s*29;/u);
  });
});
