"use client";

import { useEffect, useSyncExternalStore } from "react";

import type { WardReconciliationCheck } from "./ward-shell-types";

/**
 * **OWNER DECISION O-9 — how a ward SCREEN tells the SHELL what it has reconciled.**
 *
 * **His word: *"Yes to your recommendation"*, to building it in the current phase.**
 *
 * 🔴 **THE TOPOLOGY IS WHY THIS IS NOT A PROP.** A ward screen cannot hand anything to the rail or the bar.
 * 🔴 **AND THE REASON IS NOT THE ONE THIS COMMENT FIRST GAVE.** It said the screen is their
 * DESCENDANT. It is not: `layout.tsx` renders `<WardRail />` and `<WardBarMount />` as SIBLINGS
 * of `<WardGround>{children}</WardGround>`. **Siblings cannot pass to each other either, and
 * the layout is a Server Component that cannot derive a screen's checks — so the conclusion
 * stands and the stated reason was wrong.** Until this module
 * existed, `layout.tsx` passed `checks={[]}` on every ward route and nothing under `src/` built a
 * `WardReconciliationCheck[]` at all — so every screen in the application said *"No reconciliation
 * is available for this page yet."*, truthfully, forever.
 *
 * **The pattern is `announceToWardShell`'s (`ward-live-region.tsx`), deliberately** — a module-level
 * store read through `useSyncExternalStore`, solving the same upward-flow problem in the same shell.
 * **Copied in shape, not in text**, because the two carry different data and one of them must
 * survive a server render saying nothing.
 *
 * ---
 *
 * # 🔴 THE ONE THING THIS TYPE EXISTS TO PREVENT
 *
 * **Ward Lead's constraint, and it is the design rather than an obstacle:**
 *
 * > **`checks={[]}` on every route today says NOTHING WAS CHECKED. It must never come to say
 * > EVERYTHING RECONCILES.**
 *
 * **Owner ruling D-40 already fixed what an empty array MEANS when rendered — *"an empty `checks`
 * array is not the same fact as 'every check passed' — it is the fact that nothing was reconciled
 * at all, and this bar must never present the two as identical."*** ⚠️ **But it fixed the rendering,
 * not the plumbing: measured 2026-09-12, NOTHING in this codebase could distinguish *a screen
 * published zero checks* from *no screen has published anything*. Both were `[]`.**
 *
 * ✅ **So the state is a discriminated union and not an array, and the discriminant is not
 * `length`.** **A screen that has genuinely nothing to reconcile can say so — `published: true` with
 * an empty list — and that is a DIFFERENT fact from a screen that has not spoken.** 🔴 **`??` and
 * `|| []` cannot flatten a union; that is the whole reason it is one.** **The moment this becomes
 * `checks ?? []` anywhere, D-40 is defeated silently and every gate stays green.**
 *
 * ⚠️ **The hub's `number | null` is NOT this distinction and must not be cited as precedent for it**
 * — there `null` means nothing ran and `0` means checks ran and none failed, which is a distinction
 * about the PROBLEM COUNT given a known population.
 */
export type WardChecksPublication =
  | {
      /** No screen has published. The shell says so, and says nothing about reconciliation. */
      published: false;
    }
  | {
      published: true;
      /**
       * ⚠️ **May be empty, and an empty one is a CLAIM**: this screen looked and has nothing to
       * reconcile. It is not the same as silence and the shell must not render it as agreement.
       */
      checks: readonly WardReconciliationCheck[];
    };

const NOTHING_PUBLISHED: WardChecksPublication = { published: false };

let state: WardChecksPublication = NOTHING_PUBLISHED;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): WardChecksPublication {
  return state;
}

/**
 * 🔴 **THE SERVER PUBLISHES NOTHING, ALWAYS.** A screen's checks are derived from live reducer
 * state, so a server render cannot have them; returning anything else here is a hydration mismatch
 * waiting for the first route that actually publishes. **Same decision `ward-live-region.tsx` makes
 * for the same reason — it starts silent on every server render.**
 */
function getServerSnapshot(): WardChecksPublication {
  return NOTHING_PUBLISHED;
}

function setState(next: WardChecksPublication): void {
  state = next;
  for (const listener of Array.from(listeners)) listener();
}

/**
 * What the shell reads. **Never returns an array** — the caller must handle the unpublished case by
 * name, which is what stops it being collapsed into "empty".
 */
export function useWardChecks(): WardChecksPublication {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * **What a SCREEN calls, once, near the top of its component.**
 *
 * ⚠️ **IT PUBLISHES IN AN EFFECT, NOT DURING RENDER.** Writing to a module store while rendering
 * would update the rail and the bar in the middle of the screen's own render — React's
 * *"cannot update a component while rendering a different component"*, and on a route change it
 * would paint the incoming screen's checks over the outgoing one's before either had committed.
 *
 * 🔴 **AND IT CLEARS ON UNMOUNT, WHICH IS THE HALF THAT KEEPS THE SHELL HONEST.** Without it, a
 * screen that published a passing check would leave that claim standing on the NEXT route — a
 * reconciliation sentence about a page the reader has already left. **A stale true claim is worse
 * than no claim: it is the shape nobody checks.**
 *
 * @param checks the screen's own checks. Pass a stable or memoised array — it is compared by
 *   identity, so a new array literal on every render republishes on every render.
 */
export function useWardChecksPublisher(checks: readonly WardReconciliationCheck[]): void {
  useEffect(() => {
    setState({ published: true, checks });
    return () => {
      setState(NOTHING_PUBLISHED);
    };
  }, [checks]);
}

/**
 * Test-only reset, so one test file's publication never leaks into the next.
 *
 * ⚠️ **A module store outlives a `render()`**, and a leaked publication would make the NEXT test's
 * shell claim a reconciliation it never published — green, and about the wrong page.
 */
export function resetWardChecksForTests(): void {
  state = NOTHING_PUBLISHED;
  listeners.clear();
}
