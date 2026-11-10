import { describe, expect, it } from "vitest";
import { classifyChanges, scanTestReadDocs } from "../scripts/ward-ci-public/plan.mjs";

const scope = (...files: string[]) => classifyChanges(files.map((file) => ({ status: "M", file })));
const unread = { testReadDocs: { exact: new Set<string>(), prefixes: [] as string[] } };
const scopeUnread = (...files: string[]) =>
  classifyChanges(
    files.map((file) => ({ status: "M", file })),
    unread,
  );

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
  it("keeps executable flags false for documents no unit test reads and for policy contracts", () => {
    expect(scopeUnread("README.md")).toMatchObject({
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

describe("a document a unit test reads runs the unit job (A6-F09)", () => {
  const docs = scanTestReadDocs();
  // Built from parts so this test's own source does not name it as a read document.
  const unreadDoc = "docs/" + "history/synthetic-unread-note.md";
  it("finds exact paths and built-up directories in test source", () => {
    expect(docs.exact.has("docs/ward-flow/decisions.md")).toBe(true);
    expect(docs.exact.has("docs/ward-flow/desk-guides/why-cant-i.md")).toBe(true);
    // tests/ward-help-desk-guide-drift.test.ts reads `docs/ward-flow/desk-guides/${file}`.
    expect(docs.prefixes).toContain("docs/ward-flow/desk-guides/");
    expect(docs.prefixes).not.toContain("docs/ward-flow/");
  });
  it.each([
    "docs/ward-flow/decisions.md",
    "docs/ward-flow/desk-guides/why-cant-i.md",
    "docs/ward-flow/desk-guides/ward.md",
  ])("runs unit tests without the build or browser for %s", (file) => {
    expect(scope(file)).toMatchObject({
      full: true,
      unit: true,
      browser: false,
      backend: false,
      build: false,
      frontend_static: false,
    });
  });
  it("keeps a document no test reads documentation only", () => {
    const file = unreadDoc;
    expect(docs.exact.has(file)).toBe(false);
    expect(scope(file)).toMatchObject({ full: false, unit: false, browser: false, build: false });
  });
  it("adds unit tests to a policy-only change that also edits a test-read document", () => {
    expect(scope("AGENTS.md", "docs/ward-flow/decisions.md")).toMatchObject({
      full: true,
      policy: true,
      unit: true,
      browser: false,
      build: false,
    });
    expect(scope("AGENTS.md", unreadDoc)).toMatchObject({ policy: true, unit: false });
  });
});
