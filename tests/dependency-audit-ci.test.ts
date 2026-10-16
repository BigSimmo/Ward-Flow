import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const workflowUrl = new URL("../.github/workflows/dependency-audit.yml", import.meta.url);
const workflow = existsSync(workflowUrl) ? readFileSync(workflowUrl, "utf8").replace(/\r\n/gu, "\n") : "";

function step(name: string) {
  const start = workflow.indexOf(`      - name: ${name}\n`);
  if (start < 0) return "";
  const end = workflow.indexOf("\n      - name:", start + 1);
  return workflow.slice(start, end < 0 ? undefined : end);
}

describe("scheduled dependency intelligence", () => {
  it("checks unchanged lockfiles nightly and on request without adding a PR or deployment gate", () => {
    expect(workflow).toMatch(/^  schedule:\n    - cron: "30 18 \* \* \*"$/mu);
    expect(workflow).toMatch(/^  workflow_dispatch:/mu);
    expect(workflow).not.toMatch(/^  (?:push|pull_request|pull_request_target|workflow_run):/mu);
    expect(workflow).toMatch(/^    timeout-minutes: 10$/mu);
  });

  it("audits both package lockfiles even when one matrix entry fails", () => {
    const directories = [...workflow.matchAll(/^          - directory: "([^"]+)"$/gmu)].map((match) => match[1]);
    expect(directories).toEqual([".", "backend/ward-flow"]);
    for (const directory of directories)
      expect(existsSync(new URL(`../${directory}/package-lock.json`, import.meta.url))).toBe(true);
    expect(workflow).toContain("fail-fast: false");
    expect(workflow).toContain("working-directory: ${{ matrix.directory }}");
    expect(workflow).not.toMatch(/npm (?:ci|install|update)|npm audit fix/u);
  });

  it("fails on production high/critical advisories while preserving the full tooling report", () => {
    const production = step("Audit production dependencies");
    expect(production).toMatch(/^        run: npm audit --omit=dev --audit-level=high$/mu);
    expect(production).not.toContain("continue-on-error");
    expect(production).not.toMatch(/\|\|\s*true|--force/u);
    expect([...workflow.matchAll(/continue-on-error:/gu)]).toHaveLength(1);

    const full = step("Report all dependency advisories");
    expect(full).toContain("if: ${{ !cancelled() }}");
    expect(full).toContain("continue-on-error: true");
    expect(full).toContain('npm audit --json > "$RUNNER_TEMP/dependency-audit.json"');
    expect(full).toContain('exit "$audit_status"');
    const warning = step("Flag the full audit for review");
    expect(warning).toContain("steps.full-audit.outcome == 'failure'");
    expect(warning).toContain("::warning::");
    const upload = step("Retain the full advisory report");
    expect(upload).toContain("if: ${{ !cancelled() }}");
    expect(upload).toContain("path: ${{ runner.temp }}/dependency-audit.json");
    expect(upload).toContain("if-no-files-found: error");
  });

  it("uses read-only credentials and immutable actions without executing dependency scripts", () => {
    expect(workflow).toMatch(/^permissions:\n  contents: read$/mu);
    expect(workflow).toContain("persist-credentials: false");
    const actions = [...workflow.matchAll(/uses: ([^\s]+)/gu)].map((match) => match[1]);
    expect(actions.length).toBeGreaterThanOrEqual(3);
    for (const action of actions) expect(action).toMatch(/@[0-9a-f]{40}$/u);
    expect(workflow).not.toMatch(/secrets\.|contents: write|pull-requests: write/u);
  });
});
