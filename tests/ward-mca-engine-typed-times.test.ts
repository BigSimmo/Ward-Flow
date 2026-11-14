// Mechanics and clock audit (14 Nov 2026), L7, D-210 (Josh, 14 Nov 2026): the engine refuses a blank
// or infinite typed time on arrival details, a bed release and a bed meeting action, and an expected
// discharge before the stay began. The screens already guard these; this is the runtime guard.
// Synthetic data only.
import { describe, expect, it } from "vitest";

import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;
const seed = seedWardFlowState();
const occupied = seed.admissions.find(
  (admission) =>
    admission.state === "occupied" &&
    typeof admission.arrivedAt === "number" &&
    !seed.bedReleases.some((release) => release.admissionId === admission.id && release.state !== "discharged"),
)!;
const accepted = seed.movements.find((movement) => !movement.closure && movement.acceptedUnitId !== undefined)!;
const BAD_TIMES = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, undefined, null, "10:00"];

const apply = (event: Record<string, unknown>): { state: WardFlowState; refused: boolean } => {
  const state = wardFlowReducer(seed, event as unknown as WardFlowEvent);
  return { state, refused: state === seed || state.rejections.length > seed.rejections.length };
};

const arrival = (estimatedArrivalAt: unknown) => ({
  type: "SET_ARRIVAL_DETAILS",
  role: "coordinator",
  now: NOW,
  movementId: accepted.id,
  arrivalMode: "mental_health_transport",
  estimatedArrivalAt,
});
const release = (expectedAt: unknown) => ({
  type: "FLAG_BED_RELEASE",
  role: "ward",
  now: NOW,
  unitId: occupied.unitId,
  actingUnitId: occupied.unitId,
  admissionId: occupied.id,
  waitingOn: "Nothing outstanding",
  expectedAt,
});
const meetingAction = (dueAt: unknown) => ({
  type: "RECORD_BED_MEETING_ACTION",
  role: "coordinator",
  now: NOW,
  subject: { kind: "admission", id: occupied.id },
  action: "chase_ndis",
  owner: "coordinator",
  dueAt,
});
const expectedDischarge = (expectedDischargeAt: number) => ({
  type: "UPDATE_EXPECTED_DISCHARGE",
  role: "coordinator",
  now: NOW,
  admissionId: occupied.id,
  expectedDischargeAt,
});

describe("the engine refuses impossible typed times", () => {
  it("accepts each event with a real time, so the refusals below are about the time alone", () => {
    expect(apply(arrival(NOW + 60)).refused).toBe(false);
    expect(apply(release(NOW + 60)).refused).toBe(false);
    expect(apply(meetingAction(NOW + 60)).refused).toBe(false);
    expect(apply(expectedDischarge(NOW + 60)).refused).toBe(false);
  });

  it.each(BAD_TIMES.map((value) => [String(value), value]))("refuses a %s time", (_label, value) => {
    expect(apply(arrival(value)).refused).toBe(true);
    expect(apply(release(value)).refused).toBe(true);
    expect(apply(meetingAction(value)).refused).toBe(true);
  });

  it("refuses an expected discharge before the stay began, and accepts one at its start", () => {
    const start = occupied.arrivedAt!;
    const before = apply(expectedDischarge(start - 1));
    expect(before.refused).toBe(true);
    expect(before.state.rejections.at(-1)?.reason).toMatch(/before the stay began/);
    expect(apply(expectedDischarge(start)).refused).toBe(false);
  });
});
