import { describe, expect, it } from "vitest";

import { eligibilityWarning } from "../src/components/ward-management/ward-derivations";
import { eligibility } from "../src/components/ward-management/ward-eligibility";
import { movementById } from "../src/components/ward-management/ward-movements";
import { NOW_ANCHOR, unitById } from "../src/components/ward-management/ward-sites";

import { madeUpForensicWard } from "./helpers/ward-made-up-forensic-ward";

/**
 * The receiving-ward half of `docs/ward-flow/the-engine-enforces-nothing.md`: `eligibility()`
 * already knows a ward cannot lawfully or safely hold a movement, and nothing told the ward. These
 * pin `eligibilityWarning()` against the exact pair the finding demonstrated — WF-009 (Adult,
 * Secure, Male, specialling, involuntary/detained) referred to `brm-adult-secure`, the network's
 * forensic bed — never a hand-authored fixture, so the test fails loudly if the seed changes
 * underneath it rather than silently proving nothing.
 *
 * ⚠️ **THE PAIRS BELOW MOVED ON 2026-09-21, AND THE REASON IS A DELIBERATE ENGINE CHANGE.**
 * `specialling` used to be a failing gate and is now `pass: true` always: `eligibility()` takes no
 * admissions list, so it could say whether a ward had ANY one-to-one capacity and never whether it
 * had any LEFT, and it was inviting placements `PULL_PATIENT` then refused. Its own comment in
 * `ward-eligibility.ts` explains it, and names this file as having "pinned the ZERO case" — where
 * the claim was harmless because the gate failed anyway. So these tests were pinning a gate that
 * no longer fails, and two of them isolated it with a hand-authored unit.
 *
 * ⚠️ **They are re-pointed at real seed pairs rather than repaired with a fixture**, which is what
 * the paragraph above asks for. WF-009 against `brm-adult-secure` now fails exactly one gate
 * (`forensic`) and carries the single-gate case; WF-009 against `rph-older-adult` fails two
 * (`cohort`, `security`) and carries the multi-gate case. Both were read off the seed, not chosen
 * by eye.
 */
const WF_009 = movementById("WF-009")!;
// Broome is not forensic (owner ruling 2026-09-25); its made-up forensic twin carries the case.
const BRM_ADULT_SECURE = madeUpForensicWard();
const WF_017 = movementById("WF-017")!;
const BTY_ADULT_SECURE = unitById("bty-adult-secure")!;
const RPH_OLDER_ADULT = unitById("rph-older-adult")!;

describe("eligibility warning", () => {
  it("fixture sanity: both seeded pairs still fail the gates the cases below depend on", () => {
    // Guards the whole suite below against a silently-changed fixture — if this ever fails, every
    // other assertion here is testing a pair that no longer demonstrates anything. Pinned in BOTH
    // directions: the single-gate pair must fail exactly one, or the "one gate" case is really
    // testing several.
    const single = eligibility(WF_009, BRM_ADULT_SECURE, NOW_ANCHOR)
      .gates.filter((gate) => !gate.pass)
      .map((gate) => gate.gate);
    expect(single).toEqual(["forensic"]);

    const multiple = eligibility(WF_009, RPH_OLDER_ADULT, NOW_ANCHOR)
      .gates.filter((gate) => !gate.pass)
      .map((gate) => gate.gate);
    expect(multiple).toContain("cohort");
    expect(multiple).toContain("security");
    expect(multiple.length).toBeGreaterThanOrEqual(2);
  });

  it("fixture sanity: WF-017 against bty-adult-secure passes every real eligibility gate", () => {
    const verdict = eligibility(WF_017, BTY_ADULT_SECURE, NOW_ANCHOR);
    expect(verdict.eligible).toBe(true);
  });

  it("says nothing when the ward passes every eligibility gate", () => {
    expect(eligibilityWarning(WF_017, BTY_ADULT_SECURE, NOW_ANCHOR)).toBeUndefined();
  });

  it("names the failing gate's own reason when one gate fails", () => {
    // A real seed pair, not a hand-built unit. WF-009 needs a secure adult bed and `brm-adult-secure`
    // is the network's forensic ward, which is never offered — so exactly one gate fails, and the
    // sanity case above pins that it is exactly one.
    const warning = eligibilityWarning(WF_009, BRM_ADULT_SECURE, NOW_ANCHOR);
    expect(warning?.level).toBe("ineligible");
    // The wording `eligibility()` itself produces, never a paraphrase authored here.
    expect(warning?.text).toMatch(/forensic ward and is never offered as a destination/i);
    expect(warning?.failedGates).toHaveLength(1);
  });

  it("names every failing gate, not just the first, when more than one gate fails", () => {
    const warning = eligibilityWarning(WF_009, RPH_OLDER_ADULT, NOW_ANCHOR);
    expect(warning?.level).toBe("ineligible");
    expect(warning?.failedGates.length).toBeGreaterThanOrEqual(2);
    // Both real gate details must appear verbatim — the exact wording `eligibility()` already
    // produces, never a paraphrase authored here. The security gate's sentence names the bed count,
    // which moves with the seed, so it is matched on the part that does not.
    expect(warning?.text).toMatch(/Older adult unit does not match an adult movement/i);
    expect(warning?.text).toMatch(/locked bed/i);
  });

  it("never fires for a case restrictionNotice already covers — the two are disjoint facts", () => {
    // restrictionNotice's two cases (a secure ward for an open-security movement, and a voluntary
    // patient on a locked ward) never overlap a failing eligibility() gate: eligibility()'s own
    // `security` gate only fails the opposite direction (a movement needing Secure placed on an
    // Open ward), and eligibility() has no legal-status gate that fires for a Voluntary movement at
    // all — its `authorisation` gate only fires for a NON-voluntary movement. Pinned here so a
    // future edit to either function that reintroduces overlap is caught by this suite, not
    // discovered by a ward seeing the same fact twice.
    const voluntaryOpen = movementById("WF-301")!;
    const secureUnit = unitById("rph-adult-secure")!;
    expect(voluntaryOpen.legalStatus).toBe("Voluntary");
    const verdict = eligibility(voluntaryOpen, secureUnit, NOW_ANCHOR);
    const authorisationGate = verdict.gates.find((gate) => gate.gate === "authorisation");
    expect(authorisationGate?.pass).toBe(true);
  });
});
