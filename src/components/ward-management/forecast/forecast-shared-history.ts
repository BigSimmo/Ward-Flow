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

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

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

type HistoryRead = { promise: Promise<unknown>; version: number };
type HistoryChannel = {
  generation: number;
  users: number;
  version: number;
  read?: HistoryRead;
  value?: SharedForecastHistory;
};
type HistoryScope = { call: ForecastHistoryCall | undefined; generation: number };
type HistoryRun = { scope: HistoryScope; live: boolean; channel: HistoryChannel };

// The brief and track record share one in-flight read in the current call/world lifetime.
// Keep only one channel per call, and release it when its last view leaves.
const channels = new WeakMap<ForecastHistoryCall, HistoryChannel>();
function historyChannel(call: ForecastHistoryCall, generation: number): HistoryChannel {
  const held = channels.get(call);
  if (held?.generation === generation) return held;
  const channel = { generation, users: 0, version: 0 };
  channels.set(call, channel);
  return channel;
}
function readOnce(call: ForecastHistoryCall, channel: HistoryChannel): HistoryRead {
  if (channel.read) return channel.read;
  const promise = Promise.resolve()
    .then(() => call())
    .finally(() => {
      // A write may have invalidated this read and a later view started another one.
      if (channel.read?.promise === promise) channel.read = undefined;
    });
  const read = { promise, version: channel.version };
  channel.read = read;
  return read;
}

/**
 * This desk's shared forecast history, and `send` to record today's snapshot or a day's reason.
 * `send` confirms only a matching shared reply in this view's current lifetime; otherwise the
 * caller keeps the browser's copy. Leaving the view does not cancel a server write.
 */
export function useSharedForecastHistory(generation: number) {
  const call = useContext(SharedAccessContext)?.api.forecastHistory;
  // A → B → A is a new lifetime even when A reuses its call and generation.
  const scope = useMemo<HistoryScope>(() => ({ call, generation }), [call, generation]);
  const active = useRef<HistoryRun | undefined>(undefined);
  const [held, setHeld] = useState<{ scope: HistoryScope; value: SharedForecastHistory }>();
  const state = !call ? LOCAL : held?.scope === scope ? held.value : LOADING;

  useEffect(() => {
    if (!call) return;
    const channel = historyChannel(call, generation);
    const run = { scope, live: true, channel };
    active.current = run;
    channel.users++;
    const current = () => run.live && channels.get(call) === channel;
    const take = (value: SharedForecastHistory) => current() && setHeld({ scope, value });
    if (channel.value) take(channel.value);
    // A failed first read falls back to the browser's copy; a failed later read keeps what is held.
    let read = channel.value !== undefined;
    const load = () => {
      if (!current()) return;
      const pending = readOnce(call, channel);
      return pending.promise.then(
        (reply) => {
          if (!current() || pending.version !== channel.version) return;
          read = true;
          channel.value = sharedForecastReply(reply, generation);
          take(channel.value);
        },
        () => {
          if (current() && pending.version === channel.version && !read && !channel.value) take(LOCAL);
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
      const detail = (event as CustomEvent<{ call: ForecastHistoryCall; channel: HistoryChannel }>).detail;
      if (detail?.call === call && detail.channel === channel && channel.value?.status === "shared") {
        read = true;
        take(channel.value);
      }
    };
    window.addEventListener(SHARED_EVENT, onShared);
    return () => {
      run.live = false;
      if (active.current === run) active.current = undefined;
      if (--channel.users === 0 && channels.get(call) === channel) channels.delete(call);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onShown);
      window.removeEventListener(SHARED_EVENT, onShared);
    };
  }, [call, generation, scope]);

  const send = useCallback(
    async (body: { snapshot: ForecastHistoryEntry } | { reason: ForecastMissReasonEntry }): Promise<boolean> => {
      const run = active.current;
      if (!call || !run?.live || run.scope !== scope || channels.get(call) !== run.channel) return false;
      try {
        const reply = await call({ generation, ...body });
        // The initiating view may have left while another view still owns this same channel.
        if (channels.get(call) !== run.channel) return false;
        const value = sharedForecastReply(reply, generation);
        if (value.status !== "shared") return false;
        const channel = run.channel;
        channel.version++;
        channel.read = undefined;
        channel.value = value;
        window.dispatchEvent(new CustomEvent(SHARED_EVENT, { detail: { call, channel } }));
        return run.live;
      } catch {
        return false;
      }
    },
    [call, generation, scope],
  );

  return { state, send };
}
