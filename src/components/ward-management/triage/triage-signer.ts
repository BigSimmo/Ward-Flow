/**
 * A9-29 (Audit 9; D-189 item 9(f), Josh 13 Nov 2026): a signed triage names the desk that signed it,
 * never a fixed clinician. The saved record already holds the desk (`TriageSignedRecord.by`), so the
 * name is read from it. Josh, 14 Nov 2026 (go question 4): it shows the desk's own name ("Bed
 * coordinator", "ED clinician"), not the desk's sample persona, so no invented person signs a triage.
 */
import { WARD_SHELL_ROLE } from "@/components/ward-management/ward-chrome-role";
import { WARD_FLOW_ROLE_LABELS, type WardFlowRole } from "@/components/ward-management/ward-flow-roles";

/** The name a triage signed by this desk shows: the desk's own name. */
export function signerName(by: WardFlowRole): string {
  // A stored row is checked on load, but an unknown desk still names no one rather than guessing.
  return WARD_FLOW_ROLE_LABELS[by] ?? "Signer not recorded";
}

/**
 * The reviewer an unsigned document names when no desk is handed in: the shell's default desk. The
 * form always hands in its own desk, so this serves pure callers only.
 */
export const DEFAULT_REVIEWER = signerName(WARD_SHELL_ROLE);
