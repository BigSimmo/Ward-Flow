// tests/ward-statistics-demonstration.test.ts
//
// THE SAFEGUARD THAT KEEPS AN INVENTED TREND FROM READING AS A MEASURED ONE.
//
// `statistics-demonstration.ts` generates 30-day trend data the model cannot actually compute —
// `WardFlowState` keeps no history — and the owner approved showing it anyway, clearly labelled.
// This file proves the labelling is structural rather than a convention someone has to remember:
//
//   1. A `DemonstrationSeries` cannot be ACCIDENTALLY forged outside `statistics-demonstration.ts`,
//      and cannot be handed to anything that expects a real, derived figure — both via
//      `@ts-expect-error` fixtures, which are checked by `npm run typecheck` (this project's
//      established pattern for compile-time proofs living in a `.test.ts` file — see
//      `tests/error-state.dom.test.tsx` and `tests/caring-contacts-empty-state.dom.test.tsx` for
//      the same shape). `vitest` itself transpiles this file and discards the comments along with
//      every other type annotation, so these two fixtures are not asserted again at runtime below —
//      there is nothing left to assert once the types are gone. What IS asserted at runtime is the
//      other half of the same protection: no screen actually imports the unwrapped type, or the
//      generator directly, without also importing the wrapper (see part 4 below).
//      ⚠️ SCOPE OF THAT GUARANTEE — a DELIBERATE bypass is not stopped, and this is not a gap to
//      close. `const fake = { ...disclosure, points } as DemonstrationSeries;` compiles cleanly: no
//      TypeScript brand survives a cast someone writes on purpose. What this guard actually buys is
//      narrower than "unforgeable" — an ACCIDENTAL bypass (a hand-built object literal, a plain
//      `number[]` handed to something expecting a real figure) fails to compile with no cast in
//      sight, and a DELIBERATE one is visible in review because the cast has to be written down.
//      Do not attempt to close this with a runtime brand check or an ESLint rule against `as
//      DemonstrationSeries` — that raises the cost of a deliberate bypass without changing what it
//      is: a decision someone made on purpose, which review is the correct place to catch.
//   2. The generator is deterministic — seeded from the scenario and the reducer's `now` — so the
//      same night always renders the same trend, and a control proves a different `now` renders a
//      different one (the check that catches a generator someone quietly froze).
//   3. The three disclosure fields are enforced again at runtime, because an empty string satisfies
//      the type and would otherwise render a blank where the disclosure belongs.
//   4. No `.tsx` file under `ward-management/` imports `DemonstrationSeries`, or imports
//      `generateDemonstrationSeries` directly, without also importing `DemonstrationChart` — two
//      separate routes around the wrapper, because a file can reach the raw points (e.g.
//      `series.points.map(...)`) via the generator alone, naming neither the type nor the wrapper.
//      The population is floored first, so a scan that silently found nothing cannot be mistaken
//      for a scan that found no violations.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  generateDemonstrationSeries,
  type DemonstrationSeries,
  type DemonstrationSeriesDisclosure,
} from "@/components/ward-management/statistics/statistics-demonstration";

const VALID_DISCLOSURE: DemonstrationSeriesDisclosure = {
  label: "Admissions per day (demonstration)",
  whatItWouldMeasure: "The count of patients admitted to this ward on each of the last 30 days.",
  whyItIsNotReal: "WardFlowState holds only the current picture; no admission history is kept.",
};

const VALID_SHAPE = { baseline: 12, volatility: 3, minValue: 0 } as const;

describe("DemonstrationSeries cannot escape statistics-demonstration.ts", () => {
  it("cannot be forged from a plain object literal", () => {
    // @ts-expect-error a DemonstrationSeries cannot be hand-built from its public shape — only
    // statistics-demonstration.ts holds the brand symbol that makes this type real, so a screen
    // cannot forge a lookalike and skip DemonstrationChart. If the brand is ever removed from the
    // type, this object literal legitimately satisfies DemonstrationSeries and TypeScript reports
    // "Unused '@ts-expect-error' directive" here — which is exactly the signal that the safeguard
    // has been removed. `npm run typecheck` is what reads this line; vitest transpiles it away.
    const forged: DemonstrationSeries = {
      label: "Forged",
      whatItWouldMeasure: "Admissions per day",
      whyItIsNotReal: "No history exists to derive this from.",
      points: [],
    };
    expect(forged).toBeTruthy();
  });

  it("cannot be handed to a renderer that expects a real, derived figure", () => {
    // Stands in for "any renderer that is not DemonstrationChart" — a real chart in this app takes
    // plain measured numbers, never a branded series, and this only needs to have that shape. It
    // does nothing with its argument: the proof is the compile-time rejection below, not a runtime
    // behaviour, so the body must not depend on `values` actually being an array.
    function rendersARealTrend(values: number[]): void {
      void values;
    }
    const series = generateDemonstrationSeries("standard", 1000, VALID_DISCLOSURE, VALID_SHAPE);
    // @ts-expect-error DemonstrationSeries is not a number[] — the brand is what stops a
    // fabricated trend from reaching a place that expects a figure the model actually measured.
    // Same failure mode as above if the brand is removed: the call becomes legitimate and this
    // directive goes unused, which `npm run typecheck` reports as an error.
    rendersARealTrend(series);
    expect(series.label).toBe(VALID_DISCLOSURE.label); // proves the call above ran without throwing
  });
});

describe("generateDemonstrationSeries is deterministic, not random", () => {
  it("the same scenario and the same clock produce an identical series", () => {
    const a = generateDemonstrationSeries("standard", 5000, VALID_DISCLOSURE, VALID_SHAPE);
    const b = generateDemonstrationSeries("standard", 5000, VALID_DISCLOSURE, VALID_SHAPE);
    expect(a.points).toEqual(b.points);
  });

  // The control. A generator that ignores its clock argument entirely (returns a frozen constant)
  // would still pass the identical-series check above, because two calls with the same frozen
  // output are trivially equal. Only a check that varies ONE input and requires the output to
  // differ can catch that — this is it.
  it("🔴 THE CLOCK MOVING ON ITS OWN DOES NOT REDRAW THE INVENTED HISTORY", () => {
    /*
     * Until 2026-09-07 this was false and nothing could see it. `WardFlowProvider` runs
     * `setInterval(…, 30_000)` and computes `now` from the wall clock, so `now` advances while
     * somebody is looking at the page. The screens call the generator in their render body, so
     * every minute boundary reseeded it and **all thirty points were redrawn as a different random
     * walk** — not shifted, not extended: different.
     *
     * ⚠️ **A chart that visibly changes every minute reads as live telemetry**, which is the one
     * impression these pages exist to refuse. The module header had named that exact failure and
     * believed it prevented it — it reasoned about RE-RENDER stability, which it had right, and not
     * about the clock moving by itself.
     *
     * ⚠️ **NO DOM TEST COULD HAVE CAUGHT THIS.** The provider short-circuits the wall clock
     * whenever `initialNow` is given — "pinned: never touch the wall clock" — and every DOM suite
     * pins it. The behaviour was unreachable from the suite by construction, so this case asserts
     * on the generator directly rather than through a screen.
     */
    const base = 5000;
    for (const advance of [1, 5, 29, 60, 400]) {
      expect(
        generateDemonstrationSeries("standard", base + advance, VALID_DISCLOSURE, VALID_SHAPE).points,
        `the invented history was redrawn after ${advance} minute(s) of real time — a demonstration ` +
          "chart that reshuffles while somebody watches it reads as live measurement",
      ).toEqual(generateDemonstrationSeries("standard", base, VALID_DISCLOSURE, VALID_SHAPE).points);
    }
  });

  it("a different clock produces a different series", () => {
    // 5000 and 6000 minutes are on different DAYS (day 3 and day 4), which is the granularity the
    // seed now uses — see the case above. A control separated by minutes would assert the opposite
    // of the property that case pins, so the two must not be brought closer together.
    const a = generateDemonstrationSeries("standard", 5000, VALID_DISCLOSURE, VALID_SHAPE);
    const b = generateDemonstrationSeries("standard", 6000, VALID_DISCLOSURE, VALID_SHAPE);
    expect(a.points).not.toEqual(b.points);
  });

  it("a different scenario produces a different series", () => {
    const a = generateDemonstrationSeries("standard", 5000, VALID_DISCLOSURE, VALID_SHAPE);
    const b = generateDemonstrationSeries("scarce", 5000, VALID_DISCLOSURE, VALID_SHAPE);
    expect(a.points).not.toEqual(b.points);
  });

  it("a different label produces a different series, so two charts on the same screen do not draw the same wobble", () => {
    const a = generateDemonstrationSeries("standard", 5000, VALID_DISCLOSURE, VALID_SHAPE);
    const b = generateDemonstrationSeries(
      "standard",
      5000,
      { ...VALID_DISCLOSURE, label: "Average wait, hours (demonstration)" },
      VALID_SHAPE,
    );
    expect(a.points).not.toEqual(b.points);
  });
});

describe("no Math.random anywhere in this module", () => {
  it("the generator and the wrapper never call Math.random", () => {
    // ⚠️ Stripped of comments before the check. Both files' own header prose explains, in words,
    // why Math.random() is refused here — which means the literal substring "Math.random" already
    // appears in this module several times over, all of it inside comments. A bare substring check
    // against the raw file would therefore always fail, on the very file written to avoid it,
    // exactly the "a grep for a filename finds its prose" trap: this checks for a CALL in the code
    // that survives comment-stripping, not for the words describing the rule.
    const tsSource = stripComments(
      readFileSync(
        join(process.cwd(), "src/components/ward-management/statistics/statistics-demonstration.ts"),
        "utf8",
      ),
    );
    const tsxSource = stripComments(
      readFileSync(
        join(process.cwd(), "src/components/ward-management/statistics/statistics-demonstration-chart.tsx"),
        "utf8",
      ),
    );
    expect(tsSource).not.toContain("Math.random(");
    expect(tsxSource).not.toContain("Math.random(");
  });
});

describe("the three disclosure fields are enforced at runtime, not only typed", () => {
  // An empty string satisfies `string`, so the type alone cannot stop a screen from constructing a
  // series with a blank disclosure — this is the runtime half of that protection.
  it.each([
    ["label", { ...VALID_DISCLOSURE, label: "" }],
    ["whatItWouldMeasure", { ...VALID_DISCLOSURE, whatItWouldMeasure: "" }],
    ["whyItIsNotReal", { ...VALID_DISCLOSURE, whyItIsNotReal: "" }],
  ] as const)("throws when %s is empty", (field, disclosure) => {
    expect(() => generateDemonstrationSeries("standard", 1000, disclosure, VALID_SHAPE)).toThrow(field);
  });

  it("throws when a field is whitespace-only, not just when it is the empty string", () => {
    expect(() =>
      generateDemonstrationSeries("standard", 1000, { ...VALID_DISCLOSURE, label: "   " }, VALID_SHAPE),
    ).toThrow("label");
  });
});

// ─── The scan: no screen imports the unwrapped type ──────────────────────────────────────────
const WARD_DIR = join(process.cwd(), "src/components/ward-management");

/** Recursively lists every file under `dir`. Derived from disk, never a hand-written list — see
 *  `tests/ward-table-single-source.test.ts` for why a hand-picked file set is the wrong shape for
 *  a guard like this one: it silently stops covering whatever file somebody adds tomorrow. */
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

/** Strips block and line comments before scanning for imports, so a comment that merely MENTIONS
 *  `DemonstrationSeries` in prose (explaining this very guard, for instance) cannot be mistaken for
 *  an actual import statement. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/\/\/.*$/gmu, "");
}

type NamedImport = { readonly names: readonly string[]; readonly source: string };

/** A deliberately narrow parser: it only has to recognise `import { A, type B, C as D } from
 *  "…"` well enough to answer "which names were imported, from which specifier" — not to parse
 *  arbitrary TypeScript. */
function parseNamedImports(code: string): NamedImport[] {
  const imports: NamedImport[] = [];
  const pattern = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']([^"']+)["']/gu;
  for (const match of code.matchAll(pattern)) {
    const names = match[1]
      .split(",")
      .map((raw) => raw.trim())
      .filter((raw) => raw.length > 0)
      .map((raw) => raw.replace(/^type\s+/u, ""))
      .map((raw) => raw.split(/\s+as\s+/u)[0]!.trim());
    imports.push({ names, source: match[2]! });
  }
  return imports;
}

/** Listed, never discovered by pattern — the five files `git log` shows as "the five statistics
 *  screens" as of this task. The population floor below proves the WALK finds all five; this list
 *  is only used to state that expectation, not to define what gets scanned. */
const STATISTICS_SCREEN_FILES = [
  "statistics-compare-screen.tsx",
  "statistics-ed-screen.tsx",
  "statistics-overview-screen.tsx",
  "statistics-screen.tsx",
  "statistics-ward-screen.tsx",
] as const;

describe("no .tsx file under ward-management imports DemonstrationSeries or generateDemonstrationSeries without DemonstrationChart", () => {
  it("the scan actually walked the tree and found every listed statistics screen", () => {
    const tsxFiles = walk(WARD_DIR).filter((file) => file.endsWith(".tsx"));
    // Floor the POPULATION, never the finding: a broken walk (wrong directory, wrong extension)
    // would report zero violations having examined nothing, which looks identical to a clean scan.
    expect(
      tsxFiles.length,
      "the walk over ward-management found suspiciously few .tsx files — WARD_DIR or the walk itself is broken",
    ).toBeGreaterThan(50);

    const basenames = new Set(tsxFiles.map((file) => file.split(/[\\/]/u).pop()));
    for (const expected of STATISTICS_SCREEN_FILES) {
      expect(basenames.has(expected), `${expected} was not found by the walk — the scan below never examined it`).toBe(
        true,
      );
    }
  });

  // Two independent routes around the wrapper, both closed here:
  //   (a) import the branded TYPE and hand-build a lookalike — the type-name rule, present since
  //       this test file was first written.
  //   (b) import the GENERATOR directly and read `.points` off the real series it returns, never
  //       naming `DemonstrationSeries` or `DemonstrationChart` anywhere in the file — a plain public
  //       field access (`trend.points.map(p => p.value)`) that compiles clean and would have made
  //       the rule above report zero violations while the disclosure badge and caption silently
  //       never rendered. Both checks run over the same file list so neither route can be widened
  //       away by narrowing the other.
  it("no screen imports the series type, or the generator directly, without the wrapper", () => {
    const tsxFiles = walk(WARD_DIR).filter(
      (file) => file.endsWith(".tsx") && !file.split(/[\\/]/u).pop()!.includes("statistics-demonstration"),
    );
    expect(tsxFiles.length).toBeGreaterThan(0); // re-floored: the exclusion above must not eat the whole population

    const offenders: string[] = [];
    for (const file of tsxFiles) {
      const code = stripComments(readFileSync(file, "utf8"));
      const imports = parseNamedImports(code);
      const importsFromDemonstrationModule = imports.filter(
        (imp) =>
          imp.source.includes("statistics-demonstration") && !imp.source.includes("statistics-demonstration-chart"),
      );
      const importsSeriesType = importsFromDemonstrationModule.some((imp) => imp.names.includes("DemonstrationSeries"));
      const importsGenerator = importsFromDemonstrationModule.some((imp) =>
        imp.names.includes("generateDemonstrationSeries"),
      );
      const importsWrapper = imports.some((imp) => imp.names.includes("DemonstrationChart"));
      const relativePath = file.slice(join(process.cwd()).length + 1);
      if (importsSeriesType && !importsWrapper) {
        offenders.push(`${relativePath} (imports DemonstrationSeries without DemonstrationChart)`);
      }
      if (importsGenerator && !importsWrapper) {
        offenders.push(`${relativePath} (imports generateDemonstrationSeries without DemonstrationChart)`);
      }
    }
    expect(offenders, `these files bypass the disclosure wrapper: ${offenders.join(", ")}`).toEqual([]);
  });
});
