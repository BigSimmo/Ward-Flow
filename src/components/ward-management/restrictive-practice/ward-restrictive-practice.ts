import { MINUTES_PER_DAY, type Instant } from "../ward-clock";
import type { WardFlowRole } from "../ward-flow-roles";

/**
 * SECLUSION, RESTRAINT AND INCIDENTS, OPERATIONAL VIEW ONLY (D-72, 21 Oct 2026).
 *
 * What is in use on a ward right now, whether its seclusion room can be used, and which incidents
 * the ward recorded in the last day. Every time is one a person typed, and nothing here computes an
 * order's length, a review time or any other legal limit (R5, D-70). The legal register, with its
 * orders, reviews and examinations, stays in the health service's own system. Fixed lists only, so
 * nothing recorded here is typed text (D-18).
 *
 * Kept on the ward (`Unit.restrictivePractice`), written only by the events in
 * `ward-flow-restrictive-practice-events.ts`.
 */

// The ids only: their labels and the view's helpers are in `restrictive-practice-view.ts`, which only
// the screen loads, so the shared engine every page carries stays small (phone script budget).
export const RESTRICTIVE_PRACTICE_IDS = [
  "seclusion",
  "bodily_restraint_physical",
  "bodily_restraint_mechanical",
] as const;
export type RestrictivePractice = (typeof RESTRICTIVE_PRACTICE_IDS)[number];

export const WARD_INCIDENT_CATEGORY_IDS = [
  "aggression_to_staff",
  "aggression_to_patient",
  "self_harm",
  "property_damage",
  "contraband_found",
  "fall",
  "medication",
  "other",
] as const;
export type WardIncidentCategory = (typeof WARD_INCIDENT_CATEGORY_IDS)[number];

export const SECLUSION_ROOM_STATUS_IDS = ["available", "out_of_service"] as const;
export type SeclusionRoomStatus = (typeof SECLUSION_ROOM_STATUS_IDS)[number];

export type RestrictivePracticeEpisode = {
  id: string;
  practice: RestrictivePractice;
  /** The stay on this ward. */
  admissionId: string;
  /** Typed by the person recording it. */
  startedAt: Instant;
  /** Typed by the person recording it. Absent while in use. */
  endedAt?: Instant;
  recordedAt: Instant;
  /** The role label of whoever recorded the start. */
  recordedBy: string;
};

export type WardIncident = {
  id: string;
  category: WardIncidentCategory;
  /** When it happened, typed. */
  at: Instant;
  recordedAt: Instant;
  recordedBy: string;
};

type SeclusionRoomRecord = {
  status: SeclusionRoomStatus;
  at: Instant;
  by: string;
};

export type WardRestrictivePractice = {
  episodes: RestrictivePracticeEpisode[];
  incidents: WardIncident[];
  seclusionRoom?: SeclusionRoomRecord;
};

export const EMPTY_WARD_RESTRICTIVE_PRACTICE: WardRestrictivePractice = { episodes: [], incidents: [] };

/**
 * Why a typed time cannot be recorded, or `null` when it can. A typed time is read off a clock, never
 * a date, so it reaches back one day at most.
 */
export function typedTimeRefusal(at: Instant, now: Instant, after?: Instant): string | null {
  if (!Number.isFinite(at)) return "The time could not be read";
  if (at > now) return "The time cannot be later than now";
  if (at < now - MINUTES_PER_DAY) return "The time must be within the last 24 hours";
  if (after !== undefined && at < after) return "The end time cannot be before the start time";
  return null;
}

export function openEpisodes(record: WardRestrictivePractice | undefined): RestrictivePracticeEpisode[] {
  return (record?.episodes ?? []).filter((episode) => episode.endedAt === undefined);
}

/**
 * Audit S-3 (26 Oct 2026): a stay cannot leave its ward while seclusion or restraint is still
 * recorded as in use for it. Nothing ends an episode for the ward: the end time is the ward's own
 * typed record, so the leaving step is refused until it is recorded.
 */
export function openRestrictivePracticeRefusal(
  record: WardRestrictivePractice | undefined,
  admissionId: string,
): string | undefined {
  const open = openEpisodes(record).filter((episode) => episode.admissionId === admissionId);
  if (open.length === 0) return undefined;
  const what = open.some((episode) => episode.practice === "seclusion") ? "Seclusion" : "Restraint";
  return `${what} is still recorded as in use for this patient. Record when it ended before they leave the ward`;
}

/** The four events that write `Unit.restrictivePractice`, joined into `WardFlowEvent`. */
export type RestrictivePracticeWardFlowEvent =
  | {
      /**
       * D-72, operational view only (21 Oct 2026): seclusion or bodily restraint has started for a
       * stay on this ward. `practice` from `RESTRICTIVE_PRACTICES`, `startedAt` a time a person typed
       * within the last day. Nothing is computed from it: no order length, review or legal limit.
       * The ward for itself (`actingUnitId`), its site bed manager or the coordinator.
       */
      type: "RECORD_RESTRICTIVE_PRACTICE_START";
      role: WardFlowRole;
      now: Instant;
      unitId: string;
      actingUnitId?: string;
      admissionId: string;
      practice: RestrictivePractice;
      startedAt: Instant;
    }
  | {
      /** D-72: the open episode has ended, at a typed time no earlier than its start. */
      type: "RECORD_RESTRICTIVE_PRACTICE_END";
      role: WardFlowRole;
      now: Instant;
      unitId: string;
      actingUnitId?: string;
      episodeId: string;
      endedAt: Instant;
    }
  | {
      /**
       * D-72: an incident on this ward, from `WARD_INCIDENT_CATEGORIES`, at a typed time. Names no
       * patient; the incident report itself stays in the health service's own system.
       */
      type: "RECORD_WARD_INCIDENT";
      role: WardFlowRole;
      now: Instant;
      unitId: string;
      actingUnitId?: string;
      category: WardIncidentCategory;
      at: Instant;
    }
  | {
      /** D-72: whether the ward's seclusion room can be used, from `SECLUSION_ROOM_STATUSES`. */
      type: "SET_SECLUSION_ROOM_STATUS";
      role: WardFlowRole;
      now: Instant;
      unitId: string;
      actingUnitId?: string;
      status: SeclusionRoomStatus;
    };
