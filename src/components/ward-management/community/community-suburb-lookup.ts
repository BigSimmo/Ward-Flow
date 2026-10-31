/**
 * The one suburb lookup's engine (D-91): a whole suburb, an alias or a 4-digit postcode, read
 * through `lookupCatchment()`, so a contested or unreviewed suburb keeps its own state and note.
 *
 * Build note: this matches #1123's `catchmentLookupsFor` (`tools/ward-catchment-query.ts`), which
 * is not on this branch yet. Once #1123 lands, import its function and delete this file.
 */
import {
  S2015_CATCHMENT_ROWS,
  lookupCatchment,
  normaliseSuburbKey,
  type CatchmentLookup,
} from "@/components/ward-management/ward-catchment";

/** Each postcode's suburbs, in table order, from the one document that carries postcodes. */
const SUBURBS_BY_POSTCODE: ReadonlyMap<string, readonly string[]> = (() => {
  const map = new Map<string, string[]>();
  const seen = new Set<string>();
  for (const row of S2015_CATCHMENT_ROWS) {
    if (!row.postcode) continue;
    const key = `${row.postcode}|${normaliseSuburbKey(row.suburb)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const bucket = map.get(row.postcode) ?? [];
    bucket.push(row.suburb);
    map.set(row.postcode, bucket);
  }
  return map;
})();

/** Whether the typed words read as a postcode (four digits), not a suburb. */
export function isPostcodeQuery(rawQuery: string): boolean {
  return /^\d{4}$/.test(rawQuery.trim());
}

/**
 * One lookup per suburb the typed text names: a 4-digit postcode reads every suburb filed under it
 * (none when no suburb is filed under it), anything else is read as one suburb or alias. A part
 * word is never guessed into a suburb: it reads as not found, with the lookup's own note.
 */
export function catchmentLookupsFor(rawQuery: string): readonly CatchmentLookup[] {
  const query = rawQuery.trim();
  if (!query) return [];
  if (isPostcodeQuery(query)) return (SUBURBS_BY_POSTCODE.get(query) ?? []).map((suburb) => lookupCatchment(suburb));
  return [lookupCatchment(query)];
}
