/**
 * **WHO MAY OPEN WHICH SCREEN — the one role access table (role access plan, Josh, 15 Oct 2026).**
 *
 * Default deny. A role opens a screen only when this table lists it. The sidebar, the phone dock,
 * the route guard and the scoped workspace all read this module, so nothing else restates a role
 * list. The plan is `reviews/role-access-plan-2026-10-15.md` (sections 4 to 7), and
 * `tests/ward-role-access.test.ts` pins this table to it.
 *
 * Actions stay with the reducer's `EVENT_ROLE` (`ward-flow-events.ts`). This module adds the PLACE:
 * a role acts and sees only inside its own scope.
 *
 * Pure and browser free on purpose: the backend compiles the same rules (plan PR 2), so a screen
 * and the server can never disagree about who sees what.
 *
 * ⚠️ In the local demo the whole synthetic state is in the browser, so this is a demonstration of
 * the restriction, not security. The server enforcing the same table is what makes it real.
 */
import type { WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import type { HealthService } from "@/components/ward-management/ward-model";
import { recordIdFromAddress } from "@/components/ward-management/shell/ward-record-address";

/** Every role the access table knows. `admin` grants access and sees no patients. */
export type WardAccessRole = WardChromeRole | "admin";

export const WARD_ACCESS_ROLES: readonly WardAccessRole[] = [
  "coordinator",
  "bed_manager",
  "ward",
  "ed",
  "community",
  "officer",
  "executive",
  "admin",
];

/** Where a role is standing. A role sees only inside this. */
export type WardAccessScope =
  | { readonly kind: "statewide" }
  | { readonly kind: "service"; readonly service: HealthService }
  | { readonly kind: "site"; readonly siteCode: string }
  | { readonly kind: "ward"; readonly unitIds: readonly string[] }
  | { readonly kind: "ed"; readonly edId: string }
  | { readonly kind: "team"; readonly teamName: string }
  /**
   * A transport officer's jobs. A granted officer holds its own health service's jobs only (D-80
   * item 7); the server refuses a membership without one. The local demo's officer desk has no
   * service and sees every open job.
   */
  | { readonly kind: "jobs"; readonly service?: HealthService };

export type WardAccess = { readonly role: WardAccessRole; readonly scope: WardAccessScope };

/** The whole view. What everyone has while the `role-access` flag is off. */
export const STATEWIDE_COORDINATOR: WardAccess = { role: "coordinator", scope: { kind: "statewide" } };

/** Which scope kinds each role may hold. A membership outside this is refused. */
export const ROLE_SCOPE_KINDS: Record<WardAccessRole, readonly WardAccessScope["kind"][]> = {
  coordinator: ["statewide", "service"],
  bed_manager: ["site"],
  ward: ["ward"],
  ed: ["ed"],
  community: ["team"],
  officer: ["jobs"],
  executive: ["statewide", "service"],
  admin: ["statewide", "service"],
};

export function accessIsValid(access: WardAccess): boolean {
  if (!ROLE_SCOPE_KINDS[access.role].includes(access.scope.kind)) return false;
  return access.scope.kind !== "ward" || access.scope.unitIds.length > 0;
}

/** The whole network, no narrowing at all. Only a statewide coordinator. */
export function accessIsWholeNetwork(access: WardAccess): boolean {
  return access.role === "coordinator" && access.scope.kind === "statewide";
}

/**
 * Every screen, by what it is rather than by its address. Old addresses that only redirect
 * (`command`, `constellation`, `queue`, `exceptions`, `escalation`, `transport`) resolve to their
 * target so they can never be a way round the table.
 */
export type WardScreenId =
  | "home"
  | "network"
  | "capacity"
  | "wards"
  | "hub"
  | "ward"
  | "board"
  | "discharges"
  | "bed-meeting"
  | "bed-meeting-agenda"
  | "ed"
  | "community"
  | "officer"
  | "referrals"
  | "referral-new"
  | "patient-new"
  | "patient"
  | "movements"
  | "delays"
  | "legal-forms"
  | "out-of-area"
  | "handover"
  | "search"
  | "chronology"
  | "downtime"
  | "statistics"
  | "governance"
  | "alerts"
  | "on-call"
  | "seclusion"
  | "settings";

export const WARD_SCREEN_IDS: readonly WardScreenId[] = [
  "home",
  "network",
  "capacity",
  "wards",
  "hub",
  "ward",
  "board",
  "discharges",
  "bed-meeting",
  "bed-meeting-agenda",
  "ed",
  "community",
  "officer",
  "referrals",
  "referral-new",
  "patient-new",
  "patient",
  "movements",
  "delays",
  "legal-forms",
  "out-of-area",
  "handover",
  "search",
  "chronology",
  "downtime",
  "statistics",
  "governance",
  "alerts",
  "on-call",
  "seclusion",
  "settings",
];

/**
 * How much of a screen a role gets. `all` is the whole screen in the role's scope, `own` only the
 * role's own place, `counts` numbers with no names. Anything not listed is closed.
 */
type ScreenGrant = "all" | "own" | "counts";

type ScreenTable = Partial<Record<WardScreenId, ScreenGrant>>;

const EVERY_SCREEN_ALL: ScreenTable = Object.fromEntries(WARD_SCREEN_IDS.map((id) => [id, "all"])) as ScreenTable;

/** Section 4 of the plan. Read it as: closed unless written here. */
export const ROLE_SCREENS: Record<WardAccessRole, ScreenTable> = {
  coordinator: EVERY_SCREEN_ALL,
  bed_manager: {
    // D-80: its own site in detail, and other sites as bed counts only (place information, no patient).
    capacity: "own",
    wards: "own",
    hub: "own",
    ward: "own",
    board: "own",
    discharges: "own",
    "bed-meeting": "own",
    // D-80: read only, its own wards' incoming lines. The board offers it no action and the server
    // refuses every referral change from it (no bed manager in EVENT_ROLE for one).
    referrals: "own",
    patient: "own",
    movements: "own",
    delays: "own",
    handover: "own",
    search: "own",
    downtime: "own",
    statistics: "counts",
    alerts: "own",
    "on-call": "all",
    // D-72: the operational seclusion and restraint view, for the site's own wards.
    seclusion: "own",
    settings: "own",
  },
  ward: {
    ward: "own",
    board: "own",
    discharges: "own",
    // Ward desks attend the bed meeting, so they may open its TV view; ED desks may not (Josh, 19 Oct 2026).
    "bed-meeting": "own",
    referrals: "own",
    "referral-new": "all",
    "patient-new": "all",
    patient: "own",
    movements: "own",
    delays: "own",
    "legal-forms": "own",
    handover: "own",
    search: "own",
    downtime: "own",
    alerts: "own",
    "on-call": "all",
    // D-72: the ward's own seclusion room, restraint in use and incidents.
    seclusion: "own",
    // D-80: its own ward's statistics only, as counts (`OWN_STATISTICS_SECTION`).
    statistics: "counts",
    settings: "own",
  },
  ed: {
    ed: "own",
    referrals: "own",
    "referral-new": "all",
    "patient-new": "all",
    patient: "own",
    movements: "own",
    delays: "own",
    "legal-forms": "own",
    handover: "own",
    search: "own",
    downtime: "own",
    // D-80: its own ED's statistics only, as counts.
    statistics: "counts",
    alerts: "own",
    "on-call": "all",
    settings: "own",
  },
  community: {
    community: "own",
    referrals: "own",
    "referral-new": "all",
    "patient-new": "all",
    patient: "own",
    // D-80: the team books transport for its own journeys (D-76), so it follows them here.
    movements: "own",
    delays: "own",
    "legal-forms": "own",
    search: "own",
    // D-80: its own team's statistics only, as counts.
    statistics: "counts",
    alerts: "own",
    "on-call": "all",
    settings: "own",
  },
  officer: {
    officer: "own",
    alerts: "own",
    "on-call": "all",
    settings: "own",
  },
  executive: {
    statistics: "counts",
    settings: "own",
  },
  admin: {
    governance: "own",
    settings: "own",
  },
};

/** Where each role lands. Every home is a screen the role can open. */
function homeScreenFor(role: WardAccessRole): WardScreenId {
  switch (role) {
    case "coordinator":
      return "home";
    case "bed_manager":
      return "capacity";
    case "ward":
      return "ward";
    case "ed":
      return "ed";
    case "community":
      return "community";
    case "officer":
      return "officer";
    case "executive":
      return "statistics";
    case "admin":
      return "settings";
  }
}

const BASE = "/ward-flow";

/** The address of a role's home, with its own place filled in where the home is a place page. */
export function homeHrefFor(access: WardAccess, slugForTeam: (teamName: string) => string): string {
  const scope = access.scope;
  switch (homeScreenFor(access.role)) {
    case "home":
      return BASE;
    case "capacity":
      return `${BASE}/capacity`;
    case "ward":
      return scope.kind === "ward" ? `${BASE}/ward/${scope.unitIds[0]}` : `${BASE}/wards`;
    case "ed":
      return scope.kind === "ed" ? `${BASE}/ed/${scope.edId}` : `${BASE}/ed`;
    case "community":
      return scope.kind === "team" ? `${BASE}/community/${slugForTeam(scope.teamName)}` : `${BASE}/community`;
    case "officer":
      return `${BASE}/transport/officer`;
    case "statistics":
      return `${BASE}/statistics`;
    default:
      return `${BASE}/settings`;
  }
}

/** A screen and the place its address names, if any. */
export type ScreenAddress = {
  readonly screen: WardScreenId;
  readonly unitId?: string;
  readonly edId?: string;
  readonly teamSlug?: string;
  readonly patientId?: string;
  readonly movementId?: string;
  /** The health service a `/statistics/service/...` address names. */
  readonly serviceId?: string;
  /** The statistics section a `/statistics/...` address opens. */
  readonly statisticsSection?: string;
};

const REDIRECT_TARGETS: Readonly<Record<string, WardScreenId>> = {
  command: "home",
  constellation: "network",
  queue: "delays",
  exceptions: "delays",
  escalation: "delays",
  transport: "movements",
  // B4 step 3 (19 Oct 2026): the Delays screen's address since it was renamed Waiting.
  waiting: "delays",
};

/**
 * What screen an address opens. `undefined` for an address this table has never heard of, which
 * the guard treats as coordinator only, so a new route can never open to everyone by omission.
 */
export function screenForPath(pathname: string): ScreenAddress | undefined {
  const trimmed = pathname.split(/[?#]/)[0]?.replace(/\/+$/, "") ?? "";
  if (trimmed !== BASE && !trimmed.startsWith(`${BASE}/`)) return undefined;
  const parts = trimmed
    .slice(BASE.length)
    .split("/")
    .filter((part) => part.length > 0)
    .map((part) => decodeURIComponent(part));
  const [first, second, third] = parts;
  if (first === undefined) return { screen: "home" };
  if (first === "transport" && second === "officer") return { screen: "officer" };
  if (REDIRECT_TARGETS[first] !== undefined && second === undefined) return { screen: REDIRECT_TARGETS[first] };
  // The bed meeting agenda (smart features idea 5): coordinator only, because no other role lists it.
  if (first === "bed-meeting" && second === "agenda")
    return third === undefined ? { screen: "bed-meeting-agenda" } : undefined;
  switch (first) {
    case "network":
    case "capacity":
    case "wards":
    case "hub":
    case "discharges":
    case "bed-meeting":
    case "delays":
    case "legal-forms":
    case "out-of-area":
    case "handover":
    case "search":
    case "governance":
    case "alerts":
    case "on-call":
    case "seclusion":
    case "settings":
      return second === undefined ? { screen: first } : undefined;
    case "ward":
      return second === undefined ? undefined : { screen: "ward", unitId: second };
    case "board":
      return second === undefined ? undefined : { screen: "board", unitId: second };
    case "ed":
      return second === undefined ? { screen: "ed" } : { screen: "ed", edId: second };
    case "community":
      return second === undefined ? { screen: "community" } : { screen: "community", teamSlug: second };
    case "referrals":
      if (second === "new") return { screen: "referral-new" };
      return second === undefined ? { screen: "referrals" } : undefined;
    case "people":
      if (second === "new") return { screen: "patient-new" };
      // D-39 links carry an address code; the page and its access check work on the record id.
      return second === undefined ? undefined : { screen: "patient", patientId: recordIdFromAddress(second) };
    case "movements":
      return second === undefined
        ? { screen: "movements" }
        : { screen: "movements", movementId: recordIdFromAddress(second) };
    case "reports":
      if (second === "chronology") return { screen: "chronology" };
      if (second === "downtime") return { screen: "downtime" };
      return undefined;
    case "statistics": {
      if (second === undefined) return { screen: "statistics" };
      if (second === "ward" && third !== undefined)
        return { screen: "statistics", statisticsSection: "ward", unitId: third };
      if (second === "ed" && third !== undefined) return { screen: "statistics", statisticsSection: "ed", edId: third };
      if (second === "community" && third !== undefined)
        return { screen: "statistics", statisticsSection: "community", teamSlug: third };
      if (second === "service" && third !== undefined)
        return { screen: "statistics", statisticsSection: "service", serviceId: third };
      return { screen: "statistics", statisticsSection: second };
    }
    default:
      return undefined;
  }
}

/** The statistics sections a bed manager may open: its own site's wards, as counts. */
const BED_MANAGER_STATISTICS = new Set(["overview", "weekly", "wards", "ward"]);

/**
 * D-80: a ward, ED or team desk opens only its own place's statistics page, never the network
 * hub, Compare, Weekly or an index of every place. The place itself is checked below.
 */
const OWN_STATISTICS_SECTION: Partial<Record<WardAccessRole, string>> = {
  ward: "ward",
  ed: "ed",
  community: "community",
};

/** True for a desk whose Statistics is its own place's page alone (D-80). */
export function statisticsHeldToOwnPlace(access: WardAccess): boolean {
  return OWN_STATISTICS_SECTION[access.role] !== undefined;
}

/** Where Statistics opens for a desk held to its own place's page (D-80), or `undefined`. */
export function ownStatisticsHrefFor(
  access: WardAccess,
  slugForTeam: (teamName: string) => string,
): string | undefined {
  const scope = access.scope;
  if (!statisticsHeldToOwnPlace(access)) return undefined;
  if (scope.kind === "ward") return `${BASE}/statistics/ward/${encodeURIComponent(scope.unitIds[0]!)}`;
  if (scope.kind === "ed") return `${BASE}/statistics/ed/${encodeURIComponent(scope.edId)}`;
  if (scope.kind === "team") return `${BASE}/statistics/community/${encodeURIComponent(slugForTeam(scope.teamName))}`;
  return undefined;
}

/** What a scope needs answered about places, so this module stays free of the site registry. */
export type PlaceLookup = {
  unitSiteCode(unitId: string): string | undefined;
  unitService(unitId: string): HealthService | undefined;
  edSiteCode(edId: string): string | undefined;
  edService(edId: string): HealthService | undefined;
  teamSlug(teamName: string): string;
  /** A site's health service, from the registry: an ED-only site has no ward to read it from. */
  siteService?(siteCode: string): HealthService | undefined;
};

export function unitInScope(scope: WardAccessScope, unitId: string, places: PlaceLookup): boolean {
  switch (scope.kind) {
    case "statewide":
      return true;
    case "service":
      return places.unitService(unitId) === scope.service;
    case "site":
      return places.unitSiteCode(unitId) === scope.siteCode;
    case "ward":
      return scope.unitIds.includes(unitId);
    default:
      return false;
  }
}

export function edInScope(scope: WardAccessScope, edId: string, places: PlaceLookup): boolean {
  switch (scope.kind) {
    case "statewide":
      return true;
    case "service":
      return places.edService(edId) === scope.service;
    case "site":
      return places.edSiteCode(edId) === scope.siteCode;
    case "ed":
      return scope.edId === edId;
    default:
      return false;
  }
}

export type ScreenDecision =
  { readonly open: true; readonly grant: ScreenGrant } | { readonly open: false; readonly why: "role" | "place" };

/**
 * May this role open this address? The screen must be in the role's table, and a place page must
 * be one of the role's own places. A patient or movement page is checked against the scoped
 * workspace by the guard, because only the workspace knows who is in whose care.
 */
export function screenDecision(
  access: WardAccess,
  address: ScreenAddress | undefined,
  places: PlaceLookup,
): ScreenDecision {
  if (address === undefined)
    return accessIsWholeNetwork(access) ? { open: true, grant: "all" } : { open: false, why: "role" };
  const grant = ROLE_SCREENS[access.role][address.screen];
  if (grant === undefined) return { open: false, why: "role" };
  const scope = access.scope;
  if (address.screen === "statistics" && access.role === "bed_manager") {
    if (address.statisticsSection !== undefined && !BED_MANAGER_STATISTICS.has(address.statisticsSection))
      return { open: false, why: "place" };
  }
  const ownSection = OWN_STATISTICS_SECTION[access.role];
  if (address.screen === "statistics" && ownSection !== undefined && address.statisticsSection !== ownSection)
    return { open: false, why: "place" };
  // A desk held to one ED or one team never opens the index of every ED or team (review on PR #330).
  if (address.screen === "ed" && address.edId === undefined && scope.kind === "ed")
    return { open: false, why: "place" };
  if (address.screen === "community" && address.teamSlug === undefined && scope.kind === "team")
    return { open: false, why: "place" };
  if (address.unitId !== undefined && !unitInScope(scope, address.unitId, places)) return { open: false, why: "place" };
  if (address.edId !== undefined && !edInScope(scope, address.edId, places)) return { open: false, why: "place" };
  if (address.serviceId !== undefined) {
    const own = scope.kind === "statewide" || (scope.kind === "service" && scope.service === address.serviceId);
    if (!own) return { open: false, why: "place" };
  }
  if (address.teamSlug !== undefined) {
    const own =
      scope.kind === "team"
        ? places.teamSlug(scope.teamName) === address.teamSlug
        : scope.kind === "statewide" || scope.kind === "service";
    if (!own) return { open: false, why: "place" };
  }
  return { open: true, grant };
}

/** Roles that may break glass on one patient record (plan section 7). Never officer, executive or admin. */
const BREAK_GLASS_ROLES: readonly WardAccessRole[] = ["bed_manager", "ward", "ed", "community"];

export function canBreakGlass(role: WardAccessRole): boolean {
  return BREAK_GLASS_ROLES.includes(role);
}

/** The reasons offered when breaking glass. "Other" asks for words, which are kept in memory only. */
export const BREAK_GLASS_REASONS = [
  { id: "handover", label: "Clinical handover" },
  { id: "bed-search", label: "Finding a bed" },
  { id: "transport-safety", label: "Transport safety" },
  { id: "other", label: "Other" },
] as const;

export type BreakGlassReasonId = (typeof BREAK_GLASS_REASONS)[number]["id"];

/** What the role is called on screen. */
export const ACCESS_ROLE_LABELS: Record<WardAccessRole, string> = {
  coordinator: "Bed coordinator",
  bed_manager: "Bed manager",
  ward: "Nurse in charge",
  ed: "ED clinician",
  community: "Community clinician",
  officer: "Transport officer",
  executive: "Executive",
  admin: "Access admin",
};
