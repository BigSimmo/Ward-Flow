import type { WardCommandDispatch, WardCommandOutcome } from "./ward-shared-client";

/** Confirmed UI actions cannot infer acceptance from a dispatch that returned no outcome. */
export function confirmedWardCommand(
  completion: ReturnType<WardCommandDispatch>,
): WardCommandOutcome | Promise<WardCommandOutcome> {
  const confirmed = (outcome: WardCommandOutcome | void): WardCommandOutcome =>
    outcome ?? {
      commandId: "",
      status: "failed",
      message: "Save is not confirmed. Review the board before trying again.",
    };
  return completion && "then" in completion ? completion.then(confirmed) : confirmed(completion);
}
