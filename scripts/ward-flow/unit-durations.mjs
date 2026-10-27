import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { isOfflineUnitTestFile } from "../unit-test-population.mjs";
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
export function measurementsFromBlobs(blobFiles, root) {
  const { parse } = createRequire(createRequire(import.meta.url).resolve("vitest/package.json"))("flatted");
  const seconds = {};
  const phasesMilliseconds = {};
  const versions = new Set();
  const shards = [];
  for (const blob of blobFiles) {
    const [version, files, errors, , executionTime] = parse(readFileSync(blob, "utf8"));
    if (typeof version !== "string" || !Array.isArray(files)) throw new Error(`Invalid Vitest blob: ${blob}`);
    versions.add(version);
    shards.push({
      blob: path.basename(blob),
      executionMilliseconds: executionTime,
      files: files.length,
      errors: errors?.length ?? 0,
    });
    for (const file of files) {
      const relative = path.relative(root, file.filepath).split(path.sep).join("/");
      if (!isOfflineUnitTestFile(relative)) throw new Error(`Blob file outside the offline population: ${relative}`);
      if (Object.hasOwn(seconds, relative)) throw new Error(`Repeated duration measurement: ${relative}`);
      const phase = {
        environment: file.environmentLoad ?? 0,
        prepare: file.prepareDuration ?? 0,
        collect: file.collectDuration ?? 0,
        setup: file.setupDuration ?? 0,
        tests: file.result?.duration ?? 0,
      };
      if (Object.values(phase).some((value) => !Number.isFinite(value) || value < 0))
        throw new Error(`Invalid duration measurement: ${relative}`);
      const milliseconds = Object.values(phase).reduce((sum, value) => sum + value, 0);
      seconds[relative] = Math.round(milliseconds / 100) / 10;
      phasesMilliseconds[relative] = phase;
    }
  }
  const sorted = (record) => Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
  return {
    seconds: sorted(seconds),
    phasesMilliseconds: sorted(phasesMilliseconds),
    versions: [...versions].sort(),
    shards,
  };
}

export function durationsFromBlobs(blobFiles, root) {
  return measurementsFromBlobs(blobFiles, root).seconds;
}

/** Missing and changed records stay visible; unknown files retain the sequencer's median fallback. */
export function durationFreshness(population, record, sourceHashes = {}) {
  const present = new Set(population);
  const seconds = record.seconds ?? {};
  const measured = (file) => Number.isFinite(seconds[file]) && seconds[file] >= 0;
  const missing = population.filter((file) => !measured(file)).sort();
  return {
    recordedAt: record.metadata?.measuredAt ?? null,
    recordedSource: record.source ?? null,
    populationCount: population.length,
    measuredCount: population.length - missing.length,
    unmeasuredFraction: population.length ? missing.length / population.length : 0,
    missing,
    obsolete: Object.keys(seconds)
      .filter((file) => !present.has(file))
      .sort(),
    sourceChanged: population
      .filter(
        (file) =>
          measured(file) &&
          record.sourceHashes?.[file] &&
          sourceHashes[file] &&
          record.sourceHashes[file] !== sourceHashes[file],
      )
      .sort(),
    sourceIdentityUnknown: population
      .filter((file) => measured(file) && (!record.sourceHashes?.[file] || !sourceHashes[file]))
      .sort(),
  };
}

function currentPopulation(root) {
  const walk = (directory) =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const absolute = path.join(directory, entry.name);
      return entry.isDirectory() ? walk(absolute) : [path.relative(root, absolute).split(path.sep).join("/")];
    });
  return walk(path.join(root, "tests")).filter(isOfflineUnitTestFile).sort();
}

export function unitTimingReport(blobFiles, root, previous = { seconds: readUnitDurations() }) {
  const measurements = measurementsFromBlobs(blobFiles, root);
  const population = currentPopulation(root);
  const hash = (file) =>
    createHash("sha256")
      .update(readFileSync(path.join(root, file)))
      .digest("hex");
  const sourceHashes = Object.fromEntries(population.map((file) => [file, hash(file)]));
  return {
    schemaVersion: 1,
    ...measurements,
    sourceHashes,
    freshness: durationFreshness(population, previous, sourceHashes),
    measurementCompleteness: durationFreshness(
      population,
      { seconds: measurements.seconds, sourceHashes },
      sourceHashes,
    ),
    metadata: {
      measuredAt: new Date().toISOString(),
      commit: process.env.GITHUB_SHA ?? null,
      node: process.version,
      packageLockSha256: hash("package-lock.json"),
      coverageInventorySha256: hash("scripts/coverage-contract.mjs"),
      configurationSha256: hash("vitest.config.mts"),
      note: "Observed worker phase durations; not hosted savings. File hashes identify test source only; dependent code changes require a representative refresh. Refresh balancing weights only from a complete run.",
    },
  };
}

// Report-only extraction from the normal shard run; this never launches more tests.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const index = process.argv.indexOf("--from-blobs");
  const outputIndex = process.argv.indexOf("--output");
  if (index < 0 || !process.argv[index + 1] || (outputIndex >= 0 && !process.argv[outputIndex + 1])) {
    console.error("usage: node scripts/ward-flow/unit-durations.mjs --from-blobs <directory> [--output <json path>]");
    process.exit(2);
  }
  try {
    const directory = process.argv[index + 1];
    const blobs = readdirSync(directory)
      .filter((name) => name.endsWith(".json"))
      .sort()
      .map((name) => path.join(directory, name));
    if (!blobs.length) throw new Error("No unit timing blobs found");
    const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
    const report = unitTimingReport(blobs, root, JSON.parse(readFileSync(UNIT_DURATIONS, "utf8")));
    const json = `${JSON.stringify(report, null, 2)}\n`;
    if (outputIndex >= 0) {
      const output = path.resolve(process.argv[outputIndex + 1]);
      mkdirSync(path.dirname(output), { recursive: true });
      writeFileSync(output, json);
    }
    console.log(json);
    // The report above runs past what a tail of the job log keeps, so end with the balancing record
    // on one line: copy it into unit-durations.json "seconds" to rebalance the shards.
    console.log(`[unit-timing] seconds ${JSON.stringify(report.seconds)}`);
    console.error(
      `[unit-timing] ${report.freshness.missing.length}/${report.freshness.populationCount} (${(100 * report.freshness.unmeasuredFraction).toFixed(1)}%) files lack balancing measurements; ${report.freshness.sourceIdentityUnknown.length} recorded files lack verified source identity.`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (outputIndex >= 0) {
      const output = path.resolve(process.argv[outputIndex + 1]);
      mkdirSync(path.dirname(output), { recursive: true });
      writeFileSync(
        output,
        `${JSON.stringify({ schemaVersion: 1, status: "unavailable", error: message }, null, 2)}\n`,
      );
    }
    console.log(`Could not read the unit test costs: ${message}`);
  }
}
