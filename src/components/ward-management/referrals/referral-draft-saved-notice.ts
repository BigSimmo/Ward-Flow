import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import type { ToastApi } from "@/components/wf/toast-provider";

/** WF-18/WF-47: Save draft says so on screen with the time, not only to screen readers. */
export function noticeDraftKept(toast: ToastApi | null, kept: boolean, at: Date = new Date()): string {
  const time = at.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false });
  const line = kept ? `Draft saved at ${time}` : "Draft not kept: signed in again.";
  if (kept) toast?.push({ tone: "success", title: line, body: "Open New referral again to carry on from it." });
  announceToWardShell(kept ? `${line}.` : line);
  return line;
}
