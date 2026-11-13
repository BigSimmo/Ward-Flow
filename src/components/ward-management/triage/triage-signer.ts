/**
 * A9-29 (Audit 9; D-189 item 9(f), Josh 13 Nov 2026): a signed triage names the desk that signed it,
 * never a fixed clinician. The saved record already holds the desk (`TriageSignedRecord.by`), so the
 * name is read from it: the desk's synthetic persona, the same name the rail shows, on the public demo
 * and the signed-in site alike. A desk with no persona (the demonstration control) reads its role.
 * Synthetic names only.
 */
import { DESK_PERSONAS } from "@/components/ward-management/shell/ward-desk-personas";
import { WARD_SHELL_ROLE } from "@/components/ward-management/ward-chrome-role";
import { WARD_FLOW_ROLE_LABELS, type WardFlowRole } from "@/components/ward-management/ward-flow-roles";

/** The name a triage signed by this desk shows: the desk persona's name, as the rail shows it. */
export function signerName(by: WardFlowRole): string {
  if (by === "demo") return WARD_FLOW_ROLE_LABELS.demo;
  // A stored row is checked on load, but an unknown desk still names no one rather than guessing.
  return DESK_PERSONAS[by]?.name ?? WARD_FLOW_ROLE_LABELS[by] ?? "Signer not recorded";
}

/**
 * The reviewer an unsigned document names when no desk is handed in: the shell's default desk, as
 * the rail shows it. The form always hands in its own desk, so this serves pure callers only.
 */
export const DEFAULT_REVIEWER = signerName(WARD_SHELL_ROLE);
