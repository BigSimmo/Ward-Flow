import type { Unit } from "@/components/ward-management/ward-model";
import { authorisationLabel } from "@/components/ward-management/ward-authorisation";
import { SAMPLE_OBSERVATION_MIX_LABEL } from "@/components/ward-management/ward-sample-choices";
import { wardSafeRejectionReason } from "./ward-rejection-text";

/**
 * The drawer's refusal line: what was refused, then that nothing changed, said once. A shared-board
 * refusal already ends "Nothing was changed." (audit E-25).
 */
export function notRecordedMessage(message?: string): string {
  const reason = (message ?? "The change was refused").replace(/\s*Nothing was changed\.$/u, "").replace(/\.$/u, "");
  return `Not recorded: ${reason}. Nothing was changed.`;
}

/**
 * D-125 (audit M2): a refused referral answer said on this ward's own toast. It names the person,
 * as the success message does; the engine's reason is put in ward words first.
 */
export function namedNotRecordedMessage(reason: string, who: string): string {
  const said = wardSafeRejectionReason(reason);
  return notRecordedMessage(said.includes(who) ? said : `${who}: ${said}`);
}

/**
 * The Ward page's header and footer labels, kept here so the page stays within its line limit.
 * D-209 item 9: the ward's authorisation as the Chief Psychiatrist's register shows it. D-189: the
 * observation levels are a sample mix, and the footer says so (D-209 item 5 keeps it).
 */
export function wardLabels(unit: Pick<Unit, "id" | "name">): { authorisation: string; governanceNote: string } {
  return {
    authorisation: authorisationLabel(unit),
    governanceNote: `Scoped to ${unit.name} · Bed decisions remain human-confirmed · Not approved for clinical use · Observation levels: ${SAMPLE_OBSERVATION_MIX_LABEL.toLowerCase()}`,
  };
}
