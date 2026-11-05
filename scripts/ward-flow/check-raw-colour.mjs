/**
 * Raw-colour ratchet (Q375, 3 Nov 2026). Ward Flow's design system of record is
 * docs/design/DESIGN-SYSTEM.md, and colour values live only in src/app/ward-flow-v9-tokens.css.
 * A raw hex, rgb() or hsl() colour in a screen stylesheet is a defect, so no file may gain one.
 *
 * Counts per file, so a file that drops its colours cannot donate headroom to another.
 * A new file starts at zero.
 *
 *   node scripts/ward-flow/check-raw-colour.mjs                    check
 *   node scripts/ward-flow/check-raw-colour.mjs --update-baseline  lower the baseline to today (never raises)
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const baselinePath = join(scriptDir, "raw-colour-baseline.json");
const repo = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();

const SWEEP_GLOBS = ["src/components/**/*.css", "src/app/**/*.css"];
// The token layers are where colour is meant to be declared; see DESIGN-SYSTEM.md "Token files".
const TOKEN_FILES = new Set([
  "src/app/ward-flow-v9-tokens.css",
  "src/app/ckb-v2-tokens.css",
  "src/app/ward-flow-shell-tokens.module.css",
  "src/app/globals.css",
]);
const MINIMUM_FILES_SWEPT = 50;

const DECLARATION = /[a-z-]+\s*:\s*([^;{}]+)/gi;
const COLOUR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/gi;

function countRawColours(css) {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  if (stripped.includes("/*")) throw new Error("unterminated comment");
  let count = 0;
  for (const [, value] of stripped.matchAll(DECLARATION)) count += value.match(COLOUR)?.length ?? 0;
  return count;
}

const SPECIMEN =
  "/* #fff */ .a { color: #fff; background: rgb(0 0 0 / 50%); } .b:hover { border: 1px solid var(--wf-line); }";
if (countRawColours(SPECIMEN) !== 2) {
  console.error("[raw-colour] REFUSED: the matcher failed its specimen. Fix the matcher, do not re-baseline.");
  process.exit(2);
}

const files = execFileSync("git", ["ls-files", "--", ...SWEEP_GLOBS.map((glob) => `:(glob)${glob}`)], {
  cwd: repo,
  encoding: "utf8",
})
  .split("\n")
  .filter((file) => file && !TOKEN_FILES.has(file) && !file.includes("mockup"))
  .sort();

if (files.length < MINIMUM_FILES_SWEPT) {
  console.error(`[raw-colour] REFUSED: swept only ${files.length} stylesheets; the globs are broken.`);
  process.exit(2);
}

const current = {};
for (const file of files) {
  const count = countRawColours(readFileSync(join(repo, file), "utf8"));
  if (count > 0) current[file] = count;
}

const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const ceilings = baseline.files ?? {};

if (process.argv.includes("--update-baseline")) {
  const next = {};
  // A file with no ceiling has a ceiling of zero, so updating can never legitimise a new colour.
  for (const [file, count] of Object.entries(current)) {
    const ceiling = Math.min(count, ceilings[file] ?? 0);
    if (ceiling > 0) next[file] = ceiling;
  }
  writeFileSync(baselinePath, `${JSON.stringify({ ...baseline, files: next }, null, 2)}\n`);
  console.log(`[raw-colour] baseline written: ${Object.keys(next).length} files.`);
  process.exit(0);
}

const rises = Object.entries(current).filter(([file, count]) => count > (ceilings[file] ?? 0));
const total = Object.values(current).reduce((sum, count) => sum + count, 0);
if (rises.length > 0) {
  console.error("[raw-colour] Raw colours rose. Use a --wf-* token from src/app/ward-flow-v9-tokens.css instead:");
  for (const [file, count] of rises) console.error(`  ${file}: ${ceilings[file] ?? 0} -> ${count}`);
  process.exit(1);
}
console.log(`[raw-colour] Swept ${files.length} stylesheets; ${total} raw colours left. Not risen in any file.`);
