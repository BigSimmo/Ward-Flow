import type { Instant } from "@/components/ward-management/ward-clock";
import { noticeIsForWardChrome } from "@/components/ward-management/ward-chrome-role";
import { isArrivalLate, isOpen } from "@/components/ward-management/ward-derivations";
import type { CapacityFigure, CapacityRefreshRequest, Movement, Notice } from "@/components/ward-management/ward-model";
import { buzzKeys, refreshRequestIsOpen } from "./ward-buzz-keys";
import { wardClearanceAlerts } from "./ward-clearance-alerts";

type WardAlertBuzz<R extends CapacityRefreshRequest = CapacityRefreshRequest> = { buzz: R; buzzKey: string };

/**
 * What the ward's Notices panel lists and its button counts, worked out once (notifications pass,
 * 30 Oct 2026). The button and the panel each counted on their own and drifted: the panel still
 * listed an acknowledged buzz and called a patient who had already arrived late.
 */
export function wardAlerts<R extends CapacityRefreshRequest>({
  unitId,
  now,
  movements,
  notices,
  refreshRequests = [],
  allocatable,
  dismissedBuzzKeys = [],
  censusOverdue = false,
}: {
  unitId: string;
  now: Instant;
  movements: readonly Movement[];
  notices: readonly Notice[];
  refreshRequests?: readonly R[];
  allocatable?: Pick<CapacityFigure, "source" | "confirmedAt" | "confirmations">;
  /** Buzzes the ward has acknowledged on this screen. */
  dismissedBuzzKeys?: readonly string[];
  /** The morning numbers are past their deadline and not yet confirmed. */
  censusOverdue?: boolean;
}) {
  // Keys come from the whole list so a dismissal keeps its key.
  const keys = buzzKeys(refreshRequests);
  const buzzes: WardAlertBuzz<R>[] = refreshRequests
    .map((buzz, index) => ({ buzz, buzzKey: keys[index] ?? "" }))
    .filter(
      ({ buzz, buzzKey }) =>
        buzz.unitId === unitId && refreshRequestIsOpen(buzz, allocatable) && !dismissedBuzzKeys.includes(buzzKey),
    );
  const overdueArrivals = movements.filter(
    (movement) => movement.acceptedUnitId === unitId && isOpen(movement) && isArrivalLate(movement, now),
  );
  const { missing: missingClearances, unrecorded: unrecordedClearances } = wardClearanceAlerts(movements, unitId);
  const wardNotices = notices.filter((notice) => noticeIsForWardChrome(notice, "ward", unitId, now));
  const unreadNotices = wardNotices.filter((notice) => notice.readAt === undefined).length;

  // "Check" holds clearance not recorded: a gap to check, not an alarm, but still counted so every
  // row shown is in the total.
  const act = (censusOverdue ? 1 : 0) + overdueArrivals.length + missingClearances.length;
  const check = unrecordedClearances.length;
  const coordinator = buzzes.length + unreadNotices;
  return {
    buzzes,
    overdueArrivals,
    missingClearances,
    unrecordedClearances,
    wardNotices,
    counts: { act, check, coordinator, unreadNotices, total: act + check + coordinator },
  };
}
