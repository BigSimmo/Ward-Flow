import { validSharedCommand } from "../backend/ward-flow/command-schemas";
import { describe, expect, it, vi } from "vitest";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import {
  unitHasCldReadyDeparture,
  unitTurnaroundSource,
  liveTurnaroundPreference,
} from "@/components/ward-management/ward-turnaround-priority";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { eventCarriesTypedTextPayload } from "@/components/ward-management/ward-flow-persistence-classification";

const now = NOW_ANCHOR;
function fixture() {
  const state = seedWardFlowState();
  const admission = state.admissions.find((a) => a.state === "occupied" && a.patientId !== null)!;
  state.admissions = [
    { ...admission, dischargeCriteria: { setAt: now, items: [{ criterion: "Accommodation confirmed", metAt: now }] } },
  ];
  state.patients = state.patients.map((p) => (p.id === admission.patientId ? { ...p, legalStatus: "Voluntary" } : p));
  state.movements = state.movements.filter(
    (m) => m.admissionId !== admission.id && m.patientId !== admission.patientId,
  );
  state.bedReleases = [];
  const movement = state.movements.find((m) => !m.closure && m.stage !== "arrived" && !m.acceptedUnitId)!;
  const referral = state.referrals.find(
    (r) => r.destinations.some((d) => d.state === "queued") && !state.movements.some((m) => m.referralId === r.id),
  )!;
  return { state, admission: state.admissions[0]!, movement, referral, unitId: admission.unitId };
}
function flag(f: ReturnType<typeof fixture>, kind: "movement" | "referral", extra: Record<string, unknown> = {}) {
  return {
    type: kind === "movement" ? "FLAG_MOVEMENT_TURNAROUND_PRIORITY" : "FLAG_REFERRAL_TURNAROUND_PRIORITY",
    role: "coordinator",
    now,
    unitId: f.unitId,
    ...(kind === "movement" ? { movementId: f.movement.id } : { referralId: f.referral.id }),
    ...extra,
  } as WardFlowEvent;
}
function refused(before: WardFlowState, after: WardFlowState) {
  expect(after.rejections.length).toBe(before.rejections.length + 1);
}

describe("CLD turnaround preference", () => {
  it("uses only current, occupied, legally eligible all-met criteria", () => {
    const f = fixture();
    expect(unitHasCldReadyDeparture(f.state, f.unitId, now)).toBe(true);
    expect(unitHasCldReadyDeparture(f.state, "unknown", now)).toBe(false);
    expect(unitHasCldReadyDeparture(f.state, f.unitId, now + CLINICAL_VALUES.dischargeCriteriaValidity.value)).toBe(
      false,
    );
    expect(unitTurnaroundSource(f.state, f.unitId, now, false)).toBe(null);
    expect(unitTurnaroundSource(f.state, f.unitId, now, true)).toBe("cld");
  });
  it.each(["Involuntary inpatient", "Community treatment order", "Not recorded"])(
    "excludes legal status %s",
    (legalStatus) => {
      const f = fixture();
      f.state.patients = f.state.patients.map((p) => (p.id === f.admission.patientId ? { ...p, legalStatus } : p));
      expect(unitHasCldReadyDeparture(f.state, f.unitId, now)).toBe(false);
    },
  );
  it.each(["partial", "empty", "departed", "waitlisted"])("excludes %s admissions", (kind) => {
    const f = fixture();
    if (kind === "partial") f.admission.dischargeCriteria!.items[0]!.metAt = null;
    else if (kind === "empty") f.admission.dischargeCriteria!.items = [];
    else f.admission.state = kind as "departed" | "waitlisted";
    expect(unitHasCldReadyDeparture(f.state, f.unitId, now)).toBe(false);
  });
  it.each(["movement", "referral"] as const)(
    "records a %s preference without allocating, changing urgency or booking",
    (kind) => {
      const f = fixture();
      const next = wardFlowReducer(f.state, flag(f, kind));
      expect(next.rejections).toEqual(f.state.rejections);
      const row =
        kind === "movement"
          ? next.movements.find((m) => m.id === f.movement.id)!
          : next.referrals.find((r) => r.id === f.referral.id)!;
      expect(row.turnaroundPriority).toEqual({ unitId: f.unitId, flaggedAt: now, source: "cld" });
      expect(kind === "movement" ? next.movements : next.referrals).toEqual(
        (kind === "movement" ? f.state.movements : f.state.referrals).map((record) =>
          record.id === row.id ? { ...record, turnaroundPriority: row.turnaroundPriority } : record,
        ),
      );
      expect(next.units).toBe(f.state.units);
      expect(next.admissions).toBe(f.state.admissions);
      expect(
        next.movements.map((m) => ({ urgency: m.urgency, acceptedUnitId: m.acceptedUnitId, stage: m.stage })),
      ).toEqual(
        f.state.movements.map((m) => ({ urgency: m.urgency, acceptedUnitId: m.acceptedUnitId, stage: m.stage })),
      );
      expect(eventCarriesTypedTextPayload(flag(f, kind))).toBe(false);
      refused(next, wardFlowReducer(next, flag(f, kind)));
    },
  );
  it("accepts an unblocked confirmed unreleased departure but never an expected date", () => {
    const f = fixture();
    f.admission.dischargeCriteria = null;
    const release = {
      ...seedWardFlowState().bedReleases[0]!,
      unitId: f.unitId,
      admissionId: f.admission.id,
      state: "expected" as const,
      blocker: null,
    };
    f.state.bedReleases = [release];
    expect(unitTurnaroundSource(f.state, f.unitId, now)).toBe(null);
    release.state = "confirmed" as "expected";
    expect(unitTurnaroundSource(f.state, f.unitId, now)).toBe("departure");
    const next = wardFlowReducer(f.state, flag(f, "movement"));
    expect(next.movements.find((m) => m.id === f.movement.id)!.turnaroundPriority?.source).toBe("departure");
    release.blocker = "Awaiting transport" as never;
    expect(unitTurnaroundSource(f.state, f.unitId, now)).toBe(null);
    release.blocker = null;
    release.state = "discharged" as "expected";
    expect(unitTurnaroundSource(f.state, f.unitId, now)).toBe(null);
  });
  it("refuses stale readiness, unknown IDs and unauthorised callers", () => {
    const f = fixture();
    for (const extra of [
      { now: now + CLINICAL_VALUES.dischargeCriteriaValidity.value },
      { unitId: "unknown" },
      { movementId: "unknown" },
      { role: "ward" },
    ])
      refused(f.state, wardFlowReducer(f.state, flag(f, "movement", extra)));
    refused(f.state, wardFlowReducer(f.state, flag(f, "referral", { referralId: "unknown" })));
  });
  it("refuses closed movements, settled referrals and referrals already linked to a movement", () => {
    const f = fixture();
    f.movement.closure = { at: now, outcome: "cancelled", reason: "synthetic test" } as never;
    refused(f.state, wardFlowReducer(f.state, flag(f, "movement")));
    f.referral.destinations = f.referral.destinations.map((d) => ({ ...d, state: "declined" }));
    refused(f.state, wardFlowReducer(f.state, flag(f, "referral")));
    f.referral.destinations = f.referral.destinations.map((d) => ({ ...d, state: "queued" }));
    f.movement.referralId = f.referral.id;
    refused(f.state, wardFlowReducer(f.state, flag(f, "referral")));
  });
  it("hides a preference when its original source no longer qualifies", () => {
    const f = fixture();
    const preference = { unitId: f.unitId, flaggedAt: now, source: "cld" as const };
    expect(liveTurnaroundPreference(f.state, preference, now, true)).toEqual(preference);
    expect(
      liveTurnaroundPreference(f.state, preference, now + CLINICAL_VALUES.dischargeCriteriaValidity.value, true),
    ).toBe(null);
    expect(liveTurnaroundPreference(f.state, preference, now, false)).toBe(null);
  });
  it("preserves the preference when an ED raises a movement from the waiting referral", () => {
    const f = fixture();
    const edId = allEmergencyDepartments()[0]!.id;
    f.referral.destinations = [
      { destination: { kind: "emergency_department", edId, purpose: "bed" }, state: "queued" },
    ];
    const flagged = wardFlowReducer(f.state, flag(f, "referral"));
    const next = wardFlowReducer(flagged, {
      type: "RAISE_REFERRAL",
      role: "ed",
      now,
      edId,
      referralId: f.referral.id,
      draft: {
        cohort: "Adult",
        security: "Open",
        sex: "Female",
        specialling: false,
        highAcuity: false,
        legalStatus: "Voluntary",
        urgency: 2,
        legalFormCode: null,
      },
    });
    expect(next.rejections).toEqual(flagged.rejections);
    const created = next.movements.find((m) => !flagged.movements.some((before) => before.id === m.id))!;
    expect(created.turnaroundPriority).toEqual({ unitId: f.unitId, flaggedAt: now, source: "cld" });
    expect(next.units).toBe(f.state.units);
    expect(next.admissions).toBe(f.state.admissions);
  });
  it("honours the server CLD flag in the reducer", () => {
    const f = fixture();
    vi.stubEnv("NEXT_PUBLIC_WARD_FLAGS", "top25-criteria-led-discharge=off");
    try {
      refused(f.state, wardFlowReducer(f.state, flag(f, "movement")));
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it.each(["movement", "referral"] as const)(
    "validates %s shared preference command fields before reducer entry",
    (kind) => {
      const f = fixture();
      const event = flag(f, kind);
      expect(validSharedCommand(event)).toBe(true);
      for (const extra of [
        { unitId: "" },
        { unitId: 12 },
        { now: "bad" },
        { now: Infinity },
        { role: "ed" },
        kind === "movement" ? { movementId: "" } : { referralId: "" },
      ])
        expect(validSharedCommand({ ...event, ...extra })).toBe(false);
    },
  );
  it("restores valid fixed preferences on movements and referrals", () => {
    const state = seedWardFlowState();
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(state)))).toBe(true);
    const preference = { unitId: state.units[0]!.id, flaggedAt: now, source: "departure" as const };
    state.movements[0]!.turnaroundPriority = preference;
    state.referrals[0]!.turnaroundPriority = preference;
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(state)))).toBe(true);
  });
  it("validates restored preference enums, times, keys and unit links", () => {
    for (const preference of [
      { unitId: "unknown", flaggedAt: now, source: "cld" },
      { unitId: "rph-adult-secure", flaggedAt: now, source: "invented" },
      { unitId: "rph-adult-secure", flaggedAt: now, source: "cld", note: "typed" },
      { unitId: "rph-adult-secure", flaggedAt: Infinity, source: "cld" },
    ]) {
      const state = seedWardFlowState();
      state.movements[0]!.turnaroundPriority = preference as never;
      expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(state)))).toBe(false);
    }
  });
});
