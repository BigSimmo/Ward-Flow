import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowEvent, WardFlowRole } from "@/components/ward-management/ward-flow-events";

/**
 * Event log, step 1 (25 Sept 2026): an in-memory record of every event dispatched in this browser
 * session — its type, role, time, whether the engine accepted it, and the ids it touches. Nothing
 * else: typed free text (reasons, notes, names) is deliberately NOT copied, and the log is never
 * written to storage. `acceptedEventsForHistory` shapes it for the history selectors.
 */
export type EventLogEntry = {
  type: WardFlowEvent["type"];
  role: WardFlowRole | undefined;
  now: Instant | undefined;
  /** False when the engine refused the event (a rejection was recorded). */
  accepted: boolean;
  movementId?: string;
  admissionId?: string;
  // No patientId: D-14 keeps the patient link out of everything but its allowlisted readers.
  referralId?: string;
  unitId?: string;
  actingUnitId?: string;
  bedId?: string;
  releaseId?: string;
  /** The booking a planned-admission event acts on (stream D). An id, never the initials. */
  plannedAdmissionId?: string;
};

const EVENT_LOG_SEQUENCE = new WeakMap<EventLogEntry, number>();

export function withEventLogSequence(entry: EventLogEntry, sequence: number): EventLogEntry {
  EVENT_LOG_SEQUENCE.set(entry, sequence);
  return entry;
}

export function getEventLogSequence(entry: EventLogEntry | undefined, fallbackIndex = -1): number {
  if (!entry) return fallbackIndex;
  return EVENT_LOG_SEQUENCE.get(entry) ?? fallbackIndex;
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
] as const;

export function eventLogEntryFor(event: WardFlowEvent, accepted: boolean): EventLogEntry {
  const role = "role" in event && typeof event.role === "string" ? (event.role as WardFlowRole) : undefined;
  const now = "now" in event && typeof event.now === "number" ? event.now : undefined;
  const entry: EventLogEntry = {
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
