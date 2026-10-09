import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const sha = /^[0-9a-f]{40}$/i;
const docsOnly = (file) => file === "README.md" || /^docs\/ward-flow\/.*\.md$/u.test(file);
const maintainedPolicyRoots = new Set([
  "AGENTS.md",
  "CLAUDE.md",
  "GEMINI.md",
  "docs/ward-flow/HOW-WE-WORK.md",
  "docs/DOCS-SYSTEM.md",
  "README.local-source.md",
  "docs/task-receipts.md",
]);
export const policyContractTests = [
  "tests/bare-pr-publication-policy.test.ts",
  "tests/pre-commit-ward-flow-main-guard.test.ts",
  "tests/public-signout-boundary.test.ts",
  "tests/docs-script-refs.test.ts",
  "tests/ward-policy-scope.test.ts",
];
export function isMaintainedPolicy(file) {
  return maintainedPolicyRoots.has(file) || /^docs\/agents\/[^/]+\.md$/u.test(file);
}
const dependencyManifest = (file) => /(^|\/)(?:package(?:-lock)?\.json|npm-shrinkwrap\.json)$/u.test(file);

// The separately packaged Azure backend: nothing under src/, tests/ or scripts/ imports it, and the
// static job runs its own tests.
const backendOnly = (file) => file.startsWith("backend/ward-flow/");
// Unit test files. Browser specs import only application code and Playwright, never these files.
const unitTest = (file) => /^tests\/.+\.test\.tsx?$/u.test(file);

/**
 * Which jobs a PR needs. `full` gates installs and the static checks; `unit` and `browser` gate
 * those jobs' work. Anything not positively recognised runs everything (fail closed).
 */
export function classifyChanges(entries) {
  const all = (reason) => ({ full: true, unit: true, browser: true, policy: false, reason });
  if (!entries.length) return all("empty diff");
  if (entries.some(({ status }) => status !== "M" && status !== "A")) return all("deleted or renamed file");
  const files = entries.map(({ file }) => file);
  if (files.some(isMaintainedPolicy) && files.every((file) => isMaintainedPolicy(file) || docsOnly(file))) {
    return {
      full: true,
      unit: false,
      browser: false,
      policy: true,
      reason: "maintained policy contracts and documentation only",
    };
  }
  if (files.every(docsOnly)) return { full: false, unit: false, browser: false, reason: "Ward documentation only" };
  if (files.every((file) => docsOnly(file) || backendOnly(file))) {
    return { full: true, unit: false, browser: false, reason: "backend and documentation only" };
  }
  if (files.every((file) => docsOnly(file) || backendOnly(file) || unitTest(file))) {
    return { full: true, unit: true, browser: false, reason: "unit tests, backend and documentation only" };
  }
  return all("source, browser spec, tooling, configuration or unknown change");
}

/** Independently scoped, dependency-free maintained-document checks. Missing history fails closed. */
export function documentChecks(entries) {
  if (!entries.length || entries.some(({ status }) => !["M", "A"].includes(status)))
    return { owner_index: true, rules_index: true, organisation: true };
  const files = entries.map(({ file }) => file);
  return {
    owner_index: files.some((file) => {
      const source = file.replace(/^docs\/ward-flow\/(?:archive\/dated-notes\/)?/u, "");
      return (
        file === "scripts/ward-flow/owner-rulings-index.mjs" ||
        (file.startsWith("docs/ward-flow/") &&
          !source.includes("/") &&
          (source === "decisions.md" ||
            source === "OWNER-RULINGS.md" ||
            /^owner-.*\.md$/u.test(source) ||
            /owner.*ruling.*\.md$/iu.test(source)))
      );
    }),
    rules_index: files.some(
      (file) =>
        /^docs\/ward-flow\/(?:RULES\.md|lessons\/[^/]+\.md)$/u.test(file) ||
        file === "scripts/ward-flow/rules-index.mjs",
    ),
    organisation: files.some(
      (file) =>
        file.startsWith("docs/ward-flow/") ||
        file.startsWith("scripts/ward-flow/organisation") ||
        file.startsWith("src/components/ward-management/") ||
        file.startsWith("src/app/mockups/ward-flow/") ||
        file.startsWith("tests/ward-") ||
        file.startsWith("tests/ui-ward-"),
    ),
  };
}

export function hasDependencyChanges(entries) {
  return entries.some(({ file }) => dependencyManifest(file));
}

export function parseNameStatus(output) {
  return output
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => {
      const [status, file, ...extra] = line.split("\t");
      if (!status || !file || extra.length || file.includes("\\")) throw new Error(`Invalid git diff entry: ${line}`);
      return { status, file };
    });
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/scripts/ward-ci-public/plan.mjs")) {
  const base = process.env.WARD_BASE_SHA;
  let plan;
  let dependencyReview = false;
  let documents = documentChecks([]);
  if (!base) {
    plan = classifyChanges([]);
    plan.reason = "no PR base (merge group or manual run)";
  } else if (!sha.test(base)) {
    plan = classifyChanges([]);
    plan.reason = "invalid PR base";
    dependencyReview = true;
  } else {
    try {
      const output = execFileSync("git", ["diff", "--name-status", "--no-renames", `${base}...HEAD`], {
        encoding: "utf8",
        timeout: 30_000,
      });
      const changes = parseNameStatus(output);
      plan = classifyChanges(changes);
      documents = documentChecks(changes);
      dependencyReview = hasDependencyChanges(changes);
    } catch (error) {
      plan = classifyChanges([]);
      plan.reason = `history unavailable (${error.code ?? error.status ?? "error"})`;
      dependencyReview = true;
    }
  }
  console.log(
    `Ward CI scope: full=${plan.full} unit=${plan.unit} browser=${plan.browser} — ${plan.reason}; dependency review: ${dependencyReview}`,
  );
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `full=${plan.full}\nunit=${plan.unit}\nbrowser=${plan.browser}\npolicy=${plan.policy ?? false}\ndependency_review=${dependencyReview}\n${Object.entries(
        documents,
      )
        .map(([key, value]) => `${key}=${value}\n`)
        .join("")}`,
    );
}
