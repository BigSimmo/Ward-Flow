// tests/ward-css-important-ratchet.test.ts
//
// Screen styles win by specificity and source order, not by `!important`. The styles cleanup of
// 16 October 2026 removed 175 screen `!important` declarations with no visual change (computed
// styles compared on every Ward Flow route, desktop and phone, light and dark). This ratchet keeps
// them from coming back.
//
// `!important` stays allowed where it is the point of the rule:
//   - inside `@media print` (paper ink and hiding screen chrome must beat every screen rule), but
//     not inside `@media not print`, which is a screen rule,
//   - inside reduced-motion, forced-colors and prefers-contrast queries,
//   - in the few screen rules named in ALLOWED below: user preference overrides, the visually
//     hidden utility, a layered focus ring, override mode classes, and rules that must beat a
//     component's inline style. Every selector in the rule must be allowed, not just one.
// A new screen `!important` fails here. Raise the selector's specificity instead, or scope it.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import postcss, { type AtRule, type Rule } from "postcss";
import { describe, expect, it } from "vitest";

const EXEMPT_AT_RULE = /prefers-reduced-motion|forced-colors|prefers-contrast/;

function exemptAtRule(params: string): boolean {
  return EXEMPT_AT_RULE.test(params) || (/\bprint\b/.test(params) && !/\bnot\b/.test(params));
}

/** Screen `!important` declarations each file may keep, by selector. */
const ALLOWED: Record<string, readonly RegExp[]> = {
  // The app's own Reduce motion setting, the theme switch freeze and coarse pointer key hints.
  // A focus ring inside @layer components needs a layered !important to beat the unlayered
  // `outline: none` reset.
  "src/app/globals.css": [
    /html\[data-motion="reduced"\]/,
    /html\.theme-transitioning/,
    /^\[data-kbd-hint\]$/,
    /^kbd:not\(dt > kbd\)$/,
    /^\.focus-ring-tab:focus-visible$/,
  ],
  // The shell's reduced motion and high contrast settings.
  "src/app/mockups/ward-flow/ward-flow-layout.module.css": [/data-reduced-motion/, /data-high-contrast/],
  // ED action menu rows restyle buttons that other ED rules style up to (0,3,0).
  "src/components/ward-management/ed/ed-board-controls.module.css": [/^\.actionItems button/],
  // Larger screen mode takes over the list panel, whose .panel, .full and .listSection rules come later.
  "src/components/ward-management/ed/ed.module.css": [/^\.fullscreenBoard$/],
  // DataRow sets grid-template-columns inline, so the phone layout must beat it.
  "src/components/ward-management/legal-forms/legal-forms.module.css": [
    /^\.rowList > \.row:not\(\.checkRow\)$/,
    /^\.rowList > \.checkRow$/,
  ],
  // BarList sets --wf-bar-label inline, so the phone chart must beat it.
  "src/components/ward-management/statistics/statistics-compare.module.css": [/^\.chart > figure > div$/],
  // The phone breakpoint sheet overrides panel classes that callers pass from their own modules.
  "src/components/wf/sheet.module.css": [/^\.phoneBreakpoint(Backdrop|Panel)$/],
  // The visually hidden utility must never be undone by a screen rule.
  "src/components/ward-management/ward/ward.module.css": [/^\.visuallyHidden$/],
};

function stylesheets(): string[] {
  return execFileSync("git", ["ls-files", "src/*.css", "src/**/*.css"], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}

function screenImportant(file: string, css: string): string[] {
  const found: string[] = [];
  postcss.parse(css, { from: file }).walkDecls((decl) => {
    if (!decl.important) return;
    for (let parent = decl.parent; parent && parent.type !== "root"; parent = parent.parent) {
      if (parent.type === "atrule" && exemptAtRule((parent as AtRule).params)) return;
    }
    const rule = decl.parent?.type === "rule" ? (decl.parent as Rule) : undefined;
    const selector = rule ? rule.selector.replace(/\s+/g, " ") : "";
    const selectors = rule ? rule.selectors.map((one) => one.replace(/\s+/g, " ").trim()) : [""];
    const allowed = ALLOWED[file] ?? [];
    if (selectors.every((one) => allowed.some((pattern) => pattern.test(one)))) return;
    found.push(`${file}:${decl.source?.start?.line} ${selector} { ${decl.prop}: ... !important }`);
  });
  return found;
}

describe("screen styles do not use !important", () => {
  it("finds no screen !important outside print, motion, contrast and the allowed rules", () => {
    const offenders = stylesheets().flatMap((file) => screenImportant(file, readFileSync(file, "utf8")));
    expect(offenders, "scope or raise the selector instead of adding !important").toEqual([]);
  });

  it("control: catches a screen !important and ignores a print one", () => {
    const css = ".a { color: red !important; } @media print { .b { color: black !important; } }";
    expect(screenImportant("control.css", css)).toEqual(["control.css:1 .a { color: ... !important }"]);
  });

  it("control: treats @media not print as screen and needs every selector in a list allowed", () => {
    expect(screenImportant("control.css", "@media not print { .a { color: red !important; } }")).toHaveLength(1);
    const file = "src/components/ward-management/ward/ward.module.css";
    expect(screenImportant(file, ".visuallyHidden { clip: auto !important; }")).toEqual([]);
    expect(screenImportant(file, ".visuallyHidden, .other { clip: auto !important; }")).toHaveLength(1);
  });
});
