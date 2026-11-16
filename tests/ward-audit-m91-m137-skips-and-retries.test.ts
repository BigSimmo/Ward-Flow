// M91: no hidden retries or quarantine. M137: skipped tests stay visible.
// Browser and unit tests run with zero retries; a @quarantine tag, or a skip, to-do or fixme with
// no reason, fails here on every PR. The nightly browser workflow prints the full list of skipped
// and conditional tests (scripts/ward-flow/skip-inventory.mjs) to its run summary.
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { collect, quarantineTags, skipSites } from "../scripts/ward-flow/skip-inventory.mjs";

type Site = { file: string; line: number; kind: string; reason: string | null };
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("M91 zero retries", () => {
  it("every retries setting in the Playwright config is 0", () => {
    const config = read("playwright.config.ts");
    const values = [...config.matchAll(/\bretries:\s*([^,\n]+)/gu)].map((m) => m[1].trim());
    expect(values.length).toBeGreaterThan(0);
    expect(
      values.every((v) => v === "0"),
      values.join(", "),
    ).toBe(true);
  });

  it("the unit runner configs set no retry", () => {
    for (const path of ["vitest.config.mts", "backend/ward-flow/package.json", "scripts/run-backend-tests.mjs"]) {
      expect(read(path), path).not.toMatch(/\bretry\s*[:=]\s*[1-9]|--retry(?:=|\s+)[1-9]/u);
    }
  });

  it("no workflow or npm script passes a retry count to a test runner", () => {
    const workflows = readdirSync(new URL("../.github/workflows/", import.meta.url)).map((name) =>
      read(`.github/workflows/${name}`),
    );
    // curl's --retry for downloads is not a test retry; only test-runner lines count.
    const runnerLines = [...workflows, read("package.json")]
      .flatMap((text) => text.split("\n"))
      .filter((line) =>
        /playwright|vitest|test:e2e|run-playwright|run-vitest|node --test|\bnpm (?:run )?test/u.test(line),
      );
    expect(runnerLines.length).toBeGreaterThan(0);
    expect(runnerLines.filter((line) => /--retries(?:=|\s+)[1-9]|--retry(?:=|\s+)[1-9]/u.test(line))).toEqual([]);
  });
});

describe("M91/M137 skip inventory", () => {
  const { sites, quarantine } = collect() as { sites: Site[]; quarantine: unknown[] };

  it("finds the skip sites at all, so the checks below are not over an empty set", () => {
    expect(sites.length).toBeGreaterThan(20);
    expect(sites.some((s) => s.file.startsWith("backend/ward-flow/"))).toBe(true);
    expect(sites.some((s) => s.file.endsWith(".spec.ts"))).toBe(true);
  });

  it("no test carries a quarantine tag", () => {
    expect(quarantine).toEqual([]);
  });

  it("every skip, to-do, fixme and conditional test names its reason", () => {
    const missing = sites.filter((s) => s.reason === null).map((s) => `${s.file}:${s.line} ${s.kind}`);
    expect(missing, "add a reason: a string after the condition, or a comment on or above the line").toEqual([]);
  });

  it("flags a bare skip and accepts each kind of reason", () => {
    const fixture = [
      // Split so the retired-suite guard does not read this fixture string as a real skip.
      "it" + '.skip("bare", () => {});',
      "test" + '.skip(isPhone, "Desktop only");',
      "// Waits for the ward board PR to merge.",
      'it.todo("parked");',
      'it.skipIf(process.platform === "win32")("posix only", () => {});',
      'test("db", { skip: !url }, async () => {});',
      'test.fixme("broken in Safari", async () => {});',
      'const prose = "it' + '.skip( in a string is not a site";',
    ].join("\n");
    const found = skipSites("fixture.test.ts", fixture) as Site[];
    expect(found.map((s) => [s.line, s.kind, s.reason !== null])).toEqual([
      [1, "skip", false],
      [2, "skip", true],
      [4, "todo", true],
      [5, "skipIf", true],
      [6, "skip-option", true],
      [7, "fixme", false],
    ]);
  });

  it("flags a quarantine tag in a title or tag list but not in a grep pattern or comment", () => {
    const fixture = [
      'test("loads the board @quarantine", async () => {});',
      'test("x", { tag: ["@quarantine"] }, async () => {});',
      'const grep = "--grep-invert @quarantine";',
      "// @quarantine was retired on 18 October",
    ].join("\n");
    expect((quarantineTags("fixture.spec.ts", fixture) as { line: number }[]).map((q) => q.line)).toEqual([1, 2]);
  });

  it("the nightly browser workflow prints the inventory", () => {
    expect(read(".github/workflows/ward-flow-nightly-browsers.yml")).toMatch(
      /run: node scripts\/ward-flow\/skip-inventory\.mjs >> "\$GITHUB_STEP_SUMMARY"/u,
    );
  });
});
