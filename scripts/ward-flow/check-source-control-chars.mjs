#!/usr/bin/env node
/**
 * Fails if any source file under `src/`, `tests/` or `docs/ward-flow/` contains a control character
 * that has no business being there — a NUL, or any other C0 control besides tab, newline and
 * carriage return.
 *
 * WHY THIS EXISTS, and it is a real incident rather than a hypothetical.
 *
 * On 2026-09-10 two literal NUL bytes were committed inside a TypeScript template literal, where
 * spaces should have been, in a string used only as a grouping key:
 *
 *     `${movement.originEdId}\0${acceptedUnitId}\0${movement.stage}`
 *
 * 🔴 EVERY GATE PASSED. The eight-case unit suite passed — a separator made of NULs separates
 * exactly as well as one made of spaces. `tsc --noEmit` passed. Prettier passed. The bytes were
 * invisible in terminal output, in `cat`, and in review.
 *
 * ⚠️ AND GIT DID NOT FLAG IT EITHER. `git diff --numstat` on that commit reported `52  0` — an
 * ordinary text diff. Git only calls a file binary when a NUL appears near its start; this one sat
 * deeper in, so the diff looked entirely normal. Measured, not assumed.
 *
 * 🔴 THE TELL IS THAT THERE IS NO TELL. Damage that changes no behaviour cannot be caught by any
 * behavioural gate — a test run, a type check, a formatter, a diff and a human reading the file all
 * agree it is fine. That is what makes it worth a dedicated check rather than vigilance.
 *
 * It arrives through `sed -i` and encoding handling on this machine, not through anything a builder
 * decided — so it can land in any lane, in any worktree, without anybody doing something wrong.
 *
 * Found by Ward Builder (Lane A) inside its own commit. It reported that it had NOT established
 * whether any gate would catch it, and declined to claim an absence it had not proved. Ward Lead
 * measured it afterwards: no script under `scripts/` or `eslint-rules/` scans source for control
 * characters. The three that mention them cover SQL role names, therapy records and answer text —
 * none covers `src/` or `tests/`.
 *
 * 🔴 SECOND INCIDENT, 2026-09-12 — THE FIRST FIX HAD A BLIND SPOT OF ITS OWN.
 *
 * Five raw BACKSPACE bytes (0x08) sat in three tracked `.md` files under `docs/ward-flow/**` for
 * days — a backslash-`b` regex escape typed as a literal control byte instead of two characters —
 * while this script printed "Scanned 3164/3180 source files ... None found." both before and after
 * the repair, because its `ROOTS` had never included `docs/` and its extension list did not include
 * `.md` even if it had. A floor proving the walk was not EMPTY (see the test file) said nothing
 * about whether the walk covered the place the defect actually lived — absence under one prefix is
 * not absence. `docs/ward-flow/` is now a third root, with its own wider extension list, because
 * that is where prose (and therefore this exact defect class: a control byte typed where two
 * ordinary characters were meant) actually lives. See `DOCS_EXTENSIONS`, `SKIP_BINARY_EXTENSIONS`
 * and `LOG_SKIP_REASON` below for what is deliberately still not read, and why each is reported
 * rather than silently absent — a silent skip is the same shape as this defect.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const repo = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();

/** Tab (09), newline (0A) and carriage return (0D) are legitimate. Everything else in C0, plus DEL, is not. */
const FORBIDDEN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

const NAMES = {
  0: "NUL",
  8: "BACKSPACE",
  11: "VERTICAL TAB",
  12: "FORM FEED",
  27: "ESCAPE",
  127: "DELETE",
};

/**
 * 🔴 EXEMPTIONS, AND WHY THIS SECTION EXISTS AT ALL.
 *
 * The first run of this guard reddened on `tests/upload-structure.test.ts`, which contained
 * `Buffer.from("PK\u0003\u0004 not really a zip")` — the ZIP magic number, deliberately written as
 * control characters, in a test that checked a non-ZIP upload is rejected. That was CORRECT WORK.
 * (That file went with PsychSift's removal on 25 September 2026 and is no longer exempted here.)
 *
 * ⚠️ So this guard's own first act was to become the thing it was written to prevent: a check that
 * fires on correct work. Shipping it unexempted would have sent somebody to "fix" a right test.
 *
 * An exemption names the file AND the reason. A skip list without reasons decays into a place
 * where real corruption hides, because nobody can tell an exemption from an oversight.
 *
 * A file may also exempt itself inline with the marker below, so a new legitimate case does not
 * need this script edited — but it must say why, in the same comment.
 *
 * This map is untouched by the 2026-09-12 docs/ward-flow widening below — see SKIP_BINARY_EXTENSIONS
 * and LOG_SKIP_REASON for how that widening's own known-content cases are handled instead, by
 * extension rather than by hand-naming individual files.
 */
const INLINE_MARKER = "control-characters: intentional";

const EXEMPT = new Map([
  // 🔴 ADDED 2026-09-12, and a third candidate was REFUSED — which is the only reason to trust the
  // two that were granted. Versioning the lesson store into docs/ward-flow/lessons/ brought three
  // files here carrying control characters. Two hold them as their SUBJECT MATTER. The third,
  // communication-style-plain-and-brief.md, held a BACKSPACE where an escape had been eaten out of
  // the path ...scripts/backup-work.sh — real corruption, in a backup command, inside a file about
  // how to communicate. It was REPAIRED at byte level, not exempted. An exemption list whose
  // entries were never tested against a refusal is just a mute button.
  //
  // ⚠️ THE EXEMPTION IS PER FILE, SO IT IS BLUNT: a NEW control character introduced into either
  // file below would be waved through. That is the cost of naming a file rather than a byte, and
  // it is stated here rather than discovered later.
  [
    "docs/ward-flow/lessons/corruption-that-makes-checks-pass-harder.md",
    "Three literal NUL bytes (0x00) that ARE the lesson: the file documents corruption that made checks pass harder, and carries the bytes so a reader sees what git, prettier and review all failed to show.",
  ],
  [
    "docs/ward-flow/lessons/git-queries-that-answer-instead-of-erroring.md",
    "One literal BACKSPACE (0x08) that IS the lesson: it records a generated regex in which an escape became byte 0x08 silently. Quoting the byte is the evidence; describing it would not be.",
  ],
]);

const CODE_EXTENSIONS = [".ts", ".tsx", ".mjs", ".js", ".jsx", ".css"];

/**
 * 🔴 SKIPS — files under docs/ward-flow that are never opened, and why that is not the same shape
 * as the "None found." blind spot this file's header describes.
 *
 * EXEMPT (above) covers files that ARE read, in which the forbidden bytes are found, and are
 * permitted for a stated per-file reason. The two categories below are different: these files are
 * never read as text at all, because doing so is either meaningless (genuinely binary content) or
 * a known, checked, non-incident population (captured terminal output). The distinction matters
 * because a skip that is never reported is indistinguishable from a root nobody thought to add —
 * exactly what went wrong here on 2026-09-12 — so every skip below is counted and printed by name,
 * never silent.
 */
const SKIP_BINARY_EXTENSIONS = new Map([
  [
    ".bundle",
    "a compressed git bundle under docs/ward-flow/control/evidence/bundles/ (~119 MB) — binary, not text; reading it as UTF-8 would be meaningless and would misreport its compressed bytes as control characters",
  ],
  [".woff2", "a compressed binary web font referenced by the mockups under docs/ward-flow/mockups/ — not text"],
]);

/**
 * Verified 2026-09-12 by a direct byte-level check (not assumed): 13 of the 117 tracked `.log`
 * files under docs/ward-flow/control/evidence/artifacts/ward-board/ contain ESC (0x1b) bytes —
 * captured terminal colour output from test/build runs, not prose. The other 104 are clean and
 * would pass unexempted anyway; the whole extension is skipped rather than the 13 files named
 * individually, so a NEW capture added to that directory later stays covered by the same reasoning
 * without this script needing to be edited again. One of the 13 — the .tmp-ward-sheet-after.log
 * capture — is not actually ANSI colour; after its final line it is padded with roughly 40,000 NUL
 * bytes, consistent with a truncated/pre-allocated write rather than terminal colour codes. That is
 * a genuine anomaly worth someone's attention, but it sits inside a log capture directory, not
 * source or prose, so it is out of scope for this script to adjudicate — reported here, not hidden,
 * and left to whoever owns that evidence directory.
 */
const LOG_SKIP_REASON =
  "captured terminal output under docs/ward-flow/control/evidence/artifacts/ward-board/ — legitimately " +
  "carries ANSI colour escapes (0x1b), verified 2026-09-12 in 13 of 117 tracked files there; not prose " +
  "and not this defect";

/**
 * docs/ward-flow carries prose, mockup HTML, JSON evidence and captured logs, not source code, so
 * it needs a wider extension list than src/ and tests/. `.bundle`, `.woff2` and `.log` are included
 * here ONLY so the walk finds them and the skip logic above can count and name them — leaving them
 * out of this list would make them vanish from the file count the same silent way the missing
 * `docs/` root itself did.
 */
const DOCS_EXTENSIONS = [
  ...CODE_EXTENSIONS,
  ".md",
  ".html",
  ".json",
  ".txt",
  ".diff",
  ".tsv",
  ".sh",
  ".py",
  ".bundle",
  ".woff2",
  ".log",
];

const ROOTS = [
  { dir: "src", extensions: CODE_EXTENSIONS, maxBytes: Infinity },
  { dir: "tests", extensions: CODE_EXTENSIONS, maxBytes: Infinity },
  {
    dir: "docs/ward-flow",
    extensions: DOCS_EXTENSIONS,
    // Applies ONLY to this root. docs/ward-flow/control/evidence/chat-exports/ holds several
    // multi-megabyte JSON chat exports (measured 2026-09-12: four tracked files between 1.78 MB and
    // 2.59 MB); everything else tracked under docs/ward-flow is well under this. src/ and tests/
    // keep no size ceiling at all — a source file that large would itself be worth knowing about,
    // not skipping.
    maxBytes: 1_000_000,
  },
];

function walk(dir, extensions, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === ".next" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    let s;
    try {
      s = statSync(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) walk(full, extensions, out);
    else if (extensions.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

const offences = [];
const exempted = [];
const skippedBinaryCounts = new Map(); // extension -> count
let skippedLogCount = 0;
const skippedLarge = []; // { file, size }
const scannedPerRoot = new Map(); // root.dir -> count
const walkedPerRoot = new Map(); // root.dir -> count (before any skip)

for (const root of ROOTS) {
  const dirFiles = walk(join(repo, root.dir), root.extensions);
  walkedPerRoot.set(root.dir, dirFiles.length);
  let scanned = 0;

  for (const file of dirFiles) {
    const rel = relative(repo, file).replaceAll("\\", "/");
    const ext = extname(file).toLowerCase();

    if (SKIP_BINARY_EXTENSIONS.has(ext)) {
      skippedBinaryCounts.set(ext, (skippedBinaryCounts.get(ext) ?? 0) + 1);
      continue;
    }
    if (ext === ".log") {
      skippedLogCount += 1;
      continue;
    }

    let size;
    try {
      size = statSync(file).size;
    } catch {
      continue;
    }
    if (root.maxBytes !== Infinity && size > root.maxBytes) {
      skippedLarge.push({ file: rel, size });
      continue;
    }

    const body = readFileSync(file, "utf8");
    scanned += 1;

    if (EXEMPT.has(rel)) {
      exempted.push({ file: rel, why: EXEMPT.get(rel) });
      continue;
    }
    if (body.includes(INLINE_MARKER)) {
      exempted.push({ file: rel, why: "declared inline with " + INLINE_MARKER });
      continue;
    }
    FORBIDDEN.lastIndex = 0;
    let match;
    while ((match = FORBIDDEN.exec(body)) !== null) {
      const code = match[0].codePointAt(0);
      const line = body.slice(0, match.index).split("\n").length;
      offences.push({
        file: rel,
        line,
        code,
        name: NAMES[code] ?? `U+${code.toString(16).padStart(4, "0").toUpperCase()}`,
      });
    }
  }

  scannedPerRoot.set(root.dir, scanned);
}

const totalScanned = [...scannedPerRoot.values()].reduce((a, b) => a + b, 0);

console.log(`Scanned ${totalScanned} source files under ${ROOTS.map((r) => r.dir).join(", ")} for control characters.`);
for (const root of ROOTS) {
  console.log(
    `  ${root.dir}: ${scannedPerRoot.get(root.dir)} file(s) scanned (${walkedPerRoot.get(root.dir)} found by extension)`,
  );
}
console.log("");

for (const e of exempted) {
  console.log(`  EXEMPT  ${e.file}`);
  console.log(`          ${e.why}
`);
}
if (exempted.length > 0) {
  console.log(`${exempted.length} file(s) exempted. An exemption is REPORTED, never silent — a skip`);
  console.log("list nobody can read is where real corruption hides.");
  console.log("");
}

const totalSkipped =
  [...skippedBinaryCounts.values()].reduce((a, b) => a + b, 0) + skippedLogCount + skippedLarge.length;

if (totalSkipped > 0) {
  console.log("Skipped (never read as text):");
  for (const [ext, reason] of SKIP_BINARY_EXTENSIONS) {
    const count = skippedBinaryCounts.get(ext) ?? 0;
    if (count > 0) console.log(`  SKIP  ${count} file(s) with extension ${ext} — ${reason}`);
  }
  if (skippedLogCount > 0) {
    console.log(`  SKIP  ${skippedLogCount} file(s) with extension .log — ${LOG_SKIP_REASON}`);
  }
  if (skippedLarge.length > 0) {
    console.log(`  SKIP  ${skippedLarge.length} file(s) exceeding the docs/ward-flow size ceiling:`);
    for (const f of skippedLarge) {
      console.log(`          ${f.file} (${f.size.toLocaleString("en-US")} bytes)`);
    }
  }
  console.log(`${totalSkipped} file(s) skipped in total. A skip is REPORTED, never silent — a silent skip`);
  console.log("is the same shape as the docs/ward-flow blind spot this widening exists to fix.");
  console.log("");
}

if (offences.length === 0) {
  console.log("None found.\n");
  console.log("⚠️  A pass here does NOT mean the tree is undamaged — it means this specific class is");
  console.log("    absent. Damage that changes no behaviour is invisible to every behavioural gate,");
  console.log("    which is why this check exists separately from the test suite.\n");
  process.exit(0);
}

console.log("🔴 Control characters found in source:\n");
for (const o of offences) {
  console.log(`  ${o.file}:${o.line}  ${o.name} (0x${o.code.toString(16).padStart(2, "0")})`);
}
console.log(`\n${offences.length} occurrence(s).`);
console.log("\nThese pass tests, tsc, prettier, review and `git diff` — a NUL deeper than a file's");
console.log("opening bytes does not even make git call the diff binary. Remove them by rewriting the");
console.log("line, and re-run. Do NOT assume a green suite means the file is clean.\n");
process.exit(1);
