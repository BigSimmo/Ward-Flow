/**
 * Static font-size inventory, alongside (not instead of) the legacy token ratchet.
 * Resolves px/rem, font shorthands and simple var() alias/fallback chains. This is an
 * authoring check, not a browser cascade engine: em/%, calc() and inherited sizes
 * remain explicitly unresolved and need visual verification. rem assumes 16px.
 */
import postcss from "postcss";

export const FONT_TOKEN_FILES = ["src/app/globals.css", "src/app/ckb-v2-tokens.css", "src/app/ward-flow-v9-tokens.css"];
export const FONT_SHELL_TOKEN_FILE = "src/app/ward-flow-shell-tokens.module.css";

export const FONT_SWEEP_GLOBS = [
  "src/components/ward-management/**/*.css",
  "src/components/ward-flow-sign-in/**/*.css",
  "src/components/wf/**/*.css",
  "src/app/mockups/ward-flow*/**/*.css",
];

// Split only outside functions/strings: font-family spaces and var() fallbacks
// must not turn a line-height or fallback into the shorthand's font size.
function splitValue(value, separator) {
  const result = [];
  let start = 0;
  let depth = 0;
  let quote = "";
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (quote) {
      if (char === "\\") i += 1;
      else if (char === quote) quote = "";
    } else if (char === '"' || char === "'") quote = char;
    else if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    else if (depth === 0 && separator.test(char)) {
      if (i > start) result.push(value.slice(start, i));
      start = i + 1;
    }
  }
  if (start < value.length) result.push(value.slice(start));
  return result;
}

function lengthPx(value, tokens, seen = new Set()) {
  const text = value.trim();
  // These are lower bounds, sufficient to prove a 12px floor. Unknown relative
  // operands remain unresolved unless max()/clamp() supplies a known minimum.
  const sizing = /^(max|min|clamp)\(([\s\S]*)\)$/i.exec(text);
  if (sizing) {
    const sizes = splitValue(sizing[2], /,/).map((part) => lengthPx(part, tokens, seen));
    if (sizes.some(Number.isNaN)) return NaN;
    if (sizing[1] === "clamp") return sizes[0];
    const known = sizes.filter(Number.isFinite);
    if (sizing[1] === "max") return known.length ? Math.max(...known) : undefined;
    return known.length === sizes.length ? Math.min(...known) : undefined;
  }
  const length = /^([\d.]+)(px|rem)$/i.exec(text);
  if (length) return Number(length[1]) * (length[2].toLowerCase() === "rem" ? 16 : 1);
  const variable = /^var\(([\s\S]*)\)$/i.exec(text);
  if (!variable) return undefined;
  const [name, ...fallback] = splitValue(variable[1], /,/).map((part) => part.trim());
  // NaN marks a guaranteed-invalid variable (missing or cyclic), distinct from
  // a valid but unresolved relative size. Only the invalid one uses a fallback.
  if (seen.has(name)) return NaN;
  const next = new Set([...seen, name]);
  // A defined 12px token with an 11px fallback is 12px, not a violation.
  if (tokens.has(name)) {
    const values = tokens.get(name);
    const resolved = values.map((item) => lengthPx(item, tokens, next));
    const sizes = resolved.filter(Number.isFinite);
    // A finite branch cannot hide a relative branch that may render smaller than
    // the floor. Only a concrete below-floor value is safe to report immediately.
    if (sizes.some((size) => size < 12)) return Math.min(...sizes);
    if (resolved.some((item) => item === undefined)) return undefined;
    if (sizes.length) return Math.min(...sizes);
    if (resolved.every(Number.isNaN)) return fallback.length ? lengthPx(fallback.join(","), tokens, next) : NaN;
    return undefined;
  }
  return fallback.length ? lengthPx(fallback.join(","), tokens, next) : NaN;
}

function shorthandSize(value, tokens) {
  // CSS font syntax: optional style/variant/weight/stretch, size, /line-height,
  // then family. A family or a line-height must never be mistaken for size.
  const beforeLineHeight = splitValue(value, /\//)[0] ?? "";
  for (const token of splitValue(beforeLineHeight, /\s/)) {
    const size = lengthPx(token, tokens);
    if (Number.isFinite(size)) return size;
    if (/^(?:[\d.]+(?:em|%|vw|vh)|(?:calc|clamp|min|max)\()/i.test(token)) return undefined;
  }
  return undefined;
}

function isPrintOnly(node) {
  let parent = node.parent;
  while (parent) {
    if (parent.type === "atrule" && parent.name.toLowerCase() === "media") {
      const queries = splitValue(parent.params.replace(/\/\*[\s\S]*?\*\//g, " "), /,/);
      if (queries.length && queries.every((query) => /^(?:only\s+)?print(?:\s|$)/i.test(query.trim()))) return true;
    }
    parent = parent.parent;
  }
  return false;
}

function tokensIn(root) {
  const tokens = new Map();
  root.walkDecls(/^--/, (decl) => {
    if (!isPrintOnly(decl)) tokens.set(decl.prop, [...(tokens.get(decl.prop) ?? []), decl.value]);
  });
  return tokens;
}

export function inventoryFontSizes(stylesheets, tokenStylesheets = [], shellTokenStylesheets = []) {
  const inherited = new Map();
  for (const css of tokenStylesheets) {
    for (const [name, value] of tokensIn(postcss.parse(css))) inherited.set(name, value);
  }
  const shellTokens = new Map(inherited);
  for (const css of shellTokenStylesheets) {
    for (const [name, value] of tokensIn(postcss.parse(css))) shellTokens.set(name, value);
  }
  const findings = [];
  const unresolved = [];
  let declarations = 0;
  for (const [file, css] of stylesheets) {
    const root = postcss.parse(css, { from: file });
    // Route content inherits the scoped Ward shell floor. Standalone sign-in
    // and shared primitives can render outside it (including portalled menus),
    // so never assume the shell's 12px aliases for those files.
    const inWardShell = /^src\/(?:components\/ward-management\/|app\/mockups\/ward-flow\/)/.test(file);
    const tokens = new Map([...(inWardShell ? shellTokens : inherited), ...tokensIn(root)]);
    root.walkDecls(/^(font-size|font)$/i, (decl) => {
      if (isPrintOnly(decl)) return;
      declarations += 1;
      // Zero-size icon/text suppression is not a visible sub-floor label.
      if (decl.prop === "font-size" && /^0(?:px|rem)?$/.test(decl.value)) return;
      const sizePx =
        decl.prop.toLowerCase() === "font" ? shorthandSize(decl.value, tokens) : lengthPx(decl.value, tokens);
      const entry = {
        file,
        selector: decl.parent.selector ?? decl.parent.name ?? "",
        property: decl.prop.toLowerCase(),
        value: decl.value,
        line: decl.source.start.line,
      };
      if (!Number.isFinite(sizePx)) unresolved.push(entry);
      else if (sizePx < 12) findings.push({ ...entry, sizePx });
    });
  }
  return { findings, unresolved, declarations, files: stylesheets.size };
}

// Signatures include the selector and value: removing a historical 11px rule
// cannot fund a different 11px rule in the same file. Line shifts don't cause reds.
export function fontInventoryCounts(findings) {
  const counts = {};
  for (const finding of findings) {
    const key = JSON.stringify([finding.file, finding.selector, finding.property, finding.value, finding.sizePx]);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export function fontInventoryRises(findings, baselineCounts) {
  return Object.entries(fontInventoryCounts(findings))
    .filter(([key, count]) => count > (baselineCounts[key] ?? 0))
    .map(([key, count]) => ({ signature: JSON.parse(key), was: baselineCounts[key] ?? 0, now: count }));
}
