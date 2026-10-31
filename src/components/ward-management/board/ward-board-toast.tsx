"use client";

import type { ActionToast } from "@/components/ward-management/ward-action-toast";
import { useActionToastMirror } from "@/components/ward-management/use-action-toast";

/**
 * The bed board's action toast, for a screen that still keeps its outcome in its own state. Since
 * the notifications pass (30 Oct 2026) it draws nothing itself: the shared toast region shows each
 * outcome, a refusal with the warning glyph and tone (walk-through WT-10), and keeps a refusal until
 * it is closed. The bed board itself uses `useActionToast`.
 */
export function BoardToastView({ toast }: { toast: ActionToast | null }) {
  useActionToastMirror(toast, "ward-board-toast");
  return null;
}
