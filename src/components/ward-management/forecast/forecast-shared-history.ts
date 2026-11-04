// src/components/ward-management/forecast/forecast-shared-history.ts
//
// SHARED FORECAST HISTORY (proposal 013, migration 16; forecast integration, Josh, 27 Oct 2026). In
// the signed-in shared workspace the daily snapshots and the miss reasons live on the server, per
// desk (role and place) and world generation, so every device and colleague at the desk sees one
// track record. Snapshots retain their browser fallback before migration 16 or on a failed read.
// Shared reason edits additionally require the server's versioned-write capability; they never
// downgrade to unprotected writes or a browser copy presented as shared confirmation.
//
// 🔒 **COUNTS AND CLOSED-LIST VALUES ONLY.** A snapshot is a day, a time and four counts; a reason is
// a day, a list value, a role and a time. Nothing about a patient and no typed text is sent.
"use client";

import { useCallback, useContext, useEffect, useRef, useState } from "react";

import {
  SharedAccessContext,
  type SharedAccessApi,
} from "@/components/ward-management/shell/ward-shared-access-context";

import { useEffectiveWardAccess } from "../shell/ward-access-store";
import { parseForecastHistory, type ForecastHistoryEntry } from "./forecast-history";
import { parseForecastMissReasons, type ForecastMissReasonEntry } from "./forecast-miss-reasons";

export type SharedForecastHistory =
  | { status: "local" }
  | { status: "loading" }
  | {
      status: "shared";
      snapshots: ForecastHistoryEntry[];
      reasons: ForecastMissReasonEntry[];
      reasonWriteVersion?: 1;
      reasonVersions?: Record<string, string>;
    };

export type ForecastReasonSaveOutcome =
  { status: "accepted" } | { status: "conflict" | "unavailable" | "uncertain"; message: string };
export type ForecastReasonRefreshOutcome =
  { status: "ready"; version: string | null } | { status: "unavailable"; message: string };

type ForecastHistoryCall = NonNullable<SharedAccessApi["forecastHistory"]>;

const LOCAL: SharedForecastHistory = { status: "local" };
const LOADING: SharedForecastHistory = { status: "loading" };
const SHARED_EVENT = "ward-flow-forecast-shared-history";
/**
 * Another device's snapshot or reason does not change the workspace revision, so the board's poll
 * never carries it. An open view reads the history again this often, and whenever it is shown again.
 */
const READ_EVERY_MS = 120_000;

/** The server's reply, kept only when it is shared and counted in the same world generation. */
export function sharedForecastReply(reply: unknown, generation: number): SharedForecastHistory {
  if (typeof reply !== "object" || reply === null) return LOCAL;
  const value = reply as {
    shared?: unknown;
    generation?: unknown;
    snapshots?: unknown;
    reasons?: unknown;
    reasonWriteVersion?: unknown;
  };
  if (value.shared !== true || value.generation !== generation) return LOCAL;
  const reasons: ForecastMissReasonEntry[] = [];
  const reasonVersions: Record<string, string> = {};
  let versioned = value.reasonWriteVersion === 1;
  for (const raw of Array.isArray(value.reasons) ? value.reasons : []) {
    if (typeof raw !== "object" || raw === null) continue;
    const { version, ...entry } = raw as Record<string, unknown>;
    const parsed = parseForecastMissReasons(JSON.stringify([entry]))[0];
    if (!parsed) continue;
    reasons.push(parsed);
    if (typeof version === "string" && version.length > 0 && version.length <= 100)
      reasonVersions[parsed.day] = version;
    else versioned = false;
  }
  return {
    status: "shared",
    snapshots: parseForecastHistory(JSON.stringify(Array.isArray(value.snapshots) ? value.snapshots : [])),
    reasons,
    ...(versioned ? { reasonWriteVersion: 1 as const, reasonVersions } : {}),
  };
}

// All consumers of one desk/world share a mutation fence, including explicit review reads.
const revisions = new WeakMap<ForecastHistoryCall, Map<string, number>>();
const reads = new WeakMap<ForecastHistoryCall, Map<string, { revision: number; promise: Promise<unknown> }>>();
function historyRevision(call: ForecastHistoryCall, identity: string): number {
  return revisions.get(call)?.get(identity) ?? 0;
}
function advanceHistory(call: ForecastHistoryCall, identity: string): number {
  const revision = historyRevision(call, identity) + 1;
  const held = revisions.get(call) ?? new Map<string, number>();
  held.set(identity, revision);
  revisions.set(call, held);
  reads.get(call)?.delete(identity);
  return revision;
}
function readOnce(call: ForecastHistoryCall, identity: string): Promise<unknown> {
  const revision = historyRevision(call, identity);
  const cache = reads.get(call) ?? new Map<string, { revision: number; promise: Promise<unknown> }>();
  const held = cache.get(identity);
  if (held?.revision === revision) return held.promise;
  const promise = call().finally(() => {
    if (cache.get(identity)?.promise === promise) cache.delete(identity);
  });
  cache.set(identity, { revision, promise });
  reads.set(call, cache);
  return promise;
}
function publishHistory(
  call: ForecastHistoryCall,
  generation: number,
  scopeKey: string,
  reply: unknown,
  revision: number,
) {
  window.dispatchEvent(new CustomEvent(SHARED_EVENT, { detail: { call, generation, scopeKey, reply, revision } }));
}

/**
 * This desk's shared forecast history, and `send` to record today's snapshot or a day's reason.
 * `send` answers false when the history is not shared, so the caller keeps the browser's copy.
 */
export function useSharedForecastHistory(generation: number) {
  const account = useContext(SharedAccessContext);
  const call = account?.api.forecastHistory;
  const access = useEffectiveWardAccess();
  const scopeKey = JSON.stringify([account?.actorId, access.role, access.scope]);
  const identity = JSON.stringify([generation, scopeKey]);
  const owner = useRef<{ call: typeof call; generation: number; scopeKey: string } | null>({
    call,
    generation,
    scopeKey,
  });
  useEffect(() => {
    owner.current = { call, generation, scopeKey };
    return () => {
      owner.current = null;
    };
  }, [call, generation, scopeKey]);
  const isCurrent = useCallback(
    () =>
      owner.current?.call === call && owner.current?.generation === generation && owner.current?.scopeKey === scopeKey,
    [call, generation, scopeKey],
  );
  // The reply held is for one call and world generation; anything else reads as still loading.
  const [held, setHeld] = useState<{
    call: ForecastHistoryCall;
    generation: number;
    scopeKey: string;
    value: SharedForecastHistory;
  }>();
  const state = !call
    ? LOCAL
    : held?.call === call && held.generation === generation && held.scopeKey === scopeKey
      ? held.value
      : LOADING;

  useEffect(() => {
    if (!call) return;
    let live = true;
    const take = (value: SharedForecastHistory) => live && setHeld({ call, generation, scopeKey, value });
    // A failed first read falls back to the browser's copy; a failed later read keeps what is held.
    let read = false;
    const load = () => {
      const startedVersion = historyRevision(call, identity);
      return readOnce(call, identity).then(
        (reply) => {
          if (startedVersion !== historyRevision(call, identity)) return;
          read = true;
          take(sharedForecastReply(reply, generation));
        },
        () => {
          if (!read && startedVersion === historyRevision(call, identity)) take(LOCAL);
        },
      );
    };
    void load();
    const timer = window.setInterval(load, READ_EVERY_MS);
    const onShown = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onShown);
    // Another view recorded something: take the history it was answered with.
    const onShared = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          call: ForecastHistoryCall;
          generation: number;
          scopeKey: string;
          reply: unknown;
          revision: number;
        }>
      ).detail;
      // A reply from an earlier world generation is not this history.
      if (
        detail?.call === call &&
        detail.generation === generation &&
        detail.scopeKey === scopeKey &&
        detail.revision === historyRevision(call, identity)
      ) {
        read = true;
        take(sharedForecastReply(detail.reply, generation));
      }
    };
    window.addEventListener(SHARED_EVENT, onShared);
    return () => {
      live = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onShown);
      window.removeEventListener(SHARED_EVENT, onShared);
    };
  }, [call, generation, scopeKey, identity]);

  const refresh = useCallback(async (): Promise<SharedForecastHistory> => {
    if (!call) return LOCAL;
    const startedRevision = historyRevision(call, identity);
    try {
      const reply = await readOnce(call, identity);
      if (!isCurrent() || startedRevision !== historyRevision(call, identity)) return LOADING;
      const current = sharedForecastReply(reply, generation);
      publishHistory(call, generation, scopeKey, reply, startedRevision);
      return current;
    } catch {
      return LOADING;
    }
  }, [call, generation, scopeKey, identity, isCurrent]);

  const send = useCallback(
    async (body: { snapshot: ForecastHistoryEntry }): Promise<boolean> => {
      if (!call) return false;
      const startedRevision = historyRevision(call, identity);
      try {
        const reply = await call({ generation, ...body });
        if (!isCurrent()) return false;
        const saved = sharedForecastReply(reply, generation).status === "shared";
        if (!saved) return false;
        const canAdopt = startedRevision === historyRevision(call, identity);
        const revision = advanceHistory(call, identity);
        if (canAdopt) publishHistory(call, generation, scopeKey, reply, revision);
        else void refresh();
        return true;
      } catch {
        return false;
      }
    },
    [call, generation, scopeKey, identity, isCurrent, refresh],
  );

  const sendReason = useCallback(
    async (reason: ForecastMissReasonEntry, expectedVersion: string | null): Promise<ForecastReasonSaveOutcome> => {
      if (!call || !isCurrent() || state.status !== "shared" || state.reasonWriteVersion !== 1)
        return { status: "unavailable", message: "Read the latest forecast record before recording a reason." };
      const startedRevision = historyRevision(call, identity);
      const takeMutation = (reply: unknown) => {
        const canAdopt = startedRevision === historyRevision(call, identity);
        const revision = advanceHistory(call, identity);
        if (canAdopt) publishHistory(call, generation, scopeKey, reply, revision);
        else void refresh();
      };
      try {
        const reply = await call({ generation, reason, expectedVersion });
        if (!isCurrent())
          return { status: "unavailable", message: "The working view changed. Open the forecast record again." };
        const saved = sharedForecastReply(reply, generation);
        if (saved.status !== "shared" || saved.reasonWriteVersion !== 1)
          return {
            status: "unavailable",
            message: "This shared workspace does not support protected reason edits yet.",
          };
        takeMutation(reply);
        return { status: "accepted" };
      } catch (error) {
        if (!isCurrent())
          return { status: "unavailable", message: "The working view changed. Open the forecast record again." };
        const failure = error as { code?: unknown; history?: unknown };
        if (failure?.code === "reason-conflict") {
          if (sharedForecastReply(failure.history, generation).status === "shared") takeMutation(failure.history);
          return {
            status: "conflict",
            message: "A colleague changed this reason. Review the latest record before recording again.",
          };
        }
        if (failure?.code === "world-changed" || failure?.code === "reason-basis-required")
          return {
            status: "unavailable",
            message: "The record changed. Read the latest forecast record before recording again.",
          };
        return {
          status: "uncertain",
          message: "This reason is not confirmed saved. Read the latest record before trying again.",
        };
      }
    },
    [call, generation, scopeKey, identity, isCurrent, state, refresh],
  );

  return { state, send, sendReason, refresh };
}
