import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * M161 (final master audit; Josh, 10 Nov 2026, D-124 item 7): CodeQL scans JavaScript and
 * TypeScript on pull requests and on main, and blocks only on findings a pull request introduces.
 */
const workflowUrl = new URL("../.github/workflows/codeql.yml", import.meta.url);
const workflow = existsSync(workflowUrl) ? readFileSync(workflowUrl, "utf8").replace(/\r\n/gu, "\n") : "";

describe("CodeQL workflow", () => {
  it("runs on pull requests into main and on pushes to main, never with base-repository rights", () => {
    expect(workflow).toMatch(/^  pull_request:\n    branches: \[main\]$/mu);
    expect(workflow).toMatch(/^  push:\n    branches: \[main\]$/mu);
    expect(workflow).not.toMatch(/^  (?:pull_request_target|workflow_run):/mu);
    expect(workflow).toMatch(/^    timeout-minutes: \d+$/mu);
  });

  it("scans JavaScript and TypeScript without installing or building anything", () => {
    expect(workflow).toContain("languages: javascript-typescript");
    expect(workflow).toContain("build-mode: none");
    expect(workflow).not.toMatch(/npm (?:ci|install|run)|autobuild/u);
  });

  it("reports to code scanning and never fails the job on existing findings", () => {
    // The job uploads; GitHub's CodeQL check compares the pull request with main and fails only on
    // new alerts. Failing the job on any finding (or skipping the upload) would block on old ones.
    expect(workflow).toMatch(/uses: github\/codeql-action\/analyze@/u);
    expect(workflow).not.toMatch(/upload: (?:false|never)|fail-on|continue-on-error|exit 1/u);
  });

  it("holds the least permissions and pins every action by commit", () => {
    expect(workflow).toMatch(/^permissions:\n  contents: read$/mu);
    expect(workflow).toMatch(/^    permissions:\n      contents: read\n      security-events: write$/mu);
    expect(workflow).not.toMatch(/secrets\.|contents: write|pull-requests: write|actions: write/u);
    expect(workflow).toContain("persist-credentials: false");
    const actions = [...workflow.matchAll(/uses: ([^\s]+)/gu)].map((match) => match[1]);
    expect(actions).toHaveLength(3);
    for (const action of actions) expect(action).toMatch(/@[0-9a-f]{40}$/u);
  });
});
