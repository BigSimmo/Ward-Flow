import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BaseSequencer } from "vitest/node";

const UNIT_DURATIONS = new URL("./unit-durations.json", import.meta.url);

/**
 * Measured seconds per unit test file, or {} when the record is missing or unreadable.
 *
 * @param {string | URL} [file]
 * @returns {Record<string, number>}
 */
export function readUnitDurations(file = UNIT_DURATIONS) {
  try {
    const seconds = JSON.parse(readFileSync(file, "utf8")).seconds;
    return seconds && typeof seconds === "object" ? seconds : {};
  } catch {
    return {};
  }
}

/**
 * Test specs ordered longest first by measured seconds (an unmeasured file counts as the median),
 * ties by path, so the order never depends on how the files were discovered.
 */
export function longestFirst(specs, root, durations) {
  const measured = Object.values(durations)
    .filter((seconds) => Number.isFinite(seconds) && seconds >= 0)
    .sort((a, b) => a - b);
  const median = measured.length > 0 ? measured[Math.floor(measured.length / 2)] : 0;
  const cost = (spec) => {
    const seconds = durations[path.relative(root, spec.moduleId).split(path.sep).join("/")];
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : median;
  };
  return specs
    .map((spec) => ({ spec, seconds: cost(spec) }))
    .sort(
      (a, b) =>
        b.seconds - a.seconds || (a.spec.moduleId < b.spec.moduleId ? -1 : a.spec.moduleId > b.spec.moduleId ? 1 : 0),
    )
    .map(({ spec }) => spec);
}

/**
 * Runs a CI unit run's files longest first. A fresh CI runner has no Vitest results cache, so
 * Vitest's own order there is the file listing, and a 2.5-minute file could start after the short
 * ones and leave the shard waiting on it alone (shard 3 of 5 on 11 October 2026: 291 s, about 100 s
 * of it that one file running after every other file had finished; 198 s longest first). Order only:
 * every file still runs, each in its own isolated worker, and the shard split is unchanged.
 */
export class UnitDurationSequencer extends BaseSequencer {
  async sort(files) {
    return longestFirst(files, this.ctx.config.root, readUnitDurations());
  }
}

/**
 * Each test file's cost (environment set-up, import and collection, then its tests) from Vitest blob
 * reports, in seconds rounded to tenths, keyed by repository-relative path: the unit-durations.json
 * record. Blobs are serialised with flatted, Vitest's own dependency.
 */
export function durationsFromBlobs(blobFiles, root) {
  const { parse } = createRequire(createRequire(import.meta.url).resolve("vitest/package.json"))("flatted");
  const seconds = {};
  for (const blob of blobFiles) {
    const [, files] = parse(readFileSync(blob, "utf8"));
    for (const file of files) {
      const milliseconds =
        (file.environmentLoad ?? 0) +
        (file.prepareDuration ?? 0) +
        (file.collectDuration ?? 0) +
        (file.setupDuration ?? 0) +
        (file.result?.duration ?? 0);
      seconds[path.relative(root, file.filepath).split(path.sep).join("/")] = Math.round(milliseconds / 100) / 10;
    }
  }
  return Object.fromEntries(Object.entries(seconds).sort(([a], [b]) => (a < b ? -1 : 1)));
}

// `node scripts/ward-flow/unit-durations.mjs --from-blobs <dir>` prints the measured record from the CI
// unit shards' blob reports (the coverage job runs it), so the record can be refreshed from a real run.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const index = process.argv.indexOf("--from-blobs");
  if (index < 0 || !process.argv[index + 1]) {
    console.error("usage: node scripts/ward-flow/unit-durations.mjs --from-blobs <blob directory>");
    process.exit(2);
  }
  // Report only: a reading problem is printed, never a failed job.
  try {
    const directory = process.argv[index + 1];
    const blobs = readdirSync(directory)
      .filter((name) => name.endsWith(".json"))
      .map((name) => path.join(directory, name));
    const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
    console.log(JSON.stringify({ seconds: durationsFromBlobs(blobs, root) }));
  } catch (error) {
    console.log(`Could not read the unit test costs: ${error instanceof Error ? error.message : error}`);
  }
}
