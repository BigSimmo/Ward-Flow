import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { wardCommandFailure } from "@/components/ward-management/ward/use-ward-command-completion";

/**
 * Clinical-safety audit (1 Nov 2026): sends each step only once the one before it is recorded, then
 * reports the first step that was not, with its answer. A step after a refusal is never sent, so a
 * form is never recorded against a legal status that was refused.
 */
export function sendStepsInOrder(
  dispatch: WardCommandDispatch,
  steps: readonly WardFlowEvent[],
  done: (failed: { index: number; failure: string } | undefined) => void,
  index = 0,
) {
  const step = steps[index];
  if (step === undefined) return done(undefined);
  const next = (outcome: WardCommandOutcome | void) => {
    const failure = wardCommandFailure(outcome ?? undefined);
    if (failure) done({ index, failure });
    else sendStepsInOrder(dispatch, steps, done, index + 1);
  };
  let result: ReturnType<WardCommandDispatch>;
  try {
    result = dispatch(step);
  } catch {
    return next({ commandId: "", status: "failed" });
  }
  if (result && "then" in result) result.then(next, () => next({ commandId: "", status: "failed" }));
  else next(result);
}
