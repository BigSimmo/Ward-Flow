"use client";

import type { ActionToast } from "@/components/ward-management/ward-action-toast";
import { useActionToast, useActionToastMirror } from "@/components/ward-management/use-action-toast";

/**
 * Audit A-1 (26 Oct 2026): the ward page toast never cleared, so a saved step stayed pinned over
 * the page for the rest of the visit. Since the notifications pass (30 Oct 2026) the shared toast
 * region shows it: a recorded step closes itself, a warning stays until it is closed. The setter
 * pushes straight to that region, so the value it pairs with is always null; both are kept for
 * screens that still pass them to `WardPageActionToast`. The ward page itself uses `useActionToast`.
 */
export function useWardPageToast() {
  const show = useActionToast({ testId: "ward-action-toast" });
  return [null as ActionToast | null, show] as const;
}

/**
 * The ward page's action toast (Owner Rule D4). It draws nothing itself: a value given here is shown
 * by the shared toast region, which carries its own Close.
 */
export function WardPageActionToast({ toast }: { toast: ActionToast | null; onClose?: () => void }) {
  useActionToastMirror(toast, "ward-action-toast");
  return null;
}
