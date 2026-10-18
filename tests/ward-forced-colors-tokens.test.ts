// tests/ward-forced-colors-tokens.test.ts
//
// ⚠️ `npm run test:focused` CAN NEVER SELECT THIS FILE. It reads a stylesheet off
// disk and imports nothing from `src/`, so `vitest related` has no edge to it. A
// focused green has not run this. Run it by name, or let the full suite do it.
//
// WHAT THIS GUARDS. `src/app/ckb-v2-tokens.css` re-points 83 tokens under
// `@media (forced-colors: active)`, scoped to `.ckb-v2.ckb-v2`, and `.ckb-v2` is
// on the <html> element — so most of the ward token layer inherits high-contrast
// handling for free. Eight roles do not, because they alias tokens that block
// does not touch: the two border roles resolve to `--neutral-500` (the v2 block
// re-points `--border`, not the neutral ramp), and the six status roles resolve
// to `--success-text` / `--warning-text` / `--danger-text` and their `-bg`
// partners, which are not in it at all.
//
// The two border roles carry every panel edge and every row rule in Ward Flow.
// A screen that adopted the shared layer and deleted its own forced-colors block
// kept its text and its surfaces and lost its borders — visible only to someone
// actually running high-contrast mode, and no test in this repository renders
// under forced colours.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

const TOKENS = join(process.cwd(), "src/components/ward-management/ward-tokens.module.css");
const V2 = join(process.cwd(), "src/app/ckb-v2-tokens.css");

/** Text roles must become a foreground system colour; fills must become a background one. */
const MUST_BE_FOREGROUND = ["--ward-border", "--ward-divider", "--ward-success", "--ward-warning", "--ward-danger"];
const MUST_BE_BACKGROUND = ["--ward-success-soft", "--ward-warning-soft", "--ward-danger-soft"];

function forcedColorsBlock(css: string): string {
  const blocks: string[] = [];
  postcss.parse(css).walkAtRules("media", (rule) => {
    if (/^\(\s*forced-colors\s*:\s*active\s*\)$/.test(rule.params)) blocks.push(rule.toString());
  });
  expect(blocks, "expected exactly one actual forced-colors: active block").toHaveLength(1);
  return blocks[0]!;
}

describe("the shared ward layer carries its own high-contrast handling", () => {
  const css = readFileSync(TOKENS, "utf8");
  const block = forcedColorsBlock(css);

  it("isolates the actual active block from comments, glare and later print rules", () => {
    const selected = forcedColorsBlock(`
      /* @media (forced-colors: active) is documented here, not declared. */
      @media screen and (forced-colors: none) { .glare { --ward-border: var(--wf-line); } }
      @media (forced-colors: active) { .wardTokens { --ward-border: CanvasText; } }
      @media print { .paper { --ward-border: var(--print-line); } }
    `);
    expect(selected).toContain("--ward-border: CanvasText");
    expect(selected).not.toMatch(/--wf-line|--print-line|\.glare|\.paper/);
    expect(() => forcedColorsBlock("/* @media (forced-colors: active) */")).toThrow();
  });

  it.each(MUST_BE_FOREGROUND)("%s becomes a foreground system colour", (token) => {
    const declaration = new RegExp(`${token}:\\s*(CanvasText|ButtonText|LinkText|MarkText|GrayText)\\s*;`);
    expect(block, `${token} is not re-pointed to a foreground system colour under forced colours`).toMatch(declaration);
  });

  it.each(MUST_BE_BACKGROUND)("%s becomes a background system colour", (token) => {
    const declaration = new RegExp(`${token}:\\s*(Canvas|ButtonFace|Mark|transparent)\\s*;`);
    expect(block, `${token} is not re-pointed to a background system colour under forced colours`).toMatch(declaration);
  });

  it("re-points nothing to a themed value, which would silently do nothing", () => {
    // The failure this catches is `--ward-border: var(--border)` — which looks
    // like a fix, is inside the right block, and resolves to a themed colour
    // that forced-colours mode has already decided to ignore.
    const themed: string[] = [];
    postcss.parse(block).walkDecls(/^--ward-/, (declaration) => {
      if (/^(?:var\(|#[0-9a-fA-F]{3,8})/.test(declaration.value)) {
        themed.push(`${declaration.prop}: ${declaration.value}`);
      }
    });
    expect(
      themed,
      "these are re-pointed to a themed value inside the forced-colors block, which changes nothing",
    ).toEqual([]);
  });

  it("does not re-point --ward-tap, because a spacing minimum is not a colour", () => {
    expect(block).not.toContain("--ward-tap:");
  });

  it("still covers every role the v2 layer leaves uncovered — derived, not listed", () => {
    // 🔴 THE ANTI-VACUITY HALF, AND THE ONE THAT MATTERS MOST. The lists above
    // are hand-written, so they can only go stale in the silent direction: add a
    // tenth `--ward-*` role tomorrow that aliases an unre-pointed token, and
    // every assertion above still passes while the new role is uncovered.
    //
    // So this derives the population instead: read every `--ward-x: var(--y)`
    // alias out of the token layer, read the token names the v2 forced-colors
    // block re-points, and require that any ward role whose target is NOT in
    // that set appears in this file's own forced-colors block.
    // Only unconditional aliases establish the active-mode inheritance premise.
    // Glare-only aliases do not apply under forced colours and cannot count as
    // either uncovered base roles or evidence that those roles are handled.
    const aliases: { role: string; target: string }[] = [];
    let baseRules = 0;
    postcss.parse(css).walkRules((rule) => {
      if (rule.selector !== ".wardTokens" || rule.parent?.type !== "root") return;
      baseRules += 1;
      rule.walkDecls(/^--ward-/, (declaration) => {
        const alias = /^var\((--[a-z0-9-]+)\)$/.exec(declaration.value);
        if (alias) aliases.push({ role: declaration.prop, target: alias[1]! });
      });
    });
    expect(baseRules, "expected exactly one unconditional ward token carrier").toBe(1);
    // Floor the POPULATION walked, never the finding. A pass over zero aliases
    // proves nothing at all, and this file is one refactor away from that.
    expect(aliases.length, "no --ward-* aliases found — this test stopped measuring anything").toBeGreaterThanOrEqual(
      18,
    );

    const v2 = readFileSync(V2, "utf8");
    const v2Covered = new Set<string>();
    postcss.parse(forcedColorsBlock(v2)).walkDecls(/^--/, (declaration) => {
      v2Covered.add(declaration.prop);
    });
    expect(v2Covered.size, "read no tokens out of the v2 forced-colors block").toBeGreaterThanOrEqual(50);

    // `--ward-tap` is a spacing role and is excluded by name, with the reason in
    // the stylesheet beside the block. `--ward-shadow` (added 2026-09-25) is a whole
    // box-shadow value, not a colour role; forced-colors mode drops decorative shadows.
    const uncovered = aliases
      .filter(({ role, target }) => role !== "--ward-tap" && role !== "--ward-shadow" && !v2Covered.has(target))
      .map(({ role }) => role);
    const unhandled = uncovered.filter((role) => !new RegExp(`${role}:`).test(block));
    expect(
      unhandled,
      "these ward roles inherit no high-contrast handling from the v2 layer and are not re-pointed here either",
    ).toEqual([]);
  });
});
