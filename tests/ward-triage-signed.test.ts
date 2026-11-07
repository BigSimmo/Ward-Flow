// Triage and risk (Josh's approved mock-up, built into the app 7 Nov 2026): signing records one
// event on the person, RECORD_TRIAGE_SIGNED, with closed-list codes and RAMP factor keys only. The
// typed assessment, mental state, formulation and plan never reach the event, the workspace or the
// saved copy. Synthetic data only.
import { describe, expect, it } from "vitest";

import { triagesFor, type TriageSignedEvent } from "@/components/ward-management/triage/triage-record";
import { triageSignedFields } from "@/components/ward-management/triage/triage-risk-state";
import { scopeWardFlowState } from "@/components/ward-management/ward-access-state";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { EVENT_ROLE } from "@/components/ward-management/ward-flow-events";
import {
  WARD_FLOW_TEXT_SAFE_EVENT_TYPES,
  WARD_FLOW_TYPED_TEXT_EVENT_TYPES,
} from "@/components/ward-management/ward-flow-persistence-classification";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { dispatchPermission } from "@/components/ward-management/ward-role-permissions";
import { ROLE_SCREENS, screenDecision, screenForPath } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { exampleTriage } from "./helpers/triage-example";

const seed = seedWardFlowState();
const PATIENT_ID = seed.patients[0]!.id;

function sign(state: WardFlowState, overrides: Partial<TriageSignedEvent> = {}, now = NOW_ANCHOR) {
  return wardFlowReducer(state, {
    type: "RECORD_TRIAGE_SIGNED",
    role: "ward",
    now,
    patientId: PATIENT_ID,
    urgency: "C",
    outcome: "Accepted",
    legal: "cto",
    review: "72h",
    riskFlags: ["violence.now.intent", "violence.bg.prev"],
    ...overrides,
  });
}

describe("RECORD_TRIAGE_SIGNED — who may sign", () => {
  it("is the referral desks' list, never the bed manager, officer, executive or access admin", () => {
    expect(EVENT_ROLE.RECORD_TRIAGE_SIGNED).toEqual(["ed", "community", "ward", "coordinator"]);
    expect(EVENT_ROLE.RECORD_TRIAGE_SIGNED).toEqual(EVENT_ROLE.RAISE_REFERRAL);
    for (const role of ["bed_manager", "officer"] as const)
      expect(dispatchPermission(role, "RECORD_TRIAGE_SIGNED").allowed).toBe(false);
  });

  it("is refused for a role off the list and records nothing", () => {
    const refused = wardFlowReducer(seed, {
      type: "RECORD_TRIAGE_SIGNED",
      role: "bed_manager",
      now: NOW_ANCHOR,
      patientId: PATIENT_ID,
      urgency: "C",
      outcome: "Accepted",
      legal: "cto",
      review: "72h",
      riskFlags: [],
    });
    expect(refused.triages ?? []).toEqual([]);
    expect(refused.rejections.length).toBe(seed.rejections.length + 1);
  });

  it("opens Start a triage and a person's form for the same desks that open the referral intake", () => {
    for (const role of ["ward", "ed", "community"] as const) {
      expect(ROLE_SCREENS[role]["triage-new"]).toBe(ROLE_SCREENS[role]["referral-new"]);
      expect(ROLE_SCREENS[role].triage).toBe("own");
    }
    for (const role of ["bed_manager", "officer", "executive", "admin"] as const) {
      expect(ROLE_SCREENS[role]["triage-new"]).toBeUndefined();
      expect(ROLE_SCREENS[role].triage).toBeUndefined();
    }
    expect(screenForPath("/ward-flow/triage/new")).toEqual({ screen: "triage-new" });
    expect(screenForPath("/ward-flow/people/PT-001/triage")).toEqual({ screen: "triage", patientId: "PT-001" });
    // The form route keeps the person, so the access gate checks the person as on the record.
    const places = wardPlaceLookup(seed.units);
    const officer = { role: "officer", scope: { kind: "jobs" } } as const;
    expect(screenDecision(officer, screenForPath("/ward-flow/triage/new"), places).open).toBe(false);
  });
});

describe("RECORD_TRIAGE_SIGNED — what is recorded", () => {
  it("keeps the person, the time, the desk and the codes, and nothing else", () => {
    const state = sign(seed, { note: "typed assessment text" } as Partial<TriageSignedEvent>);
    expect(state.triages).toEqual([
      {
        patientId: PATIENT_ID,
        at: NOW_ANCHOR,
        by: "ward",
        urgency: "C",
        outcome: "Accepted",
        legal: "cto",
        review: "72h",
        riskFlags: ["violence.now.intent", "violence.bg.prev"],
      },
    ]);
    expect(JSON.stringify(state)).not.toContain("typed assessment text");
  });

  it.each<[string, Partial<TriageSignedEvent>]>([
    ["an unknown person", { patientId: "PT-NOT-REAL" }],
    ["an urgency off A to G", { urgency: "H" as never }],
    ["an outcome off the list", { outcome: "Admit now" as never }],
    ["a legal code off the list", { legal: "Form 5A 28/01/2027" as never }],
    ["a review off the list", { review: "tomorrow" as never }],
    ["a factor off the RAMP list", { riskFlags: ["general.now.notreal"] }],
    ["typed text as a factor", { riskFlags: ["Says he will hurt staff"] }],
  ])("refuses %s and records nothing", (_label, overrides) => {
    const refused = sign(seed, overrides);
    expect(refused.triages ?? []).toEqual([]);
    expect(refused.rejections.length).toBe(seed.rejections.length + 1);
  });

  it("is text safe for the saved copy, and the saved copy with a triage still validates", () => {
    expect(WARD_FLOW_TEXT_SAFE_EVENT_TYPES.has("RECORD_TRIAGE_SIGNED")).toBe(true);
    expect(WARD_FLOW_TYPED_TEXT_EVENT_TYPES.has("RECORD_TRIAGE_SIGNED")).toBe(false);
    const signed = JSON.parse(JSON.stringify(sign(seed)));
    expect(isValidStoredWardFlowState(signed)).toBe(true);
    const withText = { ...signed, triages: [{ ...signed.triages[0], plan: "typed plan" }] };
    expect(isValidStoredWardFlowState(withText)).toBe(false);
    const orphan = { ...signed, triages: [{ ...signed.triages[0], patientId: "PT-NOT-REAL" }] };
    expect(isValidStoredWardFlowState(orphan)).toBe(false);
  });

  it("lists a person's triages newest first", () => {
    const twice = sign(sign(seed), { urgency: "A" }, NOW_ANCHOR + 5);
    expect(triagesFor(twice.triages, PATIENT_ID).map((record) => record.urgency)).toEqual(["A", "C"]);
    expect(triagesFor(twice.triages, "PT-SOMEONE-ELSE")).toEqual([]);
  });
});

describe("the form's signed fields carry no typed text", () => {
  it("are the codes and the factors marked present, never a typed box", () => {
    const state = {
      ...exampleTriage(),
      urgency: "C" as const,
      outcome: "Accepted",
      review: "72h",
      f: { ...exampleTriage().f, "general.now.intox": "u" as const, "suicide.now.idea": "n" as const },
    };
    const fields = triageSignedFields(state)!;
    expect(Object.keys(fields).sort()).toEqual(["legal", "outcome", "patientId", "review", "riskFlags", "urgency"]);
    expect(fields.riskFlags.sort()).toEqual(
      ["general.now.agit", "other.now.leave", "other.now.nonadn", "violence.now.intent"].sort(),
    );
    const sent = JSON.stringify(fields);
    for (const typed of Object.values(state.text).filter((value) => value.trim().length > 3))
      expect(sent).not.toContain(typed.trim().slice(0, 20));
  });

  it("are not ready until urgency, outcome, legal status and review are chosen", () => {
    expect(triageSignedFields(exampleTriage())).toBeNull();
  });
});

describe("shared mode: a triage goes only with a person the desk is sent", () => {
  it("sends the statewide coordinator the record and an officer none", () => {
    const state = sign(seed);
    const places = wardPlaceLookup(state.units);
    const statewide = { role: "coordinator", scope: { kind: "statewide" } } as const;
    const officer = { role: "officer", scope: { kind: "jobs" } } as const;
    expect(scopeWardFlowState(state, statewide, { now: NOW_ANCHOR, places }).state.triages).toHaveLength(1);
    expect(scopeWardFlowState(state, officer, { now: NOW_ANCHOR, places }).state.triages ?? []).toEqual([]);
    expect("triages" in scopeWardFlowState(seed, statewide, { now: NOW_ANCHOR, places }).state).toBe(false);
  });

  it("sends a ward desk the triage only when that ward is sent the person", () => {
    const state = sign(seed);
    const places = wardPlaceLookup(state.units);
    const results = state.units.map(
      (unit) =>
        scopeWardFlowState(
          state,
          { role: "ward", scope: { kind: "ward", unitIds: [unit.id] } },
          { now: NOW_ANCHOR, places },
        ).state,
    );
    const sent = results.filter((scoped) => scoped.patients.some((patient) => patient.id === PATIENT_ID));
    const notSent = results.filter((scoped) => !scoped.patients.some((patient) => patient.id === PATIENT_ID));
    expect(sent.length).toBeGreaterThan(0);
    expect(notSent.length).toBeGreaterThan(0);
    for (const scoped of sent) expect(scoped.triages).toHaveLength(1);
    for (const scoped of notSent) expect(scoped.triages ?? []).toEqual([]);
  });
});
