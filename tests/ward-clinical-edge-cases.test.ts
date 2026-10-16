import { describe, expect, it } from "vitest";

import { DISCHARGE_DELAY_CLEAR_REASONS } from "@/components/ward-management/ward-change-reasons";
import { genderEligibility, validateGenderPlacement } from "@/components/ward-management/ward-eligibility";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

describe("Clinical state-machine edge cases", () => {
  it("supports diverting an ambulance after patient collection while preserving collection provenance", () => {
    const initial = seedWardFlowState();
    const movingMovement = initial.movements.find(
      (movement) =>
        !movement.closure &&
        movement.transport !== undefined &&
        movement.transport.collectedAt !== undefined &&
        movement.transport.arrivedAt === undefined &&
        movement.transport.diversion === undefined,
    );
    expect(movingMovement).toBeDefined();

    const divertedState = wardFlowReducer(initial, {
      type: "RECORD_DIVERSION",
      role: "coordinator",
      now: NOW + 15,
      movementId: movingMovement!.id,
      reason: "Needs urgent medical care on the way",
      place: "Back at the sending emergency department",
    });

    const updated = divertedState.movements.find((m) => m.id === movingMovement!.id)!;
    expect(updated.transport?.collectedAt).toBe(movingMovement!.transport!.collectedAt);
    expect(updated.transport?.diversion).toEqual({
      at: NOW + 15,
      by: "coordinator",
      reason: "Needs urgent medical care on the way",
      place: "Back at the sending emergency department",
    });
  });

  it("records an evolving chronological history of clinical reassessments without overwriting prior entries", () => {
    const initial = seedWardFlowState();
    const queuedReferral = initial.referrals.find((referral) =>
      referral.destinations.some((dest) => dest.destination.kind === "emergency_department" && dest.state === "queued"),
    );
    expect(queuedReferral).toBeDefined();

    const declinedState = wardFlowReducer(initial, {
      type: "DECLINE_REFERRAL",
      role: "ed",
      now: NOW + 5,
      referralId: queuedReferral!.id,
      destinationKind: "emergency_department",
      reason: "belongs_to_another_service",
    });

    const afterFirstReassessment = wardFlowReducer(declinedState, {
      type: "ACCEPT_REFERRAL",
      role: "ed",
      now: NOW + 20,
      referralId: queuedReferral!.id,
      destinationKind: "emergency_department",
      reassessment: true,
      clinicalUpdate: true,
      reassessmentNote: "First reassessment: agitation increased in triage bay.",
    });

    const afterSecondReassessment = wardFlowReducer(afterFirstReassessment, {
      type: "ACCEPT_REFERRAL",
      role: "ed",
      now: NOW + 45,
      referralId: queuedReferral!.id,
      destinationKind: "emergency_department",
      reassessment: true,
      clearanceUpdated: true,
      reassessmentNote: "Second reassessment: medical toxicology clearance completed.",
    });

    const updatedReferral = afterSecondReassessment.referrals.find((r) => r.id === queuedReferral!.id)!;
    const edAddressing = updatedReferral.destinations.find((dest) => dest.destination.kind === "emergency_department")!;
    expect(edAddressing.state).toBe("accepted");
    expect(edAddressing.reassessmentNote).toBe("Second reassessment: medical toxicology clearance completed.");
    expect(edAddressing.reassessmentHistory).toHaveLength(2);
    expect(edAddressing.reassessmentHistory?.[0]?.note).toBe("First reassessment: agitation increased in triage bay.");
    expect(edAddressing.reassessmentHistory?.[1]?.note).toBe(
      "Second reassessment: medical toxicology clearance completed.",
    );
    expect(updatedReferral.reassessmentHistory).toHaveLength(2);

    // The second reassessment decided nothing new, so the acceptance keeps its own undo record.
    const decisionRecords = (state: typeof initial) =>
      (state.undoRecords ?? []).filter(
        (record) => record.kind === "referral-decision" && record.referralId === queuedReferral!.id,
      );
    expect(decisionRecords(afterSecondReassessment)).toEqual(decisionRecords(afterFirstReassessment));
    // Inside the undo window, Undo is then refused, so a recorded reassessment is never erased.
    const quickReassessment = wardFlowReducer(afterFirstReassessment, {
      type: "ACCEPT_REFERRAL",
      role: "ed",
      now: NOW + 21,
      referralId: queuedReferral!.id,
      destinationKind: "emergency_department",
      reassessment: true,
      reassessmentNote: "Quick reassessment.",
    });
    const undone = wardFlowReducer(quickReassessment, {
      type: "UNDO_REFERRAL_DECISION",
      role: "ed",
      now: NOW + 22,
      referralId: queuedReferral!.id,
    });
    expect(undone.rejections.at(-1)?.reason).toBe(
      "This referral has changed since the decision, so it cannot be undone",
    );
    expect(undone.referrals).toEqual(quickReassessment.referrals);
  });

  it("writes a reassessment into the journey only when it is the ED answer that raised the journey", () => {
    const seeded = seedWardFlowState();
    const referral = seeded.referrals.find((candidate) =>
      candidate.destinations.some(
        (dest) => dest.destination.kind === "emergency_department" && dest.state === "queued",
      ),
    )!;
    const edArm = referral.destinations.find((dest) => dest.destination.kind === "emergency_department")!;
    const edId = (edArm.destination as { edId: string }).edId;
    const journey = seeded.movements.find((movement) => !movement.closure)!;
    // A synthetic referral with an accepted ED answer, an accepted community answer and the journey the ED raised.
    const initial = {
      ...seeded,
      referrals: seeded.referrals.map((candidate) =>
        candidate.id !== referral.id
          ? candidate
          : {
              ...candidate,
              destinations: [
                { ...edArm, state: "accepted" as const, decidedAt: NOW, decidedBy: "ed" as const },
                {
                  ...edArm,
                  destination: { kind: "community_team" as const, teamName: "Synthetic community team" },
                  state: "accepted" as const,
                  decidedAt: NOW,
                  decidedBy: "community" as const,
                },
              ],
            },
      ),
      movements: seeded.movements.map((movement) =>
        movement.id === journey.id
          ? { ...movement, referralId: referral.id, originEdId: edId, reassessmentHistory: undefined }
          : movement,
      ),
    } as typeof seeded;
    const reassess = (state: typeof seeded, destinationKind: "community_team" | "emergency_department", note: string) =>
      wardFlowReducer(state, {
        type: "ACCEPT_REFERRAL",
        role: destinationKind === "community_team" ? "community" : "ed",
        now: NOW + 10,
        referralId: referral.id,
        destinationKind,
        reassessment: true,
        reassessmentNote: note,
      });

    const afterCommunity = reassess(initial, "community_team", "Community review.");
    expect(afterCommunity.rejections).toEqual(initial.rejections);
    expect(afterCommunity.movements.find((m) => m.id === journey.id)?.reassessmentHistory).toBeUndefined();

    const afterEd = reassess(initial, "emergency_department", "ED review.");
    expect(afterEd.rejections).toEqual(initial.rejections);
    expect(afterEd.movements.find((m) => m.id === journey.id)?.reassessmentHistory?.map((entry) => entry.note)).toEqual(
      ["ED review."],
    );
  });

  it("validates and records the clearance reason when clearing a bed release or stay discharge blocker", () => {
    const initial = seedWardFlowState();
    const releaseTarget = initial.bedReleases.find((release) => release.state !== "discharged")!;
    expect(releaseTarget).toBeDefined();

    const blockedState = wardFlowReducer(initial, {
      type: "BLOCK_BED_RELEASE",
      role: "ward",
      now: NOW + 5,
      releaseId: releaseTarget.id,
      actingUnitId: releaseTarget.unitId,
      blocker: "Awaiting transport",
    });

    const rejectedBlankReason = wardFlowReducer(blockedState, {
      type: "CLEAR_BED_RELEASE_BLOCK",
      role: "ward",
      now: NOW + 10,
      releaseId: releaseTarget.id,
      actingUnitId: releaseTarget.unitId,
      reason: "   " as never,
    });
    expect(rejectedBlankReason.rejections.at(-1)?.attempted).toBe("CLEAR_BED_RELEASE_BLOCK");
    expect(rejectedBlankReason.bedReleases.find((r) => r.id === releaseTarget.id)?.blocker).toBe("Awaiting transport");

    expect(DISCHARGE_DELAY_CLEAR_REASONS).toContain("transport_arranged");
    const clearedState = wardFlowReducer(blockedState, {
      type: "CLEAR_BED_RELEASE_BLOCK",
      role: "ward",
      now: NOW + 12,
      releaseId: releaseTarget.id,
      actingUnitId: releaseTarget.unitId,
      reason: "transport_arranged",
    });
    const clearedRelease = clearedState.bedReleases.find((r) => r.id === releaseTarget.id)!;
    expect(clearedRelease.blocker).toBeNull();
    expect(clearedRelease.lastClearedBlockReason).toBe("transport_arranged");
    expect(clearedRelease.clearedBlockHistory).toEqual([
      {
        at: NOW + 12,
        by: "ward",
        reason: "transport_arranged",
        blocker: "Awaiting transport",
      },
    ]);
  });

  it("validates single-sex ward gender placement conflicts and coordinator gender placement clearance", () => {
    const singleSexUnit = {
      id: "unit-female-only",
      name: "Female Subacute Ward",
      sexDesignation: "Female only" as const,
    };
    const nonBinaryValidation = validateGenderPlacement({ gender: "Non-binary", sex: "Female" }, singleSexUnit);
    expect(nonBinaryValidation.eligible).toBe(false);
    expect(nonBinaryValidation.requiresCoordinatorReview).toBe(true);
    expect(nonBinaryValidation.conflictWarning).toContain("requires a recorded coordinator gender placement");

    const clearedValidation = validateGenderPlacement(
      {
        gender: "Non-binary",
        sex: "Female",
        genderPlacements: [
          {
            at: NOW,
            by: "coordinator",
            unitIds: ["unit-female-only"],
            reason: "A single room is available on this ward",
            wardChecked: true,
          },
        ],
      },
      singleSexUnit,
    );
    expect(clearedValidation.eligible).toBe(true);
    expect(clearedValidation.conflictWarning).toBeUndefined();

    const gateWithClearance = genderEligibility({ gender: "Non-binary" }, singleSexUnit, undefined, [
      {
        at: NOW,
        by: "coordinator",
        unitIds: ["unit-female-only"],
        reason: "A single room is available on this ward",
        wardChecked: true,
      },
    ]);
    expect(gateWithClearance.pass).toBe(true);
  });

  it("a coordinator placement clears an unrecorded gender but never a binary mismatch, and the recorded sex is reviewed on any ward", () => {
    const femaleOnly = { id: "unit-female-only", name: "Female Subacute Ward", sexDesignation: "Female only" as const };
    const undesignated = { id: "unit-open", name: "Open Ward", sexDesignation: "Undesignated" as const };
    const placement = (unitId: string) => [
      {
        at: NOW,
        by: "coordinator" as const,
        unitIds: [unitId],
        reason: "A single room is available on this ward" as const,
        wardChecked: true as const,
      },
    ];

    // A male patient at a female-only ward stays refused even with a placement for that ward.
    const binaryMismatch = validateGenderPlacement(
      { gender: "Male", sex: "Male", genderPlacements: placement(femaleOnly.id) },
      femaleOnly,
    );
    expect(binaryMismatch.eligible).toBe(false);

    // An unrecorded gender is refused without a placement and passes once one covers the ward.
    expect(genderEligibility({ gender: undefined }, femaleOnly).pass).toBe(false);
    expect(genderEligibility({ gender: undefined }, femaleOnly, undefined, placement(femaleOnly.id)).pass).toBe(true);

    // The reducer asks for a placement on ANY ward when recorded sex and gender are not both
    // female or male, so an undesignated ward is not enough on its own.
    const needsPlacement = validateGenderPlacement({ gender: "Female", sex: "Another term" }, undesignated);
    expect(needsPlacement.eligible).toBe(false);
    expect(needsPlacement.requiresCoordinatorReview).toBe(true);
    const placed = validateGenderPlacement(
      { gender: "Female", sex: "Another term", genderPlacements: placement(undesignated.id) },
      undesignated,
    );
    expect(placed.eligible).toBe(true);
  });
});
