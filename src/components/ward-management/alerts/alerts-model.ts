import { INBOX_CATEGORIES, inboxItemIsActNow } from "@/components/ward-management/ward-flow-reducer";
import { eligibleCandidatesAmong, isOpen, type InboxItem } from "@/components/ward-management/ward-derivations";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import type { Admission, PlannedAdmission } from "@/components/ward-management/ward-admissions";
import { currentInboxOwner, type InboxOwnershipEntry } from "@/components/ward-management/ward-inbox-snooze";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { edById } from "@/components/ward-management/ward-sites";
import { patientHref as personHref } from "@/components/ward-management/shell/ward-facade";

/**
 * Alerts, Command queue (9 Oct 2026, round 2 option A). What each inbox row is, where it sits in
 * the queue and who it belongs to, read only from the row's id and the model's own links.
 */

export type AlertKind =
  | "awol"
  | "legal"
  | "declines"
  | "unsuitable"
  | "nobed"
  | "hold"
  | "transport"
  | "planned"
  | "notify"
  | "target"
  | "running"
  | "duplicate";

/** The queue's three groups: act now (red), waiting (amber, counted) and running targets (listed, never counted). */
export type AlertGroup = "act" | "wait" | "running";

const KIND_PREFIXES: [AlertKind, string][] = [
  // Audit A3-1 (13 Oct 2026): a person on an order absent without leave. Its remainder is a stay.
  ["awol", INBOX_CATEGORIES.absent_without_leave.idPrefix],
  ["legal", INBOX_CATEGORIES.legal_timing_breached.idPrefix],
  ["declines", INBOX_CATEGORIES.destinations_declined.idPrefix],
  ["unsuitable", INBOX_CATEGORIES.destination_unlawful.idPrefix],
  // Clinical owner ruling (14 Oct 2026): no eligible bed anywhere; the bed coordinator is notified.
  ["nobed", INBOX_CATEGORIES.no_eligible_bed.idPrefix],
  ["hold", INBOX_CATEGORIES.bed_pull_expired.idPrefix],
  ["transport", INBOX_CATEGORIES.transport_awaiting_departure.idPrefix],
  ["planned", INBOX_CATEGORIES.planned_arrival_overdue.idPrefix],
  // L1 (site review, 12 Oct 2026): the arrival and discharge notification rows the Tasks badge
  // counts, so Alerts "Now" and the badge agree.
  ["notify", INBOX_CATEGORIES.support_notification_arrival.idPrefix],
  ["notify", INBOX_CATEGORIES.support_notification_discharge.idPrefix],
  // The running countdowns share a stem with the overdue rows, so they are matched first.
  ["running", INBOX_CATEGORIES.target_pending_referral_decision.idPrefix],
  ["running", INBOX_CATEGORIES.target_pending_transfer_acceptance.idPrefix],
  ["running", INBOX_CATEGORIES.target_pending_transport_booked.idPrefix],
  ["target", INBOX_CATEGORIES.target_referral_decision.idPrefix],
  ["target", INBOX_CATEGORIES.target_transfer_acceptance.idPrefix],
  ["target", INBOX_CATEGORIES.target_transport_booked.idPrefix],
  // Audit F-19: one person with more than one active bed request. Its remainder is a patient id.
  ["duplicate", INBOX_CATEGORIES.duplicate_bed_request.idPrefix],
];

export function alertKindOf(id: string): AlertKind | undefined {
  return KIND_PREFIXES.find(([, prefix]) => id.startsWith(prefix))?.[0];
}

/**
 * Escalate stamps `Movement.escalation`, which means "the bed search is exhausted and the state desk
 * was rung". The alert kind alone cannot say that: three declines can still be widened, and an
 * "accepted destination no longer suitable" alert has a destination already accepted. So it is read
 * from the movement and the live network, the same test the shortlist panel uses before it offers
 * its own escalation form: an open movement, no accepted ward, and no ward currently eligible. Only
 * the alerts about finding a placement are candidates at all; a legal-form deadline, a held bed or
 * a transport delay are about something else, so Escalate stays unavailable for them.
 */
const PLACEMENT_ALERT_KINDS: readonly AlertKind[] = ["declines", "nobed"];

export function escalationAppliesTo(
  item: InboxItem,
  movement: Movement | undefined,
  units: readonly Unit[],
  now: Instant,
): boolean {
  const kind = alertKindOf(item.id);
  if (kind === undefined || !PLACEMENT_ALERT_KINDS.includes(kind)) return false;
  if (!movement || !isOpen(movement) || movement.acceptedUnitId !== undefined) return false;
  return !eligibleCandidatesAmong(movement, [...units], now, units.length).some(
    (candidate) => candidate.verdict.eligible,
  );
}

/** Only the categories this screen has always shown; anything else in the inbox stays elsewhere. */
export function isQueueItem(item: InboxItem): boolean {
  return alertKindOf(item.id) !== undefined;
}

export function alertGroupOf(item: InboxItem): AlertGroup {
  const kind = alertKindOf(item.id);
  if (kind === "running") return "running";
  return inboxItemIsActNow(item.id) ? "act" : "wait";
}

/** The movement an inbox id names, for the categories whose remainder is a movement id. */
/** The stay a discharge notification or absence row names, read from its id. */
export function admissionIdOfInboxId(id: string): string | undefined {
  for (const prefix of [
    INBOX_CATEGORIES.support_notification_discharge.idPrefix,
    INBOX_CATEGORIES.absent_without_leave.idPrefix,
  ])
    if (id.startsWith(prefix)) return id.slice(prefix.length) || undefined;
  return undefined;
}

/** The person a duplicate bed request row names, read from its id (audit F-19). */
export function patientIdOfInboxId(id: string): string | undefined {
  const prefix = INBOX_CATEGORIES.duplicate_bed_request.idPrefix;
  return id.startsWith(prefix) ? id.slice(prefix.length) || undefined : undefined;
}

export function movementIdOfInboxId(id: string): string | undefined {
  const match = KIND_PREFIXES.find(([, candidate]) => id.startsWith(candidate));
  // A planned arrival row names a booking, never a movement; a discharge notification row names a stay.
  if (!match || match[0] === "planned") return undefined;
  if (match[1] === INBOX_CATEGORIES.support_notification_discharge.idPrefix) return undefined;
  if (match[0] === "awol" || match[0] === "duplicate") return undefined;
  return id.slice(match[1].length);
}

/** The booking a planned arrival row names, and the initials it is shown by when no patient is linked. */
export function bookingOfInboxId(
  id: string,
  bookings: readonly PlannedAdmission[] | undefined,
): { planned: PlannedAdmission; personLabel?: string } | undefined {
  const prefix = INBOX_CATEGORIES.planned_arrival_overdue.idPrefix;
  if (!id.startsWith(prefix)) return undefined;
  const planned = bookings?.find((booking) => booking.id === id.slice(prefix.length));
  if (!planned) return undefined;
  return { planned, personLabel: planned.initials !== null ? `Initials ${planned.initials}` : undefined };
}

/** Short name for a condition, used in History and the Today chart. */
export const ALERT_KIND_LABELS: Record<AlertKind, string> = {
  awol: "Absent without leave on an order",
  legal: "Form due time passed",
  declines: "Every ward asked declined",
  unsuitable: "Destination unsuitable",
  nobed: "No eligible bed",
  hold: "Bed hold expired",
  transport: "Transport not yet left",
  planned: "Planned arrival not recorded",
  notify: "Notifications to record",
  target: "Decision target overdue",
  running: "Decision target running",
  duplicate: "More than one active bed request",
};

/** Remove the legacy movement reference from presentation, preserving the recorded detail. */
export function alertDetail(item: InboxItem): string {
  const prefix = `${item.movementId} · `;
  return item.movementId && item.detail.startsWith(prefix) ? item.detail.slice(prefix.length) : item.detail;
}

/**
 * When the row's condition began, from recorded times only: the row's own `since`, else the last
 * decline that completed the set, else its due time. Undefined when the record holds none.
 */
export function raisedAt(item: InboxItem, movement: Movement | undefined): Instant | undefined {
  if (item.since !== undefined) return item.since;
  const declines = movement?.declines ?? [];
  if (alertKindOf(item.id) === "declines" && declines.length > 0) {
    return Math.max(...declines.map((decline) => decline.at));
  }
  return item.dueAt;
}

/** Who holds the row now: the latest owner who took it, else the role the engine addressed it to. */
export function effectiveOwner(item: InboxItem, ownership: readonly InboxOwnershipEntry[] | undefined): string {
  return currentInboxOwner(ownership, item.since)?.by ?? item.owner;
}

export type AlertSubject = {
  displayName: string;
  umrn: string;
  /** Where the patient is now: the origin ED, else the accepted ward, else "Location not recorded". */
  from: string;
  /** The accepted destination, when there is one. */
  to?: string;
  legalStatus?: string;
  /** The patient page, when the movement is linked to a patient record. */
  patientHref?: string;
};

/**
 * Who an alert is about, read only from the model's own links. A movement linked to nobody says
 * so in the resolver's own words (25 September 2026 audit, A1 and A7). A planned arrival is about
 * its booking and its own ward, never a movement's ED or accepted unit.
 */
export function resolveAlertSubject(
  movement: Movement | undefined,
  movementId: string | undefined,
  lookup: { patients?: readonly Patient[]; referrals?: readonly Referral[]; movements?: readonly Movement[] },
  units: readonly { id: string; name: string }[],
  booking?: { planned: PlannedAdmission; personLabel?: string },
  /** The discharged stay a discharge notification row names. Pass it only for a discharge row: it
   *  wins over a linked movement, so the row names the ward the person left, not the movement's ED. */
  admission?: Admission,
  /** Audit F-19: the person a row with no movement is about (`InboxItem.patientId`). */
  patientId?: string,
): AlertSubject {
  const unitName = (id: string | undefined) => (id ? (units.find((unit) => unit.id === id)?.name ?? id) : undefined);
  if (admission) {
    const info = resolveSubjectPatient(admission, lookup);
    return {
      displayName: info.formalName,
      umrn: info.umrn,
      from: unitName(admission.unitId) ?? "Ward not recorded",
      patientHref: info.patient ? personHref(info.patient.id) : undefined,
    };
  }
  if (booking) {
    const info = resolveSubjectPatient(booking.planned, lookup);
    return {
      displayName: booking.personLabel ?? info.formalName,
      umrn: info.umrn,
      from: unitName(booking.planned.unitId) ?? "Ward not recorded",
      legalStatus: booking.planned.legalStatus,
      patientHref: info.patient ? personHref(info.patient.id) : undefined,
    };
  }
  const info = resolveSubjectPatient(movement ?? { id: movementId ?? "", patientId }, lookup);
  const origin = movement?.originEdId ? (edById(movement.originEdId)?.name ?? movement.originEdId) : undefined;
  const to = unitName(movement?.acceptedUnitId);
  return {
    displayName: info.formalName,
    umrn: info.umrn,
    from: origin ?? to ?? "Location not recorded",
    to: origin ? to : undefined,
    legalStatus: movement?.legalStatus,
    patientHref: info.patient ? personHref(info.patient.id) : undefined,
  };
}

/** The row's one forward action: where the coordinator goes to resolve it. */
export type AlertAction = { kind: "link"; label: string; href: string } | { kind: "release"; label: string };

export function alertActionFor(item: InboxItem, subject: AlertSubject): AlertAction {
  const patientHref = subject.patientHref ?? "/ward-flow/movements";
  switch (alertKindOf(item.id)) {
    case "awol":
      return { kind: "link", label: "Open patient", href: item.href ?? patientHref };
    case "legal":
      return { kind: "link", label: "Open forms", href: "/ward-flow/legal-forms" };
    case "declines":
      return { kind: "link", label: "Find a bed", href: "/ward-flow/network" };
    case "unsuitable":
      return { kind: "link", label: "Review", href: patientHref };
    case "hold":
      return { kind: "release", label: "Release bed" };
    case "transport":
      return { kind: "link", label: "Chase transport", href: "/ward-flow/movements" };
    case "planned":
      return { kind: "link", label: "Open bookings", href: item.href ?? "/ward-flow/capacity" };
    case "duplicate":
      return { kind: "link", label: "Open referrals", href: "/ward-flow/referrals" };
    case "notify":
      // A discharge row opens its stay on the discharges board, as the Tasks drawer does.
      return item.admissionId !== undefined
        ? { kind: "link", label: "Record notifications", href: "/ward-flow/discharges" }
        : { kind: "link", label: "Record notifications", href: patientHref };
    default:
      if (item.id.includes("referral-decision")) {
        return { kind: "link", label: "Open referral", href: "/ward-flow/referrals" };
      }
      if (item.id.includes("transport-booked")) {
        return { kind: "link", label: "Book transport", href: "/ward-flow/movements" };
      }
      return { kind: "link", label: "Open patient", href: patientHref };
  }
}

/** A duration in whole minutes: `5m`, `52m`, `6h 50m`, `1d 3h`. The engine clock has no seconds. */
export function minutesText(minutes: number): string {
  const value = Math.max(0, Math.round(minutes));
  if (value < 60) return `${value}m`;
  if (value < 1440) return `${Math.floor(value / 60)}h ${String(value % 60).padStart(2, "0")}m`;
  return `${Math.floor(value / 1440)}d ${Math.floor((value % 1440) / 60)}h`;
}

/** The whole overdue duration the engine wrote into a row's detail, such as `1d 3h overdue`. */
export function extractOverdue(detail: string): string | null {
  const match = detail.match(/(\d+\s*d(?:\s*\d+\s*h)?\s*overdue|\d+\s*[hm]\s*(?:\d+\s*m)?\s*overdue)/i);
  return match ? match[1] : null;
}

/** Queue order inside a group: oldest first, rows without a recorded start last. */
export function byOldest(a: { at?: Instant }, b: { at?: Instant }): number {
  return (a.at ?? Number.POSITIVE_INFINITY) - (b.at ?? Number.POSITIVE_INFINITY);
}
