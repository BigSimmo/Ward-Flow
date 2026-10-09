import { EVENT_ROLE, type WardFlowEvent } from "../../src/components/ward-management/ward-flow-events";
import { NOW_ANCHOR } from "../../src/components/ward-management/ward-sites";
import {
  seedWardFlowStateAt,
  wardFlowReducer,
  type WardFlowState,
} from "../../src/components/ward-management/ward-flow-reducer";
import { isValidSharedWardFlowState } from "../../src/components/ward-management/ward-shared-state-validation";

export type SharedWorld = { version: 1; state: WardFlowState; dayZero: string; startedAt: string };
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
  for (const key of Object.keys(after) as (keyof WardFlowState)[]) {
    if (
      ["auditEvents", "auditReviews", "rejections"].includes(key) ||
      JSON.stringify(before[key]) === JSON.stringify(after[key])
    )
      continue;
    if (Array.isArray(before[key]) && Array.isArray(after[key])) {
      const previous = before[key] as unknown[];
      const next = after[key] as unknown[];
      const previousRows = new Set(previous.map((row) => JSON.stringify(row)));
      const nextRows = new Set(next.map((row) => JSON.stringify(row)));
      changes[key] = {
        before: previous.filter((row) => !nextRows.has(JSON.stringify(row))),
        after: next.filter((row) => !previousRows.has(JSON.stringify(row))),
      };
    } else changes[key] = { before: before[key], after: after[key] };
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
