import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Imported, not re-implemented: the CI unit shards call these exact functions.
import { readUnitDurations, selectGateShard } from "../scripts/check-ward-expected-reds.mjs";

const population = Array.from({ length: 40 }, (_, index) => `tests/file-${String(index).padStart(2, "0")}.test.ts`);

function allShards(files: string[], count: number, durations?: Record<string, number>) {
  return Array.from({ length: count }, (_, index) =>
    selectGateShard(files, { index: index + 1, count }, durations),
  ) as string[][];
}

function expectExactCover(shards: string[][], files: string[]) {
  const dealt = shards.flat();
  expect(new Set(dealt).size).toBe(dealt.length);
  expect([...dealt].sort()).toEqual([...files].sort());
}

describe("unit gate shards", () => {
  it("without measurements, deals every count-th sorted file (the previous split)", () => {
    const shards = allShards(population, 5);
    expectExactCover(shards, population);
    expect(shards[0]).toEqual(population.filter((_, position) => position % 5 === 0));
  });

  it("with measurements, every file runs exactly once and the slowest shard is near the average", () => {
    const durations = Object.fromEntries(population.map((file, index) => [file, index < 3 ? 30 : (index % 7) + 1]));
    const shards = allShards(population, 5, durations);
    expectExactCover(shards, population);
    const totals = shards.map((files) => files.reduce((sum, file) => sum + durations[file], 0));
    const average = totals.reduce((sum, total) => sum + total, 0) / totals.length;
    expect(Math.max(...totals)).toBeLessThanOrEqual(average + 7);
  });

  it("counts an unmeasured file as the median, so a new test file is still dealt exactly once", () => {
    const durations = Object.fromEntries(population.slice(0, 30).map((file) => [file, 2]));
    const shards = allShards([...population, "tests/brand-new.test.ts"], 4, durations);
    expectExactCover(shards, [...population, "tests/brand-new.test.ts"]);
  });

  it("spreads files recorded as zero seconds instead of piling them onto one shard", () => {
    const durations = Object.fromEntries(population.map((file, index) => [file, index < 5 ? 10 : 0]));
    const sizes = allShards(population, 5, durations).map((files) => files.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  });

  it("does not depend on the order the population was discovered in", () => {
    const durations = Object.fromEntries(population.map((file, index) => [file, (index * 13) % 11]));
    expect(allShards([...population].reverse(), 3, durations)).toEqual(allShards(population, 3, durations));
  });

  it("ignores a missing or unreadable durations record rather than failing the gate", () => {
    const folder = mkdtempSync(path.join(tmpdir(), "ward-unit-durations-"));
    expect(readUnitDurations(path.join(folder, "absent.json"))).toEqual({});
    writeFileSync(path.join(folder, "broken.json"), "{ not json");
    expect(readUnitDurations(path.join(folder, "broken.json"))).toEqual({});
    writeFileSync(path.join(folder, "ok.json"), JSON.stringify({ seconds: { "tests/a.test.ts": 4 } }));
    expect(readUnitDurations(path.join(folder, "ok.json"))).toEqual({ "tests/a.test.ts": 4 });
  });
});
