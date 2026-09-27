import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { keepJourneyFailures } from "../scripts/ward-flow/keep-journey-failures.mjs";

// The unsharded rerun wipes test-results/, so a spec that failed in a shard and passed alone left
// no trace to diagnose (full-journey:126, 26 September 2026). These copies must survive that wipe.
describe("keepJourneyFailures", () => {
  it("copies each shard's failure artefacts out of test-results so a later wipe cannot lose them", () => {
    const projectRoot = mkdtempSync(path.join(tmpdir(), "ward-keep-project-"));
    const logsRoot = mkdtempSync(path.join(tmpdir(), "ward-keep-logs-"));
    const failure = path.join(projectRoot, "test-results", "shard-3", "ui-ward-full-journey-a");
    mkdirSync(failure, { recursive: true });
    writeFileSync(path.join(failure, "error-context.md"), "the failing step");
    writeFileSync(path.join(failure, "trace.zip"), "trace bytes");
    mkdirSync(path.join(projectRoot, "test-results", "shard-1"), { recursive: true }); // empty: nothing to keep

    const kept = keepJourneyFailures({
      projectRoot,
      shardCount: 4,
      logsRoot,
      now: new Date("2026-09-26T09:10:00.000Z"),
    });

    // What the unsharded rerun does to the originals.
    rmSync(path.join(projectRoot, "test-results"), { recursive: true, force: true, maxRetries: 5 });

    expect(kept).toBe(path.join(logsRoot, "journey-failures", "2026-09-26T09-10-00-000Z"));
    const copy = path.join(kept!, "shard-3", "ui-ward-full-journey-a");
    expect(readFileSync(path.join(copy, "error-context.md"), "utf8")).toBe("the failing step");
    expect(readFileSync(path.join(copy, "trace.zip"), "utf8")).toBe("trace bytes");
    expect(existsSync(path.join(kept!, "shard-1"))).toBe(false);
  });

  it("returns null and writes nothing when no shard left artefacts", () => {
    const projectRoot = mkdtempSync(path.join(tmpdir(), "ward-keep-project-"));
    const logsRoot = mkdtempSync(path.join(tmpdir(), "ward-keep-logs-"));
    expect(keepJourneyFailures({ projectRoot, shardCount: 4, logsRoot })).toBeNull();
    expect(existsSync(path.join(logsRoot, "journey-failures"))).toBe(false);
  });
});
