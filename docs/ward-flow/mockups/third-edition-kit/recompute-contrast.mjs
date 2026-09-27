// Usage: node recompute-contrast.mjs [file] [--write]
// Reads the light and dark token values from the file's own <style> (bare :root and
// :root[data-theme="dark"]), recomputes every #contrastTable row with WCAG relative luminance,
// and compares the recomputed figures with contrast-pairs.json (this script's sibling file).
//
// By default this is READ-ONLY: it audits the page and prints the results but does not modify
// it. Pass --write to have it overwrite data-light, data-dark and the printed cells in place —
// auditing and rewriting are deliberately separate actions so a re-run after a real regression
// cannot quietly absorb the bad numbers into the page it is supposed to be checking.
//
// Exits non-zero (and prints why) if any pair is below the 4.5:1 floor in either theme, or if
// any recomputed row disagrees with contrast-pairs.json. Exits 0 only when every pair clears the
// floor and every row matches the reference file.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const kitDir = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2).filter((a) => a !== "--write");
const write = process.argv.includes("--write");
const file = args[0] || path.join(kitDir, "..", "design-system-third-edition.html");
const contrastPairsPath = path.join(kitDir, "contrast-pairs.json");

let html = fs.readFileSync(file, "utf8");
const style = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
function block(re) {
  const m = style.match(re);
  if (!m) throw new Error("token block not found: " + re);
  const s = style.indexOf("{", m.index) + 1;
  let d = 1,
    i = s;
  for (; i < style.length && d; i++) {
    if (style[i] === "{") d++;
    else if (style[i] === "}") d--;
  }
  return style.slice(s, i - 1);
}
function tokens(text) {
  const t = {};
  for (const m of text.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) t[m[1]] = m[2].trim();
  return t;
}
const light = tokens(block(/(^|\n)\s*:root\s*\{/)),
  dark = tokens(block(/:root\[data-theme="dark"\]\s*\{/));
const resolve = (t, name, depth = 0) => {
  const v = t[name];
  if (v === undefined) return undefined;
  const a = v.match(/^var\(--([\w-]+)\)$/);
  return a && depth < 5 ? resolve(t, a[1], depth + 1) : v;
};
const lum = (hex) => {
  const h = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const c = [0, 2, 4].map((i) => {
    const v = parseInt(h.substr(i, 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const la = lum(a),
    lb = lum(b);
  if (la === null || lb === null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};
const r2 = (v) => Math.round(v * 100) / 100;
// Printed to one decimal, rounded half up from the two decimal figure, the same rounding the mockup's preamble and the markdown use.
const fmt1 = (v) => (Math.round(v * 10 + 1e-6) / 10).toFixed(1);
const cell = (v) => (v < 4.5 ? `<b>${fmt1(v)}:1, below the floor</b>` : `${fmt1(v)}:1`);
const t0 = html.indexOf('id="contrastTable"'),
  t1 = html.indexOf("</table>", t0);
let table = html.slice(t0, t1);
let rows = 0,
  below = [],
  changed = 0;
const out = [];
table = table.replace(
  /<tr([^>]*?)data-a="([\w-]+)"\s+data-b="([\w-]+)"([^>]*)>([\s\S]*?)<\/tr>/g,
  (whole, pre, a, b, post, inner) => {
    const la = resolve(light, a),
      lb = resolve(light, b),
      da = resolve(dark, a),
      db = resolve(dark, b);
    const vl = ratio(la, lb),
      vd = ratio(da, db);
    if (vl === null || vd === null) {
      console.log("skip (not a hex pair):", a, b, la, lb, da, db);
      return whole;
    }
    rows++;
    const L = r2(vl),
      D = r2(vd);
    out.push({ a, b, light: L, dark: D });
    if (L < 4.5 || D < 4.5) below.push(`${a} on ${b} light ${L} dark ${D}`);
    let attrs = (pre + post).replace(/\s*data-(light|dark|below)="[^"]*"/g, "").trim();

    attrs =
      ` data-a="${a}" data-b="${b}"` +
      (attrs ? " " + attrs : "") +
      ` data-light="${L.toFixed(2)}" data-dark="${D.toFixed(2)}"` +
      (L < 4.5 || D < 4.5 ? ' data-below="true"' : "");
    let k = 0;
    const newInner = inner.replace(/<td class="n">[\s\S]*?<\/td>/g, (m) => {
      k++;
      return k === 1 ? `<td class="n">${cell(L)}</td>` : k === 2 ? `<td class="n">${cell(D)}</td>` : m;
    });
    const row = `<tr${attrs}>${newInner}</tr>`;
    if (row !== whole) changed++;
    return row;
  },
);
if (write) {
  html = html.slice(0, t0) + table + html.slice(t1);
  fs.writeFileSync(file, html);
} else if (changed > 0) {
  console.log(`(read-only: ${changed} row(s) would change on the page; re-run with --write to apply)`);
}
const ref = JSON.parse(fs.readFileSync(contrastPairsPath, "utf8"));
const key = (p) => p.a + "|" + p.b;
const refMap = new Map(ref.map((p) => [key(p), p]));
const diffs = [];
for (const p of out) {
  const q = refMap.get(key(p));
  if (!q) diffs.push(`${p.a} on ${p.b}: not in contrast-pairs.json`);
  else if (Math.abs(q.light - p.light) > 0.005 || Math.abs(q.dark - p.dark) > 0.005)
    diffs.push(`${p.a} on ${p.b}: page ${p.light}/${p.dark}, json ${q.light}/${q.dark}`);
}
for (const q of ref)
  if (!out.some((p) => key(p) === key(q))) diffs.push(`${q.a} on ${q.b}: in contrast-pairs.json but not in the table`);
console.log(
  `${file}: ${rows} rows recomputed from the page's own tokens, ${changed} rows differ from what is on the page${write ? " (written)" : " (not written — read-only)"}, ${out.length} compared with contrast-pairs.json (${ref.length} entries).`,
);
console.log("below 4.5:1 in either theme:", below.length ? below.join("; ") : "none");
console.log("differences from contrast-pairs.json:", diffs.length ? "\n  " + diffs.join("\n  ") : "none");

if (below.length > 0 || diffs.length > 0) {
  console.error(
    `FAIL: ${below.length} pair(s) below 4.5:1, ${diffs.length} row(s) disagreeing with contrast-pairs.json.`,
  );
  process.exitCode = 1;
} else {
  process.exitCode = 0;
}
