import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import loadNextConfig from "../next.config";

/**
 * The header (ward-bar.tsx) is on every page's first load, which the phone script budget measures
 * (script-budget.json). On 31 October 2026 one constant imported from the rail's parts pulled the
 * rail's capacity card, its stylesheet map and the bed alert model into every route, about 10 KB.
 * The rail, its parts, the phone Menu sheet, the executive chrome, the Activity panel and the
 * dialogs (styled confirm, step-up sign-in) load only when needed.
 */
function staticImportsOf(file: string) {
  const source = readFileSync(path.join(process.cwd(), file), "utf8");
  return [...source.matchAll(/^import\s[^;]*?from\s+"([^"]+)";/gmsu)]
    .filter((match) => !/^import\s+type\s/u.test(match[0]))
    .map((match) => ({ names: match[0], from: match[1] }));
}
const staticImports = staticImportsOf("src/components/ward-management/shell/ward-bar.tsx").map((entry) => entry.from);

describe("the header's first load", () => {
  it("does not import the rail, its parts, the phone Menu sheet or the executive chrome eagerly", () => {
    for (const heavy of [
      "./ward-rail",
      "./ward-rail-parts",
      "./ward-phone-menu-sheet",
      "./ward-executive-chrome",
      "./ward-bar-activity",
      "@/components/ward-management/coordinator/activity-panel",
    ]) {
      expect(staticImports, heavy).not.toContain(heavy);
    }
  });

  it("loads the one Activity panel (Q99) only when needed, from the bar's lazy panels", () => {
    const lazy = staticImportsOf("src/components/ward-management/shell/ward-bar-lazy-panels.tsx").map(
      (entry) => entry.from,
    );
    expect(lazy).not.toContain("@/components/ward-management/coordinator/activity-panel");
    const source = readFileSync(
      path.join(process.cwd(), "src/components/ward-management/shell/ward-bar-lazy-panels.tsx"),
      "utf8",
    );
    expect(source).toContain('import("@/components/ward-management/coordinator/activity-panel")');
  });

  it("takes the close-menus event from its own small module", () => {
    expect(staticImports).toContain("./ward-menu-events");
  });

  it("loads the styled confirm and the step-up sign-in dialogs only when needed", () => {
    const confirm = staticImportsOf("src/components/wf/confirm-dialog.tsx");
    expect(confirm.map((entry) => entry.from)).not.toContain("./dialog");
    const stepUp = staticImportsOf("src/components/ward-management/shell/ward-step-up.tsx");
    expect(stepUp.map((entry) => entry.from)).not.toContain("./ward-step-up-dialog");
    const kit = stepUp.find((entry) => entry.from === "@/components/wf");
    expect(kit?.names ?? "").not.toMatch(/\bDialog\b/u);
  });

  it("keeps the kit barrel free of side effects, so lazy kit parts stay out of the first load", () => {
    const config = readFileSync(path.join(process.cwd(), "next.config.ts"), "utf8");
    expect(config).toMatch(
      /test: \/\[\\\\\/\]src\[\\\\\/\]components\[\\\\\/\]wf\[\\\\\/\]index\\\.ts\$\/, sideEffects: false \}/u,
    );
    // The barrel must stay pure re-exports for that to be safe.
    const barrel = readFileSync(path.join(process.cwd(), "src/components/wf/index.ts"), "utf8");
    const statements = barrel
      .replace(/\/\*[\s\S]*?\*\//gu, "")
      .replace(/^\s*\/\/.*$/gmu, "")
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);
    for (const statement of statements) expect(statement, statement).toMatch(/^export\s/u);
  });

  it("packs the kit's shared overlay core once, in the browser production build only", async () => {
    const config = await loadNextConfig();
    type Groups = Record<string, { test: RegExp; name: string; enforce: boolean }>;
    const groupsFor = (dev: boolean, isServer: boolean) => {
      const result = config.webpack!({ output: {}, plugins: [], optimization: { splitChunks: { cacheGroups: {} } } }, {
        dev,
        isServer,
        webpack: { NormalModuleReplacementPlugin: class {} },
      } as never) as { optimization: { splitChunks: { cacheGroups: Groups } } };
      return result.optimization.splitChunks.cacheGroups;
    };
    const browser = groupsFor(false, false);
    expect(browser.wfOverlayRoot.name).toBe("wf-overlay-root");
    expect(browser.wfOverlay.name).toBe("wf-overlay");
    expect(browser.wfOverlay.enforce).toBe(true);
    for (const file of ["sheet-focus.ts", "overlay-root.tsx"])
      expect(browser.wfOverlayRoot.test.test(`/app/src/components/wf/${file}`), file).toBe(true);
    for (const file of ["sheet.tsx", "use-modal-focus.ts", "focus-targets.ts", "band.ts"])
      expect(browser.wfOverlay.test.test(`/app/src/components/wf/${file}`), file).toBe(true);
    // Only those files: the kit's other parts keep their normal packing.
    expect(browser.wfOverlay.test.test("/app/src/components/wf/sheet.module.css")).toBe(false);
    expect(browser.wfOverlay.test.test("/app/src/components/wf/dialog.tsx")).toBe(false);
    expect(groupsFor(true, false)).toEqual({});
    expect(groupsFor(false, true)).toEqual({});
  });
});
