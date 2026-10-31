import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { CapacityWardSidebar } from "@/components/ward-management/capacity/capacity-ward-drawer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { networkWardRows } from "@/components/ward-management/capacity/capacity-derivations";
import { GENERAL_OBSERVATION } from "../src/components/ward-management/ward-observation";
const now = 642;
const valid = (state: WardFlowState) =>
  isValidStoredWardFlowState(JSON.parse(JSON.stringify({ ...state, rejections: [] })));
function journey() {
  let state = seedWardFlowState();
  const send = (event: Record<string, unknown>) => {
    state = wardFlowReducer(state, { now, ...event } as WardFlowEvent);
    return state;
  };
  const unitId = "scgh-adult-open";
  send({
    type: "RAISE_REFERRAL",
    role: "ed",
    edId: "jhc-ed",
    draft: {
      cohort: "Adult",
      security: "Open",
      sex: "Female",
      gender: "Female",
      observation: GENERAL_OBSERVATION,
      highAcuity: false,
      legalStatus: "Voluntary",
      urgency: 2,
      legalFormCode: null,
    },
  });
  const movementId = state.movements.at(-1)!.id;
  send({ type: "REFER_TO_UNITS", role: "coordinator", movementId, unitIds: [unitId] });
  send({ type: "ACCEPT_IN_PRINCIPLE", role: "ward", movementId, unitId });
  send({ type: "PULL_PATIENT", role: "ward", movementId, unitId });
  const admissionId = state.movements.at(-1)!.admissionId!;
  expect(admissionId).toBeTruthy();
  expect(state.rejections).toEqual([]);
  expect(valid(state)).toBe(true);
  return {
    get state() {
      return state;
    },
    set state(value: WardFlowState) {
      state = value;
    },
    send,
    unitId,
    movementId,
    admissionId,
    unit() {
      return state.units.find((unit) => unit.id === unitId)!;
    },
    confirm(value: number, extra: Record<string, unknown> = {}) {
      return send({
        type: "CONFIRM_CAPACITY",
        role: "ward",
        unitId,
        actingUnitId: unitId,
        value,
        expectedRevision: this.unit().allocatable.revision ?? 0,
        ...extra,
      });
    },
    release() {
      return send({ type: "RELEASE_PULL", role: "coordinator", movementId, reason: "bed_needed_for_another_patient" });
    },
    deteriorate() {
      return send({ type: "RECORD_ED_MEDICAL_DETERIORATION", role: "ed", movementId, actingPlaceId: "jhc-ed" });
    },
  };
}

describe("reservation release against a newer saturated offered observation", () => {
  it("keeps actual D34 cancellation recoverable without inventing physical vacancy or an arrival", () => {
    const f = journey();
    f.confirm(f.unit().beds);
    expect(valid(f.state)).toBe(true);
    const before = structuredClone(f.unit());
    f.deteriorate();
    expect(f.state.rejections).toEqual([]);
    expect(f.state.admissions.some((a) => a.id === f.admissionId)).toBe(false);
    const movement = f.state.movements.find((m) => m.id === f.movementId)!;
    expect(movement.acceptedUnitId).toBeUndefined();
    expect(movement.medicalDeterioration?.at).toBe(now);
    expect(movement.unwinds.at(-1)?.reason).toBe("Medical Deterioration - ED Resuscitation Required");
    expect(f.unit().allocatable.value).toBe(before.beds);
    expect(f.unit().empty).toEqual(before.empty);
    expect(f.unit().arrivalCapacityConflicts).toBeUndefined();
    expect(f.unit().reservationReleaseCapacityConflicts).toEqual([
      {
        movementId: f.movementId,
        admissionId: f.admissionId,
        at: now,
        allocatableBefore: before.beds,
        allocatableLockedBefore: before.allocatableLocked,
        lockedBedReleased: false,
      },
    ]);
    expect(valid(f.state)).toBe(true);
  });

  it("preserves the ordinary unsaturated inverse release without a disagreement marker", () => {
    const f = journey();
    const before = structuredClone(f.unit());
    f.release();
    expect(f.state.rejections).toEqual([]);
    expect(f.unit().allocatable.value).toBe(before.allocatable.value + 1);
    expect(f.unit().empty).toEqual(before.empty);
    expect(f.unit().reservationReleaseCapacityConflicts).toBeUndefined();
    expect(valid(f.state)).toBe(true);
  });

  it("bounds RELEASE_PULL too and retains its historical observation through a later re-pull", () => {
    const f = journey();
    f.confirm(f.unit().beds);
    f.release();
    expect(f.state.rejections).toEqual([]);
    expect(valid(f.state)).toBe(true);
    const marker = f.unit().reservationReleaseCapacityConflicts;
    expect(marker).toHaveLength(1);
    f.send({ type: "PULL_PATIENT", role: "ward", movementId: f.movementId, unitId: f.unitId });
    expect(f.state.rejections).toEqual([]);
    expect(f.unit().reservationReleaseCapacityConflicts).toEqual(marker);
    expect(valid(f.state)).toBe(true);
  });

  it("bounds separately recorded locked count when releasing a genuine locked reservation", () => {
    const f = journey();
    // Synthetic valid stored state: a known reservation records its bed kind; the separately
    // recorded locked observation already reports its ceiling. No live feed producer is implied.
    f.state = {
      ...f.state,
      units: f.state.units.map((u) => (u.id === f.unitId ? { ...u, lockedBeds: 2, allocatableLocked: 2 } : u)),
      admissions: f.state.admissions.map((a) => (a.id === f.admissionId ? { ...a, bedKind: "locked" } : a)),
    };
    expect(valid(f.state)).toBe(true);
    const before = structuredClone(f.unit());
    f.release();
    expect(f.state.rejections).toEqual([]);
    expect(f.unit().allocatableLocked).toBe(2);
    expect(f.unit().allocatable.value).toBe(before.allocatable.value + 1);
    expect(f.unit().empty).toEqual(before.empty);
    expect(f.unit().reservationReleaseCapacityConflicts?.[0].lockedBedReleased).toBe(true);
    expect(valid(f.state)).toBe(true);
  });

  it("clears the notice only after a successful ward-scoped revision-checked subsequent confirmation", () => {
    const f = journey();
    f.confirm(f.unit().beds);
    f.deteriorate();
    const marker = f.unit().reservationReleaseCapacityConflicts;
    expect(marker).toHaveLength(1);
    const revision = f.unit().allocatable.revision!;
    f.confirm(1, { actingUnitId: "wrong-unit", now: now + 1 });
    expect(f.unit().reservationReleaseCapacityConflicts).toEqual(marker);
    f.confirm(1, { expectedRevision: revision - 1, now: now + 1 });
    expect(f.unit().reservationReleaseCapacityConflicts).toEqual(marker);
    f.confirm(1, { now: now - 1 });
    expect(f.unit().reservationReleaseCapacityConflicts).toEqual(marker);
    f.confirm(1, { now: now + 1 });
    expect(f.unit().reservationReleaseCapacityConflicts).toEqual([]);
    expect(valid(f.state)).toBe(true);
  });

  // Capacity's October 2026 redesign states this disagreement in the ward drawer
  // (`capacity-ward-drawer.tsx`), beside the ward's one-square-per-bed picture.
  it("renders the release disagreement without adding squares or labelling it an arrival", () => {
    const f = journey();
    f.confirm(f.unit().beds);
    f.deteriorate();
    const row = networkWardRows(f.state.units, now, f.state.bedReleases, f.state.admissions, f.state.leaveBeds).find(
      (entry) => entry.unit.id === f.unitId,
    )!;
    expect(row.reservationReleaseCapacityConflicts).toBe(1);
    expect(row.arrivalCapacityConflicts ?? 0).toBe(0);
    // The provider's props require children, so they go in its props object (this is a .ts file).
    const providerProps = {
      initialNow: now,
      children: createElement(CapacityWardSidebar, { row, onBack: () => {}, now }),
    };
    const html = renderToStaticMarkup(createElement(WardFlowProvider, providerProps));
    expect(html).toContain("1 reservation release(s) need capacity re-confirmation");
    expect(html).toContain("No extra physical vacancy is implied");
    expect(html).not.toContain("awaiting capacity reconciliation");
    const beds = /aria-label="Beds now"[\s\S]*?<\/section>/u.exec(html)?.[0] ?? "";
    expect(beds, "the drawer drew no Beds now picture").not.toBe("");
    expect(beds.split("<i ").length - 1).toBe(f.unit().beds);
  });

  it("accepts legacy absence and rejects malformed/forged release observations without relaxing bounds", () => {
    expect(valid(seedWardFlowState())).toBe(true);
    const f = journey();
    f.confirm(f.unit().beds);
    f.deteriorate();
    const marker = f.unit().reservationReleaseCapacityConflicts![0];
    for (const bad of [
      { ...marker, movementId: "unknown" },
      { ...marker, at: NaN },
      { ...marker, admissionId: "" },
      { ...marker, allocatableBefore: f.unit().beds + 1 },
      { ...marker, allocatableBefore: -1 },
      { ...marker, allocatableLockedBefore: f.unit().lockedBeds + 1 },
      { ...marker, lockedBedReleased: "yes" },
      { ...marker, allocatableBefore: 0, lockedBedReleased: false },
    ]) {
      const invalid = {
        ...f.state,
        units: f.state.units.map((u) => (u.id === f.unitId ? { ...u, reservationReleaseCapacityConflicts: [bad] } : u)),
      } as WardFlowState;
      expect(valid(invalid)).toBe(false);
    }
    const duplicate = {
      ...f.state,
      units: f.state.units.map((u) =>
        u.id === f.unitId ? { ...u, reservationReleaseCapacityConflicts: [marker, marker] } : u,
      ),
    };
    expect(valid(duplicate)).toBe(false);
    const excessive = {
      ...f.state,
      units: f.state.units.map((u) =>
        u.id === f.unitId ? { ...u, allocatable: { ...u.allocatable, value: u.beds + 1 } } : u,
      ),
    };
    expect(valid(excessive)).toBe(false);
  });
});
