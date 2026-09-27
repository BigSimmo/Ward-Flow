import { describe, expect, it } from "vitest";

import { COMMUNITY_DECLINE_REASONS, REFERRAL_DECLINE_REASONS } from "@/components/ward-management/ward-model";
import { COMMUNITY_DECLINE_REASON_LABELS, DECLINE_REASON_LABELS } from "@/components/ward-management/ward-referrals";

/**
 * 🔴 **O-16.6 — A COMMUNITY TEAM DECLINING A REFERRAL AND A WARD DECLINING A BED ARE DIFFERENT ACTS,
 * AND THE OWNER RULED THEM TWO LISTS.**
 *
 * **The measurement that produced the ruling:** the drawing's community reasons and
 * `REFERRAL_DECLINE_REASONS` have **ZERO overlap in meaning**. The existing seven are bed-placement
 * concepts — no suitable bed, wrong age band, no secure bed. The community ones are about a
 * catchment, a level of care, a person who could not be reached, a peer team already holding the
 * case. **Not one of the seven fits.**
 *
 * ⚠️ **THE NEAREST PAIR IS THE TRAP, AND IT IS WHY THIS SUITE EXISTS.** `belongs_to_another_service`
 * and *"already open to another community team"* look interchangeable and are different claims: one
 * says *this is not our service*, the other says *a peer team already holds this person*. 🔴 **Merging
 * them would put a wrong reason against a real refusal, and this codebase's own words on a
 * neighbouring list are that a wrong reason is worse than a blunt one.**
 *
 * ✅ **So the decisive test below is not "the list has four members". It is that the two lists share
 * no key and no label** — a guard that reddens the moment somebody helpfully consolidates them.
 *
 * 🔴 **FOUR MEMBERS, FIVE ROWS — O-18.1, and the missing fifth is deliberate.** The drawing's fifth
 * row is *"Withdrawn by the referrer before assessment"*, **which is not a decline at all**: a
 * decline is the receiving service saying no, a withdrawal is the sender saying never mind. O-17.11
 * ruled a withdrawal a FIELD on the addressing for exactly that reason. **Putting it in this list
 * would flatter or damn a team for something it did not do.** The table still renders five rows; the
 * fifth's number comes from the withdrawal field, not from this vocabulary.
 */

/** The drawing's own words, copied from `statistics-community-third-edition.html`, never retyped. */
const DRAWN_WORDS = [
  "Outside the team's catchment area",
  "Assessed as needing inpatient care, not community follow up",
  "Client declined the referral, or could not be contacted",
  "Already open to another community team",
] as const;

describe("the community decline vocabulary", () => {
  it("holds the four the drawing names as declines, in the drawing's own order", () => {
    expect(COMMUNITY_DECLINE_REASONS).toEqual([
      "outside_the_teams_catchment",
      "needs_inpatient_care_not_community_follow_up",
      "client_declined_or_could_not_be_contacted",
      "already_open_to_another_community_team",
    ]);
  });

  it("renders the drawing's words verbatim, because the drawing is the source and not a paraphrase", () => {
    expect(COMMUNITY_DECLINE_REASONS.map((reason) => COMMUNITY_DECLINE_REASON_LABELS[reason])).toEqual([
      ...DRAWN_WORDS,
    ]);
  });

  /**
   * 🔴 **THE ANTI-MERGE GUARD. This is the one the ruling asked for in words and this suite supplies
   * in a test.** Neither side is typed out here — both are read from the model — so consolidating the
   * two lists, or copying one member across, reddens.
   */
  it("shares no key with the bed-placement vocabulary", () => {
    const shared = COMMUNITY_DECLINE_REASONS.filter((reason) =>
      (REFERRAL_DECLINE_REASONS as readonly string[]).includes(reason),
    );
    expect(shared, "a key appears in both vocabularies — they have been merged or copied").toEqual([]);
  });

  it("shares no rendered label with the bed-placement vocabulary either", () => {
    const wardLabels = new Set(Object.values(DECLINE_REASON_LABELS));
    const shared = Object.values(COMMUNITY_DECLINE_REASON_LABELS).filter((label) => wardLabels.has(label));
    expect(shared, "a rendered label appears in both vocabularies").toEqual([]);
  });

  /**
   * ⚠️ **The anti-vacuity case for the two guards above.** Both would pass over an EMPTY community
   * list, which is the state this ruling exists to move away from.
   */
  it("is not empty, and neither is the list it must stay separate from", () => {
    expect(COMMUNITY_DECLINE_REASONS.length).toBeGreaterThan(0);
    expect(REFERRAL_DECLINE_REASONS.length).toBeGreaterThan(0);
  });

  /**
   * 🔴 **O-18.1 PINNED AS A PROPERTY, NOT AS A COUNT.** A future reader adding the withdrawal here
   * would be undoing a ruling, and a length assertion would not say which member was wrong.
   */
  it("does not carry the referrer's withdrawal, which is a different act and lives on its own field", () => {
    const everyWord = [...COMMUNITY_DECLINE_REASONS, ...Object.values(COMMUNITY_DECLINE_REASON_LABELS)].join(" | ");
    expect(everyWord, "a withdrawal has been added to the decline vocabulary — see O-17.11").not.toMatch(/withdraw/i);
  });

  /** The control for the guard above: prove that pattern can still fire. */
  it("would catch a withdrawal if one were added", () => {
    expect(["already_open_to_another_community_team", "withdrawn_by_the_referrer"].join(" | ")).toMatch(/withdraw/i);
  });

  it("gives every member a label, with no member left to render as its own key", () => {
    for (const reason of COMMUNITY_DECLINE_REASONS) {
      const label = COMMUNITY_DECLINE_REASON_LABELS[reason];
      expect(label, `no label for ${reason}`).toBeTruthy();
      expect(label, `the label for ${reason} is its key`).not.toBe(reason);
    }
  });
});
