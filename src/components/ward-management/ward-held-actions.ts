/**
 * D-125 (Josh, 10 Nov 2026; audit M8): actions a screen holds back during an Undo window, such as
 * Tasks "Acknowledge visible", are sent before a voluntary sign-out or role switch, and the sign-out
 * or switch waits for them to be confirmed. A screen that holds actions registers here; the session
 * hook asks before it ends the working view. Forced expiry at the session limit never waits: it only
 * reads `heldActionsWaiting` to say that unsent changes were not saved.
 */
type HeldActions = {
  /** Something is held in a current Undo window. */
  waiting: () => boolean;
  /** Ends the Undo window now and waits for the save. True when every held action was confirmed. */
  send: (purpose: HeldActionPurpose) => Promise<boolean>;
};
export type HeldActionPurpose = "sign-out" | "switch-role";

const holders = new Set<HeldActions>();

/** Registers a screen's held actions; returns the unregister call. */
export function registerHeldActions(holder: HeldActions): () => void {
  holders.add(holder);
  return () => {
    holders.delete(holder);
  };
}

export function heldActionsWaiting(): boolean {
  return [...holders].some((holder) => holder.waiting());
}

/** Sends every held action and waits. False when any was refused, failed or left unconfirmed. */
export async function sendHeldActions(purpose: HeldActionPurpose): Promise<boolean> {
  const waiting = [...holders].filter((holder) => holder.waiting());
  if (waiting.length === 0) return true;
  const results = await Promise.all(waiting.map((holder) => holder.send(purpose).catch(() => false)));
  return results.every(Boolean);
}
