/**
 * #1427: the signed-in accounts whose Help memory has loaded, or failed to load, on this page. The
 * tour's first-run offer waits for it, because the account's memory can say the tour was already
 * offered on another device. Kept apart so the offer does not load the memory code.
 */
export const HELP_ACCOUNT_READY_EVENT = "ward-flow-help-account-ready";

const ready = new Set<string>();

export function markHelpAccountReady(actorId: string): void {
  ready.add(actorId);
  window.dispatchEvent(new Event(HELP_ACCOUNT_READY_EVENT));
}

export function helpAccountReady(actorId: string): boolean {
  return ready.has(actorId);
}
