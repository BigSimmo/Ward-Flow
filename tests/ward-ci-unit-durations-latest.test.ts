import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  chooseUnitDurations,
  newestMainArtifact,
  validSeconds,
} from "../scripts/ward-ci-public/unit-durations-latest.mjs";
import { readUnitDurations } from "../scripts/ward-flow/unit-durations.mjs";

// D-166: the unit shards are dealt from main's newest measured timings, chosen once per run.
const directories: string[] = [];
function scratch() {
  const directory = mkdtempSync(path.join(tmpdir(), "ward-unit-durations-test-"));
  directories.push(directory);
  return directory;
}
afterEach(() => {
  delete process.env.WARD_UNIT_DURATIONS_FILE;
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});

function artifact(overrides: Record<string, unknown> = {}, run: Record<string, unknown> = {}) {
  return {
    name: "ward-unit-durations",
    expired: false,
    created_at: "2026-11-12T17:06:01Z",
    workflow_run: {
      id: 43257104889,
      head_branch: "main",
      head_sha: "3f8a6a8f",
      repository_id: 1,
      head_repository_id: 1,
      ...run,
    },
    ...overrides,
  };
}

describe("unit shard timings for this run", () => {
  it("takes the newest unexpired record from this repository's main", () => {
    const newest = artifact({ created_at: "2026-11-12T18:00:00Z" }, { id: 2 });
    const payload = {
      artifacts: [
        artifact(),
        newest,
        artifact({ created_at: "2026-11-13T00:00:00Z", expired: true }, { id: 3 }),
        artifact({ created_at: "2026-11-13T00:00:00Z" }, { id: 4, head_branch: "feature" }),
        artifact({ created_at: "2026-11-13T00:00:00Z" }, { id: 5, head_repository_id: 2 }),
        artifact({ created_at: "2026-11-13T00:00:00Z", name: "ward-unit-durations-9" }, { id: 6 }),
      ],
    };
    expect(newestMainArtifact(payload)).toBe(newest);
    expect(newestMainArtifact({ artifacts: [] })).toBeNull();
    expect(newestMainArtifact(null)).toBeNull();
  });

  it("accepts only test paths with finite, non-negative seconds", () => {
    expect(validSeconds({ seconds: { "tests/b.test.ts": 2, "tests/a.test.ts": 0 } })).toEqual({
      "tests/a.test.ts": 0,
      "tests/b.test.ts": 2,
    });
    for (const seconds of [{}, [], { "tests/a.test.ts": -1 }, { "tests/a.test.ts": "2" }, { "../a.test.ts": 1 }])
      expect(validSeconds({ seconds }), JSON.stringify(seconds)).toBeNull();
    expect(validSeconds(null)).toBeNull();
  });

  it("uses main's record when it can be read", () => {
    const calls: string[][] = [];
    const exec = (_command: string, args: string[]) => {
      calls.push(args);
      if (args[0] === "api") return JSON.stringify({ artifacts: [artifact()] });
      const directory = args[args.indexOf("--dir") + 1];
      writeFileSync(
        path.join(directory, "ward-unit-costs.json"),
        JSON.stringify({ seconds: { "tests/a.test.ts": 3 } }),
      );
      return "";
    };
    const chosen = chooseUnitDurations({ repo: "BigSimmo/Ward-Flow", exec });
    expect(chosen.seconds).toEqual({ "tests/a.test.ts": 3 });
    expect(chosen.source).toContain("main run 43257104889");
    expect(calls[1]).toEqual(
      expect.arrayContaining(["run", "download", "43257104889", "--name", "ward-unit-durations"]),
    );
  });

  it("falls back to the committed record when main's cannot be read or is malformed", () => {
    const committed = path.join(scratch(), "committed.json");
    writeFileSync(committed, JSON.stringify({ seconds: { "tests/c.test.ts": 1 } }));
    const failing = () => {
      throw new Error("HTTP 403");
    };
    expect(chooseUnitDurations({ repo: "BigSimmo/Ward-Flow", exec: failing, committed })).toEqual({
      seconds: { "tests/c.test.ts": 1 },
      source: "the committed scripts/ward-flow/unit-durations.json (HTTP 403)",
    });
    const malformed = (_command: string, args: string[]) => {
      if (args[0] === "api") return JSON.stringify({ artifacts: [artifact()] });
      writeFileSync(
        path.join(args[args.indexOf("--dir") + 1], "x.json"),
        JSON.stringify({ seconds: { "tests/a.test.ts": -2 } }),
      );
      return "";
    };
    expect(chooseUnitDurations({ repo: "BigSimmo/Ward-Flow", exec: malformed, committed }).seconds).toEqual({
      "tests/c.test.ts": 1,
    });
  });

  it("makes every shard read the named record, and fails loudly rather than deal a different split", () => {
    const file = path.join(scratch(), "chosen.json");
    writeFileSync(file, JSON.stringify({ seconds: { "tests/a.test.ts": 7 } }));
    process.env.WARD_UNIT_DURATIONS_FILE = file;
    expect(readUnitDurations()).toEqual({ "tests/a.test.ts": 7 });
    process.env.WARD_UNIT_DURATIONS_FILE = path.join(path.dirname(file), "missing.json");
    expect(() => readUnitDurations()).toThrow();
    delete process.env.WARD_UNIT_DURATIONS_FILE;
    expect(Object.keys(readUnitDurations()).length).toBeGreaterThan(2000);
  });
});
