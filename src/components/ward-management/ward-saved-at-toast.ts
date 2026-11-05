import type { ToastApi } from "@/components/wf/toast-provider";

/** "HH:MM" on the 24-hour clock, as every Ward Flow time is shown. */
export function clockTime(at: Date = new Date()): string {
  return at.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** WF-47: one success toast that says what was saved and when ("Saved at HH:MM"). */
export function savedAtToast(toast: ToastApi | null, title: string, at: Date = new Date()): string {
  const body = `Saved at ${clockTime(at)}`;
  toast?.push({ tone: "success", title, body });
  return body;
}
