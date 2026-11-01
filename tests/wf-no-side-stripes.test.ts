import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Josh, 31 October 2026: no coloured side edges or left accent stripes on rows, cards or tiles ("it
 * feels tacky"). Status shows as the StatusGlyph or a small tinted tag; selection as the selected tint
 * with a neutral border (design/v9/design-system-v9.md, "No side edges"). Q94 (1 Nov 2026): the act-now
 * rows lose their red bar too and keep the act tint and the glyph.
 *
 * The kit has none. The rest of the real app still has older ones; each page build removes its own,
 * so this count may only fall. Lower BASELINE when a build removes some. Mock-up copies are left out
 * (each page build deletes its copy).
 *
 * A side edge is caught four ways:
 * - a thick border on one side, in px, rem or a token: `border-left: 3px solid …`,
 *   `border-left: 0.1875rem solid …`, `border-left: var(--space-3) solid …`;
 * - an inset bar painted with a shadow: `box-shadow: inset 3px 0 0 …`;
 * - a toned colour on one side's border: `border-left-color: var(--wf-danger)`;
 * - a narrow bar drawn by `::before` or `::after` on the start or end edge: at most 6px wide, with a
 *   tone background (a dot, as tall as it is wide, is not a bar).
 * A 1px neutral divider (`border-right: 0.0625rem solid var(--line)`) is none of these.
 */
const BASELINE = 64;

const SIDE = String.raw`border-(?:left|right|inline-start|inline-end)`;
// A width of 2px or more as rem: 0.125rem and up (0.0625rem is a 1px hairline).
const THICK_REM = String.raw`(?:0?\.(?:1[2-9]|[2-9])\d*|[1-9][\d.]*)rem`;
const TONE = String.raw`var\(\s*--(?:wf-|ward-)?(?:danger|warn(?:ing)?|success|good|ok|accent|act[\w-]*|info|blue|caution|critical)\b`;
const SIDE_STRIPE = [
  // A thick coloured border on one side: border-left: 3px solid …, border-inline-start: 4px solid …
  new RegExp(String.raw`${SIDE}\s*:\s*[2-9]px\s+solid`, "u"),
  // The same in rem or through a token, unless it is transparent (a spacer, not an edge).
  new RegExp(String.raw`${SIDE}\s*:\s*(?:${THICK_REM}|var\([^)]*\)|calc\([^;]*\))\s+solid\s+(?!transparent\b)`, "u"),
  // An inset bar painted with a shadow: box-shadow: inset 3px 0 0 …
  /inset\s+-?[2-9]px\s+0(?:px)?\s+0(?:px)?\s/u,
  // A toned colour on one side, over a border set elsewhere: border-left-color: var(--wf-danger)
  new RegExp(String.raw`${SIDE}-color\s*:\s*${TONE}`, "u"),
];
// Forced-colours (Windows high contrast) rules use system colours, not tone; they are not stripes.
const SYSTEM_COLOUR = /\b(?:Highlight|CanvasText|ButtonText|GrayText|Canvas)\b/u;

function cssFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const full = path.join(directory, name);
    if (statSync(full).isDirectory()) return cssFiles(full);
    return name.endsWith(".css") ? [full] : [];
  });
}

function stripeLines(file: string, css: string): string[] {
  return css
    .split("\n")
    .filter((line) => SIDE_STRIPE.some((pattern) => pattern.test(line)) && !SYSTEM_COLOUR.test(line))
    .map((line) => `${file}: ${line.trim()}`);
}

/** Innermost rule blocks (selector and declarations), comments blanked. */
function ruleBlocks(css: string): { selector: string; body: string }[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//gu, (comment) => comment.replace(/[^\n]/gu, " "));
  const blocks: { selector: string; body: string }[] = [];
  const open: { selector: string; at: number }[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "{") {
      open.push({ selector: text.slice(start, i).trim(), at: i + 1 });
      start = i + 1;
    } else if (text[i] === "}") {
      const top = open.pop();
      const body = top ? text.slice(top.at, i) : "";
      if (top && !/[{}]/u.test(body)) blocks.push({ selector: top.selector, body });
      start = i + 1;
    }
  }
  return blocks;
}

function declaration(body: string, property: string): string | undefined {
  return new RegExp(String.raw`(?:^|[;\s])${property}\s*:\s*([^;]+)`, "u").exec(body)?.[1]?.trim();
}

function pixels(value: string | undefined): number | undefined {
  const match = /^([\d.]+)(px|rem)$/u.exec(value ?? "");
  if (!match) return undefined;
  return match[2] === "rem" ? Number(match[1]) * 16 : Number(match[1]);
}

/** A `::before`/`::after` bar: narrow, toned and on the start or end edge, and taller than wide. */
function pseudoBars(file: string, css: string): string[] {
  return ruleBlocks(css)
    .filter(({ selector, body }) => {
      if (!/::?(?:before|after)\b/u.test(selector)) return false;
      const width = pixels(declaration(body, "width"));
      if (width === undefined || width > 6) return false;
      const height = pixels(declaration(body, "height"));
      if (height !== undefined && height <= width * 2) return false;
      const background = declaration(body, "background(?:-color)?") ?? "";
      if (SYSTEM_COLOUR.test(background) || !new RegExp(TONE, "u").test(background)) return false;
      return /(?:^|[;\s])(?:inset-inline-start|inset-inline-end|left|right|inset)\s*:/u.test(body);
    })
    .map(({ selector }) => `${file}: ${selector.replace(/\s+/gu, " ")} (a narrow toned bar)`);
}

function sideEdges(file: string): string[] {
  const css = readFileSync(file, "utf8");
  const name = path.relative(process.cwd(), file);
  return [...stripeLines(name, css), ...pseudoBars(name, css)];
}

describe("no coloured side edges (Josh, 31 Oct 2026)", () => {
  it("the kit (src/components/wf) has none", () => {
    expect(cssFiles(path.join(process.cwd(), "src/components/wf")).flatMap(sideEdges)).toEqual([]);
  });

  it("the rest of the real app never adds more", () => {
    const roots = ["src/components", "src/app"].map((root) => path.join(process.cwd(), root));
    const found = roots
      .flatMap(cssFiles)
      .filter((file) => !/[\\/](?:ward-redesign|mockups)[\\/]/u.test(file))
      .flatMap(sideEdges);
    expect(found.length, found.join("\n")).toBeLessThanOrEqual(BASELINE);
  });

  it("catches each kind of side edge and leaves neutral dividers and dots alone", () => {
    const fixture = (css: string) => [...stripeLines("f.css", css), ...pseudoBars("f.css", css)];
    expect(fixture(".a { border-left: 3px solid var(--wf-danger); }")).toHaveLength(1);
    expect(fixture(".a { border-left: 0.1875rem solid var(--ward-danger); }")).toHaveLength(1);
    expect(fixture(".a { border-inline-start: var(--ward-space-3) solid var(--ward-danger); }")).toHaveLength(1);
    expect(fixture(".a { box-shadow: inset 3px 0 0 var(--wf-danger); }")).toHaveLength(1);
    expect(fixture('.a[data-tone="danger"] { border-left-color: var(--ward-danger); }')).toHaveLength(1);
    expect(
      fixture(
        ".a::before { content: ''; position: absolute; inset-block: 0.625rem; inset-inline-start: 6px; width: 3px; background: var(--wf-danger); }",
      ),
    ).toHaveLength(1);
    expect(
      fixture(
        ".a::after { position: absolute; left: 0; top: 0; bottom: 0; width: 0.25rem; background: var(--wf-warning); }",
      ),
    ).toHaveLength(1);

    expect(fixture(".a { border-right: 1px solid var(--wf-line); }")).toEqual([]);
    expect(fixture(".a { border-right: 0.0625rem solid var(--ward-border); }")).toEqual([]);
    expect(fixture(".a { border-left: var(--ward-space-3) solid transparent; }")).toEqual([]);
    expect(fixture(".a { border-left-color: var(--wf-line-2); }")).toEqual([]);
    expect(fixture(".a { border-left-color: CanvasText; }")).toEqual([]);
    expect(
      fixture(
        ".a::before { position: absolute; left: 5px; top: 14px; bottom: 0; width: 1px; background: var(--line-strong); }",
      ),
    ).toEqual([]);
    expect(
      fixture(
        ".a::before { position: absolute; left: 0; top: 5px; width: 6px; height: 6px; background: var(--accent); }",
      ),
    ).toEqual([]);
    expect(
      fixture("@media (forced-colors: active) { .a::before { left: 0; width: 3px; background: CanvasText; } }"),
    ).toEqual([]);
  });
});
