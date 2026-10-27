import { notWaitingMoreText, type WaitingSplit } from "@/components/ward-management/ward-shared-figures";

/**
 * P098 (Josh, 27 Oct 2026): beside Waiting's "Over 8h", the people on the list who are not waiting,
 * in the shared helper's words ("1 more in transit"). Nothing when everybody listed is waiting.
 */
export function DelaysInTransitNote({ split, className }: { split: WaitingSplit; className?: string }) {
  const text = notWaitingMoreText(split);
  if (text === null) return null;
  return (
    <span className={className} data-testid="delays-in-transit-note">
      {text}
    </span>
  );
}
