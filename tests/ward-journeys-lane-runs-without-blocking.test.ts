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
    // Scope is verified once before allocation. Selected groups also require a successful
    // prepared build; only verified main reuse can intentionally skip a selected group.
    const header = browser.slice(0, browser.indexOf("    steps:"));
    expect(header.match(/^ {4}if:.*$/gmu)).toEqual([
      "    if: ${{ !cancelled() && needs.plan.outputs.browser == 'true' && needs.reuse.outputs.verified != 'true' && needs.browser-build.result == 'success' }}",
    ]);
    expect(job("reuse")).toContain("if: ${{ github.event_name == 'push' && github.ref == 'refs/heads/main' }}");
    expect(browser).not.toContain("WARD_JOURNEYS_BLOCKING");
    expect(job("plan")).toContain("run: node scripts/ward-ci-public/plan.mjs");
    expect(job("plan")).toContain("run: node scripts/ward-ci-public/verify-plan.mjs");
    expect(browser).toContain("needs: [plan, reuse, browser-build]");
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
    expect(required).toContain(
      "needs: [plan, reuse, static, backend, unit, browser-build, browser, release-gate, secret-scan, build, coverage]",
    );
    expect(required).toContain("BROWSER_RESULT: ${{ needs.browser.result }}");
    expect(required).toContain("RELEASE_GATE_RESULT: ${{ needs.release-gate.result }}");
    expect(required).toContain('require_scope "$BROWSER_SCOPE" "$BROWSER_RESULT"');
    expect(required).toContain('require_scope "$BROWSER_SCOPE" "$BROWSER_BUILD_RESULT"');
    expect(required).toContain('require_scope "$BROWSER_SCOPE" "$RELEASE_GATE_RESULT"');
    expect(required).toContain('if [ "$1" = true ]; then test "$2" = success;');
    expect(required).toContain('elif [ "$1" = false ]; then test "$2" = skipped;');
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
    expect(browser).not.toContain("id: csrf");
    expect(readFileSync("scripts/run-playwright.mjs", "utf8")).toContain(
      "includeGroupCsrf(playwrightArgs, journeyGroup)",
    );
    expect(browser).toContain("if: ${{ !cancelled() && steps.journeys.outcome == 'failure' }}");
    expect(browser).toMatch(/uses: actions\/upload-artifact@[0-9a-f]{40}/u);
    expect(browser).toContain("name: ward-browser-failures-${{ github.run_id }}-${{ matrix.group }}");
    expect(browser).toContain("path: test-results/");
  });
});
