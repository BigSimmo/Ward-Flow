// M86: the hold check cannot be skipped or edited by the pull request it judges.
// Pins .github/workflows/pr-hold.yml: it fails while the `hold` label is set, runs in the
// base repository's context (pull_request_target, D-114), and never checks out or runs PR code.
// Whether GitHub treats "Ward Flow hold" and "Ward Flow required" as required checks on main is
// a repository setting this test cannot see; Josh confirms that in GitHub settings.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(new URL("../.github/workflows/pr-hold.yml", import.meta.url), "utf8");
const code = workflow
  .split("\n")
  .filter((line) => !line.trim().startsWith("#"))
  .join("\n");

function stepScript(stepName: string): string {
  const start = code.indexOf(`- name: ${stepName}`);
  expect(start, `step "${stepName}" exists`).toBeGreaterThan(-1);
  const rest = code.slice(start);
  const runAt = rest.indexOf("run: |\n");
  const body = rest.slice(runAt + "run: |\n".length);
  const lines: string[] = [];
  for (const line of body.split("\n")) {
    if (line.trim() !== "" && !line.startsWith("          ")) break;
    lines.push(line.slice(10));
  }
  return lines.join("\n");
}

function runHoldStep(held: string): number {
  try {
    execFileSync("bash", ["-c", stepScript("Block while labelled hold")], {
      env: { ...process.env, HELD: held },
      stdio: "pipe",
    });
    return 0;
  } catch (error) {
    return (error as { status?: number }).status ?? 1;
  }
}

describe("M86 Ward Flow hold workflow", () => {
  it("reports the check under the exact required-check name", () => {
    expect(code).toMatch(/^name: Ward Flow hold$/m);
    expect(code).toMatch(/^ {4}name: Ward Flow hold$/m);
  });

  it("runs from main's copy of the workflow (pull_request_target, D-114) and on merge_group", () => {
    expect(code).toMatch(
      /^on:\n {2}pull_request_target:\n {4}types: \[opened, synchronize, reopened, labeled, unlabeled\]\n {4}branches: \[main\]$/m,
    );
    expect(code).toMatch(/^ {2}merge_group:\n {4}types: \[checks_requested\]$/m);
    expect(code).not.toMatch(/^ {2}pull_request:/m);
  });

  it("never checks out or runs pull-request code", () => {
    expect(code).not.toMatch(/actions\/checkout|uses:/);
    expect(code).not.toMatch(/pull_request\.head|github\.head_ref|refs\/pull\/|merge_commit_sha/);
    expect(code).not.toMatch(/npm |npx |node |pnpm|yarn|\.\/scripts|bash scripts/);
    expect(code).toMatch(/^permissions:\n {2}pull-requests: read\n/m);
    expect(code).not.toMatch(/: write\b|write-all|secrets\./);
  });

  it("is not skipped by a job-level condition", () => {
    const jobBlock = code.slice(code.indexOf("jobs:"), code.indexOf("steps:"));
    expect(jobBlock).not.toMatch(/^\s+if:/m);
    expect(code).toMatch(/HELD: \$\{\{ contains\(github\.event\.pull_request\.labels\.\*\.name, 'hold'\) \}\}/);
  });

  it("fails while the hold label is set and passes once it is removed", () => {
    expect(runHoldStep("true")).not.toBe(0);
    expect(runHoldStep("false")).toBe(0);
  });

  it("fails closed on a merge-group ref it cannot read", () => {
    const script = stepScript("Block a queued PR that is labelled hold");
    expect(script).toMatch(/set -euo pipefail/);
    expect(script).toMatch(/failing closed\."; exit 1/);
    expect(script).toMatch(/grep -qx hold/);
  });
});
