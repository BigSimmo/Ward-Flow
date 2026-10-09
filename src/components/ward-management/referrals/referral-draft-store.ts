/**
 * One kept referral draft, held in this tab's JavaScript memory only.
 *
 * The slide-out offers "Keep draft" when it is closed with answers entered, so the referrer can
 * reopen it and carry on. Typed text must never reach browser storage, so the draft lives in a
 * module variable: a reload or a new tab starts empty. `tests/ward-referral-drawer-sheet.dom.test.tsx`
 * checks that keeping a draft writes nothing to `localStorage` or `sessionStorage`.
 */
let kept: unknown = null;

export function keepReferralDraft<T>(draft: T): void {
  kept = draft;
}

export function readKeptReferralDraft<T>(): T | null {
  return (kept as T | null) ?? null;
}

export function discardReferralDraft(): void {
  kept = null;
}
