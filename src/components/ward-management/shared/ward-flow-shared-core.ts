import { EVENT_ROLE, type WardFlowEvent } from "../ward-flow-events";
import { WARD_FLOW_TEXT_SAFE_EVENT_TYPES } from "../ward-flow-persistence-classification";
import { wardFlowReducer, type WardFlowState } from "../ward-flow-reducer";
import { WARD_FLOW_ROLE_LABELS } from "../ward-flow-roles";
import { activateScenarioNetwork } from "../ward-scenarios";

/**
 * Feature 3, shared live state (9 Oct 2026). The pieces the browser and the server must agree on
 * exactly, so both import them from here: how one event is applied, which events may be shared, and
 * the wire shapes. Synthetic data only.
 *
 * The reducer is the single judge of validity on both sides. The server stores an event only when
 * `applySharedEvent` accepts it on the server's own copy of the world; a browser replays the same
 * events through the same function, so every browser and the server reach the same state.
 */

/** Largest serialised event the server takes. Real events are a few hundred bytes. */
export const SHARED_EVENT_MAX_BYTES = 64 * 1024;

/** Events the server returns per poll. A browser further behind than this joins again. */
export const SHARED_EVENTS_PAGE_LIMIT = 500;

/** Header a browser sends with its build, so a browser running an older build is told to reload. */
export const SHARED_BUILD_HEADER = "x-ward-flow-build";

/** The base path of the shared-state API routes. */
export const SHARED_API_BASE = "/api/ward-flow/shared";

const EVENT_ID = /^[A-Za-z0-9-]{8,80}$/;
const WORLD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** One stored event, as the server returns it. `seq` counts from 1 within a world. */
export type SharedEventRecord = { seq: number; eventId: string; event: WardFlowEvent };

/** The join response: the world at its head, and what a browser needs to share its clock. */
export type SharedJoinResponse = {
  worldId: string;
  seq: number;
  state: WardFlowState;
  /** Local midnight of the day the world was started, as the starting browser computed it. */
  dayZeroMs: number;
  /** Server wall clock when the world started. Board time is 10:42 plus time since then. */
  startedAtMs: number;
  /** Server wall clock when this response was built, so browsers share one clock. */
  serverNowMs: number;
  /** False by default: typed free text is not sent to the server (see the plan). */
  typedTextAllowed: boolean;
};

export type SharedEventsResponse = {
  /** The world the server is on now. Different from the one asked about means join again. */
  currentWorldId: string | null;
  headSeq: number;
  events: SharedEventRecord[];
  /** True when more events exist after the last one returned. */
  truncated: boolean;
};

export type SharedAppendRequest = { worldId: string; baseSeq: number; eventId: string; event: WardFlowEvent };

/**
 * Applies one event the way the provider does: the scenario's ward network is activated first,
 * because ward lookups inside the reducer read it (`activateScenarioNetwork` is idempotent). An
 * event is accepted when it adds no refusal, the same test the provider's event log uses.
 */
export function applySharedEvent(
  state: WardFlowState,
  event: WardFlowEvent,
): { next: WardFlowState; accepted: boolean } {
  activateScenarioNetwork(state.scenario);
  const next = wardFlowReducer(state, event);
  return { next, accepted: next.rejections.length === state.rejections.length };
}

/**
 * Mirrors `ward-flow-persistence-classification.ts`: default deny. Any event type not on the
 * reviewed text-safe list may carry typed free text, so it is not sent to the server unless Josh
 * turns that on (`WARD_FLOW_SHARED_TYPED_TEXT=allow`).
 */
export function sharedEventCarriesTypedText(type: WardFlowEvent["type"]): boolean {
  return !WARD_FLOW_TEXT_SAFE_EVENT_TYPES.has(type);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The cheap outer check before the reducer sees a posted event: a known type, a known role and a
 * finite time. Everything else is the reducer's job; a payload that makes the reducer throw is
 * refused by the caller.
 */
export function isSharedEventShape(value: unknown): value is WardFlowEvent {
  if (!isPlainObject(value)) return false;
  if (typeof value.type !== "string" || !Object.hasOwn(EVENT_ROLE, value.type)) return false;
  if (typeof value.role !== "string" || !Object.hasOwn(WARD_FLOW_ROLE_LABELS, value.role)) return false;
  return typeof value.now === "number" && Number.isFinite(value.now) && value.now >= 0 && value.now < 10_000_000;
}

export function isSharedEventId(value: unknown): value is string {
  return typeof value === "string" && EVENT_ID.test(value);
}

export function isSharedWorldId(value: unknown): value is string {
  return typeof value === "string" && WORLD_ID.test(value);
}

export function isSharedSeq(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
