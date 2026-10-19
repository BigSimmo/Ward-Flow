/**
 * PLACE QUESTIONS THE HEADER SEARCH ANSWERS (search review, 19 October 2026).
 *
 * Two shapes of question that used to find nothing:
 *
 *   - "free beds", "ready beds", "empty beds": the wards whose recorded ready count is above zero.
 *     Ready is `unitReadyBedCount`, the same min(allocatable, empty) every other screen shows, and
 *     a ward that has not recorded both figures is left out rather than guessed. The list keeps the
 *     network's own order: it is not a ranking and nothing in it is a "best match".
 *   - "Graylands bed 4", "4B bed 12": one bed on one ward, opened on the ward screen through the
 *     same `?bed=` address the Patients page's "Ward bed" button uses. A bed number the ward does not
 *     have is not offered. Who is in the bed is left to the ward screen, which owns that layout.
 *
 * Pure functions over the records the caller already holds. No provider calls, no storage.
 */
import type { Unit } from "@/components/ward-management/ward-model";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { unitHref } from "../shell/ward-facade";

const READY_BED_QUERY =
  /^(?:(?:any|show|list|wards?\s+with)\s+)?(?:free|ready|empty|available|vacant|open)\s+beds?$|^beds?\s+(?:free|ready|available)$/i;

/** True when the whole query asks which wards have a bed ready, e.g. "free beds" or "beds available". */
export function isReadyBedQuery(query: string): boolean {
  return READY_BED_QUERY.test(query.trim().replace(/\s+/g, " "));
}

/** Words around a bed question that say nothing about which ward ("who is in", "on", "the"). */
const BED_FILLER = new Set(["who", "whos", "is", "in", "on", "at", "the", "of", "ward"]);

export type BedQuery = { wardText: string; bedNumber: number };

/**
 * "Graylands bed 4", "bed 4 Graylands", "who is in bed 12 on 4B". `undefined` when the query names
 * no bed, or names a bed but no ward: a bare "bed 4" exists on every ward, and listing them all
 * would bury the one that was meant.
 */
export function parseBedQuery(query: string): BedQuery | undefined {
  const text = query.trim().toLowerCase();
  const match = /\bbed\s*(?:no\.?|number|#)?\s*(\d{1,3})\b/.exec(text);
  if (!match) return undefined;
  const bedNumber = Number.parseInt(match[1]!, 10);
  if (!Number.isFinite(bedNumber) || bedNumber < 1) return undefined;
  const rest = `${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)}`;
  const words = rest
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0 && !BED_FILLER.has(word.replace(/['’]/g, "")));
  if (words.length === 0) return undefined;
  return { wardText: words.join(" "), bedNumber };
}

export type BedSearchResult = {
  unit: Unit;
  bedNumber: number;
  siteName: string;
  href: string;
};

/** The beds a bed question names: every ward matching all its words that has that bed number. */
export function searchBeds(query: string, units: readonly Unit[]): BedSearchResult[] {
  const parsed = parseBedQuery(query);
  if (!parsed) return [];
  const tokens = parsed.wardText.split(" ");
  return units.flatMap((unit) => {
    if (parsed.bedNumber > unit.beds) return [];
    const siteName = siteByCode(unit.siteCode)?.name ?? unit.siteCode;
    const haystack = `${unit.name} ${unit.siteCode} ${unit.id} ${siteName} ${unit.cohort}`.toLowerCase();
    if (!tokens.every((token) => haystack.includes(token))) return [];
    return [
      {
        unit,
        bedNumber: parsed.bedNumber,
        siteName,
        href: `${unitHref(unit.id)}?bed=${parsed.bedNumber}`,
      },
    ];
  });
}

/** A ward row's facts after its ready count: locked beds and any sex designation, as recorded. */
export function wardFactsLine(unit: Pick<Unit, "beds" | "lockedBeds" | "sexDesignation">): string {
  const parts: string[] = [];
  if (unit.lockedBeds > 0) {
    parts.push(unit.lockedBeds >= unit.beds ? "all beds locked" : `${unit.lockedBeds} locked`);
  }
  if (unit.sexDesignation !== "Undesignated") parts.push(unit.sexDesignation);
  return parts.join(" · ");
}
