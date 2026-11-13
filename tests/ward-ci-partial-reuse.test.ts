import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { resolveBash } from "../scripts/ward-ci-public/bash.mjs";
const bash = resolveBash();

const workflow = readFileSync(".github/workflows/ward-flow.yml", "utf8");
const shell = /^ {8}run: \|\n([\s\S]*)$/mu.exec(workflow.slice(workflow.indexOf("  required:\n")))![1];
const green = {
  PLAN_RESULT: "success",
  STATIC_RESULT: "success",
  SECRET_SCAN_RESULT: "success",
  REUSE_RESULT: "success",
  REUSE_VERIFIED: "false",
  DRAFT: "false",
  GITHUB_EVENT_NAME: "push",
  GITHUB_REF: "refs/heads/main",
  BACKEND_SCOPE: "true",
  UNIT_SCOPE: "true",
  BROWSER_SCOPE: "true",
  BUILD_SCOPE: "true",
  BACKEND_RESULT: "success",
  UNIT_RESULT: "success",
  COVERAGE_RESULT: "success",
  BROWSER_RESULT: "success",
  BROWSER_BUILD_RESULT: "success",
  RELEASE_GATE_RESULT: "success",
  BUILD_RESULT: "success",
  BACKEND_REUSED: "false",
  UNIT_REUSED: "false",
  COVERAGE_REUSED: "false",
  SWEEP_ONLY: "false",
  BROWSER_REUSED: "false",
  RELEASE_REUSED: "false",
  BUILD_REUSED: "false",
};
function verdict(values: Record<string, string>) {
  return spawnSync(bash, ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", shell], {
    env: {
      PATH: process.env.PATH,
      NODE_ENV: "test",
      ...(process.platform === "win32" ? { SystemRoot: process.env.SystemRoot } : {}),
      ...values,
    },
  }).status;
}

describe("required gate with independent reuse evidence", () => {
  it("accepts a fresh unit/coverage population while independently reusing the other proved gates", () => {
    expect(
      verdict({
        ...green,
        BACKEND_REUSED: "true",
        BACKEND_RESULT: "skipped",
        BUILD_REUSED: "true",
        BUILD_RESULT: "skipped",
        BROWSER_REUSED: "true",
        BROWSER_RESULT: "skipped",
        RELEASE_REUSED: "true",
        RELEASE_GATE_RESULT: "skipped",
        BROWSER_BUILD_RESULT: "skipped",
      }),
    ).toBe(0);
  });

  it("requires a prepared artifact when just one browser consumer is fresh", () => {
    const mixed = { ...green, BROWSER_REUSED: "true", BROWSER_RESULT: "skipped" };
    expect(verdict(mixed)).toBe(0);
    expect(verdict({ ...mixed, BROWSER_BUILD_RESULT: "skipped" })).not.toBe(0);
  });

  it("rejects a skipped or failed fresh gate, and a passing gate incorrectly claimed as reused", () => {
    for (const gate of ["BACKEND", "UNIT", "COVERAGE", "BROWSER", "BUILD"])
      for (const result of ["skipped", "failure", "cancelled", ""])
        expect(verdict({ ...green, [`${gate}_RESULT`]: result })).not.toBe(0);
    for (const gate of ["BACKEND", "UNIT", "COVERAGE", "BROWSER", "BUILD"])
      expect(verdict({ ...green, [`${gate}_REUSED`]: "true" })).not.toBe(0);
  });

  it("requires main-push ownership and a successful reuse verifier for every reused gate", () => {
    const partial = { ...green, BACKEND_REUSED: "true", BACKEND_RESULT: "skipped" };
    expect(verdict(partial)).toBe(0);
    for (const changes of [
      { GITHUB_EVENT_NAME: "pull_request" },
      { GITHUB_REF: "refs/heads/other" },
      { REUSE_RESULT: "failure" },
      { REUSE_RESULT: "skipped" },
      { BACKEND_SCOPE: "false" },
    ])
      expect(verdict({ ...partial, ...changes })).not.toBe(0);
  });

  it("never passes drafts or malformed scope/reuse values", () => {
    expect(verdict({ ...green, DRAFT: "true" })).not.toBe(0);
    expect(verdict({ ...green, UNIT_SCOPE: "" })).not.toBe(0);
    expect(verdict({ ...green, UNIT_REUSED: "unknown" })).not.toBe(0);
    expect(verdict({ ...green, SWEEP_ONLY: "unknown" })).not.toBe(0);
  });

  it("accepts a main sweep-only run: fresh unit shards with the pull request's coverage reused", () => {
    const sweep = { ...green, SWEEP_ONLY: "true", COVERAGE_REUSED: "true", COVERAGE_RESULT: "skipped" };
    expect(verdict(sweep)).toBe(0);
    for (const changes of [
      { GITHUB_EVENT_NAME: "pull_request" },
      { GITHUB_REF: "refs/heads/other" },
      { REUSE_RESULT: "failure" },
      { UNIT_REUSED: "true", UNIT_RESULT: "skipped" },
      { COVERAGE_REUSED: "false", COVERAGE_RESULT: "success" },
      { UNIT_RESULT: "failure" },
    ])
      expect(verdict({ ...sweep, ...changes })).not.toBe(0);
    expect(verdict({ ...green, COVERAGE_REUSED: "true", COVERAGE_RESULT: "skipped" })).not.toBe(0);
  });
});
