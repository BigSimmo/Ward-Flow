import { canRestoreFocusTo } from "@/components/wf/sheet-focus";

import type { WardReferralInboxEntry } from "./referral-inbox";

/** Recipient inboxes that hold referrals, how many wait for a decision, and the one shown. */
export function referralInboxSummary<Unit extends { unitId: string }>(
  units: readonly Unit[],
  inbox: ((unitId: string) => WardReferralInboxEntry[]) | undefined,
  chosenUnitId: string | null,
) {
  const inboxWards = units
    .map((unit) => {
      const entries = inbox?.(unit.unitId) ?? [];
      const toDecide = entries.filter((entry) => entry.state === "queued" && entry.withdrawnAt === undefined).length;
      return { unit, entries: entries.length, toDecide };
    })
    .filter((ward) => ward.entries > 0);
  const inboxCount = inboxWards.reduce((sum, ward) => sum + ward.toDecide, 0);
  const inboxWard = inboxWards.find((ward) => ward.unit.unitId === chosenUnitId) ?? inboxWards[0];
  return { inboxWards, inboxCount, inboxWard };
}

/** After a refused Send, move focus to the first invalid field of the confirmation form, if it can take it. */
export function focusFirstInvalidField(heading: { readonly current: HTMLElement | null }) {
  requestAnimationFrame(() => {
    const form = heading.current?.closest("form");
    if (!form || form.closest("[hidden], [inert]") || !canRestoreFocusTo(form)) return;
    const control = form.querySelector<HTMLElement>('input[aria-invalid="true"]');
    control?.focus({ preventScroll: true });
    control?.scrollIntoView?.({ block: "center" });
  });
}
