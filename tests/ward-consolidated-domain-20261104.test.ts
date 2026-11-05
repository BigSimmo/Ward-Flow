import { describe, expect, it } from "vitest";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { observationAt } from "@/components/ward-management/ward-observation";
import { observationEditingToken } from "@/components/ward-management/ward-flow-observation-events";
import { buildScenarioFile, readScenarioFile } from "@/components/ward-management/ward-flow-scenario-file";
import {
  isValidStoredWardFlowState,
  WARD_FLOW_STORED_STATE_VERSION,
} from "@/components/ward-management/ward-flow-storage-validation";
import { movementNextStep } from "@/components/ward-management/movements/movement-next-step";
import { STEP_BACK_REASONS } from "@/components/ward-management/ward-model";
import { loadScenarioNetworks } from "@/components/ward-management/ward-scenario-network-loader";
import { scenarioWardNetwork, scenarioEmergencyDepartments } from "@/components/ward-management/ward-scenarios";
import { TYPED_TEXT_FIXTURES } from "./helpers/ward-typed-text-fixtures";
import { isValidSharedWardFlowState } from "@/components/ward-management/ward-shared-state-validation";
import { TYPED_TEXT_NOT_KEPT } from "@/components/ward-management/ward-flow-typed-text-ledger";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const now = NOW_ANCHOR + 5;
const apply = (state: WardFlowState, event: Record<string, unknown>) =>
  wardFlowReducer(state, { now, ...event } as never);

describe("consolidated domain audit regressions", () => {
  it.each([false, true])("arrival retains the last accepted same-minute edit, ward-first=%s", (wardFirst) => {
    let state = seedWardFlowState();
    const original = state.movements.find((row) => row.id === "WF-011")!;
    const stay = state.admissions.find((row) => row.id === original.admissionId)!;
    expect(stay.observation).not.toEqual(original.observation);
    const edit = (ward: boolean, level: "arms_length" | "two_staff") => {
      const row = ward
        ? state.admissions.find((row) => row.id === stay.id)!
        : state.movements.find((row) => row.id === original.id)!;
      const kind = ward ? "admission" : "movement";
      const next = apply(state, {
        type: "RECORD_OBSERVATION_LEVEL",
        role: ward ? "ward" : "ed",
        target: ward ? { kind, admissionId: stay.id, actingUnitId: stay.unitId } : { kind, movementId: original.id },
        observation: observationAt(level),
        expected: observationEditingToken(kind, row.id, row.observation, row.observationChanges?.length ?? 0),
      });
      expect(next.rejections).toHaveLength(state.rejections.length);
      state = next;
    };
    edit(wardFirst, "arms_length");
    edit(!wardFirst, "two_staff");
    state = {
      ...state,
      movements: state.movements.map((row) =>
        row.id === original.id ? { ...row, transportNeed: { needed: false, at: now - 10 } } : row,
      ),
    };
    const arrived = apply(state, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      movementId: original.id,
      actingUnitId: original.acceptedUnitId,
    });
    expect(arrived.rejections).toHaveLength(state.rejections.length);
    expect(arrived.admissions.find((row) => row.id === stay.id)).toMatchObject({
      state: "occupied",
      observation: { level: "two_staff" },
    });
  });

  it.each([false, true])("a new accepted edit orders after same-minute legacy history, ward=%s", (ward) => {
    const seed = seedWardFlowState();
    const journey = seed.movements.find((row) => row.id === "WF-011")!;
    const stay = seed.admissions.find((row) => row.id === journey.admissionId)!;
    const state = {
      ...seed,
      movements: seed.movements.map((row) =>
        row.id === journey.id
          ? {
              ...row,
              observationChanges: [{ at: now, from: row.observation, to: row.observation }],
              transportNeed: { needed: false, at: now - 10 },
            }
          : row,
      ),
      admissions: seed.admissions.map((row) =>
        row.id === stay.id
          ? { ...row, observationChanges: [{ at: now, from: row.observation, to: row.observation }] }
          : row,
      ),
    };
    const target = ward
      ? state.admissions.find((row) => row.id === stay.id)!
      : state.movements.find((row) => row.id === journey.id)!;
    const kind = ward ? "admission" : "movement";
    const edited = apply(state, {
      type: "RECORD_OBSERVATION_LEVEL",
      role: ward ? "ward" : "ed",
      target: ward ? { kind, admissionId: stay.id, actingUnitId: stay.unitId } : { kind, movementId: journey.id },
      observation: observationAt("two_staff"),
      expected: observationEditingToken(kind, target.id, target.observation, 1),
    });
    expect(edited.rejections).toHaveLength(seed.rejections.length);
    const built = buildScenarioFile(edited, now, WARD_FLOW_STORED_STATE_VERSION, new Date("2026-11-04T00:00:00Z"));
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const loaded = readScenarioFile(built.json, WARD_FLOW_STORED_STATE_VERSION);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const changed = ward
      ? loaded.state.admissions.find((row) => row.id === stay.id)!
      : loaded.state.movements.find((row) => row.id === journey.id)!;
    expect(changed.observationChanges?.at(-1)?.sequence).toBeGreaterThan(0);
    const arrived = apply(loaded.state, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      movementId: journey.id,
      actingUnitId: journey.acceptedUnitId,
    });
    expect(arrived.rejections).toHaveLength(seed.rejections.length);
    expect(arrived.admissions.find((row) => row.id === stay.id)?.observation.level).toBe("two_staff");
  });

  it("import refuses duplicate retained UMRNs without conflating patient IDs", () => {
    const state: WardFlowState = JSON.parse(JSON.stringify(seedWardFlowState()));
    expect(isValidStoredWardFlowState(state)).toBe(true);
    const [first, second] = state.patients;
    expect(first.id).not.toBe(second.id);
    const duplicate = {
      ...state,
      patients: state.patients.map((row) =>
        row.id === second.id ? { ...row, umrn: ` ${first.umrn.toLowerCase()} ` } : row,
      ),
    };
    expect(isValidStoredWardFlowState(duplicate)).toBe(false);
  });

  it("a community-origin pulled movement identifies its handover owner", () => {
    const source = seedWardFlowState().movements.find((row) => row.stage === "pulled")!;
    const { originEdId: _ed, ...rest } = source;
    void _ed;
    const community = {
      ...rest,
      originCommunity: { teamName: "Synthetic community team", siteCode: "RPH" },
    } as typeof source;
    expect(movementNextStep(community)).toMatchObject({ label: "Handover", owner: "Synthetic community team" });
    expect(movementNextStep(source)).toMatchObject({ owner: "ED team" });
  });

  it("intake and agreed-return origin lookups use their fictional scenario network", async () => {
    await loadScenarioNetworks();
    const seed = seedWardFlowState("wa-synthetic");
    const origin = scenarioEmergencyDepartments(seed.scenario)[0];
    const fixture = TYPED_TEXT_FIXTURES.find((row) => row.type === "RECEIVE_REFERRAL")!.build(seed);
    const intake = apply(seed, {
      ...fixture.event,
      role: "ed",
      source: "ed_medical",
      originSiteCode: origin.siteCode,
      destinations: [{ kind: "emergency_department", edId: origin.id, purpose: "medical_assessment" }],
    });
    expect(intake.rejections.at(-1)?.reason ?? "").not.toContain("originSiteCode must resolve");
    expect(intake.rejections).toHaveLength(seed.rejections.length);
    const stay = seed.admissions.find((row) => row.state === "occupied")!;
    const home = scenarioWardNetwork(seed.scenario).sites.find(
      (row) => row.code !== seed.units.find((unit) => unit.id === stay.unitId)?.siteCode,
    )!;
    const plan = apply(seed, {
      type: "RECORD_REPATRIATION",
      role: "coordinator",
      admissionId: stay.id,
      homeHospital: home.code,
      receivingWardAgreed: true,
      mode: "road",
      provider: "Ambulance service",
      cadNumber: "SYN-CAD-NET-1",
      transportLegalStatus: "involuntary",
      estimatedAt: now + 120,
    });
    expect(plan.rejections).toHaveLength(seed.rejections.length);
    expect(scenarioEmergencyDepartments(seed.scenario).some((ed) => ed.id === plan.movements.at(-1)?.originEdId)).toBe(
      true,
    );
  });

  it("released return-bed notices go to the sending ward", () => {
    const seed = seedWardFlowState();
    const movement = seed.movements.find((row) => row.stage === "pulled" && row.transport === undefined)!;
    const sender = seed.admissions.find((row) => row.state === "occupied" && row.unitId !== movement.acceptedUnitId)!;
    const state = {
      ...seed,
      movements: seed.movements.map((row) => (row.id === movement.id ? { ...row, sourceAdmissionId: sender.id } : row)),
    };
    const released = apply(state, {
      type: "RELEASE_PULL",
      role: "coordinator",
      movementId: movement.id,
      reason: "pull_made_in_error",
    });
    expect(released.rejections).toHaveLength(state.rejections.length);
    expect(released.notices.at(-1)).toMatchObject({
      kind: "bed_pull_released",
      to: { role: "ward", placeId: sender.unitId },
    });
    const withdrawn = apply(state, {
      type: "WITHDRAW_ACCEPTANCE",
      role: "coordinator",
      movementId: movement.id,
      reason: STEP_BACK_REASONS[0],
    });
    expect(withdrawn.rejections).toHaveLength(state.rejections.length);
    expect(withdrawn.notices.findLast((row) => row.kind === "bed_pull_released")).toMatchObject({
      to: { role: "ward", placeId: sender.unitId },
    });
  });

  it("a withdrawn agreed return permits a new plan without discarding the old journey", () => {
    const seed = seedWardFlowState();
    const stay = seed.admissions.find((row) => row.state === "occupied" && !row.unitId.startsWith("rph-"))!;
    const plan = {
      type: "RECORD_REPATRIATION",
      role: "coordinator",
      admissionId: stay.id,
      homeHospital: "RPH",
      receivingWardAgreed: true,
      mode: "road",
      provider: "Ambulance service",
      cadNumber: "SYN-CAD-NEW-1",
      transportLegalStatus: "involuntary",
      estimatedAt: now + 120,
    };
    const first = apply(seed, plan);
    expect(first.rejections).toHaveLength(seed.rejections.length);
    const journey = first.movements.at(-1)!;
    const withdrawn = {
      ...first,
      movements: first.movements.map((row) =>
        row.id === journey.id
          ? { ...row, closure: { at: now, outcome: "did_not_proceed" as const, reason: "Synthetic withdrawal" } }
          : row,
      ),
    };
    const second = apply(withdrawn, { ...plan, cadNumber: "SYN-CAD-NEW-2", now: now + 1 });
    expect(second.rejections).toHaveLength(first.rejections.length);
    expect(second.repatriations.filter((row) => row.admissionId === stay.id)).toHaveLength(1);
    expect(second.movements.find((row) => row.id === journey.id)?.closure).toEqual(
      journey.closure ?? { at: now, outcome: "did_not_proceed", reason: "Synthetic withdrawal" },
    );
    expect(second.movements.at(-1)?.id).not.toBe(journey.id);
    const retained = second.repatriations.find((row) => row.admissionId === stay.id)!;
    expect(retained.earlier).toEqual([first.repatriations.find((row) => row.admissionId === stay.id)]);
    const shared = JSON.parse(JSON.stringify(second));
    expect(isValidSharedWardFlowState(shared)).toBe(true);
    const device = JSON.parse(JSON.stringify(second));
    for (const row of device.repatriations) {
      row.cadNumber = TYPED_TEXT_NOT_KEPT;
      for (const prior of row.earlier ?? []) prior.cadNumber = TYPED_TEXT_NOT_KEPT;
    }
    expect(isValidStoredWardFlowState(device)).toBe(true);
    const nested = JSON.parse(JSON.stringify(device));
    nested.repatriations.find((row: { admissionId: string }) => row.admissionId === stay.id).earlier[0].earlier = [];
    expect(isValidStoredWardFlowState(nested)).toBe(false);
    expect(isValidSharedWardFlowState(nested)).toBe(false);
    const refused = apply(second, plan);
    expect(refused.rejections).toHaveLength(second.rejections.length + 1);
  });
});
