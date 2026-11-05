import type { WardCommandDispatch, WardCommandOutcome } from "./ward-shared-client";
import { SAVE_NOT_CONFIRMED } from "@/components/ward-management/ward-save-failure";

/** Confirmed UI actions cannot infer acceptance from a dispatch that returned no outcome. */
export function confirmedWardCommand(
  completion: ReturnType<WardCommandDispatch>,
): WardCommandOutcome | Promise<WardCommandOutcome> {
  const confirmed = (outcome: WardCommandOutcome | void): WardCommandOutcome =>
    outcome ?? {
      commandId: "",
      status: "failed",
      message: SAVE_NOT_CONFIRMED,
    };
  return completion && "then" in completion ? completion.then(confirmed) : confirmed(completion);
}

/**
 * Legacy boolean/string adapters must narrow only a terminal reply. An uncertain initial
 * response still owns its command and draft until that same command is confirmed.
 */
export function settledWardCommand(
  completion: ReturnType<WardCommandDispatch>,
): WardCommandOutcome | Promise<WardCommandOutcome> {
  const settle = (outcome: WardCommandOutcome): WardCommandOutcome | Promise<WardCommandOutcome> => {
    if (outcome.status !== "failed" || !outcome.confirmation) return outcome;
    return outcome.confirmation.then((confirmed) => (confirmed.commandId === outcome.commandId ? confirmed : outcome));
  };
  const initial = confirmedWardCommand(completion);
  return "then" in initial ? initial.then(settle) : settle(initial);
}
