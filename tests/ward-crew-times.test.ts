import { describe, expect, it } from "vitest";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import {
  crewIsWaiting,
  crewTimesRefusal,
  crewsWaiting,
  type CrewHandoverEvent,
} from "@/components/ward-management/ward-crew-handover";
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

  it("keeps counting after the ED withdraws the referral, but not after the coordinator revokes it", () => {
    const f = journey();
    f.send({ type: "RECORD_CREW_TIMES", movementId: POLICE, crewArrivedAt: now - 30 });
    const waiting = f.movement(POLICE);
    const closedAs = (reason: string) => ({ ...waiting, closure: { reason, at: now - 1 } }) as Movement;
    // The ED board keeps a patient whose referral this ED withdrew, so the crew is still there too.
    expect(crewIsWaiting(closedAs("The referrer withdrew the referral"))).toBe(true);
    expect(crewIsWaiting(closedAs("The coordinator revoked the accepted referral"))).toBe(false);
  });

  it("refuses crew times when the current time cannot be read", () => {
    expect(crewTimesRefusal({ crewArrivedAt: now - 5 }, { crewArrivedAt: now - 5 }, Number.NaN)).toBe(
      "The current time could not be read",
    );
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

  it("refuses a stored crew time of null, which would read as typed", () => {
    for (const field of ["crewArrivedAt", "crewHandedOverAt", "crewReleasedAt"]) {
      const stored = JSON.parse(JSON.stringify(seedWardFlowState())) as WardFlowState;
      const movements = stored.movements.map((m) => (m.id === POLICE ? { ...m, [field]: null } : m));
      expect(isValidStoredWardFlowState({ ...stored, movements }), field).toBe(false);
    }
  });
});

describe("RECORD_ARRIVAL_MODE (D-141)", () => {
  const walkInId = () =>
    seedWardFlowState().movements.find(
      (m) => m.originEdId !== undefined && m.sourceAdmissionId === undefined && m.arrivalMode === undefined,
    )!.id;

  it("marks an ED arrival brought by police, and then its crew times can be typed", () => {
    const f = journey();
    const walkIn = walkInId();
    f.send({ type: "RECORD_ARRIVAL_MODE", movementId: walkIn, arrivalMode: "police" });
    expect(f.state.rejections).toEqual([]);
    expect(f.movement(walkIn).arrivalMode).toBe("police");
    f.send({ type: "RECORD_CREW_TIMES", movementId: walkIn, crewArrivedAt: now - 10 });
    expect(f.state.rejections).toEqual([]);
    expect(f.movement(walkIn).crewArrivedAt).toBe(now - 10);
  });

  it("corrects police to ambulance and keeps the typed crew times; the same mode again changes nothing", () => {
    const f = journey();
    f.send({ type: "RECORD_CREW_TIMES", movementId: POLICE, crewArrivedAt: now - 30 });
    f.send({ type: "RECORD_ARRIVAL_MODE", movementId: POLICE, arrivalMode: "ambulance" });
    expect(f.movement(POLICE)).toMatchObject({ arrivalMode: "ambulance", crewArrivedAt: now - 30 });
    const before = f.state;
    expect(f.send({ type: "RECORD_ARRIVAL_MODE", movementId: POLICE, arrivalMode: "ambulance" })).toBe(before);
    expect(f.state.rejections).toEqual([]);
  });

  it("refuses a mode outside Police and Ambulance, an unknown journey and a desk outside ED and the coordinator", () => {
    const f = journey();
    const walkIn = walkInId();
    f.send({ type: "RECORD_ARRIVAL_MODE", movementId: walkIn, arrivalMode: "self" });
    f.send({ type: "RECORD_ARRIVAL_MODE", movementId: "WF-NOPE", arrivalMode: "police" });
    f.send({ type: "RECORD_ARRIVAL_MODE", role: "ward", movementId: walkIn, arrivalMode: "police" });
    expect(f.state.rejections).toHaveLength(3);
    expect(f.state.rejections[0]?.reason).toBe("RECORD_ARRIVAL_MODE needs Police or Ambulance");
    expect(f.movement(walkIn).arrivalMode).toBeUndefined();
  });

  it("refuses a journey that did not start in an emergency department", () => {
    // Synthetic: a community journey, made from a seeded one with its ED taken off.
    const seeded = seedWardFlowState();
    const community = { ...seeded.movements.find((m) => m.id === POLICE)!, originEdId: undefined };
    const state = { ...seeded, movements: seeded.movements.map((m) => (m.id === POLICE ? community : m)) };
    const next = wardFlowReducer(state, {
      type: "RECORD_ARRIVAL_MODE",
      role: "ed",
      now,
      movementId: POLICE,
      arrivalMode: "ambulance",
    });
    expect(next.rejections.at(-1)?.reason).toMatch(/did not arrive at an emergency department$/);
  });

  it("a marked record saves and loads", () => {
    const f = journey();
    const walkIn = walkInId();
    f.send({ type: "RECORD_ARRIVAL_MODE", movementId: walkIn, arrivalMode: "ambulance" });
    const reloaded = JSON.parse(JSON.stringify(f.state)) as WardFlowState;
    expect(isValidStoredWardFlowState(reloaded)).toBe(true);
    expect(reloaded.movements.find((m: Movement) => m.id === walkIn)?.arrivalMode).toBe("ambulance");
  });
});

describe("crew handover events", () => {
  it("are the crew times and the arrival mode, and nothing else", () => {
    const types: CrewHandoverEvent["type"][] = ["RECORD_CREW_TIMES", "RECORD_ARRIVAL_MODE"];
    expect(new Set(types).size).toBe(2);
  });
});
