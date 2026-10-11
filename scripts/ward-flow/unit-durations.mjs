import { readFileSync } from "node:fs";
import path from "node:path";
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
