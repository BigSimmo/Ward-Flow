import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { removePathSync } from "../scripts/retryable-fs.mjs";
import {
  runGovernanceAudit,
  checkProductionDeploymentReadiness,
} from "../scripts/ward-flow/check-clinical-governance-gate.mjs";

const roots: string[] = [];
function fixture(footer = 'export const warning = "Synthetic prototype";', seed = '{ id: "PT-1", umrn: "UM100001" }') {
  const root = mkdtempSync(path.join(os.tmpdir(), "ward-governance-"));
  roots.push(root);
  const component = path.join(root, "src/components/ward-management");
  mkdirSync(path.join(component, "shell"), { recursive: true });
  writeFileSync(path.join(component, "ward-patients-seed.ts"), seed);
  writeFileSync(path.join(component, "shell/ward-prototype-footer.tsx"), footer);
  return root;
}
afterEach(() => {
  for (const root of roots.splice(0)) removePathSync(root, { recursive: true });
});
describe("bounded governance observations", () => {
  it("passes useful source checks without granting readiness", () => {
    const result = runGovernanceAudit(fixture());
    expect(result.ok).toBe(true);
    expect(result.deploymentReadiness.isApprovedForRealPatients).toBe(false);
    expect(result.deploymentReadiness.clinicalReadinessAssessed).toBe(false);
  });
  it.each(["", "{}", "malformed", '{"approved":true}'])(
    "never promotes approval file contents %s to authority",
    (content) => {
      const root = fixture();
      const dir = path.join(root, "docs/ward-flow/governance/approvals");
      mkdirSync(dir, { recursive: true });
      for (const name of [
        "clinical-safety-officer-signed",
        "aboriginal-cultural-safety-signed",
        "wa-mha-2014-legal-signed",
      ])
        writeFileSync(path.join(dir, `${name}.json`), content);
      const result = checkProductionDeploymentReadiness(root);
      expect(Object.values(result.approvals)).toEqual([true, true, true]);
      expect(result.isApprovedForRealPatients).toBe(false);
      expect(result.status).toBe("CLINICAL_READINESS_UNASSESSED");
    },
  );
  it("rejects comment-only disclaimer text", () => {
    expect(runGovernanceAudit(fixture("/* Synthetic prototype */\nexport const warning = null;")).ok).toBe(false);
  });
  it("rejects invalid seed prefixes without printing identifiers", () => {
    const result = runGovernanceAudit(fixture(undefined, '{ id: "unknown-record", umrn: "unknown-identifier" }'));
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result.isolation.violations)).not.toContain("unknown-identifier");
  });
  it("does not count absent literals as successful coverage", () => {
    expect(runGovernanceAudit(fixture(undefined, "export const seed = []; ")).ok).toBe(false);
  });
});
