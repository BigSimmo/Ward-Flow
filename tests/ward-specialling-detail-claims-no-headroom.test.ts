import { describe, expect, it } from "vitest";

import { eligibility } from "../src/components/ward-management/ward-eligibility";
import { movementById } from "../src/components/ward-management/ward-movements";
import { NOW_ANCHOR, unitById } from "../src/components/ward-management/ward-sites";

/**
 * **The specialling gate must never claim headroom, because it cannot see any.**
 *
 * `eligibility(movement, unit, now)` takes no admissions list. `unit.speciallingCapacity` is the
 * ward's AUTHORED total and is never decremented; what is LEFT is derived from the beds by
 * `remainingSpeciallingCapacity`, which only `PULL_PATIENT` consults. So a ward authored for two
 * with both slots in use passes this gate — correctly, the gate is about whether the ward does
 * one-to-one at all — while the sentence beside it used to read "2 specialling slots available".
 * The screen invited the placement the engine then refused.
 *
 * ⚠️ **THE EXISTING GUARD PINNED THE ZERO CASE, WHERE THE OLD WORDING WAS HARMLESS.** With capacity
 * 0 the gate fails anyway, so "0 slots available" misleads nobody. Nothing pinned an authored ward
 * with every slot in use — the defect sat exactly where the guard did not look, which is why this
 * file exists rather than another assertion in that one.
 *
 * **It pins the ABSENCE of an availability claim, not one approved phrase.** A pinned string is
 * satisfied by any other string; a reword that re-introduces the promise has to defeat the word
 * itself. `PROMISES_HEADROOM` is proved able to detect the retired wording below before it is
 * trusted to certify the new one — a detector nobody has seen fire cannot certify an absence.
 *
 * ✅ **AND IT FIRED ON ITS OWN AUTHOR FIRST.** The replacement sentence originally read "how many
 * are free is checked at placement" — a phrase that DENIES headroom and still contains the word.
 * The guard cannot tell those apart and should not try: a coordinator skimming a row sees the word,
 * not the clause around it. **The sentence was reworded; the regex was not widened.** Recorded
 * because widening the detector to admit its author's own phrasing is exactly how a guard stops
 * meaning anything.
 */
const WF_009 = movementById("WF-009")!;

/** The wording this file exists to keep out: anything telling a reader slots can be had. */
const PROMISES_HEADROOM = /\b(available|free|left|remaining|spare|vacan\w*)\b/i;

/** The exact sentence that shipped, kept verbatim as the control's subject. */
const RETIRED_WORDING = "2 specialling slots available";

function speciallingDetail(speciallingCapacity: number): string {
  const unit = {
    ...unitById("fsh-adult-secure")!,
    id: "test-only-specialling-ward",
    speciallingCapacity,
  };
  const gate = eligibility(WF_009, unit, NOW_ANCHOR).gates.find((candidate) => candidate.gate === "specialling");
  expect(gate, "the specialling gate must exist for this assertion to mean anything").toBeDefined();
  return gate!.detail;
}

describe("the specialling gate's detail line", () => {
  it("CONTROL: the detector fires on the retired wording, so its silence below is evidence", () => {
    // Without this, a broken or over-narrow regex would pass every assertion in this file by
    // matching nothing at all — an absence proved by a detector that cannot detect.
    expect(RETIRED_WORDING).toMatch(PROMISES_HEADROOM);
  });

  it("fixture sanity: WF-009 needs specialling, or nothing below exercises this branch", () => {
    expect(WF_009.specialling).toBe(true);
  });

  it("promises no headroom for a ward authored for two — the case that shipped wrong", () => {
    const detail = speciallingDetail(2);

    // The gate itself still passes: it is about whether the ward does one-to-one at all, and the
    // real refusal lives in PULL_PATIENT. That is the whole reason the sentence must not overclaim.
    const gates = eligibility(
      { ...WF_009 },
      { ...unitById("fsh-adult-secure")!, id: "test-only-specialling-ward", speciallingCapacity: 2 },
      NOW_ANCHOR,
    ).gates;
    expect(gates.find((gate) => gate.gate === "specialling")!.pass).toBe(true);

    expect(detail).not.toMatch(PROMISES_HEADROOM);
    expect(detail).not.toContain(RETIRED_WORDING);
    // It must still carry the figure it CAN see, or it has become uninformative rather than honest.
    expect(detail).toContain("2");
  });

  it("promises no headroom for a ward that does no one-to-one at all", () => {
    const detail = speciallingDetail(0);
    expect(detail).not.toMatch(PROMISES_HEADROOM);
    // "0 slots available" was harmless but still false in kind; the failing case says what is true.
    expect(detail).not.toMatch(/\b0\b/);
  });

  it("says nothing about capacity when the movement needs no specialling", () => {
    const notSpecialling = { ...WF_009, specialling: false };
    const unit = { ...unitById("fsh-adult-secure")!, id: "test-only-specialling-ward", speciallingCapacity: 2 };
    const gate = eligibility(notSpecialling, unit, NOW_ANCHOR).gates.find((c) => c.gate === "specialling")!;
    expect(gate.pass).toBe(true);
    expect(gate.detail).not.toMatch(PROMISES_HEADROOM);
    expect(gate.detail).not.toContain("2");
  });
});
