import { durMinutes } from "@/components/wf";

const MINUTES_PER_HOUR = 60;

/**
 * Audit two #23 (K26): the one "how long ago" phrase. Under a minute reads "just now"; after that
 * the kit's duration words plus "ago": "6 min ago", "1 h 15 min ago", "5 h ago", "2 d 3 h ago".
 * Whole minutes only, never seconds. Every local "ago" helper calls this one; a bed count's age keeps
 * its own D-210 rounding (`bedCountAgeWords` in ward-clock.ts).
 */
export function agoText(minutes: number): string {
  const whole = Math.max(0, Math.floor(minutes));
  if (whole < 1) return "just now";
  // Under an hour the minutes alone: the kit's `dur` adds seconds under ten minutes.
  return `${whole < MINUTES_PER_HOUR ? `${whole} min` : durMinutes(whole)} ago`;
}

/**
 * How long ago, in whole minutes, for a line that ends in "ago": `under 1 min`, `6 min`, `2 h 05 min`.
 * Never seconds (UX review 20 Nov 2026, pattern B): the kit's `dur` keeps seconds under ten minutes
 * for live countdowns, which read as noise in "6 min 00 s ago". Kept out of the kit so the shared
 * shell every phone page loads does not grow. For a whole "… ago" phrase use `agoText`, which says
 * "just now" under a minute; this stays for lines that put their own word after the length.
 */
export function agoMinutes(minutes: number): string {
  const whole = Math.max(0, Math.floor(minutes));
  if (whole < 1) return "under 1 min";
  if (whole < MINUTES_PER_HOUR) return `${whole} min`;
  return durMinutes(whole);
}
