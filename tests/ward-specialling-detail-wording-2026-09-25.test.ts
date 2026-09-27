import { describe, expect, it } from "vitest";

import { eligibility } from "../src/components/ward-management/ward-eligibility";
import { movementById } from "../src/components/ward-management/ward-movements";
import { NOW_ANCHOR, unitById } from "../src/components/ward-management/ward-sites";

/**
 * Audit follow-up 2026-09-25: the specialling gate's "capacity reached" sentence said
 * "High-acuity nursing requested" — the acuity gate's own wording, copy-pasted into the
 * specialling gate's reached branch. A coordinator reading the specialling row was told the
 * wrong thing was requested. This pins that the sentence names specialling (one-to-one nursing),
 * not high-acuity nursing.
 */
const WF_009 = movementById("WF-009")!;

function speciallingDetail(speciallingCapacity: number): string {
  const unit = {
    ...unitById("fsh-adult-secure")!,
    id: "test-only-specialling-wording-ward",
    speciallingCapacity,
  };
  const gate = eligibility(WF_009, unit, NOW_ANCHOR).gates.find((candidate) => candidate.gate === "specialling");
  expect(gate, "the specialling gate must exist for this assertion to mean anything").toBeDefined();
  return gate!.detail;
}

describe("the specialling gate's reached-capacity wording (audit follow-up 2026-09-25)", () => {
  it("fixture sanity: WF-009 needs specialling, or nothing below exercises this branch", () => {
    expect(WF_009.specialling).toBe(true);
  });

  it("names specialling (one-to-one nursing), not high-acuity nursing, when capacity is reached", () => {
    const detail = speciallingDetail(0);
    expect(detail).not.toMatch(/high-acuity/i);
    expect(detail.toLowerCase()).toContain("specialling");
    expect(detail.toLowerCase()).toContain("one-to-one");
  });
});
