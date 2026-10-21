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
import { runFullGateBatches } from "../scripts/ward-flow/full-gate-recheck.mjs";
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
  it("binds checkpoints to the nested backend install, its bytes and its lock", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "ward-backend-dependency-identity-"));
    roots.push(root);
    mkdirSync(path.join(root, "node_modules", "fixture"), { recursive: true });
    writeFileSync(path.join(root, "package-lock.json"), "root lock");
    writeFileSync(path.join(root, "node_modules", "fixture", "index.js"), "root dependency");
    const options = { root, env: {}, population: ["tests/backend-consumer.test.ts"], args: ["run"] };
    const absent = fullGateInputIdentity(options);
    const backend = path.join(root, "backend/ward-flow");
    const modules = path.join(backend, "node_modules");
    mkdirSync(path.join(modules, "fixture"), { recursive: true });
    writeFileSync(path.join(backend, "package-lock.json"), "backend lock one");
    const dependency = path.join(modules, "fixture", "index.js");
    writeFileSync(dependency, "one");
    const installed = fullGateInputIdentity(options);
    expect(installed).not.toBe(absent);
    expect(fullGateInputIdentity(options)).toBe(installed);
    writeFileSync(dependency, "two"); // Same size, path and lock; only executable bytes changed.
    const edited = fullGateInputIdentity(options);
    expect(edited).not.toBe(installed);
    writeFileSync(path.join(backend, "package-lock.json"), "backend lock two");
    const relocked = fullGateInputIdentity(options);
    expect(relocked).not.toBe(edited);
    for (const directory of [".cache", ".tmp", ".vite", ".vite-temp"]) {
      mkdirSync(path.join(modules, directory));
      writeFileSync(path.join(modules, directory, "generated.js"), directory);
    }
    expect(fullGateInputIdentity(options)).toBe(relocked);
    removePathSync(modules, { recursive: true });
    expect(fullGateInputIdentity(options)).toBe(absent);
  });
  it("fails closed when a nested backend install has no lock or cannot be read as a tree", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "ward-backend-dependency-unreadable-"));
    roots.push(root);
    mkdirSync(path.join(root, "node_modules", "fixture"), { recursive: true });
    writeFileSync(path.join(root, "package-lock.json"), "root lock");
    writeFileSync(path.join(root, "node_modules", "fixture", "index.js"), "root dependency");
    const backend = path.join(root, "backend/ward-flow");
    const modules = path.join(backend, "node_modules");
    mkdirSync(modules, { recursive: true });
    expect(installedToolchainIdentity(root)).toBeNull();
    writeFileSync(path.join(backend, "package-lock.json"), "backend lock");
    expect(installedToolchainIdentity(root)).toMatch(/^[a-f0-9]{64}$/);
    removePathSync(modules, { recursive: true });
    writeFileSync(modules, "invalid dependency tree");
    expect(installedToolchainIdentity(root)).toBeNull();
  });
  it("invalidates full checkpoints when the engine fuzz effort or seed window changes", () => {
    const options = {
      root: "/unused-fixture-root",
      dependencyIdentity: "unchanged-fixture-dependencies",
      population: ["tests/ward-engine-safety.test.ts"],
      args: ["run"],
      env: {
        WARD_ENGINE_FUZZ_SEQUENCES: "1",
        WARD_ENGINE_FUZZ_STEPS: "1",
        WARD_ENGINE_FUZZ_FIRST_SEED: "1",
      },
    };
    const reduced = fullGateInputIdentity(options);
    expect(fullGateInputIdentity({ ...options, env: {} })).not.toBe(reduced);
    for (const [name, value] of [
      ["WARD_ENGINE_FUZZ_SEQUENCES", "16"],
      ["WARD_ENGINE_FUZZ_STEPS", "100"],
      ["WARD_ENGINE_FUZZ_FIRST_SEED", "101"],
    ] as const) {
      expect(fullGateInputIdentity({ ...options, env: { ...options.env, [name]: value } }), name).not.toBe(reduced);
    }
    expect(fullGateInputIdentity(options)).toBe(reduced);
  });
  it("resumes the same checkpoint after Vite creates its generated configuration directory", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "ward-vite-checkpoint-"));
    roots.push(root);
    mkdirSync(path.join(root, "node_modules", "fixture"), { recursive: true });
    writeFileSync(path.join(root, "package-lock.json"), "fixture lock");
    writeFileSync(path.join(root, "node_modules", "fixture", "index.js"), "stable dependency");
    const population = ["tests/example.test.ts"];
    const fingerprint = () => fullGateInputIdentity({ root, population, args: ["run"] });
    let executions = 0;
    const options = {
      root,
      population,
      commit: "a".repeat(40),
      skippedTooling: false,
      stateDir: path.join(root, "checkpoint"),
      runBatch: ({ reportPath }: { reportPath: string }) => {
        executions++;
        writeFileSync(
          reportPath,
          JSON.stringify({
            numTotalTests: 1,
            testResults: [
              { name: path.join(root, population[0]!), status: "passed", assertionResults: [{ status: "passed" }] },
            ],
          }),
        );
        return { status: 0 };
      },
    };
    runFullGateBatches({ ...options, environmentFingerprint: fingerprint() });
    mkdirSync(path.join(root, "node_modules", ".vite-temp"));
    expect(() => runFullGateBatches({ ...options, environmentFingerprint: fingerprint() })).not.toThrow();
    writeFileSync(path.join(root, "node_modules", ".vite-temp", "config.mjs"), "generated transform");
    expect(() => runFullGateBatches({ ...options, environmentFingerprint: fingerprint() })).not.toThrow();
    expect(executions).toBe(1);
  });
  it("ignores generated directories, but hashes a dependency file with a cache-shaped name", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "ward-volatile-identity-"));
    roots.push(root);
    mkdirSync(path.join(root, "node_modules", "fixture"), { recursive: true });
    writeFileSync(path.join(root, "package-lock.json"), "fixture lock");
    writeFileSync(path.join(root, "node_modules", "fixture", "index.js"), "stable dependency");
    const before = installedToolchainIdentity(root);
    for (const directory of [".cache", ".tmp", ".vite", ".vite-temp"]) {
      mkdirSync(path.join(root, "node_modules", directory));
      writeFileSync(path.join(root, "node_modules", directory, "generated.js"), directory);
    }
    expect(installedToolchainIdentity(root)).toBe(before);
    writeFileSync(path.join(root, "node_modules", "fixture", ".vite-temp"), "dependency bytes");
    expect(installedToolchainIdentity(root)).not.toBe(before);
  });
});
