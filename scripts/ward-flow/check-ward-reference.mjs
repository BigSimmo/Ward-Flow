#!/usr/bin/env node
/**
 * Fails if `src/components/ward-management/reference/ward-reference-registry.ts` has drifted from
 * the pack it is generated from.
 *
 * ⚠️ WHY A GENERATED FILE IS COMMITTED AT ALL, rather than the app reading the JSON at runtime.
 * `docs/ward-flow/reference-data/` is 2MB, most of it catchment assertions Ward Flow does not use.
 * Bundling it to get 98 names would be absurd, and importing from `docs/` into `src/` would make a
 * documentation directory a build input. So the names are generated across the boundary once and
 * committed — which creates exactly one new failure mode, a committed copy that no longer matches
 * its source, and this script is what closes it.
 *
 * It regenerates into memory and compares. It never writes; a drifting file is reported with the
 * command that fixes it, so the repair is always "regenerate", never "hand-edit to match".
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { generate as generateDistances } from "./build-reference-distances.mjs";
import { generate } from "./build-reference-registry.mjs";

const PROJECT_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const REL = "src/components/ward-management/reference/ward-reference-registry.ts";
const DIST_REL = "src/components/ward-management/reference/ward-reference-distances.ts";

/** Both generated files are checked, because either can drift on its own. */
async function checkDistances() {
  let committedDistances;
  try {
    committedDistances = readFileSync(join(PROJECT_ROOT, DIST_REL), "utf8");
  } catch {
    console.log(`🔴 ${DIST_REL} is missing.\n\n   Run: npm run ward:reference:build\n`);
    process.exit(1);
  }
  const expectedDistances = await generateDistances();
  if (committedDistances.replace(/\r\n/g, "\n") !== expectedDistances.replace(/\r\n/g, "\n")) {
    console.log(`🔴 ${DIST_REL} has drifted from docs/ward-flow/reference-data/distances.json.\n`);
    console.log("   Run: npm run ward:reference:build\n");
    process.exit(1);
  }
}

await checkDistances();

let committed;
try {
  committed = readFileSync(join(PROJECT_ROOT, REL), "utf8");
} catch {
  console.log(`🔴 ${REL} is missing.\n\n   Run: npm run ward:reference:build\n`);
  process.exit(1);
}

const expected = await generate();

if (committed.replace(/\r\n/g, "\n") === expected.replace(/\r\n/g, "\n")) {
  console.log(`${REL} and ${DIST_REL} both match the reference pack.\n`);
  console.log("⚠️  This proves the committed names still equal the pack's. It says NOTHING about");
  console.log("    whether the pack itself is current, or whether any WA service has approved a");
  console.log("    record in it — every row is still operational_use_approved: false.\n");
  process.exit(0);
}

console.log(`🔴 ${REL} has drifted from docs/ward-flow/reference-data/entities.json.\n`);
const committedLines = committed.replace(/\r\n/g, "\n").split("\n");
const expectedLines = expected.replace(/\r\n/g, "\n").split("\n");
let shown = 0;
for (let i = 0; i < Math.max(committedLines.length, expectedLines.length) && shown < 10; i += 1) {
  if (committedLines[i] === expectedLines[i]) continue;
  console.log(`  line ${i + 1}`);
  console.log(`    committed: ${committedLines[i] ?? "(end of file)"}`);
  console.log(`    pack says: ${expectedLines[i] ?? "(end of file)"}`);
  shown += 1;
}
console.log("\n   Run: npm run ward:reference:build\n");
console.log("   Never hand-edit the generated file to match. If the PACK is what is wrong, fix the");
console.log("   pack and regenerate — the pack is the record with the provenance on it.\n");
process.exit(1);
