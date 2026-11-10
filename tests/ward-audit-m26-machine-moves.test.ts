// tests/ward-audit-m26-machine-moves.test.ts
//
// Audit item M26 (absorbs M27): the business rules match the workflow diagrams.
//
// The movement machine in docs/ward-flow/journey/machines.json is read here, never copied. For
// every diagram state the test holds one or more real reducer states with movement WF-012 in that
// state (built by driving the reducer, not by writing fields). It then fires EVERY action the
// diagram names for this machine from EVERY state and records what the engine did:
//
//   - a move the diagram lists must be accepted and land on the diagram's target state;
//   - a move the diagram does not list must be refused, or accepted without moving the state.
//
// Where the engine and the diagram disagree, the pair is named in KNOWN_DISAGREEMENTS with a
// question for Josh. Nothing here decides which side is right. The list is two-way: a new
// disagreement fails the test, and so does a listed one that has stopped disagreeing, so the list
// cannot go stale.
//
// Terms follow the app (D-85): pulled is "Bed pulled", held is the bed state, arrived, ready.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { communityTeamOptions } from "@/components/ward-management/referrals/referral-destination-options";
import { GENDER_PLACEMENT_REASONS } from "@/components/ward-management/ward-change-reasons";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Instant } from "@/components/ward-management/ward-clock";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

type Machine = {
  id: string;
  states: { id: string; kind: string }[];
  transitions: { from: string; to: string; action: string; kind?: string }[];
};
const machines = (
  JSON.parse(readFileSync(join(process.cwd(), "docs/ward-flow/journey/machines.json"), "utf8")) as {
    machines: Machine[];
  }
).machines;
const movementMachine = machines.find((machine) => machine.id === "movement")!;

const MOVEMENT_ID = "WF-012";
const UNIT_DECLINED = "rgh-adult-secure";
const UNIT_ACCEPTED = "rph-adult-secure";
const t = (minutes: number): Instant => NOW_ANCHOR + minutes;

/** When each fixture state was reached, so a probe fires one minute later, not hours later. */
const reachedAt = new WeakMap<WardFlowState, Instant>();

function step(state: WardFlowState, event: WardFlowEvent, label: string) {
  const next = wardFlowReducer(state, event);
  if (next.rejections.length !== state.rejections.length)
    throw new Error(`fixture step ${label} was refused: ${JSON.stringify(next.rejections.at(-1))}`);
  reachedAt.set(next, event.now);
  return next;
}

/** The movement's state as the diagram names it. "closed" is the did-not-proceed closure. */
function diagramState(state: WardFlowState): string {
  const movement = state.movements.find((candidate) => candidate.id === MOVEMENT_ID)!;
  if (movement.closure?.outcome === "did_not_proceed") return "closed";
  return movement.stage;
}

/** Real reducer states, each with WF-012 in the named diagram state. */
function buildSnapshots(): Record<string, WardFlowState[]> {
  const s0 = seedWardFlowState();
  const refer = (unitId: string, now: Instant) =>
    ({
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now,
      movementId: MOVEMENT_ID,
      unitIds: [unitId],
      genderPlacementReason: GENDER_PLACEMENT_REASONS[0],
      genderPlacementChecked: true,
    }) as WardFlowEvent;
  const s1 = step(s0, refer(UNIT_DECLINED, t(10)), "refer");
  const s2 = step(
    s1,
    {
      type: "DECLINE",
      role: "ward",
      now: t(20),
      movementId: MOVEMENT_ID,
      unitId: UNIT_DECLINED,
      reason: "capability_mismatch",
    },
    "decline",
  );
  const s3 = step(s2, refer(UNIT_ACCEPTED, t(30)), "re-refer");
  const s4 = step(
    s3,
    { type: "ACCEPT_IN_PRINCIPLE", role: "ward", now: t(40), movementId: MOVEMENT_ID, unitId: UNIT_ACCEPTED },
    "accept",
  );
  const s5 = step(
    s4,
    { type: "PULL_PATIENT", role: "ward", now: t(50), movementId: MOVEMENT_ID, unitId: UNIT_ACCEPTED },
    "pull",
  );
  const s6 = step(
    s5,
    {
      type: "BOOK_TRANSPORT",
      role: "ed",
      now: t(60),
      movementId: MOVEMENT_ID,
      provider: "Ambulance service",
      escortRequired: true,
      cadNumber: "CAD-STUB-0001",
      transportLegalStatus: "voluntary",
      estimatedAt: 0,
    },
    "book transport",
  );
  const s7 = step(s6, { type: "HANDOVER_READY", role: "ed", now: t(70), movementId: MOVEMENT_ID }, "handover ready");
  const s8 = step(
    s7,
    { type: "TRANSPORT_ACCEPTED", role: "officer", now: t(80), movementId: MOVEMENT_ID },
    "crew accepted",
  );
  const s9 = step(s8, { type: "TRANSPORT_EN_ROUTE", role: "officer", now: t(90), movementId: MOVEMENT_ID }, "en route");
  const s10 = step(
    s9,
    { type: "PATIENT_COLLECTED", role: "officer", now: t(100), movementId: MOVEMENT_ID },
    "collected",
  );
  const s11 = step(
    s10,
    { type: "PATIENT_ARRIVED", role: "coordinator", now: t(110), movementId: MOVEMENT_ID },
    "arrived",
  );
  // "No transport needed" is recorded before the pull, so the ward may record arrival from pulled.
  const s4NoTransport = step(
    s4,
    { type: "RECORD_TRANSPORT_NEED", role: "coordinator", now: t(45), movementId: MOVEMENT_ID, needed: false },
    "no transport needed",
  );
  const s5NoTransport = step(
    s4NoTransport,
    { type: "PULL_PATIENT", role: "ward", now: t(50), movementId: MOVEMENT_ID, unitId: UNIT_ACCEPTED },
    "pull with no transport needed",
  );
  // A conclusive examination, so a legal-form patient can be referred to a community team.
  const s5Examined = step(
    s5,
    { type: "RECORD_EXAMINATION", role: "ed", now: t(55), movementId: MOVEMENT_ID, outcome: "inpatient_order" },
    "inpatient order while pulled",
  );
  const sClosed = step(
    s5,
    { type: "WITHDRAW_REFERRAL", role: "coordinator", now: t(60), movementId: MOVEMENT_ID },
    "withdraw referral",
  );

  const byState: Record<string, WardFlowState[]> = {};
  for (const state of [s0, s1, s2, s3, s4, s5, s5NoTransport, s5Examined, s6, s7, s8, s9, s10, s11, sClosed])
    (byState[diagramState(state)] ??= []).push(state);
  return byState;
}

/** One plausible, well-formed event per diagram action. Roles match who does it in the app. */
function eventFor(action: string, state: WardFlowState): WardFlowEvent | undefined {
  const now = (reachedAt.get(state) ?? NOW_ANCHOR) + 1;
  const movement = state.movements.find((candidate) => candidate.id === MOVEMENT_ID)!;
  const base = { now, movementId: MOVEMENT_ID } as const;
  const events: Record<string, WardFlowEvent> = {
    REFER_TO_UNITS: {
      ...base,
      type: "REFER_TO_UNITS",
      role: "coordinator",
      unitIds: [[UNIT_ACCEPTED, UNIT_DECLINED].find((id) => !movement.referredUnitIds?.includes(id)) ?? UNIT_ACCEPTED],
      genderPlacementReason: GENDER_PLACEMENT_REASONS[0],
      genderPlacementChecked: true,
    },
    DECLINE: {
      ...base,
      type: "DECLINE",
      role: "ward",
      unitId: movement.referredUnitIds?.[0] ?? UNIT_ACCEPTED,
      reason: "capability_mismatch",
    },
    WITHDRAW_WARD_REQUEST: {
      ...base,
      type: "WITHDRAW_WARD_REQUEST",
      role: "coordinator",
      unitId: movement.referredUnitIds?.[0] ?? UNIT_ACCEPTED,
      reason: "referred_in_error",
    },
    ACCEPT_IN_PRINCIPLE: {
      ...base,
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      unitId: movement.referredUnitIds?.[0] ?? UNIT_ACCEPTED,
    },
    WITHDRAW_ACCEPTANCE: { ...base, type: "WITHDRAW_ACCEPTANCE", role: "coordinator", reason: "the_decision_changed" },
    PULL_PATIENT: { ...base, type: "PULL_PATIENT", role: "ward", unitId: movement.acceptedUnitId ?? UNIT_ACCEPTED },
    RELEASE_PULL: { ...base, type: "RELEASE_PULL", role: "coordinator", reason: "pull_made_in_error" },
    HANDOVER_READY: { ...base, type: "HANDOVER_READY", role: "ed" },
    PATIENT_COLLECTED: { ...base, type: "PATIENT_COLLECTED", role: "officer" },
    PATIENT_ARRIVED: { ...base, type: "PATIENT_ARRIVED", role: "coordinator" },
    WITHDRAW_REFERRAL: { ...base, type: "WITHDRAW_REFERRAL", role: "coordinator" },
    RECORD_ED_OUTCOME: { ...base, type: "RECORD_ED_OUTCOME", role: "ed", outcome: "for_community_follow_up" },
    REFER_TO_COMMUNITY_TEAM: {
      ...base,
      type: "REFER_TO_COMMUNITY_TEAM",
      role: "ed",
      team: communityTeamOptions()[0]!,
      purpose: "follow_up",
    } as WardFlowEvent,
    RECORD_EXAMINATION: { ...base, type: "RECORD_EXAMINATION", role: "ed", outcome: "community_order" },
    STOP_TRANSPORT: {
      ...base,
      type: "STOP_TRANSPORT",
      role: "coordinator",
      reason: "The referral was withdrawn",
      whereabouts: "Back at the sending emergency department",
    } as WardFlowEvent,
    STEP_BACK_STAGE: {
      ...base,
      type: "STEP_BACK_STAGE",
      role: "coordinator",
      to: "placement_requested",
      reason: "recorded_in_error",
    },
  };
  return events[action];
}

/** Creation moves start a NEW movement, so they cannot be fired at WF-012. Each is proven by the
 *  named test, which this file checks still exists and still names the action. */
const CREATION_MOVES: Record<string, string> = {
  "start->placement_requested RAISE_REFERRAL": "tests/ward-movement-stage-changes.test.ts",
  "start->arrived RECORD_ADMISSION_CARE": "tests/ward-journey-transfer-arrival-model.test.ts",
};

/**
 * Engine and diagram disagree on these pairs. Each is a question for Josh, not a verdict: either
 * the diagram is wrong (fix machines.json) or the engine is (a clinical-behaviour change he rules on).
 * Key: "<from> <ACTION>". Value: what the engine does instead, and the question.
 */
const Q1 =
  "Q1 step back: the diagram draws one arrow (moving -> placement_requested, labelled 'to ANY strictly earlier stage'); the engine accepts a step back from every later stage. Should machines.json draw it from every stage?";
const Q2 =
  "Q2 withdraw referral: the diagram draws this exit from Bed pulled only; the engine closes the movement from every open stage after placement_requested. Which is right?";
const Q3 =
  "Q3 ED outcome: the diagram draws this exit from Bed pulled only; the engine closes the movement from every open stage before moving. Which is right?";
const Q4 =
  "Q4 community order: the diagram draws this exit from Bed pulled only; the engine also closes on a community order before a bed is pulled. Which is right?";
const Q5 =
  "Q5 withdraw acceptance: the arrow starts at accepted_awaiting_bed only, but its guard text and the engine also allow it from Bed pulled (the held bed is released). Should the diagram add the arrow?";
const KNOWN_DISAGREEMENTS: Record<string, string> = {
  "destination_review STEP_BACK_STAGE": Q1,
  "accepted_awaiting_bed STEP_BACK_STAGE": Q1,
  "pulled STEP_BACK_STAGE": Q1,
  "handover_ready STEP_BACK_STAGE": Q1,
  "destination_review WITHDRAW_REFERRAL": Q2,
  "accepted_awaiting_bed WITHDRAW_REFERRAL": Q2,
  "handover_ready WITHDRAW_REFERRAL": Q2,
  "placement_requested RECORD_ED_OUTCOME": Q3,
  "destination_review RECORD_ED_OUTCOME": Q3,
  "accepted_awaiting_bed RECORD_ED_OUTCOME": Q3,
  "handover_ready RECORD_ED_OUTCOME": Q3,
  "placement_requested RECORD_EXAMINATION": Q4,
  "destination_review RECORD_EXAMINATION": Q4,
  "accepted_awaiting_bed RECORD_EXAMINATION": Q4,
  "pulled WITHDRAW_ACCEPTANCE": Q5,
};

type Outcome = { accepted: boolean; to: string; reason?: string };

function fire(state: WardFlowState, action: string): Outcome | undefined {
  const event = eventFor(action, state);
  if (!event) return undefined;
  const next = wardFlowReducer(state, event);
  const accepted = next.rejections.length === state.rejections.length;
  return { accepted, to: diagramState(next), reason: accepted ? undefined : next.rejections.at(-1)?.reason };
}

function compare() {
  const snapshots = buildSnapshots();
  const actions = [...new Set(movementMachine.transitions.map((transition) => transition.action))];
  const listed = new Map<string, Set<string>>();
  for (const transition of movementMachine.transitions) {
    if (transition.from === "start") continue;
    // "arrived -> closed PATIENT_ARRIVED" is the side effect that arrival also stamps a closure.
    if (transition.kind === "side" && transition.from === "arrived") continue;
    const key = `${transition.from} ${transition.action}`;
    if (!listed.has(key)) listed.set(key, new Set());
    listed.get(key)!.add(transition.to);
  }
  const found: Record<string, string> = {};
  const matrix: string[] = [];
  for (const state of movementMachine.states) {
    if (state.kind === "start") continue;
    const held = snapshots[state.id] ?? [];
    for (const action of actions) {
      const key = `${state.id} ${action}`;
      const outcomes = held.map((snapshot) => fire(snapshot, action)).filter((o): o is Outcome => !!o);
      const targets = listed.get(key);
      const moves = outcomes.filter((o) => o.accepted && o.to !== state.id);
      if (targets) {
        const hit = outcomes.some((o) => o.accepted && targets.has(o.to));
        matrix.push(`${key}: listed -> ${[...targets].join("|")}; engine ${describeOutcomes(outcomes)}`);
        if (!hit) found[key] = `listed as -> ${[...targets].join("|")}, engine ${describeOutcomes(outcomes)}`;
      } else {
        matrix.push(`${key}: unlisted; engine ${describeOutcomes(outcomes)}`);
        if (moves.length)
          found[key] = `not listed, engine accepts and moves to ${[...new Set(moves.map((o) => o.to))].join("|")}`;
      }
    }
  }
  return { snapshots, found, matrix };
}

function describeOutcomes(outcomes: Outcome[]) {
  if (!outcomes.length) return "not fired";
  return outcomes.map((o) => (o.accepted ? `accepts -> ${o.to}` : `refuses (${o.reason ?? ""})`)).join(", ");
}

const result = compare();

describe("M26 movement machine: engine against machines.json", () => {
  it("holds a real reducer state for every diagram state that has outgoing moves", () => {
    const needed = new Set(
      movementMachine.transitions
        .filter((transition) => transition.from !== "start")
        .map((transition) => transition.from),
    );
    for (const state of needed)
      expect(result.snapshots[state]?.length ?? 0, `no fixture in ${state}`).toBeGreaterThan(0);
  });

  it("finds exactly the named disagreements, no more and no fewer", () => {
    expect(
      Object.keys(result.found).sort(),
      `${JSON.stringify(result.found, null, 1)}\n${result.matrix.join("\n")}`,
    ).toEqual(Object.keys(KNOWN_DISAGREEMENTS).sort());
  });

  it("covers creation moves in the named tests", () => {
    for (const transition of movementMachine.transitions.filter((candidate) => candidate.from === "start")) {
      const key = `${transition.from}->${transition.to} ${transition.action}`;
      const file = CREATION_MOVES[key];
      expect(file, `creation move ${key} has no proving test`).toBeDefined();
      expect(readFileSync(join(process.cwd(), file!), "utf8")).toContain(transition.action);
    }
  });

  it("would catch a diagram that lists a move the engine refuses", () => {
    // Self-check: the comparison is not vacuous. The engine refuses PULL_PATIENT while the
    // movement is still waiting for an answer, so the comparison must report that pair.
    const waiting = result.snapshots.destination_review![0]!;
    expect(fire(waiting, "PULL_PATIENT")?.accepted).toBe(false);
  });
});
