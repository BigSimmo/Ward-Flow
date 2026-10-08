#!/usr/bin/env node
/**
 * Two-way token sync between src/app/ward-flow-v6-tokens.css (the source of truth) and the Figma
 * file "Ward Flow v6 live". Figma Professional has no Variables REST API, so Claude reads and
 * writes the Figma side through the Figma MCP on Josh's device. This script only handles the code side.
 * Procedure: docs/agents/figma-sync.md. Map: design/figma/figma-sync.json.
 *
 *   node scripts/figma-tokens.mjs --export          write design/figma/tokens.json from the CSS
 *   node scripts/figma-tokens.mjs --diff <file>     print tokens in <file> that differ from the CSS
 *   node scripts/figma-tokens.mjs --apply <file>    write those differences back into the CSS
 *
 * Token JSON shape (export and Figma pull alike), keyed by CSS custom property name:
 *   { "Colour": { "Day": { "--wf-canvas": "#e8ecf0" }, "Night": { ... } }, "Size": { "--wf-r-xs": 6 } }
 * Colours may be hex, rgba() or Figma { r, g, b, a } floats. Sizes are px numbers.
 */
import { readFileSync, writeFileSync, mkdirSync, renameSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const CSS_PATH = resolve(ROOT, "src/app/ward-flow-v6-tokens.css");
export const TOKENS_PATH = resolve(ROOT, "design/figma/tokens.json");

// Figma-only helper variables. Code derives these with color-mix, so a pull never writes them.
const FIGMA_ONLY = [/^--wf-alpha-/, /^--wf-status-.+-(tint|edge)$/];

const norm = (selector) => selector.replace(/\s+/g, " ").trim();
const DAY = ":root, .day";
const NIGHT = [':root[data-theme="dark"], .night', ':root:not([data-theme="light"])'];
const DARK_MEDIA = "@media (prefers-color-scheme: dark)";

/** Leaf rule blocks with their selector path and body offsets. Comments are blanked, offsets kept. */
function blocks(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, (c) => " ".repeat(c.length));
  const out = [];
  const stack = [];
  let mark = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") {
      stack.push({ selector: norm(text.slice(mark, i)), start: i + 1, leaf: true });
      if (stack.length > 1) stack[stack.length - 2].leaf = false;
      mark = i + 1;
    } else if (ch === "}") {
      const block = stack.pop();
      if (block?.leaf)
        out.push({ path: [...stack.map((b) => b.selector), block.selector], start: block.start, end: i });
      mark = i + 1;
    } else if (ch === ";") {
      mark = i + 1;
    }
  }
  return { text, out };
}

function role(path) {
  const [outer, inner] = path.length === 1 ? [null, path[0]] : [path[0], path[path.length - 1]];
  if (!outer && inner === DAY) return "day";
  if (!outer && inner === ":root") return "shared";
  if ((!outer || outer === DARK_MEDIA) && NIGHT.includes(inner)) return "night";
  return null;
}

/** Every --wf-* declaration in the day, night and shared blocks, with its value offsets. */
export function parseCss(css) {
  const { text, out } = blocks(css);
  const decls = [];
  for (const block of out) {
    const where = role(block.path);
    if (!where) continue;
    const re = /(--wf-[\w-]+)\s*:\s*([^;]+);/g;
    re.lastIndex = block.start;
    let m;
    while ((m = re.exec(text)) && m.index < block.end) {
      const valueStart = m.index + m[0].indexOf(m[2], m[1].length);
      decls.push({ name: m[1], value: m[2].trim(), where, valueStart, valueEnd: valueStart + m[2].trimEnd().length });
    }
  }
  return decls;
}

/** Colour to [r, g, b, a] with a rounded to 2 places, or null if it is not a plain colour. */
export function toRgba(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const channels = [value.r, value.g, value.b, "a" in value ? value.a : 1];
    if (!channels.every((v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1)) return null;
    return channels.map((v, index) => (index === 3 ? Math.round(v * 100) / 100 : Math.round(v * 255)));
  }
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  let m = v.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((x) => x + x).join("");
    if (h.length !== 6 && h.length !== 8) return null;
    const n = (i) => parseInt(h.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), h.length === 8 ? Math.round((n(6) / 255) * 100) / 100 : 1];
  }
  m = v.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
  if (m) {
    if (v.startsWith("rgba(") !== (m[4] !== undefined)) return null;
    const channels = [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
    if (!channels.every((n, index) => Number.isFinite(n) && n >= 0 && n <= (index === 3 ? 1 : 255))) return null;
    return channels.map((n, index) => (index === 3 ? Math.round(n * 100) / 100 : Math.round(n)));
  }
  return null;
}

export function formatColour([r, g, b, a]) {
  if (a === 1) return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

const toPx = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const m = typeof value === "string" && value.trim().match(/^(-?[\d.]+)px$/);
  return m && Number.isFinite(+m[1]) ? +m[1] : null;
};

const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** Validate the complete import before computing edits or writing any CSS. Partial pulls are allowed. */
export function validateTokens(incoming) {
  const invalid = (location) => {
    throw new Error(`Invalid token import at ${location}`);
  };
  if (!record(incoming)) invalid("collections");
  if (Object.keys(incoming).some((key) => !["Colour", "Size"].includes(key))) invalid("collections");
  for (const group of ["Colour", "Size"]) {
    if (group in incoming && !record(incoming[group])) invalid(group);
  }
  if (incoming.Colour && Object.keys(incoming.Colour).some((key) => !["Day", "Night"].includes(key)))
    invalid("Colour modes");
  const check = (values, location, valid) => {
    if (values === undefined) return;
    if (!record(values)) invalid(location);
    for (const [name, value] of Object.entries(values)) {
      if (!/^--wf-[\w-]+$/u.test(name)) invalid(`${location} name`);
      if (FIGMA_ONLY.some((re) => re.test(name))) continue;
      if (!valid(value)) invalid(`${location}/${name}`);
    }
  };
  for (const mode of ["Day", "Night"]) check(incoming.Colour?.[mode], `Colour/${mode}`, (v) => toRgba(v) !== null);
  check(incoming.Size, "Size", (v) => toPx(v) !== null);
}

function writeAtomically(file, content) {
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    writeFileSync(temporary, content, { flag: "wx" });
    renameSync(temporary, file);
  } catch (error) {
    // Remove only the temporary file this invocation successfully created.
    if (error.code !== "EEXIST") {
      try {
        unlinkSync(temporary);
      } catch {
        /* Already renamed or not created. */
      }
    }
    throw error;
  }
}

/** The CSS as Figma collections: Colour (Day, Night) and Size. Gradients, shadows and refs stay code-only. */
export function exportTokens(css) {
  const decls = parseCss(css);
  const tokens = { Colour: { Day: {}, Night: {} }, Size: {} };
  for (const d of decls) {
    if (d.where === "night") continue;
    const rgba = toRgba(d.value);
    if (rgba) {
      tokens.Colour.Day[d.name] = formatColour(rgba);
      tokens.Colour.Night[d.name] = formatColour(rgba);
    } else if (toPx(d.value) !== null) {
      tokens.Size[d.name] = toPx(d.value);
    }
  }
  for (const d of decls) {
    const rgba = d.where === "night" && toRgba(d.value);
    if (rgba) tokens.Colour.Night[d.name] = formatColour(rgba);
  }
  return tokens;
}

function sameColour(a, b) {
  const [x, y] = [toRgba(a), toRgba(b)];
  return !!x && !!y && x.every((v, i) => v === y[i]);
}

/** Tokens in `incoming` whose value differs from the CSS, plus names the CSS does not have. */
export function diffTokens(css, incoming) {
  validateTokens(incoming);
  const current = exportTokens(css);
  const changes = [];
  const unknown = [];
  const compare = (group, mode, have, want, same) => {
    for (const [name, value] of Object.entries(want ?? {})) {
      if (FIGMA_ONLY.some((re) => re.test(name))) continue;
      if (!(name in have)) {
        unknown.push(`${group}${mode ? `/${mode}` : ""} ${name}`);
        continue;
      }
      if (!same(have[name], value)) changes.push({ group, mode, name, from: have[name], to: value });
    }
  };
  for (const mode of ["Day", "Night"]) {
    compare("Colour", mode, current.Colour[mode], incoming.Colour?.[mode], sameColour);
  }
  compare("Size", null, current.Size, incoming.Size, (a, b) => a === toPx(b));
  return { changes, unknown };
}

/** Write the changed values into the CSS. Returns the new CSS and any changes it could not place. */
export function applyTokens(css, incoming) {
  const { changes } = diffTokens(css, incoming);
  const decls = parseCss(css);
  const edits = [];
  const skipped = [];
  for (const c of changes) {
    const value = c.group === "Size" ? `${toPx(c.to)}px` : formatColour(toRgba(c.to));
    const night = decls.filter((d) => d.name === c.name && d.where === "night");
    const base = decls.filter((d) => d.name === c.name && d.where !== "night");
    const targets = c.mode === "Night" ? night : base;
    if (!targets.length) {
      skipped.push(`${c.name} (${c.mode}): the CSS has no separate ${c.mode} value to change`);
      continue;
    }
    // A colour with no night declaration serves both modes, so a Day edit would also change Night.
    const wantNight = incoming.Colour?.Night?.[c.name];
    if (c.mode === "Day" && !night.length && wantNight !== undefined && !sameColour(wantNight, c.to)) {
      skipped.push(`${c.name} (Day): Figma has different Day and Night values but the CSS holds one for both`);
      continue;
    }
    for (const t of targets) edits.push({ ...t, value });
  }
  let out = css;
  for (const e of edits.sort((a, b) => b.valueStart - a.valueStart)) {
    out = out.slice(0, e.valueStart) + e.value + out.slice(e.valueEnd);
  }
  return { css: out, applied: changes.length - skipped.length, skipped };
}

const show = (v) => (typeof v === "object" ? JSON.stringify(v) : String(v));

export function main(argv = process.argv.slice(2), { stdout = console.log, stderr = console.error } = {}) {
  try {
    const [flag, file] = argv;
    const css = readFileSync(CSS_PATH, "utf8");
    if (flag === "--export") {
      mkdirSync(dirname(TOKENS_PATH), { recursive: true });
      writeAtomically(TOKENS_PATH, JSON.stringify(exportTokens(css), null, 2) + "\n");
      stdout(`[figma-tokens] wrote ${TOKENS_PATH.slice(ROOT.length + 1)}`);
      return 0;
    }
    if ((flag === "--diff" || flag === "--apply") && file) {
      const incoming = JSON.parse(readFileSync(resolve(file), "utf8"));
      const { changes, unknown } = diffTokens(css, incoming);
      for (const c of changes) {
        stdout(`${c.group}${c.mode ? `/${c.mode}` : ""} ${c.name}: ${show(c.from)} to ${show(c.to)}`);
      }
      for (const u of unknown) stdout(`not in code, ignored: ${u}`);
      if (!changes.length) stdout("[figma-tokens] no token changes");
      if (flag === "--apply" && changes.length) {
        const result = applyTokens(css, incoming);
        writeAtomically(CSS_PATH, result.css);
        for (const s of result.skipped) stderr(`[figma-tokens] skipped ${s}`);
        stdout(`[figma-tokens] applied ${result.applied} change(s) to src/app/ward-flow-v6-tokens.css`);
      }
      return 0;
    }
    stderr("usage: node scripts/figma-tokens.mjs --export | --diff <file> | --apply <file>");
    return 2;
  } catch (error) {
    stderr(
      `[figma-tokens] ${error.message.startsWith("Invalid token import") ? error.message : "Import or file operation failed"}`,
    );
    return 1;
  }
}

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedAsScript) process.exitCode = main();
