import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowEvent, WardFlowRole } from "@/components/ward-management/ward-flow-events";

/**
 * Event log, step 1 (25 Sept 2026): an in-memory record of every event dispatched in this browser
 * session — its type, role, time, whether the engine accepted it, and the ids it touches. Nothing
 * else: typed free text (reasons, notes, names) is deliberately NOT copied, and the log is never
 * written to storage. `acceptedEventsForHistory` shapes it for the history selectors.
 */
export type EventLogEntry = {
  /** Monotonic within a scenario, so consumers can track entries across retention trims. */
  sequence: number;
  type: WardFlowEvent["type"];
  role: WardFlowRole | undefined;
  now: Instant | undefined;
  /** False when the engine refused the event (a rejection was recorded). */
  accepted: boolean;
  movementId?: string;
  admissionId?: string;
  // No patientId: archived D-14 keeps the patient link out of everything but its allowlisted readers.
  referralId?: string;
  unitId?: string;
  actingUnitId?: string;
  bedId?: string;
  releaseId?: string;
  /** The booking a planned-admission event acts on (stream D). An id, never the initials. */
  plannedAdmissionId?: string;
  /** D-72: the seclusion or restraint episode an end names; the chronology finds its stay. */
  episodeId?: string;
  /**
   * H1 (D-MCA (Josh, 14 Nov 2026), ruling 1): a step that waited (offline, or for Retry) and was
   * recorded at the time the person acted (`now`): the board minute it reached the server. History
   * says "entered offline, sent 10:45".
   */
  sentAt?: Instant;
};

/** History's note on a step that waited: "entered offline, sent 10:45". */
export function enteredOfflineNote(sentAt: Instant, now: Instant): string {
  return `entered offline, sent ${formatInstantWithDay(sentAt, now)}`;
}

/** The server's note on an accepted save that waited, as the log entry's `now` and `sentAt`. */
export function enteredOfflineLog(note: unknown): { now: Instant; sentAt: Instant } | Record<string, never> {
  if (!note || typeof note !== "object") return {};
  const { actedAt, sentAt } = note as { actedAt?: unknown; sentAt?: unknown };
  return Number.isSafeInteger(actedAt) && Number.isSafeInteger(sentAt) && (sentAt as number) > (actedAt as number)
    ? { now: actedAt as number, sentAt: sentAt as number }
    : {};
}

const ID_FIELDS = [
  "movementId",
  "admissionId",
  "referralId",
  "unitId",
  "actingUnitId",
  "bedId",
  "releaseId",
  "plannedAdmissionId",
  "episodeId",
] as const;

export function eventLogEntryFor(event: WardFlowEvent, accepted: boolean): EventLogEntry {
  const role = "role" in event && typeof event.role === "string" ? (event.role as WardFlowRole) : undefined;
  const now = "now" in event && typeof event.now === "number" ? event.now : undefined;
  const entry: EventLogEntry = {
    sequence: 0,
    type: event.type,
    role,
    now,
    accepted,
  };
  for (const field of ID_FIELDS) {
    if (field in event) {
      const value = Reflect.get(event, field);
      if (typeof value === "string" && value.length > 0) entry[field] = value;
    }
  }
  // Observation commands name their record inside a closed target, not at the top level.
  if (event.type === "RECORD_OBSERVATION_LEVEL" && event.target && typeof event.target === "object") {
    if (event.target.kind === "movement" && typeof event.target.movementId === "string")
      entry.movementId = event.target.movementId;
    else if (event.target.kind === "admission" && typeof event.target.admissionId === "string")
      entry.admissionId = event.target.admissionId;
    if (typeof event.target.actingUnitId === "string") entry.actingUnitId = event.target.actingUnitId;
  }
  return entry;
}

/**
 * The ACCEPTED entries, as the log records them (ids only, no typed payload), for the history selectors. A refused
 * event changed nothing, so it is not history. Reasons read as "Not recorded", because no free text
 * is kept.
 */
export function acceptedEventsForHistory(log: readonly EventLogEntry[]): EventLogEntry[] {
  return log.filter((entry) => entry.accepted);
}
