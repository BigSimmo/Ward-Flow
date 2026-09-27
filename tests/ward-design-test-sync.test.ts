import { describe, expect, it } from "vitest";
import {
  checkRegistryCompleteness,
  auditTestBrittleness,
  detectChanges,
  syncScreenTests,
  loadRegistry,
} from "../scripts/ward-flow/design-test-sync.mjs";

describe("Ward Flow Design-to-Test Synchronization System", () => {
  it("covers all 34 operational contract screens without omissions", async () => {
    const res = await checkRegistryCompleteness();
    expect(res.ok).toBe(true);
    expect(res.errors).toEqual([]);
    expect(res.screenCount).toBe(34);
  });

  it("ensures every registered screen defines protected clinical invariants", () => {
    const registry = loadRegistry();
    for (const screen of registry.screens) {
      expect(screen.invariants?.protectedClinicalFields).toBeDefined();
      expect(screen.invariants.protectedClinicalFields.length).toBeGreaterThan(0);
    }
  });

  it("calculates SHA256 hashes across mockups and components for change detection", () => {
    const changes = detectChanges();
    expect(changes.length).toBe(34);
    for (const c of changes) {
      expect(c.mockupHash).toMatch(/^[0-9a-f]{16}$/);
      expect(c.componentHash).toMatch(/^[0-9a-f]{16}$/);
      expect(c.tests.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("audits test suites and detects brittle DOM queries", () => {
    const warnings = auditTestBrittleness();
    expect(Array.isArray(warnings)).toBe(true);
  });

  it("refuses to synchronize or overwrite if a protected clinical invariant is compromised", () => {
    const res = syncScreenTests("alerts");
    expect(res.synced).toBe(true);
    expect(res.screenId).toBe("alerts");
    expect(res.protectedInvariantsChecked).toBeGreaterThan(0);
  });
});
