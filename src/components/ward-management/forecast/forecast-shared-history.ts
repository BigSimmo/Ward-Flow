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

export type SharedForecastHistory =
  | { status: "local" }
  | { status: "loading" }
  | { status: "shared"; snapshots: ForecastHistoryEntry[]; reasons: ForecastMissReasonEntry[] };

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
  const value = reply as { shared?: unknown; generation?: unknown; snapshots?: unknown; reasons?: unknown };
  if (value.shared !== true || value.generation !== generation) return LOCAL;
  return {
    status: "shared",
    snapshots: parseForecastHistory(JSON.stringify(Array.isArray(value.snapshots) ? value.snapshots : [])),
    reasons: parseForecastMissReasons(JSON.stringify(Array.isArray(value.reasons) ? value.reasons : [])),
  };
}

// A save acknowledged in any view invalidates earlier reads in every view of this desk. This is
// only a local read fence; ordering writes from different devices needs a server history revision.
const saved = new WeakMap<ForecastHistoryCall, number>();
const saveVersion = (call: ForecastHistoryCall) => saved.get(call) ?? 0;
type PendingRead = { generation: number; version: number; promise: Promise<unknown> };

// The brief and the track record share a read only while it is from the same world and no save
// has since been acknowledged. An older read finishing cannot remove a newer world's read.
const reads = new WeakMap<ForecastHistoryCall, PendingRead>();
function readOnce(call: ForecastHistoryCall, generation: number): PendingRead {
  const version = saveVersion(call);
  const held = reads.get(call);
  if (held?.generation === generation && held.version === version) return held;
  const read: PendingRead = {
    generation,
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
  const call = useContext(SharedAccessContext)?.api.forecastHistory;
  // The reply held is for one call and world generation; anything else reads as still loading.
  const [held, setHeld] = useState<{ call: ForecastHistoryCall; generation: number; value: SharedForecastHistory }>();
  const state = !call ? LOCAL : held?.call === call && held.generation === generation ? held.value : LOADING;
  const lifetime = useRef<{ call: ForecastHistoryCall; generation: number; live: boolean } | null>(null);

  useEffect(() => {
    if (!call) return;
    const active = { call, generation, live: true };
    lifetime.current = active;
    const take = (value: SharedForecastHistory) => active.live && setHeld({ call, generation, value });
    // A failed first read falls back to the browser's copy; a failed later read keeps what is held.
    let read = false;
    const load = () => {
      const pending = readOnce(call, generation);
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
      const detail = (event as CustomEvent<{ call: ForecastHistoryCall; generation: number; reply: unknown }>).detail;
      if (detail?.call !== call || detail.generation !== generation) return;
      const value = sharedForecastReply(detail.reply, generation);
      if (value.status !== "shared") return;
      read = true;
      take(value);
    };
    window.addEventListener(SHARED_EVENT, onShared);
    return () => {
      active.live = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onShown);
      window.removeEventListener(SHARED_EVENT, onShared);
    };
  }, [call, generation]);

  const send = useCallback(
    async (body: { snapshot: ForecastHistoryEntry } | { reason: ForecastMissReasonEntry }): Promise<boolean> => {
      const active = lifetime.current;
      if (!call || !active?.live || active.call !== call || active.generation !== generation) return false;
      try {
        const reply = await call({ generation, ...body });
        if (!active.live || lifetime.current !== active || sharedForecastReply(reply, generation).status !== "shared")
          return false;
        saved.set(call, saveVersion(call) + 1);
        window.dispatchEvent(new CustomEvent(SHARED_EVENT, { detail: { call, generation, reply } }));
        return true;
      } catch {
        return false;
      }
    },
    [call, generation],
  );

  return { state, send };
}
