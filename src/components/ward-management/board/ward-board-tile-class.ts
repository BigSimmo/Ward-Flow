import type { StayBandId } from "@/components/ward-management/ward-admissions";
import styles from "./board.module.css";
import type { Tile } from "./ward-board-model";

// The board's tile and band classes, kept apart from `ward-board-model.ts` so the Ward page's Home
// tab, which uses the model's figures but draws no board tiles, does not load the board's styles
// with its first load (phone script budget, PR #1742).

/** The four band fills, in `STAY_BANDS` order. One hue, four deepening steps — see the
 *  `--wb-band-*` tokens in `board.module.css`. Keyed by band id rather than by array index so a
 *  reordering of `STAY_BANDS` cannot silently re-map a shade onto the wrong band. */
export const BAND_CLASS: Record<StayBandId, string> = {
  "under-2-weeks": styles.band1,
  "2-weeks-1-month": styles.band2,
  "1-3-months": styles.band3,
  "over-3-months": styles.band4,
};

/**
 * An EXHAUSTIVE switch on `tile.kind`, not a chain of early returns ending in the occupied case as
 * the fall-through — which is how the blocked tile was broken the moment it was added.
 *
 * The chain read `if empty … if waiting … otherwise treat it as occupied`, so the new third kind
 * silently took the occupied branch, read a `bandId` it does not have, and rendered with the class
 * name `"undefined"` and an occupied fill. **Nothing failed.** `"undefined"` is a legal class name
 * that matches no rule, the tile still drew, and it drew in a plausible-looking colour. It was
 * found by sampling the rendered background of every tile kind on the page — not by a test, and
 * not by reading the diff, where the missing branch is an absence rather than a mistake.
 *
 * The `never` binding below is the guard against the next kind: adding a fifth `Tile` variant and
 * forgetting this function becomes a compile error instead of another silently mis-styled tile.
 */
export function tileClassName(tile: Tile, selected: boolean): string {
  /* Selection is a WEIGHT — a heavier edge — and never a fill. On a sheet that has made no
     decision a filled element reads as a decision made, which is the failure the whole
     colour-never-alone rule exists to prevent; and a fill would additionally collide with the four
     band shades, so a selected band-2 tile would stop being readable as band 2. The word "Selected"
     on the tile face is the channel that survives greyscale and a stripped-background print. */
  const mark = selected ? ` ${styles.bedSelected}` : "";
  switch (tile.kind) {
    case "empty":
      return `${styles.bed} ${styles.bedEmpty}${mark}`;
    case "waiting":
      return `${styles.bed} ${styles.bedWaiting}${mark}`;
    case "blocked":
      return `${styles.bed} ${styles.bedBlocked}${mark}`;
    case "closed":
      return `${styles.bed} ${styles.bedHeld}${mark}`;
    case "occupied": {
      const band = tile.bandId === null ? "" : ` ${BAND_CLASS[tile.bandId]}`;
      const past = tile.pastDate ? ` ${styles.bedPast}` : "";
      return `${styles.bed} ${styles.bedOccupied}${band}${past}${mark}`;
    }
    default: {
      // Unreachable while the switch is exhaustive; a new variant fails to assign here.
      const unhandled: never = tile;
      throw new Error(`Unhandled ward-board tile kind: ${JSON.stringify(unhandled)}`);
    }
  }
}
