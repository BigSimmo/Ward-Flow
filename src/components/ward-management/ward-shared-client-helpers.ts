import type { WardFlowEvent } from "./ward-flow-events";
import type { SharedSnapshot } from "./ward-shared-client-types";
import { payloadUnchanged } from "./ward-shared-client-reuse";

export { onDeviceClock } from "./ward-shared-clock";

/**
 * H-0304: `AbortSignal.any` is missing from older Safari (before 17.4), where it threw and every
 * shared request failed. This uses it when present, otherwise one controller that follows the
 * first signal to abort and then lets go of every listener.
 */
export function anySignal(signals: readonly AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === "function") return AbortSignal.any([...signals]);
  const controller = new AbortController();
  const aborted = signals.find((signal) => signal.aborted);
  if (aborted) {
    controller.abort(aborted.reason);
    return controller.signal;
  }
  const stop = () => {
    for (const signal of signals) signal.removeEventListener("abort", follow);
  };
  function follow(this: AbortSignal) {
    stop();
    controller.abort(this.reason);
  }
  for (const signal of signals) signal.addEventListener("abort", follow, { once: true });
  return controller.signal;
}

/** Settles with `promise`, or rejects with an AbortError as soon as `signal` aborts. */
export function untilAborted<T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    // Cancellation settles the caller, but the token request can still reject later.
    void promise.catch(() => {});
    return Promise.reject(new DOMException("The poll was stopped", "AbortError"));
  }
  return new Promise<T>((resolve, reject) => {
    const stop = () => reject(new DOMException("The poll was stopped", "AbortError"));
    signal.addEventListener("abort", stop, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", stop);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", stop);
        reject(error);
      },
    );
  });
}

/** The engine's refusal as a sentence: capitalised, ending in a full stop. */
export function sentence(reason: string): string {
  const trimmed = reason.trim();
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`.replace(/[.!?…]?$/u, (end) => end || ".");
}
/**
 * Audit F-01: a referral's chart files never leave this device in shared mode. The shared board
 * keeps each file's name, type and size; the server drops any file content an older client sends.
 */
export function withoutChartContent(event: WardFlowEvent): WardFlowEvent {
  if (event.type !== "RECEIVE_REFERRAL" || !event.intake?.charts.some((chart) => chart.base64 !== undefined))
    return event;
  return {
    ...event,
    intake: {
      ...event.intake,
      charts: event.intake.charts.map((chart) => {
        const kept = { ...chart };
        delete kept.base64;
        return kept;
      }),
    },
  };
}

/** Validates a returned board without adopting it or clearing uncertain-save recovery. */
export function checkSharedSnapshot(
  snapshot: SharedSnapshot,
  previous: SharedSnapshot["payload"] | null,
  validateState: ((value: unknown) => boolean) | undefined,
): boolean {
  // Audit PS-06: content equal to the payload already held passed the shared-state check then.
  const unchanged = payloadUnchanged(previous, snapshot?.payload);
  if (
    !snapshot ||
    snapshot.dataMode !== "prototype" ||
    !Number.isSafeInteger(snapshot.revision) ||
    snapshot.revision < 1 ||
    !Number.isFinite(snapshot.now) ||
    (snapshot.accessContext !== undefined &&
      (typeof snapshot.accessContext !== "string" || !/^[a-f0-9]{64}$/.test(snapshot.accessContext))) ||
    snapshot.payload?.version !== 1 ||
    !(unchanged || validateState?.(snapshot.payload.state)) ||
    !Number.isFinite(Date.parse(snapshot.payload.dayZero)) ||
    !Number.isFinite(Date.parse(snapshot.payload.startedAt))
  )
    throw new Error("Incompatible workspace data");
  if (Number.isFinite(snapshot.accessUntil) && snapshot.accessUntil! <= Date.now())
    throw new Error("Access verification expired");
  return unchanged;
}
