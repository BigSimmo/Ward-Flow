"use client";

import { useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { SharedAccessContext } from "@/components/ward-management/shell/ward-shared-access-context";
import { wardLeaveSaveAllowed, wardLeaveSaveTicket } from "@/components/ward-management/ward-browser-data";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import {
  FORECAST_MISS_REASONS_STORAGE_KEY,
  parseForecastMissReasons,
  recordForecastMissReason,
  latestMissReasons,
  type ForecastMissReasonEntry,
} from "./forecast-miss-reasons";
import {
  forecastPendingKey,
  readPendingForecastReasons,
  readInactiveForecastReasons,
  removePendingForecastReason,
  writePendingForecastReason,
  parsePendingForecastReason,
  samePendingForecastReason,
  type ForecastPendingScope,
  type PendingForecastReason,
} from "./forecast-pending-reasons";
import { useSharedForecastHistory } from "./forecast-shared-history";
import { forecastOperationId, forecastVersion, type ForecastWriteResult } from "./forecast-shared-types";

const CHANGE = "ward-flow-forecast-miss-reasons-change";
type Lifetime = { key: string | null; live: boolean };
const transmitting = new Map<string, { owner: Lifetime; promise: Promise<ForecastWriteResult> }>();
const changed = () => window.dispatchEvent(new Event(CHANGE));
function subscribe(change: () => void) {
  window.addEventListener("storage", change);
  window.addEventListener(CHANGE, change);
  return () => {
    window.removeEventListener("storage", change);
    window.removeEventListener(CHANGE, change);
  };
}
const empty = () => "[]";

/** Closed-list drafts retain their original operation and day basis until a matching receipt. */
export function useForecastMissReasons() {
  const { scenario, worldGeneration } = useWardFlowSelect("scenario", "worldGeneration");
  const account = useContext(SharedAccessContext);
  const actorId = account?.actorId;
  const { state, write } = useSharedForecastHistory(worldGeneration);
  const scopeKey = state.status === "shared" ? state.scopeKey : null;
  const scope = useMemo<ForecastPendingScope | null>(
    () => (actorId && scopeKey ? { actorId, scopeKey, scenario, generation: worldGeneration } : null),
    [actorId, scopeKey, scenario, worldGeneration],
  );
  const key = scope ? forecastPendingKey(scope) : null;
  const localKey = `${FORECAST_MISS_REASONS_STORAGE_KEY}:${encodeURIComponent(account?.actorId ?? "local-demo")}:${scenario}:${worldGeneration}`;
  const read = useCallback(() => {
    try {
      return scope ? JSON.stringify(readPendingForecastReasons(window.localStorage, scope)) : "[]";
    } catch {
      return "[]";
    }
  }, [scope]);
  const raw = useSyncExternalStore(subscribe, read, empty);
  const pending = useMemo(() => JSON.parse(raw) as PendingForecastReason[], [raw]);
  const readInactive = useCallback(() => {
    try {
      return scope ? JSON.stringify(readInactiveForecastReasons(window.localStorage, scope)) : "[]";
    } catch {
      return "[]";
    }
  }, [scope]);
  const inactiveRaw = useSyncExternalStore(subscribe, readInactive, empty);
  const inactive = useMemo(
    () => JSON.parse(inactiveRaw) as { scope: ForecastPendingScope; draft: PendingForecastReason }[],
    [inactiveRaw],
  );
  const localRaw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem(localKey) ?? "[]";
      } catch {
        return "[]";
      }
    },
    empty,
  );
  const local = useMemo(() => parseForecastMissReasons(localRaw), [localRaw]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<ReadonlySet<string>>(new Set());
  const [retryTick, setRetryTick] = useState(0);
  const attempted = useRef(new Set<string>());
  const lifetime = useRef<Lifetime | null>(null);
  useEffect(() => {
    const active = { key, live: true };
    lifetime.current = active;
    attempted.current.clear();
    return () => {
      active.live = false;
    };
  }, [key]);
  useEffect(() => {
    const retry = () => {
      attempted.current.clear();
      setRetryTick((value) => value + 1);
    };
    const shown = () => {
      if (document.visibilityState === "visible") retry();
    };
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", shown);
    return () => {
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", shown);
    };
  }, []);

  useEffect(() => {
    if (!scope || state.status !== "shared" || !state.writable) return;
    const active = lifetime.current;
    if (!active?.live) return;
    const ticket = wardLeaveSaveTicket(account);
    for (const draft of pending) {
      if (draft.status === "conflict" || attempted.current.has(draft.operationId)) continue;
      attempted.current.add(draft.operationId);
      const operationKey = forecastPendingKey(scope, draft.operationId);
      setSaving((held) => new Set([...held, draft.operationId]));
      let request = transmitting.get(operationKey);
      if (!request?.owner.live) {
        request = {
          owner: active,
          promise: write({
            scopeKey: scope.scopeKey,
            operationId: draft.operationId,
            expectedDayVersion: draft.expectedDayVersion,
            reason: draft.entry,
          }),
        };
        transmitting.set(operationKey, request);
        const ownRequest = request;
        void request.promise.finally(() => {
          if (transmitting.get(operationKey) === ownRequest) transmitting.delete(operationKey);
        });
      }
      const owner = request.owner;
      void request.promise.then((result) => {
        if (!active?.live || lifetime.current !== active || !wardLeaveSaveAllowed(ticket)) return;
        setSaving((held) => new Set([...held].filter((id) => id !== draft.operationId)));
        if (result.status === "cancelled" && owner !== active && !owner.live) {
          attempted.current.delete(draft.operationId);
          setRetryTick((value) => value + 1);
          return;
        }
        try {
          if (result.status === "accepted") removePendingForecastReason(window.localStorage, scope, draft.operationId);
          else if (result.status !== "cancelled") {
            const current = parsePendingForecastReason(window.localStorage.getItem(operationKey));
            if (samePendingForecastReason(current, draft) && current?.status !== "conflict")
              writePendingForecastReason(window.localStorage, scope, {
                ...draft,
                status: result.status === "conflict" ? "conflict" : "failed",
              });
          }
          changed();
        } catch {
          setError("This device could not update the saved draft. Reconnect before leaving this page.");
        }
      });
    }
  }, [scope, state, pending, write, account, retryTick]);

  const writable = !account || (state.status === "shared" && state.writable);
  const record = useCallback(
    (entry: ForecastMissReasonEntry, expectedDayVersion?: number): boolean => {
      setError(null);
      if (!parseForecastMissReasons(JSON.stringify([entry])).length) return false;
      const ticket = wardLeaveSaveTicket(account);
      if (!wardLeaveSaveAllowed(ticket)) return false;
      try {
        if (!account) {
          const next = recordForecastMissReason(parseForecastMissReasons(window.localStorage.getItem(localKey)), entry);
          window.localStorage.setItem(localKey, JSON.stringify(next));
          changed();
          return true;
        }
        if (!scope || state.status !== "shared" || !state.writable) {
          setError("Shared saving is unavailable. Your choice has not been sent. Reconnect and try again.");
          return false;
        }
        if (pending.some((held) => held.entry.day === entry.day)) {
          setError("Resolve this day's pending reason before choosing another.");
          return false;
        }
        const basis = expectedDayVersion ?? state.reasonVersions[entry.day] ?? 0;
        if (!forecastVersion(basis)) return false;
        const draft: PendingForecastReason = {
          operationId: forecastOperationId(),
          expectedDayVersion: basis,
          entry,
          status: "queued",
        };
        if (!writePendingForecastReason(window.localStorage, scope, draft)) throw new Error("Draft could not be kept");
        changed();
        return true;
      } catch {
        setError("This device could not keep the draft. It has not been sent; keep this page open and try again.");
        return false;
      }
    },
    [account, localKey, scope, state, pending],
  );

  const retry = useCallback(
    (operationId: string) => {
      if (!scope) return;
      const draft = pending.find((held) => held.operationId === operationId);
      if (!draft || draft.status === "conflict") return;
      attempted.current.delete(operationId);
      try {
        writePendingForecastReason(window.localStorage, scope, { ...draft, status: "queued" });
        changed();
      } catch {
        setError("This device could not update the draft. Keep this page open.");
      }
    },
    [scope, pending],
  );
  const discard = useCallback(
    (operationId: string) => {
      if (!scope || saving.has(operationId)) return;
      try {
        removePendingForecastReason(window.localStorage, scope, operationId);
        changed();
      } catch {
        setError("This device could not remove the draft. Keep this page open.");
      }
    },
    [scope, saving],
  );
  const discardInactive = useCallback(
    (operationId: string) => {
      const earlier = inactive.find((held) => held.draft.operationId === operationId);
      if (!earlier) return;
      try {
        removePendingForecastReason(window.localStorage, earlier.scope, operationId);
        changed();
      } catch {
        setError("This device could not remove the earlier draft. Keep this page open.");
      }
    },
    [inactive],
  );

  return {
    entries: state.status === "shared" ? state.reasons : account ? [] : local,
    legacy:
      account && scope
        ? [...latestMissReasons(local).values()].filter(
            (entry) =>
              !pending.some((draft) => draft.entry.day === entry.day) &&
              !(
                state.status === "shared" &&
                state.reasons.some(
                  (saved) => saved.day === entry.day && saved.reason === entry.reason && saved.by === entry.by,
                )
              ),
          )
        : [],
    pending: pending.map((draft) => ({ ...draft, saving: saving.has(draft.operationId) })),
    reasonVersions: state.status === "shared" ? state.reasonVersions : {},
    writable,
    error,
    record,
    retry,
    discard,
    inactive,
    discardInactive,
  };
}
