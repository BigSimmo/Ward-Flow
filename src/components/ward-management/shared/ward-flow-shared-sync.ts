import type { WardFlowEvent } from "../ward-flow-events";
import type { WardFlowState } from "../ward-flow-reducer";
import {
  applySharedEvent,
  sharedEventCarriesTypedText,
  type SharedEventRecord,
  type SharedJoinResponse,
} from "./ward-flow-shared-core";

/**
 * The browser half of feature 3, as pure functions over plain data so it is tested without React
 * or a network. The provider stores a `SharedSync` beside its world and calls these from its own
 * reducer; the sync hook calls the network and feeds the answers back in.
 *
 * The model: `confirmed` is the server's world at `confirmedSeq`. `pending` holds this browser's
 * accepted events that the server has not confirmed yet, oldest first. What the screens show is
 * always `confirmed` with `pending` replayed on top, plus this browser's own refusals (refusals are
 * never sent, so other people never see them).
 */

export type SharedPending = { eventId: string; event: WardFlowEvent };

/** Why this browser stopped sharing and works on its own copy until reload. */
export type SharedDetachReason =
  /** A typed-text event was dispatched; typed text stays on this device (mirrors D-18). */
  | "typed-text"
  /** A demo scenario file replaced the world. */
  | "scenario-file"
  /** The server is running a newer build. */
  | "reload-required";

export type SharedStatus =
  /** Waiting for the first join answer. */
  | "joining"
  /** The server wants the access code before it shares the board. */
  | "locked"
  /** Shared mode is on but the board could not be reached or set up. */
  | "unavailable"
  | "live"
  | "detached";

export type SharedSync = {
  status: SharedStatus;
  detachedReason?: SharedDetachReason;
  /** Random per page load. Event ids are `${clientId}-${counter}`, the server's idempotency key. */
  clientId: string;
  nextLocal: number;
  worldId?: string;
  confirmedSeq: number;
  confirmed?: WardFlowState;
  pending: readonly SharedPending[];
  typedTextAllowed: boolean;
  /** Day 0 of the shared world (ms). Every browser on the board counts instants from it. */
  dayZeroMs?: number;
  /** How many times a shared world has been adopted; the screens remount on each. */
  adoptions: number;
  /** Shown once by the status line, then cleared by the next successful sync. */
  notice?: "refused-by-board" | "new-world";
};

export function initialSharedSync(clientId: string): SharedSync {
  return {
    status: "joining",
    clientId,
    nextLocal: 0,
    confirmedSeq: 0,
    pending: [],
    typedTextAllowed: false,
    adoptions: 0,
  };
}

/**
 * After the provider applied a local event: queue it for the server if the reducer accepted it.
 * A refused event stays local (its refusal shows on this screen only). A typed-text event detaches
 * this browser unless the server allows typed text.
 */
export function recordLocalDispatch(sync: SharedSync, event: WardFlowEvent, accepted: boolean): SharedSync {
  if (sync.status !== "live") return sync;
  if (sharedEventCarriesTypedText(event.type) && !sync.typedTextAllowed) return detachShared(sync, "typed-text");
  if (!accepted) return sync;
  const eventId = `${sync.clientId}-${sync.nextLocal}`;
  return { ...sync, nextLocal: sync.nextLocal + 1, pending: [...sync.pending, { eventId, event }] };
}

export function detachShared(sync: SharedSync, reason: SharedDetachReason): SharedSync {
  return { ...sync, status: "detached", detachedReason: reason, pending: [], confirmed: undefined };
}

/** Replays this browser's pending events on a confirmed world, keeping its own refusal list. A
 *  pending event the reducer now refuses is dropped; its refusal is what the person sees. */
function rebuild(
  confirmed: WardFlowState,
  pending: readonly SharedPending[],
  rejections: WardFlowState["rejections"],
): { world: WardFlowState; kept: SharedPending[] } {
  let world: WardFlowState = { ...confirmed, rejections };
  const kept: SharedPending[] = [];
  for (const entry of pending) {
    const { next, accepted } = applySharedEvent(world, entry.event);
    world = next;
    if (accepted) kept.push(entry);
  }
  return { world, kept };
}

/** Adopts a joined world. Anything queued before joining is replayed by the caller afterwards. */
export function adoptSharedWorld(
  sync: SharedSync,
  join: SharedJoinResponse,
): { sync: SharedSync; world: WardFlowState } {
  const world: WardFlowState = { ...join.state, rejections: [] };
  return {
    sync: {
      ...sync,
      status: "live",
      detachedReason: undefined,
      worldId: join.worldId,
      confirmedSeq: join.seq,
      confirmed: world,
      pending: [],
      typedTextAllowed: join.typedTextAllowed,
      dayZeroMs: join.dayZeroMs,
      adoptions: sync.adoptions + 1,
      notice: sync.adoptions > 0 ? "new-world" : undefined,
    },
    world,
  };
}

/**
 * The server stored the oldest pending event at `seq`. Returns null when that does not line up
 * with what this browser holds, which means it must join again rather than guess.
 */
export function confirmPendingHead(
  sync: SharedSync,
  displayed: WardFlowState,
  eventId: string,
  seq: number,
): { sync: SharedSync; world: WardFlowState } | null {
  const head = sync.pending[0];
  if (sync.status !== "live" || !sync.confirmed || !head || head.eventId !== eventId) return null;
  if (seq !== sync.confirmedSeq + 1) return null;
  const { next, accepted } = applySharedEvent(sync.confirmed, head.event);
  if (!accepted) return null;
  const rest = sync.pending.slice(1);
  const { world, kept } = rebuild(next, rest, displayed.rejections);
  return { sync: { ...sync, confirmed: next, confirmedSeq: seq, pending: kept, notice: undefined }, world };
}

/**
 * Other people's events (or this browser's own, already stored) arrived: apply them to the
 * confirmed world in order, drop any pending event the server already holds, and replay the rest.
 * Returns null when the events do not continue from `confirmedSeq` or this browser's reducer
 * refuses one the server accepted; either means join again.
 */
export function applyRemoteEvents(
  sync: SharedSync,
  displayed: WardFlowState,
  records: readonly SharedEventRecord[],
): { sync: SharedSync; world: WardFlowState; changed: boolean } | null {
  if (sync.status !== "live" || !sync.confirmed) return null;
  if (records.length === 0) return { sync, world: displayed, changed: false };
  let confirmed = sync.confirmed;
  let seq = sync.confirmedSeq;
  for (const record of records) {
    if (record.seq !== seq + 1) return null;
    const { next, accepted } = applySharedEvent(confirmed, record.event);
    if (!accepted) return null;
    confirmed = next;
    seq = record.seq;
  }
  const stored = new Set(records.map((record) => record.eventId));
  const stillPending = sync.pending.filter((entry) => !stored.has(entry.eventId));
  const { world, kept } = rebuild(confirmed, stillPending, displayed.rejections);
  return { sync: { ...sync, confirmed, confirmedSeq: seq, pending: kept }, world, changed: true };
}

/** The server refused an event this browser accepted: the copies differ. Drop the pending queue
 *  so the next join starts clean, and say so once. */
export function markRefusedByBoard(sync: SharedSync): SharedSync {
  return { ...sync, status: "joining", pending: [], notice: "refused-by-board" };
}

/** What the status line and the context expose: no worlds, no events, no ids. */
export type SharedSyncView = {
  status: SharedStatus;
  detachedReason?: SharedDetachReason;
  pendingCount: number;
  notice?: SharedSync["notice"];
};

export function sharedSyncView(sync: SharedSync): SharedSyncView {
  return {
    status: sync.status,
    detachedReason: sync.detachedReason,
    pendingCount: sync.pending.length,
    notice: sync.notice,
  };
}
