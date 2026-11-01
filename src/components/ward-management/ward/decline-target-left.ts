/**
 * A4-10 (H-0121): an open decline form belongs to one referral. When another desk answers it
 * first, or it is withdrawn, it leaves this ward's queue and the form went with its row, with
 * nothing said. This says why. One this ward answered itself is the ordinary path: no note.
 */
export const DECLINE_TARGET_ANSWERED_ELSEWHERE = "Another desk answered this referral first.";
export const DECLINE_TARGET_WITHDRAWN = "This referral was withdrawn before you answered.";

export function declineTargetLeftNote(
  declineOpenFor: string | null | undefined,
  incoming: readonly { id: string }[],
  answeredHere: readonly { movementId: string }[],
  wasWithdrawn: (id: string) => boolean,
): string | undefined {
  if (!declineOpenFor || incoming.some((movement) => movement.id === declineOpenFor)) return undefined;
  if (answeredHere.some((answer) => answer.movementId === declineOpenFor)) return undefined;
  return wasWithdrawn(declineOpenFor) ? DECLINE_TARGET_WITHDRAWN : DECLINE_TARGET_ANSWERED_ELSEWHERE;
}
