import { commandMetadata } from "../../src/components/ward-management/ward-command-metadata";
import { activeActNowItems } from "../../src/components/ward-management/ward-act-now-items";
import { wardAccessPlaces, wardPlaceLookup } from "../../src/components/ward-management/ward-access-places";
import {
  PUSH_ROLES,
  ACCESS_UNUSED_MINUTES as ACCESS_UNUSED_RULE_MINUTES,
  STEP_UP_MINUTES as STEP_UP_RULE_MINUTES,
  coverAccess as coverAccessRule,
  coverRefusal as coverRefusalRule,
  managesAccess as managesAccessRule,
  requestRefusal as requestRefusalRule,
  revokeRefusal as revokeRefusalRule,
  scopeNamesPlace,
  scopeWithinScope,
  withCover as withCoverRule,
  type AccessPlaces,
} from "../../src/components/ward-management/ward-access-admin";
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
import { checkSyntheticPayload } from "../../src/lib/synthetic-data-guard";

export { checkSyntheticPayload };

export type SharedWorld = { version: 1; state: WardFlowState; dayZero: string; startedAt: string };
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const entry = value[i];
      value[i] = entry === undefined ? null : stripUndefined(entry);
    }
    return value;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      const entry = record[key];
      if (entry === undefined) {
        delete record[key];
      } else if (entry && typeof entry === "object") {
        stripUndefined(entry);
      }
    }
  }
  return value;
}

/** Deep-clones via structuredClone and drops explicit `undefined` fields the shared-state validator rejects. */
const serialise = <T>(value: T): T => stripUndefined(structuredClone(value));

const placeLookupCache = new WeakMap<readonly WardFlowState["units"][number][], ReturnType<typeof wardPlaceLookup>>();

function getWardPlaceLookup(units: WardFlowState["units"]): ReturnType<typeof wardPlaceLookup> {
  let cached = placeLookupCache.get(units);
  if (!cached) {
    cached = wardPlaceLookup(units);
    placeLookupCache.set(units, cached);
  }
  return cached;
}
/** A known type, an explicit allowed role and well-formed fields: see command-schemas.ts. */
export function validCommand(value: unknown): value is Record<string, unknown> & { type: WardFlowEvent["type"] } {
  return validSharedCommand(value) && checkSyntheticPayload(value).safe;
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

const SKIP_FACT_KEYS = new Set(["auditEvents", "auditReviews", "rejections"]);

/**
 * Audit F-01: a referral's chart files are never stored on the shared board. Older clients may
 * still send the file content; it is dropped here, before the command is fingerprinted or applied,
 * and the name, type and size are kept.
 */
export function storableCommand(supplied: unknown): unknown {
  const fields = supplied as { type?: unknown; intake?: { charts?: unknown } } | null;
  if (fields?.type !== "RECEIVE_REFERRAL" || !Array.isArray(fields.intake?.charts)) return supplied;
  return {
    ...fields,
    intake: {
      ...fields.intake,
      charts: fields.intake.charts.map((chart: unknown) => {
        if (!chart || typeof chart !== "object" || !Object.hasOwn(chart, "base64")) return chart;
        const kept = { ...(chart as Record<string, unknown>) };
        delete kept.base64;
        return kept;
      }),
    },
  };
}

/**
 * Audit F-01: the audit table can never be changed or purged, so a referral row copied into a
 * change record leaves out the referrer's and clearance contact's details and any file content.
 * The workspace record itself keeps them, where the workflow needs them and they can be removed.
 */
const WITHHELD = "withheld from the audit";
function auditableFact(key: string, row: unknown): unknown {
  if (key !== "referrals" || !row || typeof row !== "object") return row;
  const intake = (row as { intake?: Record<string, unknown> }).intake;
  if (!intake || typeof intake !== "object") return row;
  const clearance = intake.medicalClearance as Record<string, unknown> | undefined;
  return {
    ...row,
    intake: {
      ...intake,
      ...(intake.referrer === undefined ? {} : { referrer: WITHHELD }),
      ...(clearance && typeof clearance === "object"
        ? {
            medicalClearance: Object.fromEntries(
              Object.entries(clearance).map(([field, value]) =>
                field === "contactName" || field === "contactPhone" ? [field, WITHHELD] : [field, value],
              ),
            ),
          }
        : {}),
      ...(Array.isArray(intake.charts)
        ? {
            charts: intake.charts.map((chart: unknown) =>
              chart && typeof chart === "object" && Object.hasOwn(chart, "base64")
                ? { ...chart, base64: WITHHELD }
                : chart,
            ),
          }
        : {}),
    },
  };
}

function changedFacts(before: WardFlowState, after: WardFlowState, rawAfter?: WardFlowState) {
  const changes: Record<string, unknown> = {};
  for (const [key, nextValue] of Object.entries(after) as [keyof WardFlowState, WardFlowState[keyof WardFlowState]][]) {
    if (SKIP_FACT_KEYS.has(key as string)) continue;
    const previousValue = before[key];
    if (previousValue === nextValue || (rawAfter && previousValue === rawAfter[key])) continue;
    if (Array.isArray(previousValue) && Array.isArray(nextValue)) {
      const previousSerialized = previousValue.map((row) => JSON.stringify(row));
      const nextSerialized = nextValue.map((row) => JSON.stringify(row));
      if (
        previousSerialized.length === nextSerialized.length &&
        previousSerialized.every((val, index) => val === nextSerialized[index])
      ) {
        continue;
      }
      const previousRows = new Set(previousSerialized);
      const nextRows = new Set(nextSerialized);
      changes[key as string] = {
        before: previousValue
          .filter((_, index) => !nextRows.has(previousSerialized[index]!))
          .map((row) => auditableFact(key as string, row)),
        after: nextValue
          .filter((_, index) => !previousRows.has(nextSerialized[index]!))
          .map((row) => auditableFact(key as string, row)),
      };
    } else if (JSON.stringify(previousValue) !== JSON.stringify(nextValue)) {
      changes[key as string] = { before: previousValue, after: nextValue };
    }
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
    places: getWardPlaceLookup(world.state.units),
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
    // takes (the ward's Raise referral is sent as the referral's source, ED or community). It never
    // lends the coordinator's role, which would write the change down as the coordinator's.
    const borrowed =
      role !== "coordinator" &&
      CROSS_ROLE_ALLOWED.some((entry) => entry.routeRole === access.role && entry.event === type);
    const allowed = accepted && (role === access.role || borrowed);
    if (!allowed) return notYours;
  }
  return commandScopeRefusal(world.state, access, supplied, {
    now: worldNow(world, at),
    places: getWardPlaceLookup(world.state.units),
    grants: worldGrants(world, grants, at),
  });
}

/** Who may grant, approve and remove roles: the access admin, and the statewide coordinator. */
export function managesAccess(access: WardAccess): boolean {
  return managesAccessRule(access);
}

/** The place answers the access admin's rules need, read from this workspace's wards. */
export function accessPlaces(world: SharedWorld): AccessPlaces {
  return wardAccessPlaces(world.state.units);
}

/**
 * Whether a place names something in this workspace, so a grant never points at a ward, ED or
 * site that does not exist (`scopeNamesPlace`, shared with the Access admin screen).
 */
export function scopeExists(world: SharedWorld, scope: WardAccessScope): boolean {
  return scopeNamesPlace(scope, accessPlaces(world));
}

/**
 * Whether `inner` lies wholly inside `outer`, so an access admin never grants, approves or removes
 * a role wider than their own (`scopeWithinScope`, shared with the Access admin screen).
 */
export function scopeWithin(world: SharedWorld, inner: WardAccessScope, outer: WardAccessScope): boolean {
  return scopeWithinScope(inner, outer, accessPlaces(world));
}

/** Granting access, cover or breaking glass needs a sign-in this recent (synthetic). */
export const STEP_UP_MINUTES = STEP_UP_RULE_MINUTES;
/** A role not worked as for this long stops working by itself (synthetic). */
export const ACCESS_UNUSED_MINUTES = ACCESS_UNUSED_RULE_MINUTES;
/** A sign-in lasts at most this long, however busy the desk (ISM-0428, D-65). */
export const SESSION_LIMIT_MINUTES = CLINICAL_VALUES.sessionLimit.value * 60;

/**
 * Why this cover may not be given, or `null` (feature 2): the same rule the Access tab uses. The
 * role it carries comes from `coverAccess`: a ward's cover is a nurse in charge's, an ED's an ED
 * clinician's.
 */
export function coverRefusal(
  world: SharedWorld,
  giver: WardAccess,
  giverId: string,
  recipientId: string,
  scope: WardAccessScope,
  minutes: number,
): string | null {
  return coverRefusalRule({ giver, giverId, recipientId, scope, minutes, places: accessPlaces(world) });
}

export function coverAccess(scope: WardAccessScope): WardAccess | null {
  return coverAccessRule(scope);
}

/** A ward desk with cover of more wards works them as one desk. ED cover is never merged. */
export function withCover(access: WardAccess, covers: readonly WardAccessScope[]): WardAccess {
  return withCoverRule(access, covers);
}

/** Why a person with no role may not ask for this one, or `null` (feature 7). */
export function requestRefusal(world: SharedWorld, access: WardAccess, openRequests: number): string | null {
  return requestRefusalRule({ access, openRequests, places: accessPlaces(world) });
}

/** Why this person may not end this role or cover, or `null`. A cover's giver ends it too. */
export function revokeRefusal(
  world: SharedWorld,
  remover: WardAccess,
  removerId: string,
  membership: { kind: "role" | "cover"; grantedBy: string; access: WardAccess },
): string | null {
  return revokeRefusalRule({
    remover,
    removerId,
    membership: {
      id: "",
      actorId: "",
      grantedAt: 0,
      expiresAt: 0,
      approvedBy: null,
      lastUsedAt: null,
      revokedAt: null,
      ...membership,
    },
    places: accessPlaces(world),
  });
}

/** Who hears phone alerts by role (feature 10). One list, in the access admin's rules. */
export { PUSH_ROLES };

/** The act-now rows this desk may hear about: `actNowAlerts` on its own scoped workspace. */
export function scopedActNowAlerts(
  world: SharedWorld,
  access: WardAccess,
  at: Date,
): { id: string; site: string | null }[] {
  if (!validWorld(world) || !PUSH_ROLES.includes(access.role)) return [];
  return accessIsWholeNetwork(access) ? actNowAlerts(world, at) : actNowAlerts(scopeWorld(world, access, at), at);
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
  const { state, scoped } = scopeWardFlowState(world.state, access, {
    now: worldNow(world, at),
    places: getWardPlaceLookup(world.state.units),
  });
  // In care means a live record the desk sees in full. A finished move, an answered referral or a
  // past stay kept only for the hand-off window is history, so break glass stays open for that
  // person's current care elsewhere (review on PR #365).
  const inFullCare =
    state.movements.some((movement) => movement.patientId === patientId && movement.closure === undefined) ||
    state.referrals.some(
      (referral) =>
        referral.patientId === patientId &&
        referral.destinations.some((line) => line.state === "queued" && line.withdrawnAt === undefined),
    ) ||
    state.admissions.some(
      (admission) =>
        admission.patientId === patientId &&
        admission.state !== "departed" &&
        !scoped.datesOnlyAdmissionIds.has(admission.id),
    );
  if (inFullCare) return "That patient is already in your care.";
  return null;
}

export function applyCommand(world: SharedWorld, supplied: unknown, at: Date) {
  supplied = storableCommand(supplied);
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
  let rawNext: WardFlowState;
  try {
    rawNext = wardFlowReducer(world.state, event);
  } catch (error) {
    if (error instanceof TypeError || error instanceof RangeError) throw new Error("invalid-command");
    throw error;
  }
  if (rawNext.rejections.length > world.state.rejections.length) {
    // Referral suitability is deliberately decided per ward. Commit the permitted subset only
    // when this command's fresh audit records both outcomes; an earlier partial is no authority.
    const partialReferral =
      event.type === "REFER_TO_UNITS" &&
      rawNext.auditEvents
        .slice(world.state.auditEvents.length)
        .some(
          (audit) =>
            (audit.category === "referral" || audit.category === "override") &&
            audit.action === "REFER_TO_UNITS" &&
            audit.outcome === "partial" &&
            audit.sequence > world.state.auditSequence &&
            audit.subject.kind === "movement" &&
            audit.subject.movementId === event.movementId &&
            audit.details.targets.some((target) => target.outcome === "accepted") &&
            audit.details.targets.some((target) => target.outcome === "denied"),
        );
    if (!partialReferral)
      return {
        world,
        outcome: "denied" as const,
        changes: {},
        // Audit F-08: the engine's own reason, as the local board shows it. Refusals name records
        // by UMRN at most, never typed text, and only a desk allowed to act on the record gets here.
        reason: refusalReason(rawNext.rejections.at(-1)?.reason),
      };
  }
  // Refusal messages are transient (D-18). A partial referral's coded denied targets remain in audit.
  const next = serialise({ ...rawNext, rejections: [] });
  if (!isValidSharedWardFlowState(next)) throw new Error("invalid-command");
  const reset = next.worldGeneration !== world.state.worldGeneration;
  const domainAudit = reset ? next.auditEvents : next.auditEvents.slice(world.state.auditEvents.length);
  const saved = boundAudit(next);
  if (saved !== next && !isValidSharedWardFlowState(saved)) throw new Error("invalid-command");
  return {
    world: { ...world, state: saved },
    outcome: "accepted" as const,
    completion: commandMetadata(world.state, next),
    changes: { domainAudit, reset, facts: changedFacts(world.state, next, rawNext) },
    reason: null,
  };
}

const REFUSAL_FALLBACK = "The workflow rules did not permit this action.";
const REFUSAL_MAX = 500;
function refusalReason(reason: unknown): string {
  if (typeof reason !== "string" || !reason.trim()) return REFUSAL_FALLBACK;
  const trimmed = reason.trim();
  return trimmed.length > REFUSAL_MAX ? `${trimmed.slice(0, REFUSAL_MAX - 1)}…` : trimmed;
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
  const siteByOrigin = new Map<string, string>();
  for (const candidate of sites) {
    if (candidate.emergencyDepartment?.id && !siteByOrigin.has(candidate.emergencyDepartment.id)) {
      siteByOrigin.set(candidate.emergencyDepartment.id, candidate.name);
    }
    if (!siteByOrigin.has(candidate.code)) {
      siteByOrigin.set(candidate.code, candidate.name);
    }
  }
  const origins = new Map<string, string>(state.movements.map((movement) => [movement.id, movement.originEdId]));
  return activeActNowItems(state, worldNow(world, at)).map((item) => {
    const origin = origins.get(item.movementId);
    return { id: item.id, site: (origin ? siteByOrigin.get(origin) : undefined) ?? null };
  });
}
