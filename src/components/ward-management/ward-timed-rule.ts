/**
 * One boundary rule for every timed rule (R-HOME-14, Josh 14 Nov 2026, D-210 for late arrival):
 * a rule fires strictly after its minute, so a wait of exactly the limit has not yet crossed it.
 * No threshold value changes; only the comparison is shared.
 */
export function isPastLimit(elapsedMinutes: number, limitMinutes: number): boolean {
  return elapsedMinutes > limitMinutes;
}
