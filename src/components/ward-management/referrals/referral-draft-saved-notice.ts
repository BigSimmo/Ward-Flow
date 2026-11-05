import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import type { UndoToastApi as ToastApi } from "@/components/ward-management/use-undoable-step";

/**
 * Save draft says so on screen with the time, not only to screen readers, and points to where kept
 * drafts are listed (Settings > Drafts). Q392 keeps drafts in this tab only; this does not change that.
 */
export function noticeDraftKept(toast: ToastApi | null, kept: boolean, at: Date = new Date()): string {
  const time = at.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false });
  const line = kept ? `Draft saved at ${time}` : "Draft not kept: signed in again.";
  if (kept)
    toast?.push({
      tone: "success",
      title: line,
      body: "Open New referral again, or Settings > Drafts, to carry on from it.",
      // #you opens the You section (a sheet on phones), which holds the Drafts card.
      nextStep: { label: "View drafts", href: "/ward-flow/settings#you" },
    });
  announceToWardShell(kept ? `${line}.` : line);
  return line;
}
