// tests/ward-audit-m26-other-machines.test.ts
//
// Audit item M26, batch Z2: the other ten machines in docs/ward-flow/journey/machines.json
// (referral, admission, transport, bed release, expects, legal status, examination, notice, inbox,
// legal form), proved against the real reducer. The movement machine has its own file
// (ward-audit-m26-machine-moves.test.ts) and the same method:
//
//   - machines.json is READ here, never copied;
//   - each machine gets real reducer states in each diagram state (seed records, or states built by
//     driving the reducer, never by writing fields);
//   - every action the diagram names for that machine is fired from every state;
//   - a move the diagram lists must be accepted and land on the diagram's target state;
//   - a move the diagram does not list must be refused, or accepted without moving the state;
//   - where the engine and the diagram disagree the pair goes in that machine's named list below,
//     with a question for Josh. Nothing here decides which side is right. The check is two-way: a
//     new disagreement fails, and so does a listed one that has stopped disagreeing.
//
// Creation moves (from a "start" state) are proved by driving the reducer from before the record
// exists, and are checked against the diagram's target.

import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { GENDER_PLACEMENT_REASONS, STOP_TRANSPORT_REASONS } from "@/components/ward-management/ward-change-reasons";
import type { CareChange } from "@/components/ward-management/ward-care-journey";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Instant } from "@/components/ward-management/ward-clock";
import { LEAVING_DESTINATIONS } from "@/components/ward-management/ward-admissions";
import { communityTeamOptions } from "@/components/ward-management/referrals/referral-destination-options";
import { eligibility } from "@/components/ward-management/ward-eligibility";
import { INBOX_CATEGORIES, inboxItemKindOf } from "@/components/ward-management/ward-inbox-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { transportLeg } from "@/components/ward-management/ward-derivations-transport";

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
const machineOf = (id: string) => machines.find((machine) => machine.id === id)!;

type Subject = { state: WardFlowState; id: string };
type Outcome = { accepted: boolean; to: string[]; reason?: string };

/** What the engine does when an action is fired. `undefined` means the action has no event for this subject. */
type Spec = {
  machine: string;
  /** The diagram labels the record holds: its state first, then any flags sitting on top of it. */
  stateOf: (state: WardFlowState, id: string) => string[];
  fixtures: () => Record<string, Subject[]>;
  /** The next state, or undefined when no well-formed event exists for this action and subject. */
  apply: (action: string, subject: Subject) => WardFlowState | WardFlowState[] | undefined;
  /** Diagram arrows that do not start from a state with a record, or that are proved elsewhere. */
  skipListed?: (transition: Machine["transitions"][number]) => boolean;
};

const t = (minutes: number): Instant => NOW_ANCHOR + minutes;
const reached = new WeakMap<WardFlowState, Instant>();
const later = (state: WardFlowState, minutes = 1): Instant => (reached.get(state) ?? NOW_ANCHOR) + minutes;

function step(state: WardFlowState, event: WardFlowEvent, label: string): WardFlowState {
  const next = wardFlowReducer(state, event);
  if (next.rejections.length !== state.rejections.length)
    throw new Error(`fixture step ${label} was refused: ${JSON.stringify(next.rejections.at(-1))}`);
  reached.set(next, event.now);
  return next;
}
const refused = (before: WardFlowState, after: WardFlowState) => after.rejections.length !== before.rejections.length;
const movementOf = (state: WardFlowState, id: string) => state.movements.find((movement) => movement.id === id)!;

// --- movement chain (the same real journey the movement test drives), used by several machines ---

const MOVE = "WF-012";
const UNIT_DECLINED = "rgh-adult-secure";
const UNIT_ACCEPTED = "rph-adult-secure";

function journey() {
  const refer = (unitId: string, now: Instant) =>
    ({
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now,
      movementId: MOVE,
      unitIds: [unitId],
      genderPlacementReason: GENDER_PLACEMENT_REASONS[0],
      genderPlacementChecked: true,
    }) as WardFlowEvent;
  const s0 = seedWardFlowState();
  const s1 = step(s0, refer(UNIT_DECLINED, t(10)), "refer");
  const s2 = step(
    s1,
    {
      type: "DECLINE",
      role: "ward",
      now: t(20),
      movementId: MOVE,
      unitId: UNIT_DECLINED,
      actingUnitId: UNIT_DECLINED,
      reason: "capability_mismatch",
    },
    "decline",
  );
  const s3 = step(s2, refer(UNIT_ACCEPTED, t(30)), "re-refer");
  const accepted = step(
    s3,
    {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      now: t(40),
      movementId: MOVE,
      unitId: UNIT_ACCEPTED,
      actingUnitId: UNIT_ACCEPTED,
    },
    "accept",
  );
  const pulled = step(
    accepted,
    {
      type: "PULL_PATIENT",
      role: "ward",
      now: t(50),
      movementId: MOVE,
      unitId: UNIT_ACCEPTED,
      actingUnitId: UNIT_ACCEPTED,
    },
    "pull",
  );
  const booked = step(
    pulled,
    {
      type: "BOOK_TRANSPORT",
      role: "ed",
      now: t(60),
      movementId: MOVE,
      provider: "Ambulance service",
      escortRequired: true,
      cadNumber: "CAD-STUB-0001",
      transportLegalStatus: "voluntary",
      estimatedAt: 0,
    },
    "book",
  );
  const ready = step(booked, { type: "HANDOVER_READY", role: "ed", now: t(70), movementId: MOVE }, "handover ready");
  const crew = step(ready, { type: "TRANSPORT_ACCEPTED", role: "officer", now: t(80), movementId: MOVE }, "crew");
  const enroute = step(crew, { type: "TRANSPORT_EN_ROUTE", role: "officer", now: t(90), movementId: MOVE }, "en route");
  const collected = step(
    enroute,
    { type: "PATIENT_COLLECTED", role: "officer", now: t(100), movementId: MOVE },
    "collected",
  );
  const arrived = step(
    collected,
    { type: "PATIENT_ARRIVED", role: "coordinator", now: t(110), movementId: MOVE },
    "arrived",
  );
  const cancelled = step(
    booked,
    { type: "CANCEL_TRANSPORT", role: "ed", now: t(65), movementId: MOVE, reason: "job_created_in_error" },
    "cancel transport",
  );
  const stopped = step(
    collected,
    {
      type: "STOP_TRANSPORT",
      role: "coordinator",
      now: t(105),
      movementId: MOVE,
      reason: STOP_TRANSPORT_REASONS[1],
      whereabouts: "Back at the sending emergency department",
    } as WardFlowEvent,
    "stop transport",
  );
  // A conclusive examination while the bed is pulled, so a legal-form patient can go to a community team.
  const examined = step(
    pulled,
    { type: "RECORD_EXAMINATION", role: "ed", now: t(55), movementId: MOVE, outcome: "inpatient_order" },
    "inpatient order while pulled",
  );
  return { s0, examined, accepted, pulled, booked, ready, crew, enroute, collected, arrived, cancelled, stopped };
}

// =====================================================================================================
// 1. referral destination (a destination arm of a referral)
// =====================================================================================================

const REF_UNIT_A = "rph-adult-secure";
const REF_UNIT_B = "rgh-adult-secure";
const wardArm = (state: WardFlowState, id: string) => {
  const [referralId, unitId] = id.split("|");
  const referral = state.referrals.find((candidate) => candidate.id === referralId)!;
  return referral.destinations.find(
    (addressing) =>
      addressing.destination.kind === "psychiatric_ward" &&
      (addressing.destination as { unitId?: string }).unitId === unitId,
  )!;
};

function receiveTwoWards(state: WardFlowState) {
  const ward = (unitId: string) => ({
    kind: "psychiatric_ward",
    unitId,
    sex: "Male",
    gender: "Male",
    secureBedNeeded: false,
    involuntaryBedNeeded: false,
    highAcuityNursingNeeded: false,
  });
  const next = step(
    state,
    {
      type: "RECEIVE_REFERRAL",
      role: "community",
      now: t(5),
      ageBand: "Adult",
      source: "community",
      urgency: 2,
      originSiteCode: "RPH",
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Armadale" },
      history: "",
      transportNeeded: false,
      destinations: [ward(REF_UNIT_A), ward(REF_UNIT_B)],
    } as WardFlowEvent,
    "receive referral",
  );
  return { next, id: next.referrals.at(-1)!.id };
}

const referralSpec: Spec = {
  machine: "referral",
  stateOf: (state, id) => {
    const arm = wardArm(state, id);
    // "withdrawn" is a flag on a still-queued arm; the arm's own state does not change.
    return arm.withdrawnAt !== undefined ? [arm.state, "withdrawn"] : [arm.state];
  },
  fixtures: () => {
    const base = seedWardFlowState();
    const { next: queued, id } = receiveTwoWards(base);
    const a = `${id}|${REF_UNIT_A}`;
    const b = `${id}|${REF_UNIT_B}`;
    const accept = (state: WardFlowState, unitId: string) =>
      step(
        state,
        {
          type: "ACCEPT_REFERRAL",
          role: "ward",
          now: t(20),
          referralId: id,
          destinationKind: "psychiatric_ward",
          unitId,
          actingUnitId: unitId,
        } as WardFlowEvent,
        "accept",
      );
    const accepted = accept(queued, REF_UNIT_A);
    const declined = step(
      queued,
      {
        type: "DECLINE_REFERRAL",
        role: "ward",
        now: t(20),
        referralId: id,
        destinationKind: "psychiatric_ward",
        unitId: REF_UNIT_B,
        actingUnitId: REF_UNIT_B,
        reason: "no_suitable_bed",
      } as WardFlowEvent,
      "decline",
    );
    const withdrawn = step(
      queued,
      { type: "RECORD_REFERRER_WITHDRAWAL", role: "community", now: t(15), referralId: id } as WardFlowEvent,
      "withdraw",
    );
    return {
      queued: [{ state: queued, id: a }],
      accepted: [{ state: accepted, id: a }],
      declined: [{ state: declined, id: b }],
      // the second ward's arm, after the first ward accepted
      cancelled: [{ state: accepted, id: b }],
      withdrawn: [{ state: withdrawn, id: a }],
    };
  },
  apply: (action, { state, id }) => {
    const [referralId, unitId] = id.split("|");
    const now = later(state);
    // The diagram's own note says an explicit clinical reassessment can turn a decline into an
    // acceptance, so an answered arm is also tried with the reassessment flag.
    const answered = wardArm(state, id).state !== "queued";
    const events: Record<string, WardFlowEvent> = {
      ACCEPT_REFERRAL: {
        type: "ACCEPT_REFERRAL",
        role: "ward",
        now,
        referralId,
        destinationKind: "psychiatric_ward",
        unitId,
        actingUnitId: unitId,
        ...(answered ? { reassessment: true, reassessmentNote: "Synthetic reassessment" } : {}),
      } as WardFlowEvent,
      DECLINE_REFERRAL: {
        type: "DECLINE_REFERRAL",
        role: "ward",
        now,
        referralId,
        destinationKind: "psychiatric_ward",
        unitId,
        actingUnitId: unitId,
        reason: "no_suitable_bed",
      } as WardFlowEvent,
      RECORD_REFERRER_WITHDRAWAL: {
        type: "RECORD_REFERRER_WITHDRAWAL",
        role: "community",
        now,
        referralId,
      } as WardFlowEvent,
    };
    const event = events[action];
    return event ? wardFlowReducer(state, event) : undefined;
  },
  skipListed: (transition) => transition.action === "RECEIVE_REFERRAL",
};

// =====================================================================================================
// 2. admission
// =====================================================================================================

/** "deleted" is the flag: the admission record is gone (a released pull is removed, not ended). */
const admissionState = (state: WardFlowState, id: string) => [
  state.admissions.find((admission) => admission.id === id)?.state ?? "deleted",
];

/** The receiving-ward arrangement the existing transfer test uses, applied to a clone. */
function transferred(state: WardFlowState, admissionId: string): WardFlowState | undefined {
  const clone = structuredClone(state);
  const admission = clone.admissions.find((candidate) => candidate.id === admissionId)!;
  if (!admission || admission.state !== "occupied" || !admission.patientId) return undefined;
  const base = clone.movements.find((m) => m.cohort === clone.units.find((u) => u.id === admission.unitId)?.cohort)!;
  base.admissionId = admission.id;
  base.patientId = admission.patientId;
  base.stage = "arrived";
  base.acceptedUnitId = admission.unitId;
  admission.movementId = base.id;
  clone.units = clone.units.map((u) => ({
    ...u,
    allocatable: { ...u.allocatable, confirmedAt: NOW_ANCHOR },
    empty: { ...u.empty, confirmedAt: NOW_ANCHOR },
  }));
  const target = clone.units.find(
    (u) => u.id !== admission.unitId && eligibility(base, u, NOW_ANCHOR).eligible && u.allocatableLocked > 0,
  );
  if (!target) return undefined;
  const command = (change: CareChange) =>
    ({
      type: "RECORD_ADMISSION_CARE",
      role: "coordinator",
      now: NOW_ANCHOR,
      admissionId,
      patientId: admission.patientId!,
      expectedGeneration: clone.worldGeneration,
      expectedRevision: clone.dischargeRevisions[admissionId] ?? 0,
      change,
    }) as WardFlowEvent;
  let next = clone;
  for (const stepName of ["accepted", "handover", "arrived"] as const) {
    const after = wardFlowReducer(next, {
      ...command({ kind: "transfer", receivingUnitId: target.id, step: stepName }),
      expectedGeneration: next.worldGeneration,
      expectedRevision: next.dischargeRevisions[admissionId] ?? 0,
    } as WardFlowEvent);
    if (refused(next, after)) return after;
    next = after;
  }
  return next;
}

function movementEventFor(action: string, state: WardFlowState, movementId: string): WardFlowEvent | undefined {
  const now = later(state);
  const movement = state.movements.find((candidate) => candidate.id === movementId);
  const unitId = movement?.acceptedUnitId ?? UNIT_ACCEPTED;
  const base = { now, movementId } as const;
  const events: Record<string, WardFlowEvent> = {
    PATIENT_ARRIVED: { ...base, type: "PATIENT_ARRIVED", role: "coordinator" },
    RELEASE_PULL: { ...base, type: "RELEASE_PULL", role: "coordinator", reason: "pull_made_in_error" },
    RELEASE_HELD_BED: { ...base, type: "RELEASE_HELD_BED", role: "coordinator" },
    WITHDRAW_REFERRAL: { ...base, type: "WITHDRAW_REFERRAL", role: "coordinator" },
    RECORD_ED_OUTCOME: { ...base, type: "RECORD_ED_OUTCOME", role: "ed", outcome: "for_community_follow_up" },
    RECORD_EXAMINATION: { ...base, type: "RECORD_EXAMINATION", role: "ed", outcome: "community_order" },
    PULL_PATIENT: { ...base, type: "PULL_PATIENT", role: "ward", unitId },
    REFER_TO_COMMUNITY_TEAM: {
      ...base,
      type: "REFER_TO_COMMUNITY_TEAM",
      role: "ed",
      team: communityTeamOptions()[0]!,
      purpose: "follow_up",
    } as WardFlowEvent,
  };
  return events[action];
}

function careEventsFor(action: string, state: WardFlowState, admissionId: string): WardFlowEvent | undefined {
  const admission = state.admissions.find((candidate) => candidate.id === admissionId);
  if (!admission) return undefined;
  const now = later(state);
  const events: Record<string, WardFlowEvent> = {
    RECORD_LEAVING: {
      type: "RECORD_LEAVING",
      role: "ward",
      now,
      admissionId,
      actingUnitId: admission.unitId,
      leavingDestination: LEAVING_DESTINATIONS[0]!.id,
    } as WardFlowEvent,
    RECORD_AWAY_AT_EMERGENCY_DEPARTMENT: {
      type: "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT",
      role: "ward",
      now,
      admissionId,
      actingUnitId: admission.unitId,
    } as WardFlowEvent,
    RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT: {
      type: "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT",
      role: "ward",
      now,
      admissionId,
      actingUnitId: admission.unitId,
    } as WardFlowEvent,
  };
  return events[action];
}

const admissionSpec: Spec = {
  machine: "admission",
  stateOf: admissionState,
  fixtures: () => {
    const seed = seedWardFlowState();
    const j = journey();
    const pulledAdmissionId = j.pulled.movements.find((m) => m.id === MOVE)!.admissionId!;
    const released = step(
      j.pulled,
      { type: "RELEASE_PULL", role: "coordinator", now: t(55), movementId: MOVE, reason: "pull_made_in_error" },
      "release pull",
    );
    const occupied = seed.admissions.filter((a) => a.state === "occupied" && a.patientId).slice(0, 6);
    const pulledSeed = seed.admissions.filter((a) => a.state === "pulled").map((a) => ({ state: seed, id: a.id }));
    const away = occupied[0]
      ? step(seed, careEventsFor("RECORD_AWAY_AT_EMERGENCY_DEPARTMENT", seed, occupied[0].id)!, "away")
      : seed;
    return {
      // every seed pull sits at a different movement stage, so each exit and arrival is tried
      pulled: [
        ...pulledSeed,
        { state: j.pulled, id: pulledAdmissionId },
        { state: j.collected, id: pulledAdmissionId },
        { state: j.stopped, id: pulledAdmissionId },
        { state: j.examined, id: pulledAdmissionId },
      ],
      occupied: [
        ...occupied.map((a) => ({ state: seed, id: a.id })),
        { state: away, id: occupied[0]!.id },
        { state: j.arrived, id: pulledAdmissionId },
      ],
      departed: seed.admissions
        .filter((a) => a.state === "departed")
        .slice(0, 2)
        .map((a) => ({ state: seed, id: a.id })),
      waitlisted: seed.admissions
        .filter((a) => a.state === "waitlisted")
        .slice(0, 2)
        .map((a) => ({ state: seed, id: a.id })),
      deleted: [{ state: released, id: pulledAdmissionId }],
    };
  },
  apply: (action, { state, id }) => {
    if (action === "RECORD_ADMISSION_CARE") return transferred(state, id);
    const careEvent = careEventsFor(action, state, id);
    if (careEvent) return wardFlowReducer(state, careEvent);
    const admission = state.admissions.find((candidate) => candidate.id === id);
    if (!admission?.movementId) return undefined;
    const event = movementEventFor(action, state, admission.movementId);
    return event ? wardFlowReducer(state, event) : undefined;
  },
  skipListed: (transition) => transition.from === "none",
};

// =====================================================================================================
// 3. transport job
// =====================================================================================================

function transportState(state: WardFlowState, id: string): string[] {
  const transport = movementOf(state, id).transport;
  if (transport?.stoppedAt !== undefined) return ["stopped"];
  const leg = transportLeg(transport);
  if (!leg) return ["none"];
  const names = {
    Requested: "booked",
    Accepted: "accepted",
    "En route": "enroute",
    Collected: "collected",
    Arrived: "arrived",
    Cancelled: "cancelled",
  };
  return [names[leg]];
}

const transportSpec: Spec = {
  machine: "transport",
  stateOf: transportState,
  fixtures: () => {
    const j = journey();
    const of = (state: WardFlowState) => ({ state, id: MOVE });
    return {
      // after a cancel the engine holds no job at all (it deletes it), so that state is "none" too
      none: [of(j.pulled), of(j.cancelled)],
      booked: [of(j.booked), of(j.ready)],
      // `HANDOVER_READY` precedes the crew's acceptance, so the accepted job sits at handover-ready
      accepted: [of(j.crew)],
      enroute: [of(j.enroute)],
      collected: [of(j.collected)],
      arrived: [of(j.arrived)],
      stopped: [of(j.stopped)],
    };
  },
  apply: (action, { state, id }) => {
    const now = later(state);
    const base = { now, movementId: id } as const;
    const events: Record<string, WardFlowEvent> = {
      BOOK_TRANSPORT: {
        ...base,
        type: "BOOK_TRANSPORT",
        role: "ed",
        provider: "Ambulance service",
        escortRequired: true,
        cadNumber: "CAD-STUB-0002",
        transportLegalStatus: "voluntary",
        estimatedAt: 0,
      } as WardFlowEvent,
      TRANSPORT_ACCEPTED: { ...base, type: "TRANSPORT_ACCEPTED", role: "officer" },
      TRANSPORT_EN_ROUTE: { ...base, type: "TRANSPORT_EN_ROUTE", role: "officer" },
      PATIENT_COLLECTED: { ...base, type: "PATIENT_COLLECTED", role: "officer" },
      PATIENT_ARRIVED: { ...base, type: "PATIENT_ARRIVED", role: "coordinator" },
      CANCEL_TRANSPORT: { ...base, type: "CANCEL_TRANSPORT", role: "ed", reason: "job_created_in_error" },
      STOP_TRANSPORT: {
        ...base,
        type: "STOP_TRANSPORT",
        role: "coordinator",
        reason: STOP_TRANSPORT_REASONS[1],
        whereabouts: "Back at the sending emergency department",
      } as WardFlowEvent,
    };
    return events[action] ? wardFlowReducer(state, events[action]) : undefined;
  },
};

// =====================================================================================================
// 4. bed release
// =====================================================================================================

const releaseOf = (state: WardFlowState, id: string) => state.bedReleases.find((release) => release.id === id)!;
function releaseState(state: WardFlowState, id: string): string[] {
  const release = state.bedReleases.find((candidate) => candidate.id === id);
  if (!release) return ["none"];
  // "blocked" and "preparing" are flags that sit on top of a state, not states of their own.
  return [release.state, ...(release.blocker ? ["blocked"] : []), ...(release.preparing ? ["preparing"] : [])];
}

const bedReleaseSpec: Spec = {
  machine: "bedrelease",
  stateOf: releaseState,
  fixtures: () => {
    const seed = seedWardFlowState();
    const sub = (id: string) => ({ state: seed, id });
    const plain = seed.bedReleases.filter((r) => r.state === "expected" && !r.blocker && !r.preparing);
    const blocked = seed.bedReleases.filter((r) => r.state === "expected" && r.blocker);
    const confirmed = seed.bedReleases.filter((r) => r.state === "confirmed");
    const discharged = seed.bedReleases.filter((r) => r.state === "discharged");
    const prepared = step(
      seed,
      {
        type: "SET_BED_PREPARATION",
        role: "ward",
        now: t(5),
        releaseId: plain[0]!.id,
        actingUnitId: plain[0]!.unitId,
        preparing: true,
      } as WardFlowEvent,
      "prepare",
    );
    return {
      expected: plain.slice(0, 3).map((r) => sub(r.id)),
      confirmed: confirmed.slice(0, 3).map((r) => sub(r.id)),
      discharged: discharged.slice(0, 2).map((r) => sub(r.id)),
      blocked: blocked.slice(0, 2).map((r) => sub(r.id)),
      preparing: [{ state: prepared, id: plain[0]!.id }],
    };
  },
  apply: (action, { state, id }) => {
    const release = releaseOf(state, id);
    const now = later(state);
    const base = { now, releaseId: id, actingUnitId: release.unitId, role: "ward" } as const;
    if (action === "RECORD_ADMISSION_CARE") return transferred(state, release.admissionId);
    const events: Record<string, WardFlowEvent> = {
      CONFIRM_BED_RELEASE: { ...base, type: "CONFIRM_BED_RELEASE" } as WardFlowEvent,
      REVERT_BED_RELEASE: { ...base, type: "REVERT_BED_RELEASE", waitingOn: "Awaiting ward round" } as WardFlowEvent,
      BLOCK_BED_RELEASE: { ...base, type: "BLOCK_BED_RELEASE", blocker: "Awaiting clean" } as WardFlowEvent,
      CLEAR_BED_RELEASE_BLOCK: { ...base, type: "CLEAR_BED_RELEASE_BLOCK" } as WardFlowEvent,
      SET_BED_PREPARATION: { ...base, type: "SET_BED_PREPARATION", preparing: true } as WardFlowEvent,
      RECORD_LEAVING: {
        type: "RECORD_LEAVING",
        role: "ward",
        now,
        admissionId: release.admissionId,
        actingUnitId: release.unitId,
        leavingDestination: LEAVING_DESTINATIONS[0]!.id,
      } as WardFlowEvent,
    };
    return events[action] ? wardFlowReducer(state, events[action]) : undefined;
  },
  skipListed: (transition) => transition.from === "none",
};

// =====================================================================================================
// 5. expects (the front door)
// =====================================================================================================

const referralOf = (state: WardFlowState, id: string) => state.referrals.find((referral) => referral.id === id)!;
function expectState(state: WardFlowState, id: string): string[] {
  const referral = referralOf(state, id);
  return [
    referral.inDepartmentAt !== undefined ? "present" : "expected",
    ...(referral.medicalClearance !== undefined ? ["cleared"] : []),
  ];
}

const expectsSpec: Spec = {
  machine: "expects",
  stateOf: expectState,
  fixtures: () => {
    const seed = seedWardFlowState();
    const waiting = seed.referrals.filter((r) => r.inDepartmentAt === undefined && r.medicalClearance === undefined);
    const id = waiting[0]!.id;
    const present = step(
      seed,
      { type: "RECORD_ARRIVED_IN_DEPARTMENT", role: "ed", now: t(5), referralId: id } as WardFlowEvent,
      "present",
    );
    const cleared = step(
      present,
      { type: "RECORD_MEDICAL_CLEARANCE", role: "ed", now: t(8), referralId: id, cleared: true } as WardFlowEvent,
      "cleared",
    );
    const presentSeed = seed.referrals.filter(
      (r) => r.inDepartmentAt !== undefined && r.medicalClearance === undefined,
    );
    return {
      expected: [{ state: seed, id }, ...(waiting[1] ? [{ state: seed, id: waiting[1].id }] : [])],
      present: [{ state: present, id }, ...(presentSeed[0] ? [{ state: seed, id: presentSeed[0].id }] : [])],
      cleared: [{ state: cleared, id }],
    };
  },
  apply: (action, { state, id }) => {
    const now = later(state);
    const events: Record<string, WardFlowEvent> = {
      RECORD_ARRIVED_IN_DEPARTMENT: {
        type: "RECORD_ARRIVED_IN_DEPARTMENT",
        role: "ed",
        now,
        referralId: id,
      } as WardFlowEvent,
      RECORD_MEDICAL_CLEARANCE: {
        type: "RECORD_MEDICAL_CLEARANCE",
        role: "ed",
        now,
        referralId: id,
        cleared: true,
      } as WardFlowEvent,
    };
    return events[action] ? wardFlowReducer(state, events[action]) : undefined;
  },
  skipListed: (transition) => transition.action === "RECEIVE_REFERRAL",
};

// =====================================================================================================
// 6. legal status, 7. examination, 9 (legal form) — all on an open movement
// =====================================================================================================

const LEGAL = {
  voluntary: "Voluntary",
  referred: "Referred for psychiatric examination",
  detained: "Detained awaiting examination",
  involuntary: "Involuntary inpatient",
} as const;
const legalKey = (value: string) => [
  Object.entries(LEGAL).find(([, label]) => label === value)?.[0] ?? `unknown:${value}`,
];

const openMovements = (state: WardFlowState) =>
  state.movements.filter((movement) => !movement.closure && movement.stage !== "arrived");

const legalStatusSpec: Spec = {
  machine: "legalstatus",
  stateOf: (state, id) => legalKey(movementOf(state, id).legalStatus),
  fixtures: () => {
    const seed = seedWardFlowState();
    const out: Record<string, Subject[]> = {};
    for (const [key, label] of Object.entries(LEGAL))
      out[key] = openMovements(seed)
        .filter((m) => m.legalStatus === label)
        .slice(0, 3)
        .map((m) => ({ state: seed, id: m.id }));
    return out;
  },
  // Every one of the four values is tried from each state, so the unlisted pairs are checked too.
  apply: (action, { state, id }) =>
    action === "CHANGE_LEGAL_STATUS"
      ? Object.values(LEGAL).map((legalStatus) =>
          wardFlowReducer(state, {
            type: "CHANGE_LEGAL_STATUS",
            role: "coordinator",
            now: later(state),
            movementId: id,
            legalStatus,
            reason: "recorded_by_treating_team",
          } as WardFlowEvent),
        )
      : undefined,
};

function examinationState(state: WardFlowState, id: string): string[] {
  const movement = movementOf(state, id);
  const base = (() => {
    switch (movement.examination?.outcome) {
      case undefined:
        return "none";
      case "further_examination_ordered":
        return "further";
      case "inpatient_order":
        return "inpatient";
      default:
        return "ended";
    }
  })();
  return movement.supersededExaminations?.length ? [base, "superseded"] : [base];
}

const OUTCOMES = ["further_examination_ordered", "inpatient_order", "community_order", "revoked"] as const;
const recordExamination = (state: WardFlowState, outcome: (typeof OUTCOMES)[number], at: number) =>
  step(
    state,
    { type: "RECORD_EXAMINATION", role: "ed", now: t(at), movementId: MOVE, outcome } as WardFlowEvent,
    `exam ${outcome}`,
  );
const examinationSpec: Spec = {
  machine: "examination",
  stateOf: examinationState,
  fixtures: () => {
    const j = journey();
    const further = recordExamination(j.pulled, "further_examination_ordered", 56);
    return {
      none: [
        { state: j.pulled, id: MOVE },
        { state: j.s0, id: MOVE },
      ],
      further: [{ state: further, id: MOVE }],
      inpatient: [{ state: j.examined, id: MOVE }],
      ended: [
        { state: recordExamination(j.s0, "community_order", 12), id: MOVE },
        { state: recordExamination(j.s0, "revoked", 12), id: MOVE },
      ],
      superseded: [{ state: recordExamination(further, "inpatient_order", 58), id: MOVE }],
    };
  },
  apply: (action, { state, id }) =>
    action === "RECORD_EXAMINATION"
      ? OUTCOMES.map((outcome) =>
          wardFlowReducer(state, {
            type: "RECORD_EXAMINATION",
            role: "ed",
            now: later(state),
            movementId: id,
            outcome,
          } as WardFlowEvent),
        )
      : undefined,
};

function legalFormState(state: WardFlowState, id: string): string[] {
  const movement = movementOf(state, id);
  return [
    movement.legalFormReceivedAt === undefined ? "not" : "received",
    ...(movement.legalForm?.dueAt === undefined ? [] : ["expiry"]),
  ];
}
const legalFormSpec: Spec = {
  machine: "legalform",
  stateOf: legalFormState,
  fixtures: () => {
    const j = journey();
    const received = step(
      j.pulled,
      { type: "RECORD_LEGAL_FORM_RECEIVED", role: "ed", now: t(52), movementId: MOVE } as WardFlowEvent,
      "received",
    );
    const expiry = (state: WardFlowState, at: number) =>
      step(
        state,
        { type: "RECORD_LEGAL_FORM_EXPIRY", role: "ed", now: t(at), movementId: MOVE, dueAt: t(900) } as WardFlowEvent,
        "expiry",
      );
    return {
      not: [
        { state: j.pulled, id: MOVE },
        { state: j.s0, id: MOVE },
      ],
      received: [{ state: received, id: MOVE }],
      expiry: [
        { state: expiry(received, 53), id: MOVE },
        { state: expiry(j.pulled, 52), id: MOVE },
      ],
    };
  },
  apply: (action, { state, id }) => {
    const now = later(state);
    const events: Record<string, WardFlowEvent> = {
      RECORD_LEGAL_FORM_RECEIVED: {
        type: "RECORD_LEGAL_FORM_RECEIVED",
        role: "ed",
        now,
        movementId: id,
      } as WardFlowEvent,
      CORRECT_LEGAL_FORM_RECEIPT: {
        type: "CORRECT_LEGAL_FORM_RECEIPT",
        role: "ed",
        now,
        movementId: id,
        reason: "recorded_in_error",
      } as WardFlowEvent,
      RECORD_LEGAL_FORM_EXPIRY: {
        type: "RECORD_LEGAL_FORM_EXPIRY",
        role: "ed",
        now,
        movementId: id,
        dueAt: now + 2000,
      } as WardFlowEvent,
    };
    return events[action] ? wardFlowReducer(state, events[action]) : undefined;
  },
};

// 8. notice and 9. inbox row. Each subject is one notice or one row.

const noticeOf = (state: WardFlowState, id: string) => state.notices.find((notice) => notice.id === id)!;
const noticeSpec: Spec = {
  machine: "notice",
  stateOf: (state, id) => [
    state.notices.some((notice) => notice.id === id && notice.readAt !== undefined) ? "read" : "unread",
  ],
  fixtures: () => {
    const j = journey();
    // ACCEPT_IN_PRINCIPLE tells the referring ED; the notice is the record under test.
    const unreadState = j.accepted;
    const notice = unreadState.notices.at(-1)!;
    const readState = step(
      unreadState,
      {
        type: "MARK_NOTICE_READ",
        role: notice.to.role,
        now: t(45),
        noticeId: notice.id,
        actingPlaceId: notice.to.placeId,
      } as WardFlowEvent,
      "mark read",
    );
    return { unread: [{ state: unreadState, id: notice.id }], read: [{ state: readState, id: notice.id }] };
  },
  apply: (action, { state, id }) => {
    if (action !== "MARK_NOTICE_READ") return undefined;
    const notice = noticeOf(state, id);
    return wardFlowReducer(state, {
      type: "MARK_NOTICE_READ",
      role: notice.to.role,
      now: later(state),
      noticeId: id,
      actingPlaceId: notice.to.placeId,
    } as WardFlowEvent);
  },
  skipListed: (transition) => transition.from === "none",
};

const DAILY = `${INBOX_CATEGORIES.daily_check.idPrefix}day-0`;
const factRow = (state: WardFlowState) =>
  `${INBOX_CATEGORIES.transport_awaiting_departure.idPrefix}${state.movements[0]!.id}`;
const inboxState = (state: WardFlowState, id: string): string[] => {
  const history = state.inboxCompletions[id] ?? [];
  if (history.at(-1)?.kind === "completed") return ["ticked"];
  if ((state.inboxAcknowledgements[id] ?? []).length) return ["acknowledged"];
  return [inboxItemKindOf(id) === undefined ? "absent" : "showing"];
};
const inboxSpec: Spec = {
  machine: "inbox",
  stateOf: inboxState,
  fixtures: () => {
    const seed = seedWardFlowState();
    const send = (state: WardFlowState, type: string, id: string, at: number) =>
      step(state, { type, role: "coordinator", now: t(at), inboxItemId: id } as WardFlowEvent, `${type} ${id}`);
    const fact = factRow(seed);
    return {
      absent: [{ state: seed, id: "not-a-real-row-0" }],
      showing: [
        { state: seed, id: fact },
        { state: seed, id: DAILY },
      ],
      // The engine refuses to acknowledge a commitment row, so only a fact row can be here.
      acknowledged: [{ state: send(seed, "ACKNOWLEDGE_INBOX_ITEM", fact, 5), id: fact }],
      ticked: [{ state: send(seed, "COMPLETE_INBOX_ITEM", DAILY, 6), id: DAILY }],
    };
  },
  apply: (action, { state, id }) => {
    const known = ["ACKNOWLEDGE_INBOX_ITEM", "COMPLETE_INBOX_ITEM", "REOPEN_INBOX_ITEM"];
    if (!known.includes(action)) return undefined;
    return wardFlowReducer(state, {
      type: action,
      role: "coordinator",
      now: later(state),
      inboxItemId: id,
    } as WardFlowEvent);
  },
  skipListed: (transition) => transition.from === "absent",
};

// =====================================================================================================
// the comparison
// =====================================================================================================

function compare(spec: Spec) {
  const machine = machineOf(spec.machine);
  const fixtures = spec.fixtures();
  const actions = [...new Set(machine.transitions.map((transition) => transition.action))];
  const listed = new Map<string, Set<string>>();
  for (const transition of machine.transitions) {
    if (spec.skipListed?.(transition)) continue;
    const key = `${transition.from} ${transition.action}`;
    if (!listed.has(key)) listed.set(key, new Set());
    listed.get(key)!.add(transition.to);
  }
  const found: Record<string, string> = {};
  const matrix: string[] = [];
  for (const state of machine.states) {
    const held = fixtures[state.id] ?? [];
    for (const action of actions) {
      const key = `${state.id} ${action}`;
      const outcomes: (Outcome & { before: string[] })[] = [];
      for (const subject of held) {
        const applied = spec.apply(action, subject);
        for (const next of applied === undefined ? [] : Array.isArray(applied) ? applied : [applied]) {
          const accepted = !refused(subject.state, next);
          outcomes.push({
            accepted,
            before: spec.stateOf(subject.state, subject.id),
            to: spec.stateOf(next, subject.id),
            reason: accepted ? undefined : next.rejections.at(-1)?.reason,
          });
        }
      }
      const targets = listed.get(key);
      const describe = outcomes.length
        ? [
            ...new Set(
              outcomes.map((o) =>
                o.accepted ? `accepts -> ${o.to.join("+")}` : `refuses (${(o.reason ?? "").slice(0, 70)})`,
              ),
            ),
          ].join(", ")
        : "not fired";
      if (targets) {
        matrix.push(`${key}: listed -> ${[...targets].join("|")}; engine ${describe}`);
        const hit = outcomes.some(
          (o) =>
            o.accepted &&
            [...targets].some(
              (target) => o.to.includes(target) && (target === state.id || o.to.join() !== o.before.join()),
            ),
        );
        if (!hit) found[key] = `listed as -> ${[...targets].join("|")}, engine ${describe}`;
        else {
          // The arrow is honoured, but the engine also sets a flag the diagram does not draw on it.
          // (A drawn flag, such as "superseded", rides on whatever state the record lands in.)
          const extra = outcomes.flatMap((o) => {
            if (!o.accepted) return [];
            const flagDrawn = o.to.slice(1).some((label) => targets.has(label));
            return o.to.filter(
              (label, index) => !o.before.includes(label) && !targets.has(label) && !(index === 0 && flagDrawn),
            );
          });
          if (extra.length)
            found[key] = `listed as -> ${[...targets].join("|")}, engine also reaches ${[...new Set(extra)].join("|")}`;
        }
      } else {
        matrix.push(`${key}: unlisted; engine ${describe}`);
        // A flag sits on top of its base state, so what the base state's own arrow allows is not extra.
        const moves = outcomes.flatMap((o) => {
          if (!o.accepted) return [];
          const inherited = listed.get(`${o.before[0]} ${action}`) ?? new Set<string>();
          return o.to.filter((label) => !o.before.includes(label) && !inherited.has(label));
        });
        if (moves.length) found[key] = `not listed, engine accepts and moves to ${[...new Set(moves)].join("|")}`;
      }
    }
  }
  return { fixtures, found, matrix };
}

/**
 * Engine and diagram disagree on these pairs. Each is a question for Josh, not a verdict: either
 * the diagram is wrong (fix machines.json) or the engine is (a clinical-behaviour change he rules on).
 * Key: "<from> <ACTION>". Value: the question. Josh answered Z1 to Z12 on 10 Nov 2026 (D-131): the
 * diagram follows the engine, so only Z7 (note only, by design) is still listed below.
 */
const Z = {
  reassess:
    "Z1 reassessment: the diagram note says a clinical reassessment can turn a decline into an acceptance, but draws no arrow out of Declined (the engine accepts it with reassessment set). Should machines.json draw it?",
  cancel:
    "Z2 cancel transport: the diagram draws a Cancelled state; the engine deletes the job on cancel (the movement then holds no job, as the note says), so Cancelled is never reached. Remove the state, or keep a cancelled record?",
  prepare:
    "Z3 bed preparation on departure: recording the person leaving (or a ward transfer arriving) also sets the Being made ready flag, which the diagram does not draw on the Discharged arrows. Should it?",
  flagOnConfirmed:
    "Z4 stuck flag on a confirmed release: the state note says Stuck sits on top of Expected or Confirmed, but the only arrow starts at Expected. The engine accepts the flag on a confirmed release. Draw it?",
  prepareFromOther:
    "Z5 preparing flag: the diagram draws it from Expected only; the engine also sets it on a confirmed or already discharged release (the bed is made ready after the person leaves). Draw it?",
  clearance:
    "Z6 medical clearance: the diagram draws it from In the department only; the engine records clearance while the patient is still only expected. Which is right?",
  legalPairs:
    "Z7 legal status: the diagram note says any value can be recorded as any other and the four arrows are examples, which matches the engine (it also accepts the same value again). Should the other eight pairs be drawn, or the note be the only statement?",
  completeFromShowing:
    "Z9 daily check: the engine lets a commitment row be completed straight from Showing, and refuses to acknowledge a commitment row at all. The diagram draws Showing -> Acknowledged -> Ticked. Which is right?",
  ackThenTick:
    "Z10 acknowledge then tick: the diagram draws Acknowledged -> Ticked, but a fact row (the only kind that can be acknowledged) refuses completion. Should the arrow be removed?",
  reopen:
    "Z11 reopen: the diagram draws Ticked -> Acknowledged on reopen; the engine returns the row to Showing (a commitment is never acknowledged). Which is right?",
  expiryBeforeReceipt:
    "Z12 legal form expiry: the diagram draws it from Recorded as received only; its own note says expiry need not wait for a receipt and the engine agrees. Should the arrow start at Not recorded too?",
} as const;

const KNOWN: Record<string, Record<string, string>> = {
  referral: {},
  admission: {},
  transport: {},
  bedrelease: {},
  expects: {},
  // Z7 stays listed: Josh ruled the note is the statement and no more arrows are drawn (D-131,
  // 10 Nov 2026). The four arrows are examples, so the engine's other pairs still read as extra here.
  legalstatus: {
    "voluntary CHANGE_LEGAL_STATUS": Z.legalPairs,
    "referred CHANGE_LEGAL_STATUS": Z.legalPairs,
    "detained CHANGE_LEGAL_STATUS": Z.legalPairs,
    "involuntary CHANGE_LEGAL_STATUS": Z.legalPairs,
  },
  examination: {},
  notice: {},
  inbox: {},
  legalform: {},
};

const SPECS: Spec[] = [
  referralSpec,
  admissionSpec,
  transportSpec,
  bedReleaseSpec,
  expectsSpec,
  legalStatusSpec,
  examinationSpec,
  noticeSpec,
  inboxSpec,
  legalFormSpec,
];

describe.each(SPECS)("M26 $machine machine: engine against machines.json", (spec) => {
  const result = compare(spec);
  if (process.env.WF_MATRIX) appendFileSync(process.env.WF_MATRIX, `## ${spec.machine}\n${result.matrix.join("\n")}\n`);
  it("holds real reducer states for every diagram state with outgoing moves", () => {
    const needed = new Set(
      machineOf(spec.machine)
        .transitions.filter((transition) => !spec.skipListed?.(transition))
        .map((transition) => transition.from),
    );
    for (const state of needed)
      expect(result.fixtures[state]?.length ?? 0, `no fixture in ${state}`).toBeGreaterThan(0);
  });
  it("finds exactly the named disagreements, no more and no fewer", () => {
    expect(
      Object.keys(result.found).sort(),
      `${JSON.stringify(result.found, null, 1)}\n${result.matrix.join("\n")}`,
    ).toEqual(Object.keys(KNOWN[spec.machine] ?? {}).sort());
  });
});

// =====================================================================================================
// Creation moves and side effects the arrow-by-arrow comparison cannot fire.
// =====================================================================================================

describe("M26 creation moves land where machines.json says", () => {
  it("referral: a received referral holds each addressed ward as waiting (start -> queued)", () => {
    const { next, id } = receiveTwoWards(seedWardFlowState());
    expect(referralSpec.stateOf(next, `${id}|${REF_UNIT_A}`)).toEqual(["queued"]);
    expect(referralSpec.stateOf(next, `${id}|${REF_UNIT_B}`)).toEqual(["queued"]);
  });

  it("referral: the first ward to accept cancels the other waiting ward (queued -> cancelled, side)", () => {
    const [accepted] = referralSpec.fixtures().accepted!;
    const other = accepted!.id.replace(REF_UNIT_A, REF_UNIT_B);
    expect(referralSpec.stateOf(accepted!.state, other)).toEqual(["cancelled"]);
  });

  it("admission: pulling a bed creates a held admission (none -> pulled)", () => {
    const { accepted, pulled } = journey();
    const before = accepted.admissions.length;
    const admissionId = movementOf(pulled, MOVE).admissionId!;
    expect(pulled.admissions.length).toBe(before + 1);
    expect(admissionState(pulled, admissionId)).toEqual(["pulled"]);
  });

  it("admission: an arrived ward transfer gives the receiving ward a new occupied admission (none -> occupied, skip)", () => {
    const seed = seedWardFlowState();
    const source = seed.admissions.find((a) => a.state === "occupied" && a.patientId && transferred(seed, a.id));
    const after = transferred(seed, source!.id)!;
    const added = after.admissions.filter((a) => !seed.admissions.some((old) => old.id === a.id));
    expect(added).toHaveLength(1);
    expect(added[0]!.state).toBe("occupied");
    expect(added[0]!.movementId && movementOf(after, added[0]!.movementId).stage).toBe("arrived");
  });

  it("bed release: flagging a coming-free bed starts it as expected (none -> expected)", () => {
    const seed = seedWardFlowState();
    const admission = seed.admissions.find(
      (a) => a.state === "occupied" && !seed.bedReleases.some((release) => release.admissionId === a.id),
    )!;
    const next = step(
      seed,
      {
        type: "FLAG_BED_RELEASE",
        role: "ward",
        now: t(5),
        unitId: admission.unitId,
        actingUnitId: admission.unitId,
        admissionId: admission.id,
        waitingOn: "Awaiting ward round",
        expectedAt: t(600),
      } as WardFlowEvent,
      "flag bed release",
    );
    const release = next.bedReleases.find((candidate) => candidate.admissionId === admission.id)!;
    expect(releaseState(next, release.id)).toEqual(["expected"]);
  });

  it("expects: a received referral waits as expected until the patient is marked present (raised -> expected)", () => {
    const { next, id } = receiveTwoWards(seedWardFlowState());
    expect(expectState(next, id)).toEqual(["expected"]);
  });

  it("notice: a ward accepting an ED referral raises unread notices (none -> unread, ACCEPT_REFERRAL)", () => {
    const received = step(
      seedWardFlowState(),
      {
        type: "RECEIVE_REFERRAL",
        role: "ed",
        now: t(5),
        ageBand: "Adult",
        source: "ed_medical",
        urgency: 2,
        originSiteCode: "RPH",
        originEdId: "rph-ed",
        homeRegion: "Perth Metropolitan",
        suburb: { kind: "named", name: "Armadale" },
        history: "",
        transportNeeded: false,
        destinations: [
          {
            kind: "psychiatric_ward",
            unitId: REF_UNIT_A,
            sex: "Male",
            gender: "Male",
            secureBedNeeded: false,
            involuntaryBedNeeded: false,
            highAcuityNursingNeeded: false,
          },
        ],
      } as WardFlowEvent,
      "receive ED referral",
    );
    const referralId = received.referrals.at(-1)!.id;
    const accepted = step(
      received,
      {
        type: "ACCEPT_REFERRAL",
        role: "ward",
        now: t(20),
        referralId,
        destinationKind: "psychiatric_ward",
        unitId: REF_UNIT_A,
        actingUnitId: REF_UNIT_A,
      } as WardFlowEvent,
      "accept ED referral",
    );
    const raised = accepted.notices.filter((notice) => notice.about.referralId === referralId);
    expect(raised.length).toBeGreaterThan(0);
    for (const notice of raised) expect(noticeSpec.stateOf(accepted, notice.id)).toEqual(["unread"]);
  });

  it("notice: an accepted-in-principle answer raises one unread notice (none -> unread)", () => {
    const { accepted } = journey();
    const raised = accepted.notices.filter((notice) => notice.kind === "accepted_in_principle");
    expect(raised).toHaveLength(1);
    expect(noticeSpec.stateOf(accepted, raised[0]!.id)).toEqual(["unread"]);
  });
});

describe("M26 refusals the diagrams promise", () => {
  it("notice: only the addressee can mark a notice read", () => {
    const { accepted } = journey();
    const notice = accepted.notices.at(-1)!;
    const wrongPlace = wardFlowReducer(accepted, {
      type: "MARK_NOTICE_READ",
      role: notice.to.role,
      now: t(45),
      noticeId: notice.id,
      actingPlaceId: "some-other-place",
    } as WardFlowEvent);
    const wrongRole = wardFlowReducer(accepted, {
      type: "MARK_NOTICE_READ",
      role: "ward",
      now: t(45),
      noticeId: notice.id,
      actingPlaceId: notice.to.placeId,
    } as WardFlowEvent);
    expect(refused(accepted, wrongPlace)).toBe(true);
    expect(refused(accepted, wrongRole)).toBe(true);
  });

  it("legal status: a closed movement refuses a change, and so does a reason off the list", () => {
    const { pulled } = journey();
    const closed = step(
      pulled,
      { type: "WITHDRAW_REFERRAL", role: "coordinator", now: t(60), movementId: MOVE },
      "close",
    );
    const change = (state: WardFlowState, reason: string) =>
      wardFlowReducer(state, {
        type: "CHANGE_LEGAL_STATUS",
        role: "coordinator",
        now: t(61),
        movementId: MOVE,
        legalStatus: LEGAL.voluntary,
        reason,
      } as WardFlowEvent);
    expect(refused(closed, change(closed, "recorded_by_treating_team"))).toBe(true);
    expect(refused(pulled, change(pulled, "because"))).toBe(true);
  });

  it("legal form: a second receipt is refused, and a correction needs a listed reason", () => {
    const [received] = legalFormSpec.fixtures().received!;
    const again = wardFlowReducer(received!.state, {
      type: "RECORD_LEGAL_FORM_RECEIVED",
      role: "ed",
      now: t(90),
      movementId: MOVE,
    } as WardFlowEvent);
    const badReason = wardFlowReducer(received!.state, {
      type: "CORRECT_LEGAL_FORM_RECEIPT",
      role: "ed",
      now: t(90),
      movementId: MOVE,
      reason: "no_reason",
    } as unknown as WardFlowEvent);
    expect(refused(received!.state, again)).toBe(true);
    expect(refused(received!.state, badReason)).toBe(true);
  });

  it("inbox: a repeat acknowledgement by the same role adds nothing, and a live fact cannot be ticked away", () => {
    const [acked] = inboxSpec.fixtures().acknowledged!;
    const again = wardFlowReducer(acked!.state, {
      type: "ACKNOWLEDGE_INBOX_ITEM",
      role: "coordinator",
      now: t(30),
      inboxItemId: acked!.id,
    } as WardFlowEvent);
    expect(refused(acked!.state, again)).toBe(false);
    // B7: `by` is a role, so the same role's repeat is accepted without a second record.
    expect(again.inboxAcknowledgements[acked!.id]).toHaveLength(1);
    const ticked = wardFlowReducer(acked!.state, {
      type: "COMPLETE_INBOX_ITEM",
      role: "coordinator",
      now: t(30),
      inboxItemId: acked!.id,
    } as WardFlowEvent);
    expect(refused(acked!.state, ticked)).toBe(true);
  });
});
