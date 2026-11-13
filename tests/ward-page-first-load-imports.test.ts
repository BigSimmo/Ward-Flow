import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import loadNextConfig from "../next.config";

/**
 * Phone size (PR C, 13 Nov 2026). Three pages pulled a whole component file onto their first load
 * for one small export, and the 20 KB split minimum copied shared helpers into several first-load
 * chunks of one page. These checks keep both from coming back. The phone script budget
 * (script-budget.json) measures the result.
 */
function staticImportsOf(file: string) {
  const source = readFileSync(path.join(process.cwd(), file), "utf8");
  return [...source.matchAll(/^import\s[^;]*?from\s+"([^"]+)";/gmsu)]
    .filter((match) => !/^import\s+type\s/u.test(match[0]))
    .map((match) => match[1]);
}

const WM = "src/components/ward-management";

describe("first-load imports", () => {
  it("the Ward screen takes the decline toast words from their own small file", () => {
    const imports = staticImportsOf(`${WM}/ward/ward-screen.tsx`);
    expect(imports).toContain("./ward-decline-toast-text");
    expect(imports).not.toContain("./ward-answer-feedback");
  });

  it("the bed meeting, its sheet and the ward board read the daily sheet's model, not the printed sheet", () => {
    for (const file of [
      `${WM}/bed-meeting/bed-meeting-tv.tsx`,
      `${WM}/bed-meeting/tv-derivations.ts`,
      `${WM}/capacity/bed-meeting-sheet.tsx`,
      `${WM}/board/ward-board.tsx`,
    ]) {
      const imports = staticImportsOf(file);
      expect(
        imports.some((from) => /ward-daily-sheet$/u.test(from)),
        file,
      ).toBe(false);
      expect(
        imports.some((from) => /ward-daily-sheet-model$/u.test(from)),
        file,
      ).toBe(true);
    }
  });

  it("the patient and officer screens take the copy header line from the clipboard helper, not the referral letter", () => {
    for (const file of [`${WM}/patients/patient-now-screen.tsx`, `${WM}/officer/officer-screen.tsx`]) {
      const imports = staticImportsOf(file);
      expect(imports, file).not.toContain("@/components/ward-management/referrals/referral-letter");
      expect(imports, file).toContain("@/components/ward-management/ward-clipboard");
    }
  });

  it("packs the shared desk guards, Next's link helpers and lucide's icon base once, in the browser production build only", async () => {
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
    expect(browser.wfDeskShared.name).toBe("wf-desk-shared");
    expect(browser.wfDeskShared.enforce).toBe(true);
    for (const file of [
      `/app/${WM}/use-dirty-state-guard.ts`,
      `/app/${WM}/ward-role-gate.tsx`,
      `/app/${WM}/ward-role-permissions.ts`,
      `/app/${WM}/shell/ward-service-store.ts`,
      `/app/${WM}/shell/ward-prototype-footer.tsx`,
      "/app/src/components/contextual-back-link.tsx",
    ])
      expect(browser.wfDeskShared.test.test(file), file).toBe(true);
    // Scripts only: no stylesheet moves, so the cascade is unchanged.
    expect(browser.wfDeskShared.test.test(`/app/${WM}/shell/ward-prototype-footer.module.css`)).toBe(false);
    expect(browser.wfDeskShared.test.test(`/app/${WM}/ward-role-gate-extra.tsx`)).toBe(false);

    expect(browser.nextClientShared.name).toBe("next-client-shared");
    expect(browser.nextClientShared.enforce).toBe(true);
    for (const file of [
      "/app/node_modules/next/dist/client/app-dir/link.js",
      "/app/node_modules/next/dist/shared/lib/utils.js",
      "/app/node_modules/next/dist/shared/lib/router/utils/format-url.js",
      "/app/node_modules/lucide-react/dist/esm/Icon.mjs",
      "/app/node_modules/lucide-react/dist/esm/shared/src/build/buildLucideIconNode.mjs",
    ])
      expect(browser.nextClientShared.test.test(file), file).toBe(true);
    // Never an icon or lucide's whole-library barrel.
    expect(browser.nextClientShared.test.test("/app/node_modules/lucide-react/dist/esm/icons/x.mjs")).toBe(false);
    expect(browser.nextClientShared.test.test("/app/node_modules/lucide-react/dist/esm/lucide-react.mjs")).toBe(false);

    expect(groupsFor(true, false)).toEqual({});
    expect(groupsFor(false, true)).toEqual({});
  });
});
