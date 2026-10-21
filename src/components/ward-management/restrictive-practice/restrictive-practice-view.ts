import { MINUTES_PER_DAY, minuteOfDayFromClockText, type Instant } from "../ward-clock";
import {
  openEpisodes,
  type RestrictivePractice,
  type SeclusionRoomStatus,
  type WardIncident,
  type WardIncidentCategory,
  type WardRestrictivePractice,
} from "./ward-restrictive-practice";

/**
 * D-72: the seclusion view's labels and read helpers. Only the screen loads this file; the engine
 * and storage check use the ids in `ward-restrictive-practice.ts`.
 */
export const RESTRICTIVE_PRACTICES: readonly { id: RestrictivePractice; label: string }[] = [
  { id: "seclusion", label: "Seclusion" },
  { id: "bodily_restraint_physical", label: "Bodily restraint, physical" },
  { id: "bodily_restraint_mechanical", label: "Bodily restraint, mechanical" },
];

export const WARD_INCIDENT_CATEGORIES: readonly { id: WardIncidentCategory; label: string }[] = [
  { id: "aggression_to_staff", label: "Aggression towards staff" },
  { id: "aggression_to_patient", label: "Aggression towards another patient" },
  { id: "self_harm", label: "Self-harm" },
  { id: "property_damage", label: "Property damage" },
  { id: "contraband_found", label: "Contraband found" },
  { id: "fall", label: "Fall" },
  { id: "medication", label: "Medication incident" },
  { id: "other", label: "Other incident" },
];

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

/** In use now, from an open seclusion; otherwise the status a person last recorded, if any. */
type SeclusionRoomView =
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
