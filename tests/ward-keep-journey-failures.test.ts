import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { keepJourneyFailures } from "../scripts/ward-flow/keep-journey-failures.mjs";
import { journeyRunVerdict, requestedProjects } from "../scripts/ward-flow/journey-run-verdict.mjs";

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

// Execute the runner's actual child-invocation and cleanup blocks with a fake local Playwright.
// This catches destructive output paths without building Next or launching a browser.
const runner = readFileSync(new URL("../scripts/run-playwright.mjs", import.meta.url), "utf8");
function runnerSection(start: string, end: string) {
  const first = runner.indexOf(start);
  const last = runner.indexOf(end, first);
  if (first < 0 || last <= first) throw new Error(`Runner section no longer found: ${start}`);
  return runner.slice(first, last);
}

describe("Playwright invocation evidence", () => {
  it("retains each invocation's JSON and failure artefacts after build cleanup and a later CSRF run", async () => {
    const projectRoot = mkdtempSync(path.join(tmpdir(), "ward-invocation-"));
    const evidence: string[] = [];
    const verdicts: number[] = [];
    const absoluteRunRoot = path.join(projectRoot, ".next-playwright", "reused-build");
    const report = (projectName: string, failed: boolean) => ({
      config: { projects: [{ name: projectName }] },
      suites: [{ specs: [{ tests: [{ projectName, results: [{ status: failed ? "failed" : "passed" }] }] }] }],
    });
    const allocation = runnerSection("const relativeResultsRoot =", "const relativeDistDir =");
    const cleanup = runnerSection("function cleanup() {", 'process.once("SIGINT"');
    const singleRun = runnerSection("  // The same verdict as the sharded path", "} catch (error) {\n  cleanup();");
    for (const [index, projectName] of ["chromium-mockups", "chromium"].entries()) {
      mkdirSync(absoluteRunRoot, { recursive: true });
      await runInNewContext(
        `(async () => {
        ${allocation}
        let cleaned = false;
        ${cleanup}
        async function exitAfterTypeCheck(code) { verdicts.push(code); cleanup(); }
        ${singleRun}
      })()`,
        {
          path,
          projectRoot,
          runId: "reused-build",
          randomUUID,
          absoluteRunRoot,
          keepBuildRoot: false,
          shardServers: [],
          server: undefined,
          rmdirSync,
          removePathSync: rmSync,
          stopOwnedProcessTree: () => {},
          lock: { release() {} },
          console,
          process: { execPath: "fake-node" },
          playwrightBin: "fake-playwright",
          playwrightArgs: [`--project=${projectName}`],
          testEnv: {},
          verdictOptions: {},
          journeyRunVerdict,
          requestedProjects,
          verdicts,
          readJsonReport: (file: string) => JSON.parse(readFileSync(file, "utf8")),
          childProcessExitCode: (result: { status: number }) => result.status,
          spawnSync: (_command: string, args: string[], options: { env: Record<string, string> }) => {
            // Like Playwright, the next run clears its own output directory before writing.
            const output = path.resolve(projectRoot, args.find((arg) => arg.startsWith("--output="))!.slice(9));
            rmSync(output, { recursive: true, force: true });
            mkdirSync(output, { recursive: true });
            if (index === 0) writeFileSync(path.join(output, "trace.zip"), "original failure");
            const json = options.env.PLAYWRIGHT_JSON_OUTPUT_NAME;
            writeFileSync(json, JSON.stringify(report(projectName, index === 0)));
            evidence.push(json);
            return { status: index === 0 ? 1 : 0 };
          },
        },
      );
      expect(existsSync(absoluteRunRoot)).toBe(false);
    }
    expect(verdicts).toEqual([1, 0]);
    expect(path.dirname(evidence[0])).not.toBe(path.dirname(evidence[1]));
    expect(evidence.every((file) => existsSync(file))).toBe(true);
    expect(readFileSync(path.join(path.dirname(evidence[0]), "tests", "trace.zip"), "utf8")).toBe("original failure");
  });

  it.each([0, 1])("keeps the original shard failure when a diagnostic rerun exits %s", async (diagnosticExit) => {
    let finalExit: number | undefined;
    const outputs: string[][] = [];
    const rerun = runnerSection(
      "    if (exitCode !== 0 && rerun.length > 0",
      "  // The same verdict as the sharded path",
    );
    // The closing brace belongs to the sharded branch surrounding the extracted block.
    await runInNewContext(`(async () => { if (true) { ${rerun} })()`, {
      exitCode: 1,
      rerun: ["a.spec.ts"],
      specFailures: ["a.spec.ts"],
      failedFiles: new Set(["a.spec.ts"]),
      path,
      absoluteResultsRoot: "/evidence/invocation",
      relativeResultsRoot: "test-results/invocation",
      playwrightArgs: ["--project=chromium-mockups"],
      playwrightBin: "fake-playwright",
      projectRoot: "/local",
      testEnv: {},
      process: { execPath: "fake-node" },
      console,
      spawnSync: (_command: string, args: string[], options: { env: Record<string, string> }) => {
        outputs.push(args);
        expect(options.env.PLAYWRIGHT_JSON_OUTPUT_NAME).toBe("/evidence/invocation/diagnostic.json");
        return { status: diagnosticExit };
      },
      childProcessExitCode: (result: { status: number }) => result.status,
      exitAfterTypeCheck: async (code: number) => {
        finalExit = code;
      },
    });
    expect(finalExit).toBe(1);
    expect(outputs[0]).toContain("--output=test-results/invocation/diagnostic");
    expect(outputs[0]).toContain("--reporter=list,json");
  });

  it("also backs up failures from the invocation-scoped shard directory", () => {
    const projectRoot = mkdtempSync(path.join(tmpdir(), "ward-invocation-backup-"));
    const resultsRoot = path.join(projectRoot, "test-results", "invocation");
    mkdirSync(path.join(resultsRoot, "shard-1"), { recursive: true });
    writeFileSync(path.join(resultsRoot, "shard-1", "trace.zip"), "original shard failure");
    const kept = keepJourneyFailures({ projectRoot, resultsRoot, shardCount: 1, logsRoot: projectRoot });
    expect(readFileSync(path.join(kept!, "shard-1", "trace.zip"), "utf8")).toBe("original shard failure");
  });
});
