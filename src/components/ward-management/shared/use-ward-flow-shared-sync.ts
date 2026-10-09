"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { absoluteWallClockMinutes } from "../ward-clock";
import { WARD_FLOW_STORED_STATE_VERSION } from "../ward-flow-storage-validation";
import { fetchSharedEvents, joinSharedWorld, postSharedEvent, submitSharedAccessCode } from "./ward-flow-shared-client";
import type { SharedEventRecord, SharedJoinResponse } from "./ward-flow-shared-core";
import type { SharedDetachReason, SharedSync } from "./ward-flow-shared-sync";

/**
 * Feature 3's network loop. One request at a time: send the oldest pending event if there is one,
 * otherwise ask for events after the last confirmed one. Polls every 2 s while the tab is visible
 * and every 15 s while it is hidden. Every answer goes back to the provider as a `SharedHostAction`,
 * and the next request waits until the provider has committed it, so a request never reads a
 * sequence number the provider has already moved past.
 */

export type SharedHostAction =
  | { kind: "adopt"; join: SharedJoinResponse; restoredElapsed: number }
  | { kind: "confirmed"; eventId: string; seq: number }
  | { kind: "remote"; records: SharedEventRecord[] }
  | { kind: "status"; status: "joining" | "locked" | "unavailable" }
  | { kind: "detach"; reason: SharedDetachReason }
  | { kind: "refused-by-board" };

export type SharedNetwork = "ok" | "offline";

const VISIBLE_POLL_MS = 2_000;
const HIDDEN_POLL_MS = 15_000;

export function useWardFlowSharedSync(options: {
  sync: SharedSync | undefined;
  buildId: string;
  /** This browser's own day 0, offered when it starts today's world. */
  localDayZeroMs: number;
  /** Null until the provider has read the wall clock after mount. */
  mountedAtAbsolute: number | null;
  send: (action: SharedHostAction) => void;
  /** Called with the joined world before it is adopted, for provider bookkeeping. */
  onAdopt?: (join: SharedJoinResponse) => void;
}) {
  const { sync, buildId, localDayZeroMs, mountedAtAbsolute, send, onAdopt } = options;
  const syncRef = useRef(sync);
  const awaitingCommit = useRef(false);
  const busy = useRef(false);
  const lastPollAt = useRef(0);
  const [network, setNetwork] = useState<SharedNetwork>("ok");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    syncRef.current = sync;
    awaitingCommit.current = false;
  }, [sync]);

  const deliver = useCallback(
    (action: SharedHostAction) => {
      awaitingCommit.current = true;
      send(action);
    },
    [send],
  );

  const runOnce = useCallback(async () => {
    const current = syncRef.current;
    if (!current || busy.current || awaitingCommit.current || mountedAtAbsolute === null) return;
    busy.current = true;
    try {
      if (current.status === "joining") {
        const result = await joinSharedWorld(
          { dayZeroMs: localDayZeroMs, stateVersion: WARD_FLOW_STORED_STATE_VERSION },
          buildId,
        );
        if (result.kind === "ok") {
          setNetwork("ok");
          // Board time is shared: 10:42 plus the time since the world started, on the server's clock.
          const sinceStart = Math.floor((result.body.serverNowMs - result.body.startedAtMs) / 60_000);
          const elapsedHere = absoluteWallClockMinutes() - mountedAtAbsolute;
          onAdopt?.(result.body);
          deliver({ kind: "adopt", join: result.body, restoredElapsed: sinceStart - Math.max(0, elapsedHere) });
        } else if (result.kind === "locked") deliver({ kind: "status", status: "locked" });
        else if (result.kind === "reload-required") deliver({ kind: "detach", reason: "reload-required" });
        else deliver({ kind: "status", status: "unavailable" });
        return;
      }
      if (current.status !== "live" || !current.worldId) return;

      const head = current.pending[0];
      if (head) {
        const posted = await postSharedEvent(
          { worldId: current.worldId, baseSeq: current.confirmedSeq, eventId: head.eventId, event: head.event },
          buildId,
        );
        switch (posted.kind) {
          case "accepted":
            setNetwork("ok");
            deliver({ kind: "confirmed", eventId: head.eventId, seq: posted.seq });
            return;
          case "conflict":
            // Someone else got there first: catch up, replay, and the loop sends what still stands.
            break;
          case "refused":
            deliver({ kind: "refused-by-board" });
            return;
          case "typed-text-not-shared":
            deliver({ kind: "detach", reason: "typed-text" });
            return;
          case "world-replaced":
            deliver({ kind: "status", status: "joining" });
            return;
          case "locked":
            deliver({ kind: "status", status: "locked" });
            return;
          case "reload-required":
            deliver({ kind: "detach", reason: "reload-required" });
            return;
          default:
            setNetwork("offline");
            return;
        }
      } else {
        const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
        if (hidden && Date.now() - lastPollAt.current < HIDDEN_POLL_MS) return;
      }

      lastPollAt.current = Date.now();
      const polled = await fetchSharedEvents(current.worldId, current.confirmedSeq, buildId);
      if (polled.kind !== "ok") {
        if (polled.kind === "locked") deliver({ kind: "status", status: "locked" });
        else if (polled.kind === "reload-required") deliver({ kind: "detach", reason: "reload-required" });
        else setNetwork("offline");
        return;
      }
      setNetwork("ok");
      if (polled.body.currentWorldId !== current.worldId) {
        deliver({ kind: "status", status: "joining" });
        return;
      }
      if (polled.body.events.length > 0) deliver({ kind: "remote", records: polled.body.events });
    } finally {
      busy.current = false;
    }
  }, [buildId, deliver, localDayZeroMs, mountedAtAbsolute, onAdopt]);

  const status = sync?.status;
  const pendingCount = sync?.pending.length ?? 0;
  const confirmedSeq = sync?.confirmedSeq ?? 0;

  // Runs straight away when there is a world to join or something new to send, and on every poll
  // tick. It runs after commit, after the effect above has cleared `awaitingCommit`.
  useEffect(() => {
    if (status === "joining" || status === "live") void runOnce();
  }, [status, pendingCount, confirmedSeq, runOnce, tick]);

  useEffect(() => {
    if (status !== "live") return;
    const timer = setInterval(() => setTick((value) => value + 1), VISIBLE_POLL_MS);
    return () => clearInterval(timer);
  }, [status]);

  const submitCode = useCallback(
    async (code: string) => {
      const result = await submitSharedAccessCode(code, buildId);
      if (result.kind === "ok") deliver({ kind: "status", status: "joining" });
      return result.kind;
    },
    [buildId, deliver],
  );

  const retry = useCallback(() => deliver({ kind: "status", status: "joining" }), [deliver]);

  return { network, submitCode, retry };
}
