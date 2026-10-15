/**
 * Random event sequences for the engine safety tests (`tests/ward-engine-safety.test.ts`).
 *
 * Every sequence is reproducible from one integer seed: a small seeded generator (mulberry32)
 * chooses each next event from the state the reducer has just returned, so an event names a
 * movement, unit, admission or referral that exists at that moment. Roughly one event in ten is
 * sent under a role the event does not permit, or with a stale or invented id, so the refusal
 * paths are exercised as well as the success paths. Synthetic seeded worlds only.
 */
import {
  CANCEL_TRANSPORT_REASONS,
  DIVERSION_REASONS,
  GENDER_PLACEMENT_REASONS,
  OVERRIDE_REASONS,
  RELEASE_PULL_REASONS,
  STOP_TRANSPORT_REASONS,
  TRANSPORT_WHEREABOUTS,
  URGENCY_CHANGE_REASONS,
  URGENT_MARK_REASONS,
  WARD_REQUEST_WITHDRAWAL_REASONS,
  BED_RELEASE_BLOCKERS,
  LEGAL_STATUS_CHANGE_REASONS,
} from "@/components/ward-management/ward-change-reasons";
import {
  LEAVING_DESTINATIONS,
  PLANNED_ADMISSION_CANCEL_REASONS,
  PLANNED_ADMISSION_REASONS,
} from "@/components/ward-management/ward-admissions";
import { EVENT_ROLE, type WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import {
  BED_RELEASE_WAITING_ON,
  COMMUNITY_DECLINE_REASONS,
  DECLINE_REASONS,
  MOVEMENT_STAGES,
  REFERRAL_DECLINE_REASONS,
  REFERRAL_GENDERS,
  STEP_BACK_REASONS,
  TRANSPORT_LEGAL_STATUSES,
  TRANSPORT_PROVIDERS,
  type Movement,
} from "@/components/ward-management/ward-model";
import { referralState } from "@/components/ward-management/ward-referrals";
import { WARD_SCENARIOS } from "@/components/ward-management/ward-scenarios";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { FIXTURE_HISTORY } from "./ward-referral-history";

/** mulberry32: a tiny, well-mixed 32-bit generator. Same seed, same sequence, on every machine. */
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Random = ReturnType<typeof seededRandom>;

const int = (random: Random, min: number, max: number) => min + Math.floor(random() * (max - min + 1));
const chance = (random: Random, p: number) => random() < p;
function pick<T>(random: Random, items: readonly T[]): T | undefined {
  return items.length === 0 ? undefined : items[Math.floor(random() * items.length)];
}

const ALL_ROLES: readonly WardFlowRole[] = [
  "coordinator",
  "ed",
  "ward",
  "officer",
  "demo",
  "community",
  "bed_manager",
  "executive",
];
const LEGAL_STATUSES = [
  "Voluntary",
  "Referred for psychiatric examination",
  "Detained awaiting examination",
  "Involuntary inpatient",
] as const;
const MISSING_ID = "fuzz-missing-id";

type Draft = { type: WardFlowEvent["type"]; role?: WardFlowRole } & Record<string, unknown>;
type Builder = (state: WardFlowState, random: Random) => Draft | null;
type Extra = (state: WardFlowState, random: Random) => Record<string, unknown>;

const isOpen = (movement: Movement) => !movement.closure && movement.stage !== "arrived";

/** Which open movements an event is aimed at: a list of stages, or a finer test. */
type Aim = readonly Movement["stage"][] | ((movement: Movement) => boolean);

/** Prefer a live subject, but sometimes name a closed one or one that does not exist. */
function movementFor(state: WardFlowState, random: Random, aim?: Aim) {
  if (chance(random, 0.04)) return { id: MISSING_ID } as unknown as Movement;
  const open = state.movements.filter(isOpen);
  const fits = typeof aim === "function" ? aim : (movement: Movement) => !aim || aim.includes(movement.stage);
  const fitting = open.filter(fits);
  if (fitting.length > 0 && chance(random, 0.85)) return pick(random, fitting);
  return pick(random, state.movements);
}

function admissionFor(state: WardFlowState, random: Random, states?: readonly string[]) {
  if (chance(random, 0.04)) return undefined;
  const fitting = states ? state.admissions.filter((admission) => states.includes(admission.state)) : state.admissions;
  return fitting.length > 0 && chance(random, 0.85) ? pick(random, fitting) : pick(random, state.admissions);
}

function referralFor(state: WardFlowState, random: Random) {
  const queued = state.referrals.filter((referral) => referralState(referral) === "queued");
  return queued.length > 0 && chance(random, 0.8) ? pick(random, queued) : pick(random, state.referrals);
}

function unitFor(state: WardFlowState, random: Random, movement?: Movement) {
  const cohortMatch = movement ? state.units.filter((unit) => unit.cohort === movement.cohort) : [];
  return cohortMatch.length > 0 && chance(random, 0.8) ? pick(random, cohortMatch) : pick(random, state.units);
}

/** The unit a movement is currently tied to, the one a ward user would act as. */
function movementUnit(state: WardFlowState, random: Random, movement: Movement) {
  return movement.acceptedUnitId ?? pick(random, movement.referredUnitIds) ?? unitFor(state, random, movement)?.id;
}

const bedOn = (state: WardFlowState, random: Random, unitId: string | undefined) => {
  const beds = state.units.find((unit) => unit.id === unitId)?.beds ?? 1;
  return int(random, 1, beds + (chance(random, 0.1) ? 2 : 0));
};

const admissionEvent = (type: WardFlowEvent["type"], states?: readonly string[], extra?: Extra): Builder => {
  return (state, random) => {
    const admission = admissionFor(state, random, states);
    return {
      type,
      admissionId: admission?.id ?? MISSING_ID,
      actingUnitId: admission?.unitId ?? MISSING_ID,
      ...(extra?.(state, random) ?? {}),
    };
  };
};

const movementEvent = (
  type: WardFlowEvent["type"],
  aim?: Aim,
  extra?: (state: WardFlowState, random: Random, movement: Movement) => Record<string, unknown>,
): Builder => {
  return (state, random) => {
    const movement = movementFor(state, random, aim);
    if (!movement) return null;
    const missing = (movement.id as string) === MISSING_ID;
    const unitId = missing ? MISSING_ID : movementUnit(state, random, movement);
    return {
      type,
      movementId: movement.id,
      ...(unitId ? { actingUnitId: unitId } : {}),
      ...(extra && !missing ? extra(state, random, movement) : {}),
    };
  };
};

/** Transport legs, so each transport event is mostly aimed at a journey it can move on. */
const leg = (movement: Movement) => {
  const job = movement.transport;
  if (!job || job.cancelledAt !== undefined) return "none";
  if (job.collectedAt !== undefined) return "collected";
  if (job.enRouteAt !== undefined) return "en route";
  if (job.acceptedAt !== undefined) return "accepted";
  return "requested";
};

/** Answering a referral is a ward's or the coordinator's job; other roles are mostly refused. */
const answeringRole = (random: Random): WardFlowRole | undefined =>
  chance(random, 0.8) ? pick(random, ["ward", "coordinator"] as const) : undefined;

const bedReleaseEvent = (type: WardFlowEvent["type"], extra?: Extra): Builder => {
  return (state, random) => {
    const release = pick(random, state.bedReleases);
    if (!release) return null;
    return { type, releaseId: release.id, actingUnitId: release.unitId, ...(extra?.(state, random) ?? {}) };
  };
};

/**
 * One builder per event the generator sends, weighted towards the events that move a bed or a
 * person: referral, acceptance, pull, transport, arrival, leaving, leave beds, bed releases,
 * Bed board placement, capacity confirmation, planned admissions and their undo steps.
 */
const BUILDERS: readonly (readonly [weight: number, builder: Builder])[] = [
  // The emergency department and referral front door.
  [
    2,
    (_state, random) => ({
      type: "RAISE_REFERRAL",
      edId: pick(random, ["jhc-ed", "rph-ed", "fsh-ed", "scgh-ed"]),
      draft: {
        cohort: pick(random, ["Adult", "Older adult", "Youth"]),
        security: pick(random, ["Open", "Secure"]),
        sex: pick(random, ["Female", "Male"]),
        gender: pick(random, REFERRAL_GENDERS),
        specialling: chance(random, 0.2),
        highAcuity: chance(random, 0.2),
        legalStatus: pick(random, LEGAL_STATUSES),
        urgency: int(random, 1, 3),
        legalFormCode: null,
      },
    }),
  ],
  [
    2,
    (state, random) => ({
      type: "RECEIVE_REFERRAL",
      ageBand: pick(random, ["Adult", "Older adult", "Youth"]),
      destinations: [
        {
          kind: "psychiatric_ward",
          ...(chance(random, 0.6) ? { unitId: pick(random, state.units)?.id } : {}),
          sex: pick(random, ["Female", "Male"]),
          gender: pick(random, REFERRAL_GENDERS),
          secureBedNeeded: chance(random, 0.3),
          involuntaryBedNeeded: chance(random, 0.3),
          highAcuityNursingNeeded: chance(random, 0.2),
        },
      ],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Armadale" },
      source: "community",
      urgency: int(random, 1, 3),
      originSiteCode: pick(random, ["SCGH", "RPH", "FSH"]),
      transportNeeded: chance(random, 0.5),
      ...FIXTURE_HISTORY,
    }),
  ],
  [
    3,
    (state, random) => {
      const referral = referralFor(state, random);
      if (!referral) return null;
      const unitId = pick(random, state.units)?.id;
      return {
        role: answeringRole(random),
        type: "ACCEPT_REFERRAL",
        referralId: referral.id,
        destinationKind: "psychiatric_ward",
        unitId,
        actingUnitId: unitId,
        ...(chance(random, 0.3) ? { bedNumber: bedOn(state, random, unitId) } : {}),
        ...(chance(random, 0.15) ? { overrideReason: pick(random, OVERRIDE_REASONS) } : {}),
        ...(chance(random, 0.15) ? { genderPlacementReason: pick(random, GENDER_PLACEMENT_REASONS) } : {}),
      };
    },
  ],
  [
    2,
    (state, random) => {
      const referral = referralFor(state, random);
      if (!referral) return null;
      const community = chance(random, 0.2);
      const unitId = pick(random, state.units)?.id;
      return {
        role: answeringRole(random),
        type: "DECLINE_REFERRAL",
        referralId: referral.id,
        destinationKind: community ? "community_team" : "psychiatric_ward",
        unitId,
        actingUnitId: unitId,
        waitlist: chance(random, 0.3),
        reason: community ? pick(random, COMMUNITY_DECLINE_REASONS) : pick(random, REFERRAL_DECLINE_REASONS),
      };
    },
  ],
  [
    1,
    (state, random) => {
      const referral = pick(random, state.referrals);
      return referral ? { type: "UNDO_REFERRAL_DECISION", referralId: referral.id } : null;
    },
  ],
  [
    1,
    (state, random) => {
      const referral = referralFor(state, random);
      return referral
        ? {
            type: "RECORD_REFERRER_WITHDRAWAL",
            referralId: referral.id,
            reason: pick(random, WARD_REQUEST_WITHDRAWAL_REASONS),
          }
        : null;
    },
  ],
  // The movement journey: refer, accept, pull, hand over, transport, arrive.
  [
    5,
    movementEvent("REFER_TO_UNITS", ["placement_requested", "destination_review"], (state, random, movement) => {
      const unitIds = new Set<string>();
      const count = int(random, 1, 3);
      for (let index = 0; index < count; index += 1) {
        const unit = unitFor(state, random, movement);
        if (unit) unitIds.add(unit.id);
      }
      return {
        unitIds: [...unitIds],
        ...(chance(random, 0.2) ? { overrideReason: pick(random, OVERRIDE_REASONS) } : {}),
        ...(chance(random, 0.3)
          ? { genderPlacementReason: pick(random, GENDER_PLACEMENT_REASONS), genderPlacementChecked: true }
          : {}),
      };
    }),
  ],
  [
    5,
    movementEvent("ACCEPT_IN_PRINCIPLE", ["destination_review"], (state, random, movement) => {
      const unitId = pick(random, movement.referredUnitIds) ?? unitFor(state, random, movement)?.id;
      return {
        unitId,
        actingUnitId: unitId,
        ...(chance(random, 0.4) ? { bedNumber: bedOn(state, random, unitId) } : {}),
        ...(chance(random, 0.15) ? { overrideReason: pick(random, OVERRIDE_REASONS) } : {}),
      };
    }),
  ],
  [
    5,
    movementEvent("PULL_PATIENT", ["accepted_awaiting_bed", "destination_review"], (state, random, movement) => {
      const unitId = movementUnit(state, random, movement);
      return {
        unitId,
        actingUnitId: unitId,
        ...(chance(random, 0.5) ? { numConsulted: true } : {}),
        ...(chance(random, 0.2) ? { overrideReason: pick(random, OVERRIDE_REASONS) } : {}),
      };
    }),
  ],
  [
    2,
    movementEvent("DECLINE", ["destination_review"], (state, random, movement) => {
      const unitId = pick(random, movement.referredUnitIds) ?? unitFor(state, random, movement)?.id;
      return { unitId, actingUnitId: unitId, reason: pick(random, DECLINE_REASONS) };
    }),
  ],
  [
    3,
    movementEvent(
      "HANDOVER_READY",
      (movement) => movement.stage === "pulled" && leg(movement) !== "none",
      (_state, random) => (chance(random, 0.5) ? { provider: pick(random, TRANSPORT_PROVIDERS) } : {}),
    ),
  ],
  [
    3,
    (state, random) => {
      const built = movementEvent(
        "BOOK_TRANSPORT",
        (movement) => movement.stage === "pulled" && leg(movement) === "none",
        (_state, inner) => ({
          provider: pick(inner, TRANSPORT_PROVIDERS),
          escortRequired: chance(inner, 0.5),
          cadNumber: `CAD${int(inner, 1000, 9999)}`,
          transportLegalStatus: pick(inner, TRANSPORT_LEGAL_STATUSES),
          estimatedAt: NOW_ANCHOR + int(inner, 10, 600),
        }),
      )(state, random);
      // The sending side books transport, never the receiving ward.
      if (built) delete built.actingUnitId;
      return built;
    },
  ],
  [2, movementEvent("TRANSPORT_ACCEPTED", (movement) => leg(movement) === "requested")],
  [2, movementEvent("TRANSPORT_EN_ROUTE", (movement) => leg(movement) === "accepted")],
  [3, movementEvent("PATIENT_COLLECTED", (movement) => leg(movement) === "en route")],
  [
    6,
    movementEvent(
      "PATIENT_ARRIVED",
      (movement) => movement.stage === "moving" || (movement.stage === "pulled" && leg(movement) === "none"),
    ),
  ],
  [
    1,
    movementEvent("RECORD_TRANSPORT_NEED", ["pulled", "handover_ready"], (_state, random) => ({
      needed: chance(random, 0.5),
    })),
  ],
  // Stepping back and releasing: the paths that hand a bed back.
  [
    3,
    movementEvent("RELEASE_PULL", ["pulled", "handover_ready", "moving"], (_state, random) => ({
      reason: pick(random, RELEASE_PULL_REASONS),
    })),
  ],
  [
    1,
    movementEvent("RELEASE_AND_REOPEN_SEARCH", ["pulled", "handover_ready", "moving"], (_state, random) => ({
      reason: pick(random, RELEASE_PULL_REASONS),
    })),
  ],
  [
    2,
    movementEvent("CANCEL_TRANSPORT", ["handover_ready", "moving"], (_state, random) => ({
      reason: pick(random, CANCEL_TRANSPORT_REASONS),
    })),
  ],
  [
    1,
    movementEvent("STOP_TRANSPORT", ["moving"], (_state, random) => ({
      reason: pick(random, STOP_TRANSPORT_REASONS),
      whereabouts: pick(random, TRANSPORT_WHEREABOUTS),
    })),
  ],
  [1, movementEvent("RELEASE_HELD_BED", ["pulled", "handover_ready", "moving"])],
  [
    1,
    movementEvent("RECORD_DIVERSION", ["moving"], (_state, random) => ({
      reason: pick(random, DIVERSION_REASONS),
      place: pick(random, TRANSPORT_WHEREABOUTS),
    })),
  ],
  [1, movementEvent("RELEASE_DIVERTED_BED", ["moving", "pulled"])],
  [
    2,
    movementEvent("STEP_BACK_STAGE", undefined, (_state, random, movement) => {
      const index = MOVEMENT_STAGES.indexOf(movement.stage);
      return {
        to: MOVEMENT_STAGES[int(random, 0, Math.max(0, index - 1))],
        reason: pick(random, STEP_BACK_REASONS),
      };
    }),
  ],
  [
    1,
    movementEvent("WITHDRAW_ACCEPTANCE", ["accepted_awaiting_bed", "pulled"], (_state, random) => ({
      reason: pick(random, STEP_BACK_REASONS),
    })),
  ],
  [1, movementEvent("WITHDRAW_REFERRAL", ["destination_review", "accepted_awaiting_bed"])],
  [
    1,
    movementEvent("WITHDRAW_WARD_REQUEST", ["destination_review"], (state, random, movement) => ({
      unitId: pick(random, movement.referredUnitIds) ?? unitFor(state, random, movement)?.id,
      reason: pick(random, WARD_REQUEST_WITHDRAWAL_REASONS),
    })),
  ],
  [1, movementEvent("UNDO_REFER_TO_UNITS", ["destination_review"])],
  [1, movementEvent("UNDO_ACCEPT_IN_PRINCIPLE", ["accepted_awaiting_bed", "pulled"])],
  [1, movementEvent("UNDO_TRANSPORT_STEP", ["handover_ready", "moving"])],
  [1, movementEvent("UNDO_ED_STEP")],
  [1, movementEvent("RECORD_LEFT_DEPARTMENT", ["placement_requested", "destination_review"])],
  [
    1,
    movementEvent("RECORD_ED_OUTCOME", ["placement_requested"], (_state, random) => ({
      outcome: pick(random, ["for_discharge", "for_community_follow_up"]),
    })),
  ],
  [
    1,
    movementEvent("RECORD_MOVEMENT_GENDER", undefined, (_state, random) => ({
      gender: pick(random, REFERRAL_GENDERS),
    })),
  ],
  [
    1,
    movementEvent("CHANGE_URGENCY", undefined, (_state, random) => ({
      urgency: int(random, 1, 3),
      reason: pick(random, URGENCY_CHANGE_REASONS),
    })),
  ],
  [
    1,
    movementEvent("CHANGE_LEGAL_STATUS", undefined, (_state, random) => ({
      legalStatus: pick(random, LEGAL_STATUSES),
      reason: pick(random, LEGAL_STATUS_CHANGE_REASONS),
    })),
  ],
  [
    1,
    movementEvent("FLAG_MOVEMENT_URGENT", undefined, (_state, random) => ({
      reason: pick(random, URGENT_MARK_REASONS),
    })),
  ],
  [1, movementEvent("RAISE_PULL_NOW", ["accepted_awaiting_bed"])],
  // People in beds: leaving, placement, leave beds, absences and the ED trip.
  [
    4,
    admissionEvent("RECORD_LEAVING", ["occupied"], (_state, random) => ({
      leavingDestination: pick(random, LEAVING_DESTINATIONS)?.id,
    })),
  ],
  [
    2,
    (state, random) => {
      const admission = admissionFor(state, random, ["occupied"]);
      if (!admission) return null;
      return {
        type: "RECORD_PATIENT_DISCHARGE",
        admissionId: admission.id,
        actingUnitId: admission.unitId,
        patientId: admission.patientId ?? MISSING_ID,
        expectedGeneration: state.worldGeneration,
        expectedRevision: state.dischargeRevisions[admission.id] ?? 0,
        leavingDestination: pick(random, LEAVING_DESTINATIONS)?.id,
      };
    },
  ],
  [2, admissionEvent("UNDO_DEPARTURE", ["departed"])],
  [
    4,
    admissionEvent("PLACE_IN_BED", ["occupied", "pulled"], (state, random) => {
      const unitId = pick(random, state.units)?.id;
      return { bedNumber: bedOn(state, random, unitId) };
    }),
  ],
  [2, admissionEvent("UNDO_PLACE_IN_BED", ["occupied", "pulled"])],
  [
    2,
    (state, random) => {
      const admission = admissionFor(state, random, ["occupied"]);
      if (!admission) return null;
      return {
        type: "RECORD_LEAVE_BED",
        unitId: admission.unitId,
        actingUnitId: admission.unitId,
        admissionId: admission.id,
        expectedReturn: NOW_ANCHOR + int(random, 60, 2880),
        ...(chance(random, 0.3) ? { kind: pick(random, ["off_ward", "medical_trip"]) } : {}),
      };
    },
  ],
  [
    2,
    (state, random) => {
      const leaveBed = pick(random, state.leaveBeds);
      return leaveBed ? { type: "END_LEAVE_BED", leaveBedId: leaveBed.id, actingUnitId: leaveBed.unitId } : null;
    },
  ],
  [1, admissionEvent("RECORD_ABSENT_WITHOUT_LEAVE", ["occupied"])],
  [1, admissionEvent("UNDO_ABSENT_WITHOUT_LEAVE", ["occupied"])],
  [1, admissionEvent("RECORD_AWAY_AT_EMERGENCY_DEPARTMENT", ["occupied"])],
  [1, admissionEvent("RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT", ["occupied"])],
  // Bed releases and the capacity figures a ward confirms.
  [
    2,
    (state, random) => {
      const admission = admissionFor(state, random, ["occupied"]);
      if (!admission) return null;
      return {
        type: "FLAG_BED_RELEASE",
        unitId: admission.unitId,
        actingUnitId: admission.unitId,
        admissionId: admission.id,
        waitingOn: pick(random, BED_RELEASE_WAITING_ON),
        expectedAt: NOW_ANCHOR + int(random, 30, 1440),
        ...(chance(random, 0.2) ? { blocker: pick(random, BED_RELEASE_BLOCKERS) } : {}),
      };
    },
  ],
  [2, bedReleaseEvent("CONFIRM_BED_RELEASE")],
  [2, bedReleaseEvent("RELEASE_BED")],
  [1, bedReleaseEvent("REVERT_BED_RELEASE", (_state, random) => ({ waitingOn: pick(random, BED_RELEASE_WAITING_ON) }))],
  [1, bedReleaseEvent("BLOCK_BED_RELEASE", (_state, random) => ({ blocker: pick(random, BED_RELEASE_BLOCKERS) }))],
  [1, bedReleaseEvent("CLEAR_BED_RELEASE_BLOCK")],
  [
    3,
    (state, random) => {
      const unit = pick(random, state.units);
      if (!unit) return null;
      // Mostly in range, sometimes just outside it, to exercise the refusal.
      const value = chance(random, 0.1) ? pick(random, [-1, unit.beds + 1]) : int(random, 0, unit.beds);
      const revision = unit.allocatable.revision ?? 0;
      return {
        type: "CONFIRM_CAPACITY",
        unitId: unit.id,
        actingUnitId: unit.id,
        value,
        expectedRevision: chance(random, 0.9) ? revision : revision + 1,
      };
    },
  ],
  // Planned admissions: a booking holds no bed until it is converted.
  [
    2,
    (state, random) => {
      const unit = pick(random, state.units);
      if (!unit) return null;
      const patient = chance(random, 0.7) ? pick(random, state.patients) : undefined;
      return {
        type: "BOOK_PLANNED_ADMISSION",
        patientId: patient?.id ?? null,
        initials: patient ? null : "AB",
        sex: pick(random, ["Female", "Male"]),
        reason: pick(random, PLANNED_ADMISSION_REASONS),
        unitId: unit.id,
        actingUnitId: unit.id,
        expectedArrivalAt: NOW_ANCHOR + int(random, 0, 2880),
        expectedStayDays: int(random, 1, 21),
        legalStatus: pick(random, LEGAL_STATUSES),
        ageBand: unit.cohort,
      };
    },
  ],
  [
    1,
    (state, random) => {
      const booking = pick(random, state.plannedAdmissions);
      return booking
        ? {
            type: "CANCEL_PLANNED_ADMISSION",
            plannedAdmissionId: booking.id,
            unitId: booking.unitId,
            actingUnitId: booking.unitId,
            reason: pick(random, PLANNED_ADMISSION_CANCEL_REASONS),
          }
        : null;
    },
  ],
  [
    3,
    (state, random) => {
      const booked = state.plannedAdmissions.filter((booking) => booking.state === "booked");
      const booking = pick(random, booked.length > 0 ? booked : state.plannedAdmissions);
      return booking
        ? {
            type: "CONVERT_PLANNED_ADMISSION",
            plannedAdmissionId: booking.id,
            unitId: booking.unitId,
            actingUnitId: booking.unitId,
          }
        : null;
    },
  ],
  // The clock and the world.
  [2, (_state, random) => ({ type: "ADVANCE_CLOCK", minutes: int(random, 1, 240) })],
  [0.2, () => ({ type: "RESET_SCENARIO" })],
  [0.2, (_state, random) => ({ type: "SET_SCENARIO", scenario: pick(random, WARD_SCENARIOS) })],
];

const TOTAL_WEIGHT = BUILDERS.reduce((sum, [weight]) => sum + weight, 0);

/** Event types the generator can send, for the coverage assertion in the test. */
export const FUZZED_EVENT_TYPES = new Set<WardFlowEvent["type"]>();

function chooseBuilder(random: Random): Builder {
  let roll = random() * TOTAL_WEIGHT;
  for (const [weight, builder] of BUILDERS) {
    roll -= weight;
    if (roll < 0) return builder;
  }
  return BUILDERS[BUILDERS.length - 1][1];
}

/** The demonstration clock the screens would pass: anchor, plus elapsed time, plus jumps. */
export function nowFor(state: WardFlowState, step: number): number {
  return NOW_ANCHOR + state.clockOffsetMinutes + step * 5;
}

/** The next event for this state. Never null: retries until a builder has a subject. */
export function nextEvent(state: WardFlowState, random: Random, step: number): WardFlowEvent {
  for (;;) {
    const draft = chooseBuilder(random)(state, random);
    if (!draft) continue;
    const permitted = EVENT_ROLE[draft.type];
    const role = chance(random, 0.9) && permitted.length > 0 ? pick(random, permitted) : pick(random, ALL_ROLES);
    FUZZED_EVENT_TYPES.add(draft.type);
    const event = { now: nowFor(state, step), ...draft, role: draft.role ?? role };
    return event as unknown as WardFlowEvent;
  }
}
