import { calendarDateOf, type Instant, perthClockTime } from "@/components/ward-management/ward-clock";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import type { UndoToastApi as ToastApi } from "@/components/ward-management/use-undoable-step";

/**
 * Save draft says so on screen with the time, not only to screen readers, and points to where kept
 * drafts are listed (Settings > Drafts). Q392 keeps drafts in this tab only; this does not change that.
 *
 * The time is the board's (`now` on its `dayZero`), not the device's: in the demonstration the two
 * differ, and a draft saved at the device's 11:00 beside a board reading 10:00 is two clocks on one
 * screen (time audit D8, 13 Nov 2026).
 */
export function noticeDraftKept(toast: ToastApi | null, kept: boolean, now: Instant, dayZero: Date): string {
  // Perth clock, as the board reads, whatever the device's zone (CL-2, 5 Nov 2026).
  const line = kept
    ? `Draft saved at ${perthClockTime(calendarDateOf(now, dayZero))}`
    : "Draft not kept: signed in again.";
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
