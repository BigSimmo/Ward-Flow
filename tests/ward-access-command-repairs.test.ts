import { describe, expect, it } from "vitest";
import { commandScopeRefusal } from "../src/components/ward-management/ward-access-state";
import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import type { WardAccess } from "../src/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import { unitHealthService } from "../src/components/ward-management/ward-service-scope";
import { validSharedCommand } from "../backend/ward-flow/command-schemas";

const NOW = NOW_ANCHOR;
const ward = (unitId: string): WardAccess => ({ role: "ward", scope: { kind: "ward", unitIds: [unitId] } });
const ed = (edId: string): WardAccess => ({ role: "ed", scope: { kind: "ed", edId } });
const team = (teamName: string): WardAccess => ({ role: "community", scope: { kind: "team", teamName } });

describe("access audit command authority repairs", () => {
  it.each(["ACCEPT_REFERRAL", "DECLINE_REFERRAL"])("%s binds an ED answer to the stored receiving ED", (type) => {
    const state = seedWardFlowState();
    const referral = {
      ...state.referrals[0],
      source: "ed_medical" as const,
      originSiteCode: "RPH",
      destinations: [
        {
          destination: {
            kind: "emergency_department" as const,
            edId: "scgh-ed",
            purpose: "psychiatric_review" as const,
          },
          state: "queued" as const,
        },
      ],
    };
    state.referrals = [referral];
    const command = { type, role: "ed", now: NOW, referralId: referral.id, destinationKind: "emergency_department" };
    const options = { now: NOW, places: wardPlaceLookup(state.units) };
    expect(commandScopeRefusal(state, ed("scgh-ed"), command, options)).toBeNull();
    expect(commandScopeRefusal(state, ed("rph-ed"), command, options)).not.toBeNull();
    expect(commandScopeRefusal(state, ed("unrelated"), command, options)).not.toBeNull();
  });

  it.each(["ACCEPT_REFERRAL", "DECLINE_REFERRAL"])("%s binds a community answer to its receiving team", (type) => {
    const state = seedWardFlowState();
    const referral = {
      ...state.referrals[0],
      source: "community" as const,
      sendingTeamName: "Sending team",
      destinations: [
        { destination: { kind: "community_team" as const, teamName: "Receiving team" }, state: "queued" as const },
      ],
    };
    state.referrals = [referral];
    const command = { type, role: "community", now: NOW, referralId: referral.id, destinationKind: "community_team" };
    const options = { now: NOW, places: wardPlaceLookup(state.units) };
    expect(commandScopeRefusal(state, team("Receiving team"), command, options)).toBeNull();
    expect(commandScopeRefusal(state, team("Sending team"), command, options)).not.toBeNull();
    expect(commandScopeRefusal(state, team("Unrelated team"), command, options)).not.toBeNull();
  });

  it.each(["RECORD_HANDOVER_SIGN_OFF", "UNDO_HANDOVER_SIGN_OFF"])(
    "%s requires an explicit target for a service coordinator",
    (type) => {
      const state = seedWardFlowState();
      const own = state.units.find((unit) => unitHealthService(unit))!;
      const access: WardAccess = { role: "coordinator", scope: { kind: "service", service: unitHealthService(own)! } };
      const options = { now: NOW, places: wardPlaceLookup(state.units) };
      const command = { type, role: "coordinator", now: NOW };
      expect(commandScopeRefusal(state, access, command, options)).not.toBeNull();
      expect(commandScopeRefusal(state, access, { ...command, unitId: "" }, options)).not.toBeNull();
      expect(commandScopeRefusal(state, access, { ...command, unitId: own.id }, options)).toBeNull();
      expect(
        commandScopeRefusal(state, { role: "coordinator", scope: { kind: "statewide" } }, command, options),
      ).toBeNull();
    },
  );

  it("rejects conflicting withdrawal aliases at schema, scope and execution boundaries", () => {
    const state = seedWardFlowState();
    const movement = state.movements.find((candidate) => !candidate.closure)!;
    const unitId = state.units[0].id;
    const command = {
      type: "WITHDRAW_REFERRAL" as const,
      role: "ward" as const,
      now: NOW,
      movementId: movement.id,
      actingPlaceId: unitId,
      placeId: "foreign",
    };
    expect(validSharedCommand(command)).toBe(false);
    expect(
      commandScopeRefusal(state, ward(unitId), command, { now: NOW, places: wardPlaceLookup(state.units) }),
    ).not.toBeNull();
    const next = wardFlowReducer(state, command);
    expect(next.rejections.at(-1)?.reason).toContain("Conflicting");
    expect(next.movements).toBe(state.movements);
  });

  it("does not let a legacy place alias bypass membership", () => {
    const state = seedWardFlowState();
    const movement = state.movements.find((candidate) => !candidate.closure)!;
    const command = { type: "WITHDRAW_REFERRAL", role: "ward", now: NOW, movementId: movement.id, placeId: "foreign" };
    expect(
      commandScopeRefusal(state, ward(state.units[0].id), command, { now: NOW, places: wardPlaceLookup(state.units) }),
    ).not.toBeNull();
  });

  it("captures the receiving ward's Form 6A provenance and permits only its authenticated Undo", () => {
    const state = seedWardFlowState();
    const stay = state.admissions.find((admission) => admission.state === "occupied" && admission.patientId !== null)!;
    const source = state.admissions.find((admission) => admission.unitId !== stay.unitId)!;
    const movement = {
      ...state.movements.find((candidate) => !candidate.closure)!,
      stage: "arrived" as const,
      patientId: stay.patientId ?? undefined,
      acceptedUnitId: stay.unitId,
      admissionId: stay.id,
      sourceAdmissionId: source.id,
      legalStatus: "Involuntary inpatient" as const,
      legalForm: { code: "1A", kind: "examination" as const },
      closure: { outcome: "arrived" as const, at: NOW - 60, reason: "Synthetic arrival" },
    };
    state.movements = [movement];
    state.admissions = state.admissions.map((admission) =>
      admission.id === stay.id ? { ...admission, movementId: movement.id } : admission,
    );
    const event: WardFlowEvent = {
      type: "RECORD_LEGAL_FORM_WRITTEN",
      role: "ward",
      now: NOW,
      movementId: movement.id,
      formCode: "6A",
      writtenAt: NOW - 30,
    };
    const applied = wardFlowReducer(state, event);
    expect(applied.rejections).toHaveLength(state.rejections.length);
    expect(applied.undoRecords?.find((record) => record.kind === "step" && record.action === event.type)?.unitId).toBe(
      stay.unitId,
    );
    const command = {
      type: "UNDO_LEGAL_FORM_RECORD" as const,
      role: "ward" as const,
      now: NOW + 1,
      movementId: movement.id,
      actingUnitId: stay.unitId,
    };
    const options = { now: NOW + 1, places: wardPlaceLookup(state.units) };
    expect(commandScopeRefusal(applied, ward(stay.unitId), command, options)).toBeNull();
    expect(
      commandScopeRefusal(applied, ward(source.unitId), { ...command, actingUnitId: source.unitId }, options),
    ).not.toBeNull();
    const undone = wardFlowReducer(applied, command);
    expect(undone.rejections).toHaveLength(applied.rejections.length);
    expect(undone.movements[0].legalForm).toEqual(movement.legalForm);
    const foreignCommand = { ...command, actingUnitId: source.unitId };
    const foreign = wardFlowReducer(applied, foreignCommand);
    expect(foreign.rejections).toHaveLength(applied.rejections.length + 1);
  });
});
