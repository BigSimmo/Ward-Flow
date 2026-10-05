import { minutesUntil, type Instant } from "@/components/ward-management/ward-clock";
import { buildActionInbox, isOpen, type InboxItem } from "@/components/ward-management/ward-derivations";
import { INBOX_CATEGORIES } from "@/components/ward-management/ward-flow-reducer";
import {
  HEALTH_SERVICES,
  type HealthService,
  type Movement,
  type Referral,
  type Unit,
} from "@/components/ward-management/ward-model";
import {
  DUE_SOON_URGENT_MINUTES,
  ED_SEVERE_PRESSURE_WAIT_MINUTES,
  LONG_WAIT_MINUTES,
} from "@/components/ward-management/ward-operational-defaults";
import { edHealthService } from "@/components/ward-management/ward-service-scope";
import {
  DELAY_CAUSE_COPY,
  DELAY_CAUSE_ORDER,
  DELAY_OWNERS,
  delayGroups,
  legalDeadlineMinutes,
  ownerOf,
  SEVERE_CAUSES,
  type DelayCause,
  type DelayOwnerId,
} from "@/components/ward-management/delays/delays-derivations";
import { delayCatchments } from "@/components/ward-management/delays/delays-view-model";
import {
  NETWORK_ON_CALL_ROLES,
  SERVICE_ON_CALL_ROLES,
  servicesWithNoRoleRecorded,
  type OnCallRole,
} from "@/components/ward-management/on-call/on-call-roster";

/*
 * Figures for the 5 October 2026 Delays, Alerts and On-call proposals. Every count here is taken
 * from the engine's own derivations (delayGroups, buildActionInbox, the on-call roster), so the
 * proposal screens cannot disagree with the live screens or with each other.
 */

export type DelayRow = {
  movement: Movement;
  cause: DelayCause;
  causeTitle: string;
  owner: DelayOwnerId;
  waitMinutes: number;
  /** Minutes to the RECORDED form due time; negative once passed. Never computed from law. */
  formDueMinutes?: number;
  escalated: boolean;
};

/** Plain names for the engine's owner ids, as the redesign shows them. */
export const OWNER_LABELS: Record<DelayOwnerId, string> = {
  yours: "Coordinator (you)",
  wards: "Wards",
  ed: "Referring ED",
  transport: "Transport",
  other: "Patient or family",
};

export function delayRows(movements: Movement[], units: Unit[], now: Instant): DelayRow[] {
  return delayGroups(movements, units, now)
    .flatMap((group) =>
      group.movements.map((movement) => ({
        movement,
        cause: group.cause,
        causeTitle: group.title,
        owner: ownerOf(group.cause),
        waitMinutes: Math.max(0, now - movement.openedAt),
        formDueMinutes: legalDeadlineMinutes(movement, now),
        escalated: movement.escalation !== undefined,
      })),
    )
    .sort((a, b) => b.waitMinutes - a.waitMinutes);
}

/** Needs attention now: a passed or near recorded form due time, no bed anywhere, or escalated. */
export function needsAttention(row: DelayRow): boolean {
  return (
    SEVERE_CAUSES.includes(row.cause) ||
    row.escalated ||
    (row.formDueMinutes !== undefined && row.formDueMinutes <= DUE_SOON_URGENT_MINUTES)
  );
}

export function delayFigures(movements: Movement[], units: Unit[], now: Instant) {
  const rows = delayRows(movements, units, now);
  const owners = DELAY_OWNERS.map((owner) => {
    const mine = rows.filter((row) => row.owner === owner.id);
    return {
      id: owner.id,
      label: OWNER_LABELS[owner.id],
      subLine: owner.subLine,
      count: mine.length,
      causes: DELAY_CAUSE_ORDER.map((cause) => ({
        cause,
        title: DELAY_CAUSE_COPY.find((entry) => entry.cause === cause)?.title ?? cause,
        count: mine.filter((row) => row.cause === cause).length,
      })).filter((entry) => entry.count > 0),
    };
  });
  const attention = rows
    .filter(needsAttention)
    .sort(
      (a, b) =>
        DELAY_CAUSE_ORDER.indexOf(a.cause) - DELAY_CAUSE_ORDER.indexOf(b.cause) || b.waitMinutes - a.waitMinutes,
    );
  const catchments = delayCatchments(rows, now).map((entry) => ({
    origin: entry.origin,
    total: entry.total,
    over8: entry.over8,
    over24: entry.over24,
  }));
  return {
    rows,
    waiting: rows.length,
    over8: rows.filter((row) => row.waitMinutes >= ED_SEVERE_PRESSURE_WAIT_MINUTES).length,
    over24: rows.filter((row) => row.waitMinutes >= LONG_WAIT_MINUTES).length,
    escalated: rows.filter((row) => row.escalated).length,
    formDueSoon: rows.filter(
      (row) =>
        row.formDueMinutes !== undefined && row.formDueMinutes >= 0 && row.formDueMinutes <= DUE_SOON_URGENT_MINUTES,
    ).length,
    formDuePassed: rows.filter((row) => row.formDueMinutes !== undefined && row.formDueMinutes < 0).length,
    owners,
    attention,
    catchments,
    longest: rows[0],
  };
}

export type AlertCondition = {
  id: keyof typeof INBOX_CATEGORIES | "untriaged";
  title: string;
  watches: string;
  /** Who the engine addresses it to. "you" is the coordinator. */
  audience: "you" | "other";
  items: InboxItem[];
  /** Only the triage condition counts referrals rather than inbox rows. */
  referralCount?: number;
};

const CONDITION_COPY: Record<keyof typeof INBOX_CATEGORIES, Omit<AlertCondition, "id" | "items">> = {
  legal_timing_breached: {
    title: "Recorded form due time passed",
    watches: "Movements whose recorded form due time has passed.",
    audience: "you",
  },
  destination_unlawful: {
    title: "Accepted destination no longer suitable",
    watches: "Accepted destinations that fail the authorised-hospital check for the current recorded status.",
    audience: "you",
  },
  destinations_declined: {
    title: "Every ward asked has declined",
    watches: "Movements refused by every ward approached, with none accepting.",
    audience: "you",
  },
  bed_pull_expired: {
    title: "Bed hold time passed",
    watches: "Held beds whose recorded hold time has passed.",
    audience: "other",
  },
  transport_awaiting_departure: {
    title: "Transport accepted, not yet left",
    watches: "Accepted transport legs that have not departed.",
    audience: "other",
  },
};

export function alertConditions(
  movements: Movement[],
  units: Unit[],
  referrals: readonly Referral[],
  now: Instant,
): AlertCondition[] {
  const inbox = buildActionInbox(movements.filter(isOpen), now, units);
  const ids = Object.keys(INBOX_CATEGORIES) as (keyof typeof INBOX_CATEGORIES)[];
  const order: (keyof typeof INBOX_CATEGORIES)[] = [
    "legal_timing_breached",
    "destination_unlawful",
    "destinations_declined",
    "bed_pull_expired",
    "transport_awaiting_departure",
  ];
  const conditions: AlertCondition[] = order
    .filter((id) => ids.includes(id))
    .map((id) => ({
      id,
      ...CONDITION_COPY[id],
      items: inbox.filter((item) => item.id.startsWith(INBOX_CATEGORIES[id].idPrefix)),
    }));
  conditions.push({
    id: "untriaged",
    title: "Referral never triaged",
    watches: "Referrals with no triage recorded. Read from the referrals, not the action inbox.",
    audience: "other",
    items: [],
    referralCount: referrals.filter((referral) => referral.triagedAt === undefined).length,
  });
  return conditions;
}

export function alertFigures(movements: Movement[], units: Unit[], referrals: readonly Referral[], now: Instant) {
  const conditions = alertConditions(movements, units, referrals, now);
  const forYou = conditions.filter((condition) => condition.audience === "you").flatMap((c) => c.items);
  const forOthers = conditions.filter((condition) => condition.audience === "other").flatMap((c) => c.items);
  return {
    conditions,
    forYou,
    forOthers,
    total: forYou.length + forOthers.length,
    conditionsChecked: conditions.length,
    conditionsFiring: conditions.filter((c) => c.items.length > 0 || (c.referralCount ?? 0) > 0).length,
  };
}

/** Recorded minutes-of-day windows read from the roster's own words, e.g. "20:00 to 08:00". */
export function shiftWindow(shift: string): { start: number; end: number } | undefined {
  const match = shift.match(/(\d{2}):(\d{2}) to (\d{2}):(\d{2})/);
  if (!match) return undefined;
  const [, sh, sm, eh, em] = match.map(Number);
  return { start: sh * 60 + sm, end: eh * 60 + em };
}

export type RoleStatus = "on" | "later";

export function roleStatus(shift: string, minuteOfDay: number): RoleStatus | undefined {
  const window = shiftWindow(shift);
  if (!window) return undefined;
  const { start, end } = window;
  const inside = start < end ? minuteOfDay >= start && minuteOfDay < end : minuteOfDay >= start || minuteOfDay < end;
  return inside ? "on" : "later";
}

export type RosterRow = OnCallRole & {
  service: HealthService | "Statewide Network";
  status?: RoleStatus;
  startsAt?: string;
};

export function onCallFigures(minuteOfDay: number) {
  const hhmm = (minutes: number) =>
    `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  const rows: RosterRow[] = [
    ...NETWORK_ON_CALL_ROLES.map((role) => ({ ...role, service: "Statewide Network" as const })),
    ...HEALTH_SERVICES.flatMap((service) => SERVICE_ON_CALL_ROLES[service].map((role) => ({ ...role, service }))),
  ].map((row) => {
    const window = shiftWindow(row.shift);
    return { ...row, status: roleStatus(row.shift, minuteOfDay), startsAt: window ? hhmm(window.start) : undefined };
  });
  return {
    rows,
    roles: rows.length,
    onNow: rows.filter((row) => row.status === "on").length,
    consultants: rows.filter((row) => /consultant/i.test(row.role)).length,
    servicesWithNone: servicesWithNoRoleRecorded(),
  };
}

/** Origin service of a movement, for the catchment bars. */
export function originServiceOf(movement: Movement): HealthService | "unrecorded" {
  return edHealthService(movement.originEdId) ?? "unrecorded";
}

export { minutesUntil };
