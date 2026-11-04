// Out of area "Flag early" (Josh, 3 Nov 2026): the coordinator flags that a person away from home may
// be ready to come home sooner. One engine event, its Undo, and in-app alert rows for three desks.
import { describe, expect, it } from "vitest";

import {
  returnEarlyAlerts,
  returnEarlyFlagOf,
  type ReturnEarlyDesk,
} from "@/components/ward-management/out-of-area/return-early";
import { EVENT_ROLE } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { scopeWardFlowState } from "@/components/ward-management/ward-access-state";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { isValidSharedWardFlowState } from "@/components/ward-management/ward-shared-state-validation";
import { NOW_ANCHOR, siteByCode } from "@/components/ward-management/ward-sites";

const ADMISSION = "AD-RPHS-18";

function flagged(state: WardFlowState = seedWardFlowState(), now = NOW_ANCHOR) {
  return wardFlowReducer(state, {
    type: "FLAG_RETURN_EARLY",
    role: "coordinator",
    now,
    admissionId: ADMISSION,
    homeHospital: "BUN",
  });
}

describe("FLAG_RETURN_EARLY", () => {
  it("is the coordinator's alone, as is its Undo", () => {
    expect(EVENT_ROLE.FLAG_RETURN_EARLY).toEqual(["coordinator"]);
    expect(EVENT_ROLE.UNDO_FLAG_RETURN_EARLY).toEqual(["coordinator"]);
  });

  it("appends one record with the stay, site, time and desk, and nothing else changes", () => {
    const before = seedWardFlowState();
    const state = flagged(before);
    expect(state.returnEarlyFlags).toEqual([
      { admissionId: ADMISSION, homeHospital: "BUN", at: NOW_ANCHOR, by: "coordinator" },
    ]);
    expect(state.movements).toEqual(before.movements);
    expect(state.admissions).toEqual(before.admissions);
    expect(state.notices).toEqual(before.notices);
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(state)))).toBe(true);
    const orphan = { ...state, returnEarlyFlags: [{ ...state.returnEarlyFlags![0]!, admissionId: "AD-NOT-REAL" }] };
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(orphan)))).toBe(false);
  });

  it("refuses the wrong role, and records nothing", () => {
    const state = wardFlowReducer(seedWardFlowState(), {
      type: "FLAG_RETURN_EARLY",
      role: "ward",
      now: NOW_ANCHOR,
      admissionId: ADMISSION,
      homeHospital: "BUN",
    });
    expect(returnEarlyFlagOf(state.returnEarlyFlags, ADMISSION)).toBeUndefined();
    expect(state.rejections[0]?.movementId).toBe(ADMISSION);
  });

  it("refuses an unlisted site, an unknown stay and a second flag on the same stay", () => {
    const base = seedWardFlowState();
    const offList = wardFlowReducer(base, {
      type: "FLAG_RETURN_EARLY",
      role: "coordinator",
      now: NOW_ANCHOR,
      admissionId: ADMISSION,
      homeHospital: "NOWHERE",
    });
    expect(offList.returnEarlyFlags ?? []).toEqual([]);
    const unknown = wardFlowReducer(base, {
      type: "FLAG_RETURN_EARLY",
      role: "coordinator",
      now: NOW_ANCHOR,
      admissionId: "AD-NOT-REAL",
      homeHospital: "BUN",
    });
    expect(unknown.returnEarlyFlags ?? []).toEqual([]);
    const twice = flagged(flagged(), NOW_ANCHOR + 1);
    expect(twice.returnEarlyFlags).toHaveLength(1);
    expect(twice.rejections[0]?.reason).toContain("already flagged early");
  });

  it("is taken back by UNDO_FLAG_RETURN_EARLY within the undo window, and then may be flagged again", () => {
    const state = wardFlowReducer(flagged(), {
      type: "UNDO_FLAG_RETURN_EARLY",
      role: "coordinator",
      now: NOW_ANCHOR + 1,
      admissionId: ADMISSION,
    });
    expect(returnEarlyFlagOf(state.returnEarlyFlags, ADMISSION)).toBeUndefined();
    expect(returnEarlyAlerts(state, { role: "officer" }, NOW_ANCHOR + 1)).toEqual([]);
    expect(returnEarlyFlagOf(flagged(state, NOW_ANCHOR + 2).returnEarlyFlags, ADMISSION)?.at).toBe(NOW_ANCHOR + 2);
  });

  it("refuses an Undo with nothing to take back, and one past the undo window", () => {
    const nothing = wardFlowReducer(seedWardFlowState(), {
      type: "UNDO_FLAG_RETURN_EARLY",
      role: "coordinator",
      now: NOW_ANCHOR,
      admissionId: ADMISSION,
    });
    expect(nothing.rejections[0]?.reason).toContain("no early return flag");
    const late = wardFlowReducer(flagged(), {
      type: "UNDO_FLAG_RETURN_EARLY",
      role: "coordinator",
      now: NOW_ANCHOR + 60,
      admissionId: ADMISSION,
    });
    expect(returnEarlyFlagOf(late.returnEarlyFlags, ADMISSION)).toBeDefined();
  });
});

describe("Flag early alerts — who sees them", () => {
  const state = flagged();
  const admission = state.admissions.find((candidate) => candidate.id === ADMISSION)!;
  const name = resolveSubjectPatient(admission, state).formalName;
  const sentence = `Out of area return flagged early: ${name} may be ready to come home to ${siteByCode("BUN")!.name}.`;

  it.each<[string, ReturnEarlyDesk]>([
    ["the receiving ward at the home hospital", { role: "ward", siteCode: "BUN" }],
    ["the home team", { role: "community" }],
    ["Transport", { role: "officer" }],
  ])("shows one plain row to %s", (_label, desk) => {
    const alerts = returnEarlyAlerts(state, desk, NOW_ANCHOR);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ admissionId: ADMISSION, at: NOW_ANCHOR, sentence });
  });

  it("is not shown to a ward at another hospital, before the flag, or after the person has left", () => {
    expect(returnEarlyAlerts(state, { role: "ward", siteCode: "RPH" }, NOW_ANCHOR)).toEqual([]);
    expect(returnEarlyAlerts(state, { role: "officer" }, NOW_ANCHOR - 1)).toEqual([]);
    const departed = {
      ...state,
      admissions: state.admissions.map((row) => (row.id === ADMISSION ? { ...row, state: "departed" as const } : row)),
    };
    expect(returnEarlyAlerts(departed, { role: "officer" }, NOW_ANCHOR)).toEqual([]);
  });

  it("names no record number and no typed text", () => {
    const [alert] = returnEarlyAlerts(state, { role: "officer" }, NOW_ANCHOR);
    expect(alert!.sentence).not.toContain(ADMISSION);
    expect(alert!.sentence).toMatch(/^Out of area return flagged early: .+ may be ready to come home to .+\.$/);
  });
});

describe("Flag early in shared mode — a desk that cannot see the stay hears it without the name", () => {
  const state = flagged();
  const admission = state.admissions.find((candidate) => candidate.id === ADMISSION)!;
  const name = resolveSubjectPatient(admission, state).formalName;
  const places = wardPlaceLookup(state.units);
  const bunWard = state.units.find((unit) => unit.siteCode === "BUN" && unit.id !== admission.unitId)!;

  it.each<[string, WardAccess, ReturnEarlyDesk]>([
    ["Transport", { role: "officer", scope: { kind: "jobs" } }, { role: "officer" }],
    [
      "a ward at the home hospital",
      { role: "ward", scope: { kind: "ward", unitIds: [bunWard.id] } },
      { role: "ward", siteCode: "BUN" },
    ],
  ])("sends %s a site and a time only, and the alert names nobody", (_label, access, desk) => {
    const scoped = scopeWardFlowState(state, access, { now: NOW_ANCHOR, places }).state;
    expect(scoped.admissions.some((row) => row.id === ADMISSION)).toBe(false);
    expect(scoped.returnEarlyFlags ?? []).toEqual([]);
    expect(scoped.returnEarlyNotices).toHaveLength(1);
    expect(JSON.stringify(scoped.returnEarlyNotices)).not.toContain(ADMISSION);
    expect(isValidSharedWardFlowState(JSON.parse(JSON.stringify(scoped)))).toBe(true);
    const [alert] = returnEarlyAlerts(scoped, desk, NOW_ANCHOR);
    expect(alert!.admissionId).toBeUndefined();
    expect(alert!.sentence).not.toContain(name);
    expect(alert!.sentence).toBe(
      `Out of area return flagged early: a person may be ready to come home to ${siteByCode("BUN")!.name}. Ask the bed coordinator for details.`,
    );
  });

  it("sends nothing to a ward at another hospital, an ED desk or the coordinator", () => {
    const rphWard = state.units.find((unit) => unit.siteCode !== "BUN")!;
    for (const access of [
      { role: "ward", scope: { kind: "ward", unitIds: [rphWard.id] } },
      { role: "ed", scope: { kind: "ed", edId: "fsh-ed" } },
      { role: "coordinator", scope: { kind: "network" } },
    ] as WardAccess[]) {
      const scoped = scopeWardFlowState(state, access, { now: NOW_ANCHOR, places }).state;
      expect(scoped.returnEarlyNotices).toBeUndefined();
    }
  });
});
