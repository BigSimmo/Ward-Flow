import { MINUTES_PER_DAY, minuteOfDayFromClockText, type Instant } from "../ward-clock";
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

export const RESTRICTIVE_PRACTICES = [
  { id: "seclusion", label: "Seclusion" },
  { id: "bodily_restraint_physical", label: "Bodily restraint, physical" },
  { id: "bodily_restraint_mechanical", label: "Bodily restraint, mechanical" },
] as const;
export type RestrictivePractice = (typeof RESTRICTIVE_PRACTICES)[number]["id"];
export const RESTRICTIVE_PRACTICE_IDS: readonly string[] = RESTRICTIVE_PRACTICES.map((entry) => entry.id);

export const WARD_INCIDENT_CATEGORIES = [
  { id: "aggression_to_staff", label: "Aggression towards staff" },
  { id: "aggression_to_patient", label: "Aggression towards another patient" },
  { id: "self_harm", label: "Self-harm" },
  { id: "property_damage", label: "Property damage" },
  { id: "contraband_found", label: "Contraband found" },
  { id: "fall", label: "Fall" },
  { id: "medication", label: "Medication incident" },
  { id: "other", label: "Other incident" },
] as const;
export type WardIncidentCategory = (typeof WARD_INCIDENT_CATEGORIES)[number]["id"];
export const WARD_INCIDENT_CATEGORY_IDS: readonly string[] = WARD_INCIDENT_CATEGORIES.map((entry) => entry.id);

export const SECLUSION_ROOM_STATUSES = [
  { id: "available", label: "Available" },
  { id: "out_of_service", label: "Out of service" },
] as const;
export type SeclusionRoomStatus = (typeof SECLUSION_ROOM_STATUSES)[number]["id"];
export const SECLUSION_ROOM_STATUS_IDS: readonly string[] = SECLUSION_ROOM_STATUSES.map((entry) => entry.id);

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

export function restrictivePracticeLabel(practice: string): string {
  return RESTRICTIVE_PRACTICES.find((entry) => entry.id === practice)?.label ?? "Restrictive practice";
}

export function wardIncidentLabel(category: string): string {
  return WARD_INCIDENT_CATEGORIES.find((entry) => entry.id === category)?.label ?? "Incident";
}

/**
 * A typed `HH:MM` (or "0930") as the latest such time at or before `now`, so "23:50" typed just
 * after midnight means last night. `undefined` when the time cannot be read.
 */
export function pastInstantFromClockText(text: string, now: Instant): Instant | undefined {
  const minute = minuteOfDayFromClockText(text);
  if (minute === undefined) return undefined;
  const today = Math.floor(now / MINUTES_PER_DAY) * MINUTES_PER_DAY + minute;
  return today > now ? today - MINUTES_PER_DAY : today;
}

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

/** In use now, from an open seclusion; otherwise the status a person last recorded, if any. */
export type SeclusionRoomView =
  | { kind: "in_use"; since: Instant }
  | { kind: "recorded"; status: SeclusionRoomStatus; at: Instant; by: string }
  | { kind: "not_recorded" };

export function seclusionRoomView(record: WardRestrictivePractice | undefined): SeclusionRoomView {
  const secluded = openEpisodes(record).filter((episode) => episode.practice === "seclusion");
  if (secluded.length > 0) return { kind: "in_use", since: Math.min(...secluded.map((episode) => episode.startedAt)) };
  const room = record?.seclusionRoom;
  return room ? { kind: "recorded", status: room.status, at: room.at, by: room.by } : { kind: "not_recorded" };
}

/** Incidents shown on the view: those in the last day. Older ones stay on the record. */
export function recentIncidents(record: WardRestrictivePractice | undefined, now: Instant): WardIncident[] {
  return (record?.incidents ?? [])
    .filter((incident) => incident.at >= now - MINUTES_PER_DAY)
    .sort((a, b) => b.at - a.at);
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
