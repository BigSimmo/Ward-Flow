// tests/ward-refusal-gaps-transport.test.ts
//
// FOUR REFUSALS THAT CAN NEVER RUN — and the four that run in their place.
//
// 🔴 THIS FILE SET OUT TO TEST FOUR UNREACHED REFUSALS AND BECAME THE EVIDENCE THAT THEY ARE DEAD
// CODE. They were on the never-reached list not because nobody had got round to them, but because
// nothing can reach them:
//
//   CANCEL_TRANSPORT  "transport for movement X was already cancelled"
//   CANCEL_TRANSPORT  "cannot cancel transport for movement X — the patient has arrived"
//   STOP_TRANSPORT    "movement X's patient has already arrived"
//   STOP_TRANSPORT    "transport for movement X was already stopped or cancelled"
//
// Each sits several lines BELOW a check that the movement is closed. And both states they describe
// imply a closed movement:
//
//   - `PATIENT_ARRIVED` is the only event that writes `transport.arrivedAt` — the reducer says so
//     in those words — and it writes a `closure` in the same object literal.
//   - Every one of the six places that writes `transport.cancelledAt` writes a `closure` beside
//     it: RECORD_ED_OUTCOME, REFER_TO_COMMUNITY_TEAM, RECORD_EXAMINATION, WITHDRAW_REFERRAL,
//     RECORD_REFERRER_WITHDRAWAL, and STOP_TRANSPORT itself. `CANCEL_TRANSPORT` writes none at
//     all — it REMOVES the job, per the owner's 2026-09-17 ruling "no automatic rebooking".
//
// Nothing in the reducer ever clears a closure. So the closed-movement refusal always answers
// first, every time, and these four sentences are never spoken to anybody.
//
// ✅ NOBODY IS LESS SAFE FOR IT, WHICH IS WHY THIS IS A TIDINESS FINDING AND NOT A HAZARD.
// Cancelling or stopping a journey that is over is refused either way. What is wrong is the
// SENTENCE the person gets — it names the closure rather than the thing they just tried to do —
// and that four guards in a clinical engine read as live safeguards, are counted as safeguards,
// and are not.
//
// ⚠️ SO THESE TESTS PIN WHAT ACTUALLY HAPPENS, NOT WHAT THE DEAD LINE SAYS. Each asserts the
// refusal that really fires AND that the dead line's own wording is absent. If somebody later
// moves the closure check, makes a closure reversible, or lets a cancellation leave a movement
// open, these go red — which is the only way four dead guards would otherwise come back to life
// with nothing exercising them.
import { describe, expect, it } from "vitest";

import type { WardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import {
  CANCEL_TRANSPORT_REASONS,
  STOP_TRANSPORT_REASONS,
  TRANSPORT_WHEREABOUTS,
} from "../src/components/ward-management/ward-change-reasons";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;
// WF-005 arrives from the seed at `handover_ready` with its transport already accepted — the last
// point before a patient is on the road, and the only seeded movement in that state.
const MOVEMENT = "WF-005";

function added(before: WardFlowState, after: WardFlowState) {
  return after.rejections.slice(before.rejections.length).map((rejection) => rejection.reason);
}

function movementIn(state: WardFlowState) {
  const found = state.movements.find((candidate) => candidate.id === MOVEMENT);
  if (!found) throw new Error(`the seed no longer carries movement ${MOVEMENT}`);
  return found;
}

/** Walks the patient as far as `stop`, asserting every step was accepted rather than assuming it. */
function driveTo(stop: "collected" | "arrived"): WardFlowState {
  let state = seedWardFlowState();
  const steps = [
    { type: "TRANSPORT_EN_ROUTE", role: "officer", now: NOW + 1, movementId: MOVEMENT },
    { type: "PATIENT_COLLECTED", role: "officer", now: NOW + 2, movementId: MOVEMENT },
    ...(stop === "arrived" ? [{ type: "PATIENT_ARRIVED", role: "officer", now: NOW + 3, movementId: MOVEMENT }] : []),
  ] as const;
  for (const step of steps) {
    const before = state;
    state = wardFlowReducer(state, step as never);
    expect(added(before, state), `the walk to "${stop}" was refused at ${step.type}`).toEqual([]);
  }
  return state;
}

function stopTransport(state: WardFlowState, now: number) {
  return wardFlowReducer(state, {
    type: "STOP_TRANSPORT",
    role: "coordinator",
    now,
    movementId: MOVEMENT,
    reason: STOP_TRANSPORT_REASONS[0],
    whereabouts: TRANSPORT_WHEREABOUTS[0],
  });
}

function cancelTransport(state: WardFlowState, now: number) {
  return wardFlowReducer(state, {
    type: "CANCEL_TRANSPORT",
    role: "coordinator",
    now,
    movementId: MOVEMENT,
    reason: CANCEL_TRANSPORT_REASONS[0],
  });
}

describe("the states these four refusals describe are always closed movements", () => {
  it("an arrival closes the movement, so both arrival guards sit behind a door that is always shut", () => {
    const arrived = driveTo("arrived");
    expect(movementIn(arrived).transport?.arrivedAt, "the patient did not actually arrive").toBeDefined();
    expect(
      movementIn(arrived).closure,
      "arrival no longer closes the movement — the arrival-specific guards may now be reachable, and want real tests",
    ).toBeDefined();
  });

  it("a stop records a cancellation and a closure together, so both cancellation guards do too", () => {
    const stopped = stopTransport(driveTo("collected"), NOW + 3);
    expect(movementIn(stopped).transport?.cancelledAt, "stopping recorded no cancellation").toBeDefined();
    expect(
      movementIn(stopped).closure,
      "a stopped journey no longer closes its movement — the cancellation guards may now be reachable",
    ).toBeDefined();
  });
});

describe("what a person is actually told, where the dead guards would have spoken", () => {
  it("cancelling after arrival is refused as a closed movement, never as an arrival", () => {
    const arrived = driveTo("arrived");
    const reasons = added(arrived, cancelTransport(arrived, NOW + 4));
    expect(reasons).toEqual(["cannot cancel transport for a closed movement (Patient arrived at the accepting unit)"]);
    expect(reasons[0]).not.toContain("the patient has arrived");
  });

  it("stopping after arrival is refused as a closed movement, never as an arrival", () => {
    const arrived = driveTo("arrived");
    const reasons = added(arrived, stopTransport(arrived, NOW + 4));
    expect(reasons).toEqual(["cannot stop transport for a closed movement (Patient arrived at the accepting unit)"]);
    expect(reasons[0]).not.toContain("already arrived");
  });

  it("cancelling after a stop is refused as a closed movement, never as an already-cancelled job", () => {
    const stopped = stopTransport(driveTo("collected"), NOW + 3);
    const reasons = added(stopped, cancelTransport(stopped, NOW + 4));
    expect(reasons).toEqual(["cannot cancel transport for a closed movement (The examination was revoked)"]);
    expect(reasons[0]).not.toContain("was already cancelled");
  });

  it("stopping twice is refused as a closed movement, never as an already-stopped journey", () => {
    const stopped = stopTransport(driveTo("collected"), NOW + 3);
    const reasons = added(stopped, stopTransport(stopped, NOW + 4));
    expect(reasons).toEqual(["cannot stop transport for a closed movement (The examination was revoked)"]);
    expect(reasons[0]).not.toContain("already stopped or cancelled");
  });
});

describe("and an ordinary cancellation still works, so none of the above is cancellation being broken", () => {
  it("cancelling a booked job before collection is accepted, and removes the job rather than flagging it", () => {
    const seeded = seedWardFlowState();
    const cancelled = cancelTransport(seeded, NOW + 1);
    expect(added(seeded, cancelled), "an ordinary cancellation was refused").toEqual([]);
    // The owner's 2026-09-17 ruling, pinned here because it is what makes "already cancelled"
    // unreachable by cancelling twice: the job is REMOVED, not flagged.
    expect(movementIn(cancelled).transport, "cancelling now leaves the job standing").toBeUndefined();
  });
});
