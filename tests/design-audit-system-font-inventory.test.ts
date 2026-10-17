import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  fontInventoryCounts,
  fontInventoryRises,
  inventoryFontSizes,
} from "../scripts/ward-flow/font-size-inventory.mjs";

function scan(css: string, tokens = ":root { --floor: 12px; --small: 0.6875rem; }") {
  return inventoryFontSizes(new Map([["fixture.css", css]]), [tokens]);
}

describe("design audit: parsed Ward font inventory", () => {
  it("finds raw px/rem, shorthand sizes and alias chains without counting comments or line-height", () => {
    const result = scan(`
      /* .ignored { font-size: 8px; } */
      .a { font-size: 11px; }
      .b { font: italic 600 .625rem / 20px 'A font'; }
      .c { --label: var(--small); font-size: var(--label); }
      .safe { font: 500 12px / 10px sans-serif; line-height: 9px; }
    `);
    expect(result.declarations).toBe(4);
    expect(result.findings.map((item) => item.sizePx)).toEqual([11, 10, 11]);
  });

  it("uses fallbacks only for missing tokens, including nested fallbacks", () => {
    const result = scan(`
      .safe { font-size: var(--floor, 11px); }
      .small { font: 500 var(--missing, var(--small)) / 1 sans-serif; }
      .alsoSmall { font-size: var(--missing, 10px); }
    `);
    expect(result.findings.map((item) => item.selector)).toEqual([".small", ".alsoSmall"]);
  });

  it("resolves floor bounds and keeps print sizing separate from on-screen text", () => {
    const result = scan(`
      .safe { font: 500 max(1rem, 16px) / 1 sans-serif; }
      .relativeSafe { font-size: max(12px, 1em); }
      .small { font-size: clamp(11px, 2vw, 20px); }
      .hidden { font-size: 0; }
      @media print { .paper { font-size: 10px; } }
    `);
    expect(result.findings.map((item) => item.selector)).toEqual([".small"]);
    expect(result.unresolved).toEqual([]);
  });

  it.each(["print", "only print", "print and (color)", "print, only print"])(
    "does not let %s tokens hide a screen fallback in any token layer",
    (media) => {
      const screen = ".new { font: 400 var(--print-only, 11px) / 1 sans-serif; }";
      const print = `@media ${media} { .new { --print-only: 12px; font-size: 10px; } }`;
      const cases: [string, string[], string[]][] = [
        [screen + print, [], []],
        [screen, [print], []],
        [screen, [], [print]],
      ];
      for (const [local, global, shell] of cases) {
        const result = inventoryFontSizes(
          new Map([["src/components/ward-management/fixture.module.css", local]]),
          global,
          shell,
        );
        expect(result.declarations).toBe(1);
        expect(result.findings.map((item) => item.sizePx)).toEqual([11]);
        expect(result.unresolved).toEqual([]);
      }
    },
  );

  it("retains tokens and sizes from media queries that can apply to a screen", () => {
    const result = scan(`
      @media screen, print { .mixed { --small-screen: 11px; font-size: var(--small-screen); } }
      @media not print { .screen { font-size: 10px; } }
    `);
    expect(result.declarations).toBe(2);
    expect(result.findings.map((item) => item.sizePx)).toEqual([11, 10]);
  });

  it("reports relative/complex sizes and cycles as unresolved, without hanging or claiming a floor pass", () => {
    const result = scan(`
      .relative { font-size: .8em; }
      .complex { font: 400 calc(1rem - 3px) / 12px sans-serif; }
      .cycle { --a: var(--b); --b: var(--a); font-size: var(--a); }
    `);
    expect(result.findings).toEqual([]);
    expect(result.unresolved).toHaveLength(3);
  });

  it("does not use a shorthand's line-height when its size cannot be resolved", () => {
    const result = scan(".unknown { font: 400 var(--missing) / 10px sans-serif; }");
    expect(result.findings).toEqual([]);
    expect(result.unresolved).toHaveLength(1);
  });

  it("uses a fallback for cyclic variables but leaves valid relative variables unresolved", () => {
    const result = scan(`
      .cyclic { --a: var(--b); --b: var(--a); font-size: var(--a, 11px); }
      .relative { --relative: .9em; font-size: var(--relative, 11px); }
    `);
    expect(result.findings.map((item) => item.selector)).toEqual([".cyclic"]);
    expect(result.unresolved.map((item) => item.selector)).toEqual([".relative"]);
  });

  it("retains a smaller local alias branch instead of hiding it behind another selector", () => {
    const result = scan(".a { --size: 11px; font-size: var(--size); } .b { --size: 12px; }");
    expect(result.findings).toHaveLength(1);
  });

  it("cannot exchange a historical small rule for a new small rule in the same file", () => {
    const baseline = fontInventoryCounts(scan(".old { font-size: 11px; }").findings);
    expect(fontInventoryRises(scan("\n\n.old { font-size: 11px; }").findings, baseline)).toEqual([]);
    expect(fontInventoryRises(scan(".new { font-size: 11px; }").findings, baseline)).toHaveLength(1);
    expect(fontInventoryRises(scan(".old { font-size: 10px; }").findings, baseline)).toHaveLength(1);
    expect(fontInventoryRises(scan(".old { font-size: 12px; }").findings, baseline)).toEqual([]);
  });

  it("fails closed on invalid CSS rather than reporting a clean inventory", () => {
    expect(() => scan(".broken { font-size: 11px;")).toThrow();
  });

  it("does not assume Ward shell typography in standalone or portalled shared primitives", () => {
    const result = inventoryFontSizes(
      new Map([
        ["src/components/ward-management/screen.module.css", ".label { font-size: var(--small); }"],
        ["src/components/wf/menu.module.css", ".label { font-size: var(--small); }"],
        ["src/components/ward-flow-sign-in/page.module.css", ".label { font-size: var(--small); }"],
      ]),
      [":root { --small: 10px; }"],
      [".wardShellTokens { --small: 12px; }"],
    );
    expect(result.findings.map((item) => item.file)).toEqual([
      "src/components/wf/menu.module.css",
      "src/components/ward-flow-sign-in/page.module.css",
    ]);
  });
});

describe("design audit: combined font guard admission", () => {
  let fixture = "";
  afterEach(() => {
    if (fixture) rmSync(fixture, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    fixture = "";
  });

  it("runs both ratchets and rejects new raw, shorthand and aliased sizes through the actual CLI", () => {
    fixture = mkdtempSync(join(tmpdir(), "ward-font-inventory-"));
    function write(path: string, content: string) {
      const target = join(fixture, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content);
    }
    for (let index = 0; index < 34; index += 1) {
      write(`src/components/ward-management/fixture-${index}.module.css`, ".safe { font-size: 12px; }");
    }
    for (const path of [
      "globals.css",
      "ckb-v2-tokens.css",
      "ward-flow-v9-tokens.css",
      "ward-flow-shell-tokens.module.css",
    ]) {
      write(`src/app/${path}`, ":root { --floor: 12px; }");
    }
    write("legacy.json", JSON.stringify({ count: 0, fileCount: 0, perFile: { "fixture.css": 0 } }));
    write("parsed.json", JSON.stringify({ counts: {} }));
    execFileSync("git", ["init", "--quiet"], { cwd: fixture });
    execFileSync("git", ["add", "src"], { cwd: fixture });
    const run = () =>
      spawnSync(
        process.execPath,
        [
          resolve("scripts/ward-flow/check-text-size-floor.mjs"),
          "--root",
          fixture,
          "--baseline",
          join(fixture, "legacy.json"),
          "--font-baseline",
          join(fixture, "parsed.json"),
        ],
        { encoding: "utf8" },
      );
    const clean = run();
    expect(clean.status, clean.stdout + clean.stderr).toBe(0);
    expect(clean.stdout).toContain("[font-inventory]");
    for (const rule of [
      ".new { font-size: 11px; }",
      ".new { font: 500 .625rem / 20px sans-serif; }",
      ".new { --tiny: 11px; --label: var(--tiny); font-size: var(--label); }",
      ".new { font-size: var(--print-only, 11px); } @media print { .new { --print-only: 12px; } }",
    ]) {
      write("src/components/ward-management/fixture-0.module.css", rule);
      const result = run();
      expect(result.status, result.stdout + result.stderr).toBe(1);
      expect(result.stderr).toContain("NEW sub-12px signature");
    }
  });
});
