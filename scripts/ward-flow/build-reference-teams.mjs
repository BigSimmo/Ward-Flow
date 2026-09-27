#!/usr/bin/env node
/**
 * Generates `src/components/ward-management/reference/ward-reference-teams.ts` from the research
 * pack's community-service records.
 *
 * WHAT THIS CARRIES AND WHAT IT DELIBERATELY DOES NOT.
 *
 * It carries the PUBLISHED CONTACT DETAILS of a real WA community mental health service — the phone
 * number, the opening hours and the referral email a directory prints — plus the date that record
 * was taken and whether the service is listed publicly.
 *
 * 🔴 It carries NO NUMERIC CAPACITY FIELD OF ANY KIND, for the same structural reason
 * `ward-reference-registry.ts` carries none: a figure that cannot be generated into `src/` cannot
 * leak into an operational one. Bed counts, staffing and availability stay in the pack.
 *
 * 🔴 MATCHING IS BY EXACT NAME ONLY. The pack forbids the alternative in its own words — never match
 * on suburb, postcode, LGA or proximity — because a contact number attached to the wrong clinic is
 * worse than no number at all. An unmatched team simply has no detail, which is the honest result
 * rather than a gap to close with a guess.
 *
 * ⚠️ NOTHING HERE IS CALL-TESTED. The pack's own note on these rows says "2023 PDF footer contacts
 * may be obsolete", and every record has `operationally_ratified: false`. Whatever renders one of
 * these must say so beside it.
 *
 * Run: npm run ward:reference:build
 * Check: npm run check:ward-reference  (regenerates into memory and fails on any hand-edit)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const PACK = "docs/ward-flow/reference-data/entities.json";
const OUT = "src/components/ward-management/reference/ward-reference-teams.ts";

/** A pack record is a community service iff it has a team id. `published_phone` may still be null. */
function isCommunityService(row) {
  return typeof row.team_id === "string" && row.team_id.length > 0;
}

/** Null means "the register does not say", and never "none" and never an empty string. */
function orNull(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

export function buildReferenceTeams(packJson) {
  const rows = packJson.entities.filter(isCommunityService);
  const kept = rows
    .filter((row) => orNull(row.published_phone) || orNull(row.published_hours) || orNull(row.referral_email))
    .map((row) => ({
      referenceId: row.team_id,
      name: String(row.name).trim(),
      hsp: orNull(row.hsp),
      publishedPhone: orNull(row.published_phone),
      publishedHours: orNull(row.published_hours),
      referralEmail: orNull(row.referral_email),
      address: orNull(row.address),
      directoryStatus: orNull(row.directory_status),
      recordedOn: orNull(row.original_record_date),
    }));
  kept.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return kept;
}

function render(teams) {
  const rows = teams
    .map(
      (t) =>
        `  [\n` +
        `    ${JSON.stringify(t.name)},\n` +
        `    {\n` +
        `      referenceId: ${JSON.stringify(t.referenceId)},\n` +
        `      hsp: ${JSON.stringify(t.hsp)},\n` +
        `      publishedPhone: ${JSON.stringify(t.publishedPhone)},\n` +
        `      publishedHours: ${JSON.stringify(t.publishedHours)},\n` +
        `      referralEmail: ${JSON.stringify(t.referralEmail)},\n` +
        `      address: ${JSON.stringify(t.address)},\n` +
        `      directoryStatus: ${JSON.stringify(t.directoryStatus)},\n` +
        `      recordedOn: ${JSON.stringify(t.recordedOn)},\n` +
        `    },\n` +
        `  ],`,
    )
    .join("\n");

  return `// GENERATED FILE - DO NOT EDIT BY HAND.
// Source: docs/ward-flow/reference-data/entities.json
// Generator: scripts/ward-flow/build-reference-teams.mjs  (npm run ward:reference:build)
// Drift gate: npm run check:ward-reference
//
// 🔴 PUBLISHED CONTACT DETAIL FOR REAL WA COMMUNITY MENTAL HEALTH SERVICES. NOT CALL-TESTED.
// Every record here is \`operationally_ratified: false\` in the pack, and the pack's own note on
// these rows says "2023 PDF footer contacts may be obsolete". Whatever renders one of these must
// say so beside it, with \`recordedOn\`.
//
// 🔴 NO NUMERIC CAPACITY FIELD EXISTS HERE, BY CONSTRUCTION - the same guarantee
// ward-reference-registry.ts makes. A bed count that is never generated into src/ cannot leak into
// an operational figure.
//
// 🔴 LOOKUP IS BY EXACT NAME. The pack forbids matching on suburb, postcode, LGA or proximity, by
// name, because a phone number attached to the wrong clinic is worse than no number. An unmatched
// team returns null, which is the honest answer and never a reason to guess.

export type ReferenceTeamDetail = {
  /** The pack's own team id, e.g. "n-butler". Provenance, never rendered as an identifier. */
  readonly referenceId: string;
  /** Health service provider, e.g. "NMHS". Null where the register does not say. */
  readonly hsp: string | null;
  /** Null means the register does not say - never "none", never a blank that reads as absent. */
  readonly publishedPhone: string | null;
  readonly publishedHours: string | null;
  readonly referralEmail: string | null;
  readonly address: string | null;
  /** e.g. whether the service is listed in a public directory at all. */
  readonly directoryStatus: string | null;
  /** The date the pack recorded this row. Render it beside the detail; it is how old this is. */
  readonly recordedOn: string | null;
};

const TEAMS: ReadonlyMap<string, ReferenceTeamDetail> = new Map([
${rows}
]);

/** Exact-name lookup. Returns null when the register holds no record for that team. */
export function referenceTeamDetail(teamName: string): ReferenceTeamDetail | null {
  return TEAMS.get(teamName.trim()) ?? null;
}

/** Every team name the register carries contact detail for. Sorted, for tests and counts. */
export const REFERENCE_TEAM_NAMES: readonly string[] = [...TEAMS.keys()];

/** Render this beside any detail above. It is the whole caveat, in one sentence. */
export const REFERENCE_TEAM_CAVEAT =
  "Published contact detail from a service directory. Not call-tested, and not confirmed by the service.";
`;
}

function main() {
  const root = process.cwd();
  const pack = JSON.parse(readFileSync(resolve(root, PACK), "utf8"));
  const teams = buildReferenceTeams(pack);
  writeFileSync(resolve(root, OUT), render(teams), "utf8");
  const withPhone = teams.filter((t) => t.publishedPhone !== null).length;
  const withEmail = teams.filter((t) => t.referralEmail !== null).length;
  const withHours = teams.filter((t) => t.publishedHours !== null).length;
  console.log(`${OUT}: ${teams.length} team(s) with published contact detail`);
  console.log(`  phone ${withPhone} · hours ${withHours} · referral email ${withEmail}`);
  console.log("");
  console.log("⚠️  This counts what the PACK holds. How many of them match a team the app actually");
  console.log("    shows is a different number, pinned by tests/ward-reference-teams.test.ts, which");
  console.log("    matches by exact name against COMMUNITY_TEAM_PAGES.");
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("build-reference-teams.mjs")) {
  main();
}
