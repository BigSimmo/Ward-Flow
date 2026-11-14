import { auditSubject, type AuditSubject } from "./ward-audit";
import { formatInstantWithDay, type Instant } from "./ward-clock";
import type { WardFlowEvent } from "./ward-flow-events";
import type { WardFlowState } from "./ward-flow-reducer";

/**
 * H1 (mechanics and clock audit, 14 Nov 2026; D-210 (Josh, 14 Nov 2026), ruling 1): a save on the
 * signed-in site carries the board minute the person pressed it at (`actedAt`, beside the command,
 * never inside it). The server applies a save that reaches it in the same minute or the next as it
 * always did, stamped with its own time. A save that waited (offline, or for Retry) keeps the time
 * the person acted, but only when that is not later than the server's time and not earlier than
 * the record's last change; otherwise it is refused and the person is asked to enter it again.
 */
const OFFLINE_ENTRY_SLACK_MINUTES = 1;
/**
 * A waiting save older than this is refused (untested-537 lane L1, INV-M1670-032): records with no
 * stamped last change (handover sign-off, configuration, outage window) otherwise took any earlier
 * time, even 0 or a negative minute. Twelve hours covers a lost signal across a whole shift.
 */
const OFFLINE_ENTRY_MAX_MINUTES = 12 * 60;

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

function sameSubject(a: AuditSubject, b: AuditSubject): boolean {
  switch (a.kind) {
    case "admission":
      return b.kind === "admission" && a.admissionId === b.admissionId;
    case "movement":
      return b.kind === "movement" && a.movementId === b.movementId;
    case "referral":
      return b.kind === "referral" && a.referralId === b.referralId;
    case "bed-release":
      return b.kind === "bed-release" && a.releaseId === b.releaseId;
    case "audit-event":
      return b.kind === "audit-event" && a.eventId === b.eventId;
    default:
      return false;
  }
}

/**
 * The latest stamped change to the record this command acts on, from the stamps that are cheap to
 * find: the record's own audit entries (`state.auditEvents` with the same subject), a movement's
 * opening, stage changes and closure, and a bed count's last confirmation for a new bed count.
 * Stamps later than `notAfter` are plans, not changes, and are skipped. A change to the record that
 * leaves none of these stamps is still caught: a waiting save is checked against the board it was
 * made on (CS-19, `pinToBoard`), so a record changed after that board is refused as changed meanwhile.
 */
function subjectLastChange(state: WardFlowState, event: WardFlowEvent, notAfter: Instant): Instant | null {
  const stamps: number[] = [];
  const subject = auditSubject(state, event);
  if (subject.kind !== "unresolved" && subject.kind !== "configuration")
    for (const entry of state.auditEvents)
      if (finite(entry.at) && sameSubject(subject, entry.subject)) stamps.push(entry.at);
  if (subject.kind === "movement") {
    const movement = state.movements.find((candidate) => candidate.id === subject.movementId);
    if (movement) {
      stamps.push(movement.openedAt);
      for (const change of movement.stageChanges ?? []) stamps.push(change.at);
      if (movement.closure) stamps.push(movement.closure.at);
    }
  }
  if (event.type === "CONFIRM_CAPACITY") {
    const unit = state.units.find((candidate) => candidate.id === event.unitId);
    if (unit) stamps.push(unit.allocatable.confirmedAt);
  }
  const past = stamps.filter((at) => finite(at) && at <= notAfter);
  return past.length ? Math.max(...past) : null;
}

export type OfflineEntryTime =
  { now: Instant; offline: false } | { now: Instant; offline: true; sentAt: Instant } | { refusal: string };

/**
 * The time a command is recorded at on the server. `actedAt` absent (an older app) or within
 * `OFFLINE_ENTRY_SLACK_MINUTES` of the server's minute, or later than it: the server's own time, as
 * before. Demo controls always take the server's time.
 */
export function offlineEntryTime(
  state: WardFlowState,
  event: WardFlowEvent,
  actedAt: unknown,
  serverNow: Instant,
): OfflineEntryTime {
  if (!Number.isSafeInteger(actedAt) || event.role === "demo") return { now: serverNow, offline: false };
  const acted = actedAt as number;
  if (serverNow - acted <= OFFLINE_ENTRY_SLACK_MINUTES) return { now: serverNow, offline: false };
  if (serverNow - acted > OFFLINE_ENTRY_MAX_MINUTES)
    return {
      refusal: `This change was entered offline more than 12 hours ago, at ${formatInstantWithDay(acted, serverNow)}. Review the record and enter it again`,
    };
  const lastChange = subjectLastChange(state, event, serverNow);
  if (lastChange !== null && acted < lastChange)
    return {
      refusal: `This change was entered offline at ${formatInstantWithDay(acted, serverNow)}, before the record last changed at ${formatInstantWithDay(lastChange, serverNow)}. Review the record and enter it again`,
    };
  return { now: acted, offline: true, sentAt: serverNow };
}
