import type { WardFlowEvent } from "./ward-flow-events";

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
  if (signal.aborted) return Promise.reject(new DOMException("The poll was stopped", "AbortError"));
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
