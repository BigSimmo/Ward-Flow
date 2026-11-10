import { execFileSync } from "node:child_process";
import { appendFileSync, readdirSync, readFileSync } from "node:fs";
import { legalSweepInputs, needsLegalSweep } from "./legal-sweep-scope.mjs";

const ORGANISATION_REGISTRY = "docs/ward-flow/organisation/registry.json";
const organisationRoots = (() => {
  try {
    const registry = JSON.parse(readFileSync(ORGANISATION_REGISTRY, "utf8"));
    return Array.isArray(registry.roots) ? registry.roots : null;
  } catch {
    return null;
  }
})();
const matchesOrganisationRoot = (file) => {
  if (!organisationRoots) return true;
  return organisationRoots.some((root) => {
    const expression = String(root)
      .replace(/[.+^${}()|[\]\\]/gu, "\\$&")
      .replace(/\*\*|\*/gu, (match) => (match === "**" ? ".*" : "[^/]*"));
    return new RegExp(`^${expression}$`, "u").test(file);
  });
};

const sha = /^[0-9a-f]{40}$/i;
const docsOnly = (file) => file === "README.md" || /^docs\/(?:ward-flow|history)\/.*\.md$/u.test(file);
const maintainedPolicyRoots = new Set([
  "AGENTS.md",
  "PROJECT-INSTRUCTIONS-CONTINUATION.md",
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

const TESTS_ROOT = new URL("../../tests/", import.meta.url);
const docPathPattern = /^(?:README\.md|docs\/(?:ward-flow|history)\/.*)$/u;
/**
 * The documents unit tests read, found by scanning test source for path text at plan time, so the
 * list cannot go stale. `exact` holds whole `.md` paths ("docs/ward-flow/decisions.md"); `prefixes`
 * holds directories a test builds a path under (`docs/ward-flow/desk-guides/${file}` or
 * join("docs", "ward-flow", "desk-guides", file)). Over-matching only runs the unit job more often.
 * Not seen: a test that walks the whole docs tree (tests/replaced-decision-citations.test.ts).
 */
export function scanTestReadDocs(root = TESTS_ROOT) {
  try {
    return scanTestReadDocsOrThrow(root);
  } catch {
    // Fail closed: an unreadable test tree treats every document as read by unit tests.
    return { exact: new Set(), prefixes: ["docs/", "README.md"] };
  }
}

function scanTestReadDocsOrThrow(root) {
  const exact = new Set();
  const prefixes = new Set();
  const add = (path) => {
    const clean = path.replace(/^\.\//u, "");
    if (!docPathPattern.test(clean)) return;
    if (clean.endsWith(".md")) exact.add(clean);
    else if (clean.endsWith("/") && /^docs\/(?:ward-flow|history)\/[^/]+\//u.test(clean)) prefixes.add(clean);
  };
  for (const name of readdirSync(root, { recursive: true })) {
    const file = String(name);
    if (!/\.tsx?$/u.test(file)) continue;
    const source = readFileSync(new URL(file.replaceAll("\\", "/"), root), "utf8");
    for (const [, path] of source.matchAll(/["'`]((?:\.\/)?(?:README\.md|docs\/[^"'`\s$]*))["'`]/gu)) add(path);
    for (const [, path] of source.matchAll(/`((?:\.\/)?docs\/[^`\s$]*\/)\$\{/gu)) add(path);
    for (const [, parts] of source.matchAll(/"docs"((?:\s*,\s*"[^"\s/]+")+)/gu)) {
      const segments = [...parts.matchAll(/"([^"]+)"/gu)].map(([, part]) => part);
      const path = ["docs", ...segments].join("/");
      add(path.endsWith(".md") ? path : `${path}/`);
    }
  }
  return { exact, prefixes: [...prefixes] };
}
let testReadDocsCache;
const defaultTestReadDocs = () => (testReadDocsCache ??= scanTestReadDocs());
const readByTests = (file, docs) => docs.exact.has(file) || docs.prefixes.some((prefix) => file.startsWith(prefix));

const dependencyManifest = (file) => /(^|\/)(?:package(?:-lock)?\.json|npm-shrinkwrap\.json)$/u.test(file);

// The backend has root-unit consumers (shared engine, schemas and access contracts).
// Backend-only changes still need those tests, but do not rebuild the browser application.
const backendOnly = (file) => file.startsWith("backend/ward-flow/");
// Unit test files. Browser specs import only application code and Playwright, never these files.
const unitTest = (file) => /^tests\/.+\.test\.tsx?$/u.test(file);

/**
 * Which jobs a PR needs. `full` gates root installs; the remaining flags gate their named work.
 * Anything not positively recognised runs all executable checks (fail closed).
 * A document a unit test reads is not documentation only: changing it runs the unit job.
 * Maintained policy files keep their own policy contract tests instead.
 */
export function classifyChanges(entries, { testReadDocs } = {}) {
  const flags = (values, reason) => ({
    full: false,
    unit: false,
    browser: false,
    policy: false,
    backend: false,
    build: false,
    frontend_static: false,
    ...values,
    reason,
  });
  const all = (reason) =>
    flags({ full: true, unit: true, browser: true, backend: true, build: true, frontend_static: true }, reason);
  if (!entries.length) return all("empty diff");
  if (entries.some(({ status }) => status !== "M" && status !== "A")) return all("deleted or renamed file");
  const files = entries.map(({ file }) => file);
  let docs;
  const testRead = (file) =>
    docsOnly(file) && !isMaintainedPolicy(file) && readByTests(file, (docs ??= testReadDocs ?? defaultTestReadDocs()));
  if (files.some(isMaintainedPolicy) && files.every((file) => isMaintainedPolicy(file) || docsOnly(file))) {
    const unit = files.some(testRead);
    return flags(
      { full: true, policy: true, unit },
      unit
        ? "maintained policy contracts and documentation, some read by unit tests"
        : "maintained policy contracts and documentation only",
    );
  }
  if (files.every(docsOnly)) {
    if (!files.some(testRead)) return flags({}, "Ward documentation only");
    return flags({ full: true, unit: true }, "Ward documentation, some read by unit tests");
  }
  if (files.every((file) => docsOnly(file) || backendOnly(file))) {
    return flags(
      { full: true, unit: true, backend: true, build: true, frontend_static: true },
      "backend contracts and documentation only",
    );
  }
  if (files.every((file) => docsOnly(file) || backendOnly(file) || unitTest(file))) {
    return flags(
      { full: true, unit: true, backend: files.some(backendOnly), build: true, frontend_static: true },
      "unit tests, backend and documentation only",
    );
  }
  return all("source, browser spec, tooling, configuration or unknown change");
}

/** Independently scoped, dependency-free maintained-document checks. Missing history fails closed. */
export function documentChecks(entries) {
  if (!entries.length || entries.some(({ status }) => !["M", "A"].includes(status)))
    return { owner_index: true, rules_index: true, organisation: true, doc_contracts: true };
  const files = entries.map(({ file }) => file);
  return {
    owner_index: files.some((file) => {
      const source = file.replace(/^(?:docs\/ward-flow\/|docs\/history\/archive\/dated-notes\/)/u, "");
      return (
        file === "scripts/ward-flow/owner-rulings-index.mjs" ||
        ((file.startsWith("docs/ward-flow/") || file.startsWith("docs/history/archive/dated-notes/")) &&
          !source.includes("/") &&
          (source === "decisions.md" ||
            source === "OWNER-RULINGS.md" ||
            /^owner-.*\.md$/u.test(source) ||
            /owner.*ruling.*\.md$/iu.test(source)))
      );
    }),
    rules_index: files.some(
      (file) =>
        /^docs\/(?:ward-flow\/RULES\.md|history\/lessons\/[^/]+\.md)$/u.test(file) ||
        file === "scripts/ward-flow/rules-index.mjs",
    ),
    // A registry edit always runs the check, even one that narrows the roots this reads.
    organisation: files.some((file) => file === ORGANISATION_REGISTRY || matchesOrganisationRoot(file)),
    // Generated docs contracts (screen map, drawing manifest, screen verification, scripts inventory,
    // architecture index, site map) read these inputs. Added directory paths can introduce a new
    // tracked root in the architecture index; conservatively check every such addition.
    doc_contracts:
      files.some(docContractInput) || entries.some(({ status, file }) => status === "A" && file.includes("/")),
  };
}

export function docContractInput(file) {
  return (
    /^(?:src|docs|design|scripts|mockups)\//u.test(file) ||
    file.startsWith("public/help/") ||
    file === "package.json" ||
    file === ".github/workflows/ward-flow.yml"
  );
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
  // Only a pull request with a readable diff may leave the legal-figure sweep out; see legal-sweep-scope.mjs.
  let legalSweep = { run: true, reason: "not a pull request diff" };
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
      legalSweep = needsLegalSweep(changes, legalSweepInputs("."));
    } catch (error) {
      plan = classifyChanges([]);
      plan.reason = `history unavailable (${error.code ?? error.status ?? "error"})`;
      dependencyReview = true;
    }
  }
  console.log(`Ward CI legal-figure sweep: ${legalSweep.run} — ${legalSweep.reason}`);
  console.log(
    `Ward CI scope: full=${plan.full} unit=${plan.unit} browser=${plan.browser} backend=${plan.backend} build=${plan.build} frontend_static=${plan.frontend_static} policy=${plan.policy} — ${plan.reason}; dependency review: ${dependencyReview}`,
  );
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `full=${plan.full}\nunit=${plan.unit}\nbrowser=${plan.browser}\npolicy=${plan.policy}\nbackend=${plan.backend}\nbuild=${plan.build}\nfrontend_static=${plan.frontend_static}\ndependency_review=${dependencyReview}\nlegal_sweep=${legalSweep.run}\n${Object.entries(
        documents,
      )
        .map(([key, value]) => `${key}=${value}\n`)
        .join("")}`,
    );
}
