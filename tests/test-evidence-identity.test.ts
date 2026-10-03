import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  installedToolchainIdentity,
  fullGateInputIdentity,
  testEnvironmentIdentity,
} from "../scripts/test-evidence-identity.mjs";
import { removePathSync } from "../scripts/retryable-fs.mjs";
import { consultGateReceipt } from "../scripts/gate-receipts.mjs";
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => removePathSync(root, { recursive: true })));
describe("test outcome input identity", () => {
  it("changes for exclusions, seed, options and locale without disclosing their values", () => {
    const baseline = testEnvironmentIdentity({});
    for (const name of [
      "WARD_GATE_EXCLUDE_FILES",
      "FAST_CHECK_SEED",
      "NODE_OPTIONS",
      "LANG",
      "LC_ALL",
      "TZ",
      "VITEST_MAX_WORKERS",
      "CI",
    ]) {
      expect(testEnvironmentIdentity({ [name]: "different" }), name).not.toBe(baseline);
    }
    expect(testEnvironmentIdentity({})).toBe(baseline);
  });
  it("binds full checkpoints to actual changed dependency bytes at the same paths", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "ward-dependency-identity-"));
    roots.push(root);
    mkdirSync(path.join(root, "node_modules", "fixture"), { recursive: true });
    writeFileSync(path.join(root, "package-lock.json"), "fixture lock");
    const dependency = path.join(root, "node_modules", "fixture", "index.js");
    writeFileSync(dependency, "one");
    const initial = installedToolchainIdentity(root);
    expect(initial).toMatch(/^[a-f0-9]{64}$/);
    const options = { root, env: {}, population: ["tests/example.test.ts"], args: ["run"] };
    const before = fullGateInputIdentity(options);
    expect(fullGateInputIdentity(options)).toBe(before);
    expect(fullGateInputIdentity({ ...options, env: { VITEST_MAX_WORKERS: "1" } })).not.toBe(before);
    writeFileSync(dependency, "two"); // same size, same location, same lockfile
    expect(installedToolchainIdentity(root)).not.toBe(initial);
    expect(fullGateInputIdentity(options)).not.toBe(before);
    expect(() => fullGateInputIdentity({ ...options, dependencyIdentity: null })).toThrow(/unavailable/);
  });
  it("never treats install metadata or ambient environment as trustworthy narrow receipt input", () => {
    const decision = consultGateReceipt({
      projectRoot: process.cwd(),
      gate: "vitest",
      env: { GATE_DEPENDENCY_IDENTITY: "claimed-immutable" },
    });
    expect(decision.reuse).toBe(false);
    expect(decision.reason).toMatch(/dependency byte identity unavailable/);
  });
});
