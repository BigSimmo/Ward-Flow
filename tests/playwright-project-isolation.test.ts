import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Pull a named regex literal out of playwright.config.ts and rebuild it.
 *
 * The config cannot be imported here: it calls getPlaywrightBaseUrl at module
 * scope, which refuses to resolve without a runner-owned local server. Reading
 * the source is the only way a unit test can see these patterns, so the
 * extraction fails CLOSED — a renamed or restructured constant is reported
 * rather than quietly turning the assertions below into no-ops.
 */
function configPattern(source: string, name: string): RegExp {
  const match = source.match(new RegExp(`const ${name} =\\s*(/.*/);`));
  if (!match) {
    throw new Error(
      `playwright.config.ts: could not read the \`${name}\` regex literal. If it moved or changed shape, ` +
        "update this helper — do not delete the assertions that depend on it.",
    );
  }
  return new RegExp(match[1].slice(1, -1));
}

describe("Playwright production-project isolation", () => {
  it("configures the required chromium browser project without mockup tag exclusion", () => {
    const source = readFileSync(resolve(process.cwd(), "playwright.config.ts"), "utf8");

    expect(source).toMatch(
      /name: ["']chromium["'],\s+testMatch: productionSpecPattern,/m,
    );
    expect(source).not.toMatch(
      /name: ["']chromium["'],\s+testMatch: productionSpecPattern,\s+grepInvert: mockupTag,/m,
    );
  });

  /**
   * Ward Flow browser journeys are first-class production specs collected by the primary
   * chromium project and top-level testMatch.
   */
  it("collects every ui-ward-*.spec.ts on disk into the required chromium production project", () => {
    const source = readFileSync(resolve(process.cwd(), "playwright.config.ts"), "utf8");
    const productionSpecPattern = configPattern(source, "productionSpecPattern");
    const testMatch = source.match(/testMatch:\s*(\/.*\/),/);
    expect(testMatch, "playwright.config.ts: could not read the top-level testMatch regex").not.toBeNull();
    const testMatchPattern = new RegExp(testMatch![1].slice(1, -1));

    const wardSpecs = readdirSync(resolve(process.cwd(), "tests")).filter(
      (file) => file.startsWith("ui-ward-") && file.endsWith(".spec.ts"),
    );
    expect(wardSpecs.length, "expected Ward Flow to carry browser journeys").toBeGreaterThan(0);

    for (const file of wardSpecs) {
      const spec = `tests/${file}`;
      expect(testMatchPattern.test(spec), `${file} is not collected by testMatch, so it never runs at all`).toBe(true);
      expect(
        productionSpecPattern.test(spec),
        `${file} is not collected by the required production projects`,
      ).toBe(true);
    }
  });

  /**
   * ⚠️ THE UNIVERSAL NET — ADDED 2026-09-02, AND IT IS AN ADDITION, NOT A REPLACEMENT.
   *
   * Every test above answers "is THIS family routed correctly": collected at all, collected by the
   * right project, and NOT leaked into the wrong one. **None of them can answer "is there a spec on
   * disk that no project collects at all", because each one starts from a family it already knows
   * about.** A file nobody thought to write a test for is invisible to all of them.
   *
   * ⚠️ THAT GAP WAS NOT HYPOTHETICAL. `tests/ui-tools-show-all.spec.ts` landed on 2026-08-16 (PR
   * #2008) carrying a launcher regression this repository had just paid for, was never added to any
   * config, and so never ran once — while being edited twice more (2026-08-22, 2026-08-23) by people
   * who reasonably believed it was protecting something. Seventeen days. `git log -S "tools-show-all"
   * -- playwright.config.ts` returns nothing: the token was never there to be removed.
   *
   * ⚠️ THIS MUST NOT BE USED TO DELETE THE PER-FAMILY TESTS ABOVE, and consolidating them into it
   * would LOSE coverage rather than tidy it. This checks only that a spec is collected SOMEWHERE. It
   * cannot see a mockup leaking into a required browser project — which is the property those tests
   * exist for and the only one that can block a release on a red prototype.
   *
   * Measured argument, from a mutation run on 2026-09-02: a cross-check between two DERIVED counts
   * stayed silent under mutation because both sides collapsed together, and only a separate pin
   * against a hand-written literal caught it. **Two guards that fail differently are worth more than
   * one that fails once.**
   */
});

// The route-by-route project checks that followed were about PsychSift's browser projects and
// specs, removed with PsychSift on 25 September 2026. The Ward Flow journey check above stays.
