import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import ts from "typescript";
import { NODE_UNIT_TEST_GLOBS, DOM_UNIT_TEST_GLOBS, LIVE_UNIT_TEST_GLOBS } from "../scripts/unit-test-population.mjs";

/**
 * A file under `tests/` is only actually tested if SOME runner's include/testMatch pattern
 * collects it. `vitest.config.mts` runs two projects on disjoint globs (`tests/**\/*.test.ts` for
 * node, `tests/**\/*.dom.test.tsx` for jsdom); `playwright.config.ts` supplies each browser project's matcher. A file whose name satisfies none of them runs
 * nothing, reports nothing, and — because `vitest run` walks its include globs rather than
 * enumerating `tests/` and complaining about leftovers — a whole-suite run is simply silent about
 * it. `tests/foo.test.tsx` (missing the `.dom.` infix the jsdom project requires) is the shape
 * that keeps recurring, because it is the most natural name to give a React component test.
 *
 * This file computes the real pattern set from the configs themselves (not from a copy of the
 * two globs someone remembers), and checks every file on disk against it — both files named like
 * a test that no pattern admits, and files that read like a test (a top-level `describe`/`it`/
 * `test` call) despite carrying no test-shaped extension at all.
 *
 * What this cannot see: an environment-variable branch changes which project a file belongs to
 * (`ALLOW_PROVIDER_TESTS=true` swaps the node project onto `*.live.test.ts`) rather than which
 * files exist at all, so both branches are unioned in below as "visible" — a file reachable by
 * either is not orphaned, even though a bare `npm run test` does not collect the live files. A
 * CI matrix step that filters the file list after config resolution, or a config this repo does
 * not have yet, would also be outside what a static read of these configs can prove.
 */

function readConfigSource(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8");
}

/**
 * Minimal glob-to-regex conversion for the exact vocabulary vitest.config.mts uses:
 * a literal prefix, `**\/` (zero or more path segments), and `*` (zero or more non-slash
 * characters). Neither `?`, `[...]`, nor `{...}` appears anywhere in that file's include globs,
 * so a full glob engine would only add surface area this file cannot itself verify is correct.
 */
function globToRegExp(glob: string): RegExp {
  let pattern = "^";
  let i = 0;
  while (i < glob.length) {
    if (glob.startsWith("**/", i)) {
      pattern += "(?:.*/)?";
      i += 3;
    } else if (glob[i] === "*") {
      pattern += "[^/]*";
      i += 1;
    } else {
      pattern += glob[i]!.replace(/[.+^${}()|[\]\\]/g, "\\$&");
      i += 1;
    }
  }
  pattern += "$";
  return new RegExp(pattern);
}

/** Read project objects and their explicit named matchers from the config AST.
 * Importing the config would require a runner-owned server. Counting unrelated name/testMatch
 * strings cannot prove that each project's own matcher was read, and comments are not config.
 * Conditional project arrays are traversed too; unsupported matcher shapes fail closed.
 */
function configuredBrowserMatchers(source: string) {
  const parsed = ts.createSourceFile("playwright.config.ts", source, ts.ScriptTarget.Latest, true);
  const namedPatterns = new Map<string, RegExp>();
  let projects: ts.ArrayLiteralExpression | undefined;
  function read(node: ts.Node): void {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isRegularExpressionLiteral(node.initializer)
    ) {
      const literal = node.initializer.text;
      const lastSlash = literal.lastIndexOf("/");
      namedPatterns.set(node.name.text, new RegExp(literal.slice(1, lastSlash), literal.slice(lastSlash + 1)));
    }
    if (ts.isPropertyAssignment(node) && node.name.getText(parsed) === "projects") {
      if (!ts.isArrayLiteralExpression(node.initializer) || projects) {
        throw new Error("playwright.config.ts: expected one explicit projects array — update extraction.");
      }
      projects = node.initializer;
    }
    ts.forEachChild(node, read);
  }
  read(parsed);
  if (!projects) throw new Error("playwright.config.ts: projects array missing.");
  const bindings: { name: string; patternName: string; pattern: RegExp }[] = [];
  function project(node: ts.Node): void {
    if (ts.isObjectLiteralExpression(node)) {
      const properties = node.properties.filter(ts.isPropertyAssignment);
      const name = properties.find((property) => property.name.getText(parsed) === "name");
      if (name) {
        const testMatch = properties.find((property) => property.name.getText(parsed) === "testMatch");
        if (!ts.isStringLiteral(name.initializer) || !testMatch || !ts.isIdentifier(testMatch.initializer)) {
          throw new Error("playwright.config.ts: project needs a literal name and explicit named testMatch.");
        }
        const patternName = testMatch.initializer.text;
        const pattern = namedPatterns.get(patternName);
        if (!pattern) throw new Error(`playwright.config.ts: matcher ${patternName} is not a parsed regex literal.`);
        bindings.push({ name: name.initializer.text, patternName, pattern });
        return;
      }
    }
    ts.forEachChild(node, project);
  }
  project(projects);
  if (!bindings.length || new Set(bindings.map((binding) => binding.name)).size !== bindings.length) {
    throw new Error("playwright.config.ts: project list empty or names duplicated.");
  }
  return bindings;
}

function walk(dir: string, root: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, root, out);
    } else {
      out.push(`tests/${full.slice(root.length + 1).replace(/\\/g, "/")}`);
    }
  }
}

describe("no file under tests/ is invisible to every runner", () => {
  // ---- 1. Vitest: read the node/jsdom/caring-contacts-db shapes from vitest.config.mts itself ----

  const vitestSource = readConfigSource("vitest.config.mts");

  const populationImport = vitestSource.match(
    /import\s*\{([^}]+)\}\s*from\s+["']\.\/scripts\/unit-test-population\.mjs["']/,
  );
  const populationNames = populationImport?.[1]?.split(",").map((name) => name.trim()) ?? [];
  if (
    ["NODE_UNIT_TEST_GLOBS", "DOM_UNIT_TEST_GLOBS", "LIVE_UNIT_TEST_GLOBS"].some(
      (name) => !populationNames.includes(name),
    )
  ) {
    throw new Error("vitest.config.mts: shared population import changed — update this extraction.");
  }
  if (!/include:\s*liveProviderTests\s*\?\s*LIVE_UNIT_TEST_GLOBS\s*:\s*NODE_UNIT_TEST_GLOBS/.test(vitestSource)) {
    throw new Error("vitest.config.mts: node/live collection binding changed — update this extraction.");
  }
  if (!/name:\s*"jsdom",[\s\S]*?include:\s*DOM_UNIT_TEST_GLOBS/.test(vitestSource)) {
    throw new Error("vitest.config.mts: jsdom collection binding changed — update this extraction.");
  }
  const NODE_DEFAULT_INCLUDE_GLOBS = NODE_UNIT_TEST_GLOBS;
  const NODE_LIVE_INCLUDE_GLOBS = LIVE_UNIT_TEST_GLOBS;
  const JSDOM_INCLUDE_GLOBS = DOM_UNIT_TEST_GLOBS;
  if ([NODE_DEFAULT_INCLUDE_GLOBS, NODE_LIVE_INCLUDE_GLOBS, JSDOM_INCLUDE_GLOBS].some((globs) => globs.length === 0)) {
    throw new Error("shared collection patterns parsed as empty");
  }

  // The caring-contacts-db project left with PsychSift (26 September 2026). If a conditional
  // project comes back, extract its files here and union them into isVisible below.
  if (/caringContactsDbTestFiles/.test(vitestSource)) {
    throw new Error("vitest.config.mts: a caring-contacts-db file list is back — extract it here again.");
  }

  const nodeDefaultIncludeRes = NODE_DEFAULT_INCLUDE_GLOBS.map(globToRegExp);
  const nodeLiveIncludeRes = NODE_LIVE_INCLUDE_GLOBS.map(globToRegExp);
  const jsdomIncludeRes = JSDOM_INCLUDE_GLOBS.map(globToRegExp);

  // ---- 2. Playwright: discover which projects exist and which named pattern each one uses ----
  //
  // Playwright resolves a project's testMatch via `takeFirst(projectConfig.testMatch,
  // config.testMatch, ...)` (node_modules/playwright/lib/common/index.js:639) — the project's OWN
  // pattern wins outright, and the top-level one is consulted only when a project sets none.
  // Every current project sets an explicit named regex. Parse each actual project binding rather
  // than assuming all projects share a matcher. An unsupported shape fails closed, so future
  // config changes require updating this guard instead of quietly leaving specs uncovered.

  const playwrightSource = readConfigSource("playwright.config.ts");
  const mainProjects = configuredBrowserMatchers(playwrightSource);
  const playwrightMainPatterns = mainProjects.map((project) => project.pattern);

  // playwright.visual.config.ts left with PsychSift (26 September 2026); if it comes back, read its
  // pattern here again.
  if (existsSync(resolve(process.cwd(), "playwright.visual.config.ts"))) {
    throw new Error("playwright.visual.config.ts is back — read its testMatch here again.");
  }

  function isVisible(relPath: string): boolean {
    const nodeDefaultVisible =
      nodeDefaultIncludeRes.some((pattern) => pattern.test(relPath)) &&
      !nodeLiveIncludeRes.some((pattern) => pattern.test(relPath));
    return (
      nodeDefaultVisible ||
      jsdomIncludeRes.some((pattern) => pattern.test(relPath)) ||
      nodeLiveIncludeRes.some((pattern) => pattern.test(relPath)) || // visible under ALLOW_PROVIDER_TESTS=true
      playwrightMainPatterns.some((re) => re.test(relPath))
    );
  }

  it("reads the real patterns from every runner's config, not a remembered copy of two globs", () => {
    expect(NODE_DEFAULT_INCLUDE_GLOBS).toEqual(["tests/**/*.test.ts"]);
    expect(NODE_LIVE_INCLUDE_GLOBS).toEqual(["tests/**/*.live.test.ts"]);
    expect(JSDOM_INCLUDE_GLOBS).toEqual(["tests/**/*.dom.test.tsx", "tests/**/*.contract.test.tsx"]);
    // Check the actual project→matcher bindings, not the number of distinct patterns.
    // A wrongly reused mockup matcher could collect unrelated journeys into the narrow projects.
    const responsiveSpec = "tests/ui-ward-responsive-audit.spec.ts";
    const otherWardSpec = "tests/ui-ward-management.spec.ts";
    for (const project of mainProjects) {
      if (["firefox-ward-responsive", "webkit-ward-responsive"].includes(project.name)) {
        expect(project.pattern.test(responsiveSpec), project.name).toBe(true);
        expect(project.pattern.test(otherWardSpec), project.name).toBe(false);
        expect(project.pattern.test("tests/ui-smoke.spec.ts"), project.name).toBe(false);
      } else if (["chromium-mockups", "chromium-mockups-known"].includes(project.name)) {
        expect(project.pattern.test(responsiveSpec), project.name).toBe(true);
        expect(project.pattern.test(otherWardSpec), project.name).toBe(true);
      } else {
        expect(project.patternName, project.name).toBe("productionSpecPattern");
        expect(project.pattern.test("tests/ui-smoke.spec.ts"), project.name).toBe(true);
        expect(project.pattern.test(responsiveSpec), project.name).toBe(false);
        expect(project.pattern.test(otherWardSpec), project.name).toBe(false);
      }
    }
    expect(mainProjects.map((project) => project.name)).toEqual(
      expect.arrayContaining(["chromium", "chromium-mockups", "firefox-ward-responsive", "webkit-ward-responsive"]),
    );
  });

  it("rejects an unparsed or missing matcher instead of treating a project name as coverage", () => {
    expect(() =>
      configuredBrowserMatchers(
        'const pattern = /ward/; defineConfig({ projects: [{ name: "ward", testMatch: missing }] });',
      ),
    ).toThrow(/not a parsed regex literal/);
    expect(() => configuredBrowserMatchers('defineConfig({ projects: [{ name: "ward" }] });')).toThrow(
      /explicit named testMatch/,
    );
  });

  it("reads conditional projects and ignores misleading config-shaped comments", () => {
    const projects = configuredBrowserMatchers(
      'const pattern = /ward/; /* name: "fake", testMatch: absent, */ defineConfig({ projects: [...(enabled ? [{ name: "ward", testMatch: pattern }] : [])] });',
    );
    expect(projects.map((project) => project.name)).toEqual(["ward"]);
    expect(projects[0]!.pattern.test("ward")).toBe(true);
  });

  describe("the visibility matcher itself, pinned against literal example paths", () => {
    it("classifies the reported defect shape as invisible: *.test.tsx without *.dom.", () => {
      // The exact shape reported: a React component test named *.test.tsx. Wrong extension for
      // the node project (.ts, not .tsx) and missing the jsdom project's required .dom. infix, so
      // neither vitest project collects it — and every Playwright pattern requires .spec.ts, so
      // no browser project rescues it either.
      expect(isVisible("tests/zz-example-widget.test.tsx")).toBe(false);
    });

    it("classifies the corresponding good names as visible", () => {
      expect(isVisible("tests/zz-example-widget.dom.test.tsx")).toBe(true);
      expect(isVisible("tests/zz-example-widget.contract.test.tsx")).toBe(true);
      expect(isVisible("tests/zz-example.test.ts")).toBe(true);
    });

    it("classifies the neighbouring holes named in the brief as invisible too", () => {
      expect(isVisible("tests/zz-example.spec.tsx")).toBe(false); // Playwright requires .spec.ts, not .tsx
      expect(isVisible("tests/zz-example.test.mts")).toBe(false);
      expect(isVisible("tests/zz-example.test.cts")).toBe(false);
      expect(isVisible("tests/zz-example.test.jsx")).toBe(false);
    });

    it("classifies a real, currently-collected file of each visible kind as visible", () => {
      // Not vacuous: the matcher must actually say yes to something, on all five paths.
      expect(isVisible("tests/ward-model.test.ts")).toBe(true); // node project
      expect(isVisible("tests/ward-model.dom.test.tsx")).toBe(true); // jsdom project (hypothetical name; glob-only check)
      expect(isVisible("tests/ui-smoke.spec.ts")).toBe(true); // Playwright production project
      expect(isVisible("tests/ui-ward-management.spec.ts")).toBe(true); // Playwright mockup project
      expect(isVisible("tests/universal-search-owner.live.test.ts")).toBe(true); // live project gate
    });
  });

  // ---- 3. Walk every file under tests/ and check it against the computed pattern set ----

  const testsRoot = resolve(process.cwd(), "tests");
  const allFiles: string[] = [];
  walk(testsRoot, testsRoot, allFiles);

  it("walked a meaningful population of files under tests/, so the checks below are not vacuous", () => {
    // Floors the DENOMINATOR (files scanned), never the violation count: the violation count is
    // supposed to be zero, and a floor on it would fail exactly when this guard is doing its job.
    expect(allFiles.length).toBeGreaterThan(500);
  });

  const TEST_NAMED = /\.(test|spec)\.[A-Za-z0-9]+$/;
  const TEXTUAL_EXTENSION = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
  const TOP_LEVEL_TEST_CALL = /^(describe|it|test)\(/m;

  const testNamedFiles = allFiles.filter((f) => TEST_NAMED.test(f));

  it("found a meaningful population of test/spec-named files, so the naming check is not vacuous", () => {
    expect(testNamedFiles.length).toBeGreaterThan(500);
  });

  const invisibleByName = testNamedFiles.filter((f) => !isVisible(f));

  // Files with no test/spec-shaped name at all cannot be matched by any include glob regardless
  // of content — every glob above requires literal ".test." or ".spec." before the extension. A
  // file that nonetheless registers a suite at module load (a top-level describe/it/test call, at
  // column 0 so a shared-contract helper's exported function — which nests its calls inside a
  // function body and is invoked from a real, correctly-named test file — is not mistaken for one)
  // is a test someone forgot to name as one.
  const unnamedButLooksLikeATest = allFiles.filter((f) => {
    if (TEST_NAMED.test(f) || !TEXTUAL_EXTENSION.test(f)) return false;
    return TOP_LEVEL_TEST_CALL.test(readFileSync(resolve(process.cwd(), f), "utf8"));
  });
  const invisibleUnnamed = unnamedButLooksLikeATest.filter((f) => !isVisible(f));

  it("names every file under tests/ that no runner would collect", () => {
    const violations = [...invisibleByName, ...invisibleUnnamed].sort();
    expect(
      violations,
      "These files under tests/ match no include/testMatch pattern in any runner (vitest node, " +
        "vitest jsdom, the live-provider gate, or Playwright's production/mockup/seeded " +
        "projects) — or, for a file with no test-shaped extension " +
        "at all, register a suite at module load anyway. Each one runs nothing and reports nothing: " +
        "a whole-suite run is simply silent about it. Rename it to match a collected pattern (most " +
        "often *.dom.test.tsx for a React component test) or add it to a runner's include.",
    ).toEqual([]);
  });
});
