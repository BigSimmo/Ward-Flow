#!/usr/bin/env node
/**
 * 🔴 **THE VERIFICATION RECORD, GENERATED — the write-up of who actually LOOKED at a screen.**
 *
 *     node scripts/ward-flow/screen-verification.mjs           # write docs/ward-flow/SCREEN-VERIFICATION.md
 *     node scripts/ward-flow/screen-verification.mjs --check   # fail on a stale page or a broken JSON record
 *
 * The previous Ward Flow build produced sixteen screens that pass thousands of tests and do not
 * look like their mockups. `docs/ward-flow/SCREEN-DEFINITION-OF-DONE.md` §② now requires somebody
 * to look — at 390px, 820px and 1440px, light and dark. Until this file existed, there was nowhere
 * to write down that they did. `docs/ward-flow/screen-verification.json` is that record, hand-edited
 * by whoever does the looking; this script renders it and checks it is not lying to itself.
 *
 * 🔴 **READ THIS TWICE BEFORE TOUCHING `--check`.** It fails on STRUCTURAL problems in the JSON —
 * a missing roster row, a malformed entry, a stale generated page — and on NOTHING ELSE. It does
 * **not** fail because a screen is unverified, because a verification has gone stale against the
 * mockup manifest, or because the mockup manifest does not exist yet. Today every screen is
 * unverified — that is the entire reason this file exists. A gate that failed on that fact would
 * be red from the moment it was born, and a gate that can never pass gets switched off and then
 * protects nothing. Unverified and stale are made LOUD in the generated document instead, and left
 * completely silent in the exit code. The next person will be tempted to "fix" this by making
 * `--check` red for an unverified screen — that is exactly the change that kills the gate.
 *
 * 🔴 **WF-35 — "CURRENT" used to mean only "the drawing's hash matches"**, not "the built screen
 * matches its drawing" — no source file was ever compared. Several rows read "deviates | CURRENT"
 * at once: a screen KNOWN not to match its drawing, reported current. The word CURRENT is retired;
 * `scripts/ward-flow/screen-verification-lib.mjs` now answers two separate questions —
 * `drawingStatus` (has the drawing moved since the last look) and `implementationFiles` /
 * `implementationSha256` / `implementationStatus` (has the BUILT screen moved since the last
 * look). The implementation hash is never written into this generated page's staleness check —
 * only `--report` and `--hash <mockup>` compute it, on demand — so editing a component can never
 * make `SCREEN-VERIFICATION.md` stale.
 *
 *     node scripts/ward-flow/screen-verification.mjs --report        # live implementation status per screen, always exits 0
 *     node scripts/ward-flow/screen-verification.mjs --hash <mockup> # print that screen's current implementation hash, to paste into the JSON
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PAIRS } from "./screen-pairs.mjs";
import { drawingStatus, implementationFiles, implementationSha256, implementationStatus } from "./screen-verification-lib.mjs";

const ROOT = process.cwd();
const JSON_PATH = join(ROOT, "docs", "ward-flow", "screen-verification.json");
const MANIFEST_PATH = join(ROOT, "docs", "ward-flow", "mockups", "MANIFEST.json");
const OUT = join(ROOT, "docs", "ward-flow", "SCREEN-VERIFICATION.md");
const REMEDIATION = "Run: node scripts/ward-flow/screen-verification.mjs";

/** The roster: every mockup that actually has a build contract, in the order screen-map.mjs lists them. */
const ROSTER = PAIRS.filter(([, , , contract]) => contract).map(([mockup, route, folder]) => ({ mockup, route, folder }));
const ROSTER_MOCKUPS = new Set(ROSTER.map((r) => r.mockup));

const VERDICTS = new Set(["matches", "deviates", "blocked"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function fail(message) {
  console.error(message);
  console.error(REMEDIATION);
  process.exit(1);
}

if (!existsSync(JSON_PATH)) {
  fail(`screen verification record is MISSING: ${JSON_PATH}`);
}

let record;
try {
  record = JSON.parse(readFileSync(JSON_PATH, "utf8"));
} catch (err) {
  fail(`screen verification record is malformed JSON — ${err.message}`);
}

if (!record || !Array.isArray(record.screens)) {
  fail(`screen verification record has no "screens" array.`);
}

// Structural problems block --check. Each is [message, list-of-screen-names-it-concerns].
const problems = [];
const byMockup = new Map();

for (const [i, entry] of record.screens.entries()) {
  const label = entry && typeof entry.mockup === "string" ? entry.mockup : `entry #${i}`;

  if (!entry || typeof entry !== "object") {
    problems.push([`${label}: entry is not an object`, [label]]);
    continue;
  }
  if (typeof entry.mockup !== "string" || !entry.mockup) {
    problems.push([`${label}: missing required field "mockup"`, [label]]);
    continue;
  }
  if (typeof entry.route !== "string" || !entry.route) {
    problems.push([`${entry.mockup}: missing required field "route"`, [entry.mockup]]);
  }
  if (!("verified" in entry)) {
    problems.push([`${entry.mockup}: missing required field "verified"`, [entry.mockup]]);
  }
  if (!ROSTER_MOCKUPS.has(entry.mockup)) {
    problems.push([`${entry.mockup}: names a mockup that is not a build-contract screen in PAIRS`, [entry.mockup]]);
  }
  if (byMockup.has(entry.mockup)) {
    problems.push([`${entry.mockup}: appears more than once in the record`, [entry.mockup]]);
  } else {
    byMockup.set(entry.mockup, entry);
  }

  const v = entry.verified;
  if (v !== null && v !== undefined) {
    if (typeof v !== "object" || Array.isArray(v)) {
      problems.push([`${entry.mockup}: "verified" must be null or an object`, [entry.mockup]]);
      continue;
    }
    if (typeof v.date !== "string" || !DATE_RE.test(v.date)) {
      problems.push([`${entry.mockup}: "date" is missing or not YYYY-MM-DD`, [entry.mockup]]);
    }
    if (typeof v.who !== "string" || !v.who) {
      problems.push([`${entry.mockup}: missing required field "who"`, [entry.mockup]]);
    }
    if (!Array.isArray(v.widths)) {
      problems.push([`${entry.mockup}: missing required field "widths"`, [entry.mockup]]);
    }
    if (!Array.isArray(v.themes)) {
      problems.push([`${entry.mockup}: missing required field "themes"`, [entry.mockup]]);
    }
    if (typeof v.verdict !== "string" || !VERDICTS.has(v.verdict)) {
      problems.push([`${entry.mockup}: "verdict" must be one of matches / deviates / blocked`, [entry.mockup]]);
    }
  }
}

const missingFromRecord = ROSTER.filter((r) => !byMockup.has(r.mockup)).map((r) => r.mockup);
if (missingFromRecord.length) {
  problems.push([`build-contract screen(s) with no entry in the record: ${missingFromRecord.join(", ")}`, missingFromRecord]);
}

// The mockup hash manifest is a SEPARATE, concurrently-built file. Its absence is not a defect
// here — see the MANIFEST NOT AVAILABLE status below — and it is never treated as a --check failure.
let manifest = null;
if (existsSync(MANIFEST_PATH)) {
  try {
    const parsed = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
    if (parsed && typeof parsed.mockups === "object" && parsed.mockups !== null) manifest = parsed;
  } catch {
    manifest = null; // an unreadable manifest is treated the same as no manifest — never a --check failure.
  }
}
const manifestAvailable = manifest !== null;

/**
 * Wires `drawingStatus` (see screen-verification-lib.mjs) to this record's manifest lookup:
 * `null` means the manifest file itself is unavailable; an available manifest with no entry for
 * this mockup falls through as `undefined`, which reads as STALE — same as before.
 */
function statusFor(mockup, verified) {
  const manifestHash = manifestAvailable ? manifest.mockups[mockup] : null;
  return drawingStatus(verified, manifestHash);
}

const rows = ROSTER.map(({ mockup, route }) => {
  const entry = byMockup.get(mockup);
  const v = entry && entry.verified && typeof entry.verified === "object" ? entry.verified : null;
  return { mockup, route, verified: v, status: statusFor(mockup, v) };
});

const looked = rows.filter((r) => r.verified !== null).length;

// --report and --hash are read-only, on-demand LIVE checks over the BUILT screen. Neither feeds
// the generated page or --check: computing an implementation hash there would make
// SCREEN-VERIFICATION.md go stale on every component edit — exactly the failure this file's own
// header warns against reintroducing for the unverified/stale drawing cases.
if (process.argv.includes("--report")) {
  console.log(`Ward Flow — live implementation status (${rows.length} screens)`);
  for (const { mockup, route, folder } of ROSTER) {
    const files = implementationFiles(ROOT, folder, route);
    const hash = implementationSha256(ROOT, files);
    const entryVerified = byMockup.get(mockup)?.verified;
    const verified = entryVerified && typeof entryVerified === "object" ? entryVerified : null;
    console.log(`${mockup}: ${implementationStatus(verified, hash)}`);
  }
  process.exit(0);
}

const hashFlagIndex = process.argv.indexOf("--hash");
if (hashFlagIndex !== -1) {
  const targetMockup = process.argv[hashFlagIndex + 1];
  const target = ROSTER.find((r) => r.mockup === targetMockup);
  if (!target) {
    console.error(`--hash: "${targetMockup ?? ""}" is not a build-contract screen in PAIRS.`);
    process.exit(1);
  }
  const files = implementationFiles(ROOT, target.folder, target.route);
  const hash = implementationSha256(ROOT, files);
  if (hash === null) {
    console.error(`--hash: no implementation files found for "${targetMockup}" — nothing to hash.`);
    process.exit(1);
  }
  console.log(hash);
  process.exit(0);
}

const lines = [
  "# Ward Flow — screen verification",
  "",
  "> 🔴 **GENERATED. DO NOT EDIT BY HAND.** Edit `docs/ward-flow/screen-verification.json` instead,",
  "> then run `node scripts/ward-flow/screen-verification.mjs`. `--check` fails on a stale page or a",
  "> broken record — never on an unverified or stale screen. See the script header for why.",
  "",
  `**${looked} of ${rows.length} screens have been looked at.**`,
  "",
  "| Screen (mockup) | Route | Verified on | By | Widths | Themes | Verdict | Drawing | Implementation hash at look |",
  "|---|---|---|---|---|---|---|---|---|",
  ...rows.map((r) => {
    const v = r.verified;
    const date = v ? v.date ?? "—" : "—";
    const who = v ? v.who ?? "—" : "—";
    const widths = v && Array.isArray(v.widths) ? v.widths.join(", ") : "—";
    const themes = v && Array.isArray(v.themes) ? v.themes.join(", ") : "—";
    const verdict = v ? v.verdict ?? "—" : "—";
    // Recorded only — never recomputed from current source here. Computing it live would make
    // this generated page go stale on every component edit, which is exactly what WF-35's fix
    // must not reintroduce. Use `--report` or `--hash <mockup>` for the live figure.
    const implementationHash =
      v && typeof v.implementationSha256 === "string" && v.implementationSha256 ? v.implementationSha256.slice(0, 12) : "not recorded";
    return `| \`${r.mockup}\` | \`${r.route}\` | ${date} | ${who} | ${widths} | ${themes} | ${verdict} | ${r.status} | ${implementationHash} |`;
  }),
  "",
  "## Deviations",
  "",
];

const deviations = rows.filter((r) => r.verified && r.verified.verdict && r.verified.verdict !== "matches");
if (!deviations.length) {
  lines.push("None recorded.", "");
} else {
  for (const r of deviations) {
    lines.push(`### \`${r.mockup}\` — ${r.verified.verdict}`, "");
    lines.push(r.verified.notes ? r.verified.notes : "_(no notes recorded — should be added)_", "");
  }
}

if (!manifestAvailable) {
  lines.push(
    "⚠️ **The mockup hash manifest (`docs/ward-flow/mockups/MANIFEST.json`) does not exist yet.**",
    "No screen below can be aged against it — DRAWING UNCHANGED and STALE cannot be told apart until it lands.",
    "",
  );
}

const text = lines.join("\n");

if (process.argv.includes("--check")) {
  const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  const stale = current.trim() !== text.trim();
  if (stale) problems.unshift([`SCREEN-VERIFICATION.md is STALE`, []]);

  if (!problems.length) {
    console.log(`screen verification record is current — ${looked} of ${rows.length} screens looked at, no structural problems.`);
    process.exit(0);
  }
  for (const [message] of problems) console.error(message);
  console.error(REMEDIATION);
  process.exit(1);
}

writeFileSync(OUT, text, "utf8");
console.log(`wrote ${OUT} — ${looked} of ${rows.length} screens looked at, ${problems.length} structural problem(s).`);
