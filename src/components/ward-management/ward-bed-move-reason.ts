import { involuntaryBedNeededForLegalStatus } from "./ward-eligibility";

/**
 * Audit CS3-12 (Josh, 26 Oct 2026, Part A 3): a bed move follows the admission step. A stay that
 * needs a locked bed moves from a locked bed to an open one only with a recorded override reason.
 * It needs a locked bed when its request was Secure, or its legal status is anything but a
 * recorded Voluntary (D-69: "Needs an involuntary-capable bed until status is set"). A move that
 * keeps the bed kind, or goes from open to locked, needs nothing.
 */
export function bedMoveNeedsOpenBedReason(move: {
  fromKind: "locked" | "open";
  toKind: "locked" | "open";
  secureRequest: boolean;
  legalStatus: string | null | undefined;
}): boolean {
  return (
    move.fromKind === "locked" &&
    move.toKind === "open" &&
    (move.secureRequest || involuntaryBedNeededForLegalStatus(move.legalStatus))
  );
}

/** The refusal's fixed ending, which the Bed board also reads to offer the reasons. */
export const OPEN_BED_MOVE_REASON_REQUIRED = "needs a recorded override reason to use an open bed";

export function openBedMoveRefusal(bedLabel: string, secureRequest: boolean): string {
  const why = secureRequest ? "this stay was placed as a Secure request" : "legal status is not recorded as Voluntary";
  return `Bed ${bedLabel} is an open bed and ${why}. This move ${OPEN_BED_MOVE_REASON_REQUIRED}`;
}
