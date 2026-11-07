import { focusIsLost } from "@/components/wf";

/**
 * Where keyboard focus lands when the control that held it goes away on the Referrals board (front-end
 * audit, 5 Nov 2026). Focus is only moved when it has fallen to the page; a control that kept focus
 * is never pulled away from.
 */

const rowSelect = (referralId: string) =>
  document.querySelector<HTMLElement>(`[data-testid="ward-referral-board-select-${referralId}"]`);

function focusFirst(candidates: ReadonlyArray<HTMLElement | null | undefined>): boolean {
  for (const target of candidates) {
    if (!target) continue;
    target.focus({ preventScroll: true });
    if (document.activeElement === target) return true;
  }
  return false;
}

/** The referral to land on once `decidedId` leaves the queue: the one after it, else the one before. */
export function nextQueuedId(queuedIds: readonly string[], decidedId: string): string | undefined {
  const index = queuedIds.indexOf(decidedId);
  if (index === -1) return queuedIds[0];
  return queuedIds[index + 1] ?? queuedIds[index - 1];
}

/**
 * BA-1: Accept or Decline removes the pressed button, so focus fell to the page. Next frame, once the
 * decision has drawn, focus goes to the detail, which stays on the person decided and shows the
 * outcome (CS-15). Drawer review (6 Nov 2026): the detail is a modal drawer, so focus stays inside it
 * while it is open; the next referral's row takes focus only when no drawer is open.
 */
export function focusAfterDecision(nextId: string | undefined): void {
  window.requestAnimationFrame(() => {
    if (!focusIsLost()) return;
    focusFirst([
      document.querySelector<HTMLElement>('[role="region"][aria-label="Selected referral detail"]'),
      nextId === undefined ? null : rowSelect(nextId),
    ]);
  });
}

/**
 * BA-3: Escape on a detail the page opened by itself has no opener to go back to, so focus goes to
 * the first referral in the queue, or else the selected view tab.
 */
export function focusQueueFallback(): boolean {
  return focusFirst([
    document.querySelector<HTMLElement>(
      '#ward-referral-view-panel-queue [data-testid^="ward-referral-board-select-"]:not([data-testid*="-decided-"])',
    ),
    document.querySelector<HTMLElement>('[id^="ward-referral-view-tab-"][aria-selected="true"]'),
  ]);
}
