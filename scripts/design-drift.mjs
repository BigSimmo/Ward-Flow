#!/usr/bin/env node
/**
 * Design system v8 drift ratchet (design/v8/design-system-v8.md, section 10).
 *
 * Measures, per file, the values that bypass the v8 scales, and compares them with the committed
 * baseline in design/v8/drift-baseline.json. A count may fall and never rise. A file the baseline has
 * never seen starts at zero. `tests/design-system-v8-gates.test.ts` runs the check inside `npm test`,
 * so it runs in CI. This replaces the inherited drift-ratchet.json, which nothing ever read.
 *
 *   node scripts/design-drift.mjs            check, exit 1 on any rise
 *   node scripts/design-drift.mjs --write    re-baseline (only after a deliberate, reviewed fall)
 *
 * Metrics:
 *   rawFontSize        font-size or font shorthand with a literal length instead of a token
 *   rawZIndex          z-index that is not a --wf-z-* rung (0, 1, -1 and auto are allowed)
 *   offScaleMedia      a width media query not at 40rem, 48rem or 64rem
 *   bareOutlineNone    outline: none or 0 with no visible replacement in the same rule
 *   inlineStyle        style={{ in TSX
 *   inlineHex          a hex colour string literal in TSX
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const BASELINE_PATH = join(ROOT, "design/v8/drift-baseline.json");
export const METRICS = ["rawFontSize", "rawZIndex", "offScaleMedia", "bareOutlineNone", "inlineStyle", "inlineHex"];

// The token files define the scales, so they are not measured against them.
const SKIP = new Set(["src/app/ward-flow-tokens.css"]);
// Not UI: social preview images draw with literal colours by design.
const SKIP_TSX = [/opengraph-image\.tsx$/, /twitter-image\.tsx$/, /icon\.tsx$/, /apple-icon\.tsx$/];

const ALLOWED_WIDTHS = new Set(["40rem", "48rem", "64rem"]);
const ALLOWED_Z = new Set(["0", "1", "-1", "auto", "inherit", "initial", "unset"]);

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));

/** Leaf rules as { selector, body }, with media prelude kept separately. */
function rules(css) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css))) out.push({ selector: m[1].trim(), body: m[2] });
  return out;
}

const LENGTH = /(?:^|[\s/(,])-?\d*\.?\d+(?:px|rem|em|pt)\b/;

/** Counts for one CSS source. Exported for the control cases in the test. */
export function measureCss(source) {
  const css = stripComments(source);
  const counts = { rawFontSize: 0, rawZIndex: 0, offScaleMedia: 0, bareOutlineNone: 0 };
  for (const { body, selector } of rules(css)) {
    for (const decl of body.split(";")) {
      const at = decl.indexOf(":");
      if (at < 0) continue;
      const prop = decl.slice(0, at).trim().toLowerCase();
      const value = decl.slice(at + 1).trim();
      if (prop.startsWith("--")) continue;
      if (prop === "font-size" && !value.startsWith("var(") && LENGTH.test(` ${value}`)) counts.rawFontSize++;
      if (prop === "font") {
        // In the shorthand the size is the first word that is a length or a token; style and
        // weight words before it are bare numbers or keywords.
        const size = value
          .split(/\s+/)
          .find((word) => word.startsWith("var(") || LENGTH.test(` ${word.split("/")[0]}`));
        if (size && !size.startsWith("var(")) counts.rawFontSize++;
      }
      if (prop === "z-index" && !value.startsWith("var(") && !ALLOWED_Z.has(value.replace(/\s*!important/, "")))
        counts.rawZIndex++;
    }
    if (/outline\s*:\s*(none|0)\b/.test(body)) {
      const replaced = /box-shadow|border(-color)?\s*:|background|text-decoration/.test(body);
      const guarded = /:focus:not\(:focus-visible\)/.test(selector);
      if (!replaced && !guarded) counts.bareOutlineNone++;
    }
  }
  for (const m of css.matchAll(/@media([^{]+)\{/g)) {
    const widths = [...m[1].matchAll(/(?:min-|max-)?width\s*(?::|[<>]=?)\s*(-?[\d.]+(?:px|rem|em))/g)].map((w) => w[1]);
    if (widths.some((w) => !ALLOWED_WIDTHS.has(w))) counts.offScaleMedia++;
  }
  return counts;
}

export function measureTsx(source) {
  return {
    inlineStyle: (source.match(/style=\{\{/g) ?? []).length,
    // A hex colour anywhere inside a string literal, including a var() fallback.
    inlineHex: [...source.matchAll(/(["'`])((?:(?!\1)[^\n])*)\1/g)].reduce(
      (n, m) => n + (m[2].match(/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])/g) ?? []).length,
      0,
    ),
  };
}

/** Per-file counts for the whole of src/, zero counts left out. */
export function measureTree(root = ROOT) {
  const result = {};
  for (const file of walk(join(root, "src"))) {
    const rel = relative(root, file).split("\\").join("/");
    if (SKIP.has(rel)) continue;
    let counts = null;
    if (rel.endsWith(".css")) counts = measureCss(readFileSync(file, "utf8"));
    else if (rel.endsWith(".tsx") && !SKIP_TSX.some((re) => re.test(rel)))
      counts = measureTsx(readFileSync(file, "utf8"));
    if (!counts) continue;
    const kept = Object.fromEntries(Object.entries(counts).filter(([, n]) => n > 0));
    if (Object.keys(kept).length) result[rel] = kept;
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
}

/** Every per-file count that rose above its baseline. */
export function rises(current, baseline) {
  const out = [];
  for (const [file, counts] of Object.entries(current)) {
    for (const [metric, n] of Object.entries(counts)) {
      const was = baseline[file]?.[metric] ?? 0;
      if (n > was) out.push(`${file} ${metric}: ${was} to ${n}`);
    }
  }
  return out;
}

export function main(argv = process.argv.slice(2)) {
  const current = measureTree();
  if (argv.includes("--write")) {
    writeFileSync(BASELINE_PATH, JSON.stringify(current, null, 2) + "\n");
    console.log(`[design-drift] wrote ${relative(ROOT, BASELINE_PATH)}`);
    return 0;
  }
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  const up = rises(current, baseline);
  for (const line of up) console.error(`[design-drift] rose: ${line}`);
  if (!up.length) console.log("[design-drift] no file rose above its baseline");
  return up.length ? 1 : 0;
}

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedAsScript) process.exitCode = main();
