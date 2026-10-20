import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { backendTestPlan, parseBackendTestArguments, runBackendTests } from "../scripts/run-backend-tests.mjs";

import { removePathSync } from "../scripts/retryable-fs.mjs";

const temporaryRoots: string[] = [];
afterEach(() => {
  for (const root of temporaryRoots.splice(0)) removePathSync(root, { recursive: true });
});

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "ward-backend-runner-"));
  temporaryRoots.push(root);
  for (const file of [
    "first.test.mjs",
    "nested/new.test.mjs",
    "node_modules/ignored.test.mjs",
    "dist/ignored.test.mjs",
    "helper.test-support.mjs",
  ]) {
    const absolute = path.join(root, "backend/ward-flow", file);
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, "// synthetic discovery fixture");
  }
  return root;
}

describe("backend test discovery and integration evidence", () => {
  it("discovers new nested tests without admitting dependencies or build artifacts", () => {
    const plan = backendTestPlan({ root: fixture(), environment: {} });
    expect(plan.files).toEqual(["first.test.mjs", "nested/new.test.mjs"]);
    expect(plan.args.slice(-2)).toEqual(plan.files.map((file) => path.join(plan.cwd, file)));
    expect(plan.integration).toBe(false);
    expect(plan.summary).toContain("PostgreSQL integration: NOT RUN");
  });
  it("executes option-like test filenames as files rather than Node flags", async () => {
    const root = fixture();
    writeFileSync(
      path.join(root, "backend/ward-flow", "--test-name-pattern=NEVER_MATCH.test.mjs"),
      'import { test } from "node:test"; test("option filename executes", () => {});\n',
    );
    let output = "";
    const code = await runBackendTests({
      root,
      environment: {},
      offline: true,
      log: () => {},
      run: async (command, args, options = {}) => {
        const result = spawnSync(command, args, {
          cwd: options.cwd,
          env: { ...options.env, NODE_ENV: "test" },
          encoding: "utf8",
          timeout: 5000,
          killSignal: "SIGKILL",
        });
        output = result.stdout + result.stderr;
        return result;
      },
    });
    expect(code, output).toBe(0);
    expect(output).toContain("option filename executes");
  });
  it("keeps the existing explicit loopback CI database opt-in", () => {
    const plan = backendTestPlan({
      root: fixture(),
      environment: { WARD_TEST_DATABASE_URL: "postgresql://postgres@127.0.0.1:5432/wardflow_test" },
    });
    expect(plan.integration).toBe(true);
    expect(plan.summary).toContain("PostgreSQL integration: selected");
  });
  it("refuses missing or remote databases when integration is requested", () => {
    const root = fixture();
    expect(() => backendTestPlan({ root, environment: {}, requireDatabase: true })).toThrow(/WARD_TEST_DATABASE_URL/);
    expect(() =>
      backendTestPlan({
        root,
        environment: { WARD_TEST_DATABASE_URL: "postgresql://postgres@example.invalid/wardflow_test" },
      }),
    ).toThrow(/loopback/);
    expect(() => backendTestPlan({ root, environment: { WARD_TEST_DATABASE_URL: "https://localhost/" } })).toThrow(
      /PostgreSQL/,
    );
  });
  it("offline mode scrubs inherited provider destinations and database integration", () => {
    const plan = backendTestPlan({
      root: fixture(),
      offline: true,
      environment: {
        OPENAI_API_KEY: "example-only",
        WARD_TEST_DATABASE_URL: "postgresql://postgres@example.invalid/wardflow_test",
      },
    });
    expect(plan.integration).toBe(false);
    expect(plan.environment.WARD_TEST_DATABASE_URL).toBe("");
    expect(plan.environment.OPENAI_API_KEY).toBe("");
  });
  it("adds a separately named backend LCOV report without silently setting a coverage floor", () => {
    const root = fixture();
    const plan = backendTestPlan({ root, environment: {}, coverage: true });
    expect(plan.args).toContain("--experimental-test-coverage");
    expect(plan.args).toContain("--test-reporter=lcov");
    expect(plan.args).toContain("--test-coverage-exclude=**/node_modules/**");
    expect(plan.args).toContain("--test-coverage-exclude=**/dist/**");
    expect(plan.args).toContain(`--test-reporter-destination=${path.join(root, "coverage/backend/lcov.info")}`);
    expect(plan.args.some((arg: string) => arg.startsWith("--test-coverage-lines="))).toBe(false);
  });
  it("writes usable LCOV using the installed Node runner against a synthetic backend", async () => {
    const root = fixture();
    const backend = path.join(root, "backend/ward-flow");
    writeFileSync(path.join(backend, "value.mjs"), "export const value = 42;\n");
    writeFileSync(
      path.join(backend, "first.test.mjs"),
      'import { test } from "node:test"; import { strictEqual } from "node:assert"; import { value } from "./value.mjs"; test("synthetic coverage", () => strictEqual(value, 42));\n',
    );
    const code = await runBackendTests({ root, environment: {}, offline: true, coverage: true, log: () => {} });
    expect(code).toBe(0);
    const report = readFileSync(path.join(root, "coverage/backend/lcov.info"), "utf8");
    expect(report).toMatch(/SF:.*value\.mjs/);
    expect(report).not.toContain("SF:first.test.mjs");
    expect(report).toContain("DA:1,1");
  });
  it("propagates test launch failures and prints the integration limitation", async () => {
    const messages: string[] = [];
    const code = await runBackendTests({
      root: fixture(),
      environment: {},
      log: (text: string) => messages.push(text),
      run: async () => ({ status: 7 }),
    });
    expect(code).toBe(7);
    expect(messages.join("\n")).toContain("PostgreSQL integration: NOT RUN");
  });
  it("refuses ambiguous or unknown runner options", () => {
    expect(() => parseBackendTestArguments(["--offline", "--integration"])).toThrow(/cannot combine/);
    expect(() => parseBackendTestArguments(["--unknown"])).toThrow(/Unknown/);
  });
});
