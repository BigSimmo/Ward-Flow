import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { WF_ICON_SIZES } from "@/components/wf/icon";

/** R-STYLE-1 (one type scale), R-STYLE-4 (one icon rule), R-STYLE-10 (typed text stays in its box). */

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const SCALE = new Set([12, 13, 14, 15, 16, 20, 28]);

const TOKEN_FILES = [
  "src/app/ckb-v2-tokens.css",
  "src/app/ward-flow-v9-tokens.css",
  "src/app/ward-flow-shell-tokens.module.css",
  "src/app/globals.css",
];
const KIT_DIR = "src/components/wf";
const KIT_CSS = readdirSync(join(root, KIT_DIR))
  .filter((name) => name.endsWith(".module.css"))
  .map((name) => `${KIT_DIR}/${name}`);

/** Size tokens only: a name on the font scales. Colours such as --text-muted never resolve to a length. */
const SIZE_TOKEN = /^--(wf-fs-\d+|t-\d+|text-[a-z0-9-]+)$/;

function strip(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function definitions(): Map<string, string> {
  const defs = new Map<string, string>();
  for (const file of TOKEN_FILES) {
    for (const match of strip(read(file)).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;{}]+);/g)) {
      const [, name, value] = match;
      if (name && value && SIZE_TOKEN.test(name) && !name.endsWith("line-height") && !defs.has(name)) {
        defs.set(name, value.trim());
      }
    }
  }
  return defs;
}

/** A size in px, or null when it is not a plain length we can resolve (inherit, em, %, a colour). */
function toPx(value: string, defs: Map<string, string>, depth = 0): number | null {
  const v = value.trim();
  if (depth > 6) return null;
  const length = /^(-?[\d.]+)(px|rem)$/.exec(v);
  if (length) return Number(length[1]) * (length[2] === "rem" ? 16 : 1);
  const variable = /^var\(\s*(--[a-z0-9-]+)\s*(?:,[^)]*)?\)$/.exec(v);
  if (variable) {
    const target = defs.get(variable[1]!);
    return target ? toPx(target, defs, depth + 1) : null;
  }
  // max(12px, 0.75rem) and similar: the first argument is the intended size.
  const fn = /^(?:max|min)\(\s*([^,]+),/.exec(v);
  if (fn) return toPx(fn[1]!, defs, depth + 1);
  return null;
}

/** The size inside a `font:` shorthand: the length or var() that sits before `/ line-height`. */
function shorthandSize(value: string): string | null {
  const sized = /(var\(--[a-z0-9-]+\)|[\d.]+(?:px|rem))\s*\//.exec(value);
  return sized?.[1] ?? null;
}

describe("R-STYLE-1: one type scale", () => {
  const defs = definitions();

  it("every font size token resolves onto 12, 13, 14, 15, 16, 20 or 28 px", () => {
    const off: string[] = [];
    for (const [name, value] of defs) {
      const px = toPx(value, defs);
      if (px !== null && !SCALE.has(px)) off.push(`${name}: ${value} = ${px}px`);
    }
    expect(off).toEqual([]);
    expect(defs.size).toBeGreaterThan(15);
  });

  it("points --t-* and --text-* at the --wf-fs-* scale", () => {
    const pointed =
      /^--(t-\d+|text-(xs|sm|body|md|lg|xl|hero|3xs|2xs|sm-minus|base-minus|lg-minus|2xl-minus|3xl-minus))$/;
    let seen = 0;
    for (const [name, value] of defs) {
      if (!pointed.test(name)) continue;
      seen += 1;
      expect(value, name).toMatch(/^var\(--(wf-fs|t)-\d+\)$/);
    }
    expect(seen).toBeGreaterThan(15);
  });

  it("kit stylesheets set font sizes only on the scale", () => {
    const off: string[] = [];
    for (const file of KIT_CSS) {
      const css = strip(read(file));
      for (const match of css.matchAll(/(?:^|[;{\s])(font-size|font)\s*:\s*([^;}]+)/g)) {
        const [, prop, value] = match;
        if (!prop || !value) continue;
        const token = prop === "font" ? shorthandSize(value) : value.trim();
        if (!token) continue;
        const px = toPx(token, defs);
        if (px !== null && !SCALE.has(px)) off.push(`${file}: ${prop}: ${value.trim()} (${px}px)`);
      }
    }
    expect(off).toEqual([]);
  });

  it("the hero's figures are 20 in Geist Mono, labels 13, action titles 14", () => {
    const css = strip(read(`${KIT_DIR}/hero-top.module.css`));
    expect(css).toMatch(/\.figValue\s*\{[^}]*font:\s*600 var\(--wf-fs-20\)[^}]*var\(--wf-mono\)/);
    expect(css).toMatch(/\.figLabel\s*\{[^}]*font:\s*400 var\(--wf-fs-13\)/);
    expect(css).toMatch(/\.actTitle\s*\{[^}]*font:\s*600 var\(--wf-fs-14\)/);
  });
});

describe("R-STYLE-4: one icon rule", () => {
  it("one global rule sets every Lucide stroke to 1.75", () => {
    expect(strip(read("src/app/globals.css"))).toMatch(/svg\.lucide\s*\{\s*stroke-width:\s*1\.75;\s*\}/);
  });

  it("the kit icon sizes are 14, 16, 18 and 21", () => {
    expect([...WF_ICON_SIZES]).toEqual([14, 16, 18, 21]);
  });
});

describe("R-STYLE-10: typed text never leaves its box", () => {
  it("the global kit class breaks long strings anywhere", () => {
    expect(strip(read("src/app/globals.css"))).toMatch(/\.wf-typed\s*\{[^}]*overflow-wrap:\s*anywhere/);
  });

  it.each(["feed.tsx", "card.tsx", "formal-name.tsx", "table.tsx"])("%s applies it", (file) => {
    expect(read(`${KIT_DIR}/${file}`)).toContain('"wf-typed"');
  });
});
