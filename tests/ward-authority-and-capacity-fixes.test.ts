import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

function seeded() {
  const state = seedWardFlowState();
  return {
    ...state,
    units: state.units.map((u) => ({
      ...u,
      confirmedAt: NOW,
      empty: { ...u.empty, value: Math.max(1, u.empty.value) },
      allocatable: { ...u.allocatable, value: Math.max(1, u.allocatable.value) },
    })),
    movements: state.movements.map((candidate) =>
      candidate.id === "WF-009" ? { ...candidate, gender: "Male" as const } : candidate,
    ),
  };
}

describe("Option A: Cross-Ward Authority Safeguards", () => {
  describe("A1-1 & S2-11: ACCEPT_IN_PRINCIPLE and PULL_PATIENT authority checks", () => {
    it("refuses ACCEPT_IN_PRINCIPLE when a ward caller acts for a different ward", () => {
      const state = seeded();
      const next = wardFlowReducer(state, {
        type: "ACCEPT_IN_PRINCIPLE",
        role: "ward",
        now: NOW,
        movementId: "WF-002",
        unitId: "fsh-older-adult",
        actingUnitId: "arm-adult-open", // Mismatched acting ward
      });

      expect(next.rejections).toHaveLength(state.rejections.length + 1);
      expect(next.rejections.at(-1)?.reason).toContain(
        "ACCEPT_IN_PRINCIPLE was raised acting as unit arm-adult-open but answers for fsh-older-adult; a ward answers only its own referrals",
      );
    });

    it("allows ACCEPT_IN_PRINCIPLE when actingUnitId matches unitId", () => {
      const state = seeded();
      const next = wardFlowReducer(state, {
        type: "ACCEPT_IN_PRINCIPLE",
        role: "ward",
        now: NOW,
        movementId: "WF-002",
        unitId: "fsh-older-adult",
        actingUnitId: "fsh-older-adult",
      });

      expect(next.rejections).toHaveLength(state.rejections.length);
      const updated = next.movements.find((m) => m.id === "WF-002")!;
      expect(updated.acceptedUnitId).toBe("fsh-older-adult");
      expect(updated.stage).toBe("accepted_awaiting_bed");
    });

    it("refuses PULL_PATIENT when a ward caller acts for a different ward", () => {
      const state = seeded();
      const accepted = wardFlowReducer(state, {
        type: "ACCEPT_IN_PRINCIPLE",
        role: "ward",
        now: NOW,
        movementId: "WF-002",
        unitId: "fsh-older-adult",
        actingUnitId: "fsh-older-adult",
      });

      const next = wardFlowReducer(accepted, {
        type: "PULL_PATIENT",
        role: "ward",
        now: NOW + 10,
        movementId: "WF-002",
        unitId: "fsh-older-adult",
        actingUnitId: "arm-adult-open",
      });

      expect(next.rejections).toHaveLength(accepted.rejections.length + 1);
      expect(next.rejections.at(-1)?.reason).toContain(
        "PULL_PATIENT was raised acting as unit arm-adult-open but answers for fsh-older-adult; a ward answers only its own referrals",
      );
    });

    it("allows PULL_PATIENT when actingUnitId matches unitId", () => {
      const state = seeded();
      const accepted = wardFlowReducer(state, {
        type: "ACCEPT_IN_PRINCIPLE",
        role: "ward",
        now: NOW,
        movementId: "WF-002",
        unitId: "fsh-older-adult",
        actingUnitId: "fsh-older-adult",
      });

      const next = wardFlowReducer(accepted, {
        type: "PULL_PATIENT",
        role: "ward",
        now: NOW + 10,
        movementId: "WF-002",
        unitId: "fsh-older-adult",
        actingUnitId: "fsh-older-adult",
      });

      expect(next.rejections).toHaveLength(accepted.rejections.length);
      const updated = next.movements.find((m) => m.id === "WF-002")!;
      expect(updated.stage).toBe("pulled");
    });
  });

  describe("A1-3: DECLINE authority checks", () => {
    it("refuses DECLINE when a ward caller acts for a different ward", () => {
      const state = seeded();
      const next = wardFlowReducer(state, {
        type: "DECLINE",
        role: "ward",
        now: NOW,
        movementId: "WF-002",
        unitId: "fsh-older-adult",
        actingUnitId: "arm-adult-open",
        reason: "belongs_to_another_service",
      });

      expect(next.rejections).toHaveLength(state.rejections.length + 1);
      expect(next.rejections.at(-1)?.reason).toContain(
        "DECLINE was raised acting as unit arm-adult-open but answers for fsh-older-adult; a ward answers only its own referrals",
      );
    });

    it("allows DECLINE when actingUnitId matches unitId", () => {
      const state = seeded();
      const next = wardFlowReducer(state, {
        type: "DECLINE",
        role: "ward",
        now: NOW,
        movementId: "WF-002",
        unitId: "fsh-older-adult",
        actingUnitId: "fsh-older-adult",
        reason: "belongs_to_another_service",
      });

      expect(next.rejections).toHaveLength(state.rejections.length);
      const updated = next.movements.find((m) => m.id === "WF-002")!;
      expect(updated.referredUnitIds).not.toContain("fsh-older-adult");
    });
  });

  describe("A1-5: RECORD_LEGAL_FORM_WRITTEN role & expiry shortening rules", () => {
    it("refuses RECORD_LEGAL_FORM_WRITTEN from ward and community callers", () => {
      const state = seeded();
      const wardAttempt = wardFlowReducer(state, {
        type: "RECORD_LEGAL_FORM_WRITTEN",
        role: "ward" as unknown as "ed",
        now: NOW,
        movementId: "WF-001",
        formCode: "1A",
        writtenAt: NOW - 1000,
        paperExpiresAt: NOW + 10000,
      });

      expect(wardAttempt.rejections).toHaveLength(state.rejections.length + 1);
      expect(wardAttempt.rejections.at(-1)?.reason).toContain(
        "RECORD_LEGAL_FORM_WRITTEN requires role ed or coordinator, but was raised by role ward",
      );

      const communityAttempt = wardFlowReducer(state, {
        type: "RECORD_LEGAL_FORM_WRITTEN",
        role: "community" as unknown as "ed",
        now: NOW,
        movementId: "WF-001",
        formCode: "1A",
        writtenAt: NOW - 1000,
        paperExpiresAt: NOW + 10000,
      });

      expect(communityAttempt.rejections).toHaveLength(state.rejections.length + 1);
      expect(communityAttempt.rejections.at(-1)?.reason).toContain(
        "RECORD_LEGAL_FORM_WRITTEN requires role ed or coordinator, but was raised by role community",
      );
    });

    it("refuses shortening an existing paper expiry on the same form", () => {
      const state = seeded();
      // First, ED records a form with paperExpiresAt = NOW + 10000
      const withInitialForm = wardFlowReducer(state, {
        type: "RECORD_LEGAL_FORM_WRITTEN",
        role: "ed",
        now: NOW,
        movementId: "WF-001",
        formCode: "1A",
        writtenAt: NOW - 1000,
        paperExpiresAt: NOW + 10000,
      });
      expect(withInitialForm.rejections).toHaveLength(state.rejections.length);

      // Now, try to shorten the expiry to NOW + 5000 on the same form 1A
      const shortenedAttempt = wardFlowReducer(withInitialForm, {
        type: "RECORD_LEGAL_FORM_WRITTEN",
        role: "ed",
        now: NOW + 500,
        movementId: "WF-001",
        formCode: "1A",
        writtenAt: NOW - 1000,
        paperExpiresAt: NOW + 5000,
      });

      expect(shortenedAttempt.rejections).toHaveLength(withInitialForm.rejections.length + 1);
      expect(shortenedAttempt.rejections.at(-1)?.reason).toBe(
        "A written form expiry cannot shorten an existing recorded expiry.",
      );
    });

    it("allows extending the expiry on the same form and preserves audit history", () => {
      const state = seeded();
      const withInitialForm = wardFlowReducer(state, {
        type: "RECORD_LEGAL_FORM_WRITTEN",
        role: "ed",
        now: NOW,
        movementId: "WF-001",
        formCode: "1A",
        writtenAt: NOW - 1000,
        paperExpiresAt: NOW + 10000,
      });

      const extended = wardFlowReducer(withInitialForm, {
        type: "RECORD_LEGAL_FORM_WRITTEN",
        role: "coordinator",
        now: NOW + 500,
        movementId: "WF-001",
        formCode: "1A",
        writtenAt: NOW - 1000,
        paperExpiresAt: NOW + 20000,
      });

      expect(extended.rejections).toHaveLength(withInitialForm.rejections.length);
      const mv = extended.movements.find((m) => m.id === "WF-001")!;
      expect(mv.legalForm?.dueAt).toBe(NOW + 20000);
      expect(mv.legalFormExpiryHistory?.length).toBeGreaterThanOrEqual(2);
      expect(mv.legalFormExpiryHistory?.at(-1)).toEqual({
        at: NOW + 500,
        by: "coordinator",
        dueAt: NOW + 20000,
        basis: "written_on_form",
      });
    });
  });
});

describe("Option B: Flow & Capacity Discrepancy Safeguards", () => {
  describe("S2-3: Arrival into a full ward does not produce phantom free bed on departure", () => {
    it("absorbs departure into pending arrivalCapacityConflicts without incrementing empty bed count", () => {
      const state = seeded();
      // Find an occupant already admitted in scgh-adult-open
      const existingOccupant = state.admissions.find((a) => a.unitId === "scgh-adult-open" && a.state === "occupied")!;
      expect(existingOccupant).toBeDefined();

      // WF-001 starts at placement_requested; refer to scgh-adult-open
      const referredState = wardFlowReducer(state, {
        type: "REFER_TO_UNITS",
        role: "coordinator",
        now: NOW,
        movementId: "WF-001",
        unitIds: ["scgh-adult-open"],
      });
      const acceptedState = wardFlowReducer(referredState, {
        type: "ACCEPT_IN_PRINCIPLE",
        role: "ward",
        now: NOW + 5,
        movementId: "WF-001",
        unitId: "scgh-adult-open",
        actingUnitId: "scgh-adult-open",
      });
      const pulledState = wardFlowReducer(acceptedState, {
        type: "PULL_PATIENT",
        role: "ward",
        now: NOW + 10,
        movementId: "WF-001",
        unitId: "scgh-adult-open",
        actingUnitId: "scgh-adult-open",
      });
      expect(pulledState.rejections).toHaveLength(state.rejections.length);

      // Mark noTransportNeeded: true on movement so PATIENT_ARRIVED can be confirmed directly from pulled
      // and simulate that the ward became completely full before arrival (empty.value = 0)
      const fullAtArrival = {
        ...pulledState,
        movements: pulledState.movements.map((m) =>
          m.id === "WF-001"
            ? {
                ...m,
                transportNeed: { needed: false, at: NOW },
                transport: undefined,
              }
            : m,
        ),
        units: pulledState.units.map((u) =>
          u.id === "scgh-adult-open"
            ? {
                ...u,
                empty: { ...u.empty, value: 0 },
                allocatable: { ...u.allocatable, value: 0 },
              }
            : u,
        ),
      };

      // Arrive patient into full ward
      const arrivedState = wardFlowReducer(fullAtArrival, {
        type: "PATIENT_ARRIVED",
        role: "ward",
        now: NOW + 50,
        movementId: "WF-001",
        actingUnitId: "scgh-adult-open",
      });
      expect(arrivedState.rejections).toHaveLength(state.rejections.length);

      const arrivedUnit = arrivedState.units.find((u) => u.id === "scgh-adult-open")!;
      expect(arrivedUnit.empty.value).toBe(0);
      expect(arrivedUnit.arrivalCapacityConflicts).toBeDefined();
      expect(arrivedUnit.arrivalCapacityConflicts!.length).toBeGreaterThanOrEqual(1);

      // Now, an existing occupant departs the ward
      const departedState = wardFlowReducer(arrivedState, {
        type: "RECORD_LEAVING",
        role: "ward",
        now: NOW + 100,
        admissionId: existingOccupant.id,
        actingUnitId: "scgh-adult-open",
        leavingDestination: "transferred-to-a-general-hospital",
      });

      const unitAfterDeparture = departedState.units.find((u) => u.id === "scgh-adult-open")!;
      // Crucial assertion for S2-3: empty bed count should STILL BE 0, because the departing bed
      // resolved the over-capacity arrival conflict!
      expect(unitAfterDeparture.empty.value).toBe(0);
      expect(unitAfterDeparture.allocatable.value).toBe(0);
      expect(unitAfterDeparture.arrivalCapacityConflicts?.length ?? 0).toBe(
        arrivedUnit.arrivalCapacityConflicts!.length - 1,
      );

      // Now, another occupant departs when arrivalCapacityConflicts is 0
      const anotherOccupant = departedState.admissions.find(
        (a) => a.unitId === "scgh-adult-open" && a.state === "occupied" && a.id !== existingOccupant.id,
      )!;
      expect(anotherOccupant).toBeDefined();

      const secondDepartedState = wardFlowReducer(departedState, {
        type: "RECORD_LEAVING",
        role: "ward",
        now: NOW + 200,
        admissionId: anotherOccupant.id,
        actingUnitId: "scgh-adult-open",
        leavingDestination: "transferred-to-a-general-hospital",
      });

      const unitAfterSecondDeparture = secondDepartedState.units.find((u) => u.id === "scgh-adult-open")!;
      // Now that conflicts are resolved, empty bed count increases to 1!
      expect(unitAfterSecondDeparture.empty.value).toBe(1);
      expect(unitAfterSecondDeparture.allocatable.value).toBe(1);
    });
  });

  describe("S1-5: Revoked examination closure unwinds live referrals cleanly", () => {
    it("clears referredUnitIds, records withdrawnReferrals, and sends truthful notices", () => {
      const state = seeded();
      // WF-001 (adult female) is referred to 2 adult open units
      const withTwoReferrals = wardFlowReducer(state, {
        type: "REFER_TO_UNITS",
        role: "coordinator",
        now: NOW,
        movementId: "WF-001",
        unitIds: ["scgh-adult-open", "arm-adult-open"],
      });
      const mvBefore = withTwoReferrals.movements.find((m) => m.id === "WF-001")!;
      expect(mvBefore.referredUnitIds.length).toBe(2);
      expect(mvBefore.stage).toBe("destination_review");

      const beforeNoticesCount = withTwoReferrals.notices.length;
      const next = wardFlowReducer(withTwoReferrals, {
        type: "RECORD_EXAMINATION",
        role: "ed",
        now: NOW + 10,
        movementId: "WF-001",
        outcome: "revoked",
      });

      expect(next.rejections).toHaveLength(withTwoReferrals.rejections.length);
      const mvAfter = next.movements.find((m) => m.id === "WF-001")!;

      // 1. Stage transition and closure
      expect(mvAfter.closure?.outcome).toBe("did_not_proceed");
      expect(mvAfter.closure?.reason).toBe("examination outcome revoked");

      // 2. referredUnitIds and acceptedUnitId cleared (S1-5)
      expect(mvAfter.referredUnitIds).toEqual([]);
      expect(mvAfter.acceptedUnitId).toBeUndefined();

      // 3. No spurious notices sent when no bed was held / accepted
      const addedNotices = next.notices.slice(beforeNoticesCount);
      expect(addedNotices.filter((n) => n.kind === "examination_revoked_ward")).toHaveLength(0);
    });

    // Audit 24-1 decision 3 (owner): a revoked examination no longer releases a held bed, so the
    // ward notice now says the bed stays held, never that it was released.
    it("reports the bed stays held if a bed was held before revoked examination", () => {
      const state = seeded();
      // Refer, accept, and pull WF-001 to scgh-adult-open
      const referred = wardFlowReducer(state, {
        type: "REFER_TO_UNITS",
        role: "coordinator",
        now: NOW,
        movementId: "WF-001",
        unitIds: ["scgh-adult-open"],
      });
      const accepted = wardFlowReducer(referred, {
        type: "ACCEPT_IN_PRINCIPLE",
        role: "ward",
        now: NOW + 5,
        movementId: "WF-001",
        unitId: "scgh-adult-open",
        actingUnitId: "scgh-adult-open",
      });
      const pulled = wardFlowReducer(accepted, {
        type: "PULL_PATIENT",
        role: "ward",
        now: NOW + 10,
        movementId: "WF-001",
        unitId: "scgh-adult-open",
        actingUnitId: "scgh-adult-open",
      });

      expect(pulled.rejections).toHaveLength(state.rejections.length);

      const beforeCount = pulled.notices.length;
      const revoked = wardFlowReducer(pulled, {
        type: "RECORD_EXAMINATION",
        role: "ed",
        now: NOW + 20,
        movementId: "WF-001",
        outcome: "revoked",
      });

      expect(revoked.rejections).toHaveLength(pulled.rejections.length);
      const addedNotices = revoked.notices.slice(beforeCount);
      const revokedNotice = addedNotices.find((n) => n.kind === "examination_revoked_ward");
      expect(revokedNotice).toBeDefined();
      expect(revokedNotice!.sentence).toContain("The bed stays held until a person decides whether to release it.");
      expect(revokedNotice!.sentence).not.toContain("has been released");
    });
  });
});
