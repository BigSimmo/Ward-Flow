/**
 * NUMBERS FOR IDS MADE AT RUN TIME (production audit 24 Oct 2026, ENG-01). A list's length is not a
 * safe id counter: an Undo removes rows, the list gets shorter, and the next row would take a number
 * a later row already holds. The shared fence (`distinctIds`) then refuses the whole world.
 *
 * This returns one more than the highest number ending any id that starts with `prefix`, and never
 * less than `floor` (pass the old length-based number so ids are unchanged until an Undo has run).
 * Ids that start with `prefix` but end in no digits are ignored.
 */
export function nextRuntimeIdNumber(ids: Iterable<string>, prefix: string, floor = 0): number {
  let next = floor;
  for (const id of ids) {
    if (!id.startsWith(prefix)) continue;
    const digits = /(\d+)$/.exec(id.slice(prefix.length));
    if (digits === null) continue;
    next = Math.max(next, Number(digits[1]) + 1);
  }
  return next;
}
