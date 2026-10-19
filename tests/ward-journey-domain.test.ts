import { describe, expect, it } from "vitest";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { defaultWardConfiguration, mergeConfiguration } from "@/components/ward-management/ward-configuration";
import { scopeWardFlowState, commandScopeRefusal } from "@/components/ward-management/ward-access-state";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { allEmergencyDepartments, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { communityTeamOptions } from "@/components/ward-management/referrals/referral-destination-options";
import { patientRegistrationScope } from "@/components/ward-management/ward-patient-registration";
import { COMMUNITY_TEAMS } from "@/components/ward-management/ward-teams";
import {
  readOpenedDischargeRecord,
  newDischargeRequestNamespace,
  validDischargeRequestNamespace,
} from "@/components/ward-management/ward-discharge-records";
import { isValidSharedWardFlowState } from "@/components/ward-management/ward-shared-state-validation";
import { validSharedCommand } from "../backend/ward-flow/command-schemas";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { WardAccess } from "@/components/ward-management/ward-role-access";

const register = (access: WardAccess): Extract<WardFlowEvent, { type: "ADD_PATIENT" }> => ({
  type: "ADD_PATIENT",
  role: access.role === "ward" ? "community" : (access.role as "ed" | "community" | "coordinator"),
  now: NOW_ANCHOR,
  umrn: "TEST-REGISTRATION-UNIQUE",
  givenName: "Synthetic",
  familyName: "Registration",
  dateOfBirth: "2000-01-01",
  registrationScope: patientRegistrationScope(access.scope),
});

describe("journey domain integrity", () => {
  it("merges independent settings changes and refuses genuine conflicts atomically", () => {
    const state = seedWardFlowState();
    const base = state.configuration;
    const first = wardFlowReducer(state, {
      type: "SET_CONFIGURATION",
      role: "coordinator",
      now: NOW_ANCHOR,
      payload: { ...base, pullHoldMinutes: 120 },
      baseConfiguration: base,
    });
    const second = wardFlowReducer(first, {
      type: "SET_CONFIGURATION",
      role: "coordinator",
      now: NOW_ANCHOR,
      payload: { ...base, parallelReferralCap: 2 },
      baseConfiguration: base,
    });
    expect(second.configuration).toMatchObject({ pullHoldMinutes: 120, parallelReferralCap: 2 });
    const conflict = wardFlowReducer(first, {
      type: "SET_CONFIGURATION",
      role: "coordinator",
      now: NOW_ANCHOR,
      payload: { ...base, pullHoldMinutes: 180 },
      baseConfiguration: base,
    });
    expect(conflict.configuration).toEqual(first.configuration);
    expect(conflict.rejections.length).toBe(first.rejections.length + 1);
    expect(mergeConfiguration(first.configuration, { ...base, pullHoldMinutes: 120 }, base).status).toBe("merged");
    expect(
      validSharedCommand({ type: "SET_CONFIGURATION", role: "coordinator", payload: base, baseConfiguration: base }),
    ).toBe(true);
  });

  it("refuses a restore of defaults when another desk changed a field that was already at its default", () => {
    const defaults = defaultWardConfiguration();
    const opened = wardFlowReducer(seedWardFlowState(), {
      type: "SET_CONFIGURATION",
      role: "coordinator",
      now: NOW_ANCHOR,
      payload: { ...defaults, pullHoldMinutes: 120 },
      baseConfiguration: defaults,
    });
    const base = opened.configuration;
    const reset = {
      type: "SET_CONFIGURATION",
      role: "coordinator",
      now: NOW_ANCHOR,
      payload: defaults,
      replaceAll: true,
    } as const;
    expect(wardFlowReducer(opened, { ...reset, baseConfiguration: base }).configuration).toEqual(defaults);
    const otherDesk = wardFlowReducer(opened, {
      type: "SET_CONFIGURATION",
      role: "coordinator",
      now: NOW_ANCHOR,
      payload: { ...base, parallelReferralCap: defaults.parallelReferralCap - 1 },
      baseConfiguration: base,
    });
    expect(otherDesk.configuration.parallelReferralCap).toBe(defaults.parallelReferralCap - 1);
    const refused = wardFlowReducer(otherDesk, { ...reset, baseConfiguration: base });
    expect(refused.configuration).toEqual(otherDesk.configuration);
    expect(refused.rejections.length).toBe(otherDesk.rejections.length + 1);
    // An ordinary save of the same values still keeps the other desk's change.
    expect(mergeConfiguration(otherDesk.configuration, defaults, base).status).toBe("merged");
    expect(mergeConfiguration(otherDesk.configuration, defaults, base, true)).toEqual({
      status: "conflict",
      fields: ["parallelReferralCap"],
    });
  });

  it("preserves legacy configuration commands and validates cross-field merged results", () => {
    const state = seedWardFlowState();
    const changed = { ...state.configuration, parallelReferralCap: 2 };
    expect(
      wardFlowReducer(state, { type: "SET_CONFIGURATION", role: "coordinator", now: NOW_ANCHOR, payload: changed })
        .configuration,
    ).toEqual(changed);
    expect(mergeConfiguration(state.configuration, changed, { invalid: true })).toEqual({ status: "invalid" });
    expect(
      mergeConfiguration(
        { ...state.configuration, dueSoonUrgentMinutes: 90 },
        { ...state.configuration, dueSoonMinutes: 90 },
        state.configuration,
      ),
    ).toEqual({ status: "invalid" });
  });

  it.each(["ed", "community", "ward"] as const)(
    "keeps a registered patient at the creating %s desk without exposing it elsewhere",
    (role) => {
      const state = seedWardFlowState();
      const eds = allEmergencyDepartments();
      const teams = communityTeamOptions();
      const access: WardAccess =
        role === "ed"
          ? { role, scope: { kind: "ed", edId: eds[0].id } }
          : role === "community"
            ? { role, scope: { kind: "team", teamName: teams[0] } }
            : { role, scope: { kind: "ward", unitIds: [state.units[0].id] } };
      const other: WardAccess =
        role === "ed"
          ? { role, scope: { kind: "ed", edId: eds[1].id } }
          : role === "community"
            ? { role, scope: { kind: "team", teamName: teams[1] } }
            : { role, scope: { kind: "ward", unitIds: [state.units[1].id] } };
      const options = { now: NOW_ANCHOR, places: wardPlaceLookup(state.units) };
      const event = register(access);
      expect(commandScopeRefusal(state, access, event, options)).toBeNull();
      expect(commandScopeRefusal(state, other, event, options)).not.toBeNull();
      const next = wardFlowReducer(state, event);
      expect(next.rejections).toEqual(state.rejections);
      const patient = next.patients.at(-1)!;
      expect(scopeWardFlowState(next, access, options).state.patients.some((p) => p.id === patient.id)).toBe(true);
      expect(scopeWardFlowState(next, other, options).state.patients.some((p) => p.id === patient.id)).toBe(false);
      expect(validSharedCommand(event)).toBe(true);
      expect(isValidSharedWardFlowState(JSON.parse(JSON.stringify({ ...next, rejections: [] })))).toBe(true);
    },
  );

  it("uses the normal care scope after registration is linked", () => {
    const state = seedWardFlowState();
    const eds = allEmergencyDepartments();
    const access: WardAccess = { role: "ed", scope: { kind: "ed", edId: eds[0].id } };
    const next = wardFlowReducer(state, register(access));
    const patient = next.patients.at(-1)!;
    const otherAdmission = next.admissions.find((a) => a.patientId !== null)!;
    next.admissions = next.admissions.map((a) => (a.id === otherAdmission.id ? { ...a, patientId: patient.id } : a));
    expect(
      scopeWardFlowState(next, access, { now: NOW_ANCHOR, places: wardPlaceLookup(next.units) }).state.patients.some(
        (p) => p.id === patient.id,
      ),
    ).toBe(false);
  });

  it("correlates accepted referrals across JSON and refuses duplicate or malformed submission tokens", () => {
    const token = "11111111-1111-4111-8111-111111111111";
    const event: Extract<WardFlowEvent, { type: "RECEIVE_REFERRAL" }> = {
      type: "RECEIVE_REFERRAL",
      role: "community",
      now: NOW_ANCHOR,
      submissionId: token,
      ageBand: "Adult",
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Perth" },
      source: "community",
      urgency: 2,
      originSiteCode: "SCGH",
      transportNeeded: false,
      history: "Synthetic example",
      destinations: [
        {
          kind: "psychiatric_ward",
          unitId: "scgh-adult-open",
          sex: "Female",
          gender: "Female",
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
      ],
    };
    const next = wardFlowReducer(seedWardFlowState(), event);
    expect(next.rejections).toHaveLength(0);
    expect(JSON.parse(JSON.stringify(next)).referrals.at(-1).submissionId).toBe(token);
    const duplicate = wardFlowReducer(next, event);
    expect(duplicate.referrals).toHaveLength(next.referrals.length);
    expect(duplicate.rejections).toHaveLength(1);
    expect(validSharedCommand(event)).toBe(true);
    expect(validSharedCommand({ ...event, submissionId: "typed text" })).toBe(false);
    expect(wardFlowReducer(next, { ...event, submissionId: "typed text" }).referrals).toHaveLength(
      next.referrals.length,
    );
  });

  it("lets a built-in regional community desk register and see its patient, matching team names by key", () => {
    const state = seedWardFlowState();
    const access: WardAccess = { role: "community", scope: { kind: "team", teamName: COMMUNITY_TEAMS.Peel } };
    const respelt: WardAccess = {
      role: "community",
      scope: { kind: "team", teamName: COMMUNITY_TEAMS.Peel.toUpperCase() },
    };
    const other: WardAccess = { role: "community", scope: { kind: "team", teamName: COMMUNITY_TEAMS.Kimberley } };
    const options = { now: NOW_ANCHOR, places: wardPlaceLookup(state.units) };
    const event = register(access);
    expect(commandScopeRefusal(state, access, event, options)).toBeNull();
    const next = wardFlowReducer(state, event);
    expect(next.rejections).toEqual(state.rejections);
    const patient = next.patients.at(-1)!;
    expect(scopeWardFlowState(next, access, options).state.patients.some((p) => p.id === patient.id)).toBe(true);
    expect(scopeWardFlowState(next, respelt, options).state.patients.some((p) => p.id === patient.id)).toBe(true);
    expect(scopeWardFlowState(next, other, options).state.patients.some((p) => p.id === patient.id)).toBe(false);
    expect(isValidSharedWardFlowState(JSON.parse(JSON.stringify({ ...next, rejections: [] })))).toBe(true);
    const unknown = wardFlowReducer(state, { ...event, registrationScope: { kind: "team", placeId: "Invented team" } });
    expect(unknown.patients).toEqual(state.patients);
  });

  it("does not reveal legacy orphan patients or invent a multiward source", () => {
    const state = seedWardFlowState();
    const ed = allEmergencyDepartments()[0];
    const access: WardAccess = { role: "ed", scope: { kind: "ed", edId: ed.id } };
    const event = register(access);
    delete event.registrationScope;
    const next = wardFlowReducer(state, event);
    expect(
      scopeWardFlowState(next, access, { now: NOW_ANCHOR, places: wardPlaceLookup(state.units) }).state.patients.some(
        (p) => p.id === next.patients.at(-1)!.id,
      ),
    ).toBe(false);
    expect(patientRegistrationScope({ kind: "ward", unitIds: ["one", "two"] })).toBeUndefined();
    const invalid = wardFlowReducer(state, {
      ...register(access),
      registrationScope: { kind: "ed", placeId: "absent" },
    });
    expect(invalid.patients).toEqual(state.patients);
  });

  it("permits independent discharge opens with the same local numeric id while preserving actor and subject checks", () => {
    let state = seedWardFlowState();
    const first = state.admissions.find((a) => a.patientId !== null && a.state === "occupied")!;
    const second = state.admissions.find(
      (a) => a.patientId !== null && a.state === "occupied" && a.unitId !== first.unitId,
    )!;
    first.expectedDischargeAt = NOW_ANCHOR + 30;
    second.expectedDischargeAt = NOW_ANCHOR + 30;
    const actor = { role: "ward", actingUnitId: first.unitId } as const;
    const other = { role: "ward", actingUnitId: second.unitId } as const;
    const namespaces = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
    for (const [index, [admission, desk]] of (
      [
        [first, actor],
        [second, other],
      ] as const
    ).entries()) {
      state = wardFlowReducer(state, {
        type: "OPEN_DISCHARGE_RECORD",
        ...desk,
        now: NOW_ANCHOR,
        admissionId: admission.id,
        requestId: 0,
        requestNamespace: namespaces[index],
        expectedGeneration: state.worldGeneration,
      });
      expect(state.rejections).toEqual([]);
    }
    const handle = { generation: state.worldGeneration, requestId: 0, requestNamespace: namespaces[0] };
    expect(readOpenedDischargeRecord(state, actor, first.id, handle).status).toBe("allowed");
    expect(
      readOpenedDischargeRecord(state, other, second.id, { ...handle, requestNamespace: namespaces[1] }).status,
    ).toBe("allowed");
    expect(readOpenedDischargeRecord(state, actor, second.id, handle).status).toBe("denied");
    const replay = wardFlowReducer(state, {
      type: "OPEN_DISCHARGE_RECORD",
      ...other,
      now: NOW_ANCHOR,
      admissionId: second.id,
      requestId: 0,
      requestNamespace: namespaces[0],
      expectedGeneration: state.worldGeneration,
    });
    expect(replay.auditEvents.at(-1)?.outcome).toBe("denied");
    expect(state.auditEvents.filter((e) => e.category === "record-access")).toHaveLength(2);
  });
});

it("allocates distinct receipt namespaces without randomUUID on local HTTP", () => {
  const original = crypto.randomUUID;
  try {
    Object.defineProperty(crypto, "randomUUID", { configurable: true, value: undefined });
    const first = newDischargeRequestNamespace();
    expect(validDischargeRequestNamespace(first)).toBe(true);
    expect(newDischargeRequestNamespace()).not.toBe(first);
  } finally {
    Object.defineProperty(crypto, "randomUUID", { configurable: true, value: original });
  }
});
