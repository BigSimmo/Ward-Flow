import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { transportPendingFor, waitingForTransport } from "@/components/ward-management/ward-left-ward";
import { boundedBedAvailability } from "@/components/ward-management/ward-ready-beds";
import { selectDischargeRecords } from "@/components/ward-management/ward-discharge-records";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { recordGoingTo } from "@/components/ward-management/discharges/discharge-board-model";

/*
 * Item 18, "Left the ward, waiting for transport". The ward records the ordinary departure with
 * `awaitingTransport`, so the bed frees once (Ready at once, no "Being made ready"), and the person
 * stays on the ward's Waiting for transport list until MARK_TRANSPORT_COLLECTED.
 */
const now = NOW_ANCHOR;
const seed = seedWardFlowState();
/** A save as browser storage holds it (undefined fields dropped), the shape restoration reads. */
const saved = (state: WardFlowState) => JSON.parse(JSON.stringify(state)) as WardFlowState;
/** The bed figures alone; a resource revision rises on every write, Undo included. */
const figures = (state: WardFlowState, unitId: string) => {
  const unit = unitOf(state, unitId);
  return { empty: unit.empty.value, allocatable: unit.allocatable.value, ...boundedBedAvailability(unit) };
};

/** An occupied, unlinked stay whose discharge waits on transport and can leave on RECORD_LEAVING. */
function leaver(state: WardFlowState) {
  const found = state.admissions.find((admission) => {
    if (!transportPendingFor(admission, state.bedReleases)) return false;
    const next = wardFlowReducer(state, leave(admission.id, admission.unitId));
    return next.rejections.length === state.rejections.length;
  });
  if (!found) throw new Error("the seed has no discharge waiting on transport that can leave");
  return found;
}

function leave(
  admissionId: string,
  actingUnitId: string,
  role: WardFlowEvent["role"] = "ward",
): Extract<WardFlowEvent, { type: "RECORD_LEAVING" }> {
  return {
    type: "RECORD_LEAVING",
    role,
    now,
    admissionId,
    actingUnitId,
    leavingDestination: "discharged-to-the-community",
    awaitingTransport: true,
  };
}

function collect(admissionId: string, actingUnitId: string, role: WardFlowEvent["role"] = "ward"): WardFlowEvent {
  return { type: "MARK_TRANSPORT_COLLECTED", role, now: now + 30, admissionId, actingUnitId };
}

const unitOf = (state: WardFlowState, unitId: string) => state.units.find((unit) => unit.id === unitId)!;
const stayOf = (state: WardFlowState, id: string) => state.admissions.find((admission) => admission.id === id)!;

describe("Left the ward, waiting for transport (item 18)", () => {
  const person = leaver(seed);
  const left = wardFlowReducer(seed, leave(person.id, person.unitId));

  it("the seed already lists one person waiting for transport, for screenshots", () => {
    expect(waitingForTransport(seed.admissions)).toHaveLength(1);
    expect(isValidStoredWardFlowState(saved(seed))).toBe(true);
  });

  it("frees the bed once, Ready at once with no cleaning step, and keeps the person listed", () => {
    const before = boundedBedAvailability(unitOf(seed, person.unitId));
    const after = boundedBedAvailability(unitOf(left, person.unitId));
    expect(after.effectiveEmpty).toBe(before.effectiveEmpty + 1);
    expect(after.available).toBe(before.available + 1);
    const stay = stayOf(left, person.id);
    expect(stay.state).toBe("departed");
    expect(stay.waitingForTransport).toEqual({ since: now, by: "ward" });
    const release = left.bedReleases.find((candidate) => candidate.admissionId === person.id)!;
    expect(release.state).toBe("discharged");
    expect(release.preparing, "no Being made ready step").toBe(false);
    expect(waitingForTransport(left.admissions, person.unitId).map((entry) => entry.admissionId)).toContain(person.id);
    // The Discharges screen reads it from the same record.
    const records = selectDischargeRecords(left, { role: "ward", actingUnitId: person.unitId }, person.unitId);
    expect(records.status).toBe("allowed");
    if (records.status === "allowed")
      expect(
        recordGoingTo(
          records.value.find((record) => record.admissionId === person.id)!,
          new Date(0),
        ),
      ).toMatch(/^Discharged to the community\. Waiting for transport since .+\.$/);
  });

  it("an ordinary departure still goes to Being made ready and lists nobody", () => {
    const ordinary = wardFlowReducer(seed, { ...leave(person.id, person.unitId), awaitingTransport: undefined });
    expect(stayOf(ordinary, person.id).waitingForTransport).toBeUndefined();
    expect(ordinary.bedReleases.find((release) => release.admissionId === person.id)?.preparing).toBe(true);
  });

  it("is refused for a discharge with no transport outstanding", () => {
    const other = seed.admissions.find(
      (admission) => admission.state === "occupied" && !transportPendingFor(admission, seed.bedReleases),
    )!;
    const refused = wardFlowReducer(seed, leave(other.id, other.unitId));
    expect(refused.rejections.length).toBe(seed.rejections.length + 1);
    expect(stayOf(refused, other.id).state).toBe("occupied");
    expect(refused.units).toEqual(seed.units);
  });

  it("is refused for someone who did not return, who is not on site to wait (CodeRabbit, #1608)", () => {
    const refused = wardFlowReducer(seed, { ...leave(person.id, person.unitId), leavingDestination: "did-not-return" });
    expect(refused.rejections.length).toBe(seed.rejections.length + 1);
    expect(refused.rejections.at(-1)?.reason).toContain("still on site");
    expect(stayOf(refused, person.id).state).toBe("occupied");
    // Without the wait, did-not-return is still recorded as before.
    const plain = wardFlowReducer(seed, {
      ...leave(person.id, person.unitId),
      leavingDestination: "did-not-return",
      awaitingTransport: undefined,
    });
    expect(stayOf(plain, person.id).state).toBe("departed");
  });

  it("never frees the bed twice: a second departure of any kind is refused and moves nothing", () => {
    const again = wardFlowReducer(left, leave(person.id, person.unitId));
    expect(again.rejections.length).toBe(left.rejections.length + 1);
    expect(again.units).toEqual(left.units);
    const plain = wardFlowReducer(left, { ...leave(person.id, person.unitId), awaitingTransport: undefined });
    expect(plain.units).toEqual(left.units);
  });

  it("Collected takes them off the list and moves no bed figure", () => {
    const collected = wardFlowReducer(left, collect(person.id, person.unitId));
    expect(collected.rejections.length).toBe(left.rejections.length);
    expect(stayOf(collected, person.id).waitingForTransport).toBeUndefined();
    expect(waitingForTransport(collected.admissions, person.unitId).map((entry) => entry.admissionId)).not.toContain(
      person.id,
    );
    expect(collected.units).toEqual(left.units);
    // The discharge record changed, so its revision moves and a command from before is stale.
    expect(collected.dischargeRevisions[person.id]).toBe((left.dischargeRevisions[person.id] ?? 0) + 1);
    // Collecting again is refused rather than silently accepted.
    const twice = wardFlowReducer(collected, collect(person.id, person.unitId));
    expect(twice.rejections.length).toBe(collected.rejections.length + 1);
  });

  it("refuses the wrong ward and roles that may not record a departure", () => {
    const elsewhere = seed.units.find((unit) => unit.id !== person.unitId)!.id;
    for (const event of [
      collect(person.id, elsewhere),
      collect(person.id, person.unitId, "ed"),
      collect(person.id, person.unitId, "bed_manager"),
      leave(person.id, person.unitId, "ed"),
    ]) {
      const base = event.type === "MARK_TRANSPORT_COLLECTED" ? left : seed;
      const refused = wardFlowReducer(base, event);
      expect(refused.rejections.length, `${event.type} as ${event.role}`).toBe(base.rejections.length + 1);
      expect(refused.admissions).toEqual(base.admissions);
      expect(refused.units).toEqual(base.units);
    }
    // The coordinator may record the collection, as it may record a departure.
    const byCoordinator = wardFlowReducer(left, collect(person.id, person.unitId, "coordinator"));
    expect(stayOf(byCoordinator, person.id).waitingForTransport).toBeUndefined();
  });

  it("Undo works like other ward steps: the departure and the collection each come back exactly", () => {
    const undoneLeave = wardFlowReducer(left, {
      type: "UNDO_DEPARTURE",
      role: "ward",
      now: now + 1,
      admissionId: person.id,
      actingUnitId: person.unitId,
    });
    expect(undoneLeave.rejections.length).toBe(left.rejections.length);
    expect(stayOf(undoneLeave, person.id).state).toBe("occupied");
    expect(stayOf(undoneLeave, person.id).waitingForTransport).toBeUndefined();
    expect(figures(undoneLeave, person.unitId)).toEqual(figures(seed, person.unitId));

    const collected = wardFlowReducer(left, collect(person.id, person.unitId));
    const undoneCollect = wardFlowReducer(collected, {
      type: "UNDO_DEPARTURE",
      role: "ward",
      now: now + 31,
      admissionId: person.id,
      actingUnitId: person.unitId,
    });
    expect(undoneCollect.rejections.length).toBe(collected.rejections.length);
    expect(stayOf(undoneCollect, person.id).waitingForTransport).toEqual({ since: now, by: "ward" });
    expect(figures(undoneCollect, person.unitId)).toEqual(figures(left, person.unitId));
  });

  it("the linked-patient departure takes the same path", () => {
    const linked = seed.admissions.find(
      (admission) => admission.patientId !== null && transportPendingFor(admission, seed.bedReleases),
    );
    expect(linked, "the seed has a linked stay waiting on transport").toBeDefined();
    if (!linked) return;
    const next = wardFlowReducer(seed, {
      type: "RECORD_PATIENT_DISCHARGE",
      role: "ward",
      now,
      admissionId: linked.id,
      actingUnitId: linked.unitId,
      patientId: linked.patientId as `PT-${string}`,
      expectedGeneration: seed.worldGeneration,
      expectedRevision: seed.dischargeRevisions[linked.id] ?? 0,
      leavingDestination: "discharged-to-the-community",
      awaitingTransport: true,
    });
    expect(stayOf(next, linked.id).state).toBe("departed");
    expect(stayOf(next, linked.id).waitingForTransport).toEqual({ since: now, by: "ward" });
    expect(next.bedReleases.find((release) => release.admissionId === linked.id)?.preparing).toBe(false);
  });

  it("storage keeps the field on a departed stay only, as a time and a known role", () => {
    const stored = saved(left);
    expect(isValidStoredWardFlowState(stored)).toBe(true);
    const withStay = (change: (stay: Record<string, unknown>) => Record<string, unknown>) => ({
      ...stored,
      admissions: stored.admissions.map((stay) =>
        stay.id === person.id ? change(stay as unknown as Record<string, unknown>) : stay,
      ),
    });
    // An older save without the field still loads.
    expect(
      isValidStoredWardFlowState(
        withStay((stay) => {
          const copy = { ...stay };
          delete copy.waitingForTransport;
          return copy;
        }),
      ),
    ).toBe(true);
    expect(isValidStoredWardFlowState(withStay((stay) => ({ ...stay, state: "occupied" })))).toBe(false);
    expect(
      isValidStoredWardFlowState(withStay((stay) => ({ ...stay, waitingForTransport: { since: now, by: "nobody" } }))),
    ).toBe(false);
    expect(
      isValidStoredWardFlowState(
        withStay((stay) => ({ ...stay, waitingForTransport: { since: now, by: "ward", note: "typed text" } })),
      ),
    ).toBe(false);
    expect(
      isValidStoredWardFlowState(withStay((stay) => ({ ...stay, waitingForTransport: { since: NaN, by: "ward" } }))),
    ).toBe(false);
  });
});
