import { INBOX_CATEGORIES, inboxItemIsActNow } from "@/components/ward-management/ward-flow-reducer";
import type { InboxItem } from "@/components/ward-management/ward-derivations";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { currentInboxOwner, type InboxOwnershipEntry } from "@/components/ward-management/ward-inbox-snooze";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { edById } from "@/components/ward-management/ward-sites";

/**
 * Alerts, Command queue (9 Oct 2026, round 2 option A). What each inbox row is, where it sits in
 * the queue and who it belongs to, read only from the row's id and the model's own links.
 */

export type AlertKind = "legal" | "declines" | "unsuitable" | "hold" | "transport" | "target" | "running";

/** The queue's three groups: act now (red), waiting (amber, counted) and running targets (listed, never counted). */
export type AlertGroup = "act" | "wait" | "running";

const KIND_PREFIXES: [AlertKind, string][] = [
  ["legal", INBOX_CATEGORIES.legal_timing_breached.idPrefix],
  ["declines", INBOX_CATEGORIES.destinations_declined.idPrefix],
  ["unsuitable", INBOX_CATEGORIES.destination_unlawful.idPrefix],
  ["hold", INBOX_CATEGORIES.bed_pull_expired.idPrefix],
  ["transport", INBOX_CATEGORIES.transport_awaiting_departure.idPrefix],
  // The running countdowns share a stem with the overdue rows, so they are matched first.
  ["running", INBOX_CATEGORIES.target_pending_referral_decision.idPrefix],
  ["running", INBOX_CATEGORIES.target_pending_transfer_acceptance.idPrefix],
  ["running", INBOX_CATEGORIES.target_pending_transport_booked.idPrefix],
  ["target", INBOX_CATEGORIES.target_referral_decision.idPrefix],
  ["target", INBOX_CATEGORIES.target_transfer_acceptance.idPrefix],
  ["target", INBOX_CATEGORIES.target_transport_booked.idPrefix],
];

export function alertKindOf(id: string): AlertKind | undefined {
  return KIND_PREFIXES.find(([, prefix]) => id.startsWith(prefix))?.[0];
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
export function movementIdOfInboxId(id: string): string | undefined {
  const prefix = KIND_PREFIXES.find(([, candidate]) => id.startsWith(candidate))?.[1];
  return prefix ? id.slice(prefix.length) : undefined;
}

/** Short name for a condition, used in History and the Today chart. */
export const ALERT_KIND_LABELS: Record<AlertKind, string> = {
  legal: "Form due time passed",
  declines: "Every ward asked declined",
  unsuitable: "Destination unsuitable",
  hold: "Bed hold expired",
  transport: "Transport not yet left",
  target: "Decision target overdue",
  running: "Decision target running",
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
 * so in the resolver's own words (25 September 2026 audit, A1 and A7).
 */
export function resolveAlertSubject(
  movement: Movement | undefined,
  movementId: string | undefined,
  lookup: { patients?: readonly Patient[]; referrals?: readonly Referral[]; movements?: readonly Movement[] },
  units: readonly { id: string; name: string }[],
): AlertSubject {
  const info = resolveSubjectPatient(movement ?? { id: movementId ?? "" }, lookup);
  const unitName = (id: string | undefined) => (id ? (units.find((unit) => unit.id === id)?.name ?? id) : undefined);
  const origin = movement?.originEdId ? (edById(movement.originEdId)?.name ?? movement.originEdId) : undefined;
  const to = unitName(movement?.acceptedUnitId);
  return {
    displayName: info.displayName,
    umrn: info.umrn,
    from: origin ?? to ?? "Location not recorded",
    to: origin ? to : undefined,
    legalStatus: movement?.legalStatus,
    patientHref: info.patient ? `/mockups/ward-flow/people/${encodeURIComponent(info.patient.id)}` : undefined,
  };
}

/** The row's one forward action: where the coordinator goes to resolve it. */
export type AlertAction = { kind: "link"; label: string; href: string } | { kind: "release"; label: string };

export function alertActionFor(item: InboxItem, subject: AlertSubject): AlertAction {
  const patientHref = subject.patientHref ?? "/mockups/ward-flow/movements";
  switch (alertKindOf(item.id)) {
    case "legal":
      return { kind: "link", label: "Open forms", href: "/mockups/ward-flow/legal-forms" };
    case "declines":
      return { kind: "link", label: "Find a bed", href: "/mockups/ward-flow/network" };
    case "unsuitable":
      return { kind: "link", label: "Review", href: patientHref };
    case "hold":
      return { kind: "release", label: "Release bed" };
    case "transport":
      return { kind: "link", label: "Open transport", href: "/mockups/ward-flow/transport" };
    default:
      if (item.id.includes("referral-decision")) {
        return { kind: "link", label: "Open referral", href: "/mockups/ward-flow/referrals" };
      }
      if (item.id.includes("transport-booked")) {
        return { kind: "link", label: "Book transport", href: "/mockups/ward-flow/transport" };
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
