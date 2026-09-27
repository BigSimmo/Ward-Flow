#!/usr/bin/env node
/**
 * Generates `src/components/ward-management/reference/ward-reference-registry.ts` from the
 * prepared WA reference pack at `docs/ward-flow/reference-data/entities.json`.
 *
 * WHAT THE REGISTRY IS FOR. Ward Flow's demo network invents every number — beds, occupancy, sex
 * mix, the lot — and `ward-sites.ts` says so at the top in capitals. What it should not invent is
 * WHAT THINGS ARE CALLED. The pack carries real, sourced names for 28 facilities, 12 emergency
 * departments, 26 wards and units, and 32 community services, each with its provenance. This module
 * is how a demo unit gets to be called "Ward 2K" or "Moodjar" instead of "RPH Adult Secure".
 *
 * 🔴 THE BOUNDARY, AND IT IS STRUCTURAL RATHER THAN A RULE. `ReferenceEntity` HAS NO NUMERIC FIELD
 * OF ANY KIND, and this generator writes none. Not `staffed_beds`, not `available_beds`, not
 * `commissioned_beds`, not a capacity assertion. So there is nothing for an unratified bed count to
 * leak through — no import to police, no lint to remember, no reviewer to catch it. A rule saying
 * "do not import capacity" would depend on everyone reading it; a type with no number in it does
 * not.
 *
 * ⚠️ WHY THAT MATTERS HERE SPECIFICALLY. Every row in the pack carries
 * `operational_use_approved: false` and `automatic_routing_approved: false`, and its own standing
 * rules say null means unknown rather than zero, chairs are not beds, and aggregates are not wards.
 * Graylands is published as BOTH 109 and 122 beds and the pack's decision D1 is "prefer neither".
 * A registry that carried numbers would be one careless import away from putting a disputed,
 * unratified figure on a screen that looks authoritative.
 *
 * ⚠️ READS THE JSON, NEVER THE CSVs. `docs/ward-flow/reference-data/*.json` is the pack's working
 * master; the CSV exports beside it are derived views.
 *
 * Run: `npm run ward:reference:build`. Checked by `npm run check:ward-reference`, which regenerates
 * into memory and fails if the committed file differs.
 */

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { format, resolveConfig } from "prettier";

const PROJECT_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PACK = join(PROJECT_ROOT, "docs/ward-flow/reference-data/entities.json");
const OUT = join(PROJECT_ROOT, "src/components/ward-management/reference/ward-reference-registry.ts");

/** The five kinds Ward Flow can name something after. The pack's other eleven kinds — capacity
 *  groups, design components, staged units, form catalogue items, referral pathways, catchment
 *  source documents — are records ABOUT the network rather than places in it, and deliberately do
 *  not appear here. `record_kind` in the pack is what distinguishes them. */
const KINDS = {
  facility: "facility_id",
  emergency_department: "ed_id",
  named_ward: "unit_id",
  named_unit: "unit_id",
  community_service: "team_id",
};

function build() {
  const pack = JSON.parse(readFileSync(PACK, "utf8"));
  const rows = [];
  for (const entity of pack.entities) {
    const kind = entity.entity_kind;
    const idField = KINDS[kind];
    if (idField === undefined) continue;
    const id = entity[idField];
    if (typeof id !== "string" || id.length === 0) {
      throw new Error(
        `reference entity of kind ${kind} has no usable ${idField}: ${JSON.stringify(entity).slice(0, 200)}`,
      );
    }
    rows.push({
      id,
      name: String(entity.name),
      kind,
      facilityId: typeof entity.facility_id === "string" ? entity.facility_id : null,
      cohort: typeof entity.cohort === "string" && entity.cohort.length > 0 ? entity.cohort : null,
      hsp: typeof entity.hsp === "string" && entity.hsp.length > 0 ? entity.hsp : null,
      sourceIds: Array.isArray(entity.source_ids) ? entity.source_ids.map(String) : [],
    });
  }
  rows.sort((a, b) => (a.kind === b.kind ? a.id.localeCompare(b.id) : a.kind.localeCompare(b.kind)));

  const duplicates = rows.map((row) => row.id).filter((id, index, all) => all.indexOf(id) !== index);
  if (duplicates.length > 0) throw new Error(`duplicate reference ids: ${[...new Set(duplicates)].join(", ")}`);

  return { rows, packGeneratedAt: pack.pack_metadata?.pack_generated_at ?? "unknown" };
}

function render({ rows, packGeneratedAt }) {
  const literal = rows
    .map(
      (row) =>
        `  {\n` +
        `    id: ${JSON.stringify(row.id)},\n` +
        `    name: ${JSON.stringify(row.name)},\n` +
        `    kind: ${JSON.stringify(row.kind)},\n` +
        `    facilityId: ${JSON.stringify(row.facilityId)},\n` +
        `    cohort: ${JSON.stringify(row.cohort)},\n` +
        `    hsp: ${JSON.stringify(row.hsp)},\n` +
        `    sourceIds: [${row.sourceIds.map((id) => JSON.stringify(id)).join(", ")}],\n` +
        `  },`,
    )
    .join("\n");

  return `// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Written by \`scripts/ward-flow/build-reference-registry.mjs\` from the prepared WA reference pack
// at \`docs/ward-flow/reference-data/entities.json\` (pack generated ${packGeneratedAt}).
// Regenerate with \`npm run ward:reference:build\`; \`npm run check:ward-reference\` fails if this
// file and the pack have drifted apart.
//
// 🔴 THIS FILE CARRIES NO NUMBERS, AND THAT IS THE DESIGN. Every row in the pack is marked
// \`operational_use_approved: false\` and \`automatic_routing_approved: false\`. Bed counts, capacity
// assertions and catchments are deliberately NOT generated into \`src/\`, so no unratified figure can
// reach a screen by being imported from here. \`tests/ward-reference-registry.test.ts\` asserts the
// absence structurally rather than trusting this comment.
//
// These are real names of real Western Australian services. They are NOT an assertion that any
// service has approved this record, that a ward is currently open, or that a published bed figure
// is current. Ward Flow's own bed numbers remain invented; see the header of \`ward-sites.ts\`.

export type ReferenceEntityKind =
  | "facility"
  | "emergency_department"
  | "named_ward"
  | "named_unit"
  | "community_service";

export type ReferenceEntity = {
  /** The pack's stable research id. NOT a provider's operational identifier. */
  readonly id: string;
  readonly name: string;
  readonly kind: ReferenceEntityKind;
  /** Null for a community service, which belongs to a health service rather than a building. */
  readonly facilityId: string | null;
  /** The pack's own cohort wording, which is wider than Ward Flow's three-value \`Cohort\` union
   *  and must never be copied into it. */
  readonly cohort: string | null;
  readonly hsp: string | null;
  readonly sourceIds: readonly string[];
};

export const WARD_REFERENCE_ENTITIES: readonly ReferenceEntity[] = [
${literal}
];

const BY_ID = new Map(WARD_REFERENCE_ENTITIES.map((entity) => [entity.id, entity]));

/** The entity with this id, or null. Never a fallback, never the nearest match. */
export function referenceEntity(id: string): ReferenceEntity | null {
  return BY_ID.get(id) ?? null;
}

/** Every entity of one kind, in the generated order. */
export function referenceEntitiesOfKind(kind: ReferenceEntityKind): readonly ReferenceEntity[] {
  return WARD_REFERENCE_ENTITIES.filter((entity) => entity.kind === kind);
}
`;
}

/**
 * ⚠️ THE OUTPUT IS RUN THROUGH PRETTIER, and that is load-bearing rather than tidiness. A generated
 * file that the repo's formatter then rewrites can never satisfy its own drift check: regenerate
 * and the check passes, format and it fails, and the two "fixes" undo each other forever. Formatting
 * here, with the repo's own resolved config, makes `generate()` the single answer to what the file
 * should contain. Found the direct way — by committing one that prettier immediately reformatted.
 */
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
  const counts = rows.reduce((acc, row) => ({ ...acc, [row.kind]: (acc[row.kind] ?? 0) + 1 }), {});
  console.log(
    `Wrote ${rows.length} reference entities to src/components/ward-management/reference/ward-reference-registry.ts`,
  );
  for (const [kind, n] of Object.entries(counts).sort()) console.log(`  ${kind.padEnd(22)} ${n}`);
  console.log("\nNo numeric field is generated. Bed counts stay in the pack, unratified, out of src/.");
}
