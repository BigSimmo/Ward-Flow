#!/usr/bin/env node
import { existsSync, readFileSync, globSync, statSync } from "node:fs";
import path from "node:path";
import { createPreparationProfile } from "./ward-flow/test-preparation-profile.mjs";
import { fileURLToPath } from "node:url";

import { COVERAGE_INVENTORY_ROOTS, COVERAGE_INCLUDE_GLOBS, COVERAGE_EXCLUDE_GLOBS } from "./coverage-contract.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

export function lcovSourceFiles(source) {
  return source
    .split(/\r?\n/)
    .filter((line) => line.startsWith("SF:"))
    .map((line) => line.slice(3).replaceAll("\\", "/").replace(/^\.\//, ""))
    .map((file) => {
      const rootPrefix = `${root.replaceAll("\\", "/")}/`;
      return file.startsWith(rootPrefix) ? file.slice(rootPrefix.length) : file;
    });
}

export function missingCoverageRoots(sourceFiles, expectedRoots = COVERAGE_INVENTORY_ROOTS) {
  return expectedRoots.filter((expectedRoot) => !sourceFiles.some((file) => file.startsWith(expectedRoot)));
}

export function coveragePopulation(base = root) {
  return globSync(COVERAGE_INCLUDE_GLOBS, { cwd: base, exclude: [...COVERAGE_EXCLUDE_GLOBS] })
    .filter((file) => statSync(path.join(base, file)).isFile())
    .map((file) => file.replaceAll("\\", "/"))
    .sort();
}

export function checkCoverageInventory(lcovSource, { root: base = root } = {}) {
  const prefix = `${path.resolve(base).replaceAll("\\", "/")}/`;
  const sourceFiles = lcovSourceFiles(lcovSource).map((file) =>
    file.startsWith(prefix) ? file.slice(prefix.length) : file,
  );
  const profile = createPreparationProfile("coverage-inventory");
  const population = profile.measure("enumeration", () => coveragePopulation(base));
  const expected = new Set(population);
  const recorded = new Set(sourceFiles);
  const result = profile.measure("reconciliation", () => ({
    sourceFiles,
    missing: population.filter((file) => !recorded.has(file)),
    invalid: sourceFiles.filter((file) => !expected.has(file)),
    population,
  }));
  profile.count("population", population.length);
  profile.count("reportedFiles", sourceFiles.length);
  profile.write({
    note: "LCOV inventory reconciliation; V8 uncovered-file transformation is measured separately with DEBUG=vitest:coverage.",
  });
  return result;
}

function main(argv = process.argv.slice(2)) {
  const lcovIndex = argv.indexOf("--lcov");
  const lcovPath = path.resolve(
    root,
    lcovIndex >= 0 ? (argv[lcovIndex + 1] ?? "coverage/lcov.info") : "coverage/lcov.info",
  );
  if (!existsSync(lcovPath)) {
    console.error(`[coverage-inventory] FAIL — LCOV report not found at ${path.relative(root, lcovPath)}.`);
    return 1;
  }

  const result = checkCoverageInventory(readFileSync(lcovPath, "utf8"));
  if (result.sourceFiles.length === 0) {
    console.error("[coverage-inventory] FAIL — LCOV contains no source-file records.");
    return 1;
  }
  if (result.missing.length > 0 || result.invalid.length > 0) {
    console.error(
      `[coverage-inventory] FAIL — missing executable files: ${result.missing.join(", ")}; invalid LCOV paths: ${result.invalid.join(", ")}.`,
    );
    return 1;
  }

  console.log(
    `[coverage-inventory] PASS — ${result.sourceFiles.length} source files cover ${COVERAGE_INVENTORY_ROOTS.join(", ")}.`,
  );
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("check-coverage-inventory.mjs")) {
  process.exitCode = main();
}
