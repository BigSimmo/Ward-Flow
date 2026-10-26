import { describe, expect, it } from "vitest";
import { scopeWorkspace, type ScopableWorkspace } from "@/components/ward-management/ward-access-scope";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Referral, ReferralAddressing } from "@/components/ward-management/ward-model";
import { bindWardPartialView } from "@/components/ward-management/ward-partial-view-contract";
import { projectWardPartialView } from "@/components/ward-management/ward-partial-view-projector";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { retainSharedSenderReadCollection } from "@/components/ward-management/ward-sender-read-collection";

const seed = seedWardFlowState();
const origin = seed.units[0]!;
const foreign = seed.units.find((unit) => unit.id !== origin.id)!;
const places = wardPlaceLookup(seed.units);
const access: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [origin.id] } };
const context = "a".repeat(64);
const now = 20_000;
const window = CLINICAL_VALUES.wardHandoffWindow.value * 1440;

function sourceFixture(state: "queued" | "declined" = "queued") {
  const original = seed.referrals[0]!;
  const arm: ReferralAddressing = {
    destination: {
      kind: "psychiatric_ward",
      unitId: foreign.id,
      sex: "Female",
      secureBedNeeded: false,
      involuntaryBedNeeded: false,
      highAcuityNursingNeeded: false,
    },
    state,
    ...(state === "declined" ? { decidedAt: now, declineReason: "belongs_to_another_service" as const } : {}),
  };
  const referral: Referral = {
    ...original,
    id: "RF-SYNTHETIC-OLD-SENDER",
    source: "psychiatric_ward",
    originUnitId: origin.id,
    originSiteCode: origin.siteCode,
    raisedAt: now - window - 1,
    destinations: [arm],
  };
  const full: ScopableWorkspace = {
    units: seed.units,
    referrals: [referral],
    patients: seed.patients.filter((patient) => patient.id === referral.patientId),
    movements: [],
    admissions: [],
    notices: [],
  };
  const source = scopeWorkspace(full, access, { now, places });
  const view = projectWardPartialView(full, access, { now, places });
  const bound = bindWardPartialView(
    { revision: 7, accessContext: context, view },
    { revision: 7, accessContext: context },
  );
  expect(bound).not.toBeNull();
  const snapshot = {
    revision: 7,
    accessContext: context,
    payload: { state: { referrals: source.referrals, patients: source.patients } },
  };
  return { full, source, snapshot, bound: bound!, options: { now, places } };
}

describe("already server-supplied sender read collection", () => {
  it.each(["queued", "declined"] as const)(
    "keeps an old %s sender referral and its patient through a second UI scope pass",
    (state) => {
      const fixture = sourceFixture(state);
      const scoped = scopeWorkspace(fixture.source, access, fixture.options);
      expect(fixture.source.referrals).toHaveLength(1);
      expect(fixture.source.referrals[0]!.destinations).toEqual([]);
      expect(scoped.referrals).toHaveLength(0);
      const before = JSON.stringify(fixture.source);
      const result = retainSharedSenderReadCollection({
        ...fixture,
        scoped,
        actualAccess: access,
        effectiveAccess: access,
        ready: true,
        now,
      });
      expect(result.referrals).toEqual(fixture.source.referrals);
      expect(result.patients).toEqual(fixture.source.patients);
      expect(result.referrals[0]).toBe(fixture.source.referrals[0]);
      expect(result.referrals[0]).not.toHaveProperty("visibleUntil");
      expect(JSON.stringify(fixture.source)).toBe(before);
    },
  );

  it("retains the inclusive sender deadline then expires on the moving world clock without another payload", () => {
    const fixture = sourceFixture("declined");
    for (const [clock, expected] of [
      [now + window, 1],
      [now + window + 1, 0],
    ] as const) {
      const scoped = scopeWorkspace(fixture.source, access, { ...fixture.options, now: clock });
      const result = retainSharedSenderReadCollection({
        ...fixture,
        scoped,
        actualAccess: access,
        effectiveAccess: access,
        ready: true,
        now: clock,
      });
      expect(result.referrals).toHaveLength(expected);
    }
  });

  it.each([
    { ready: false },
    { actualAccess: null },
    { effectiveAccess: { role: "ward", scope: { kind: "ward", unitIds: [foreign.id] } } as WardAccess },
    { actualAccess: { role: "coordinator", scope: { kind: "statewide" } } as WardAccess },
    { bound: null },
    { now: NaN },
  ])("never restores rows from an unavailable, previewed or mismatched source: %j", (change) => {
    const fixture = sourceFixture();
    const scoped = scopeWorkspace(fixture.source, access, fixture.options);
    const result = retainSharedSenderReadCollection({
      ...fixture,
      scoped,
      actualAccess: access,
      effectiveAccess: access,
      ready: true,
      now,
      ...change,
    });
    expect(result.referrals).toBe(scoped.referrals);
    expect(result.patients).toBe(scoped.patients);
  });

  it("requires the actual snapshot arrays, revision and access lifetime rather than self-asserted metadata", () => {
    const fixture = sourceFixture();
    const scoped = scopeWorkspace(fixture.source, access, fixture.options);
    for (const snapshot of [
      { ...fixture.snapshot, revision: 8 },
      { ...fixture.snapshot, accessContext: "b".repeat(64) },
      {
        ...fixture.snapshot,
        payload: { state: { ...fixture.snapshot.payload.state, referrals: [...fixture.source.referrals] } },
      },
    ]) {
      expect(
        retainSharedSenderReadCollection({
          ...fixture,
          scoped,
          snapshot,
          actualAccess: access,
          effectiveAccess: access,
          ready: true,
          now,
        }).referrals,
      ).toBe(scoped.referrals);
    }
  });

  it("does not turn grant-only markers into own-sender data or manufacture missing records", () => {
    const fixture = sourceFixture();
    const scoped = scopeWorkspace(fixture.source, access, fixture.options);
    const restricted = {
      ...fixture.bound,
      view: {
        ...fixture.bound.view,
        referrals: [
          { id: fixture.source.referrals[0]!.id, kind: "restricted" as const, restriction: "grant" as const },
        ],
      },
    };
    expect(
      retainSharedSenderReadCollection({
        ...fixture,
        bound: restricted,
        scoped,
        actualAccess: access,
        effectiveAccess: access,
        ready: true,
        now,
      }).referrals,
    ).toBe(scoped.referrals);
    const absent = {
      ...fixture.bound,
      view: {
        ...fixture.bound.view,
        referrals: fixture.bound.view.referrals.map((row) => ({ ...row, id: "RF-SYNTHETIC-ABSENT" })),
      },
    };
    expect(
      retainSharedSenderReadCollection({
        ...fixture,
        bound: absent,
        scoped,
        actualAccess: access,
        effectiveAccess: access,
        ready: true,
        now,
      }).referrals,
    ).toBe(scoped.referrals);
  });

  it("keeps an own sender's existing UI read classification when a grant also covers the same person", () => {
    const fixture = sourceFixture();
    const patientId = fixture.source.referrals[0]!.patientId!;
    const scoped = scopeWorkspace(fixture.source, access, {
      ...fixture.options,
      grants: [{ patientId, until: now + 10 }],
    });
    expect(scoped.breakGlassPatientIds.has(patientId)).toBe(true);
    const result = retainSharedSenderReadCollection({
      ...fixture,
      scoped,
      actualAccess: access,
      effectiveAccess: access,
      ready: true,
      now,
    });
    expect(result.breakGlassPatientIds.has(patientId)).toBe(false);
    expect(scoped.breakGlassPatientIds.has(patientId)).toBe(true);
  });
});
