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
