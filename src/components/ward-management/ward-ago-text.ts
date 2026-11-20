import { durMinutes } from "@/components/wf";

/**
 * How long ago, in whole minutes, for a line that ends in "ago": `under 1 min`, `6 min`, `2 h 05 min`.
 * Never seconds (UX review 20 Nov 2026, pattern B): the kit's `dur` keeps seconds under ten minutes
 * for live countdowns, which read as noise in "6 min 00 s ago". Kept out of the kit so the shared
 * shell every phone page loads does not grow.
 */
export function agoMinutes(minutes: number): string {
  const whole = Math.max(0, Math.floor(minutes));
  if (whole < 1) return "under 1 min";
  if (whole < 60) return `${whole} min`;
  return durMinutes(whole);
}
