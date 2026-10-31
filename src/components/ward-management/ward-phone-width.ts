import { WF_PHONE_QUERY } from "@/components/wf";

/**
 * Phone width right now, for a one-off choice outside render, such as where focus goes when a form
 * opens (search and forms review, 31 Oct 2026). False where the browser cannot answer, so a
 * larger-screen form still takes focus. Rendering uses `useIsPhone` instead.
 */
export function isPhoneWidth(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(WF_PHONE_QUERY).matches
    : false;
}
