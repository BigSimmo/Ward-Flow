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
