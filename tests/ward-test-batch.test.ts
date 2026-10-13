import { afterEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  batchEnvironment,
  exactPath,
  executeBatch,
  inputIdentity,
  prepareBatch,
  reusableReceipt,
  verifyTestReport,
} from "../scripts/ward-flow/test-batch.mjs";

const folders: string[] = [];
function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), "ward-test-batch-"));
  folders.push(root);
  mkdirSync(path.join(root, "tests"));
  writeFileSync(path.join(root, "tests/one.test.ts"), "synthetic fixture");
  writeFileSync(path.join(root, "tests/two.test.ts"), "second synthetic fixture");
  return root;
}
afterEach(() => {
  for (const folder of folders.splice(0))
    rmSync(folder, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});
const plan = { schemaVersion: 1, tests: ["tests/one.test.ts", "tests/one.test.ts", "tests/two.test.ts"] };
const hash = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");

describe("exact focused selection", () => {
  it("deduplicates files and retains both intended tests", () => {
    expect(prepareBatch(plan, fixture()).tests).toEqual(["tests/one.test.ts", "tests/two.test.ts"]);
  });
  it.each(["../outside.test.ts", "tests/*.test.ts", "--passWithNoTests", "tests/no.test.ts"])(
    "rejects unsafe selection %s",
    (file) => {
      expect(() => exactPath(fixture(), file)).toThrow();
    },
  );
  it.each(["tests/one.live.test.ts", "tests/helpers/tool.ts", "tests/ui.spec.ts"])(
    "refuses live, helper or browser selection %s",
    (file) => {
      const root = fixture();
      mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      writeFileSync(path.join(root, file), "fixture");
      expect(() => prepareBatch({ schemaVersion: 1, tests: [file] }, root)).toThrow("offline unit test");
    },
  );
  it("refuses empty selections and unbounded resources", () => {
    const root = fixture();
    expect(() => prepareBatch({ ...plan, tests: [] }, root)).toThrow();
    expect(() => prepareBatch({ ...plan, workers: 8 }, root)).toThrow();
    expect(() => prepareBatch({ ...plan, timeoutMs: 0 }, root)).toThrow();
    expect(() => prepareBatch({ ...plan, executionMode: "unknown" }, root)).toThrow();
  });
  it("reserves larger batches for guarded admission without dropping files", () => {
    const root = fixture();
    const tests = Array.from({ length: 17 }, (_, i) => `tests/fixture-${i}.test.ts`);
    for (const file of tests) writeFileSync(path.join(root, file), "fixture");
    expect(() => prepareBatch({ schemaVersion: 1, tests }, root)).toThrow("16 exact files");
    expect(prepareBatch({ schemaVersion: 1, tests, executionMode: "guarded" }, root).tests).toHaveLength(17);
  });
  it("automatically includes all source-reading Ward guards", () => {
    const root = fixture();
    mkdirSync(path.join(root, "src/components/ward-management"), { recursive: true });
    writeFileSync(path.join(root, "src/components/ward-management/fixture.ts"), "fixture");
    for (const name of ["ward-referral-screen-boundary", "ward-no-invented-screen-figures", "ward-override-surfaces"])
      writeFileSync(path.join(root, `tests/${name}.test.ts`), "fixture");
    expect(
      prepareBatch({ ...plan, changedFiles: ["src/components/ward-management/fixture.ts"] }, root).tests,
    ).toHaveLength(5);
  });
  it("accepts a deleted ward source as a changed file and still adds the boundary guards", () => {
    const root = fixture();
    for (const name of ["ward-referral-screen-boundary", "ward-no-invented-screen-figures", "ward-override-surfaces"])
      writeFileSync(path.join(root, `tests/${name}.test.ts`), "fixture");
    const batch = prepareBatch({ ...plan, changedFiles: ["src/components/ward-management/deleted.ts"] }, root);
    expect(batch.changedFiles).toEqual(["src/components/ward-management/deleted.ts"]);
    expect(batch.tests).toHaveLength(5);
    expect(() => prepareBatch({ ...plan, changedFiles: ["../outside.ts"] }, root)).toThrow("leaves the repository");
  });
});

describe("evidence safety", () => {
  it("scrubs providers and refuses ambient exclusions", () => {
    const env = batchEnvironment(
      { OPENAI_API_KEY: "synthetic", ALLOW_PROVIDER_TESTS: "true", WARD_GATE_EXCLUDE_FILES: "tests/one.test.ts" },
      2,
    );
    expect(env.OPENAI_API_KEY).toBe("");
    expect(env.ALLOW_PROVIDER_TESTS).toBe("");
    expect(env.WARD_GATE_EXCLUDE_FILES).toBe("");
    expect(env.VITEST_MAX_WORKERS).toBe("2");
  });
  it("rejects zero tests and a missing selected file", () => {
    const root = fixture();
    const report = {
      success: true,
      numFailedTests: 0,
      numFailedTestSuites: 0,
      numTotalTests: 2,
      numPassedTests: 2,
      numPendingTests: 0,
      testResults: [
        { name: path.join(root, "tests/one.test.ts"), assertionResults: [{ status: "passed" }, { status: "passed" }] },
      ],
    };
    expect(() => verifyTestReport({ ...report, numTotalTests: 0 }, ["tests/one.test.ts"], root)).toThrow();
    expect(() => verifyTestReport(report, ["tests/one.test.ts", "tests/two.test.ts"], root)).toThrow();
    expect(verifyTestReport(report, ["tests/one.test.ts"], root).passed).toBe(2);
  });
  it("refuses failed reports even with matching files", () => {
    expect(() => verifyTestReport({ success: false, numFailedTests: 1 }, [], fixture())).toThrow();
  });
  it("requires identical evidence artifacts and never reuses in CI or after failure", () => {
    const root = fixture();
    const tests = ["tests/one.test.ts"];
    const report = {
      success: true,
      numFailedTests: 0,
      numFailedTestSuites: 0,
      numTotalTests: 1,
      numPassedTests: 1,
      numPendingTests: 0,
      testResults: [{ name: path.join(root, tests[0]), assertionResults: [{ status: "passed" }] }],
    };
    writeFileSync(path.join(root, "report.json"), JSON.stringify(report));
    writeFileSync(path.join(root, "run.log"), "synthetic log");
    const receipt = {
      schemaVersion: 1,
      producer: "ward-flow-test-batch",
      repository: "BigSimmo/Ward-Flow",
      root: realpathSync(root),
      scope: "focused batch; not full repository acceptance",
      batch: { tests },
      summary: { files: 1, tests: 1, passed: 1, skipped: 0, todo: 0 },
      status: "passed",
      identity: "same",
      artifacts: {
        testReport: { file: "report.json", hash: hash(path.join(root, "report.json")) },
        log: { file: "run.log", hash: hash(path.join(root, "run.log")) },
      },
    };
    const context = { root, tests };
    expect(reusableReceipt(receipt, "same", root, {}, context)).toBe(true);
    expect(reusableReceipt(receipt, "changed", root, {}, context)).toBe(false);
    expect(reusableReceipt(receipt, "same", root, { CI: "true" }, context)).toBe(false);
    expect(reusableReceipt({ ...receipt, status: "failed" }, "same", root, {}, context)).toBe(false);
    expect(reusableReceipt(null, "same", root, {}, context)).toBe(false);
    expect(
      reusableReceipt(
        { ...receipt, artifacts: { ...receipt.artifacts, log: { file: null, hash: receipt.artifacts.log.hash } } },
        "same",
        root,
        {},
        context,
      ),
    ).toBe(false);
    expect(
      reusableReceipt(
        {
          ...receipt,
          artifacts: { ...receipt.artifacts, log: { file: "../run.log", hash: receipt.artifacts.log.hash } },
        },
        "same",
        root,
        {},
        context,
      ),
    ).toBe(false);
    for (const file of ["", ".", "..", "report.json:stream", "report.json.", "directory"]) {
      if (file === "directory") mkdirSync(path.join(root, file));
      const candidate = {
        ...receipt,
        artifacts: { ...receipt.artifacts, testReport: { file, hash: receipt.artifacts.testReport.hash } },
      };
      expect(() => reusableReceipt(candidate, "same", root, {}, context)).not.toThrow();
      expect(reusableReceipt(candidate, "same", root, {}, context)).toBe(false);
    }
    expect(reusableReceipt(receipt, "same", root, {})).toBe(false);
    expect(reusableReceipt({ ...receipt, schemaVersion: 2 }, "same", root, {}, context)).toBe(false);
    expect(reusableReceipt({ ...receipt, producer: "other-runner" }, "same", root, {}, context)).toBe(false);
    expect(reusableReceipt({ ...receipt, root: root + "-other" }, "same", root, {}, context)).toBe(false);
    expect(reusableReceipt(receipt, "same", root, {}, { root, tests: ["tests/two.test.ts"] })).toBe(false);
    expect(
      reusableReceipt({ ...receipt, summary: { ...receipt.summary, passed: 99 } }, "same", root, {}, context),
    ).toBe(false);
    writeFileSync(path.join(root, "report.json"), "not JSON");
    const damagedReport = {
      ...receipt,
      artifacts: {
        ...receipt.artifacts,
        testReport: { file: "report.json", hash: hash(path.join(root, "report.json")) },
      },
    };
    expect(reusableReceipt(damagedReport, "same", root, {}, context)).toBe(false);
    writeFileSync(path.join(root, "run.log"), "modified");
    expect(reusableReceipt(receipt, "same", root, {}, context)).toBe(false);
  });
  it("invalidates source, untracked fixtures, installed bytes, environment and selection drift", () => {
    const root = fixture();
    execFileSync("git", ["init", "-q"], { cwd: root });
    execFileSync("git", ["add", "tests"], { cwd: root });
    const batch = prepareBatch(plan, root),
      environment = batchEnvironment({}, 2);
    const before = inputIdentity(root, batch, environment, "installed-a");
    expect(inputIdentity(root, batch, environment, "installed-a")).toBe(before);
    expect(inputIdentity(root, batch, environment, "installed-b")).not.toBe(before);
    expect(inputIdentity(root, batch, { ...environment, CUSTOM_FIXTURE_FLAG: "different" }, "installed-a")).not.toBe(
      before,
    );
    expect(inputIdentity(root, { ...batch, tests: [batch.tests[0]] }, environment, "installed-a")).not.toBe(before);
    writeFileSync(path.join(root, "untracked-fixture.json"), "new fixture");
    expect(inputIdentity(root, batch, environment, "installed-a")).not.toBe(before);
    rmSync(path.join(root, "untracked-fixture.json"));
    writeFileSync(path.join(root, "tests/one.test.ts"), "changed source");
    expect(inputIdentity(root, batch, environment, "installed-a")).not.toBe(before);
    writeFileSync(path.join(root, ".gitignore"), "ignored-fixture.json\n");
    writeFileSync(path.join(root, "ignored-fixture.json"), "synthetic first fixture");
    const withFixture = { ...batch, extraInputs: ["ignored-fixture.json"] };
    const fixtureBefore = inputIdentity(root, withFixture, environment, "installed-a");
    writeFileSync(path.join(root, "ignored-fixture.json"), "synthetic changed fixture");
    expect(inputIdentity(root, withFixture, environment, "installed-a")).not.toBe(fixtureBefore);
  });
  it("records skipped cases without relabelling them as passed", () => {
    const root = fixture();
    const report = {
      success: true,
      numFailedTests: 0,
      numFailedTestSuites: 0,
      numTotalTests: 2,
      numPassedTests: 1,
      numPendingTests: 1,
      testResults: [
        { name: path.join(root, "tests/one.test.ts"), assertionResults: [{ status: "passed" }, { status: "pending" }] },
      ],
    };
    expect(verifyTestReport(report, ["tests/one.test.ts"], root)).toMatchObject({ passed: 1, skipped: 1 });
    expect(() =>
      verifyTestReport({ ...report, numPassedTests: 0, numPendingTests: 2 }, ["tests/one.test.ts"], root),
    ).toThrow();
  });
  it("refuses a wholly skipped selected file beside a passing file", () => {
    const root = fixture();
    const report = {
      success: true,
      numFailedTests: 0,
      numFailedTestSuites: 0,
      numTotalTests: 2,
      numPassedTests: 1,
      numPendingTests: 1,
      testResults: [
        { name: path.join(root, "tests/one.test.ts"), assertionResults: [{ status: "passed" }] },
        { name: path.join(root, "tests/two.test.ts"), assertionResults: [{ status: "pending" }] },
      ],
    };
    expect(() => verifyTestReport(report, ["tests/one.test.ts", "tests/two.test.ts"], root)).toThrow(
      "Every selected file",
    );
    expect(() =>
      verifyTestReport({ ...report, numPassedTests: 2 }, ["tests/one.test.ts", "tests/two.test.ts"], root),
    ).toThrow("counts");
  });
  it("refuses inflated passing counts that disagree with the actual assertions", () => {
    const root = fixture();
    const report = {
      success: true,
      numFailedTests: 0,
      numFailedTestSuites: 0,
      numTotalTests: 2,
      numPassedTests: 2,
      numPendingTests: 0,
      testResults: [{ name: path.join(root, "tests/one.test.ts"), assertionResults: [{ status: "passed" }] }],
    };
    expect(() => verifyTestReport(report, ["tests/one.test.ts"], root)).toThrow("observed assertions");
  });
  it("reports partially TODO files honestly without treating TODO cases as passed", () => {
    const root = fixture();
    const report = {
      success: true,
      numFailedTests: 0,
      numFailedTestSuites: 0,
      numTotalTests: 2,
      numPassedTests: 1,
      numPendingTests: 0,
      numTodoTests: 1,
      testResults: [
        { name: path.join(root, "tests/one.test.ts"), assertionResults: [{ status: "passed" }, { status: "todo" }] },
      ],
    };
    expect(verifyTestReport(report, ["tests/one.test.ts"], root)).toMatchObject({ passed: 1, skipped: 0, todo: 1 });
    expect(() => verifyTestReport({ ...report, numTodoTests: -1 }, ["tests/one.test.ts"], root)).toThrow();
  });
  it("refuses wholly TODO selected files beside a passing file", () => {
    const root = fixture();
    const report = {
      success: true,
      numFailedTests: 0,
      numFailedTestSuites: 0,
      numTotalTests: 2,
      numPassedTests: 1,
      numPendingTests: 0,
      numTodoTests: 1,
      testResults: [
        { name: path.join(root, "tests/one.test.ts"), assertionResults: [{ status: "passed" }] },
        { name: path.join(root, "tests/two.test.ts"), assertionResults: [{ status: "todo" }] },
      ],
    };
    expect(() => verifyTestReport(report, ["tests/one.test.ts", "tests/two.test.ts"], root)).toThrow(
      "Every selected file",
    );
  });
  it("routes both focused and guarded batches through current normal admission", () => {
    const source = readFileSync(path.resolve("scripts/ward-flow/test-batch.mjs"), "utf8");
    expect(source).toContain('const runner = "scripts/run-vitest.mjs"');
    expect(source).not.toContain('"node_modules/vitest/vitest.mjs"');
  });
});

/** A killed child can linger as a zombie until PID 1 reaps it; `kill(pid, 0)` still succeeds then. */
function processIsLive(pid: number): boolean {
  try {
    process.kill(pid, 0);
  } catch {
    return false;
  }
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    return stat.slice(stat.lastIndexOf(")") + 2, stat.lastIndexOf(")") + 3) !== "Z";
  } catch {
    return process.platform !== "linux";
  }
}

describe("owned process deadline", () => {
  it("records failure and timeout instead of a false pass", async () => {
    const root = fixture();
    const base = { root, environment: process.env, logFile: path.join(root, "run.log"), timeoutMs: 10000 };
    expect((await executeBatch({ ...base, args: ["-e", "process.exit(7)"] })).status).toBe("failed");
    expect((await executeBatch({ ...base, timeoutMs: 100, args: ["-e", "setInterval(()=>{},1000)"] })).status).toBe(
      "timed_out",
    );
  }, 30000);
  it("refuses success and stops detached descendants after the root exits", async () => {
    const root = fixture(),
      pidFile = path.join(root, "descendant.pid");
    const code = `const {spawn}=require("node:child_process");const fs=require("node:fs");const child=spawn(process.execPath,["-e","setInterval(()=>{},1000);setTimeout(()=>process.exit(0),25000)"],{detached:true,stdio:"ignore"});fs.writeFileSync(${JSON.stringify(pidFile)},String(child.pid));child.unref();`;
    const result = await executeBatch({
      root,
      args: ["-e", code],
      environment: process.env,
      timeoutMs: 20000,
      logFile: path.join(root, "leak.log"),
    });
    const pid = Number(readFileSync(pidFile, "utf8"));
    try {
      expect(result.status).toBe("failed");
      expect(processIsLive(pid)).toBe(false);
    } finally {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        /* only this test-owned child, already stopped */
      }
    }
  }, 30000);
});
