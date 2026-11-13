import type { HomeRegion } from "@/components/ward-management/ward-model";

/**
 * The four bands this prototype speaks in, and the ONLY list any picker, group heading or label
 * map may derive from — the same runtime-array discipline `COHORTS`, `SEXES`, `SEX_DESIGNATIONS`
 * and `REFERRAL_SOURCES` already hold to. A hand-written second copy of these names is how two
 * screens end up disagreeing about what bands exist.
 *
 * A band is a fact about a PAIR — a home region and a hospital site. It belongs to neither, so it
 * is never stored on a `Site`, a `Unit`, a `Referral`, a `Movement`, an event, a snapshot or a
 * cache; it is only ever looked up. That is what keeps replacing this file's values the whole
 * change on the day somebody replaces them with checked ones.
 *
 * `air_transport_only` sits last for grouping order and for nothing else. It is a statement about
 * HOW you get somewhere, not about how long it takes — a flight can be shorter than a drive, and
 * this prototype knows nothing about how anyone actually travels.
 */
export const TRAVEL_BANDS = [
  "under_an_hour",
  "one_to_three_hours",
  "three_hours_or_more",
  "air_transport_only",
] as const;

export type TravelBand = (typeof TRAVEL_BANDS)[number];

/**
 * A sparse table: home region, then site code, then band. Both levels are partial on purpose —
 * an unrecorded pair reads as `undefined`, never as a default.
 */
export type TravelBandTable = Readonly<Partial<Record<HomeRegion, Readonly<Partial<Record<string, TravelBand>>>>>>;

/**
 * One band someone has CHECKED, with who checked it and when. This is the only shape a band can
 * take on its way to a screen.
 *
 * Audit 16 (A16-04, root cause R7), Josh approved 13 Nov 2026: the app shows only bands someone has
 * checked, and every other pair reads as not recorded. The old table, filled in by list position on
 * purpose, told a man in Murdoch that Fiona Stanley was three hours away. It is gone from the app;
 * tests keep their own invented table in `tests/helpers/ward-test-travel-bands.ts` and never need a
 * shown value to be wrong.
 *
 * `checkedBy` names the person or role who checked the band, as Josh gives it. `checkedOn` is the
 * day it was checked, written `YYYY-MM-DD`. A band with neither is not a checked band and has no
 * place in `CHECKED_TRAVEL_BANDS`.
 */
export interface CheckedTravelBand {
  readonly homeRegion: HomeRegion;
  /** A site code from `ward-sites.ts`, such as the code of the hospital the unit sits in. */
  readonly siteCode: string;
  readonly band: TravelBand;
  readonly checkedBy: string;
  readonly checkedOn: string;
}

/**
 * WHERE JOSH'S CHECKED BANDS GO. One entry per home region and hospital site pair, each saying who
 * checked it and on what day. Nothing else in the app holds a band, so adding an entry here is the
 * whole change that makes it show.
 *
 * Empty on purpose: as of 13 Nov 2026 nobody has checked a band, so every pair reads "Travel time
 * not recorded". Do not copy a value in from the test table, from a map lookup an agent did, or
 * from `reference/ward-reference-distances.ts` (metropolitan road distances between hospitals,
 * which say nothing about how far a person lives from one). An entry is added only when Josh gives
 * or signs it.
 *
 * Example of the shape, not a value (do not uncomment it as written):
 *   { homeRegion: "Perth Metropolitan", siteCode: "XXX", band: "under_an_hour",
 *     checkedBy: "Name or role", checkedOn: "YYYY-MM-DD" },
 */
export const CHECKED_TRAVEL_BANDS: readonly CheckedTravelBand[] = [];

/** The sparse lookup table built from a list of bands. A pair not in the list is `undefined`. */
export function travelBandTable(
  entries: readonly Pick<CheckedTravelBand, "homeRegion" | "siteCode" | "band">[],
): TravelBandTable {
  const table: Partial<Record<HomeRegion, Partial<Record<string, TravelBand>>>> = {};
  for (const entry of entries) {
    const row = (table[entry.homeRegion] ??= {});
    row[entry.siteCode] = entry.band;
  }
  return table;
}

/**
 * The table every screen reads, through `ward-distance.ts` and nowhere else. It is built ONLY from
 * `CHECKED_TRAVEL_BANDS`, so no invented band can reach a screen: an unchecked pair is simply
 * absent and reads as not recorded.
 */
export const SHOWN_TRAVEL_BANDS: TravelBandTable = travelBandTable(CHECKED_TRAVEL_BANDS);
