import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { formatInstant, type Instant } from "@/components/ward-management/ward-clock";

/**
 * TV "changed at" marks (plan item 43; Josh, 10 Nov 2026, D-137). On the ward TV and the bed meeting
 * TV, a tile whose figure changed since the last refresh shows a small "Changed 14:32" for
 * `TV_CHANGE_MARK_MINUTES`, then the mark goes. No flash, no motion: only a line of the tile's own
 * small text.
 *
 * Pure: the screen keeps the last `TvChangeMarks` and passes it back with each refresh's figures.
 * - The first sight of a tile has nothing to compare against, so it shows no mark.
 * - A frozen screen (offline, or the shared refresh down) never records a change: its figures are the
 *   last live ones, so any difference would be invented.
 * - A different screen (another ward, service or scenario) starts again with no marks.
 */

/** How long a changed tile shows its mark, in minutes of the app's clock. Signed by Josh, 10 Nov 2026 (D-137). */
export const TV_CHANGE_MARK_MINUTES = CLINICAL_VALUES.tvChangeMark.value;

export type TvTileFigure = number | string;

export type TvChangeMarks = {
  /** Which screen these figures belong to; a different screen starts again. */
  screen: string;
  tiles: Readonly<Record<string, { figure: TvTileFigure; changedAt: Instant | null }>>;
};

/**
 * The marks after one refresh. Returns `previous` itself when nothing changed, so a caller holding it
 * in state can skip the update.
 */
export function nextTvChangeMarks(
  previous: TvChangeMarks | null,
  screen: string,
  figures: Readonly<Record<string, TvTileFigure>>,
  now: Instant,
  frozen: boolean,
): TvChangeMarks {
  if (previous !== null && frozen && previous.screen === screen) return previous;
  const fresh = previous === null || previous.screen !== screen;
  let changed = fresh;
  const tiles: Record<string, { figure: TvTileFigure; changedAt: Instant | null }> = {};
  for (const [key, figure] of Object.entries(figures)) {
    const before = fresh ? undefined : previous.tiles[key];
    if (before === undefined) {
      tiles[key] = { figure, changedAt: null };
      changed = true;
    } else if (before.figure !== figure) {
      tiles[key] = { figure, changedAt: now };
      changed = true;
    } else {
      tiles[key] = before;
    }
  }
  if (!changed && previous !== null && Object.keys(previous.tiles).length !== Object.keys(tiles).length) changed = true;
  return changed || previous === null ? { screen, tiles } : previous;
}

/** "Changed 14:32" while a tile's mark lasts, or null. Clears at exactly `TV_CHANGE_MARK_MINUTES`. */
export function tvChangeMarkText(marks: TvChangeMarks | null, key: string, now: Instant): string | null {
  const changedAt = marks?.tiles[key]?.changedAt ?? null;
  if (changedAt === null) return null;
  const age = now - changedAt;
  if (age < 0 || age >= TV_CHANGE_MARK_MINUTES) return null;
  return `Changed ${formatInstant(changedAt)}`;
}
