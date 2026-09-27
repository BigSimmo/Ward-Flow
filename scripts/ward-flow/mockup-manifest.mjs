#!/usr/bin/env node
/**
 * 🔴 **THE MOCKUP HASH MANIFEST — makes a drawing edit as visible as a code change.**
 *
 *     node scripts/ward-flow/mockup-manifest.mjs           # write docs/ward-flow/mockups/MANIFEST.json
 *     node scripts/ward-flow/mockup-manifest.mjs --check   # exit 1 if the committed manifest disagrees with disk
 *
 * The mockups in `docs/ward-flow/mockups/` are now AUTHORITATIVE on design. Until this manifest
 * existed, a drawing could be edited — accidentally or by an agent that thought it was helping —
 * and nothing would notice. `--check` makes that as loud as a failing test.
 *
 * ⚠️ **Hashing normalises CRLF → LF first.** Git can normalise line endings on checkout, so a hash
 * over raw bytes would be correct in this worktree and wrong in a fresh checkout, making `--check`
 * permanently red for the next person for a change that carries no design content. Normalising
 * first makes the hash checkout-independent; a pure line-ending change does not fire the check.
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const MOCKUPS = join(ROOT, "docs", "ward-flow", "mockups");
const OUT = join(MOCKUPS, "MANIFEST.json");

// `CONTACT-SHEET.html` is GENERATED from this directory, not a drawing in it. Excluded by name
// rather than by a pattern: an exclusion broad enough to swallow a future real drawing (e.g.
// `/sheet/i`) is worse than no exclusion. Same reasoning as `scripts/ward-flow/screen-map.mjs`.
const GENERATED = new Set(["CONTACT-SHEET.html"]);

const mockups = existsSync(MOCKUPS)
  ? readdirSync(MOCKUPS, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".html") && !GENERATED.has(e.name))
      .map((e) => e.name)
      .sort()
  : [];

/** sha256-lf: read as a Buffer, replace every CRLF byte pair with LF, sha256 the result, hex, lowercase. */
async function hashFile(path) {
  const { createHash } = await import("node:crypto");
  const raw = readFileSync(path);
  const normalized = Buffer.from(raw.toString("binary").split("\r\n").join("\n"), "binary");
  return createHash("sha256").update(normalized).digest("hex");
}

const hashes = {};
for (const m of mockups) {
  hashes[m] = await hashFile(join(MOCKUPS, m));
}

const manifest = {
  algorithm: "sha256-lf",
  mockups: hashes,
};

const text = JSON.stringify(manifest, null, 2) + "\n";

if (process.argv.includes("--check")) {
  const remediation = "Run: node scripts/ward-flow/mockup-manifest.mjs";
  if (!existsSync(OUT)) {
    console.error("mockup manifest is MISSING.");
    console.error(remediation);
    process.exit(1);
  }
  const current = readFileSync(OUT, "utf8");

  let recorded;
  try {
    recorded = JSON.parse(current);
  } catch {
    console.error("manifest is STALE — not valid JSON.");
    console.error(remediation);
    process.exit(1);
  }

  const recordedMockups = recorded && typeof recorded.mockups === "object" && recorded.mockups !== null
    ? recorded.mockups
    : {};
  const recordedFiles = new Set(Object.keys(recordedMockups));
  const diskFiles = new Set(mockups);

  const problems = [];
  for (const f of mockups) {
    if (!recordedFiles.has(f)) {
      console.error(`NEW: ${f}`);
      problems.push(f);
    } else if (recordedMockups[f] !== hashes[f]) {
      console.error(`CHANGED: ${f}`);
      problems.push(f);
    }
  }
  for (const f of recordedFiles) {
    if (!diskFiles.has(f)) {
      console.error(`GONE: ${f}`);
      problems.push(f);
    }
  }

  const staleFormatting = !problems.length && current !== text;
  if (staleFormatting) {
    console.error("manifest is STALE.");
  }

  if (problems.length || staleFormatting) {
    console.error(remediation);
    process.exit(1);
  }

  console.log(`mockup manifest is current - ${mockups.length} drawings.`);
  process.exit(0);
}

writeFileSync(OUT, text, "utf8");
console.log(`wrote ${OUT} — ${mockups.length} drawings.`);
