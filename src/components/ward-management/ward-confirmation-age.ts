import { MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";

/**
 * Closing-the-loop package B (24 Oct 2026): how long ago something was confirmed, from its
 * recorded time, so a reader can see a confirmation going stale ("confirmed 3 h ago by NUM 4A").
 * A plain reading of two recorded times, never a judgement about whether it is too old.
 */
export function ageText(at: Instant, now: Instant): string {
  const minutes = Math.floor(now - at);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < MINUTES_PER_DAY) return `${Math.floor(minutes / 60)} h ago`;
  const days = Math.floor(minutes / MINUTES_PER_DAY);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

/** "confirmed 3 h ago by NUM Ward 4A". `verb` names the act ("confirmed", "recorded", "accepted"). */
export function confirmationAge(at: Instant, now: Instant, by?: string | null, verb = "confirmed"): string {
  return `${verb} ${ageText(at, now)}${by ? ` by ${by}` : ""}`;
}
