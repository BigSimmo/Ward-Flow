import { describe, expect, it } from "vitest";

import { openRequestsByPerson } from "@/components/ward-management/coordinator/missed-requests-check";
import { heldBedElsewhereInboxItems, inboxItemsForRole } from "@/components/ward-management/ward-act-now-items";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { heldBedsElsewhere } from "@/components/ward-management/ward-held-bed-elsewhere";
import { INBOX_CATEGORIES, inboxRowExists } from "@/components/ward-management/ward-inbox-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * M11 and owner question 8 (mechanics and clock audit, 14 Nov 2026): a bed held for an accepted
 * referral was not tied to the person. Admitted elsewhere on another journey, the bed stayed held
 * with nothing said. Now the coordinator's Home flags it and offers to release it (never a block),
 * and the duplicate request matcher counts the held referral. Offline, synthetic seed.
 */
const REFERRAL = "RF-002";

/** The seed with the referral's accepted ward holding a numbered bed, through the real reducer. */
function withHeldBed(): { state: WardFlowState; unitId: string; bedNumber: number } {
  const seed = seedWardFlowState();
  const arm = seed.referrals
    .find((referral) => referral.id === REFERRAL)!
    .destinations.find((candidate) => candidate.state === "accepted")!;
  const unitId = arm.acceptedUnitId ?? (arm.destination as { unitId: string }).unitId;
  const unit = seed.units.find((candidate) => candidate.id === unitId)!;
  for (let bedNumber = 1; bedNumber <= unit.beds; bedNumber += 1) {
    const state = wardFlowReducer(seed, {
      type: "HOLD_REFERRAL_BED",
      role: "coordinator",
      now: NOW_ANCHOR,
      referralId: REFERRAL,
      unitId,
      actingUnitId: unitId,
      bedNumber,
    });
    if (state.rejections.length === seed.rejections.length) return { state, unitId, bedNumber };
  }
  throw new Error("no bed could be held");
}

const personOf = (state: WardFlowState) => state.referrals.find((referral) => referral.id === REFERRAL)!.patientId!;

/** The person also in a bed at another ward, on another journey (a synthetic stay). */
function admittedElsewhere(state: WardFlowState, heldUnitId: string): WardFlowState {
  const template = state.admissions.find(
    (admission) => admission.state === "occupied" && admission.unitId !== heldUnitId,
  )!;
  return {
    ...state,
    admissions: [
      ...state.admissions,
      {
        ...template,
        id: "AD-MCA-SYNTHETIC",
        patientId: personOf(state),
        referralId: null,
        movementId: null,
        arrivedAt: NOW_ANCHOR,
      },
    ],
  };
}

describe("M11: a bed held for someone in a bed elsewhere", () => {
  it("is not flagged while the person has no bed elsewhere, but counts as an open request", () => {
    const { state } = withHeldBed();
    expect(heldBedsElsewhere(state)).toEqual([]);
    expect(openRequestsByPerson(state).get(personOf(state))).toEqual([
      expect.objectContaining({ kind: "referral", id: REFERRAL }),
    ]);
  });

  it("is flagged on the coordinator's Home with an offer to release, and on no other desk", () => {
    const { state: held, unitId, bedNumber } = withHeldBed();
    const state = admittedElsewhere(held, unitId);
    expect(heldBedsElsewhere(state)).toEqual([
      expect.objectContaining({ referralId: REFERRAL, unitId, bedNumber, admissionId: "AD-MCA-SYNTHETIC" }),
    ]);
    const rows = heldBedElsewhereInboxItems(state);
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.id).toBe(`${INBOX_CATEGORIES.bed_held_elsewhere.idPrefix}${REFERRAL}`);
    expect(row.href).toContain("/ward-flow/referrals?");
    expect(row.detail).toContain(`Bed ${bedNumber}`);
    expect(inboxRowExists(state, row.id)).toBe(true);
    expect(inboxItemsForRole(rows, "coordinator")).toHaveLength(1);
    expect(inboxItemsForRole(rows, "bed_manager")).toHaveLength(0);
    expect(
      inboxItemsForRole(
        rows,
        "ward",
        state.units.map((unit) => unit.name),
      ),
    ).toHaveLength(0);
  });

  it("releasing the bed clears the flag and keeps the acceptance", () => {
    const { state: held, unitId } = withHeldBed();
    const state = admittedElsewhere(held, unitId);
    const otherWard = state.units.find((unit) => unit.id !== unitId)!.id;
    const refused = wardFlowReducer(state, {
      type: "RELEASE_REFERRAL_BED",
      role: "ward",
      now: NOW_ANCHOR,
      referralId: REFERRAL,
      unitId,
      actingUnitId: otherWard,
    });
    expect(refused.rejections.length).toBe(state.rejections.length + 1);

    const released = wardFlowReducer(state, {
      type: "RELEASE_REFERRAL_BED",
      role: "coordinator",
      now: NOW_ANCHOR,
      referralId: REFERRAL,
      unitId,
    });
    expect(released.rejections.length).toBe(state.rejections.length);
    const arm = released.referrals
      .find((referral) => referral.id === REFERRAL)!
      .destinations.find((candidate) => candidate.destination.kind === "psychiatric_ward")!;
    expect(arm.state).toBe("accepted");
    expect(arm.heldBedNumber).toBeUndefined();
    expect(heldBedsElsewhere(released)).toEqual([]);
    expect(inboxRowExists(released, `${INBOX_CATEGORIES.bed_held_elsewhere.idPrefix}${REFERRAL}`)).toBe(false);
    // Nothing left to release.
    const again = wardFlowReducer(released, {
      type: "RELEASE_REFERRAL_BED",
      role: "coordinator",
      now: NOW_ANCHOR,
      referralId: REFERRAL,
      unitId,
    });
    expect(again.rejections.length).toBe(released.rejections.length + 1);
  });
});
