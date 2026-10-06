import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The dedicated Ward-Flow repository uses ward-flow.yml. Its browser journeys are required,
 * unlike the optional prototype lane in the former PsychSift workflow. Keep the filename for
 * existing test selectors, but guard the current repository's execution and failure contract.
 * These static contracts run on every platform, including where the workflow is edited.
 */
const workflow = readFileSync(resolve(process.cwd(), ".github/workflows/ward-flow.yml"), "utf8");

/** One top-level job, without accidentally accepting a contract from a different job. */
function job(name: string): string {
  const start = workflow.indexOf(`\n  ${name}:`);
  expect(start, `ward-flow.yml no longer defines the ${name} job`).toBeGreaterThan(-1);
  const rest = workflow.slice(start + 1);
  const next = rest.search(/\n {2}[a-z][a-z0-9_-]*:\n/u);
  return next === -1 ? rest : rest.slice(0, next);
}

describe("the public Ward Flow browser journeys lane", () => {
  it("runs for pull requests and merge groups, with browser scope supplied by the planner", () => {
    expect(workflow).toMatch(/^on:\s*\n {2}pull_request:\s*\n {4}branches: \[main\]/mu);
    expect(workflow).toMatch(/^ {2}merge_group:/mu);
    const browser = job("browser");
    // No job-level draft/flag gate may silently bypass the browser result. The only job-level gate is
    // the main-push reuse proof (an identical tree whose PR run already passed every browser group),
    // and the aggregate then requires the job to be skipped, never failed. The planner narrows only
    // the install step, and the later steps must follow the successful install/Chromium step.
    const header = browser.slice(0, browser.indexOf("    steps:"));
    expect(header.match(/^ {4}if:.*$/gmu)).toEqual([
      "    if: ${{ !cancelled() && needs.reuse.outputs.verified != 'true' }}",
    ]);
    expect(job("reuse")).toContain("if: ${{ github.event_name == 'push' && github.ref == 'refs/heads/main' }}");
    expect(browser).not.toContain("WARD_JOURNEYS_BLOCKING");
    expect(browser).toContain("run: node scripts/ward-ci-public/plan.mjs");
    expect(browser).toContain("if: ${{ !cancelled() && steps.plan.outputs.browser == 'true' }}");
    expect(browser).toContain("if: ${{ !cancelled() && steps.install.outcome == 'success' }}");
    expect(browser).toContain("if: ${{ !cancelled() && steps.chromium.outcome == 'success' }}");
  });

  it("runs every browser group even when another group fails", () => {
    const browser = job("browser");
    expect(browser).toContain("fail-fast: false");
    const groups = /^\s*group: \[([\d, ]+)\]$/mu
      .exec(browser)?.[1]
      .split(",")
      .map((value) => Number(value.trim()));
    const count = Number(/WARD_JOURNEY_GROUP: \$\{\{ matrix\.group \}\}\/(\d+)/u.exec(browser)?.[1]);
    expect(count, "each browser group must declare the same positive group count").toBeGreaterThan(0);
    expect(groups, "a missing, duplicated or out-of-range group loses journey coverage").toEqual(
      Array.from({ length: count }, (_, index) => index + 1),
    );
  });

  it("keeps browser failures blocking rather than suppressing them", () => {
    expect(job("browser")).not.toContain("continue-on-error:");
    expect(job("required")).not.toContain("continue-on-error:");
    expect(job("browser")).toMatch(/^\s*run: npm run test:e2e:ward-journeys\s*$/mu);
  });

  it("requires a successful browser result in the always-running aggregate", () => {
    const required = job("required");
    expect(required).toContain("if: always()");
    expect(required).toContain("needs: [reuse, static, unit, browser, secret-scan, build, coverage]");
    expect(required).toContain("BROWSER_RESULT: ${{ needs.browser.result }}");
    expect(required).toContain(
      'if [ "$REUSE_VERIFIED" != true ]; then\n            test "$STATIC_RESULT" = success && test "$UNIT_RESULT" = success && test "$BROWSER_RESULT" = success && test "$SECRET_SCAN_RESULT" = success && test "$BUILD_RESULT" = success && test "$COVERAGE_RESULT" = success\n',
    );
    // On a verified main reuse the browser groups must be skipped, not failed or cancelled.
    expect(required).toContain('test "$BROWSER_RESULT" = skipped');
  });

  it("selects ward specs by pattern so a new journey is not silently omitted", () => {
    const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    expect(packageJson.scripts?.["test:e2e:ward-journeys"]).toBe(
      "node scripts/run-playwright.mjs --project=chromium-mockups ui-ward-",
    );
    expect(job("browser")).toContain("npm run test:e2e:ward-journeys");
  });

  it("retains failed journey evidence separately for every browser group", () => {
    const browser = job("browser");
    expect(browser).toContain("id: journeys");
    expect(browser).toContain("if: ${{ !cancelled() && steps.journeys.outcome == 'failure' }}");
    expect(browser).toMatch(/uses: actions\/upload-artifact@[0-9a-f]{40}/u);
    expect(browser).toContain("name: ward-browser-failures-${{ github.run_id }}-${{ matrix.group }}");
    expect(browser).toContain("path: test-results/");
  });
});
