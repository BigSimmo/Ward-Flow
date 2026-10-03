#!/usr/bin/env node
/**
 * Ward Flow synthetic fixture and disclaimer-source checks.
 *
 * Checks literal identifiers in one seed source and warning text in one footer source.
 * This cannot establish data provenance, rendered coverage, outbound API absence,
 * deployment enforcement or clinical readiness. Specialist reviews remain required.
 *
 * Exit codes:
 *   0: These bounded local source checks passed.
 *   1: A source check failed; no clinical-safety verdict is implied.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
export function verifySyntheticPatientIsolation(root = ROOT) {
  const PATIENT_SEED = join(root, "src", "components", "ward-management", "ward-patients-seed.ts");
  if (!existsSync(PATIENT_SEED)) {
    throw new Error(`Patient seed file missing: ${PATIENT_SEED}`);
  }
  const content = readFileSync(PATIENT_SEED, "utf8");
  const violations = [];
  const counts = { umrns: 0, ids: 0 };

  // Verify synthetic UMRN prefix discipline (all synthetic records use UM100xxx or SYN- prefix)
  const umrnMatches = content.matchAll(/umrn:\s*["']([^"']+)["']/g);
  for (const match of umrnMatches) {
    counts.umrns += 1;
    const umrn = match[1];
    if (!/^UM1\d{5}$/u.test(umrn) && !/^SYN-\d+$/u.test(umrn) && !/^UMRN-\d+$/u.test(umrn)) {
      violations.push("Seed identifier does not use an allowed synthetic UMRN prefix.");
    }
  }

  // Verify synthetic patient ID prefix discipline
  const idMatches = content.matchAll(/id:\s*["']([^"']+)["']/g);
  for (const match of idMatches) {
    counts.ids += 1;
    const id = match[1];
    if (!/^(PT-|PAT-|WF-|RF-)/u.test(id)) {
      violations.push("Seed record ID does not use an allowed synthetic prefix.");
    }
  }

  if (counts.ids === 0 || counts.umrns === 0)
    violations.push("No literal seed IDs or UMRNs found; source coverage cannot be established.");
  return { ok: violations.length === 0, violations, counts, scope: "literal seed identifiers only" };
}

export function verifyPrototypeDisclaimers(root = ROOT) {
  const violations = [];
  const shellComponent = join(root, "src", "components", "ward-management", "shell", "ward-prototype-footer.tsx");
  if (!existsSync(shellComponent)) {
    violations.push("Ward prototype footer disclaimer component is missing!");
  } else {
    const content = readFileSync(shellComponent, "utf8").replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gmu, "");
    if (!content.includes("Synthetic") || !content.includes("prototype")) {
      violations.push("Ward prototype footer disclaimer does not contain explicit Synthetic Prototype warning.");
    }
  }
  return {
    ok: violations.length === 0,
    violations,
    scope: "footer source warning text; rendering and mounting unassessed",
  };
}

export function checkProductionDeploymentReadiness(root = ROOT) {
  const APPROVALS_DIR = join(root, "docs", "ward-flow", "governance", "approvals");
  const csoApproval = join(APPROVALS_DIR, "clinical-safety-officer-signed.json");
  const culturalApproval = join(APPROVALS_DIR, "aboriginal-cultural-safety-signed.json");
  const legalApproval = join(APPROVALS_DIR, "wa-mha-2014-legal-signed.json");

  const approvals = {
    clinicalSafetyOfficer: existsSync(csoApproval),
    aboriginalCulturalSafety: existsSync(culturalApproval),
    waMentalHealthActLegal: existsSync(legalApproval),
  };

  return {
    isApprovedForRealPatients: false,
    clinicalReadinessAssessed: false,
    approvals,
    approvalObservation: "file presence only; authenticity, content pins and owner authority unverified",
    status: "CLINICAL_READINESS_UNASSESSED",
  };
}

export function runGovernanceAudit(root = ROOT) {
  const iso = verifySyntheticPatientIsolation(root);
  const disc = verifyPrototypeDisclaimers(root);
  const deploy = checkProductionDeploymentReadiness(root);

  return {
    ok: iso.ok && disc.ok,
    isolation: iso,
    disclaimers: disc,
    deploymentReadiness: deploy,
  };
}

function main() {
  console.log("== Ward Flow bounded synthetic-source checks ==");
  const audit = runGovernanceAudit();

  if (!audit.isolation.ok) {
    console.error("FAIL: Synthetic seed identifier check:");
    for (const v of audit.isolation.violations) console.error(`  - ${v}`);
    process.exit(1);
  }
  console.log(
    `OK: Allowed prefixes in ${audit.isolation.counts.ids} literal seed IDs and ${audit.isolation.counts.umrns} UMRNs. Data provenance unassessed.`,
  );

  if (!audit.disclaimers.ok) {
    console.error("FAIL: Prototype disclaimer missing:");
    for (const v of audit.disclaimers.violations) console.error(`  - ${v}`);
    process.exit(1);
  }
  console.log("OK: Footer source contains synthetic prototype warning text. Rendered coverage unassessed.");

  console.log(`STATUS: ${audit.deploymentReadiness.status}`);
  for (const [name, present] of Object.entries(audit.deploymentReadiness.approvals)) {
    console.log(`  - ${name}: ${present ? "FILE PRESENT (unverified)" : "FILE ABSENT"}`);
  }
  console.log(
    "PASS: Bounded local source checks only. Clinical, cultural, privacy and legal review remain required before real-patient use; deployment enforcement is unassessed.",
  );
  process.exit(0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
