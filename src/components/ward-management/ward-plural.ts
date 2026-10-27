/**
 * A count with its noun: `plural(1, "bed", "beds")` reads "1 bed", never "1 beds" (fresh audit
 * W-1, H-0997). Shared so screens stop writing a fixed plural after a count.
 */
export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}
