import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

// Use the same installed CSS Modules passes as Next's webpack css-loader.
async function compile(file: string) {
  return postcss([
    require("next/dist/compiled/postcss-modules-values"),
    require("next/dist/compiled/postcss-modules-local-by-default")({ mode: "pure" }),
    require("next/dist/compiled/postcss-modules-extract-imports")(),
    require("next/dist/compiled/postcss-modules-scope")(),
  ]).process(readFileSync(file, "utf8"), { from: file });
}

describe("Ward browser-build CSS", () => {
  it("compiles Community with locally scoped figure typography", async () => {
    const result = await compile("src/components/ward-management/community/community.module.css");
    const figureSelectors: string[] = [];
    result.root.walkRules((rule) => {
      if (rule.selector.includes('[data-ward-primitive="figure"]')) figureSelectors.push(rule.selector);
    });
    expect(figureSelectors.length).toBeGreaterThan(0);
    expect(figureSelectors.every((selector) => selector.includes('__screen [data-ward-primitive="figure"]'))).toBe(
      true,
    );
  });

  it("compiles Settings in pure mode, and its modals keep the base button class on composed buttons", async () => {
    const screenCss = await compile("src/components/ward-management/settings/settings.module.css");
    expect(screenCss.css.length).toBeGreaterThan(0);

    const result = await compile("src/components/ward-management/settings/settings-modals.module.css");
    const exported: Record<string, string> = {};
    result.root.walkRules(":export", (rule) => {
      rule.walkDecls((decl) => {
        exported[decl.prop] = decl.value;
      });
    });
    expect(exported.btn).toBeTruthy();
    expect(exported.btnSecondary.split(/\s+/)).toContain(exported.btn);
  });

  it("compiles Statistics third edition modules with pure selectors", async () => {
    const r1 = await compile("src/components/ward-management/statistics/statistics-third-edition.module.css");
    expect(r1.css.length).toBeGreaterThan(0);
    const r2 = await compile("src/components/ward-management/statistics/statistics-service-third-edition.module.css");
    expect(r2.css.length).toBeGreaterThan(0);
  });

  it("compiles Governance module with pure selectors", async () => {
    const res = await compile("src/components/ward-management/governance/governance.module.css");
    expect(res.css.length).toBeGreaterThan(0);
  });
});
