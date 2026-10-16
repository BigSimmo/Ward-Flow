import { mkdirSync, mkdtempSync, rmSync, writeFileSync, symlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { failedTestcasesFromJunit } from "../scripts/classify-playwright-failures.mjs";
import { loadFlakeLedger, matchFlake, validateFlakeLedgerEntries } from "../scripts/flake-ledger.mjs";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

function isoDate(offsetDays: number, now = Date.now()) {
  return new Date(now + offsetDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function validEntry(overrides: Record<string, string> = {}) {
  return {
    id: "sample-flake",
    title: "exact flaky journey @quarantine",
    spec: "tests/sample.spec.ts",
    reason: "Reproduced fail/pass variation on the same SHA.",
    owner: "test-infrastructure",
    reproduction: "npm run test:e2e:advisory -- --grep exact --repeat-each=3",
    firstSeen: isoDate(-2),
    lastSeen: isoDate(-1),
    expires: isoDate(20),
    tracking: "docs/process-hardening.md#known-flakes",
    ...overrides,
  };
}

function temporarySpec(source: string) {
  const root = mkdtempSync(path.join(os.tmpdir(), "clinical-kb-flake-ledger-test-"));
  temporaryDirectories.push(root);
  mkdirSync(path.join(root, "tests"));
  mkdirSync(path.join(root, "node_modules"));
  symlinkSync(path.resolve("node_modules/playwright"), path.join(root, "node_modules/playwright"), "junction");
  writeFileSync(path.join(root, "playwright.config.mjs"), 'export default { testDir: "./tests" };');

  writeFileSync(
    path.join(root, "tests", "sample.spec.ts"),
    source.includes("import ") ? source : `import { test } from "playwright/test";\n${source}`,
  );
  return root;
}

describe("flake ledger", () => {
  it("validates the committed ledger, including legitimate nonempty ledgers", () => {
    expect(Array.isArray(loadFlakeLedger())).toBe(true);
  });

  it("matches only the exact case-insensitive spec and title identity", () => {
    const flakes = [validEntry()];
    expect(matchFlake("tests/sample.spec.ts", "EXACT FLAKY JOURNEY @QUARANTINE", flakes)?.id).toBe("sample-flake");
    expect(matchFlake("tests/sample.spec.ts", "prefix exact flaky journey @quarantine", flakes)).toBeNull();
    expect(matchFlake("tests/other.spec.ts", "exact flaky journey @quarantine", flakes)).toBeNull();
    expect(matchFlake("", "")).toBeNull();
  });

  it("requires exact quarantined titles and complete ownership metadata", () => {
    expect(() => validateFlakeLedgerEntries([validEntry({ title: "" })])).toThrow(/missing: title/);
    expect(() => validateFlakeLedgerEntries([validEntry({ title: "not tagged" })])).toThrow(/include @quarantine/);
  });

  it("rejects critical overlap and expiry beyond 30 days", () => {
    const now = Date.now();
    expect(() => validateFlakeLedgerEntries([validEntry({ title: "unsafe @quarantine @critical" })])).toThrow(
      /cannot be both @quarantine and @critical/,
    );
    expect(() => validateFlakeLedgerEntries([validEntry({ expires: isoDate(31, now) })], { now })).toThrow(
      /within 30 days/,
    );
    const root = temporarySpec('test("exact flaky journey @quarantine", () => {});');
    expect(validateFlakeLedgerEntries([validEntry({ expires: isoDate(30, now) })], { root, now })).toHaveLength(1);
  });

  it("rejects calendar-invalid ledger dates", () => {
    expect(() => validateFlakeLedgerEntries([validEntry({ firstSeen: "2026-02-30" })])).toThrow(/not a valid date/);
  });

  it("requires the exact title to exist in the referenced spec", () => {
    const entry = validEntry();
    const root = temporarySpec(`test(${JSON.stringify(entry.title)}, () => {});`);
    expect(validateFlakeLedgerEntries([entry], { root })).toHaveLength(1);
    expect(() => validateFlakeLedgerEntries([validEntry({ title: "missing @quarantine" })], { root })).toThrow(
      /exact title is not present/,
    );
  });

  it("rejects comment, string and unrelated-call title decoys", () => {
    for (const source of [
      '// test("exact flaky journey @quarantine", () => {});',
      'const note = "exact flaky journey @quarantine";',
      'const log = () => {}; log("exact flaky journey @quarantine", () => {});',
      'if (false) { test("exact flaky journey @quarantine", () => {}); }',
      'test("prefix exact flaky journey @quarantine", () => {});',
    ]) {
      const root = temporarySpec(source);
      expect(() => validateFlakeLedgerEntries([validEntry()], { root })).toThrow(
        /exact title is not present|collection failed/,
      );
    }
  });

  it("binds nested suite titles and imported Playwright aliases to a real test", () => {
    const root = temporarySpec(
      'import { test as journey } from "playwright/test"; journey.describe("suite", () => { journey("exact flaky journey @quarantine", () => {}); });',
    );
    expect(
      validateFlakeLedgerEntries([validEntry({ title: "suite exact flaky journey @quarantine" })], { root }),
    ).toHaveLength(1);
    expect(() => validateFlakeLedgerEntries([validEntry()], { root })).toThrow(
      /exact title is not present|collection failed/,
    );
  });

  it("extracts only exact failed testcase identities from JUnit", () => {
    const failures = failedTestcasesFromJunit(`
      <testsuite>
        <testcase name="exact flaky journey @quarantine" classname="sample.spec.ts">
          <failure message="failed" />
        </testcase>
        <testcase name="passing journey" classname="tests/sample.spec.ts"></testcase>
        <testcase name="diagnostic journey" classname="tests/sample.spec.ts">
          <system-out><![CDATA[diagnostic text containing <failure> but no failure element]]></system-out>
          <!-- <error>diagnostic comment</error> -->
        </testcase>
      </testsuite>
    `);
    expect(failures).toEqual([{ spec: "tests/sample.spec.ts", title: "exact flaky journey @quarantine" }]);
    const flakes = [validEntry()];
    expect(matchFlake(failures[0]?.spec, failures[0]?.title, flakes)?.id).toBe("sample-flake");
    expect(matchFlake("tests/other.spec.ts", failures[0]?.title, flakes)).toBeNull();
  });
});
