import { execFileSync } from "node:child_process";
import { classifyChanges, documentChecks, hasDependencyChanges, parseNameStatus } from "./plan.mjs";

const sha = /^[0-9a-f]{40}$/iu;

/**
 * The scope this diff actually needs, re-derived here from the same git command plan.mjs runs.
 *
 * plan.mjs is the only writer of the `full`, `unit`, `browser`, `policy` and `dependency_review` outputs
 * that every gate in static, unit and browser reads, and a plan that is wrong rather than missing
 * is worse than no plan: all four gates go false, nothing is installed, no typecheck, no unit
 * shard and no browser journey runs, and the job still reports success so `Ward Flow required`
 * goes green. `Require a scope plan` cannot catch that, because `false` is a legal plan. Pinning
 * the assignment in plan.mjs's source does not catch it either — a second assignment on the next
 * line satisfies any literal. So compare the outputs against a fresh derivation instead, and read
 * the planner's parsed step outputs, never its GITHUB_OUTPUT file, which belongs to the step that
 * wrote it.
 *
 * Every branch of plan.mjs's own fail-closed handling is reproduced here. When the base is
 * missing, malformed, or the history is unavailable, the only answer accepted is plan.mjs's
 * fail-closed one: run everything, plus dependency review when a base was given but unusable.
 * Returning "no opinion" would hand a narrowed plan a pass, which is the one thing this step
 * exists to prevent.
 */
function expectedScope() {
  const base = process.env.WARD_BASE_SHA;
  // plan.mjs's own fail-closed answer — classifyChanges([]), plus dependency review when a base was
  // given but could not be used. `reason` is dropped: it is a console message for a human.
  const failClosed = (dependencyReview) => {
    const { full, unit, browser, policy } = classifyChanges([]);
    return { full, unit, browser, policy: policy ?? false, dependencyReview, ...documentChecks([]) };
  };
  if (!base) return failClosed(false);
  if (!sha.test(base)) return failClosed(true);
  try {
    const changes = parseNameStatus(
      execFileSync("git", ["diff", "--name-status", "--no-renames", `${base}...HEAD`], {
        encoding: "utf8",
        timeout: 30_000,
      }),
    );
    const plan = classifyChanges(changes);
    return {
      full: plan.full,
      unit: plan.unit,
      browser: plan.browser,
      policy: plan.policy ?? false,
      dependencyReview: hasDependencyChanges(changes),
      ...documentChecks(changes),
    };
  } catch {
    return failClosed(true);
  }
}

const written = {
  full: process.env.WARD_PLAN_FULL,
  unit: process.env.WARD_PLAN_UNIT,
  browser: process.env.WARD_PLAN_BROWSER,
  policy: process.env.WARD_PLAN_POLICY,
  dependencyReview: process.env.WARD_PLAN_DEPENDENCY_REVIEW,
  owner_index: process.env.WARD_PLAN_OWNER_INDEX,
  rules_index: process.env.WARD_PLAN_RULES_INDEX,
  organisation: process.env.WARD_PLAN_ORGANISATION,
};
const expected = expectedScope();
// `reason` is plan.mjs's own console message for a human, not a gate, so it is not compared.
const wrong = Object.keys(expected).filter((key) => written[key] !== String(expected[key]));

if (wrong.length) {
  console.error(
    `::error::the scope plan is not the scope this diff needs (${wrong.join(", ")}): this diff needs ${JSON.stringify(expected)}, the planner wrote ${JSON.stringify(written)}`,
  );
  process.exit(1);
}
console.log(`Scope plan verified against the diff: ${JSON.stringify(expected)}`);
