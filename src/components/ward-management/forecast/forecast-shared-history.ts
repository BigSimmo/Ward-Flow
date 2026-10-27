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

import { useCallback, useContext, useEffect, useState } from "react";

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

// The brief and the track record both read the history; a read already in flight is shared.
const reads = new WeakMap<ForecastHistoryCall, Promise<unknown>>();
function readOnce(call: ForecastHistoryCall): Promise<unknown> {
  const held = reads.get(call);
  if (held) return held;
  const read = call().finally(() => reads.delete(call));
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

  useEffect(() => {
    if (!call) return;
    let live = true;
    const take = (value: SharedForecastHistory) => live && setHeld({ call, generation, value });
    readOnce(call).then(
      (reply) => take(sharedForecastReply(reply, generation)),
      () => take(LOCAL),
    );
    // Another view recorded something: take the history it was answered with.
    const onShared = (event: Event) => {
      const detail = (event as CustomEvent<{ call: ForecastHistoryCall; reply: unknown }>).detail;
      if (detail?.call === call) take(sharedForecastReply(detail.reply, generation));
    };
    window.addEventListener(SHARED_EVENT, onShared);
    return () => {
      live = false;
      window.removeEventListener(SHARED_EVENT, onShared);
    };
  }, [call, generation]);

  const send = useCallback(
    async (body: { snapshot: ForecastHistoryEntry } | { reason: ForecastMissReasonEntry }): Promise<boolean> => {
      if (!call) return false;
      try {
        const reply = await call({ generation, ...body });
        window.dispatchEvent(new CustomEvent(SHARED_EVENT, { detail: { call, reply } }));
        return sharedForecastReply(reply, generation).status === "shared";
      } catch {
        return false;
      }
    },
    [call, generation],
  );

  return { state, send };
}
