import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { BASELINE_PATH, measureCss, measureTree, measureTsx, rises } from "../scripts/design-drift.mjs";

/**
 * Design system v8 gates (design/v8/design-system-v8.md, section 10). Each one runs here, inside
 * `npm test`, because the inherited design checks were built and never invoked: a gate nobody runs
 * is a rule nobody enforces.
 */

const SRC = join(process.cwd(), "src");
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
const CSS_FILES = walk(SRC).filter((f) => f.endsWith(".css"));
const read = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const rel = (f: string) => f.replace(`${process.cwd()}/`, "");

/** Split a value at top-level commas, ignoring commas inside parentheses. */
function topLevel(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === "(") depth++;
    else if (value[i] === ")") depth--;
    else if (value[i] === "," && depth === 0) {
      parts.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts;
}

/** Every declaration in every source stylesheet, as [file, property, value]. */
const DECLS: Array<[string, string, string]> = CSS_FILES.flatMap((file) =>
  [...read(file).matchAll(/([\w-]+)\s*:\s*([^;{}]+);/g)].map(
    (m) => [rel(file), m[1]!, m[2]!.trim()] as [string, string, string],
  ),
);

describe("design drift ratchet", () => {
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  const current = measureTree();

  it("measures something, so a broken walk cannot pass over nothing", () => {
    expect(Object.keys(current).length).toBeGreaterThan(50);
    expect(Object.keys(baseline).length).toBeGreaterThan(50);
  });

  it("no file rises above its baseline for raw sizes, layers, widths, bare outlines or inline styles", () => {
    expect(
      rises(current, baseline),
      "A value bypassed the v8 scales. Use the token (--wf-fs-*, --wf-z-*, the 40/48/64rem widths, the " +
        "shared focus ring, a CSS Module) instead. Re-baseline only after a deliberate fall.",
    ).toEqual([]);
  });

  it("would catch a rise (the control)", () => {
    const worse = { "src/x.module.css": { rawFontSize: 2 } };
    expect(rises(worse, { "src/x.module.css": { rawFontSize: 1 } })).toHaveLength(1);
    expect(rises(worse, {})).toHaveLength(1);
    expect(measureCss(".a{font-size:11px;z-index:999}@media (max-width:639.98px){.b{}}")).toMatchObject({
      rawFontSize: 1,
      rawZIndex: 1,
      offScaleMedia: 1,
    });
    expect(measureCss(".a{font:600 var(--wf-fs-12)/1 var(--wf-font);z-index:var(--wf-z-tip)}")).toMatchObject({
      rawFontSize: 0,
      rawZIndex: 0,
    });
    expect(measureTsx(`<p style={{ color: "var(--x, #0284c7)" }} />`)).toEqual({ inlineStyle: 1, inlineHex: 1 });
  });
});

describe("token graph", () => {
  it("no custom property refers to itself (a cycle makes it, and everything built on it, invalid)", () => {
    const cycles = DECLS.filter(([, prop, value]) => {
      if (!prop.startsWith("--")) return false;
      return new RegExp(`var\\(\\s*${prop}\\s*[,)]`).test(value);
    }).map(([file, prop, value]) => `${file}: ${prop}: ${value}`);
    expect(cycles).toEqual([]);
  });

  it("a token that holds a whole shadow is only ever used as a whole shadow", () => {
    const shadowTokens = new Set(
      DECLS.filter(
        ([, prop, value]) =>
          prop.startsWith("--") &&
          // Offsets then a colour ("0 1px 2px rgba(...)"), or a whole known shadow token.
          (/(?:^|[\s,])(?:-?\d*\.?\d+(?:px)?\s+){2,}-?\d*\.?\d+px\s+(?:rgba?\(|#|hsl|var\(|color-mix|transparent)/.test(
            value,
          ) ||
            /^var\(--(lift|wf-e[123]|wf-e-[\w-]+|ward-shadow|float)\b/.test(value)) &&
          !/^(rgb|rgba|hsl|#|color-mix|light-dark)/.test(value),
      ).map(([, prop]) => prop),
    );
    expect(shadowTokens.has("--ward-shadow"), "the shadow token set lost its known member").toBe(true);
    const misuse = DECLS.flatMap(([file, prop, value]) =>
      topLevel(value)
        .filter((segment) => {
          const shadowSlot = prop === "box-shadow" || prop.startsWith("--");
          const lead = segment.match(/^var\((--[\w-]+)/)?.[1];
          // A whole shadow token in a shadow slot is right, fallbacks inside it included.
          if (shadowSlot && lead && shadowTokens.has(lead)) return false;
          return [...segment.matchAll(/var\((--[\w-]+)/g)].some((m) => shadowTokens.has(m[1]!));
        })
        .map((segment) => `${file}: ${prop}: ${segment}`),
    );
    expect(misuse, "a shadow token was used as a colour or with extra offsets, which is invalid CSS").toEqual([]);
  });

  it("the v8 tokens use one theme mechanism: no --wf token is redeclared for night", () => {
    const tokens = readFileSync("src/app/ward-flow-tokens.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const nightBlocks = [...tokens.matchAll(/([^{}]*(?:\.night|data-theme="dark")[^{}]*)\{([^{}]*)\}/g)].filter((m) =>
      /--wf-/.test(m[2]!),
    );
    expect(nightBlocks.map((m) => m[1]!.trim())).toEqual([]);
    expect((tokens.match(/light-dark\(/g) ?? []).length).toBeGreaterThan(60);
  });

  it("the shell layer's explicit Dark declares everything its OS dark block does", () => {
    const shell = readFileSync("src/app/ward-flow-shell-tokens.module.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const block = (selector: string) => {
      const at = shell.indexOf(selector);
      expect(at, `missing ${selector}`).toBeGreaterThan(-1);
      const body = shell.slice(shell.indexOf("{", at) + 1, shell.indexOf("}", at));
      return new Set([...body.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]!));
    };
    const os = block(':global(:root:not([data-theme="light"])) .wardShellTokens {');
    const explicit = block(':global([data-theme="dark"]) .wardShellTokens {');
    expect(os.size).toBeGreaterThan(20);
    expect([...os].filter((name) => !explicit.has(name))).toEqual([]);
  });

  it("print carries every day service colour", () => {
    const shell = readFileSync("src/app/ward-flow-shell-tokens.module.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const day = shell.slice(0, shell.indexOf("@media (prefers-color-scheme: dark) {"));
    const print = shell.slice(shell.indexOf("@media print {"));
    const SERVICE = /(--svc-(?:east|north|south|wachs|cahs|statewide|private)(?:-bg|-border|-ink)?)\s*:\s*([^;]+);/g;
    const dayValues = new Map([...day.matchAll(SERVICE)].map((m) => [m[1]!, m[2]!.trim()]));
    const printValues = new Map([...print.matchAll(SERVICE)].map((m) => [m[1]!, m[2]!.trim()]));
    expect(dayValues.size).toBeGreaterThan(20);
    for (const [name, value] of dayValues) expect(printValues.get(name), name).toBe(value);
  });
});
