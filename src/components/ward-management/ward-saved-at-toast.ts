import { formatInstant, type Instant } from "@/components/ward-management/ward-clock";
import type { UndoToastApi as ToastApi } from "@/components/ward-management/use-undoable-step";

/**
 * One success toast that says what was saved and when ("Saved at HH:MM"). The time is the board's
 * own clock, the one the saved record shows, not the device's (two-sign-in test, 8 Nov 2026: the
 * shared board ran ahead, so the toast said 18:53 beside a record confirmed at 19:41).
 */
export function savedAtToast(toast: ToastApi | null, title: string, at: Instant): string {
  const body = `Saved at ${formatInstant(at)}`;
  toast?.push({ tone: "success", title, body });
  return body;
}
