import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { WARD_FLOW_STORED_STATE_VERSION } from "@/components/ward-management/ward-flow-storage-validation";
import { activateScenarioNetwork } from "@/components/ward-management/ward-scenarios";
import {
  applySharedEvent,
  isSharedEventId,
  isSharedEventShape,
  isSharedSeq,
  isSharedWorldId,
  SHARED_EVENTS_PAGE_LIMIT,
  sharedEventCarriesTypedText,
  type SharedEventsResponse,
  type SharedJoinResponse,
} from "@/components/ward-management/shared/ward-flow-shared-core";

import type { SharedStateStore, SharedWorldRow } from "./store";

/**
 * The shared world's rules (feature 3). One append-only event log per world, sequence numbers from
 * 1, and the reducer as the only judge of an event: the service keeps its own copy of the world,
 * applies a posted event to it, and stores the event only when the reducer accepts it at exactly the
 * next sequence number. Anything else is a conflict the browser resolves by catching up.
 */

/** A browser's day 0 must be close to the server's clock: local midnight today, give or take zones. */
const DAY_ZERO_PAST_LIMIT_MS = 38 * 60 * 60 * 1000;
const DAY_ZERO_FUTURE_LIMIT_MS = 15 * 60 * 60 * 1000;
/** A later day 0 starts a new world only when it is clearly a new day, not another time zone. */
const NEW_DAY_THRESHOLD_MS = 20 * 60 * 60 * 1000;
const DEFAULT_CHECKPOINT_EVERY = 200;

export type SharedServiceOptions = {
  store: SharedStateStore;
  /** Server wall clock in ms. Injected for tests. */
  nowMs?: () => number;
  /** Random world id. Injected for tests. */
  newWorldId?: () => string;
  typedTextAllowed?: boolean;
  checkpointEvery?: number;
  /** Stored-state version this build reads and writes. Injected for tests. */
  stateVersion?: number;
};

export type JoinResult =
  { kind: "ok"; body: SharedJoinResponse } | { kind: "bad-request" } | { kind: "version-mismatch" };

export type EventsResult = { kind: "ok"; body: SharedEventsResponse } | { kind: "bad-request" };

export type AppendResult =
  | { kind: "accepted"; seq: number; duplicate: boolean }
  | { kind: "conflict"; headSeq: number }
  | { kind: "refused" }
  | { kind: "typed-text-not-shared" }
  | { kind: "world-replaced"; currentWorldId: string | null }
  | { kind: "bad-request" };

type CachedWorld = { worldId: string; seq: number; state: WardFlowState };

/** A single-slot queue: one append or catch-up at a time in this process. The database key
 *  (world_id, seq) is what keeps two server instances honest; this only avoids wasted work. */
function createMutex() {
  let tail: Promise<unknown> = Promise.resolve();
  return function run<T>(work: () => Promise<T>): Promise<T> {
    const result = tail.then(work, work);
    tail = result.catch(() => undefined);
    return result;
  };
}

function freshSeed(): WardFlowState {
  // The same first-render world every browser paints before it joins: offset zero, standard night.
  activateScenarioNetwork("standard");
  return seedWardFlowStateAt(0);
}

export function createSharedWorldService(options: SharedServiceOptions) {
  const store = options.store;
  const nowMs = options.nowMs ?? (() => Date.now());
  const newWorldId = options.newWorldId ?? (() => crypto.randomUUID());
  const typedTextAllowed = options.typedTextAllowed === true;
  const checkpointEvery = options.checkpointEvery ?? DEFAULT_CHECKPOINT_EVERY;
  const stateVersion = options.stateVersion ?? WARD_FLOW_STORED_STATE_VERSION;
  const exclusive = createMutex();
  let cache: CachedWorld | null = null;
  let migrated: Promise<void> | null = null;

  function ready(): Promise<void> {
    if (!migrated) {
      migrated = store.migrate().catch((error: unknown) => {
        migrated = null; // let the next request try again
        throw error;
      });
    }
    return migrated;
  }

  /** Brings the cached world to the log's head: from the cache if it is this world, otherwise from
   *  the latest checkpoint. Call only inside `exclusive`. */
  async function catchUp(world: SharedWorldRow): Promise<CachedWorld> {
    let current: CachedWorld | null = cache?.worldId === world.worldId ? cache : null;
    if (!current) {
      const checkpoint = await store.latestCheckpoint(world.worldId);
      if (!checkpoint || checkpoint.stateVersion !== stateVersion)
        throw new Error("Shared world has no usable checkpoint");
      current = { worldId: world.worldId, seq: checkpoint.seq, state: checkpoint.state };
    }
    for (;;) {
      const page = await store.eventsAfter(world.worldId, current.seq, SHARED_EVENTS_PAGE_LIMIT);
      for (const record of page) {
        // Stored events were accepted when they were appended. A refusal on replay would mean the
        // reducer changed under a running world; the event is skipped, never re-judged into the log.
        const { next, accepted } = applySharedEvent(current.state, record.event);
        current = { worldId: world.worldId, seq: record.seq, state: accepted ? next : current.state };
      }
      if (page.length < SHARED_EVENTS_PAGE_LIMIT) break;
    }
    cache = current;
    return current;
  }

  async function join(input: { dayZeroMs: unknown; stateVersion: unknown }): Promise<JoinResult> {
    if (typeof input.dayZeroMs !== "number" || !Number.isSafeInteger(input.dayZeroMs)) return { kind: "bad-request" };
    if (input.stateVersion !== stateVersion) return { kind: "version-mismatch" };
    const dayZeroMs = input.dayZeroMs;
    const serverNow = nowMs();
    if (dayZeroMs < serverNow - DAY_ZERO_PAST_LIMIT_MS || dayZeroMs > serverNow + DAY_ZERO_FUTURE_LIMIT_MS)
      return { kind: "bad-request" };
    await ready();
    return exclusive(async () => {
      let world = await store.currentWorld(stateVersion);
      if (!world || dayZeroMs >= world.dayZeroMs + NEW_DAY_THRESHOLD_MS) {
        world = await store.createWorld(
          { worldId: newWorldId(), stateVersion, dayZeroMs, startedAtMs: serverNow },
          freshSeed(),
        );
      }
      const head = await catchUp(world);
      return {
        kind: "ok",
        body: {
          worldId: world.worldId,
          seq: head.seq,
          state: head.state,
          dayZeroMs: world.dayZeroMs,
          startedAtMs: world.startedAtMs,
          serverNowMs: nowMs(),
          typedTextAllowed,
        },
      };
    });
  }

  async function eventsAfter(input: { worldId: unknown; after: unknown }): Promise<EventsResult> {
    if (!isSharedWorldId(input.worldId) || !isSharedSeq(input.after)) return { kind: "bad-request" };
    await ready();
    const current = await store.currentWorld(stateVersion);
    const events =
      current?.worldId === input.worldId
        ? await store.eventsAfter(input.worldId, input.after, SHARED_EVENTS_PAGE_LIMIT + 1)
        : [];
    const truncated = events.length > SHARED_EVENTS_PAGE_LIMIT;
    const page = truncated ? events.slice(0, SHARED_EVENTS_PAGE_LIMIT) : events;
    const headSeq = current ? await store.headSeq(current.worldId) : 0;
    return { kind: "ok", body: { currentWorldId: current?.worldId ?? null, headSeq, events: page, truncated } };
  }

  async function append(input: {
    worldId: unknown;
    baseSeq: unknown;
    eventId: unknown;
    event: unknown;
  }): Promise<AppendResult> {
    const { worldId, baseSeq, eventId, event } = input;
    if (!isSharedWorldId(worldId) || !isSharedSeq(baseSeq) || !isSharedEventId(eventId) || !isSharedEventShape(event))
      return { kind: "bad-request" };
    const typedText = sharedEventCarriesTypedText(event.type);
    if (typedText && !typedTextAllowed) return { kind: "typed-text-not-shared" };
    await ready();
    return exclusive(async (): Promise<AppendResult> => {
      const current = await store.currentWorld(stateVersion);
      if (current?.worldId !== worldId) return { kind: "world-replaced", currentWorldId: current?.worldId ?? null };
      // A retry of an event already stored (its response was lost) returns its sequence again.
      const stored = await store.findEventSeq(worldId, eventId);
      if (stored !== null) return { kind: "accepted", seq: stored, duplicate: true };
      const head = await catchUp(current);
      if (baseSeq !== head.seq) return { kind: "conflict", headSeq: head.seq };
      let outcome: { next: WardFlowState; accepted: boolean };
      try {
        outcome = applySharedEvent(head.state, event);
      } catch {
        // A payload the reducer cannot read is refused like any other invalid event.
        return { kind: "refused" };
      }
      if (!outcome.accepted) return { kind: "refused" };
      const seq = head.seq + 1;
      const written = await store.appendEvent(worldId, { seq, eventId, event, typedText });
      if (written === "duplicate-event") {
        const again = await store.findEventSeq(worldId, eventId);
        return again === null
          ? { kind: "conflict", headSeq: head.seq }
          : { kind: "accepted", seq: again, duplicate: true };
      }
      if (written === "seq-taken") {
        // Another server instance appended first. Drop the cache so the next call reads the log.
        cache = null;
        return { kind: "conflict", headSeq: await store.headSeq(worldId) };
      }
      cache = { worldId, seq, state: outcome.next };
      if (seq % checkpointEvery === 0) {
        await store.putCheckpoint(worldId, { seq, stateVersion, state: outcome.next });
      }
      return { kind: "accepted", seq, duplicate: false };
    });
  }

  return { join, eventsAfter, append, typedTextAllowed };
}

export type SharedWorldService = ReturnType<typeof createSharedWorldService>;

/** Exported for tests: how far apart two days must be before a later browser starts a new world. */
export const SHARED_NEW_DAY_THRESHOLD_MS = NEW_DAY_THRESHOLD_MS;
