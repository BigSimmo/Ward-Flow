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

/**
 * A runtime bed release id, "WR-9NN": the length-based number while nothing has been removed, and
 * otherwise one past the highest runtime release still held (H-0334).
 */
export function nextBedReleaseId(releases: readonly { id: string }[]): string {
  const number = nextRuntimeIdNumber(
    releases.map((release) => release.id),
    "WR-9",
    releases.length,
  );
  return `WR-9${String(number).padStart(2, "0")}`;
}

/**
 * `incoming` rows with any id clash against `held` renumbered (ENG-01, H-0334). `makeNotice` counts
 * from `notices.length`, and an Undo withdraws notices, so a new notice can take the id of a later one
 * still held. Only such a clash is renumbered, past the highest number on that subject and kind; every
 * other id is unchanged.
 */
export function withFreshIds<T extends { id: string }>(held: readonly T[], incoming: readonly T[]): T[] {
  const taken = new Set(held.map((row) => row.id));
  return incoming.map((row) => {
    if (!taken.has(row.id)) {
      taken.add(row.id);
      return row;
    }
    const prefix = row.id.replace(/\d+$/, "");
    const id = `${prefix}${nextRuntimeIdNumber(taken, prefix)}`;
    taken.add(id);
    return { ...row, id };
  });
}
