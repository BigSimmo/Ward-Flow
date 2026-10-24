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
  BED_PREPARATION_NOTES,
  DISCHARGE_DELAY_CLEAR_REASONS,
  ESCALATION_CONTACTS,
  LEGAL_FORM_RECEIPT_CORRECTION_REASONS,
  WARD_INTAKE_CONSTRAINTS,
} from "@/components/ward-management/ward-change-reasons";
import {
  DISCHARGE_BARRIERS,
  FOLLOW_UP_STATES,
  LEAVING_DESTINATIONS,
  PLANNED_ADMISSION_CANCEL_REASONS,
  PLANNED_ADMISSION_REASONS,
} from "@/components/ward-management/ward-admissions";
import {
  EVENT_ROLE,
  REPATRIATION_MODES,
  WARD_BUZZ_MESSAGES,
  type WardFlowEvent,
} from "@/components/ward-management/ward-flow-events";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import {
  ABSENCE_STEPS,
  ARRIVAL_MODES,
  BED_RELEASE_WAITING_ON,
  COMMUNITY_DECLINE_REASONS,
  DECLINE_REASONS,
  EXAMINATION_OUTCOMES,
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
import {
  BED_MEETING_ACTION_DUE_HOURS,
  BED_MEETING_ACTION_KIND_IDS,
  BED_MEETING_ACTION_OWNERS,
} from "@/components/ward-management/bed-meeting/bed-meeting-actions";
import { WARD_CLOSURE_REASON_IDS, WARD_REOPEN_AFTER_HOURS } from "@/components/ward-management/capacity/ward-closure";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import {
  BED_CALL_ANSWERS,
  BROADCAST_CATEGORIES,
  BROADCAST_SEVERITIES,
  BROADCAST_TARGET_SCOPES,
  COORDINATOR_DESK_ACKNOWLEDGER_ID,
  PULL_NOW_ANSWERS,
} from "@/components/ward-management/alerts/ward-broadcast-model";
import { communityTeamOptions } from "@/components/ward-management/referrals/referral-destination-options";
import { REFERRAL_INFORMATION_NEED_IDS } from "@/components/ward-management/referrals/referral-information-needs";
import {
  REFERRAL_CONTACT_OUTCOME_IDS,
  REFERRAL_OWNER_DESKS,
} from "@/components/ward-management/referrals/referral-owner-and-calls";
import { governanceAuditEvents } from "@/components/ward-management/ward-audit";
import {
  APPOINTMENT_MODES,
  CARE_CONTACTS,
  CARE_DOCUMENTS,
  CARE_PLAN_ITEMS,
  CARE_STATUSES,
  CONTACT_OUTCOMES,
  EPISODE_TYPES,
  RECEIVING_CLASSES,
  SEPARATION_CODES,
  TRANSPORT_MODES,
} from "@/components/ward-management/ward-care-journey";
import { DISCHARGE_CRITERIA } from "@/components/ward-management/ward-discharge-criteria";
import { INBOX_CATEGORIES } from "@/components/ward-management/ward-inbox-reducer";
import { SNOOZE_REASON_IDS } from "@/components/ward-management/ward-inbox-snooze";
import { LEGAL_CLOCK_FORM_CODES } from "@/components/ward-management/ward-legal-clock";
import { GENDERS } from "@/components/ward-management/ward-patients";
import { UNDO_STEP_TYPES } from "@/components/ward-management/ward-undo";
import { OBSERVATION_LEVELS, observationAt } from "@/components/ward-management/ward-observation";
import {
  RESTRICTIVE_PRACTICE_IDS,
  SECLUSION_ROOM_STATUS_IDS,
  WARD_INCIDENT_CATEGORY_IDS,
  openEpisodes,
} from "@/components/ward-management/restrictive-practice/ward-restrictive-practice";
import { FIXTURE_HISTORY } from "./ward-referral-history";
// Closing-the-loop (package E): the two new record events.
import {
  HOME_SERVICE_ANSWERS,
  RETURN_PREREQUISITES,
} from "@/components/ward-management/out-of-area/home-service-return";
import { buildOnCallDirectory } from "@/components/ward-management/on-call/on-call-directory";

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
  // An aim that names "arrived" looks at finished journeys too, which `isOpen` leaves out.
  const pool = Array.isArray(aim) && aim.includes("arrived") ? state.movements : state.movements.filter(isOpen);
  const fits = typeof aim === "function" ? aim : (movement: Movement) => !aim || aim.includes(movement.stage);
  const fitting = pool.filter(fits);
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

/** A movement some ward has been asked about and has not yet answered. */
const awaitingWards = (movement: Movement) =>
  movement.stage === "destination_review" && movement.referredUnitIds.length > 0;

/** The ward a referral arm names, so an answer is usually from a ward that was asked. */
function addressedUnit(state: WardFlowState, random: Random, referral: WardFlowState["referrals"][number]) {
  const named = referral.destinations.flatMap((arm) =>
    arm.destination.kind === "psychiatric_ward" && arm.destination.unitId ? [arm.destination.unitId] : [],
  );
  return named.length > 0 && chance(random, 0.8) ? pick(random, named) : pick(random, state.units)?.id;
}

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
        observation: observationAt(pick(random, OBSERVATION_LEVELS) ?? "general"),
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
      const unitId = addressedUnit(state, random, referral);
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
      const unitId = addressedUnit(state, random, referral);
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
    movementEvent("ACCEPT_IN_PRINCIPLE", awaitingWards, (state, random, movement) => {
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
    movementEvent("PULL_PATIENT", ["accepted_awaiting_bed"], (state, random, movement) => {
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
    movementEvent("DECLINE", awaitingWards, (state, random, movement) => {
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
          estimatedAt: currentNow + int(inner, 10, 600),
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
    movementEvent("WITHDRAW_WARD_REQUEST", awaitingWards, (state, random, movement) => ({
      unitId: pick(random, movement.referredUnitIds) ?? unitFor(state, random, movement)?.id,
      reason: pick(random, WARD_REQUEST_WITHDRAWAL_REASONS),
    })),
  ],
  [1, movementEvent("UNDO_REFER_TO_UNITS", ["destination_review"])],
  [1, movementEvent("UNDO_ACCEPT_IN_PRINCIPLE", ["accepted_awaiting_bed", "pulled"])],
  [1, movementEvent("UNDO_TRANSPORT_STEP", ["handover_ready", "moving"])],
  [1, movementEvent("UNDO_ED_STEP")],
  [
    1,
    (state, random) => {
      // Left the department follows a recorded ED outcome, which may already have closed the journey.
      const movement = chance(random, 0.04)
        ? undefined
        : prefer(random, state.movements, (m) => m.edOutcome !== undefined && m.leftDepartmentAt === undefined);
      return { type: "RECORD_LEFT_DEPARTMENT", movementId: id(movement) };
    },
  ],
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
  // CLD turnaround priority (handover, 17 Oct 2026): a coordinator prefers a unit whose CLD-ready
  // admission or confirmed departure will free a bed. The reducer derives the source itself.
  [
    1,
    movementEvent("FLAG_MOVEMENT_TURNAROUND_PRIORITY", undefined, (state, random) => ({
      unitId: pick(random, state.units)?.id,
    })),
  ],
  [
    1,
    (state, random) => {
      const referral = pick(random, state.referrals);
      return referral
        ? {
            type: "FLAG_REFERRAL_TURNAROUND_PRIORITY",
            referralId: referral.id,
            unitId: addressedUnit(state, random, referral),
          }
        : null;
    },
  ],
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
    (state, random) => {
      const current = state.admissions.filter((stay) => stay.state === "pulled" || stay.state === "occupied");
      // A bed held on the stay's ward for another open journey or an accepted referral not yet
      // arrived there (as `heldBedRefusal` reads them): the placement that must be refused.
      const heldFor = (stay: (typeof current)[number]) =>
        [
          ...state.movements
            .filter(
              (movement) =>
                movement.closure === undefined &&
                movement.acceptedUnitId === stay.unitId &&
                movement.admissionId !== stay.id,
            )
            .map((movement) => movement.heldBedNumber),
          ...state.referrals
            .filter(
              (referral) =>
                !state.movements.some(
                  (movement) =>
                    movement.referralId === referral.id &&
                    movement.stage === "arrived" &&
                    movement.acceptedUnitId === stay.unitId,
                ),
            )
            .flatMap((referral) => referral.destinations)
            .filter(
              (arm) =>
                arm.state === "accepted" &&
                arm.destination.kind === "psychiatric_ward" &&
                (arm.acceptedUnitId ?? arm.destination.unitId) === stay.unitId,
            )
            .map((arm) => arm.heldBedNumber),
        ].filter((bed): bed is number => bed !== undefined);
      const nearHeld = current.filter((stay) => heldFor(stay).length > 0);
      // A pulled stay of a journey in transit, so a later stop of that transport leaves a numbered
      // bed held (the stopped-transport hold rule).
      const inTransit = current.filter(
        (stay) =>
          stay.state === "pulled" &&
          state.movements.some((movement) => movement.admissionId === stay.id && movement.stage === "moving"),
      );
      const roll = random();
      const admission =
        nearHeld.length > 0 && roll < 0.4
          ? pick(random, nearHeld)
          : inTransit.length > 0 && roll < 0.6
            ? pick(random, inTransit)
            : admissionFor(state, random, ["occupied", "pulled"]);
      if (!admission) return null;
      const held = heldFor(admission);
      // Otherwise often aim at a bed another stay is already in.
      const occupied = current
        .filter((other) => other.unitId === admission.unitId)
        .map((other) => other.bedNumber)
        .filter((bed): bed is number => bed !== undefined);
      return {
        type: "PLACE_IN_BED",
        admissionId: admission.id,
        actingUnitId: admission.unitId,
        bedNumber:
          held.length > 0 && roll < 0.4
            ? pick(random, held)
            : occupied.length > 0 && chance(random, 0.4)
              ? pick(random, occupied)
              : bedOn(state, random, admission.unitId),
      };
    },
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
        expectedReturn: currentNow + int(random, 60, 2880),
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
  [
    1,
    (state, random) => {
      const stay = stayFor(state, random, (candidate) => candidate.awayAtEmergencyDepartmentSince !== null);
      return {
        type: "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT",
        admissionId: id(stay),
        actingUnitId: stay?.unitId ?? MISSING_ID,
      };
    },
  ],
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
        expectedAt: currentNow + int(random, 30, 1440),
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
    1,
    bedReleaseEvent("SEND_RELEASE_SUPPORT_NOTICE", (_state, random) => ({
      service: pick(random, ["pharmacy", "transport", "cleaning"] as const),
    })),
  ],
  [
    0.5,
    movementEvent("RECORD_ARRIVAL_CHECK", undefined, (_state, random) => ({
      check: pick(random, ["contraband_search", "medication_chart"] as const),
      done: chance(random, 0.8),
    })),
  ],
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
      // Mostly patients with no bed yet, since a patient in a bed is refused a booking.
      const inBed = new Set(
        state.admissions
          .filter((stay) => stay.state === "pulled" || stay.state === "occupied")
          .map((stay) => stay.patientId),
      );
      const free = state.patients.filter((candidate) => !inBed.has(candidate.id));
      const patient = chance(random, 0.7) ? pick(random, chance(random, 0.8) ? free : state.patients) : undefined;
      return {
        type: "BOOK_PLANNED_ADMISSION",
        calendarDate: "2026-10-15",
        patientId: patient?.id ?? null,
        initials: patient ? null : "AB",
        sex: pick(random, ["Female", "Male"]),
        reason: pick(random, PLANNED_ADMISSION_REASONS),
        unitId: unit.id,
        actingUnitId: unit.id,
        expectedArrivalAt: currentNow + int(random, 0, 2880),
        expectedStayDays: int(random, 1, 21),
        legalStatus: pick(random, LEGAL_STATUSES),
        ageBand: unit.cohort,
      };
    },
  ],
  [
    1,
    (state, random) => {
      // With no booking it still sends, naming a missing one, so a sweep step always covers it.
      const booking = pick(random, state.plannedAdmissions);
      const unitId = booking?.unitId ?? id(pick(random, state.units));
      return {
        type: "CANCEL_PLANNED_ADMISSION",
        plannedAdmissionId: booking?.id ?? MISSING_ID,
        unitId,
        actingUnitId: unitId,
        reason: pick(random, PLANNED_ADMISSION_CANCEL_REASONS),
      };
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

/* ------------------------------------------------------------------------------------------------
 * Audit 2, E-19: builders for every other event in EVENT_ROLE, so the random run reaches the whole
 * event table and not only the bed-moving core above. Each draws its subject from the current
 * state (a unit, stay, movement, referral, notice, alert, undo record or inbox row that exists) and
 * every chosen value from the model's own closed lists. When no subject exists the builder still
 * sends the event against an invented id, so the refusal is exercised and the type is counted.
 * Typed text is short and synthetic.
 * --------------------------------------------------------------------------------------------- */

const SYNTHETIC_NOTE = "Synthetic note";
const SITE_CODES = ["SCGH", "RPH", "FSH"] as const;
const id = (record: { id: string } | undefined) => record?.id ?? MISSING_ID;
const someOf = <T>(random: Random, items: readonly T[], max = 3): T[] => {
  const chosen = new Set<T>();
  const count = int(random, 1, Math.min(max, items.length));
  for (let index = 0; index < count; index += 1) {
    const item = pick(random, items);
    if (item !== undefined) chosen.add(item);
  }
  return [...chosen];
};
const stays = (state: WardFlowState, test: (stay: WardFlowState["admissions"][number]) => boolean) =>
  state.admissions.filter(test);
/** Mostly a stay that passes `test`, sometimes any stay, sometimes none. */
function stayFor(state: WardFlowState, random: Random, test: (stay: WardFlowState["admissions"][number]) => boolean) {
  if (chance(random, 0.04)) return undefined;
  const fitting = stays(state, test);
  return fitting.length > 0 && chance(random, 0.85) ? pick(random, fitting) : pick(random, state.admissions);
}
const occupied = (stay: WardFlowState["admissions"][number]) => stay.state === "occupied";
/** Mostly an item that passes `test`, otherwise any item of the list. */
function prefer<T>(random: Random, items: readonly T[], test: (item: T) => boolean): T | undefined {
  const fitting = items.filter(test);
  return fitting.length > 0 && chance(random, 0.85) ? pick(random, fitting) : pick(random, items);
}
const alerts = (state: WardFlowState) => (Array.isArray(state.broadcastAlerts) ? state.broadcastAlerts : []);
/** A stay's discharge-record fields: the revision and generation the screen would hold. */
const recordFields = (state: WardFlowState, random: Random, stay: WardFlowState["admissions"][number] | undefined) => ({
  admissionId: id(stay),
  actingUnitId: stay?.unitId ?? MISSING_ID,
  patientId: stay?.patientId ?? MISSING_ID,
  expectedGeneration: chance(random, 0.95) ? state.worldGeneration : state.worldGeneration + 1,
  expectedRevision: (stay ? (state.dischargeRevisions[stay.id] ?? 0) : 0) + (chance(random, 0.95) ? 0 : 1),
});

/** An inbox row id: a category prefix and the record it names (sometimes a stale one). */
function inboxIdFor(state: WardFlowState, random: Random): string {
  const category = pick(random, Object.values(INBOX_CATEGORIES))!;
  const prefix = category.idPrefix;
  const subject =
    prefix === INBOX_CATEGORIES.support_notification_discharge.idPrefix ||
    prefix === INBOX_CATEGORIES.absent_without_leave.idPrefix
      ? id(pick(random, state.admissions))
      : prefix === INBOX_CATEGORIES.planned_arrival_overdue.idPrefix
        ? id(pick(random, state.plannedAdmissions))
        : prefix === INBOX_CATEGORIES.duplicate_bed_request.idPrefix
          ? (pick(random, state.patients)?.id ?? MISSING_ID)
          : id(pick(random, state.movements));
  return `${prefix}${chance(random, 0.95) ? subject : MISSING_ID}`;
}
const inboxEvent =
  (type: WardFlowEvent["type"], fromKeys?: (state: WardFlowState) => Record<string, unknown>): Builder =>
  (state, random) => {
    const known = fromKeys ? Object.keys(fromKeys(state) ?? {}) : [];
    const inboxItemId = known.length > 0 && chance(random, 0.8) ? pick(random, known)! : inboxIdFor(state, random);
    return { type, inboxItemId };
  };

/** The field an undo record's subject lives in: movement, referral or stay, else the network. */
function undoSubjectField(state: WardFlowState, subjectId: string): Record<string, string> {
  if (state.movements.some((movement) => movement.id === subjectId)) return { movementId: subjectId };
  if (state.referrals.some((referral) => referral.id === subjectId)) return { referralId: subjectId };
  if (state.admissions.some((stay) => stay.id === subjectId)) return { admissionId: subjectId };
  return {};
}

/** A legal form code for a movement: mostly one the model recognises, now and then 5B over a 5A. */
const formCodeFor = (random: Random, movement: Movement) =>
  movement.legalForm?.code === "5A" && chance(random, 0.6) ? "5B" : pick(random, LEGAL_CLOCK_FORM_CODES)!;

const DIRECTORY_ENTRIES = buildOnCallDirectory();

const MORE_BUILDERS: readonly (readonly [weight: number, builder: Builder])[] = [
  // Ward closure: a bed-relevant gate (the shortlist, acceptance and the pull honour it).
  [
    2,
    (state, random) => {
      const unit = prefer(random, state.units, (candidate) => !candidate.isClosed);
      return {
        type: "CLOSE_WARD_TO_ADMISSIONS",
        unitId: id(unit),
        actingUnitId: id(unit),
        reason: pick(random, WARD_CLOSURE_REASON_IDS),
        ...(chance(random, 0.4) ? { until: currentNow + pick(random, WARD_REOPEN_AFTER_HOURS)! * 60 } : {}),
      };
    },
  ],
  [
    1.5,
    (state, random) => {
      const unit = prefer(random, state.units, (candidate) => Boolean(candidate.isClosed));
      return { type: "REOPEN_WARD_TO_ADMISSIONS", unitId: id(unit), actingUnitId: id(unit) };
    },
  ],
  // Bed releases, preparation and the discharge facts a ward records on a stay.
  [
    1.5,
    (state, random) => {
      const release = prefer(random, state.bedReleases, (candidate) => candidate.state === "discharged");
      return {
        type: "SET_BED_PREPARATION",
        releaseId: id(release),
        actingUnitId: release?.unitId ?? MISSING_ID,
        preparing: chance(random, 0.5),
        ...(chance(random, 0.5) ? { note: pick(random, BED_PREPARATION_NOTES) } : {}),
      };
    },
  ],
  [
    1,
    (state, random) => {
      const stay = stayFor(state, random, occupied);
      return {
        type: "UPDATE_EXPECTED_DISCHARGE",
        admissionId: id(stay),
        actingUnitId: stay?.unitId ?? MISSING_ID,
        expectedDischargeAt: currentNow + int(random, 60, 10_000),
      };
    },
  ],
  [
    1,
    (state, random) => {
      const stay = stayFor(state, random, occupied);
      return {
        type: "RECORD_OBSERVATION_LEVEL",
        target: { kind: "admission", admissionId: id(stay), actingUnitId: stay?.unitId ?? MISSING_ID },
        observation: observationAt(pick(random, OBSERVATION_LEVELS) ?? "general"),
      };
    },
  ],
  [
    1,
    (state, random) => {
      const stay = stayFor(state, random, occupied);
      return {
        type: "RECORD_STAY_DISCHARGE_BLOCKER",
        admissionId: id(stay),
        actingUnitId: stay?.unitId ?? MISSING_ID,
        blocker: pick(random, BED_RELEASE_BLOCKERS),
      };
    },
  ],
  [
    1,
    (state, random) => {
      const stay = stayFor(state, random, (candidate) => occupied(candidate) && Boolean(candidate.blockReason));
      return {
        type: "CLEAR_STAY_DISCHARGE_BLOCKER",
        admissionId: id(stay),
        actingUnitId: stay?.unitId ?? MISSING_ID,
        ...(chance(random, 0.5) ? { reason: pick(random, DISCHARGE_DELAY_CLEAR_REASONS) } : {}),
      };
    },
  ],
  [
    1,
    (state, random) => {
      const stay = stayFor(state, random, occupied);
      return {
        type: "SET_STEP_DOWN_CANDIDATE",
        admissionId: id(stay),
        actingUnitId: stay?.unitId ?? MISSING_ID,
        stepDownCandidate: chance(random, 0.5),
      };
    },
  ],
  [
    1,
    (state, random) => {
      const stay = stayFor(state, random, occupied);
      return {
        type: "RECORD_WARD_DIAGNOSIS",
        admissionId: id(stay),
        actingUnitId: stay?.unitId ?? MISSING_ID,
        block: chance(random, 0.5) ? "F20–F29" : "F30–F39",
      };
    },
  ],
  [
    1,
    (state, random) => {
      const stay = stayFor(state, random, occupied);
      const roll = random();
      return {
        type: "SET_DISCHARGE_BARRIER",
        admissionId: id(stay),
        actingUnitId: stay?.unitId ?? MISSING_ID,
        barrier: roll < 0.15 ? null : roll < 0.3 ? "None" : pick(random, DISCHARGE_BARRIERS),
      };
    },
  ],
  [
    1,
    (state, random) => {
      const stay = stayFor(state, random, occupied);
      const current = stay?.dischargeCriteria?.items.map((item) => item.criterion) ?? [];
      // The treating psychiatrist sets a list; afterwards the ward ticks one item met or not met.
      if (current.length > 0 && chance(random, 0.6)) {
        return {
          type: "SET_DISCHARGE_CRITERIA",
          admissionId: id(stay),
          actingUnitId: stay?.unitId ?? MISSING_ID,
          criteria: current,
          met: [],
          setByTreatingPsychiatrist: false,
          tick: { criterion: pick(random, current)!, met: chance(random, 0.7) },
        };
      }
      const criteria = chance(random, 0.1) ? null : someOf(random, DISCHARGE_CRITERIA, 4);
      return {
        type: "SET_DISCHARGE_CRITERIA",
        admissionId: id(stay),
        actingUnitId: stay?.unitId ?? MISSING_ID,
        criteria,
        met: criteria && chance(random, 0.3) ? [pick(random, criteria)!] : [],
        setByTreatingPsychiatrist: true,
      };
    },
  ],
  [
    1,
    (state, random) => {
      const stay = stayFor(state, random, occupied);
      return {
        type: "RECORD_REPATRIATION",
        admissionId: id(stay),
        homeHospital: chance(random, 0.95) ? pick(random, SITE_CODES) : MISSING_ID,
        receivingWardAgreed: chance(random, 0.5),
        mode: pick(random, REPATRIATION_MODES),
        provider: pick(random, TRANSPORT_PROVIDERS),
        cadNumber: `CAD${int(random, 1000, 9999)}`,
        transportLegalStatus: pick(random, TRANSPORT_LEGAL_STATUSES),
        estimatedAt: currentNow + int(random, 30, 1440),
      };
    },
  ],
  // Absence without leave: the missing person steps.
  [
    1,
    (state, random) => {
      const absent = new Set(state.leaveBeds.filter((bed) => bed.absentWithoutLeave).map((bed) => bed.admissionId));
      const stay = stayFor(state, random, (candidate) => absent.has(candidate.id));
      return {
        type: "RECORD_ABSENCE_STEP",
        admissionId: id(stay),
        actingUnitId: stay?.unitId ?? MISSING_ID,
        step: pick(random, ABSENCE_STEPS),
      };
    },
  ],
  // The care record and discharge record behind a stay (protected record events).
  [
    3,
    (state, random) => {
      const stay = stayFor(state, random, (candidate) => occupied(candidate) && Boolean(candidate.patientId));
      const unitId = pick(random, state.units)?.id ?? MISSING_ID;
      const existing = stay?.careJourney?.transfer;
      const team = pick(random, COMMUNITY_TEAM_PAGES);
      const roll = random();
      // Weighted towards the inter-ward transfer, the care-record path that moves a bed.
      const change =
        roll < 0.45
          ? {
              kind: "transfer",
              receivingUnitId: existing && chance(random, 0.8) ? existing.receivingUnitId : unitId,
              step: pick(random, ["accepted", "handover", "arrived"] as const),
            }
          : roll < 0.55
            ? { kind: "plan", item: pick(random, CARE_PLAN_ITEMS), status: pick(random, CARE_STATUSES) }
            : roll < 0.62
              ? {
                  kind: "document",
                  cohort: pick(random, ["adult", "camhs"] as const),
                  document: pick(random, CARE_DOCUMENTS),
                  status: pick(random, CARE_STATUSES),
                }
              : roll < 0.69
                ? { kind: "episode", episodeType: pick(random, EPISODE_TYPES) }
                : roll < 0.76
                  ? {
                      kind: "contact",
                      outcome: pick(random, CONTACT_OUTCOMES),
                      contactedAt: currentNow - int(random, 0, 60),
                    }
                  : roll < 0.83
                    ? {
                        kind: "follow_up",
                        contactId: pick(random, CARE_CONTACTS)!.id,
                        serviceId: team?.id ?? MISSING_ID,
                        appointmentAt: currentNow + int(random, 60, 10_000),
                        mode: pick(random, APPOINTMENT_MODES),
                      }
                    : roll < 0.9
                      ? {
                          kind: "coding",
                          receivingClass: pick(random, RECEIVING_CLASSES),
                          separationCode: pick(random, SEPARATION_CODES),
                          dischargedFromLeave: chance(random, 0.2),
                        }
                      : roll < 0.95
                        ? {
                            kind: "transport",
                            mode: pick(random, TRANSPORT_MODES),
                            region: pick(random, ["metro", "country"] as const),
                            riskDocument: chance(random, 0.5),
                            authority: pick(random, ["none", "4A", "7D"] as const),
                            escortSuitable: chance(random, 0.5),
                            leastRestrictiveReviewed: chance(random, 0.5),
                            regionalServiceConfirmed: chance(random, 0.5),
                          }
                        : {
                            kind: "legal",
                            authority: pick(random, ["revocation", "5A", "5B"] as const),
                            writtenAt: currentNow - int(random, 0, 120),
                            paperChecked: true,
                          };
      return {
        type: "RECORD_ADMISSION_CARE",
        ...recordFields(state, random, stay),
        ...(chance(random, 0.3) && team ? { actingTeamId: team.id } : {}),
        change,
      };
    },
  ],
  [
    1,
    (state, random) => ({
      type: "RECORD_ADMISSION_FOLLOW_UP",
      ...recordFields(
        state,
        random,
        stayFor(state, random, (stay) => Boolean(stay.patientId)),
      ),
      followUpState: pick(random, FOLLOW_UP_STATES),
    }),
  ],
  [
    1,
    (state, random) => {
      const stay = pick(random, state.admissions);
      return {
        type: "OPEN_DISCHARGE_RECORD",
        admissionId: id(stay),
        actingUnitId: stay?.unitId ?? MISSING_ID,
        expectedGeneration: state.worldGeneration,
        requestId: int(random, 1, 1_000_000),
      };
    },
  ],
  // Governance review and its undo.
  [
    1,
    (state, random) => {
      const entry = pick(
        random,
        governanceAuditEvents(state).filter((candidate) => candidate.category !== "review"),
      );
      const count = state.auditReviews.filter(
        (review) => review.eventId === entry?.id && review.generation === state.worldGeneration,
      ).length;
      return {
        type: "REVIEW_AUDIT_EVENT",
        eventId: entry?.id ?? MISSING_ID,
        expectedGeneration: state.worldGeneration,
        expectedReviewCount: chance(random, 0.9) ? count : count + 1,
        decision: pick(random, ["reviewed", "follow-up-required"] as const),
      };
    },
  ],
  [
    1,
    (state, random) => ({
      type: "UNDO_AUDIT_REVIEW",
      reviewId: state.auditReviews.at(chance(random, 0.8) ? -1 : 0)?.id ?? MISSING_ID,
      expectedGeneration: state.worldGeneration,
    }),
  ],
  // Undo taken from a recorded step: the role and ward that acted. Mostly the newest record (the
  // list is oldest first), since only the step just taken is still inside the undo window.
  [
    4,
    (state, random) => {
      const records = state.undoRecords ?? [];
      const record = chance(random, 0.8) ? records.at(-1) : pick(random, records);
      const role = chance(random, 0.8) ? record?.role : undefined;
      if (!record || record.kind === "step") {
        const undoType = record?.undoType ?? pick(random, UNDO_STEP_TYPES)!;
        return {
          type: undoType,
          ...(role ? { role } : {}),
          ...(record ? undoSubjectField(state, record.subjectId) : {}),
          ...(record?.unitId ? { actingUnitId: record.unitId } : {}),
          ...(record?.seq !== undefined && chance(random, 0.5) ? { recordSeq: record.seq } : {}),
        };
      }
      if (record.kind === "bed-placement")
        return {
          type: "UNDO_PLACE_IN_BED",
          ...(role ? { role } : {}),
          admissionId: record.admissionId,
          actingUnitId: record.unitId,
        };
      return {
        type: "UNDO_REFERRAL_DECISION",
        ...(role ? { role } : {}),
        referralId: record.referralId,
        ...(record.unitId ? { actingUnitId: record.unitId } : {}),
      };
    },
  ],
  [0.5, movementEvent("UNDO_LEGAL_FORM_RECORD")],
  [0.5, movementEvent("UNDO_SUPPORT_NOTIFICATION", ["arrived"])],
  [0.5, admissionEvent("UNDO_REPATRIATION", ["occupied"])],
  [0.5, () => ({ type: "UNDO_HANDOVER_SIGN_OFF" })],
  [0.5, () => ({ type: "RECORD_HANDOVER_SIGN_OFF" })],
  // Planned admissions: moving a booking.
  [
    1.5,
    (state, random) => {
      const booking = prefer(random, state.plannedAdmissions, (candidate) => candidate.state === "booked");
      const unitId = chance(random, 0.4) ? id(pick(random, state.units)) : (booking?.unitId ?? MISSING_ID);
      return {
        type: "CHANGE_PLANNED_ADMISSION",
        plannedAdmissionId: id(booking),
        reason: pick(random, PLANNED_ADMISSION_REASONS),
        unitId,
        actingUnitId: booking?.unitId ?? MISSING_ID,
        expectedArrivalAt: currentNow + int(random, 0, 2880),
        expectedStayDays: int(random, 1, 21),
        legalStatus: pick(random, LEGAL_STATUSES),
      };
    },
  ],
  // The ED front door: examination, clearance, deterioration, legal forms.
  [
    1,
    movementEvent("RECORD_EXAMINATION", ["placement_requested", "destination_review"], (_state, random) => ({
      outcome: pick(random, EXAMINATION_OUTCOMES),
    })),
  ],
  [
    2,
    movementEvent("RECORD_MOVEMENT_MEDICAL_CLEARANCE", undefined, (_state, random) => ({
      cleared: chance(random, 0.6),
    })),
  ],
  [
    1,
    (state, random) => ({
      type: "RECORD_MEDICAL_CLEARANCE",
      referralId: id(referralFor(state, random)),
      cleared: chance(random, 0.6),
    }),
  ],
  [1, (state, random) => ({ type: "RECORD_ARRIVED_IN_DEPARTMENT", referralId: id(referralFor(state, random)) })],
  [1, (state, random) => ({ type: "RECORD_LOCAL_BED_SOUGHT", referralId: id(referralFor(state, random)) })],
  [
    1.5,
    movementEvent(
      "RECORD_ED_MEDICAL_DETERIORATION",
      (movement) => movement.acceptedUnitId !== undefined,
      (_state, random, movement) => ({
        actingPlaceId: chance(random, 0.9) ? movement.originEdId : MISSING_ID,
      }),
    ),
  ],
  [1, movementEvent("RECORD_NO_REFERRAL", ["placement_requested"])],
  [
    1,
    movementEvent("RECORD_LEGAL_FORM_RECEIVED", undefined, (_state, random) =>
      chance(random, 0.5) ? { region: pick(random, ["metro", "country"] as const) } : {},
    ),
  ],
  [
    1,
    movementEvent(
      "CORRECT_LEGAL_FORM_RECEIPT",
      (movement) => movement.legalFormReceivedAt !== undefined,
      (_state, random) => ({ reason: pick(random, LEGAL_FORM_RECEIPT_CORRECTION_REASONS) }),
    ),
  ],
  [
    1,
    movementEvent(
      "RECORD_LEGAL_FORM_EXPIRY",
      (movement) => movement.legalForm !== undefined,
      (_state, random, movement) => ({ dueAt: (movement.legalForm?.dueAt ?? currentNow) + int(random, -30, 4000) }),
    ),
  ],
  [
    1,
    movementEvent("RECORD_LEGAL_FORM_WRITTEN", undefined, (_state, random, movement) => ({
      formCode: formCodeFor(random, movement),
      writtenAt: currentNow - int(random, 0, 240),
      ...(chance(random, 0.5) ? { region: pick(random, ["metro", "country"] as const) } : {}),
      ...(chance(random, 0.3) ? { ageBand: pick(random, ["adult", "under_18"] as const) } : {}),
      ...(chance(random, 0.5) ? { paperExpiresAt: currentNow + int(random, 60, 4000) } : {}),
    })),
  ],
  [
    1.5,
    (state, random) =>
      movementEvent(
        "RECORD_LEGAL_FORM_CONTINUATION",
        // Often a current Form 5A, so a 5B continues it and a second 5B follows the first.
        chance(random, 0.5)
          ? (movement) => movement.legalForm?.code === "5A"
          : (movement) => movement.legalForm !== undefined,
        (_state, inner, movement) => ({
          formCode: formCodeFor(inner, movement),
          // Sometimes the same start as the continuation already recorded (refused as a repeat).
          startedAt:
            movement.legalForm?.continuedBy && chance(inner, 0.3)
              ? movement.legalForm.continuedBy.startedAt
              : currentNow - int(inner, 0, 240),
          ...(chance(inner, 0.4) ? { region: pick(inner, ["metro", "country"] as const) } : {}),
          ...(chance(inner, 0.5) ? { paperExpiresAt: currentNow + int(inner, 60, 4000) } : {}),
        }),
      )(state, random),
  ],
  [
    1,
    movementEvent(
      "RECORD_COUNTRY_EXTENSION",
      (movement) => movement.legalForm?.code === "1A",
      (_state, random, movement) => ({
        paperExpiresAt: (movement.legalForm?.dueAt ?? currentNow) + int(random, 30, 4000),
      }),
    ),
  ],
  [
    1,
    (state, random) => {
      const patient = prefer(random, state.patients, (candidate) => !candidate.communityTreatmentOrder);
      return { type: "RECORD_COMMUNITY_TREATMENT_ORDER", patientId: patient?.id ?? MISSING_ID };
    },
  ],
  [
    1,
    (state, random) => {
      const patient = prefer(random, state.patients, (candidate) => Boolean(candidate.communityTreatmentOrder));
      return { type: "END_COMMUNITY_TREATMENT_ORDER", patientId: patient?.id ?? MISSING_ID };
    },
  ],
  // Movement facts: arrival details, flags, blockers, escalation, documents.
  [
    2,
    movementEvent(
      "SET_ARRIVAL_DETAILS",
      (movement) => movement.acceptedUnitId !== undefined,
      (_state, random, movement) => ({
        ...(movement.acceptedUnitId ? { actingUnitId: movement.acceptedUnitId } : {}),
        arrivalMode: pick(random, ARRIVAL_MODES),
        ...(chance(random, 0.4) ? { trackingNumber: `TRK${int(random, 100, 999)}` } : {}),
        estimatedArrivalAt: currentNow + int(random, -120, 600),
      }),
    ),
  ],
  [1, movementEvent("EVALUATE_ARRIVAL_LATENESS", (movement) => movement.arrivalDetails !== undefined)],
  [
    1,
    movementEvent("RAISE_EXPECT_FLAG", undefined, (_state, random) => ({
      kind: pick(random, ["voluntary_48h", "involuntary_7d"] as const),
    })),
  ],
  [1, movementEvent("CLEAR_EXPECT_FLAG", (movement) => movement.expectFlag?.clearedAt === undefined)],
  [1, movementEvent("CLEAR_MOVEMENT_URGENT_FLAG", (movement) => Boolean(movement.flaggedUrgent))],
  [1, movementEvent("RECORD_MOVEMENT_BLOCKER", undefined, () => ({ blocker: SYNTHETIC_NOTE }))],
  [1, movementEvent("CLEAR_MOVEMENT_BLOCKER")],
  [
    1,
    movementEvent("FLAG_LEGAL_MISMATCH", undefined, (state, random, movement) => ({
      unitId: movement.acceptedUnitId ?? id(pick(random, state.units)),
      kind: pick(random, ["involuntary_on_voluntary_ward", "voluntary_on_locked_ward"] as const),
    })),
  ],
  [
    1,
    movementEvent("RECORD_ESCALATION", ["placement_requested", "destination_review"], (state, random, movement) => ({
      triedUnitIds: movement.referredUnitIds.length > 0 ? movement.referredUnitIds : [id(pick(random, state.units))],
      contact: pick(random, ESCALATION_CONTACTS),
    })),
  ],
  [
    1,
    movementEvent("REFER_TO_COMMUNITY_TEAM", ["placement_requested", "destination_review"], (_state, random) => ({
      team: chance(random, 0.95) ? pick(random, communityTeamOptions()) : MISSING_ID,
      ...(chance(random, 0.3) ? { reason: SYNTHETIC_NOTE } : {}),
    })),
  ],
  [
    0.5,
    movementEvent("UPLOAD_PATIENT_FORM", undefined, (_state, random) => ({
      formName: "Synthetic form",
      fileName: "synthetic-form.pdf",
      sizeBytes: chance(random, 0.95) ? int(random, 1, 50_000) : 0,
    })),
  ],
  [
    1,
    (state, random) => {
      const movement = movementFor(state, random, ["arrived"]) ?? ({ id: MISSING_ID } as unknown as Movement);
      const discharge = chance(random, 0.4);
      const stay = stayFor(state, random, (candidate) => candidate.state === "departed");
      const told = chance(random, 0.6);
      return {
        type: "RECORD_SUPPORT_NOTIFICATION",
        occasion: discharge ? "discharge" : pick(random, ["admission", "transfer"] as const),
        ...(discharge ? { admissionId: id(stay) } : { movementId: movement.id }),
        party: pick(random, ["carer", "personal_support_person", "mhas"] as const),
        outcome: told ? "told" : "not_applicable",
        ...(told ? { who: "Synthetic support person", contactedAt: currentNow } : { reason: SYNTHETIC_NOTE }),
      };
    },
  ],
  // Bed meeting actions on a movement or a stay.
  [
    1,
    (state, random) => {
      const onStay = chance(random, 0.5);
      const subject = onStay ? pick(random, state.admissions) : movementFor(state, random);
      const owner = pick(random, BED_MEETING_ACTION_OWNERS)!;
      return {
        type: "RECORD_BED_MEETING_ACTION",
        subject: { kind: onStay ? "admission" : "movement", id: id(subject) },
        action: pick(random, BED_MEETING_ACTION_KIND_IDS),
        owner,
        ...(owner === "ward" || chance(random, 0.2) ? { unitId: id(pick(random, state.units)) } : {}),
        dueAt: currentNow + pick(random, BED_MEETING_ACTION_DUE_HOURS)! * 60,
      };
    },
  ],
  [
    1,
    (state, random) => {
      const withActions = [
        ...state.movements.filter((movement) => (movement.meetingActions ?? []).some((a) => a.doneAt === undefined)),
        ...state.admissions.filter((stay) => (stay.meetingActions ?? []).some((a) => a.doneAt === undefined)),
      ];
      const subject = withActions.length > 0 && chance(random, 0.85) ? pick(random, withActions) : undefined;
      const open = subject?.meetingActions?.find((action) => action.doneAt === undefined);
      const isStay = subject ? state.admissions.some((stay) => stay.id === subject.id) : false;
      return {
        type: "COMPLETE_BED_MEETING_ACTION",
        subject: { kind: isStay ? "admission" : "movement", id: subject?.id ?? id(pick(random, state.movements)) },
        action: open?.kind ?? pick(random, BED_MEETING_ACTION_KIND_IDS),
        ...(open?.ownerUnitId ? { actingUnitId: open.ownerUnitId } : {}),
        ...(open && chance(random, 0.7) ? { role: open.owner } : {}),
      };
    },
  ],
  // Fix plan item 4: assign a referral to a desk, and log calls to a ward, a team or the referrer.
  [
    0.5,
    (state, random) => ({
      type: "ASSIGN_REFERRAL",
      referralId: id(referralFor(state, random)),
      owner: pick(random, REFERRAL_OWNER_DESKS) ?? "coordinator",
    }),
  ],
  [
    0.5,
    (state, random) => {
      const referral = referralFor(state, random);
      const kind = pick(random, ["psychiatric_ward", "community_team", "referrer"] as const);
      const contact =
        kind === "psychiatric_ward"
          ? { kind, unitId: id(pick(random, state.units)) }
          : kind === "community_team"
            ? { kind, teamId: pick(random, COMMUNITY_TEAM_PAGES)?.id ?? MISSING_ID }
            : { kind: "referrer" as const };
      return {
        type: "LOG_REFERRAL_CONTACT",
        referralId: id(referral),
        contact,
        outcome: pick(random, REFERRAL_CONTACT_OUTCOME_IDS) ?? "no_answer",
      };
    },
  ],
  // D-72: seclusion and restraint on a stay, then ended; ward incidents and the seclusion room.
  [
    1,
    (state, random) => {
      const stay = pick(random, state.admissions);
      return {
        type: "RECORD_RESTRICTIVE_PRACTICE_START",
        unitId: stay?.unitId ?? id(pick(random, state.units)),
        actingUnitId: stay?.unitId,
        admissionId: id(stay),
        practice: pick(random, RESTRICTIVE_PRACTICE_IDS),
        startedAt: currentNow - pick(random, [0, 15, 90, 2000])!,
      };
    },
  ],
  [
    1,
    (state, random) => {
      const unit = prefer(random, state.units, (candidate) => openEpisodes(candidate.restrictivePractice).length > 0);
      const episode = pick(random, unit?.restrictivePractice?.episodes ?? []);
      return {
        type: "RECORD_RESTRICTIVE_PRACTICE_END",
        unitId: id(unit),
        actingUnitId: id(unit),
        episodeId: episode?.id ?? MISSING_ID,
        endedAt: currentNow - pick(random, [0, 5, 3000])!,
      };
    },
  ],
  [
    0.5,
    (state, random) => {
      const unit = pick(random, state.units);
      return {
        type: "RECORD_WARD_INCIDENT",
        unitId: id(unit),
        actingUnitId: id(unit),
        category: pick(random, WARD_INCIDENT_CATEGORY_IDS),
        at: currentNow - pick(random, [0, 60, -5])!,
      };
    },
  ],
  [
    0.5,
    (state, random) => {
      const unit = pick(random, state.units);
      return {
        type: "SET_SECLUSION_ROOM_STATUS",
        unitId: id(unit),
        actingUnitId: id(unit),
        status: pick(random, SECLUSION_ROOM_STATUS_IDS),
      };
    },
  ],
  // Fix plan item 16 (D-76): the coordinator asks one or two more wards on a referral.
  [
    0.5,
    (state, random) => ({
      type: "ASK_MORE_WARDS",
      referralId: id(referralFor(state, random)),
      unitIds: [id(pick(random, state.units)), ...(chance(random, 0.3) ? [id(pick(random, state.units))] : [])],
    }),
  ],
  // Referral follow-up: opened, information asked for and met, corrections, ward intake codes.
  [
    1,
    (state, random) => {
      const referral = referralFor(state, random);
      const unitId = referral ? addressedUnit(state, random, referral) : MISSING_ID;
      return { type: "MARK_REFERRAL_OPENED", referralId: id(referral), unitId, actingUnitId: unitId };
    },
  ],
  [
    1,
    (state, random) => {
      const referral = referralFor(state, random);
      const unitId = referral ? addressedUnit(state, random, referral) : MISSING_ID;
      return {
        type: "REQUEST_REFERRAL_INFORMATION",
        referralId: id(referral),
        unitId,
        actingUnitId: unitId,
        needs: someOf(random, REFERRAL_INFORMATION_NEED_IDS),
      };
    },
  ],
  [
    1,
    (state, random) => {
      const open = state.referrals.flatMap((referral) =>
        referral.destinations.flatMap((arm) => {
          const destination = arm.destination;
          return destination.kind === "psychiatric_ward"
            ? (arm.informationNeeds ?? [])
                .filter((need) => need.metAt === undefined)
                .map((need) => ({ referral, unitId: arm.acceptedUnitId ?? destination.unitId, need: need.need }))
            : [];
        }),
      );
      const chosen = open.length > 0 && chance(random, 0.85) ? pick(random, open) : undefined;
      const referral = chosen?.referral ?? pick(random, state.referrals);
      return {
        type: "MARK_REFERRAL_INFORMATION_MET",
        referralId: id(referral),
        wardUnitId: chosen?.unitId ?? (referral ? addressedUnit(state, random, referral) : MISSING_ID),
        need: chosen?.need ?? pick(random, REFERRAL_INFORMATION_NEED_IDS),
      };
    },
  ],
  [
    0.5,
    (state, random) => ({
      type: "ADD_REFERRAL_CORRECTION",
      referralId: id(pick(random, state.referrals)),
      note: SYNTHETIC_NOTE,
    }),
  ],
  [
    1,
    (state, random) => {
      const unit = pick(random, state.units);
      return {
        type: "RECORD_WARD_INTAKE_CONSTRAINTS",
        unitId: id(unit),
        actingUnitId: id(unit),
        codes: chance(random, 0.2) ? [] : someOf(random, WARD_INTAKE_CONSTRAINTS, 2),
      };
    },
  ],
  // Ward-level confirmations and requests.
  [
    1,
    (state, random) => {
      const unit = pick(random, state.units);
      return {
        type: "CONFIRM_MORNING_ROLLUP",
        unitId: id(unit),
        actingUnitId: id(unit),
        expectedDischarges: int(random, 0, 4),
      };
    },
  ],
  [0.5, (state, random) => ({ type: "REQUEST_CAPACITY_REFRESH", unitId: id(pick(random, state.units)) })],
  [
    0.5,
    (state, random) => ({
      type: "SEND_WARD_BUZZ",
      unitId: id(pick(random, state.units)),
      message: pick(random, WARD_BUZZ_MESSAGES),
      ...(chance(random, 0.3) ? { urgent: true } : {}),
    }),
  ],
  [0.5, () => ({ type: "EVALUATE_LEAVE_BED_WARNINGS" })],
  [0.5, (_state, random) => ({ type: "RECORD_CLINICAL_CONTACT", teamId: id(pick(random, COMMUNITY_TEAM_PAGES)) })],
  [
    0.5,
    (state, random) => ({
      type: "SET_CONFIGURATION",
      payload: state.configuration,
      ...(chance(random, 0.5) ? { baseConfiguration: state.configuration } : {}),
    }),
  ],
  [
    0.5,
    (_state, random) => ({
      type: "ADD_PATIENT",
      umrn: `SYN-FUZZ-${int(random, 1, 99_999)}`,
      givenName: "Demo",
      familyName: "Fuzz",
      dateOfBirth: "1980-01-01",
      ...(chance(random, 0.5) ? { gender: pick(random, GENDERS) } : {}),
    }),
  ],
  // Notices and the action inbox.
  [
    1,
    (state, random) => {
      const notice = prefer(random, state.notices, (candidate) => candidate.readAt === undefined);
      const asAddressee = notice && chance(random, 0.8);
      return {
        type: "MARK_NOTICE_READ",
        noticeId: id(notice),
        ...(asAddressee ? { role: notice.to.role } : {}),
        ...(asAddressee && notice.to.placeId !== undefined ? { actingPlaceId: notice.to.placeId } : {}),
      };
    },
  ],
  [1, inboxEvent("ACKNOWLEDGE_INBOX_ITEM")],
  [0.5, inboxEvent("COMPLETE_INBOX_ITEM")],
  [0.5, inboxEvent("REOPEN_INBOX_ITEM", (state) => state.inboxCompletions)],
  [1, inboxEvent("TAKE_INBOX_ITEM_OWNERSHIP")],
  [
    1,
    (state, random) => ({
      ...inboxEvent("SNOOZE_INBOX_ITEM")(state, random)!,
      until: currentNow + int(random, chance(random, 0.1) ? -10 : 5, 600),
      reason: pick(random, SNOOZE_REASON_IDS),
    }),
  ],
  [1, inboxEvent("UNSNOOZE_INBOX_ITEM", (state) => state.inboxSnoozes)],
  // Network alerts: dispatch, acknowledge, reply, extend and stand down.
  [
    1,
    (_state, random) => ({
      type: "DISPATCH_BROADCAST_ALERT",
      title: "Synthetic alert",
      message: SYNTHETIC_NOTE,
      severity: pick(random, BROADCAST_SEVERITIES),
      category: pick(random, BROADCAST_CATEGORIES),
      targetScope: pick(random, BROADCAST_TARGET_SCOPES),
      targetScopeLabel: "Synthetic scope",
      durationMinutes: int(random, 30, 480),
      dispatchedByName: "State Bed Desk",
      ...(chance(random, 0.5) ? { kind: pick(random, ["directive", "bed_call"] as const) } : {}),
    }),
  ],
  [
    1,
    (state, random) => {
      const desk = chance(random, 0.3);
      return {
        type: "ACKNOWLEDGE_BROADCAST_ALERT",
        alertId: id(prefer(random, alerts(state), (alert) => alert.status === "active")),
        unitId: desk ? COORDINATOR_DESK_ACKNOWLEDGER_ID : id(pick(random, state.units)),
        ...(desk && chance(random, 0.9) ? { role: "coordinator" } : {}),
      };
    },
  ],
  [
    1,
    (state, random) => {
      const alert = prefer(
        random,
        alerts(state),
        (candidate) => candidate.status === "active" && candidate.kind !== undefined,
      );
      const asked = (alert as { targetUnitIds?: readonly string[] } | undefined)?.targetUnitIds ?? [];
      const unitId = asked.length > 0 && chance(random, 0.85) ? pick(random, asked)! : id(pick(random, state.units));
      const answer = pick(random, alert?.kind === "pull_now" ? PULL_NOW_ANSWERS : BED_CALL_ANSWERS)!;
      return {
        type: "REPLY_BROADCAST_ALERT",
        alertId: id(alert),
        unitId,
        actingUnitId: unitId,
        answer,
        ...(answer === "can_take" ? { beds: int(random, 1, 3) } : {}),
        ...(answer === "after_discharge" || answer === "bed_ready_at"
          ? { readyAt: currentNow + int(random, 30, 600) }
          : {}),
        ...(answer === "cannot" ? { reason: pick(random, REFERRAL_DECLINE_REASONS) } : {}),
      };
    },
  ],
  // Closing-the-loop (package E): home service return and on-call directory checks.
  [
    0.5,
    (state, random) => {
      const answered = chance(random, 0.5);
      return {
        type: "RECORD_HOME_SERVICE_RETURN",
        admissionId: id(stayFor(state, random, occupied)),
        step: answered ? "answered" : "requested",
        ...(answered
          ? { answer: pick(random, HOME_SERVICE_ANSWERS), prerequisites: [pick(random, RETURN_PREREQUISITES)!] }
          : { homeHospital: chance(random, 0.95) ? pick(random, SITE_CODES) : MISSING_ID }),
        ...(chance(random, 0.5) ? { nextReviewAt: currentNow + int(random, 0, 14) * 1440 } : {}),
      };
    },
  ],
  [
    0.5,
    (_state, random) => ({
      type: "RECORD_DIRECTORY_CHECK",
      entryId: chance(random, 0.95) ? id(pick(random, DIRECTORY_ENTRIES)) : MISSING_ID,
    }),
  ],
  [0.5, (state, random) => ({ type: "EXTEND_BROADCAST_ALERT", alertId: id(pick(random, alerts(state))) })],
  [
    0.5,
    (state, random) => ({
      type: "STAND_DOWN_BROADCAST_ALERT",
      alertId: id(prefer(random, alerts(state), (alert) => alert.status === "active")),
    }),
  ],
];

const ALL_BUILDERS = [...BUILDERS, ...MORE_BUILDERS];

const TOTAL_WEIGHT = ALL_BUILDERS.reduce((sum, [weight]) => sum + weight, 0);

/** Event types the generator can send, for the coverage assertion in the test. */
export const FUZZED_EVENT_TYPES = new Set<WardFlowEvent["type"]>();

function chooseBuilder(random: Random): Builder {
  let roll = random() * TOTAL_WEIGHT;
  for (const [weight, builder] of ALL_BUILDERS) {
    roll -= weight;
    if (roll < 0) return builder;
  }
  return ALL_BUILDERS[ALL_BUILDERS.length - 1][1];
}

/**
 * The event time `nextEvent` is building for, so planned times sit ahead of the run's clock rather
 * than the fixed anchor (a long run would otherwise book arrivals in the past).
 */
let currentNow = NOW_ANCHOR;

/** The demonstration clock the screens would pass: anchor, plus elapsed time, plus jumps. */
export function nowFor(state: WardFlowState, step: number): number {
  return NOW_ANCHOR + state.clockOffsetMinutes + step * 5;
}

/** One step in this many is a sweep step (see `nextEvent`). */
const SWEEP_EVERY = 8;

/**
 * The next event for this state. Never null: retries until a builder has a subject.
 *
 * With `seed`, every `SWEEP_EVERY`th step takes the next builder in list order instead of a
 * weighted draw, starting where the previous seed's sweep stopped (100 steps make 12 sweep steps),
 * so a run of consecutive seeds sends every event type at least once however small its weight.
 * Still reproducible from the seed alone. A builder with no subject falls back to a weighted draw.
 */
export function nextEvent(
  state: WardFlowState,
  random: Random,
  step: number,
  seed?: number,
  steps = 100,
): WardFlowEvent {
  currentNow = nowFor(state, step);
  const sweep =
    seed !== undefined && step % SWEEP_EVERY === SWEEP_EVERY - 1
      ? ALL_BUILDERS[(seed * Math.floor(steps / SWEEP_EVERY) + Math.floor(step / SWEEP_EVERY)) % ALL_BUILDERS.length][1]
      : undefined;
  for (let attempt = 0; ; attempt += 1) {
    const draft = (attempt === 0 && sweep ? sweep : chooseBuilder(random))(state, random);
    if (!draft) continue;
    const permitted = EVENT_ROLE[draft.type];
    const role = chance(random, 0.9) && permitted.length > 0 ? pick(random, permitted) : pick(random, ALL_ROLES);
    FUZZED_EVENT_TYPES.add(draft.type);
    const event = { now: currentNow, ...draft, role: draft.role ?? role };
    return event as unknown as WardFlowEvent;
  }
}
