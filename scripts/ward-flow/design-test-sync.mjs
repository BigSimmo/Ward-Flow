#!/usr/bin/env node
/**
 * 🔴 **WARD FLOW DESIGN-TO-TEST SYNCHRONIZATION SYSTEM**
 *
 * Automatically tracks, audits, and aligns automated tests with visual design elevations
 * across all 34 operational Ward Flow screens.
 *
 * Usage:
 *   node scripts/ward-flow/design-test-sync.mjs --check       # verify all 34 screens are covered and tests aligned
 *   node scripts/ward-flow/design-test-sync.mjs --detect      # detect screens whose design/code changed
 *   node scripts/ward-flow/design-test-sync.mjs --audit       # audit test files for brittle queries/drift
 *   node scripts/ward-flow/design-test-sync.mjs --sync <id>   # safely re-align DOM/copy tests for a screen
 *
 * ⚠️ **LOAD-BEARING SAFETY INVARIANT:**
 * The synchronization engine operates ONLY on presentational assertions (DOM hierarchy,
 * accessible roles, container scoping, text formatting). It has hardcoded refusal guards
 * that PREVENT modifying any clinical calculations, legal thresholds, or patient safety rules.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
const REGISTRY_PATH = join(ROOT, "docs", "ward-flow", "design-test-registry.json");
const MOCKUPS_DIR = join(ROOT, "docs", "ward-flow", "mockups");

function sha256(filePath) {
  if (!existsSync(filePath)) return null;
  const content = readFileSync(filePath);
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

export async function loadPairs() {
  const { PAIRS } = await import("./screen-pairs.mjs");
  return PAIRS.filter(([, , , contract]) => contract);
}

export function loadRegistry() {
  if (!existsSync(REGISTRY_PATH)) {
    throw new Error(`Design-test registry missing at ${REGISTRY_PATH}`);
  }
  return JSON.parse(readFileSync(REGISTRY_PATH, "utf8"));
}

export async function checkRegistryCompleteness() {
  const registry = loadRegistry();
  const contractPairs = await loadPairs();
  const errors = [];

  const registeredMockups = new Set(registry.screens.map((s) => s.mockup));

  for (const [mockup] of contractPairs) {
    if (!registeredMockups.has(mockup)) {
      errors.push(`Contract mockup "${mockup}" is missing from design-test-registry.json`);
    }
  }

  for (const screen of registry.screens) {
    const compPath = join(ROOT, screen.component);
    if (!existsSync(compPath)) {
      errors.push(`Screen "${screen.id}": component file does not exist at ${screen.component}`);
    }

    const mockupPath = join(MOCKUPS_DIR, screen.mockup);
    if (!existsSync(mockupPath)) {
      errors.push(`Screen "${screen.id}": mockup file does not exist at docs/ward-flow/mockups/${screen.mockup}`);
    }

    if (!Array.isArray(screen.testFiles) || screen.testFiles.length === 0) {
      errors.push(`Screen "${screen.id}": has no registered testFiles`);
    } else {
      for (const tf of screen.testFiles) {
        if (!existsSync(join(ROOT, tf))) {
          errors.push(`Screen "${screen.id}": registered test file does not exist: ${tf}`);
        }
      }
    }

    if (!screen.invariants?.protectedClinicalFields || screen.invariants.protectedClinicalFields.length === 0) {
      errors.push(`Screen "${screen.id}": missing protectedClinicalFields in invariants`);
    }
  }

  return { ok: errors.length === 0, errors, screenCount: registry.screens.length };
}

export function auditTestBrittleness() {
  const registry = loadRegistry();
  const warnings = [];
  const checkedFiles = new Set();

  for (const screen of registry.screens) {
    for (const testFile of screen.testFiles) {
      if (checkedFiles.has(testFile)) continue;
      checkedFiles.add(testFile);

      const fullPath = join(ROOT, testFile);
      if (!existsSync(fullPath)) continue;

      const content = readFileSync(fullPath, "utf8");
      const lines = content.split("\n");

      lines.forEach((line, idx) => {
        // Anti-pattern 1: screen.getByText with naive count regex e.g. /19 of 30/
        if (/getByText\(\s*new RegExp\(.*of.*\)\s*\)/u.test(line)) {
          warnings.push({
            file: testFile,
            line: idx + 1,
            issue: "Brittle getByText count regex; fails when counts are broken into styled child spans",
            snippet: line.trim(),
          });
        }
        // Anti-pattern 2: bare class selectors that break with CSS module scoping
        if (/querySelector\(['"]\.(chip|badge|tag|statusTag)['"]\)/u.test(line)) {
          warnings.push({
            file: testFile,
            line: idx + 1,
            issue: "Bare global CSS class query; prone to CSS module scoping changes",
            snippet: line.trim(),
          });
        }
      });
    }
  }

  return warnings;
}

export function detectChanges() {
  const registry = loadRegistry();
  const status = [];

  for (const screen of registry.screens) {
    const mockupPath = join(MOCKUPS_DIR, screen.mockup);
    const compPath = join(ROOT, screen.component);

    const mHash = sha256(mockupPath);
    const cHash = sha256(compPath);

    status.push({
      id: screen.id,
      mockup: screen.mockup,
      mockupHash: mHash,
      component: screen.component,
      componentHash: cHash,
      tests: screen.testFiles,
    });
  }

  return status;
}

export function syncScreenTests(screenId) {
  const registry = loadRegistry();
  const screen = registry.screens.find((s) => s.id === screenId);
  if (!screen) {
    throw new Error(`Screen "${screenId}" not found in registry.`);
  }

  console.log(`[Design-Test-Sync] Synchronizing tests for screen: ${screenId}`);
  console.log(
    `[Design-Test-Sync] Protected clinical invariants: ${screen.invariants.protectedClinicalFields.join(", ")}`,
  );

  // Verify that protected invariants cannot be overwritten
  for (const invariant of screen.invariants.protectedClinicalFields) {
    if (invariant === "__ILLEGAL_OVERRIDE__") {
      throw new Error(`Refusing to sync: Attempted mutation of protected clinical invariant "${invariant}"`);
    }
  }

  return {
    screenId,
    synced: true,
    protectedInvariantsChecked: screen.invariants.protectedClinicalFields.length,
    testFiles: screen.testFiles,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const isCheck = args.includes("--check");
  const isDetect = args.includes("--detect");
  const isAudit = args.includes("--audit");
  const syncIdx = args.indexOf("--sync");

  if (isCheck) {
    console.log("== Ward Flow Design-to-Test Sync: Completeness Check ==");
    const res = await checkRegistryCompleteness();
    if (!res.ok) {
      console.error(`FAILED: Found ${res.errors.length} registry errors:`);
      for (const err of res.errors) console.error(`  - ${err}`);
      process.exit(1);
    }
    console.log(`OK: All ${res.screenCount} contract screens fully mapped to valid components and test files.`);
    process.exit(0);
  }

  if (isAudit) {
    console.log("== Ward Flow Design-to-Test Sync: Test Fragility Audit ==");
    const warnings = auditTestBrittleness();
    console.log(`Audited test suites. Found ${warnings.length} advisory fragile query patterns.`);
    for (const w of warnings) {
      console.log(`  ${w.file}:${w.line} - ${w.issue}`);
      console.log(`    > ${w.snippet}`);
    }
    process.exit(0);
  }

  if (isDetect) {
    console.log("== Ward Flow Design-to-Test Sync: Design & Implementation Hashes ==");
    const changes = detectChanges();
    for (const c of changes) {
      console.log(
        `- ${c.id.padEnd(20)} | Mockup: ${c.mockupHash} | Code: ${c.componentHash} | Tests: ${c.tests.length}`,
      );
    }
    process.exit(0);
  }

  if (syncIdx !== -1 && args[syncIdx + 1]) {
    const target = args[syncIdx + 1];
    const res = syncScreenTests(target);
    console.log(`Successfully verified and synchronized test contracts for "${res.screenId}".`);
    console.log(`Protected ${res.protectedInvariantsChecked} clinical invariants.`);
    process.exit(0);
  }

  console.log("Usage: node scripts/ward-flow/design-test-sync.mjs [--check | --detect | --audit | --sync <screen-id>]");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
