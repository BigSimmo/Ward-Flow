import { describe, expect, it } from "vitest";
import { classifyChanges } from "../scripts/ward-ci-public/plan.mjs";

const scope = (...files: string[]) => classifyChanges(files.map((file) => ({ status: "M", file })));

describe("CI scopes follow package consumers and keep the production build for executable changes", () => {
  it.each([
    "backend/ward-flow/engine.ts",
    "backend/ward-flow/command-schemas.ts",
    "backend/ward-flow/package-lock.json",
  ])("keeps root contract tests for backend input %s", (file) => {
    expect(scope(file)).toMatchObject({
      full: true,
      unit: true,
      backend: true,
      frontend_static: true,
      build: true,
      browser: false,
    });
  });
  it("does not install/test the backend for a unit-test-only change, but still builds the app", () => {
    expect(scope("tests/ward-waitlist.test.ts")).toMatchObject({
      full: true,
      unit: true,
      backend: false,
      frontend_static: true,
      build: true,
      browser: false,
    });
  });
  it("keeps executable flags false for documents and policy contracts", () => {
    expect(scope("README.md")).toMatchObject({
      full: false,
      unit: false,
      backend: false,
      frontend_static: false,
      build: false,
    });
    expect(scope("AGENTS.md")).toMatchObject({
      full: true,
      policy: true,
      unit: false,
      backend: false,
      frontend_static: false,
      build: false,
    });
  });
  it("unknown, source, renamed and missing history include the backend and build", () => {
    for (const plan of [
      scope("src/app/page.tsx"),
      scope("unrecognised"),
      classifyChanges([]),
      classifyChanges([{ status: "D", file: "README.md" }]),
    ])
      expect(plan).toMatchObject({ backend: true, frontend_static: true, build: true, unit: true, browser: true });
  });
});
