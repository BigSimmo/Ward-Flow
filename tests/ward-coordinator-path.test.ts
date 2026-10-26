import { describe, expect, it } from "vitest";

import {
  acceptedReferralsAwaitingPull,
  recordedPullDetails,
} from "@/components/ward-management/referrals/accepted-ward-referral";
import {
  REFERRAL_GENDER_NOT_RECORDED,
  referralGenderOf,
} from "@/components/ward-management/referrals/referral-submission";
import {
  recordedSexAndGender,
  wardReferralDestinations,
} from "@/components/ward-management/referrals/ward-referral-drawer-model";
import { isWaitingInEd } from "@/components/ward-management/ward-ed-presence";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";

/**
 * The coordinator path (workflow speed audit, 26 Oct 2026), helpers only. Synthetic data only.
 * WS-01: sex and gender carried from the ED board. WS-02: accepted referrals with no bed pulled.
 * WS-03: the legal details a one-step pull reuses.
 */
const units = [
  { id: "ward-a", name: "Ward A" },
  { id: "ward-b", name: "Ward B" },
];

function accepted(id: string, overrides: Partial<Referral> = {}, arm: Partial<Referral["destinations"][number]> = {}) {
  return {
    id,
    patientId: `PT-${id}`,
    source: "ed_medical",
    ageBand: "Adult",
    originSiteCode: "SCGH",
    raisedAt: 0,
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          unitId: "ward-a",
          sex: "Female",
          gender: "Female",
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
        state: "accepted",
        decidedAt: 100,
        ...arm,
      },
    ],
    ...overrides,
  } as unknown as Referral;
}

describe("WS-02: accepted referrals awaiting a pull", () => {
  it("lists an accepted ED or community referral with no bed held and no journey, oldest decision first", () => {
    const later = accepted("R2", {}, { decidedAt: 200 });
    const earlier = accepted("R1", { source: "community", sendingTeamName: "Team" }, { decidedAt: 50 });
    expect(acceptedReferralsAwaitingPull([later, earlier], units, []).map((entry) => entry.referral.id)).toEqual([
      "R1",
      "R2",
    ]);
    expect(acceptedReferralsAwaitingPull([later], units, [])[0]).toMatchObject({
      unitId: "ward-a",
      unitName: "Ward A",
    });
  });

  it("uses the ward that accepted when it differs from the ward asked", () => {
    const moved = accepted("R1", {}, { acceptedUnitId: "ward-b" });
    expect(acceptedReferralsAwaitingPull([moved], units, [])[0]?.unitName).toBe("Ward B");
  });

  it("leaves out held beds, live journeys, withdrawn and undecided arms, and other sources", () => {
    const held = accepted("R1", {}, { heldBedNumber: 3 });
    const withdrawn = accepted("R2", {}, { withdrawnAt: 150 });
    const queued = accepted("R3", {}, { state: "queued" });
    const transfer = accepted("R4", { source: "inter_hospital" });
    const journeyed = accepted("R5");
    const live = [{ referralId: "R5", closure: undefined }] as Pick<Movement, "referralId" | "closure">[];
    expect(acceptedReferralsAwaitingPull([held, withdrawn, queued, transfer, journeyed], units, live)).toEqual([]);
  });

  it("offers the pull again once the earlier journey closed as did not proceed", () => {
    const referral = accepted("R1");
    const closed = [{ referralId: "R1", closure: { outcome: "did_not_proceed" } }] as unknown as Pick<
      Movement,
      "referralId" | "closure"
    >[];
    expect(acceptedReferralsAwaitingPull([referral], units, closed)).toHaveLength(1);
  });
});

describe("WS-03: the details a one-step pull reuses", () => {
  const edWait = wardMovements.find((movement) => movement.patientId !== undefined && isWaitingInEd(movement))!;
  const siteCode = allEmergencyDepartments().find((ed) => ed.id === edWait.originEdId)!.siteCode;

  it("takes legal status, form and observation from the person's wait on the referring ED's board", () => {
    const referral = accepted("R1", { patientId: edWait.patientId, originSiteCode: siteCode });
    const details = recordedPullDetails(referral, wardMovements);
    expect(details.fromEdBoard).toBe(true);
    expect(details.legalStatus).toBe(edWait.legalStatus);
    expect(details.legalFormCode).toBe(edWait.legalForm?.code ?? null);
    expect(details.legalFormDueAt).toBe(edWait.legalForm?.dueAt);
    expect(details.observation).toEqual(edWait.observation);
  });

  it("falls back to the referral's own recorded legal status, and asks for the rest", () => {
    const referral = accepted("R1", {
      patientId: "PT-NOBODY",
      intake: { legalStatus: "Voluntary" } as Referral["intake"],
    });
    expect(recordedPullDetails(referral, wardMovements)).toEqual({ legalStatus: "Voluntary", fromEdBoard: false });
  });

  it("never reads another ED's board, and invents nothing when nothing is recorded", () => {
    const elsewhere = allEmergencyDepartments().find((ed) => ed.id !== edWait.originEdId)!.siteCode;
    const referral = accepted("R1", { patientId: edWait.patientId, originSiteCode: elsewhere });
    expect(recordedPullDetails(referral, wardMovements)).toEqual({ fromEdBoard: false });
  });
});

describe("WS-01: sex and gender carried into the referral", () => {
  const journey = { sex: "Female", gender: "Female" } as Pick<Movement, "sex" | "gender">;

  it("prefers the patient record, then the person's journey on the ED board", () => {
    expect(recordedSexAndGender({ id: "PT-1", sex: "Male", gender: "Male" }, journey, [])).toEqual({
      sex: "Male",
      gender: "Male",
    });
    expect(recordedSexAndGender({ id: "PT-1" }, journey, [])).toEqual({ sex: "Female", gender: "Female" });
  });

  it("finds the person's open journey when the drawer was opened from the patient", () => {
    const movements = [
      { patientId: "PT-1", sex: "Male", gender: "Male", closure: { outcome: "x" }, openedAt: 300 },
      { patientId: "PT-1", sex: "Female", gender: "Female", closure: undefined, openedAt: 100 },
    ] as unknown as Movement[];
    expect(recordedSexAndGender({ id: "PT-1" }, undefined, movements)).toEqual({ sex: "Female", gender: "Female" });
  });

  it("leaves gender unanswered and sex not recorded when nothing is recorded", () => {
    expect(recordedSexAndGender(undefined, undefined, [])).toEqual({ sex: "Not recorded", gender: "" });
    expect(
      recordedSexAndGender({ id: "PT-1", sex: "Not recorded" }, { sex: "Not recorded", gender: undefined }, []),
    ).toEqual({ sex: "Not recorded", gender: "" });
  });

  it('sends "Not yet recorded" and unanswered as no gender', () => {
    expect(referralGenderOf("")).toBeUndefined();
    expect(referralGenderOf(REFERRAL_GENDER_NOT_RECORDED)).toBeUndefined();
    expect(referralGenderOf("Non-binary")).toBe("Non-binary");
    const [destination] = wardReferralDestinations(["ward-a"], {
      sex: "Female",
      gender: REFERRAL_GENDER_NOT_RECORDED,
      security: "Open",
      legalStatus: "Voluntary",
      highAcuity: false,
    });
    expect(destination?.gender).toBeUndefined();
  });
});
