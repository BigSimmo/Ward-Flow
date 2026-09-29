#!/usr/bin/env node
/**
 * 🔴 **THE MOCKUP ↔ ROUTE ↔ SCREEN MAP, GENERATED — plus the three checks nobody was running.**
 *
 *     node scripts/ward-flow/screen-map.mjs           # write docs/ward-flow/SCREEN-MAP.md
 *     node scripts/ward-flow/screen-map.mjs --check   # fail on a stale map OR an unmapped item
 *
 * ⚠️ **THE PAIRING IS HAND-AUTHORED AND THAT IS DELIBERATE.** `command-third-edition.html` belongs
 * to route `/` and folder `coordinator/`; no rule derives that. **What is NOT hand-authored is
 * COMPLETENESS** — every mockup, commissioned route source and screen folder is discovered from disk, and anything not
 * in `PAIRS` is reported. So a new mockup, a new route, or a renamed file cannot go missing
 * quietly: it appears as UNMAPPED and `--check` fails.
 *
 * 🔴 **THE THIRD CHECK IS THE ONE THAT WOULD HAVE CAUGHT A REAL BUG MONTHS AGO.** `ed-home.tsx`
 * exists, is imported by nothing, and has no route — an entire screen a coordinator cannot reach.
 * Nothing in this repository looked for that shape. UNREACHABLE now does.
 */

import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { PAIRS, SUPERSEDED } from "./screen-pairs.mjs";

const ROOT = process.cwd();
const MOCKUPS = join(ROOT, "docs", "ward-flow", "mockups");
const ROUTE_SOURCES = [
  { root: join(ROOT, "src", "app", "mockups", "ward-flow"), prefix: "", file: "page.tsx" },
  // These two commissioned references live beside the Ward Flow page tree. Keep their public
  // paths explicit so the roster cannot imply they are children of the operational route root.
  { root: join(ROOT, "src", "app", "mockups", "ward-flow-sign-in"), prefix: "/mockups/ward-flow-sign-in", file: "page.tsx" },
  { root: join(ROOT, "src", "app", "mockups", "ward-flow-digest"), prefix: "/mockups/ward-flow-digest", file: "route.ts" },
];
const SCREENS = join(ROOT, "src", "components", "ward-management");
const OUT = join(ROOT, "docs", "ward-flow", "SCREEN-MAP.md");

const walk = (dir) =>
  !existsSync(dir)
    ? []
    : readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
      );

// `CONTACT-SHEET.html` is GENERATED from this directory, not a drawing in it. Excluded by name
// rather than by a pattern: this check caught its own first commit on that file, which is the
// gate working — but an exclusion that swallowed anything matching "sheet" would also swallow
// a real drawing called one day.
const GENERATED = new Set(["CONTACT-SHEET.html"]);
const mockups = existsSync(MOCKUPS)
  ? readdirSync(MOCKUPS)
      .filter((f) => f.endsWith(".html") && !GENERATED.has(f))
      .sort()
  : [];
const routes = ROUTE_SOURCES.flatMap(({ root, prefix, file }) =>
  walk(root)
    .filter((f) => f.endsWith(file))
    .map((f) => {
      const suffix = relative(root, f).split(/[\\/]/).slice(0, -1).join("/");
      if (prefix) return suffix ? `${prefix}/${suffix}` : prefix;
      return suffix ? `/${suffix}` : "/";
    }),
).sort();
const screenDirs = existsSync(SCREENS)
  ? readdirSync(SCREENS, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort()
  : [];

const mapped = { mockups: new Set(), routes: new Set(), screens: new Set() };
for (const [m, r, s] of PAIRS) {
  mapped.mockups.add(m);
  if (r) mapped.routes.add(r);
  if (s) mapped.screens.add(s);
}

const unmappedMockups = mockups.filter((m) => !mapped.mockups.has(m) && !SUPERSEDED.includes(m));
const unmappedRoutes = routes.filter((r) => !mapped.routes.has(r));
const missingRoutes = PAIRS.filter(([, r, , c]) => c && r && !routes.includes(r)).map(([m, r]) => `${r} (for ${m})`);
const missingMockups = PAIRS.filter(([m]) => !mockups.includes(m)).map(([m]) => m);

/** UNREACHABLE — a screen component nothing imports. The `ed-home.tsx` shape. */
const allSource = walk(join(ROOT, "src")).filter((f) => /\.(tsx|ts)$/.test(f));
const sourceText = new Map(allSource.map((f) => [f, readFileSync(f, "utf8")]));
const unreachable = [];
for (const f of allSource) {
  const base = f
    .split(/[\\/]/)
    .pop()
    .replace(/\.(tsx|ts)$/, "");
  if (!/-(screen|home|board|index|page)$/.test(base)) continue;
  if (!f.includes("ward-management")) continue;
  let imported = false;
  for (const [other, text] of sourceText) {
    if (other === f) continue;
    if (text.includes(`/${base}"`) || text.includes(`/${base}'`)) {
      imported = true;
      break;
    }
  }
  if (!imported) unreachable.push(relative(ROOT, f).split(/[\\/]/).join("/"));
}

const lines = [
  "# Ward Flow — mockup ↔ route ↔ screen",
  "",
  "> 🔴 **GENERATED. DO NOT EDIT BY HAND.** `node scripts/ward-flow/screen-map.mjs`; `--check` fails",
  "> on a stale map or an unmapped item.",
  "",
  `**${mockups.length} mockups · ${routes.length} routes · ${screenDirs.length} screen folders.**`,
  "",
  "⚠️ The PAIRING is hand-authored — no rule derives that `command-third-edition.html` is route `/`.",
  "**COMPLETENESS is not**: everything is discovered from disk, so a new or renamed file shows up as",
  "UNMAPPED rather than disappearing.",
  "",
  `## The ${PAIRS.filter(([, , , c]) => c).length} with a build contract`,
  "",
  "| Mockup | Route | Screen folder | Route exists |",
  "|---|---|---|---|",
  ...PAIRS.filter(([, , , c]) => c).map(
    ([m, r, s]) => `| \`${m}\` | \`${r}\` | \`${s}/\` | ${routes.includes(r) ? "yes" : "🔴 NO"} |`,
  ),
  "",
  "## Drawn, no build contract",
  "",
  "| Mockup | Route | Route exists |",
  "|---|---|---|",
  ...PAIRS.filter(([, , , c]) => !c).map(
    ([m, r]) => `| \`${m}\` | ${r ? `\`${r}\`` : "—"} | ${r ? (routes.includes(r) ? "yes" : "no") : "—"} |`,
  ),
  "",
  "## Superseded — never build from these",
  "",
  ...SUPERSEDED.map((s) => `- \`${s}\``),
  "",
];

const problems = [];
if (missingMockups.length) problems.push(["🔴 MAPPED MOCKUP NOT ON DISK — renamed or deleted", missingMockups]);
if (unmappedMockups.length) problems.push(["🔴 MOCKUP WITH NO ENTRY — add it to PAIRS", unmappedMockups]);
if (missingRoutes.length) problems.push(["🔴 BUILD-CONTRACT SCREEN WITH NO ROUTE", missingRoutes]);
if (unmappedRoutes.length) problems.push(["⚠️ ROUTE WITH NO MOCKUP — undrawn, or needs an entry", unmappedRoutes]);
// ⚠️ WARNING, NOT A HARD FAIL, AND THAT IS DELIBERATE. These are pre-existing. A gate that can
// never pass gets switched off, and then it protects nothing — which is its own recorded lesson.
// It stays LOUD in the document and does not block; staleness and a missing mapped file do block.
if (unreachable.length) problems.push(["⚠️ UNREACHABLE — a screen component nothing imports", unreachable]);

lines.push("## What the checks found", "");
if (!problems.length) lines.push("Nothing unmapped, nothing unreachable.", "");
for (const [title, items] of problems) {
  lines.push(`### ${title} — ${items.length}`, "");
  for (const i of items) lines.push(`- \`${i}\``);
  lines.push("");
}
lines.push(
  "⚠️ **An UNREACHABLE entry is not always a defect** — a component may be mounted by a route file",
  "this check cannot follow. **It is always worth opening.** `ed-home.tsx` was found exactly this way:",
  "a whole emergency-department index screen with no route and no importer.",
  "",
);

const text = lines.join("\n");

if (process.argv.includes("--check")) {
  const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  const normalizeRow = (l) => {
    l = l.replace(/\r/g, "");
    if (!l.startsWith("|")) return l.trim();
    const cols = l.split("|").slice(1, -1);
    return (
      "|" +
      cols
        .map((c) => {
          const trimmed = c.trim();
          return /^[-:]+$/.test(trimmed) ? "---" : trimmed;
        })
        .join("|") +
      "|"
    );
  };
  const normalize = (s) => s.split("\n").map(normalizeRow).join("\n").trim();
  const stale = normalize(current) !== normalize(text);
  const hard = problems.filter(([t]) => t.startsWith("🔴"));
  if (!stale && !hard.length) {
    console.log(`screen map is current — ${mockups.length} mockups, ${routes.length} routes, no hard problems.`);
    process.exit(0);
  }
  if (stale) console.error("screen map is STALE. Run: node scripts/ward-flow/screen-map.mjs");
  for (const [title, items] of hard) console.error(`${title}: ${items.join(", ")}`);
  process.exit(1);
}

writeFileSync(OUT, text, "utf8");
console.log(`wrote ${OUT} — ${mockups.length} mockups, ${routes.length} routes, ${problems.length} problem group(s).`);
