import { activeActNowItems } from "../../src/components/ward-management/ward-act-now-items";
import { EVENT_ROLE, type WardFlowEvent } from "../../src/components/ward-management/ward-flow-events";
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
export function validCommand(value: unknown): value is Record<string, unknown> & { type: WardFlowEvent["type"] } {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).type === "string" &&
    Object.hasOwn(EVENT_ROLE, (value as Record<string, unknown>).type as string)
  );
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

export function applyCommand(world: SharedWorld, supplied: unknown, at: Date) {
  if (!validWorld(world) || !validCommand(supplied)) throw new Error("invalid-command");
  const fields = supplied as Record<string, unknown>;
  if (typeof fields.type !== "string" || !Object.hasOwn(EVENT_ROLE, fields.type)) throw new Error("invalid-command");
  const type = fields.type as WardFlowEvent["type"];
  const roles = EVENT_ROLE[type];
  // A workflow perspective is not an access grant. The API authorises the named coordinator
  // before this function runs. Preserve existing ward/ED/officer guards and audit facts.
  const role = fields.role ?? roles[0];
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
  return {
    world: { ...world, state: next },
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
