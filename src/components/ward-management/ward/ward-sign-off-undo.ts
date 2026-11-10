import type { WardRaise } from "../ward-flow-raise";
import type { WardCommandOutcome } from "../ward-shared-client";
import { roleLimitReason } from "@/components/ward-management/ward-role-permissions";
import type { DecisionReport } from "./ward-decisions-cockpit";
import {
  wardCommandFailure,
  wardCommandKey,
  wardCommandUndoSeq,
  wardUndoBlocked,
  type useWardCommandCompletion,
} from "./use-ward-command-completion";

type SignOffUndoContext = {
  routeRole: Parameters<typeof roleLimitReason>[0];
  unitId: string;
  raise: WardRaise;
  completeCommand: ReturnType<typeof useWardCommandCompletion>;
  warnToast: (text: string) => void;
};

/**
 * M37 (D-129, 10 Nov 2026): a recorded discharge sign-off can be taken back from Ward Decisions for
 * a short time, through the step undo (`UNDO_RELEASE_STEP` on its bed release), which refuses when
 * anyone has changed the release since. Undefined when this sign-off has nothing to take back.
 */
export function signOffUndo(
  releaseId: string,
  signed: WardCommandOutcome | undefined,
  context: SignOffUndoContext,
): ((report: DecisionReport) => void) | undefined {
  const recordSeq = wardCommandUndoSeq(signed, "UNDO_RELEASE_STEP", `release:${releaseId}`);
  if (signed && (signed.status !== "accepted" || recordSeq === undefined)) return undefined;
  if (roleLimitReason(context.routeRole, "UNDO_RELEASE_STEP")) return undefined;
  return (report) => {
    if (wardUndoBlocked(signed, context.warnToast)) return report(false);
    const sent = context.completeCommand(
      wardCommandKey("undo-release", releaseId),
      () =>
        context.raise("UNDO_RELEASE_STEP", {
          releaseId,
          actingUnitId: context.unitId,
          ...(recordSeq === undefined ? {} : { recordSeq }),
        }),
      (outcome) => {
        const failure = wardCommandFailure(outcome);
        if (failure) context.warnToast(failure);
        report(outcome ? outcome.status === "accepted" : undefined);
      },
    );
    if (sent === false) report(false);
  };
}
