import { describe, expect, it } from "vitest";

import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { scopeWorkspace } from "../src/components/ward-management/ward-access-scope";
import { scopeWardFlowState } from "../src/components/ward-management/ward-access-state";
import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import { STATEWIDE_COORDINATOR } from "../src/components/ward-management/ward-role-access";
import { WARD_SCENARIOS } from "../src/components/ward-management/ward-scenarios";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import { wardStaySeats } from "../src/components/ward-management/ward/ward-bed-layout";

/**
 * F-150 (audit G FS-4): a stay's bed number depends only on the saved state, never on the desk. The
 * ward desk is not sent a stay that left before its hand-off window, and replaying the ward's beds
 * without it moved Dabakarn's beds 10, 11 and 12 to 12, 10 and 11 (a wrong-bed hazard, audit A1-1).
 */
describe("bed numbers are the same on every desk", () => {
  const state = seedWardFlowState();
  const places = wardPlaceLookup(state.units);
  const options = { now: NOW_ANCHOR, places };
  const seatsOn = (desk: Pick<typeof state, "units" | "admissions">, unitId: string) =>
    wardStaySeats(
      desk.units.find((unit) => unit.id === unitId)!,
      desk.admissions,
    );

  for (const scenario of WARD_SCENARIOS) {
    it(`seats every current stay in the coordinator's bed on its own ward desk (${scenario})`, () => {
      const world =
        scenario === "standard"
          ? state
          : wardFlowReducer(state, { type: "SET_SCENARIO", role: "demo", now: NOW_ANCHOR, scenario });
      const worldOptions = { now: NOW_ANCHOR, places: wardPlaceLookup(world.units) };
      const coordinator = scopeWardFlowState(world, STATEWIDE_COORDINATOR, worldOptions).state;
      let compared = 0;
      for (const unit of world.units) {
        const access = { role: "ward", scope: { kind: "ward", unitIds: [unit.id] } } as const;
        const whole = [...seatsOn(coordinator, unit.id).entries()].sort();
        // The server's desk copy and the browser's own scoping both.
        const sent = [...seatsOn(scopeWardFlowState(world, access, worldOptions).state, unit.id).entries()].sort();
        const browser = [...seatsOn(scopeWorkspace(world, access, worldOptions), unit.id).entries()].sort();
        expect(sent, unit.name).toEqual(whole);
        expect(browser, unit.name).toEqual(whole);
        compared += whole.length;
      }
      expect(compared).toBeGreaterThan(0);
    });
  }

  it("keeps Dabakarn's ward desk short of the departed stays' details while seating them", () => {
    const unitId = state.units.find((unit) => unit.name === "Dabakarn")!.id;
    const ward = scopeWardFlowState(state, { role: "ward", scope: { kind: "ward", unitIds: [unitId] } }, options);
    const history = ward.state.units.find((unit) => unit.id === unitId)!.seatHistoryStays ?? [];
    // The seeded day has a stay that left before the hand-off window: the case the audit found.
    expect(history.length).toBeGreaterThan(0);
    const sent = new Set(ward.state.admissions.map((admission) => admission.id));
    const whole = new Set(state.admissions.map((admission) => admission.id));
    for (const stay of history) {
      // A stand-in id: never the departed stay's own id, nor any other stay's.
      expect(whole.has(stay.id) || sent.has(stay.id)).toBe(false);
      expect(Object.keys(stay).every((key) => !/patient|name|referral|movement/i.test(key))).toBe(true);
    }
  });

  it("breaks a tie on time between a departed stay and a current one as the whole record does", () => {
    const unitId = state.units.find((unit) => unit.name === "Dabakarn")!.id;
    const access = { role: "ward", scope: { kind: "ward", unitIds: [unitId] } } as const;
    const kept = new Set(scopeWorkspace(state, access, options).admissions.map((admission) => admission.id));
    const departed = state.admissions.find(
      (admission) => admission.unitId === unitId && !kept.has(admission.id) && admission.state !== "waitlisted",
    )!;
    const current = state.admissions.find(
      (admission) => admission.unitId === unitId && admission.state === "occupied" && admission.bedNumber === undefined,
    )!;
    // A synthetic stay that took its bed at the very minute the departed one did, with an id that
    // sorts after it, so the departed stay must still take the lower bed on the ward desk.
    const tied = {
      ...current,
      id: `${departed.id}~tied`,
      pulledAt: departed.pulledAt,
      arrivedAt: departed.arrivedAt ?? departed.pulledAt,
    };
    const world = { ...state, admissions: [...state.admissions, tied] };
    const whole = seatsOn(world, unitId);
    const desk = seatsOn(scopeWorkspace(world, access, options), unitId);
    expect(desk.get(tied.id)).toBe(whole.get(tied.id));
    expect([...desk.entries()].sort()).toEqual([...whole.entries()].sort());
  });
});
