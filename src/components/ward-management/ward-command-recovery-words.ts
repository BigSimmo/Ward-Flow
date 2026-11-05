/**
 * The staff-facing words for reload recovery outcomes, kept apart from the recovery storage code in
 * `ward-command-recovery.ts` so the shared-mode banner can show them without loading that module.
 */
export type RecoveryResult = {
  commandId: string;
  outcome: "accepted" | "partly" | "refused" | "unsent" | "unknown" | "expired";
};
/** Plain words for staff; the outcome codes stay internal. */
export const RECOVERY_OUTCOME_WORDS: Record<RecoveryResult["outcome"], string> = {
  accepted: "saved",
  partly: "partly saved",
  refused: "not saved",
  unsent: "not sent before the reload",
  unknown: "outcome not known",
  expired: "outcome not known, the check ran out of time",
};
