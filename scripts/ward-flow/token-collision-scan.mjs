#!/usr/bin/env node
/**
 * Two different token names landing on the SAME colour, in the same stylesheet,
 * on a fill property — the defect class no other gate in this repo can see.
 *
 * Nothing anywhere compares two design tokens for equality. So a chart can paint
 * two adjacent segments identically, or a stylesheet can use a `--ward-*` alias in
 * one rule and reach past it to the token that alias points at in another, and every
 * gate stays green because each token exists and each one resolves.
 *
 * ⚠️ TWO THINGS MAKE THIS PROBE HONEST, AND IT IS USELESS WITHOUT EITHER.
 *
 * 1. IT RESOLVES IN BOTH PALETTES AND REQUIRES AGREEMENT IN BOTH. A light-only run
 *    over this repo reports 30 groups, of which 21 are false: tokens that are all
 *    #ffffff in light and diverge correctly in dark. Requiring both cuts it to 9.
 *
 * 2. IT PROVES ITSELF BEFORE REPORTING. `--self-test` runs three planted cases —
 *    a real collision, a clean pair, and a dark-only collision — and refuses to
 *    report if any verdict is wrong. A detector whose clean result has never been
 *    contrasted with a known-bad input has not measured anything.
 *
 * Dark mode in this app is a CLASS (.dark / .ckb-v2.dark.ckb-v2), NOT a
 * prefers-color-scheme media query. Resolving it as a media query silently returns
 * the light palette for both modes, which reads as "no collisions differ by theme".
 *
 * Precedence: ckb-v2-tokens.css wins on the ~105 names it and globals.css BOTH
 * declare (`.ckb-v2.ckb-v2` is (0,2,0) against `:root`'s (0,1,0), and src/app/layout.tsx
 * puts `ckb-v2` on the root element). globals.css is authoritative for the 204 names
 * it alone declares — 33 of which the ward layer uses today. Neither file "always wins".
 *
 * Usage:  node scripts/ward-flow/token-collision-scan.mjs [--self-test]
 * Exit 0 clean, 1 collisions found, 2 the probe could not be trusted.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const TOKEN_FILES = [
  "src/app/globals.css",
  "src/app/ckb-v2-tokens.css",
  "src/components/ward-management/ward-tokens.module.css",
];
const SCAN_ROOT = "src/components/ward-management";
const FILL = /^(background|background-color|fill|stroke)$/;
const FLOOR_FILES = 40;
const FLOOR_DECLS = 100;
const LIGHT_ONLY = process.argv.includes("--light-only");

function readDefs(file, mode) {
  const src = fs.readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const light = new Map();
  const dark = new Map();
  let depth = 0;
  let blockAt = -1;
  let kind = null;
  for (const raw of src.split("\n")) {
    const line = raw.trim();
    const opens = /\{\s*$/.test(line);
    const isMedia = opens && /^@/.test(line);
    const isDark = opens && !isMedia && /(^|[^a-z-])\.dark([^a-z-]|$)/.test(line);
    const d = /^(--[a-z0-9-]+)\s*:\s*([^;]+);/i.exec(line);
    if (d) {
      if (blockAt === -1) {
        if (!light.has(d[1])) light.set(d[1], d[2].trim());
      } else if (kind === "dark") dark.set(d[1], d[2].trim());
    }
    for (const ch of raw) {
      if (ch === "{") {
        depth++;
        if (blockAt === -1 && (isMedia || isDark)) {
          blockAt = depth;
          kind = isMedia ? "media" : "dark";
        }
      } else if (ch === "}") {
        if (blockAt === depth) {
          blockAt = -1;
          kind = null;
        }
        depth--;
      }
    }
  }
  if (mode === "light") return light;
  const merged = new Map(light);
  for (const [k, v] of dark) merged.set(k, v);
  return merged;
}

function resolver(mode) {
  const maps = TOKEN_FILES.map((f) => readDefs(f, mode));
  const lookup = (n) => {
    for (let i = maps.length - 1; i >= 0; i--) if (maps[i].has(n)) return maps[i].get(n);
    return undefined;
  };
  const resolve = (val, depth = 0) => {
    if (depth > 8) return null;
    const m = /^var\((--[a-z0-9-]+)\)$/.exec(String(val).trim());
    if (!m) return /^(#|rgb|hsl)/i.test(String(val).trim()) ? String(val).trim().toLowerCase() : null;
    const next = lookup(m[1]);
    return next === undefined ? null : resolve(next, depth + 1);
  };
  return resolve;
}

const RL = resolver("light");
const RD = resolver("dark");

export function scan(files) {
  let decls = 0;
  let resolved = 0;
  const groups = [];
  for (const f of files) {
    const src = fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const byPair = new Map();
    let sel = null;
    for (const line of src.split("\n")) {
      const s = /^([.#&:[][^{]*?)\s*\{\s*$/.exec(line.trim());
      if (s) {
        sel = s[1].trim();
        continue;
      }
      const d = /^([a-z-]+)\s*:\s*(var\(--[a-z0-9-]+\))\s*;?$/i.exec(line.trim());
      if (!d) continue;
      decls++;
      if (!FILL.test(d[1])) continue;
      const l = RL(d[2]);
      const k = RD(d[2]);
      if (!l || !k) continue;
      resolved++;
      // LIGHT_ONLY keeps the NAIVE count reproducible. The evidence doc claims a light-only
      // run returns 30 groups of which 21 are false; a figure nobody can re-derive is exactly
      // what this file argues against, so the rejected mode stays runnable.
      const key = LIGHT_ONLY ? l : l + " | " + k;
      const token = /var\((--[a-z0-9-]+)\)/.exec(d[2])[1];
      if (!byPair.has(key)) byPair.set(key, new Map());
      const bag = byPair.get(key);
      bag.set(token, (bag.get(token) ?? []).concat(sel));
    }
    for (const [key, tokens] of byPair) {
      if (tokens.size < 2) continue;
      groups.push({ file: f.split(path.sep).join("/"), key, tokens });
    }
  }
  return { decls, resolved, groups };
}

function selfTest() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tokenscan-"));
  const write = (n, body) => {
    const p = path.join(dir, n);
    fs.writeFileSync(p, body);
    return p;
  };
  const cases = [
    [
      "known-bad   (--ward-border-strong vs --ward-muted, equal in BOTH)",
      1,
      write(
        "bad.css",
        ".alpha {\n  background: var(--ward-border-strong);\n}\n.beta {\n  background: var(--ward-muted);\n}\n",
      ),
    ],
    [
      "known-good  (--ward-success vs --ward-danger)",
      0,
      write(
        "good.css",
        ".alpha {\n  background: var(--ward-success);\n}\n.beta {\n  background: var(--ward-danger);\n}\n",
      ),
    ],
    [
      "dark-only   (--surface-raised vs --surface-subtle, equal in dark ONLY)",
      0,
      write(
        "dark.css",
        ".alpha {\n  background: var(--surface-raised);\n}\n.beta {\n  background: var(--surface-subtle);\n}\n",
      ),
    ],
  ];
  let ok = true;
  for (const [label, expected, file] of cases) {
    const got = scan([file]).groups.length;
    const pass = got === expected;
    if (!pass) ok = false;
    console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}  expected ${expected}, got ${got}`);
  }
  fs.rmSync(dir, { recursive: true, force: true });
  return ok;
}

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".css")) files.push(p);
  }
})(SCAN_ROOT);

if (process.argv.includes("--self-test")) {
  console.log("Self-test — the probe must discriminate before any result is trusted:");
  if (!selfTest()) {
    console.error("PROBE NOT TRUSTWORTHY — a clean scan would prove nothing.");
    process.exit(2);
  }
  console.log("Probe proven.\n");
}

const r = scan(files);
console.log(
  LIGHT_ONLY
    ? "MODE: --light-only — the NAIVE count this probe REJECTS, kept runnable. Not the verdict."
    : "MODE: both palettes must agree — the verdict.",
);
console.log(
  `floor: files=${files.length} decls=${r.decls} fillDeclsResolvedInBothModes=${r.resolved} groups=${r.groups.length}`,
);
if (files.length < FLOOR_FILES || r.resolved < FLOOR_DECLS) {
  console.error(
    `FLOOR BREACHED — the probe walked too little to mean anything (need >=${FLOOR_FILES} files, >=${FLOOR_DECLS} resolved).`,
  );
  process.exit(2);
}
for (const g of r.groups) {
  console.log(`\n${g.file}   light/dark ${g.key}`);
  for (const [t, sels] of g.tokens) console.log(`    ${t}  ->  ${sels.join(" , ")}`);
}
process.exit(r.groups.length === 0 ? 0 : 1);
