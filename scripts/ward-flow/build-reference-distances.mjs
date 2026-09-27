#!/usr/bin/env node
/**
 * Generates `src/components/ward-management/reference/ward-reference-distances.ts` from the
 * prepared pack's `distances.json`.
 *
 * WHAT THESE ARE. Real road distances and drive times between metropolitan Perth emergency
 * departments and metropolitan hospital sites, measured on public OpenStreetMap data via OSRM and
 * stamped with their retrieval date. They replace nothing: Ward Flow's own `SYNTHETIC_TRAVEL_BANDS`
 * stay exactly as they are (see below), and these are additional information at the point where a
 * coordinator is choosing a ward for somebody sitting in an ED.
 *
 * 🔴 THEY DO NOT AND CANNOT REPLACE `ward-travel-bands.ts`, AND THE COUNT IS WHY. `TRAVEL_BANDS`
 * maps a WA HOME REGION to a hospital site and covers Kimberley, Pilbara, Mid West and Great
 * Southern. This file covers 26 METROPOLITAN entities and contains no regional pair at all. The two
 * populations do not overlap, so filling one from the other would be answering a different question
 * with a real-looking number. `TRAVEL_BANDS_ARE_INVENTED` therefore stays `true`; that file's own
 * comment calls flipping it a governance act, and nothing here earns it.
 *
 * ⚠️ AN INDICATIVE ROUTE IS NOT A CLINICAL TRAVEL TIME. No traffic, no peak, no ambulance
 * behaviour, no handover time, and the ED pin is the hospital campus rather than its ED door. Every
 * screen that shows one must show `REFERENCE_DISTANCE_CAVEAT` beside it. `operational_use_approved`
 * and `automatic_routing_approved` are false on every row in the pack and nothing here changes
 * that: a distance may inform a person's choice and must never make one.
 *
 * ⚠️ A MISSING PAIR RENDERS NOTHING. Not "unknown", not a dash, not zero. A dash reads as "close"
 * to somebody skimming a column.
 *
 * Run: `npm run ward:reference:build` (this runs with it).
 */

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { format, resolveConfig } from "prettier";

const PROJECT_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PACK = join(PROJECT_ROOT, "docs/ward-flow/reference-data/distances.json");
const OUT = join(PROJECT_ROOT, "src/components/ward-management/reference/ward-reference-distances.ts");

function build() {
  const pack = JSON.parse(readFileSync(PACK, "utf8"));
  const rows = [];
  for (const pair of pack.distances) {
    if (typeof pair.distance_km !== "number" || typeof pair.duration_min !== "number") continue;
    rows.push({
      from: String(pair.from_entity_id),
      to: String(pair.to_entity_id),
      km: Math.round(pair.distance_km * 10) / 10,
      min: Math.round(pair.duration_min),
    });
  }
  rows.sort((a, b) => (a.from === b.from ? a.to.localeCompare(b.to) : a.from.localeCompare(b.from)));

  const regional = rows.filter((row) =>
    /albany|bunbury|broome|geraldton|kalgoorlie|kununurra/.test(`${row.from}${row.to}`),
  );
  if (regional.length > 0) {
    throw new Error(
      `distances.json now contains ${regional.length} regional pair(s). This module documents itself as metropolitan-only, and ward-travel-bands.ts depends on that being true. Revisit both before regenerating.`,
    );
  }

  return { rows, retrievedOn: pack.pack_metadata?.distance_retrieved_on ?? "unknown" };
}

function render({ rows, retrievedOn }) {
  const literal = rows.map((row) => `  ["${row.from}|${row.to}", { km: ${row.km}, min: ${row.min} }],`).join("\n");

  return `// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Written by \`scripts/ward-flow/build-reference-distances.mjs\` from
// \`docs/ward-flow/reference-data/distances.json\` (routes retrieved ${retrievedOn}).
// Regenerate with \`npm run ward:reference:build\`.
//
// ${rows.length} directed metropolitan pairs, measured on public OpenStreetMap data via OSRM.
//
// 🔴 METROPOLITAN ONLY. There is no regional pair here, so this can never fill
// \`ward-travel-bands.ts\`, which maps WA HOME REGIONS (Kimberley, Pilbara, Mid West, Great
// Southern) to sites. Those bands stay invented and \`TRAVEL_BANDS_ARE_INVENTED\` stays true.
//
// 🔴 INDICATIVE, NOT CLINICAL. No traffic, no peak, no ambulance behaviour, no handover. The ED pin
// is the hospital campus, not its door. Show \`REFERENCE_DISTANCE_CAVEAT\` wherever one is rendered.
// Nothing in the pack is approved for operational use or automatic routing.

export type ReferenceDistance = {
  readonly km: number;
  readonly min: number;
};

export const REFERENCE_DISTANCE_CAVEAT =
  "Indicative road distance measured on public map data. Not live traffic, and not a clinical travel time.";

const PAIRS = new Map<string, ReferenceDistance>([
${literal}
]);

/**
 * The measured road route between two reference entities, or null when the pack has no pair for
 * them. Null renders as NOTHING — never "unknown", never a dash, never zero; a dash in a distance
 * column reads as "close" to anyone skimming it.
 */
export function referenceDistance(fromEntityId: string | undefined, toEntityId: string | undefined): ReferenceDistance | null {
  if (fromEntityId === undefined || toEntityId === undefined) return null;
  // "|" separates the two ids. Reference ids are lowercase letters, digits and hyphens, so it
  // cannot appear inside one and cannot make two different pairs collide.
  //
  // 🔴 IT WAS A NUL BYTE UNTIL 2026-09-18, AND THAT IS WHY THIS COMMENT EXISTS. \\u0000 is the
  // obvious separator for a composite Map key and it worked perfectly: tests, tsc and Prettier all
  // passed. Prettier then resolved the escape into a RAW NUL in the generated output, putting 468
  // control characters into a committed source file — the exact damage
  // \`check-source-control-chars.mjs\` was written for after the same thing happened on 2026-09-10.
  // That gate caught it. Never reintroduce a non-printing separator here.
  return PAIRS.get(\`\${fromEntityId}|\${toEntityId}\`) ?? null;
}

/** How many directed pairs are recorded. For tests that must not hard-code a figure that will move. */
export const REFERENCE_DISTANCE_PAIR_COUNT = PAIRS.size;
`;
}

export async function generate() {
  const raw = render(build());
  const config = (await resolveConfig(OUT)) ?? {};
  return format(raw, { ...config, filepath: OUT });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const source = await generate();
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, source, "utf8");
  const { rows } = build();
  console.log(`Wrote ${rows.length} metropolitan road pairs to ward-reference-distances.ts`);
  console.log("No regional pair is present, so ward-travel-bands.ts is untouched and still invented.");
}
