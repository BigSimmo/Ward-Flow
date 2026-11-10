import { describe, expect, it } from "vitest";
import { moduleSpecifiersFromSource } from "./helpers/module-graph";
import {
  breaches,
  buildImportMap,
  findCycles,
  layerOf,
  readBaseline,
  repositoryImportMap,
} from "../scripts/ward-flow/import-map";

/**
 * M139 (Tier 7 plan, 10 Nov 2026): the import map's layer rules, frozen at today's baseline
 * (main 29352cd0). No import cycle (there is none today), the kit and src/lib import no ward code,
 * live code imports no mockup, and screen-to-screen imports may not rise above 564.
 */
const TODAY_SCREEN_TO_SCREEN = 564;
const WM = "src/components/ward-management";

describe("import map layers", () => {
  it("names each layer", () => {
    expect(layerOf("src/components/wf/index.ts")).toBe("kit");
    expect(layerOf("src/lib/env.ts")).toBe("lib");
    expect(layerOf(`${WM}/ward-clock.ts`)).toBe("ward-root");
    expect(layerOf(`${WM}/shell/ward-facade.ts`)).toBe("shell");
    expect(layerOf(`${WM}/shell-next/next-rail-body.tsx`)).toBe("shell");
    expect(layerOf(`${WM}/referrals/referral-board.tsx`)).toBe("screen:referrals");
    expect(layerOf("src/app/mockups/ward-flow-digest/route.ts")).toBe("mockup");
    expect(layerOf("src/app/ward-flow/page.tsx")).toBe("route");
    expect(layerOf("src/components/ward-redesign/ed-board.tsx")).toBe("component");
  });

  it('treats a type query such as import("./x").T as a type, not an import', () => {
    // The scratch measurement behind the plan counted these and reported a 7-file cycle that
    // does not exist at run time (ward-model.ts names ReferralIntakeDetails this way).
    const parsed = moduleSpecifiersFromSource(
      "fixture.ts",
      'export type A = { intake?: import("./referral-submission").ReferralIntakeDetails };',
    );
    expect([...parsed.staticImports, ...parsed.dynamicImports]).toEqual([]);
  });

  it("finds cycles, including a self-import", () => {
    const graph = new Map([
      ["a", ["b"]],
      ["b", ["c"]],
      ["c", ["a"]],
      ["d", ["d"]],
      ["e", ["a"]],
    ]);
    expect(findCycles(graph)).toEqual([["a", "b", "c"], ["d"]]);
  });

  it("reports every kind of breach against a baseline", () => {
    const graph = new Map<string, string[]>([
      ["src/components/wf/button.tsx", [`${WM}/referrals/referral-board.tsx`]],
      ["src/lib/format.ts", [`${WM}/ward-clock.ts`]],
      [`${WM}/referrals/referral-board.tsx`, [`${WM}/ward/ward-screen.tsx`, `${WM}/referrals/referral-row.tsx`]],
      [`${WM}/referrals/referral-row.tsx`, [`${WM}/referrals/referral-board.tsx`]],
      [`${WM}/ward/ward-screen.tsx`, [`${WM}/shell/ward-facade.ts`, "src/app/mockups/x/page.tsx"]],
      [`${WM}/shell/ward-facade.ts`, [`${WM}/ward/ward-screen.tsx`]],
      [`${WM}/ward-clock.ts`, []],
      ["src/app/mockups/x/page.tsx", []],
    ]);
    const map = buildImportMap(graph);
    expect(map.screenToScreenImports).toBe(1);
    expect(map.cycles).toEqual([
      [`${WM}/referrals/referral-board.tsx`, `${WM}/referrals/referral-row.tsx`],
      [`${WM}/shell/ward-facade.ts`, `${WM}/ward/ward-screen.tsx`],
    ]);
    const problems = breaches(map, {
      cycles: [[`${WM}/referrals/referral-row.tsx`, `${WM}/referrals/referral-board.tsx`]],
      screenToScreenImports: 0,
    });
    expect(problems).toHaveLength(5);
    expect(problems.join("\n")).toContain("new or grown import cycle (2 files)");
    expect(problems.join("\n")).toContain("the kit or src/lib imports ward code: src/components/wf/button.tsx");
    expect(problems.join("\n")).toContain("the kit or src/lib imports ward code: src/lib/format.ts");
    expect(problems.join("\n")).toContain("live code imports a mockup");
    expect(problems.join("\n")).toContain("screen-to-screen imports rose from 0 to 1");
    // The allowed cycle passes only while it stays exactly the same files.
    expect(problems.join("\n")).not.toContain("referral-row.tsx, ");
  });
});

describe("the repository's import map", () => {
  it("keeps the frozen baseline: no cycle, and screen-to-screen imports at or below today's", () => {
    const baseline = readBaseline();
    expect(baseline.cycles).toEqual([]);
    expect(baseline.screenToScreenImports).toBeLessThanOrEqual(TODAY_SCREEN_TO_SCREEN);
  });

  it("breaks no layer rule", { timeout: 60_000 }, () => {
    const map = repositoryImportMap();
    // A floor, so a broken walk cannot pass by finding nothing.
    expect(map.files).toBeGreaterThan(1_500);
    expect(map.edges).toBeGreaterThan(8_000);
    expect(breaches(map, readBaseline())).toEqual([]);
  });
});
