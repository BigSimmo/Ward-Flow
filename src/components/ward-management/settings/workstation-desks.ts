/**
 * SWITCH WORKSTATION, THE DESKS (Josh picked direction D, 9 Oct 2026).
 *
 * Every desk the drawer offers, built from figures other screens already derive: wards and
 * community teams from the Ward Hub list (`hubEntries`), emergency departments from the ED home
 * summaries (`edHomeSummaries`). Nothing here is a literal list of places, so a ward or ED added to
 * the network appears here without anyone editing this file.
 *
 * The role is still the route (`ward-chrome-role.ts`): opening a desk navigates to that role's own
 * home, and what each desk "can" do is read from the reducer's `EVENT_ROLE` table, never restated.
 */
import type { Instant } from "@/components/ward-management/ward-clock";
import type { EdSummary } from "@/components/ward-management/ed/ed-home-derivations";
import type { HubEntry } from "@/components/ward-management/hub/hub-derivations";
import { EVENT_ROLE, type WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { WARD_FLOW_ROLE_LABELS, type WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import { HEALTH_SERVICES, type HealthService, type Movement } from "@/components/ward-management/ward-model";
import { wardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { edHref } from "@/components/ward-management/shell/ward-facade";

export const COORDINATOR_DESK_ID = "coordinator";
export const OFFICER_DESK_ID = "officer";
const COORDINATOR_HREF = "/mockups/ward-flow";
const OFFICER_HREF = "/mockups/ward-flow/transport/officer";

export type DeskRole = "coordinator" | "ward" | "ed" | "community" | "officer";

export type Desk = {
  id: string;
  role: DeskRole;
  name: string;
  href: string;
  /** Hospital name, wards and EDs only. */
  site?: string;
  service?: HealthService;
  /** Ward figures, from the Ward Hub's bed boxes. */
  ready?: number;
  occupied?: number;
  closed?: number;
  beds?: number;
  confirmedAt?: Instant;
  stale?: boolean;
  /** ED and coordinator figures, from the ED home summaries. */
  waiting?: number;
  longestWaitMinutes?: number;
  pastTarget?: number;
  /** Officer figure: jobs still on the road. */
  activeJobs?: number;
};

export type DeskSite = {
  site: string;
  service?: HealthService;
  desks: Desk[];
};

/**
 * Jobs still on an officer's list: booked, not arrived, movement not closed. Same predicate as
 * `isOfficerJob` in `officer/officer-screen.tsx`, restated here so Settings does not import the
 * officer screen; `tests/ward-workstation-desks.test.ts` pins the two together.
 */
export function isActiveTransportJob(movement: Movement): boolean {
  return (
    movement.transport !== undefined && movement.transport.arrivedAt === undefined && movement.closure === undefined
  );
}

export function workstationDesks(input: {
  hub: readonly HubEntry[];
  eds: readonly EdSummary[];
  movements: readonly Movement[];
}): { statewide: Desk[]; sites: DeskSite[]; teams: Desk[] } {
  const { hub, eds, movements } = input;
  const waiting = eds.reduce((sum, ed) => sum + ed.waiting, 0);
  const pastTarget = eds.reduce((sum, ed) => sum + ed.pastAccessTarget, 0);
  const statewide: Desk[] = [
    {
      id: COORDINATOR_DESK_ID,
      role: "coordinator",
      name: "Statewide bed flow",
      href: COORDINATOR_HREF,
      waiting,
      pastTarget,
    },
    {
      id: OFFICER_DESK_ID,
      role: "officer",
      name: "Transport jobs",
      href: OFFICER_HREF,
      activeJobs: movements.filter(isActiveTransportJob).length,
    },
  ];

  const edDesks: Desk[] = eds.map((summary) => ({
    id: summary.ed.id,
    role: "ed",
    name: summary.ed.name,
    href: edHref(summary.ed.id),
    site: summary.siteName,
    service: summary.service,
    waiting: summary.waiting,
    longestWaitMinutes: summary.longestWaitMinutes,
    pastTarget: summary.pastAccessTarget,
  }));
  const wardDesks: Desk[] = hub
    .filter((entry) => entry.kind === "ward")
    .map((entry) => ({
      id: entry.id,
      role: "ward",
      name: entry.name,
      href: entry.href,
      site: entry.site,
      service: entry.service as HealthService | undefined,
      ready: entry.ready,
      occupied: entry.occupied,
      closed: entry.closed,
      beds: entry.beds,
      confirmedAt: entry.confirmedAt,
      stale: entry.stale,
    }));
  const teams: Desk[] = hub
    .filter((entry) => entry.kind === "community")
    .map((entry) => ({ id: entry.id, role: "community", name: entry.name, href: entry.href }));

  // Hospitals in health service order, then by name; on each, the ED first and then its wards.
  const bySite = new Map<string, DeskSite>();
  for (const desk of [...edDesks, ...wardDesks]) {
    const key = desk.site ?? desk.name;
    const group = bySite.get(key) ?? { site: key, service: desk.service, desks: [] };
    group.desks.push(desk);
    bySite.set(key, group);
  }
  const serviceRank = (service?: HealthService) =>
    service ? HEALTH_SERVICES.indexOf(service) : HEALTH_SERVICES.length;
  const sites = [...bySite.values()].sort(
    (a, b) => serviceRank(a.service) - serviceRank(b.service) || a.site.localeCompare(b.site),
  );
  return { statewide, sites, teams };
}

/** Desks opened from the drawer, newest first. In memory for this tab only; nothing is stored. */
const recent: string[] = [];

export function rememberDesk(id: string): void {
  const at = recent.indexOf(id);
  if (at >= 0) recent.splice(at, 1);
  recent.unshift(id);
  recent.length = Math.min(recent.length, 4);
}

export function recentDeskIds(): readonly string[] {
  return recent;
}

/** Case-insensitive match over the desk's name, hospital, service and role. Empty matches all. */
export function deskMatches(desk: Desk, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [desk.name, desk.site ?? "", desk.service ?? "", deskRoleLabel(desk.role)].join(" ").toLowerCase().includes(q);
}

export function deskRoleLabel(role: DeskRole | WardFlowRole): string {
  return WARD_FLOW_ROLE_LABELS[role];
}

/**
 * Which desk the current route is. Ward, ED, team and officer routes name their own desk; every
 * other route is the coordinator's (`wardChromeRole`), except the community index, which is a list
 * of teams rather than one team's desk.
 */
export function currentDeskId(pathname: string): string | null {
  const segment = (pattern: RegExp) => {
    const match = pattern.exec(pathname);
    return match ? decodeURIComponent(match[1]) : null;
  };
  const role = wardChromeRole(pathname);
  if (role === "ed") return segment(/\/ed\/([^/?#]+)/);
  if (role === "ward") return segment(/\/(?:ward|board)\/([^/?#]+)/);
  if (role === "community") return segment(/\/community\/([^/?#]+)/);
  if (role === "officer") return OFFICER_DESK_ID;
  return COORDINATOR_DESK_ID;
}

/**
 * The plain-language actions a desk is told about. Whether a role may do each one is read from
 * `EVENT_ROLE` at render time; this list only names them, in the order a person would look for them.
 */
const DESK_ACTIONS: readonly { event: WardFlowEvent["type"]; label: string }[] = [
  { event: "REFER_TO_UNITS", label: "Refer to wards" },
  { event: "ACCEPT_IN_PRINCIPLE", label: "Accept for the ward" },
  { event: "CONFIRM_CAPACITY", label: "Confirm bed capacity" },
  { event: "RECORD_PATIENT_DISCHARGE", label: "Record a discharge" },
  { event: "RECORD_ESCALATION", label: "Record an escalation" },
  { event: "CHANGE_URGENCY", label: "Change urgency" },
  { event: "PULL_PATIENT", label: "Pull a patient into a ready bed" },
  { event: "RAISE_REFERRAL", label: "Raise a referral" },
  { event: "RECORD_EXAMINATION", label: "Record an examination" },
  { event: "RECORD_LEGAL_FORM_RECEIVED", label: "Record a legal form received" },
  { event: "HANDOVER_READY", label: "Mark handover ready" },
  { event: "BOOK_TRANSPORT", label: "Book transport" },
  { event: "TRANSPORT_ACCEPTED", label: "Accept a transport job" },
  { event: "PATIENT_COLLECTED", label: "Mark a patient collected" },
  { event: "PATIENT_ARRIVED", label: "Mark a patient arrived" },
];

export type DeskActions = {
  can: string[];
  /** Actions this desk cannot take, each with the role or roles that can. */
  cannot: { label: string; by: string }[];
};

export function deskActions(role: DeskRole): DeskActions {
  const can: string[] = [];
  const cannot: { label: string; by: string }[] = [];
  for (const action of DESK_ACTIONS) {
    const allowed = EVENT_ROLE[action.event];
    if (allowed.includes(role)) {
      can.push(action.label);
    } else {
      const by = allowed.filter((r) => r !== "demo").map((r) => WARD_FLOW_ROLE_LABELS[r]);
      if (by.length) cannot.push({ label: action.label, by: by.join(" or ") });
    }
  }
  return { can, cannot };
}
