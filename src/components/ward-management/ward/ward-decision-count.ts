// Kept apart from the (code-split) Decisions cockpit so the ward screen can read the count
// without statically importing the cockpit component.

/**
 * How many decisions are still open: referrals to answer, discharges ready or held up, and the
 * morning rollup until it is confirmed (overdue, or due and actionable). Leave rows are for
 * awareness only and never count. The Decisions tab badge and the cockpit heading both read this,
 * so they always agree with the windows' own counts.
 */
export function openDecisionCount<D extends { badge: string }>({
  intakes,
  departures,
  rollupOverdue,
  rollupConfirmed,
  rollupActionable,
}: {
  intakes: readonly unknown[];
  departures: readonly D[];
  rollupOverdue: boolean;
  rollupConfirmed: boolean;
  rollupActionable: boolean;
}): number {
  const rollupOpen = !rollupConfirmed && (rollupOverdue || rollupActionable) ? 1 : 0;
  return (
    intakes.length + departures.filter((row) => row.badge === "Ready" || row.badge === "Blocked").length + rollupOpen
  );
}
