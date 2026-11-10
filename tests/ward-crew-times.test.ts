import { describe, expect, it } from "vitest";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { crewIsWaiting, crewsWaiting } from "@/components/ward-management/ward-crew-handover";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import type { Movement } from "@/components/ward-management/ward-model";

/**
 * Item 9 (police and ambulance handover times, D-93). Synthetic seed only: WF-009 was brought to
 * Peel's emergency department by police, WF-003 to Royal Perth's by ambulance.
 */
const now = 642;
const POLICE = "WF-009";
const AMBULANCE = "WF-003";

function journey() {
  let state = seedWardFlowState();
  const send = (event: Record<string, unknown>) => {
    state = wardFlowReducer(state, { now, role: "ed", ...event } as WardFlowEvent);
    return state;
  };
  return {
    get state(): WardFlowState {
      return state;
    },
    send,
    movement: (id: string) => state.movements.find((m) => m.id === id)!,
  };
}

describe("RECORD_CREW_TIMES", () => {
  it("records only the times typed and never fills in the others", () => {
    const f = journey();
    f.send({ type: "RECORD_CREW_TIMES", movementId: POLICE, crewArrivedAt: now - 100 });
    expect(f.state.rejections).toEqual([]);
    const m = f.movement(POLICE);
    expect(m.crewArrivedAt).toBe(now - 100);
    expect(m.crewHandedOverAt).toBeUndefined();
    expect(m.crewReleasedAt).toBeUndefined();
  });

  it("keeps an earlier time when a later save types only another one", () => {
    const f = journey();
    f.send({ type: "RECORD_CREW_TIMES", movementId: AMBULANCE, crewArrivedAt: now - 90 });
    f.send({ type: "RECORD_CREW_TIMES", movementId: AMBULANCE, crewHandedOverAt: now - 30 });
    expect(f.state.rejections).toEqual([]);
    expect(f.movement(AMBULANCE)).toMatchObject({ crewArrivedAt: now - 90, crewHandedOverAt: now - 30 });
  });

  it("refuses times out of order, in the future, older than a day, or none at all", () => {
    const f = journey();
    f.send({ type: "RECORD_CREW_TIMES", movementId: POLICE, crewArrivedAt: now - 10, crewReleasedAt: now - 20 });
    f.send({ type: "RECORD_CREW_TIMES", movementId: POLICE, crewArrivedAt: now + 5 });
    f.send({ type: "RECORD_CREW_TIMES", movementId: POLICE, crewArrivedAt: now - 24 * 60 - 1 });
    f.send({ type: "RECORD_CREW_TIMES", movementId: POLICE });
    expect(f.state.rejections.map((r) => r.reason)).toEqual([
      "Crew times must run in order: arrived, handed over, released",
      "A crew time cannot be later than now",
      "A crew time must be within the last 24 hours",
      "RECORD_CREW_TIMES needs at least one typed time",
    ]);
    // A release typed before an arrival already on the record is refused too.
    f.send({ type: "RECORD_CREW_TIMES", movementId: POLICE, crewArrivedAt: now - 60 });
    f.send({ type: "RECORD_CREW_TIMES", movementId: POLICE, crewReleasedAt: now - 70 });
    expect(f.state.rejections.at(-1)?.reason).toBe("Crew times must run in order: arrived, handed over, released");
    expect(f.movement(POLICE).crewReleasedAt).toBeUndefined();
  });

  it("refuses an arrival nobody brought by police or ambulance", () => {
    const f = journey();
    const walkIn = f.state.movements.find((m) => m.originEdId !== undefined && m.arrivalMode === undefined)!;
    f.send({ type: "RECORD_CREW_TIMES", movementId: walkIn.id, crewArrivedAt: now - 10 });
    expect(f.state.rejections.at(-1)?.reason).toMatch(/was not brought by police or ambulance$/);
  });

  it("refuses a desk outside ED and the coordinator", () => {
    const f = journey();
    f.send({ type: "RECORD_CREW_TIMES", role: "ward", movementId: POLICE, crewArrivedAt: now - 10 });
    expect(f.state.rejections).toHaveLength(1);
    expect(f.movement(POLICE).crewArrivedAt).toBeUndefined();
  });
});

describe("crews waiting", () => {
  it("counts a crew from arrived until released, longest first", () => {
    const f = journey();
    f.send({ type: "RECORD_CREW_TIMES", movementId: POLICE, crewArrivedAt: now - 100 });
    f.send({ type: "RECORD_CREW_TIMES", movementId: AMBULANCE, crewArrivedAt: now - 40, crewHandedOverAt: now - 5 });
    expect(crewsWaiting(f.state.movements, now)).toEqual({ count: 2, longestMinutes: 100 });
    // Handed over is not released: the ambulance crew still waits until its release is typed.
    f.send({ type: "RECORD_CREW_TIMES", movementId: POLICE, crewReleasedAt: now - 1 });
    expect(crewsWaiting(f.state.movements, now)).toEqual({ count: 1, longestMinutes: 40 });
    f.send({ type: "RECORD_CREW_TIMES", movementId: AMBULANCE, crewReleasedAt: now });
    expect(crewsWaiting(f.state.movements, now)).toBeUndefined();
  });

  it("never guesses a missing time: no typed arrival, no wait", () => {
    const f = journey();
    f.send({ type: "RECORD_CREW_TIMES", movementId: POLICE, crewHandedOverAt: now - 20 });
    expect(f.state.rejections).toEqual([]);
    expect(crewIsWaiting(f.movement(POLICE))).toBe(false);
    expect(crewsWaiting(f.state.movements, now)).toBeUndefined();
  });

  it("shows nothing for the seed, where no crew time is typed", () => {
    expect(crewsWaiting(seedWardFlowState().movements, now)).toBeUndefined();
  });
});

describe("saved records", () => {
  it("an old record without crew times still loads, and its crew reads as not recorded", () => {
    const old = seedWardFlowState();
    const police = old.movements.find((m) => m.id === POLICE)!;
    expect(police.arrivalMode).toBe("police");
    expect("crewArrivedAt" in police).toBe(false);
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(old)))).toBe(true);
  });

  it("a record with crew times saves and loads", () => {
    const f = journey();
    f.send({ type: "RECORD_CREW_TIMES", movementId: POLICE, crewArrivedAt: now - 50, crewHandedOverAt: now - 20 });
    const reloaded = JSON.parse(JSON.stringify(f.state)) as WardFlowState;
    expect(isValidStoredWardFlowState(reloaded)).toBe(true);
    const m = reloaded.movements.find((movement: Movement) => movement.id === POLICE)!;
    expect(m).toMatchObject({ crewArrivedAt: now - 50, crewHandedOverAt: now - 20 });
  });
});
