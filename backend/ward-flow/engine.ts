import { activeActNowItems } from "../../src/components/ward-management/ward-act-now-items";
import { wardPlaceLookup } from "../../src/components/ward-management/ward-access-places";
import { commandScopeRefusal, scopeWardFlowState } from "../../src/components/ward-management/ward-access-state";
import { HEALTH_SERVICES, type HealthService } from "../../src/components/ward-management/ward-model";
import { CLINICAL_VALUES } from "../../src/components/ward-management/ward-clinical-values";
import {
  BREAK_GLASS_REASONS,
  STATEWIDE_COORDINATOR,
  WARD_ACCESS_ROLES,
  accessIsValid,
  accessIsWholeNetwork,
  canBreakGlass,
  type WardAccess,
  type WardAccessScope,
} from "../../src/components/ward-management/ward-role-access";
import { CROSS_ROLE_ALLOWED } from "../../src/components/ward-management/ward-role-permissions";
import { EVENT_ROLE, type WardFlowEvent } from "../../src/components/ward-management/ward-flow-events";
import { validSharedCommand } from "./command-schemas";
import { scenarioNetwork } from "../../src/components/ward-management/ward-scenarios";
import { NOW_ANCHOR, STANDARD_WARD_SITES } from "../../src/components/ward-management/ward-sites";
import {
  seedWardFlowStateAt,
  wardFlowReducer,
  type WardFlowState,
} from "../../src/components/ward-management/ward-flow-reducer";
import { isValidSharedWardFlowState } from "../../src/components/ward-management/ward-shared-state-validation";

export type SharedWorld = { version: 1; state: WardFlowState; dayZero: string; startedAt: string };
/** JSON round-trip drops explicit `undefined` fields the shared-state validator rejects. */
const serialise = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
/** A known type, an explicit allowed role and well-formed fields: see command-schemas.ts. */
export function validCommand(value: unknown): value is Record<string, unknown> & { type: WardFlowEvent["type"] } {
  return validSharedCommand(value);
}

/** True for the demonstration controls (advance clock, reset or set scenario): role "demo" only. */
export function demoOnlyCommand(value: unknown): boolean {
  const type = (value as { type?: unknown } | null)?.type;
  if (typeof type !== "string" || !Object.hasOwn(EVENT_ROLE, type)) return false;
  const roles: readonly string[] = EVENT_ROLE[type as WardFlowEvent["type"]];
  return roles.length === 1 && roles[0] === "demo";
}

/**
 * The newest audit entries kept in the saved workspace. The database audit table is the full
 * record; the workspace copy only feeds the on-screen views, and an unbounded copy eventually
 * passes the 8 MB row limit so every save fails. Entries an audit review names are always kept,
 * and so are this scenario's newest record-access receipts, because an open record is read
 * against its receipt.
 */
export const PERSISTED_AUDIT_EVENTS = 1000;
export function boundAudit(state: WardFlowState): WardFlowState {
  const excess = state.auditEvents.length - PERSISTED_AUDIT_EVENTS;
  if (excess <= 0) return state;
  const kept = new Set(state.auditReviews.map((review) => review.eventId));
  state.auditEvents
    .filter((entry) => entry.category === "record-access" && entry.generation === state.worldGeneration)
    .slice(-PERSISTED_AUDIT_EVENTS)
    .forEach((entry) => kept.add(entry.id));
  return {
    ...state,
    auditEvents: state.auditEvents.filter((entry, index) => index >= excess || kept.has(entry.id)),
  };
}

function changedFacts(before: WardFlowState, after: WardFlowState) {
  const changes: Record<string, unknown> = {};
  const skip = new Set(["auditEvents", "auditReviews", "rejections"]);
  for (const [key, nextValue] of Object.entries(after) as [keyof WardFlowState, WardFlowState[keyof WardFlowState]][]) {
    if (skip.has(key as string)) continue;
    const previousValue = before[key];
    if (JSON.stringify(previousValue) === JSON.stringify(nextValue)) continue;
    if (Array.isArray(previousValue) && Array.isArray(nextValue)) {
      const previousSerialized = previousValue.map((row) => JSON.stringify(row));
      const nextSerialized = nextValue.map((row) => JSON.stringify(row));
      const previousRows = new Set(previousSerialized);
      const nextRows = new Set(nextSerialized);
      changes[key as string] = {
        before: previousValue.filter((_, index) => !nextRows.has(previousSerialized[index]!)),
        after: nextValue.filter((_, index) => !previousRows.has(nextSerialized[index]!)),
      };
    } else changes[key as string] = { before: previousValue, after: nextValue };
  }
  return changes;
}

export function seedWorld(at: Date): SharedWorld {
  return {
    version: 1,
    state: serialise(seedWardFlowStateAt(0)),
    dayZero: new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate())).toISOString(),
    startedAt: at.toISOString(),
  };
}

export function worldNow(world: SharedWorld, at: Date): number {
  return (
    NOW_ANCHOR +
    Math.max(0, Math.floor((at.getTime() - Date.parse(world.startedAt)) / 60_000)) +
    world.state.clockOffsetMinutes
  );
}

export function validWorld(value: unknown): value is SharedWorld {
  if (!value || typeof value !== "object") return false;
  const world = value as SharedWorld;
  return (
    world.version === 1 &&
    typeof world.dayZero === "string" &&
    typeof world.startedAt === "string" &&
    Number.isFinite(Date.parse(world.dayZero)) &&
    Number.isFinite(Date.parse(world.startedAt)) &&
    isValidSharedWardFlowState(world.state)
  );
}

/** A break glass grant as the server holds it: one patient, read only, until a wall-clock time. */
export type StoredGrant = { patientId: string; until: Date };

/** Grants in the workspace's own minutes, as the scoping rule reads them. */
function worldGrants(world: SharedWorld, grants: readonly StoredGrant[], at: Date) {
  const now = worldNow(world, at);
  return grants.map((grant) => ({
    patientId: grant.patientId,
    until: now + Math.max(0, Math.ceil((grant.until.getTime() - at.getTime()) / 60_000)),
  }));
}

const text = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max;

/**
 * A role and place read from a membership row or a request, or `null` when it is not one the
 * access table allows. Every field is checked, so a hand-edited row can never widen a scope.
 */
export function parseAccess(role: unknown, scope: unknown): WardAccess | null {
  if (typeof role !== "string" || !(WARD_ACCESS_ROLES as readonly string[]).includes(role)) return null;
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) return null;
  const fields = scope as Record<string, unknown>;
  const only = (...keys: string[]) => Object.keys(fields).every((key) => key === "kind" || keys.includes(key));
  let parsed: WardAccessScope | null = null;
  switch (fields.kind) {
    case "statewide":
    case "jobs":
      parsed = only() ? { kind: fields.kind } : null;
      break;
    case "service":
      parsed =
        only("service") && (HEALTH_SERVICES as readonly unknown[]).includes(fields.service)
          ? { kind: "service", service: fields.service as HealthService }
          : null;
      break;
    case "site":
      parsed = only("siteCode") && text(fields.siteCode, 40) ? { kind: "site", siteCode: fields.siteCode } : null;
      break;
    case "ward":
      parsed =
        only("unitIds") &&
        Array.isArray(fields.unitIds) &&
        fields.unitIds.length <= 20 &&
        fields.unitIds.every((id) => text(id, 100)) &&
        new Set(fields.unitIds).size === fields.unitIds.length
          ? { kind: "ward", unitIds: [...(fields.unitIds as string[])] }
          : null;
      break;
    case "ed":
      parsed = only("edId") && text(fields.edId, 100) ? { kind: "ed", edId: fields.edId } : null;
      break;
    case "team":
      parsed = only("teamName") && text(fields.teamName, 200) ? { kind: "team", teamName: fields.teamName } : null;
      break;
  }
  if (!parsed) return null;
  const access = { role: role as WardAccess["role"], scope: parsed };
  return accessIsValid(access) ? access : null;
}

/** The bootstrap view: an account named in WARD_COORDINATOR_USER_IDS works as this. */
export const STATEWIDE: WardAccess = STATEWIDE_COORDINATOR;

/** True for the statewide coordinator: the whole network, every record. */
export function wholeNetwork(access: WardAccess): boolean {
  return accessIsWholeNetwork(access);
}

/**
 * The workspace this desk may be sent. A statewide coordinator gets the world itself. Every other
 * desk gets `scopeWardFlowState`, the same rule the screens use, plus any break glass grants.
 */
export function scopeWorld(world: SharedWorld, access: WardAccess, at: Date, grants: readonly StoredGrant[] = []) {
  if (accessIsWholeNetwork(access)) return world;
  const { state } = scopeWardFlowState(world.state, access, {
    now: worldNow(world, at),
    places: wardPlaceLookup(world.state.units),
    grants: worldGrants(world, grants, at),
  });
  return { ...world, state };
}

/**
 * Why this desk may not send this command, or `null`. The sender's role comes from its membership,
 * never from the browser: a desk sends only commands its own role may take (`EVENT_ROLE`, or a pair
 * in `CROSS_ROLE_ALLOWED`), and only about records inside its own place. A statewide coordinator may
 * send any command the workflow allows; the demonstration controls are the statewide coordinator's
 * alone. The access admin and the executive change nothing.
 */
export function commandRefusal(
  world: SharedWorld,
  access: WardAccess,
  supplied: Record<string, unknown>,
  at: Date,
  grants: readonly StoredGrant[] = [],
): string | null {
  const type = supplied.type as WardFlowEvent["type"];
  const role = supplied.role;
  if (!Object.hasOwn(EVENT_ROLE, type)) return "This change is not one the workflow knows.";
  if (accessIsWholeNetwork(access)) return null;
  const notYours = "This change is not part of your role.";
  if (access.role === "admin" || access.role === "executive" || role === "demo") return notYours;
  // A service coordinator is the coordinator inside its service (Josh, 10 Oct 2026: the
  // coordinator takes every action), so only its place limits it, below.
  if (access.role !== "coordinator") {
    const accepted = EVENT_ROLE[type].includes(role as WardFlowEvent["role"]);
    // A `CROSS_ROLE_ALLOWED` pair lets the desk's screen send the event under the role the event
    // takes (the ward's Raise referral is sent as community).
    const allowed =
      accepted &&
      (role === access.role ||
        CROSS_ROLE_ALLOWED.some((entry) => entry.routeRole === access.role && entry.event === type));
    if (!allowed) return notYours;
  }
  return commandScopeRefusal(world.state, access, supplied, {
    now: worldNow(world, at),
    places: wardPlaceLookup(world.state.units),
    grants: worldGrants(world, grants, at),
  });
}

/** Who may grant, approve and remove roles: the access admin, and the statewide coordinator. */
export function managesAccess(access: WardAccess): boolean {
  return access.role === "admin" || accessIsWholeNetwork(access);
}

/**
 * Whether a place names something in this workspace, so a grant never points at a ward, ED or
 * site that does not exist. A team is any name: one with no patients simply shows nobody.
 */
export function scopeExists(world: SharedWorld, scope: WardAccessScope): boolean {
  const places = wardPlaceLookup(world.state.units);
  switch (scope.kind) {
    case "site":
      return world.state.units.some((unit) => places.unitSiteCode(unit.id) === scope.siteCode);
    case "ward":
      return scope.unitIds.every((id) => places.unitSiteCode(id) !== undefined);
    case "ed":
      return places.edSiteCode(scope.edId) !== undefined;
    default:
      return true;
  }
}

/**
 * Whether `inner` lies wholly inside `outer`, so an access admin never grants, approves or removes
 * a role wider than their own. A service admin covers that service's sites, wards and EDs only;
 * statewide, team and jobs scopes need a statewide admin.
 */
export function scopeWithin(world: SharedWorld, inner: WardAccessScope, outer: WardAccessScope): boolean {
  if (outer.kind === "statewide") return true;
  if (outer.kind !== "service") return false;
  const places = wardPlaceLookup(world.state.units);
  switch (inner.kind) {
    case "service":
      return inner.service === outer.service;
    case "site": {
      const units = world.state.units.filter((unit) => places.unitSiteCode(unit.id) === inner.siteCode);
      return units.length > 0 && units.every((unit) => places.unitService(unit.id) === outer.service);
    }
    case "ward":
      return inner.unitIds.every((id) => places.unitService(id) === outer.service);
    case "ed":
      return places.edService(inner.edId) === outer.service;
    default:
      return false;
  }
}

export const BREAK_GLASS_REASON_IDS: readonly string[] = BREAK_GLASS_REASONS.map((reason) => reason.id);
export const BREAK_GLASS_MINUTES = CLINICAL_VALUES.breakGlassWindow.value;
export const BREAK_GLASS_PER_SHIFT = CLINICAL_VALUES.breakGlassPerShift.value;
export const BREAK_GLASS_SHIFT_HOURS = CLINICAL_VALUES.breakGlassShift.value;

/**
 * Whether this desk may open this patient's record outside its care, or why not. Only clinical
 * roles break glass, only for a patient who exists, and never for one already in its own care.
 */
export function breakGlassRefusal(world: SharedWorld, access: WardAccess, patientId: unknown, at: Date): string | null {
  if (!canBreakGlass(access.role)) return "Opening a record outside your care is not part of your role.";
  if (typeof patientId !== "string" || !world.state.patients.some((patient) => patient.id === patientId))
    return "That patient is not in the workspace.";
  const { state } = scopeWardFlowState(world.state, access, {
    now: worldNow(world, at),
    places: wardPlaceLookup(world.state.units),
  });
  if (state.patients.some((patient) => patient.id === patientId)) return "That patient is already in your care.";
  return null;
}

export function applyCommand(world: SharedWorld, supplied: unknown, at: Date) {
  if (!validWorld(world) || !validCommand(supplied)) throw new Error("invalid-command");
  const fields = supplied as Record<string, unknown>;
  if (typeof fields.type !== "string" || !Object.hasOwn(EVENT_ROLE, fields.type)) throw new Error("invalid-command");
  const type = fields.type as WardFlowEvent["type"];
  const roles = EVENT_ROLE[type];
  // A workflow perspective is not an access grant. The API authorises the named coordinator
  // before this function runs. Preserve existing ward/ED/officer guards and audit facts. The role
  // is always the sender's own: it is never defaulted to the first allowed role.
  const role = fields.role;
  if (!roles.includes(role as WardFlowEvent["role"])) throw new Error("invalid-command");
  const event = { ...fields, type, role, now: worldNow(world, at) } as WardFlowEvent;
  let next: WardFlowState;
  try {
    next = serialise(wardFlowReducer(world.state, event));
  } catch (error) {
    if (error instanceof TypeError || error instanceof RangeError) throw new Error("invalid-command");
    throw error;
  }
  if (next.rejections.length > world.state.rejections.length) {
    return { world, outcome: "denied" as const, changes: {}, reason: "The workflow rules did not permit this action." };
  }
  if (!isValidSharedWardFlowState(next)) throw new Error("invalid-command");
  const reset = next.worldGeneration !== world.state.worldGeneration;
  const domainAudit = reset ? next.auditEvents : next.auditEvents.slice(world.state.auditEvents.length);
  const saved = boundAudit(next);
  if (saved !== next && !isValidSharedWardFlowState(saved)) throw new Error("invalid-command");
  return {
    world: { ...world, state: saved },
    outcome: "accepted" as const,
    changes: { domainAudit, reset, facts: changedFacts(world.state, next) },
    reason: null,
  };
}

/**
 * Phone push: the coordinator's active act-now (red) rows at `at`, reduced to what a lock screen
 * may carry. Only the row's inbox id (for deduplication, never sent) and the hospital site the
 * movement started at. No title, detail, movement id, name, UMRN or typed text leaves here.
 */
export function actNowAlerts(world: SharedWorld, at: Date): { id: string; site: string | null }[] {
  if (!validWorld(world)) return [];
  const state = world.state;
  const sites = scenarioNetwork(state.scenario)?.sites ?? STANDARD_WARD_SITES;
  const origins = new Map<string, string>(state.movements.map((movement) => [movement.id, movement.originEdId]));
  return activeActNowItems(state, worldNow(world, at)).map((item) => {
    const origin = origins.get(item.movementId);
    const site = origin
      ? sites.find((candidate) => candidate.emergencyDepartment?.id === origin || candidate.code === origin)
      : undefined;
    return { id: item.id, site: site?.name ?? null };
  });
}
