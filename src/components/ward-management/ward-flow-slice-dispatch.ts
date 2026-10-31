import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { WardFlowEvent } from "./ward-flow-events";
import { reducerSlicesLoaded } from "./ward-flow-reducer-slice-registry";
import type { WardCommandDispatch, WardCommandOutcome } from "./ward-shared-client";

let loading: Promise<void> | null = null;

/** Loads the reducer's slices once. A failed load (offline, a stale chunk) is retried by the next call. */
export function loadReducerSlices(): Promise<void> {
  if (reducerSlicesLoaded()) return Promise.resolve();
  loading ??= import("./ward-flow-reducer-slices").then(
    () => {
      loading = null;
    },
    (error: unknown) => {
      loading = null;
      throw error;
    },
  );
  return loading;
}

type LocalDispatch = (event: WardFlowEvent) => WardCommandOutcome | Promise<WardCommandOutcome>;

/**
 * The provider's dispatch, holding local commands until the reducer's slices have loaded.
 *
 * The reducer's larger event groups load just after the page starts (Josh named the split, 26 Oct
 * 2026), so a phone's first load is smaller. A local command made before they arrive waits for them,
 * and every later command queues behind it so commands keep their order. A shared workspace runs
 * commands on the server, so `shared` dispatches straight through. If the slices cannot load, the
 * command fails and is not recorded; the next command tries the load again.
 */
export function useSliceGatedDispatch(
  dispatchLocal: LocalDispatch,
  shared: WardCommandDispatch | null,
  /** The provider's local command counter, shared so a failed command still gets a fresh id. */
  commands: { readonly current: { sequence: number } },
  captureLifetime?: () => () => boolean,
): WardCommandDispatch {
  const localRef = useRef(dispatchLocal);
  useLayoutEffect(() => {
    localRef.current = dispatchLocal;
  }, [dispatchLocal]);
  const queueRef = useRef<Promise<WardCommandOutcome> | null>(null);
  useEffect(() => {
    void loadReducerSlices().catch(() => undefined);
  }, []);
  return useCallback<WardCommandDispatch>(
    (event: WardFlowEvent) => {
      if (shared) return shared(event);
      if (reducerSlicesLoaded() && !queueRef.current) return dispatchLocal(event);
      const isCurrent = captureLifetime?.();
      const queued: Promise<WardCommandOutcome> = (queueRef.current ?? Promise.resolve())
        .catch(() => undefined)
        .then(() => loadReducerSlices())
        .then(
          () =>
            isCurrent && !isCurrent()
              ? {
                  commandId: `local-${++commands.current.sequence}`,
                  status: "cancelled",
                  message:
                    "The workspace changed before this action finished loading. Check the board before trying again.",
                }
              : localRef.current(event),
          (): WardCommandOutcome => ({
            commandId: `local-${++commands.current.sequence}`,
            status: "failed",
            message:
              "Ward Flow could not finish loading, so this was not recorded. Check the connection and try again.",
          }),
        );
      queueRef.current = queued;
      void queued
        .finally(() => {
          if (queueRef.current === queued) queueRef.current = null;
        })
        .catch(() => undefined);
      return queued;
    },
    [shared, dispatchLocal, commands, captureLifetime],
  );
}
