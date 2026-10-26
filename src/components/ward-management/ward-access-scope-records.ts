/**
 * Scoping for the records around the workspace: broadcast alerts, the executive small number
 * wording, and which coordinator records a service coordinator keeps. Moved unchanged out of
 * `ward-access-scope.ts` (F-17 file split, 26 Oct 2026), which re-exports each name so existing
 * importers keep working. Pure and browser free, like the scope itself.
 */
import { directiveDesks } from "@/components/ward-management/alerts/global-alert-view";
import type { BroadcastAlert } from "@/components/ward-management/alerts/ward-broadcast-model";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import type { AuditSubject } from "@/components/ward-management/ward-audit";
import type { EventLogEntry } from "@/components/ward-management/ward-event-log";
import type { Unit } from "@/components/ward-management/ward-model";
import {
  edInScope,
  unitInScope,
  type PlaceLookup,
  type WardAccess,
} from "@/components/ward-management/ward-role-access";

/**
 * The broadcast alerts a desk other than the coordinator may read (review on PR #330). A directive
 * reaches every desk, or only the desks its target covers. A bed call or Pull now keeps only the
 * desk's own wards, their answers and their acknowledgements, so a ward never learns which other
 * wards were asked.
 */
export function scopeBroadcastAlerts(
  alerts: readonly BroadcastAlert[],
  access: WardAccess,
  units: readonly Unit[],
  places: PlaceLookup,
): BroadcastAlert[] {
  if (access.role === "executive") return [];
  const unitIn = (unitId: string) => unitInScope(access.scope, unitId, places);
  const deskIn = (id: string) => unitIn(id) || edInScope(access.scope, id, places);
  return alerts.flatMap((alert) => {
    if (alert.targetUnitIds === undefined) {
      if (alert.targetScope !== "all" && !directiveDesks(alert, units).some(deskIn)) return [];
      // Only the desk's own acknowledgements, so no desk counts or names another's (review on PR #330).
      const acknowledged = alert.acknowledgedUnits.filter(deskIn);
      return [
        acknowledged.length === alert.acknowledgedUnits.length ? alert : { ...alert, acknowledgedUnits: acknowledged },
      ];
    }
    const own = alert.targetUnitIds.filter(unitIn);
    if (own.length === 0) return [];
    if (own.length === alert.targetUnitIds.length) return [alert];
    const names = own.map((id) => units.find((unit) => unit.id === id)?.name ?? id);
    return [
      {
        ...alert,
        targetUnitIds: own,
        acknowledgedUnits: alert.acknowledgedUnits.filter(unitIn),
        ...(alert.replies ? { replies: alert.replies.filter((reply) => unitIn(reply.unitId)) } : {}),
        targetScopeLabel: names.length === 1 ? names[0] : `${names.length} wards`,
      },
    ];
  });
}

/**
 * Executive figures (Josh's yes, 15 Oct 2026): a count of people under the small number line words
 * as "fewer than N". `useStatisticsCounts` applies it to every Statistics figure, table and chart
 * of people and to their export. Beds and bed states stay exact.
 */
export function smallNumberText(count: number): string {
  const line = CLINICAL_VALUES.smallNumberHidden.value;
  if (count > 0 && count < line) return `fewer than ${line}`;
  return String(count);
}

/** A part withheld only so a hidden part beside it cannot be worked back from their total. */
export const SMALL_NUMBER_NOT_SHOWN = "not shown";

/**
 * The parts of a breakdown whose total is on screen (role access plan, high finding 8). Each part
 * under the line words as "fewer than N". While the hidden parts' sum (the total less the exact
 * parts) can be split only one way, the smallest exact part above zero reads "not shown" too: one
 * hidden part is its own sum, and 1 and 1 of a gap of 2, or 1 and 5 of 6, are pinned at the ends of
 * their ranges (reviews on PR #354). When no exact part is left to withhold, none of the hidden parts
 * is said to be under the line. A total under the line is worded itself, so nothing more hides then.
 * A worded part is a string and an exact one a number.
 */
export function smallNumberParts(counts: readonly number[]): (number | string)[] {
  const line = CLINICAL_VALUES.smallNumberHidden.value;
  const parts: (number | string)[] = counts.map((count) => {
    const text = smallNumberText(count);
    return text === String(count) ? count : text;
  });
  if (!parts.some((part) => typeof part === "string")) return parts;
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (smallNumberText(total) !== String(total)) return parts;
  // What a reader knows: a worded part is 1 to N - 1, and a withheld one is at least N and at most
  // the smallest part still shown. A sum at either end of its range, or one hidden part, is pinned.
  const exactLeft = () => counts.filter((count, index) => typeof parts[index] === "number" && count > 0);
  const pinned = () => {
    const cap = Math.min(...exactLeft());
    let hidden = 0;
    let gap = 0;
    let low = 0;
    let high = 0;
    counts.forEach((count, index) => {
      if (typeof parts[index] === "number") return;
      hidden += 1;
      gap += count;
      low += parts[index] === SMALL_NUMBER_NOT_SHOWN ? line : 1;
      high += parts[index] === SMALL_NUMBER_NOT_SHOWN ? cap : line - 1;
    });
    return hidden === 1 || gap === low || gap === high;
  };
  while (pinned()) {
    const left = exactLeft();
    if (left.length === 0) return parts.map((part) => (typeof part === "string" ? SMALL_NUMBER_NOT_SHOWN : part));
    const smallest = Math.min(...left);
    parts[counts.findIndex((count, index) => typeof parts[index] === "number" && count === smallest)] =
      SMALL_NUMBER_NOT_SHOWN;
  }
  return parts;
}

type ScopedAuditEvent = {
  id: string;
  subject: AuditSubject;
  actor?: { actingUnitId: string | null };
  details?: unknown;
};

/**
 * Commands about the person alone, with no stay, journey or ward: the reducer refuses a community
 * treatment order while the person holds a bed or has an open placement, so it can name nothing else.
 */
const PERSON_REFUSALS: ReadonlySet<string> = new Set([
  "RECORD_COMMUNITY_TREATMENT_ORDER",
  "END_COMMUNITY_TREATMENT_ORDER",
]);

/**
 * Which coordinator records a service coordinator keeps (Josh's yes, 15 Oct 2026): those about its
 * own service's wards, journeys, referrals, stays and bed releases. A record naming anything outside
 * the scope, or naming nothing at all (a configuration change), stays the statewide desk's.
 */
export function coordinatorRecordScope(
  scoped: {
    movements: readonly { id: string }[];
    referrals: readonly { id: string }[];
    admissions: readonly { id: string }[];
    patients?: readonly { id: string }[];
  },
  bedReleases: readonly { id: string; unitId: string }[],
  unitIn: (unitId: string) => boolean,
  edIn: (edId: string) => boolean = () => false,
  leaveBeds: readonly { id: string; unitId: string }[] = [],
): {
  movementIds: ReadonlySet<string>;
  subject(subject: AuditSubject): boolean;
  /**
   * The events in scope. An event acted by, or naming a ward target, outside the scope is left out
   * whole, so no other service's ward or outcome is shown. One about another audit event (a review)
   * follows the event it is about.
   */
  auditEvents<E extends ScopedAuditEvent>(events: readonly E[]): E[];
  /**
   * A refusal's subject id: a journey, referral, stay, release, leave bed, ward or ED in scope, or
   * "none". A person alone is not enough, because one person can be known to two services.
   */
  rejectionSubject(id: string): boolean;
  /**
   * Which refusals are in scope. A refused record command names no subject ("none"), so it follows
   * the audit row the reducer writes with it (`record-rejection-N` with `audit-N`), and another
   * service's refused record command is left out. A refused community treatment order names only the
   * person, and nothing in the record ties a community patient or team to a service, so it is kept
   * when this desk's own scope already shows that person and their order (`PERSON_REFUSALS`).
   */
  refusals(
    auditEvents: readonly ScopedAuditEvent[],
  ): (rejection: { id: string; movementId: string; attempted?: string }) => boolean;
  logEntry(entry: EventLogEntry): boolean;
} {
  const movementIds = new Set(scoped.movements.map((movement) => movement.id));
  const referralIds = new Set(scoped.referrals.map((referral) => referral.id));
  const admissionIds = new Set(scoped.admissions.map((admission) => admission.id));
  const releaseIds = new Set(bedReleases.filter((release) => unitIn(release.unitId)).map((release) => release.id));
  const leaveBedIds = new Set(leaveBeds.filter((bed) => unitIn(bed.unitId)).map((bed) => bed.id));
  const patientIds = new Set((scoped.patients ?? []).map((patient) => patient.id));
  const subject = (record: AuditSubject): boolean => {
    switch (record.kind) {
      case "admission":
        return admissionIds.has(record.admissionId) && unitIn(record.unitId);
      case "movement":
        return movementIds.has(record.movementId);
      case "referral":
        return referralIds.has(record.referralId);
      case "bed-release":
        return releaseIds.has(record.releaseId) && unitIn(record.unitId);
      default:
        return false;
    }
  };
  const logEntry = (entry: EventLogEntry): boolean => {
    const named = [
      entry.movementId === undefined ? undefined : movementIds.has(entry.movementId),
      entry.referralId === undefined ? undefined : referralIds.has(entry.referralId),
      entry.admissionId === undefined ? undefined : admissionIds.has(entry.admissionId),
      entry.releaseId === undefined ? undefined : releaseIds.has(entry.releaseId),
      entry.unitId === undefined ? undefined : unitIn(entry.unitId),
      entry.actingUnitId === undefined ? undefined : unitIn(entry.actingUnitId),
      // A planned admission is the statewide desk's booking list.
      entry.plannedAdmissionId === undefined ? undefined : false,
    ].filter((answer): answer is boolean => answer !== undefined);
    return named.length > 0 && named.every(Boolean);
  };
  const wardsInScope = (event: ScopedAuditEvent): boolean => {
    const acting = event.actor?.actingUnitId;
    if (acting !== undefined && acting !== null && !unitIn(acting)) return false;
    const targets = (event.details as { targets?: readonly { unitId: string | null }[] } | undefined)?.targets;
    return (targets ?? []).every((target) => target.unitId === null || unitIn(target.unitId));
  };
  const auditEvents = <E extends ScopedAuditEvent>(events: readonly E[]): E[] => {
    const kept = new Set(
      events.filter((event) => subject(event.subject) && wardsInScope(event)).map((event) => event.id),
    );
    // A review of a review follows its chain, so repeat until nothing more joins.
    for (let grew = true; grew;) {
      grew = false;
      for (const event of events)
        if (
          event.subject.kind === "audit-event" &&
          !kept.has(event.id) &&
          kept.has(event.subject.eventId) &&
          wardsInScope(event)
        ) {
          kept.add(event.id);
          grew = true;
        }
    }
    return events.filter((event) => kept.has(event.id));
  };
  const rejectionSubject = (id: string): boolean =>
    id === "none" ||
    movementIds.has(id) ||
    referralIds.has(id) ||
    admissionIds.has(id) ||
    releaseIds.has(id) ||
    leaveBedIds.has(id) ||
    unitIn(id) ||
    edIn(id);
  const refusals = (events: readonly ScopedAuditEvent[]) => {
    const kept = new Set(auditEvents(events).map((event) => event.id));
    return (rejection: { id: string; movementId: string; attempted?: string }) => {
      const paired = /^record-rejection-(\d+)$/.exec(rejection.id);
      if (paired) return kept.has(`audit-${paired[1]}`);
      if (rejection.attempted !== undefined && PERSON_REFUSALS.has(rejection.attempted)) {
        return patientIds.has(rejection.movementId);
      }
      return rejectionSubject(rejection.movementId);
    };
  };
  return { movementIds, subject, auditEvents, rejectionSubject, refusals, logEntry };
}
