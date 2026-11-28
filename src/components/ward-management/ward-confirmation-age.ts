import { agoText } from "@/components/ward-management/ward-ago-text";
import type { Instant } from "@/components/ward-management/ward-clock";

/**
 * Closing-the-loop package B (24 Oct 2026): how long ago something was confirmed, from its
 * recorded time, so a reader can see a confirmation going stale ("confirmed 3 h 10 min ago by NUM 4A").
 * A plain reading of two recorded times, never a judgement about whether it is too old.
 */
export function ageText(at: Instant, now: Instant): string {
  // Audit two #23: the one shared "ago" phrase ("just now", "3 h 10 min ago").
  return agoText(now - at);
}

/** "confirmed 3 h 10 min ago by NUM Ward 4A". `verb` names the act ("confirmed", "recorded", "accepted"). */
export function confirmationAge(at: Instant, now: Instant, by?: string | null, verb = "confirmed"): string {
  return `${verb} ${ageText(at, now)}${by ? ` by ${by}` : ""}`;
}
