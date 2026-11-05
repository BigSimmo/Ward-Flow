import { describe, expect, it } from "vitest";
import { commandScopeRefusal } from "../src/components/ward-management/ward-access-state";
import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import type { WardAccess } from "../src/components/ward-management/ward-role-access";

const state = seedWardFlowState();
const options = { now: 642, places: wardPlaceLookup(state.units) };
const north: WardAccess = { role: "coordinator", scope: { kind: "service", service: "North Metro" } };

describe("consolidated authoritative targets", () => {
  it("requires a scoped handover Undo to name a ward, preserving ordinary ward Undo", () => {
    expect(
      commandScopeRefusal(state, north, { type: "UNDO_HANDOVER_SIGN_OFF", role: "coordinator" }, options),
    ).not.toBeNull();
    const unit = state.units.find((candidate) => options.places.unitService(candidate.id) === "North Metro")!;
    expect(
      commandScopeRefusal(
        state,
        north,
        { type: "UNDO_HANDOVER_SIGN_OFF", role: "coordinator", unitId: unit.id },
        options,
      ),
    ).toBeNull();
  });

  it.each(["ACCEPT_REFERRAL", "DECLINE_REFERRAL"])(
    "%s checks the receiving ED rather than outbound visibility",
    (type) => {
      const referral = {
        ...state.referrals[0],
        source: "ed_medical" as const,
        originSiteCode: "RPH",
        destinations: [
          {
            destination: {
              kind: "emergency_department" as const,
              edId: "fsh-ed",
              purpose: "psychiatric_review" as const,
            },
            state: "queued" as const,
          },
        ],
      };
      const world = { ...state, referrals: [referral] };
      const command = { type, role: "ed", referralId: referral.id, destinationKind: "emergency_department" };
      const sender: WardAccess = { role: "ed", scope: { kind: "ed", edId: "rph-ed" } };
      const recipient: WardAccess = { role: "ed", scope: { kind: "ed", edId: "fsh-ed" } };
      expect(commandScopeRefusal(world, sender, command, options)).not.toBeNull();
      expect(commandScopeRefusal(world, recipient, command, options)).toBeNull();
    },
  );

  it.each(["ACCEPT_REFERRAL", "DECLINE_REFERRAL"])("%s checks the receiving community team", (type) => {
    const referral = {
      ...state.referrals[0],
      source: "community" as const,
      sendingTeamName: "Synthetic sending team",
      destinations: [
        {
          destination: { kind: "community_team" as const, teamName: "Synthetic receiving team" },
          state: "queued" as const,
        },
      ],
    };
    const world = { ...state, referrals: [referral] };
    const command = { type, role: "community", referralId: referral.id, destinationKind: "community_team" };
    const sender: WardAccess = { role: "community", scope: { kind: "team", teamName: referral.sendingTeamName } };
    const recipient: WardAccess = { role: "community", scope: { kind: "team", teamName: "Synthetic receiving team" } };
    expect(commandScopeRefusal(world, sender, command, options)).not.toBeNull();
    expect(commandScopeRefusal(world, recipient, command, options)).toBeNull();
  });

  it("checks legacy withdrawal place claims against the authoritative desk", () => {
    const movement = { ...state.movements[0], originEdId: "fsh-ed" };
    const world = { ...state, movements: [movement] };
    const command = {
      type: "WITHDRAW_REFERRAL",
      role: "ed",
      movementId: movement.id,
      actingPlaceId: "rph-ed",
      placeId: "fsh-ed",
    };
    expect(
      commandScopeRefusal(world, { role: "ed", scope: { kind: "ed", edId: "rph-ed" } }, command, options),
    ).not.toBeNull();
  });
  it("captures the original legal-form ward and permits its ordinary Undo only there", () => {
    const stay = state.admissions.find((row) => row.state === "occupied" && row.patientId)!;
    const movement = {
      ...state.movements[0],
      patientId: stay.patientId!,
      acceptedUnitId: stay.unitId,
      admissionId: stay.id,
      closure: { outcome: "arrived" as const, at: 640, by: "coordinator" as const, reason: "Synthetic arrival" },
    };
    const world = { ...state, movements: [movement] };
    const event = {
      type: "RECORD_LEGAL_FORM_WRITTEN" as const,
      role: "ward" as const,
      now: 642,
      movementId: movement.id,
      formCode: "1A",
      writtenAt: 641,
    };
    const recorded = wardFlowReducer(world, event);
    expect(recorded.rejections.length).toBe(world.rejections.length);
    const record = recorded.undoRecords?.find(
      (row) => row.kind === "step" && row.undoType === "UNDO_LEGAL_FORM_RECORD",
    );
    expect(record?.unitId).toBe(stay.unitId);
    const undo = { type: "UNDO_LEGAL_FORM_RECORD" as const, role: "ward" as const, now: 643, movementId: movement.id };
    expect(
      commandScopeRefusal(recorded, { role: "ward", scope: { kind: "ward", unitIds: [stay.unitId] } }, undo, options),
    ).toBeNull();
    const foreign = state.units.find((unit) => unit.id !== stay.unitId)!;
    expect(
      commandScopeRefusal(recorded, { role: "ward", scope: { kind: "ward", unitIds: [foreign.id] } }, undo, options),
    ).not.toBeNull();
    expect(wardFlowReducer(recorded, undo).rejections.length).toBe(recorded.rejections.length);
  });
});
