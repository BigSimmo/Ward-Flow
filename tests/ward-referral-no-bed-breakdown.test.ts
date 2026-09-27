import { describe, expect, it } from "vitest";

import { wardAddressing } from "@/components/ward-management/ward-eligibility";
import {
  aFreeBedCouldChangeThis,
  candidateAccepts,
  matchReason,
  noBedBreakdown,
  referralCandidates,
  type ReferralCandidate,
} from "@/components/ward-management/ward-referrals";
import { referrals } from "@/components/ward-management/ward-movements";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * ═══ "NOTHING FREE" AND "NOTHING ELIGIBLE" ARE NOT THE SAME SENTENCE ═══
 *
 * 🔴 **THE BANNER SAID "No unit accepts this referral right now" FOR BOTH, AND "right now" WAS THE
 * FALSEHOOD.** It asserts this may be different later — true when every ward is full, **false when
 * no ward in the network is a clinical or legal match.** A coordinator reading it in the second
 * case waits for a bed that will change nothing.
 *
 * ⚠️ **THIS IS NOT HYPOTHETICAL AND THE FIXTURE IS WHERE IT WAS FOUND.** `RF-001` is the one
 * referral in the shipped data with zero accepting units, and **not one of its 23 candidates fails
 * on a bed being unavailable.** The live screen told a coordinator to wait for capacity on the one
 * referral where capacity was never the problem.
 *
 * ⚠️ **AND A FIRST PROBE REPORTED THE BANNER UNREACHABLE.** It passed `referral.destination` where
 * the screen passes `wardAddressing(referral).destination`, and returned an empty list — plausibly,
 * with no error. The fixture pin below is derived the way the SCREEN derives it, for that reason.
 */

const units = allUnits();

function candidatesFor(referralId: string): ReferralCandidate[] {
  const referral = referrals.find((candidate) => candidate.id === referralId);
  if (!referral) throw new Error(`no referral ${referralId} in the fixture`);
  const ward = wardAddressing(referral);
  if (!ward) throw new Error(`${referralId} is not answered by matching a bed`);
  return referralCandidates(referral, ward.destination, units, NOW_ANCHOR);
}

describe("why nobody can take this patient", () => {
  it("fixture assumption: RF-001 is the live zero-accepting referral, and none of it is about beds", () => {
    const candidates = candidatesFor("RF-001");
    expect(candidates.length, "RF-001 has no shortlist, so every assertion below is vacuous").toBeGreaterThan(10);
    expect(candidates.filter(candidateAccepts)).toHaveLength(0);

    const breakdown = noBedBreakdown(candidates);
    expect(breakdown).toBeDefined();
    // 🔴 The measured fact this whole change rests on. If a fixture edit ever gives one of these
    // units a bed-availability failure instead, the wording below stops being the right wording.
    expect(breakdown?.noBedFree, "RF-001 now has a candidate failing for want of a bed").toBe(0);
    expect(breakdown?.capacityUnknown).toBe(0);
    expect(breakdown?.notSuitable).toBe(candidates.length);
    expect(aFreeBedCouldChangeThis(breakdown!)).toBe(false);
  });

  it("the three counts always account for every candidate, with none counted twice", () => {
    /*
     * A candidate can fail several gates. Only the FIRST is counted — the same one `matchReason`
     * reports — so the totals here and the reasons listed under the banner cannot disagree. If a
     * fourth class were added and not summed, this is what says so.
     */
    const breakdown = noBedBreakdown(candidatesFor("RF-001"));
    expect(breakdown).toBeDefined();
    expect(breakdown!.noBedFree + breakdown!.capacityUnknown + breakdown!.notSuitable).toBe(breakdown!.total);
  });

  it('agrees with the reason each row prints — and NOT by looking for the word "bed"', () => {
    /*
     * ⚠️ **NOT A COUNT AGAINST A COUNT.** Two counts agreeing is the most convincing wrong signal
     * available, so this compares the classification against what each ROW actually says.
     *
     * 🔴 **AND THE FIRST DRAFT OF THIS TEST WAS WRONG IN THE EXACT WAY THE FEATURE IS ABOUT.** It
     * matched `/bed/i` against the row text and went red on *"East Metropolitan Youth Unit (EMyU)
     * has no locked beds (All open)"* — which is the ward's DESIGNATION, a fact about how it is
     * built, not about whether it is full. **The proxy was the word "bed"; the property is
     * availability.** Measuring the proxy instead of the property is the same mistake as the banner
     * that treated "nothing free" and "nothing eligible" as one thing.
     *
     * The availability gates state a count — `"N allocatable"` and `"Last confirmed N min ago —
     * stale"`. Nothing else in the vocabulary does, which is what makes this checkable at all.
     */
    const candidates = candidatesFor("RF-001");
    const breakdown = noBedBreakdown(candidates)!;
    const rowsAboutAvailability = candidates.filter((candidate) =>
      /allocatable|last confirmed/i.test(matchReason(candidate)),
    ).length;
    expect(rowsAboutAvailability, "a row is about availability while the breakdown says none is").toBe(
      breakdown.noBedFree + breakdown.capacityUnknown,
    );

    // The floor: this compared something. Without it, a shortlist of nought rows would pass.
    expect(candidates.length).toBeGreaterThan(10);
    // And the designation row is still counted, as unsuitable rather than as a shortage.
    expect(
      candidates.some((candidate) => /no locked beds/i.test(matchReason(candidate))),
      "the locked-beds row has gone, so the distinction this test guards is no longer exercised",
    ).toBe(true);
  });

  it("says nothing at all when somebody can take the patient", () => {
    /*
     * The control. Every assertion above would pass against a `noBedBreakdown` that classified
     * happily for referrals that DO have an accepting unit — and the banner would then appear over
     * a screen listing units that accept, which is the loudest possible contradiction.
     */
    const withAcceptingUnits = referrals.filter((referral) => {
      const ward = wardAddressing(referral);
      if (!ward) return false;
      const candidates = referralCandidates(referral, ward.destination, units, NOW_ANCHOR);
      return candidates.length > 0 && candidates.some(candidateAccepts);
    });
    expect(withAcceptingUnits.length, "no referral in the fixture has an accepting unit").toBeGreaterThan(3);
    for (const referral of withAcceptingUnits) {
      const ward = wardAddressing(referral)!;
      expect(
        noBedBreakdown(referralCandidates(referral, ward.destination, units, NOW_ANCHOR)),
        `${referral.id} has an accepting unit and still got a no-bed breakdown`,
      ).toBeUndefined();
    }
  });

  it("says nothing for an empty shortlist, which is a different situation", () => {
    // A referral answered by an ED, a medical ward or a community team has no bed shortlist at all.
    // "Nobody can take this patient" would be a category error there, and the screen says so
    // separately.
    expect(noBedBreakdown([])).toBeUndefined();
  });

  describe("whether a free bed could change the answer", () => {
    const make = (gate: string): ReferralCandidate =>
      ({ unit: units[0], verdict: { eligible: false, gates: [{ gate, pass: false, detail: "" }] } }) as never;

    it("says no when every failure is clinical, legal or cohort", () => {
      expect(aFreeBedCouldChangeThis(noBedBreakdown([make("age"), make("security")])!)).toBe(false);
    });

    it("says yes when a ward simply has no bed free", () => {
      expect(aFreeBedCouldChangeThis(noBedBreakdown([make("age"), make("allocatable_bed")])!)).toBe(true);
    });

    it("⚠️ says yes when a ward has never CONFIRMED a count — unknown is not full", () => {
      /*
       * `capacity_freshness` means nobody has recorded a number, which is not the same as recording
       * zero. Counting it as a shortage would state fullness no ward has claimed — the same shape
       * of falsehood as "right now" pointing the other way, and the reason it is a third count
       * rather than folded into the first.
       */
      const breakdown = noBedBreakdown([make("age"), make("capacity_freshness")])!;
      expect(breakdown.noBedFree, "an unconfirmed count was counted as a bed shortage").toBe(0);
      expect(breakdown.capacityUnknown).toBe(1);
      expect(aFreeBedCouldChangeThis(breakdown)).toBe(true);
    });
  });
});
