import { describe, expect, it } from "vitest";

import { personLine } from "@/components/ward-management/movements/movement-drawer";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { referrals as seedReferrals, wardMovements } from "@/components/ward-management/ward-movements";
import { wardPatients } from "@/components/ward-management/ward-patients-seed";

/**
 * 🔴 **THE NAMED BRANCH WAS UNREACHABLE FROM THE SEED WHEN THIS FILE WAS WRITTEN** (it is reachable
 * since 26 September; the first test below now holds the ruling on the real seed).
 *
 * Owner ruling **O-16.3, 2026-09-11** — *"Yes show the patient name."* — unblocked the Movement
 * drawer's Person section. **Measured on the seed the same day:**
 *
 *     referrals                      24
 *       carrying a patientId          2
 *     movements with a referralId     2   WF-002, WF-009
 *       whose referral resolves       2
 *       reaching a PERSON             0   — the two linked referrals are not the two pointed at
 *
 * ⚠️ **So a DOM test over the seed renders the "nobody to name" branch and would pass however the
 * NAMED branch is written** — including if it rendered nothing, or an id, or the string
 * "undefined". **The one behaviour the owner actually ruled on is the one the fixture cannot
 * reach.** The named branch is therefore tested here, against hand-built records, and the
 * seed-reachable claim above is re-derived by the first test rather than trusted from this comment.
 *
 * 🔴 **AND THE THREE ABSENCES ARE THREE DIFFERENT FACTS.** A movement with no referral, a referral
 * that names nobody, and a referral naming somebody this system does not hold are not the same
 * situation, and a coordinator can act on the difference. **A single "unknown" for all three would
 * pass a naive presence assertion and destroy the distinction**, which is what these tests hold.
 */

const BASE_MOVEMENT: Movement = {
  id: "WF-PERSON-TEST",
  originEdId: "rph-ed",
  openedAt: 0,
  flaggedUrgent: false,
  urgency: 1,
  cohort: "Adult",
  security: "Open",
  sex: "Female",
  specialling: false,
  highAcuity: false,
  legalStatus: "Voluntary",
  statusChanges: [],
  urgencyChanges: [],
  overrides: [],
  stage: "placement_requested",
  owner: "Flow coordinator",
  referredUnitIds: [],
  declines: [],
  blocker: "No blocker",
  withdrawnReferrals: [],
  unwinds: [],
  stageChanges: [],
};

const BASE_REFERRAL = seedReferrals[0] as Referral;

describe("the Movement drawer's Person line (O-16.3)", () => {
  /**
   * The premise this file was written on (the seed reaches nobody) stopped being true on 25-26
   * September: Josh's ruling that sample data links to real patients (decisions R8, R18) linked the
   * seed's referrals to patients. So the seed now DOES reach the named branch, and this test holds
   * the ruled behaviour on the real seed: every seeded movement whose referral names a person
   * renders that person's name, never an id or an absence sentence.
   */
  it("names the person for every seeded movement whose referral reaches one (O-16.3 on the real seed)", () => {
    const byId = new Map(seedReferrals.map((referral) => [referral.id, referral]));
    const reaching = wardMovements.filter((movement) => {
      const referral = movement.referralId === undefined ? undefined : byId.get(movement.referralId);
      return referral?.patientId !== undefined;
    });

    expect(reaching.length, "no seeded movement reaches a person — re-read this test's premise").toBeGreaterThan(0);
    for (const movement of reaching) {
      const referral = byId.get(movement.referralId!)!;
      const patient = wardPatients.find((candidate) => candidate.id === referral.patientId);
      expect(
        patient,
        `${movement.id}: referral ${referral.id} names ${referral.patientId}, not in the seed`,
      ).toBeDefined();
      const line = personLine(movement, seedReferrals as Referral[], wardPatients);
      expect(line, `${movement.id}: the person's name is not rendered`).toContain(patient!.familyName);
      expect(line, `${movement.id}: the line shows the referral id where a name belongs`).not.toContain(referral.id);
    }
  });

  it("names the person when the movement's own referral resolves to one", () => {
    const patient = { id: "PT-TEST", umrn: "UM999001", givenName: "Ada", familyName: "Lovelace" } as unknown as Patient;
    const referral: Referral = { ...BASE_REFERRAL, id: "RF-TEST", patientId: "PT-TEST" };
    const movement: Movement = { ...BASE_MOVEMENT, referralId: "RF-TEST" };

    const line = personLine(movement, [referral], [patient]);

    expect(line, "the person's name is not rendered — O-16.3 ruled that it is").toContain("Lovelace");
    expect(line, "the line leaks the internal referral id where a name belongs").not.toContain("RF-TEST");
  });

  /**
   * 🔴 The three absences, each a different fact and each stated as one. The assertions are
   * deliberately about what SEPARATES them: any single catch-all sentence would satisfy a
   * "does it say something" check and lose the distinction a coordinator acts on.
   */
  it("distinguishes no referral, a referral naming nobody, and a name this system does not hold", () => {
    const noReferral = personLine({ ...BASE_MOVEMENT }, [], []);
    const referralNamesNobody = personLine(
      { ...BASE_MOVEMENT, referralId: "RF-TEST" },
      [{ ...BASE_REFERRAL, id: "RF-TEST", patientId: undefined }],
      [],
    );
    const nameNotHeld = personLine(
      { ...BASE_MOVEMENT, referralId: "RF-TEST" },
      [{ ...BASE_REFERRAL, id: "RF-TEST", patientId: "PT-MISSING" }],
      [],
    );

    for (const [what, line] of [
      ["no referral", noReferral],
      ["referral names nobody", referralNamesNobody],
      ["name not held", nameNotHeld],
    ] as const) {
      expect(line, `the ${what} branch renders nothing at all`).not.toBe("");
      expect(line, `the ${what} branch renders the word "unknown", which states no fact`).not.toMatch(/unknown/iu);
    }

    expect(
      new Set([noReferral, referralNamesNobody, nameNotHeld]).size,
      "two or more of the three absences render the same sentence — they are different facts and a " +
        "coordinator can act on the difference",
    ).toBe(3);
  });
});
