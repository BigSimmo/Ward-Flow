import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Does this pull request need the legal-figure dueAt sweep (tests/ward-legal-figure-guard-sweep-*)?
 *
 * The sweep drives every event through the reducer from every seeded world, so it is about a third
 * of all unit test time. Josh's ruling (27 October 2026): a pull request runs it only when it
 * changes something the sweep runs. Main pushes, the nightly run and manual runs always run it.
 *
 * "Something the sweep runs" is the import closure of the sweep files and the unit setup file,
 * followed from the PR's own tree: a change that adds a new import does so by editing a file already
 * in the closure. Configuration that changes how every test runs, and the files that decide this,
 * always count. Anything not positively recognised runs the sweep (fail closed).
 */

const SWEEP_TEST = /^tests\/ward-legal-figure-guard-sweep-\d+\.test\.ts$/u;
const SETUP_FILES = ["tests/setup/reducer-slices.setup.ts"];

/** Files outside the import closure that still change what the sweep does or whether it runs. */
const ALWAYS = new Set([
  ".github/workflows/ward-flow.yml",
  ".nvmrc",
  "package.json",
  "package-lock.json",
  "scripts/check-ward-expected-reds.mjs",
  "scripts/unit-test-population.mjs",
  "scripts/ward-ci-public/legal-sweep-scope.mjs",
  "scripts/ward-ci-public/plan.mjs",
  "scripts/ward-ci-public/verify-plan.mjs",
  "tests/ward-expected-reds.json",
]);
const alwaysPattern = (file) =>
  ALWAYS.has(file) ||
  /^tests\/setup\//u.test(file) ||
  /^vitest\.[\w.-]+$/u.test(file) ||
  /^tsconfig[^/]*\.json$/u.test(file);

/** The sweep test files in this tree, sorted. */
export function legalSweepTests(root = ".") {
  const directory = path.join(root, "tests");
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .map((name) => `tests/${name}`)
    .filter((file) => SWEEP_TEST.test(file))
    .sort();
}

function resolveImport(root, from, specifier) {
  const target = specifier.startsWith("@/")
    ? `src/${specifier.slice(2)}`
    : specifier.startsWith(".")
      ? path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier))
      : null;
  if (!target || target.split("/").includes("..")) return null;
  const candidates = [
    target,
    ...(target.endsWith(".js") ? [`${target.slice(0, -3)}.ts`, `${target.slice(0, -3)}.tsx`] : []),
    ...[".ts", ".tsx", ".mjs", ".cjs", ".js", "/index.ts", "/index.tsx", "/index.mjs", "/index.cjs", "/index.js"].map(
      (suffix) => `${target}${suffix}`,
    ),
  ];
  return (
    candidates.find((candidate) => {
      const file = path.join(root, candidate);
      return existsSync(file) && statSync(file).isFile();
    }) ?? null
  );
}

/**
 * Every repository file the sweep imports, directly or not, plus the sweep files and setup file.
 * Uses the same import pattern as the related-test selector; a match inside a comment only adds a
 * file, which errs towards running the sweep.
 */
export function legalSweepInputs(root = ".") {
  const start = [...legalSweepTests(root), ...SETUP_FILES.filter((file) => existsSync(path.join(root, file)))];
  const seen = new Set(start);
  const queue = [...start];
  for (let index = 0; index < queue.length; index++) {
    const file = queue[index];
    if (!/\.(tsx?|mjs|cjs|js)$/u.test(file)) continue;
    const source = readFileSync(path.join(root, file), "utf8");
    for (const match of source.matchAll(/(?:from\s+|import\s*\(\s*|import\s+|require\(\s*)["']([^"']+)["']/gu)) {
      const target = resolveImport(root, file, match[1]);
      if (target && !seen.has(target)) {
        seen.add(target);
        queue.push(target);
      }
    }
  }
  return seen;
}

/**
 * @param {{ status: string, file: string }[]} entries the PR's `git diff --name-status` entries
 * @param {Set<string>} inputs from legalSweepInputs on the PR's tree
 * @returns {{ run: boolean, reason: string }}
 */
export function needsLegalSweep(entries, inputs) {
  if (!entries.length) return { run: true, reason: "empty diff" };
  if (entries.some(({ status }) => status !== "M" && status !== "A"))
    return { run: true, reason: "deleted or renamed file" };
  if (![...inputs].some((file) => SWEEP_TEST.test(file))) return { run: true, reason: "no sweep files found" };
  const hit = entries.find(({ file }) => inputs.has(file) || alwaysPattern(file));
  if (hit) return { run: true, reason: `${hit.file} is something the sweep runs` };
  return { run: false, reason: "no change reaches the sweep" };
}
