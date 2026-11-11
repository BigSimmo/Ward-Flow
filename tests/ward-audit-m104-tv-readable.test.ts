// M104 (master audit list, 10 Nov 2026): the TV is readable across a room.
//
// The design system gives shared screens a display scale on its 20 and 28 steps (DESIGN-SYSTEM §5,
// "Scale"), and the TV stylesheet's own rules (DA-22, audit 24-7 CT-18) say lists and labels reach
// 24px and the smallest words 20px at 1080p. This test works out every font size the three TV views
// use at 1920 by 1080 (bed meeting, ward TV and the ED view shown in the tea room), from the
// stylesheet itself, and checks:
//
// - names and rows are at least 24px, the smallest words at least 20px, and the tile figures at
//   least the 28px display step;
// - for each view, every class it draws (its own and those of the parts it uses) resolves to 20px or
//   more, except SMALL_ON_PURPOSE.
//
// Full names stay (D-83): nothing here shortens a name. The 10-minute check on a meeting-room screen
// at 3 metres is a person's job: docs/ward-flow/evidence/tv-room-check-template.md.
//
// Reads files with `readFileSync`; run it by name.

import { readFileSync } from "node:fs";

import postcss from "postcss";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const FOLDER = "src/components/ward-management/bed-meeting";
const TV_CSS = `${FOLDER}/bed-meeting-tv.module.css`;
const TV_TSX = `${FOLDER}/bed-meeting-tv.tsx`;
const WIDTH = 1920;
const HEIGHT = 1080;
const REM = 16;

/** The kit's type steps in px (`--wf-fs-*`, 1rem = 16px). */
const STEPS: Record<string, number> = {
  "--wf-fs-11": 12,
  "--wf-fs-12": 12,
  "--wf-fs-13": 13,
  "--wf-fs-14": 14,
  "--wf-fs-15": 15,
  "--wf-fs-16": 16,
  "--wf-fs-20": 20,
  "--wf-fs-28": 28,
};

/** A media query that applies to a 1920 by 1080 screen (print, forced colours and the like do not). */
function appliesAt1080p(params: string): boolean {
  if (/print|forced-colors|prefers-|hover|pointer/.test(params)) return false;
  const px = (value: string, unit: string) => (unit === "rem" || unit === "em" ? Number(value) * REM : Number(value));
  for (const [, side, value, unit] of params.matchAll(/(min|max)-width:\s*([\d.]+)(rem|em|px)/g))
    if (side === "min" ? WIDTH < px(value!, unit!) : WIDTH > px(value!, unit!)) return false;
  for (const [, side, value, unit] of params.matchAll(/(min|max)-height:\s*([\d.]+)(rem|em|px)/g))
    if (side === "min" ? HEIGHT < px(value!, unit!) : HEIGHT > px(value!, unit!)) return false;
  return true;
}

function splitArgs(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of text) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else current += char;
  }
  return [...parts, current];
}

/** A font size in px at 1920 wide, or undefined for a relative size (em, %) this does not follow. */
function resolve(value: string, vars: Record<string, number>): number | undefined {
  const text = value.trim();
  let match: RegExpExecArray | null;
  if ((match = /^var\((--[\w-]+)(?:,\s*(.+))?\)$/.exec(text)))
    return STEPS[match[1]!] ?? vars[match[1]!] ?? (match[2] ? resolve(match[2], vars) : undefined);
  if ((match = /^([\d.]+)rem$/.exec(text))) return Number(match[1]) * REM;
  if ((match = /^([\d.]+)px$/.exec(text))) return Number(match[1]);
  if ((match = /^([\d.]+)vw$/.exec(text))) return (Number(match[1]) * WIDTH) / 100;
  if ((match = /^clamp\((.*)\)$/.exec(text))) {
    const [low, mid, high] = splitArgs(match[1]!).map((part) => resolve(part, vars));
    if (low === undefined || mid === undefined || high === undefined) return undefined;
    return Math.min(Math.max(low, mid), high);
  }
  if ((match = /^calc\((.+?)\s*\*\s*([\d.]+)\)$/.exec(text))) {
    const base = resolve(match[1]!, vars);
    return base === undefined ? undefined : base * Number(match[2]);
  }
  return undefined;
}

function inForce(node: postcss.Node): boolean {
  for (let parent = node.parent; parent; parent = parent.parent)
    if (parent.type === "atrule" && (parent as postcss.AtRule).name === "media")
      if (!appliesAt1080p((parent as postcss.AtRule).params)) return false;
  return true;
}

const css = postcss.parse(readFileSync(TV_CSS, "utf8"));

/** The TV's own size tokens at 1080p, the last declaration in force winning as in the browser. */
function tvTokens(): Record<string, number> {
  const vars: Record<string, number> = {};
  css.walkDecls(/^--tv-/, (decl) => {
    if (!inForce(decl)) return;
    const value = resolve(decl.value, vars);
    if (value !== undefined) vars[decl.prop] = value;
  });
  return vars;
}

const TOKENS = tvTokens();

/** Every font size set on a class, at 1080p, keyed by class name. */
function sizesByClass(): Map<string, { selector: string; px: number }[]> {
  const sizes = new Map<string, { selector: string; px: number }[]>();
  css.walkDecls("font-size", (decl) => {
    if (!inForce(decl) || decl.parent?.type !== "rule") return;
    const px = resolve(decl.value, TOKENS);
    if (px === undefined) return;
    const rule = decl.parent as postcss.Rule;
    for (const selector of rule.selectors) {
      // The class the size lands on: the last class in the selector's last compound.
      const last =
        selector
          .trim()
          .split(/\s+|>|\+|~/)
          .filter(Boolean)
          .at(-1) ?? "";
      const name = [...last.matchAll(/\.([\w-]+)/g)].at(-1)?.[1];
      if (name) sizes.set(name, [...(sizes.get(name) ?? []), { selector, px }]);
    }
  });
  return sizes;
}

/** The `styles.<class>` names each function draws, and the functions it renders, read with the parser. */
function viewClasses(): Map<string, Set<string>> {
  const source = ts.createSourceFile(
    TV_TSX,
    readFileSync(TV_TSX, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const own = new Map<string, { classes: Set<string>; parts: Set<string> }>();
  for (const statement of source.statements) {
    if (!ts.isFunctionDeclaration(statement) || !statement.name) continue;
    const classes = new Set<string>();
    const parts = new Set<string>();
    const visit = (node: ts.Node): void => {
      if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "styles")
        classes.add(node.name.text);
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ts.isIdentifier(node.tagName))
        parts.add(node.tagName.text);
      ts.forEachChild(node, visit);
    };
    visit(statement);
    own.set(statement.name.text, { classes, parts });
  }
  const all = new Map<string, Set<string>>();
  const collect = (name: string, seen: Set<string>): Set<string> => {
    const entry = own.get(name);
    if (!entry || seen.has(name)) return new Set();
    seen.add(name);
    const classes = new Set(entry.classes);
    for (const part of entry.parts) for (const cls of collect(part, seen)) classes.add(cls);
    return classes;
  };
  for (const name of own.keys()) all.set(name, collect(name, new Set()));
  return all;
}

/** Classes smaller than 20px at 1080p on purpose. None today on the three views. */
const SMALL_ON_PURPOSE: Readonly<Record<string, string>> = {};

const VIEWS = { "Bed meeting TV": "BedMeetingTvView", "Ward TV": "WardTvView", "ED TV (tea room)": "EdTvView" };

describe("M104: TV type sizes at 1920 by 1080", () => {
  it("lists and names reach 24px, the smallest words 20px and tile figures the 28px display step", () => {
    expect(TOKENS["--tv-row"]).toBeGreaterThanOrEqual(24);
    expect(TOKENS["--tv-small"]).toBeGreaterThanOrEqual(24);
    expect(TOKENS["--tv-body"]).toBeGreaterThanOrEqual(24);
    expect(TOKENS["--tv-least"]).toBeGreaterThanOrEqual(20);
    expect(TOKENS["--tv-figure"]).toBeGreaterThanOrEqual(28);
  });

  it("works sizes out as a browser would (control)", () => {
    expect(resolve("clamp(var(--wf-fs-14), 1.05vw, 1.5rem)", {})).toBeCloseTo(20.16, 1);
    expect(resolve("clamp(var(--wf-fs-14), 0.5vw, 1.5rem)", {})).toBe(14);
    expect(appliesAt1080p("(min-width: 200rem)")).toBe(false);
    expect(appliesAt1080p("(max-width: 1100px)")).toBe(false);
  });

  const sizes = sizesByClass();
  const classes = viewClasses();

  it.each(Object.entries(VIEWS))("%s draws nothing under 20px", (_view, fn) => {
    const drawn = classes.get(fn);
    expect(drawn?.size, `${fn} not found in ${TV_TSX}`).toBeGreaterThan(3);
    // Control: the sizes were worked out, so an empty list below is a real pass.
    expect([...drawn!].filter((cls) => sizes.has(cls)).length).toBeGreaterThanOrEqual(3);
    const small = [...drawn!].flatMap((cls) =>
      (sizes.get(cls) ?? [])
        .filter((size) => size.px < 20 && !(cls in SMALL_ON_PURPOSE))
        .map((size) => `${size.selector}: ${size.px.toFixed(1)}px`),
    );
    expect(small).toEqual([]);
  });

  it("draws every tile figure, counts and durations alike, at the 28px display step or more", () => {
    const drawing = Object.values(VIEWS).filter((fn) => classes.get(fn)!.has("tileValue"));
    expect(drawing.length, "no view draws tile figures any more").toBeGreaterThan(0);
    const figures = sizes.get("tileValue") ?? [];
    expect(figures.length).toBeGreaterThan(0);
    for (const size of figures) expect(size.px, size.selector).toBeGreaterThanOrEqual(28);
  });
});
