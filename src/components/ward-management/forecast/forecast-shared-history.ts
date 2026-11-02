// src/components/ward-management/forecast/forecast-shared-history.ts
//
// SHARED FORECAST HISTORY (proposal 013, migration 16; forecast integration, Josh, 27 Oct 2026). In
// the signed-in shared workspace the daily snapshots and the miss reasons live on the server, per
// desk (role and place) and world generation, so every device and colleague at the desk sees one
// track record. Until the server has migration 16, in the local demo, or when a read fails, the
// browser's own history (use-forecast-model.ts) is used exactly as before.
//
// 🔒 **COUNTS AND CLOSED-LIST VALUES ONLY.** A snapshot is a day, a time and four counts; a reason is
// a day, a list value, a role and a time. Nothing about a patient and no typed text is sent.
"use client";

import { useCallback, useContext, useEffect, useRef, useState } from "react";

import {
  SharedAccessContext,
  type SharedAccessApi,
} from "@/components/ward-management/shell/ward-shared-access-context";

import { parseForecastHistory, type ForecastHistoryEntry } from "./forecast-history";
import { parseForecastMissReasons, type ForecastMissReasonEntry } from "./forecast-miss-reasons";
import {
  forecastOperationId,
  forecastSharedMetadata,
  forecastVersion,
  type ForecastSharedMetadata,
  type ForecastWriteInput,
  type ForecastWriteResult,
} from "./forecast-shared-types";

export type SharedForecastHistory =
  | { status: "local" }
  | { status: "loading" }
  | ({
      status: "shared";
      snapshots: ForecastHistoryEntry[];
      reasons: ForecastMissReasonEntry[];
    } & ForecastSharedMetadata);

type ForecastHistoryCall = NonNullable<SharedAccessApi["forecastHistory"]>;

const LOCAL: SharedForecastHistory = { status: "local" };
const LOADING: SharedForecastHistory = { status: "loading" };
const SHARED_EVENT = "ward-flow-forecast-shared-history";
/**
 * Forecast history has its own endpoint and is not embedded in the board payload. An open view
 * reads it again this often, and whenever it is shown again.
 */
const READ_EVERY_MS = 120_000;

/** The server's reply, kept only when it is shared and counted in the same world generation. */
export function sharedForecastReply(reply: unknown, generation: number): SharedForecastHistory {
  if (typeof reply !== "object" || reply === null) return LOCAL;
  const value = reply as { shared?: unknown; generation?: unknown; snapshots?: unknown; reasons?: unknown };
  if (value.shared !== true || value.generation !== generation) return LOCAL;
  return {
    status: "shared",
    snapshots: parseForecastHistory(JSON.stringify(Array.isArray(value.snapshots) ? value.snapshots : [])),
    reasons: parseForecastMissReasons(JSON.stringify(Array.isArray(value.reasons) ? value.reasons : [])),
    ...forecastSharedMetadata(value),
  };
}

// Read and write replies both carry an atomic server history revision. All mounted views of a
// desk keep its newest version, including when an older write acknowledgement arrives last.
const latest = new WeakMap<
  ForecastHistoryCall,
  { generation: number; binding: string; value: SharedForecastHistory }
>();
function newest(
  call: ForecastHistoryCall,
  generation: number,
  binding: string,
  value: SharedForecastHistory,
  source: "read" | "write",
): SharedForecastHistory {
  const previous = latest.get(call);
  const held = previous?.generation === generation && previous.binding === binding ? previous.value : undefined;
  if (source === "write" && held?.status === "shared" && value.status === "shared" && held.scopeKey !== value.scopeKey)
    return held;
  if (held?.status === "shared" && held.historyRevision !== null) {
    if (value.status !== "shared") return held;
    if (value.historyRevision === null || value.historyRevision < held.historyRevision) return held;
  }
  if (value.status === "shared") latest.set(call, { generation, binding, value });
  return value;
}

// A save answered in any view also invalidates earlier reads from legacy servers.
const saved = new WeakMap<ForecastHistoryCall, number>();
const saveVersion = (call: ForecastHistoryCall) => saved.get(call) ?? 0;
type PendingRead = { generation: number; binding: string; version: number; promise: Promise<unknown> };

// The brief and the track record share a read only while it is from the same world and no save
// has since been acknowledged. An older read finishing cannot remove a newer world's read.
const reads = new WeakMap<ForecastHistoryCall, PendingRead>();
function readOnce(call: ForecastHistoryCall, generation: number, binding: string): PendingRead {
  const version = saveVersion(call);
  const held = reads.get(call);
  if (held?.generation === generation && held.binding === binding && held.version === version) return held;
  const read: PendingRead = {
    generation,
    binding,
    version,
    promise: call().finally(() => {
      if (reads.get(call) === read) reads.delete(call);
    }),
  };
  reads.set(call, read);
  return read;
}

/**
 * This desk's shared forecast history, and `send` to record today's snapshot or a day's reason.
 * `send` answers false when the history is not shared, so the caller keeps the browser's copy.
 */
export function useSharedForecastHistory(generation: number) {
  const account = useContext(SharedAccessContext);
  const call = account?.api.forecastHistory;
  const binding = JSON.stringify([account?.actorId ?? null, account?.accessContext ?? null]);
  // The reply held is for one call and world generation; anything else reads as still loading.
  const [held, setHeld] = useState<{
    call: ForecastHistoryCall;
    generation: number;
    binding: string;
    value: SharedForecastHistory;
  }>();
  const state = !call
    ? LOCAL
    : held?.call === call && held.generation === generation && held.binding === binding
      ? held.value
      : LOADING;
  const lifetime = useRef<{ call: ForecastHistoryCall; generation: number; binding: string; live: boolean } | null>(
    null,
  );

  useEffect(() => {
    if (!call) return;
    const active = { call, generation, binding, live: true };
    lifetime.current = active;
    const take = (value: SharedForecastHistory, source: "read" | "write" = "read") =>
      active.live && setHeld({ call, generation, binding, value: newest(call, generation, binding, value, source) });
    // A failed first read falls back to the browser's copy; a failed later read keeps what is held.
    let read = false;
    const load = () => {
      const pending = readOnce(call, generation, binding);
      const current = () => active.live && pending.version === saveVersion(call);
      return pending.promise.then(
        (reply) => {
          if (!current()) return;
          read = true;
          take(sharedForecastReply(reply, generation));
        },
        () => {
          if (current() && !read) take(LOCAL);
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
        event as CustomEvent<{ call: ForecastHistoryCall; generation: number; binding: string; reply: unknown }>
      ).detail;
      if (detail?.call !== call || detail.generation !== generation || detail.binding !== binding) return;
      const value = sharedForecastReply(detail.reply, generation);
      if (value.status !== "shared") return;
      read = true;
      take(value, "write");
    };
    window.addEventListener(SHARED_EVENT, onShared);
    return () => {
      active.live = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onShown);
      window.removeEventListener(SHARED_EVENT, onShared);
    };
  }, [call, generation, binding]);

  const write = useCallback(
    async (body: ForecastWriteInput): Promise<ForecastWriteResult> => {
      const active = lifetime.current;
      if (
        !call ||
        !active?.live ||
        active.call !== call ||
        active.generation !== generation ||
        active.binding !== binding
      )
        return { status: "cancelled" };
      if (state.status !== "shared" || !state.writable) return { status: "unavailable" };
      try {
        const reply = await call({ generation, ...body });
        if (!active.live || lifetime.current !== active) return { status: "cancelled" };
        const value = sharedForecastReply(reply, generation);
        if (value.status !== "shared") return { status: "failed" };
        if (value.scopeKey !== body.scopeKey) return { status: "cancelled" };
        const observed = latest.get(call);
        const current =
          observed?.generation === generation && observed.binding === binding && observed.value.status === "shared"
            ? observed.value
            : null;
        const older =
          current?.historyRevision !== null &&
          current?.historyRevision !== undefined &&
          value.historyRevision !== null &&
          value.historyRevision < current.historyRevision;
        if ((!current || current.scopeKey === value.scopeKey) && !older) {
          saved.set(call, saveVersion(call) + 1);
          window.dispatchEvent(new CustomEvent(SHARED_EVENT, { detail: { call, generation, binding, reply } }));
        }
        const receipt = reply as {
          operationId?: unknown;
          outcome?: unknown;
          commandRevision?: unknown;
          code?: unknown;
        };
        if (!value.writable || receipt.code === "forecast-upgrade-required") return { status: "unavailable" };
        if (receipt.operationId !== body.operationId) return { status: "failed" };
        if (receipt.outcome === "conflict") return { status: "conflict" };
        return {
          status:
            receipt.outcome === "accepted" &&
            forecastVersion(receipt.commandRevision) &&
            receipt.commandRevision > 0 &&
            value.historyRevision !== null &&
            receipt.commandRevision <= value.historyRevision
              ? "accepted"
              : "failed",
        };
      } catch {
        return { status: "failed" };
      }
    },
    [call, generation, binding, state],
  );
  const send = useCallback(
    async (body: { snapshot: ForecastHistoryEntry } | { reason: ForecastMissReasonEntry }): Promise<boolean> => {
      try {
        if (state.status !== "shared" || !state.scopeKey) return false;
        const input =
          "reason" in body
            ? {
                ...body,
                scopeKey: state.scopeKey,
                operationId: forecastOperationId(),
                expectedDayVersion: state.reasonVersions[body.reason.day] ?? 0,
              }
            : { ...body, scopeKey: state.scopeKey, operationId: forecastOperationId() };
        return (await write(input)).status === "accepted";
      } catch {
        return false;
      }
    },
    [state, write],
  );

  return { state, send, write };
}
