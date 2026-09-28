import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 🔴 **THE WARD JOURNEYS RUN ON EVERY UI PULL REQUEST AND MUST NOT BLOCK ONE.**
 *
 * Owner instruction, 2026-09-06: run every time, report loudly, do not block. That is two edits in
 * `ci.yml` and **they are one change** — the gate moved OFF the job's `if:` and ONTO its
 * `continue-on-error`.
 *
 * ⚠️ **DOING ONLY THE FIRST HALF INVERTS THE INSTRUCTION, AND SILENTLY.** `pr-required` calls
 * `require_skipped_or_success` for this job whenever `WARD_JOURNEYS_BLOCKING` is off. An un-gated
 * job with no `continue-on-error` reports `failure`, that check fails, and **every UI pull request
 * in the repository is blocked by a ward prototype journey** — the exact blast radius the job's own
 * comment block exists to prevent, reached by removing one line that looks like a simplification.
 *
 * `continue-on-error` is what keeps the job's RESULT `success` while its steps go red: the aggregate
 * stays green, and the failure is still visible on the job itself. That is the whole mechanism.
 *
 * **This file lives outside `ci-cache-safety.test.ts` on purpose.** That suite's aggregate block is
 * `skipIf(win32)` — it runs on Linux only, so on the machine where this workflow is actually edited
 * it reports SKIPPED and the first execution it ever gets is in CI. A contract about a file somebody
 * edits on Windows needs a guard that runs on Windows.
 */
const ciPath = resolve(process.cwd(), ".github/workflows/ci.yml");
const workflow = existsSync(ciPath) ? readFileSync(ciPath, "utf8") : "";

/** The `ui-ward-journeys:` job block, up to the next top-level job key. */
function wardJourneysJob(): string {
  const start = workflow.indexOf("\n  ui-ward-journeys:");
  expect(start, "ci.yml no longer defines a ui-ward-journeys job").toBeGreaterThan(-1);
  const rest = workflow.slice(start + 1);
  const next = rest.search(/\n {2}[a-z][a-z0-9-]*:\n/u);
  return next === -1 ? rest : rest.slice(0, next);
}

describe.skipIf(!existsSync(ciPath))("the Ward Flow browser journeys lane", () => {
  it("runs on every UI pull request — the blocking flag is NOT on its if:", () => {
    const job = wardJourneysJob();
    /*
     * ⚠️ Sliced to `continue-on-error:`, NOT to `runs-on:`. The first version cut at `runs-on:`,
     * which swallowed the `continue-on-error` line — and that line names the flag on purpose, so the
     * assertion failed against a correct workflow. **A guard reddening on correct work is the shape
     * that gets a guard deleted**, and the fix is the slice, never the assertion.
     */
    /*
     * ⚠️ **AND IT FALLS BACK TO `runs-on:` RATHER THAN ASSERTING `continue-on-error` EXISTS.** The
     * first version asserted it here, so deleting that line turned BOTH cases in this file red — and
     * this one went red announcing "the job no longer declares continue-on-error at all", which is
     * not what its name claims. **Two assertions sharing one predicate hide which half moved**, and
     * a case whose failure message describes a different defect is how a guard gets mis-read. The
     * presence of `continue-on-error` belongs to the case below and to that case only.
     */
    const continueAt = job.indexOf("continue-on-error:");
    const conditionEnd = continueAt === -1 ? job.indexOf("runs-on:") : continueAt;
    const condition = job.slice(job.indexOf("if: >"), conditionEnd);

    expect(
      condition,
      "WARD_JOURNEYS_BLOCKING is back on the job's `if:`, so the lane is skipped again and reports " +
        "nothing. The owner asked for it to RUN every time; the flag belongs on continue-on-error.",
    ).not.toContain("WARD_JOURNEYS_BLOCKING");
    expect(condition).toContain("needs.changes.outputs.ui_changed == 'true'");
    expect(condition).toContain("github.event_name == 'pull_request'");
    expect(condition).toContain("github.event.pull_request.draft != true");
  });

  it("does not block a merge while the flag is off — and this is the half that inverts if dropped", () => {
    /*
     * ⚠️ The expression, not merely the key. `continue-on-error: true` would pin the lane
     * non-blocking forever and make `WARD_JOURNEYS_BLOCKING` dead — turning it on in repository
     * settings would then do nothing, which is worse than the original inert job because it looks
     * like a working switch.
     */
    expect(
      wardJourneysJob(),
      "the ward lane can fail the pr-required aggregate. Restore " +
        "`continue-on-error: ${{ vars.WARD_JOURNEYS_BLOCKING != 'true' }}` on the job.",
    ).toContain("continue-on-error: ${{ vars.WARD_JOURNEYS_BLOCKING != 'true' }}");
  });

  it("is still reachable by the aggregate, so a blocking run is actually demanded", () => {
    // The flag being asymmetric only works while the aggregate keeps its own copy of it.
    expect(workflow).toContain('if [ "$WARD_JOURNEYS_BLOCKING" = "true" ]');
    expect(workflow).toContain('require_success "ward-flow-journeys" "$WARD_JOURNEYS_RESULT"');
    expect(workflow).toContain('require_skipped_or_success "ward-flow-journeys" "$WARD_JOURNEYS_RESULT"');
  });

  it("runs the ward specs by pattern, so a NEW ward journey is not silently left out", () => {
    /*
     * `ui-ward-` is a positional filter, not a hand-kept list. A file list would have to be edited
     * alongside every new spec, and the failure mode of forgetting is invisible: the lane goes green
     * having run one spec fewer. `tests/ui-tools-show-all.spec.ts` sat uncollected for 17 days on
     * exactly that shape.
     */
    const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    expect(packageJson.scripts?.["test:e2e:ward-journeys"]).toBe(
      "node scripts/run-playwright.mjs --project=chromium-mockups ui-ward-",
    );
    expect(wardJourneysJob()).toContain("npm run test:e2e:ward-journeys");
  });
});
