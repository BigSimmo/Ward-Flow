// M90: what the tests fake. docs/ward-flow/test-fakes.md lists every faked part that could hide a
// real failure, and each high-risk row names the real-database or shared-mode test that covers the
// real thing, or says it is open. This test keeps that list honest: a newly mocked module fails
// until it is added, and every test file a row names must exist.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DOC = readFileSync(join(ROOT, "docs/ward-flow/test-fakes.md"), "utf8");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name === "visual-baselines") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(?:test|spec)\.(?:[cm]?[jt]sx?)$/u.test(name)) out.push(path);
  }
  return out;
}

/** Module specifiers passed to vi.mock / vi.doMock, normalised to the `@/` alias. */
function mockedModules(source: string): string[] {
  return [...source.matchAll(/vi\.(?:mock|doMock)\(\s*["']([^"']+)["']/gu)].map((m) =>
    m[1].replace(/^(?:\.\.\/)+src\//u, "@/"),
  );
}

const listed = new Set(
  (/## Every mocked module[\s\S]*?```text\n([\s\S]*?)```/u.exec(DOC)?.[1] ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean),
);

describe("M90 the test-fakes register", () => {
  const files = [...walk(join(ROOT, "tests")), ...walk(join(ROOT, "backend/ward-flow"))];
  const mocked = new Map<string, string>();
  for (const file of files) {
    if (file.endsWith("ward-audit-m90-test-fakes.test.ts")) continue; // its own fixture strings
    for (const target of mockedModules(readFileSync(file, "utf8"))) {
      if (!mocked.has(target)) mocked.set(target, file.slice(ROOT.length));
    }
  }

  it("scans real mocks", () => {
    expect(mocked.size).toBeGreaterThan(40);
    expect(listed.size).toBeGreaterThan(40);
  });

  it("every mocked module is in the register", () => {
    const missing = [...mocked].filter(([target]) => !listed.has(target)).map(([t, f]) => `${t} (first in ${f})`);
    expect(missing, "add each to docs/ward-flow/test-fakes.md").toEqual([]);
  });

  it("each high-risk row names real coverage that exists, or says it is open", () => {
    const table = DOC.slice(DOC.indexOf("## High-risk fakes"), DOC.indexOf("## Low-risk fakes"));
    const rows = table
      .split("\n")
      .filter((line) => line.startsWith("|"))
      .map((line) =>
        line
          .slice(1, -1)
          .split("|")
          .map((cell) => cell.trim()),
      )
      .filter((cells) => cells[0] !== "Fake" && !/^-+$/u.test(cells[0]));
    expect(rows.length).toBeGreaterThanOrEqual(5);
    for (const fake of [
      "Postgres store",
      "Shared backend over HTTP",
      "Supabase Auth",
      "Phone push delivery",
      "Clock",
      "Browser storage",
    ]) {
      expect(
        rows.some((cells) => cells[0] === fake),
        fake,
      ).toBe(true);
    }
    for (const cells of rows) {
      const coverage = cells.at(-1) ?? "";
      const named = [...coverage.matchAll(/`((?:tests|backend)\/[^`]+)`/gu)].map((m) => m[1]);
      if (/^high\b/u.test(cells[2] ?? "")) {
        expect(named.length > 0 || /\bOpen\b/u.test(coverage), `${cells[0]} names coverage or says Open`).toBe(true);
      }
      for (const path of named) expect(existsSync(join(ROOT, path)), `${cells[0]}: ${path}`).toBe(true);
    }
  });

  it("reads a mock and normalises a relative path", () => {
    expect(mockedModules('vi.mock("../src/components/x", () => ({}));\nvi.doMock("next/link");')).toEqual([
      "@/components/x",
      "next/link",
    ]);
  });
});
