#!/usr/bin/env node
/**
 * 🔴 **THE OWNER'S RULINGS LIVE ACROSS ~30 FILES MATCHING `docs/ward-flow/owner-*.md`, WITH NO
 * SINGLE LIST.** A hand-written index of them is ~30 claims that will stop being true the next
 * time a file is added, renamed, or a ruling inside one is superseded — and staleness would not
 * announce itself. So this generates the index instead, the same way
 * `scripts/ward-flow/rules-index.mjs` generates `docs/ward-flow/RULES.md`.
 *
 *     node scripts/ward-flow/owner-rulings-index.mjs            # write the index
 *     node scripts/ward-flow/owner-rulings-index.mjs --check    # fail if the committed index is stale
 *
 * ⚠️ **THE `--check` MODE IS THE POINT.** An index that is merely regenerable still rots if nobody
 * remembers to regenerate it. `--check` is what a gate runs, so the tree cannot carry an index that
 * disagrees with the source files.
 *
 * WHAT THIS SCANS
 * ----------------
 * `docs/ward-flow/decisions.md`, `docs/ward-flow/owner-*.md`. The brief also asked about `docs/ward-flow/*owner*ruling*.md` in
 * case it caught more — it does not: every file that pattern matches already starts with `owner-`
 * and is already in the first set. Both patterns are computed below so that stops being an assumption.
 * One file matches `*owner*` but not `owner-*` — `how-to-write-to-the-owner.md` — and is deliberately
 * NOT scanned: it is instructions for writing TO the owner, not a record of what he ruled.
 *
 * HOW A "RULING" IS RECOGNISED
 * -----------------------------
 * The corpus is not one format. Three shapes are recognised, in this order of confidence:
 *
 *   1. An ID-coded heading (`##`/`###`/`####`) whose text — after stripping a leading emoji/markdown
 *      decoration — starts with a token shaped like an owner-issued ID: `D-8`, `O-17.1`,
 *      `R-2026-09-04-A`, `R-B-01`, `§3`, `R1`, or the spelled-out `Decision 1` / `Ruling 1` (the last
 *      two only when immediately followed by a dash — see the false-positive note in the source).
 *   2. A bare numbered heading (`## 3. Title`, `## 3 · Title`) with NO owner-style ID. These are real,
 *      individually-numbered rulings in files that never assigned letter codes — they are listed
 *      under their file, but deliberately left OUT of the flat ID index below, because "3" is not a
 *      token anyone could look up unambiguously across 30 files.
 *   3. An ID-coded markdown table row (`| Q-1 | ... |`, `| A-6 | ... |`) — the two files in this
 *      corpus (`owner-decisions-2026-09-1x.md`'s Q-table, `owner-questions-queued-2026-09-10.md`'s
 *      A/B tables) that number rulings and open questions as table rows rather than headings.
 *
 * A file where none of the three shapes appears is listed under "Unparsed files", NOT silently
 * dropped — see the comment above `UNPARSED` below for why that matters more than a clean-looking
 * index.
 *
 * ⚠️ **THIS DOES NOT DISTINGUISH A DECIDED RULING FROM AN OPEN QUESTION.** Several scanned files are
 * questions still awaiting the owner (their own filenames often say so: `owner-question-*`,
 * `owner-questions-queued-*`, `owner-decisions-to-settle-*`). This generator has no reliable way to
 * tell "ruled" from "asked and not yet answered" — that is a judgement call, not a pattern match, and
 * a wrong automatic judgement here would be worse than none. So it quotes each item's heading or row
 * text VERBATIM (never rephrased) and always prints the file's own title alongside it — the owner's
 * / lane's own words usually say plainly whether a row is a ruling, a live question, or a withdrawal.
 * Read the surrounding paragraph in the source file before treating anything found here as settled.
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DOCS_DIR = join(process.cwd(), "docs", "ward-flow");
const DATED_NOTES_DIR = join(DOCS_DIR, "archive", "dated-notes");
const OUT = join(DOCS_DIR, "OWNER-RULINGS.md");
const TRUNCATE_AT = 320;

// ---------------------------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------------------------

function listFiles() {
  if (!existsSync(DOCS_DIR)) {
    console.error(`docs/ward-flow not found at ${DOCS_DIR}`);
    process.exit(2);
  }
  const outName = "OWNER-RULINGS.md";
  const scanDirs = [
    { dir: DOCS_DIR, prefix: "" },
    ...(existsSync(DATED_NOTES_DIR) ? [{ dir: DATED_NOTES_DIR, prefix: "archive/dated-notes/" }] : []),
  ];

  const primary = [];
  const secondary = [];

  for (const { dir, prefix } of scanDirs) {
    const all = readdirSync(dir).filter((f) => f !== outName);
    for (const f of all) {
      const relPath = `${prefix}${f}`;
      if ((prefix === "" && f === "decisions.md") || /^owner-.*\.md$/.test(f)) {
        primary.push(relPath);
      } else if (/owner.*ruling.*\.md$/i.test(f)) {
        secondary.push(relPath);
      }
    }
  }

  primary.sort();
  secondary.sort();
  return { primary, secondary };
}

// ---------------------------------------------------------------------------------------------
// ID recognition
// ---------------------------------------------------------------------------------------------

// Leading decoration this corpus actually uses ahead of an ID (emoji + markdown emphasis + space).
// Deliberately does NOT strip "§" — the §N pattern below needs it to survive.
const LEAD_DECORATION = /^(?:[\s*_`'"]|\u{1F534}|\u{1F7E2}|⏳|✅|⚠️|⏸️|⚠)+/u;

// Tried in order — most specific first, so "R-2026-09-04-A" is never truncated to "R-2026" by the
// generic pattern, and "R-B-01" is never mistaken for a bare "R" needing a digit straight after it.
const ID_PATTERNS = [
  /^(R-\d{4}-\d{2}-\d{2}-[A-Z])\b/, // R-2026-09-04-A
  /^(R-B-\d{2,3})\b/, // R-B-01 .. R-B-18
  /^(§\d+(?:\.\d+)?)\s*[-–—:·]/, // §3 — ... (needs the dash: see comment below)
  /^((?:Decision|Ruling)\s+\d+)\s*[-–—:·]/i, // Decision 1 — ... / Ruling 1 — ...
  /^([A-Z]{1,4}-?\d+(?:\.\d+)*[a-zA-Z]?)\b/, // D-8, D-3b, O-17.1, R1, R10, Q-1, A-6 (generic)
];

// `(?:Decision|Ruling)\s+\d+` and `§N` REQUIRE a following dash/colon/middle-dot. Without that
// requirement this also matches headings that merely TALK ABOUT an earlier ruling by number —
// e.g. bed-model.md has "## ⚠️ Ruling 3 is NOT a display change, and this is the part that
// matters" (commentary on ruling 3, not a new ruling) and "## Ruling 5's residue, traced — ...".
// Requiring the dash immediately after the number is what tells "Ruling 1 — the fixture keeps…"
// (a declaration) apart from those two (commentary). Checked against the full corpus 2026-09-12.
const ORDINAL_PATTERN = /^(\d+)\s*[.·]/;

function matchId(strippedText) {
  for (const re of ID_PATTERNS) {
    const m = re.exec(strippedText);
    if (m) return m[1].replace(/\s+/g, " ");
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Per-file extraction
// ---------------------------------------------------------------------------------------------

function extractHeadingItems(lines) {
  const items = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^(#{2,4})\s+(.*)$/.exec(lines[i]);
    if (!m) continue;
    const raw = m[2].trim();
    const stripped = raw.replace(LEAD_DECORATION, "");
    const id = matchId(stripped);
    let ordinal = null;
    if (!id) {
      const om = ORDINAL_PATTERN.exec(stripped);
      if (om) ordinal = om[1];
    }
    if (!id && !ordinal) continue;
    items.push({ line: i + 1, id, ordinal, text: raw, kind: "heading" });
  }
  return items;
}

function splitTableRow(line) {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

function extractTableRowItems(lines) {
  const items = [];
  const idCellRe = /^\*{0,2}([A-Z]{1,4}-\d+[a-zA-Z]?)\*{0,2}$/;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim().startsWith("|")) continue;
    const cells = splitTableRow(line);
    if (cells.length < 2) continue;
    const idm = idCellRe.exec(cells[0]);
    if (!idm) continue;
    const text = cells.slice(1).join(" — ").replace(/\s+/g, " ").trim();
    if (!text) continue;
    items.push({ line: i + 1, id: idm[1], ordinal: null, text, kind: "table row" });
  }
  return items;
}

function firstH1(lines) {
  for (const line of lines) {
    const m = /^#\s+(.*)$/.exec(line.trim());
    if (m) return m[1].trim();
  }
  return null;
}

const ISO_DATE = /\d{4}-\d{2}-\d{2}/g;

function fileDate(file, text) {
  const fromName = /(\d{4}-\d{2}-\d{2})/.exec(file);
  if (fromName) return { display: fromName[1], sortKey: fromName[1] };
  const found = [...text.matchAll(ISO_DATE)].map((m) => m[0]);
  if (found.length === 0) return { display: "date unknown", sortKey: "0000-00-00" };
  const uniq = [...new Set(found)].sort();
  const min = uniq[0];
  const max = uniq[uniq.length - 1];
  if (min === max) return { display: min, sortKey: min };
  return { display: `${min} – ${max} (mixed, see file)`, sortKey: max };
}

function truncate(text, atLine) {
  if (text.length <= TRUNCATE_AT) return text;
  let cut = text.slice(0, TRUNCATE_AT);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > TRUNCATE_AT - 40) cut = cut.slice(0, lastSpace);
  return `${cut}… [truncated — full text at line ${atLine}]`;
}

function collect(files) {
  const perFile = [];
  for (const file of files) {
    const text = readFileSync(join(DOCS_DIR, file), "utf8");
    const lines = text.split(/\r?\n/);
    const items = [...extractHeadingItems(lines), ...extractTableRowItems(lines)].sort((a, b) => a.line - b.line);
    perFile.push({
      file,
      title: firstH1(lines),
      date: fileDate(file, text),
      items,
    });
  }
  return perFile;
}

// ---------------------------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------------------------

function render(perFile, patterns) {
  const withItems = perFile.filter((f) => f.items.length > 0);
  const unparsed = perFile.filter((f) => f.items.length === 0);
  const totalItems = withItems.reduce((n, f) => n + f.items.length, 0);

  // Flat ID index — only items that carry a real, owner-style ID (letter-coded, R-date, R-B, §N,
  // Decision/Ruling N). Bare numbered items ("3." with no letter code) are deliberately excluded
  // here: see the module comment for why "3" is not a safe global lookup key.
  const idIndex = new Map(); // id -> [{file, line, text}]
  for (const f of withItems) {
    for (const item of f.items) {
      if (!item.id) continue;
      if (!idIndex.has(item.id)) idIndex.set(item.id, []);
      idIndex.get(item.id).push({ file: f.file, line: item.line, text: item.text });
    }
  }
  const idKeys = [...idIndex.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const collidingIds = idKeys.filter((k) => idIndex.get(k).length > 1);

  const sortedFiles = [...withItems].sort((a, b) => {
    if (a.date.sortKey !== b.date.sortKey) return b.date.sortKey.localeCompare(a.date.sortKey);
    return b.file.localeCompare(a.file);
  });

  const lines = [
    "# Ward Flow — the owner's rulings, generated",
    "",
    "> \u{1F534} **GENERATED FILE. DO NOT EDIT BY HAND.**",
    "> `node scripts/ward-flow/owner-rulings-index.mjs` regenerates it; `--check` fails when it is out",
    "> of date. Edit a ruling in its own source file under `docs/ward-flow/`, never here.",
    "",
    `Scanned \`docs/ward-flow/decisions.md\`, \`docs/ward-flow/owner-*.md\` and \`docs/ward-flow/archive/dated-notes/owner-*.md\` — **${perFile.length} files**. The brief also asked about`,
    "`docs/ward-flow/*owner*ruling*.md`: that pattern matched " +
      (patterns.secondary.length === 0
        ? "**zero files beyond the first set** — every file it catches already starts with `owner-`."
        : `**${patterns.secondary.length} additional file(s)**, folded in below: ${patterns.secondary.map((f) => `\`${f}\``).join(", ")}.`),
    "One file matches `*owner*` but not `owner-*` and is deliberately excluded: `how-to-write-to-the-owner.md`",
    "— it is instructions for writing TO the owner, not a record of what he ruled.",
    "",
    `**${totalItems} rulings/items extracted, across ${withItems.length} of ${perFile.length} files.**`,
    `**${unparsed.length} file(s) UNPARSED** — no recognised ruling structure found; listed, not dropped. See below.`,
    "",
    "⚠️ **This index proves a ruling or item EXISTS in the named file, as of the generation run",
    "below — it does NOT prove the ruling is still CURRENT.** Owner rulings in this corpus get",
    'corrected, superseded and withdrawn inside these same files (search near an ID for "WITHDRAWN",',
    '"SUPERSEDED", "CORRECTED", "REVISED" before relying on it). Always open the source file and read',
    "the surrounding paragraph before acting on anything found here.",
    "",
    "⚠️ **This index does NOT distinguish a decided ruling from a question still awaiting the owner.**",
    "Text below is quoted verbatim from each file's own heading or table row — never paraphrased —",
    "specifically so that distinction survives. A file's own title (also quoted) is usually the fastest",
    "tell: `owner-question-*` and `owner-*-to-settle-*` files are frequently still open.",
    "",
    "⚠️ **IDs are NOT globally unique across this corpus.** The same token has been issued",
    `independently in more than one file ${collidingIds.length} time(s) below (e.g. \`${collidingIds[0] ?? "none"}\`).`,
    "Where that happens every occurrence is listed, in the order discovered — confirm which file's",
    "instance is the one you mean before citing it.",
    "",
    "---",
    "",
    `## ID index — ${idKeys.length} distinct IDs`,
    "",
    "So an ID like `D-9` or `O-17.1` can be looked up directly, without knowing which file it lives in.",
    'Bare numbered rulings (files that number "1., 2., 3. …" with no owner-issued letter code) are',
    'NOT listed here — look them up under "By file" below instead, because a plain number is not a',
    "safe global key across 30 files.",
    "",
    "| ID | File(s) | One-line substance |",
    "| --- | --- | --- |",
  ];
  for (const id of idKeys) {
    const occurrences = idIndex.get(id);
    if (occurrences.length === 1) {
      const o = occurrences[0];
      lines.push(`| \`${id}\` | \`${o.file}\`:${o.line} | ${truncate(o.text, o.line).replace(/\|/g, "\\|")} |`);
    } else {
      lines.push(`| \`${id}\` ⚠️ **${occurrences.length} occurrences — not unique** | | |`);
      for (const o of occurrences) {
        lines.push(`| ↳ | \`${o.file}\`:${o.line} | ${truncate(o.text, o.line).replace(/\|/g, "\\|")} |`);
      }
    }
  }
  lines.push("");

  lines.push("---", "", `## By file, newest first — ${withItems.length} files`, "");
  for (const f of sortedFiles) {
    lines.push(`### \`${f.file}\` (${f.date.display})`, "");
    if (f.file === "decisions.md")
      lines.push(
        "**Recorded decision log.** Read the source for supersession and current scope; indexing does not grant authority.",
        "",
      );
    if (/owner-question|owner-questions|to-settle/.test(f.file))
      lines.push(
        "**Question/proposal source.** An indexed item is not an approved decision; read the source for an explicit owner answer.",
        "",
      );
    if (f.title) lines.push(`**Title:** ${f.title}`, "");
    lines.push(`${f.items.length} item(s):`, "");
    for (const item of f.items) {
      const label = item.id ? `\`${item.id}\`` : `#${item.ordinal} (no owner-issued ID, this file's own numbering)`;
      lines.push(`- ${label} — line ${item.line}, ${item.kind}: "${truncate(item.text, item.line)}"`);
    }
    lines.push("");
  }

  lines.push("---", "", `## Unparsed files — ${unparsed.length}`, "");
  lines.push(
    "✅ **Not a defect in the files — a limitation of this generator, stated rather than hidden.**",
    "A generator that silently drops what it cannot structure produces a tidy index missing exactly",
    "the rulings nobody has looked at. Every file below matched the scan pattern but contained no",
    "ID-coded heading, numbered heading, or ID-coded table row this generator recognises. Open the file",
    "directly — it may hold a single unnumbered ruling in prose, or (often, going by filename) still be",
    "an open question with no ruling recorded yet.",
    "",
  );
  if (unparsed.length === 0) {
    lines.push("(none — every scanned file yielded at least one recognised item)", "");
  } else {
    for (const f of unparsed.sort((a, b) => a.file.localeCompare(b.file))) {
      lines.push(`- \`${f.file}\`${f.title ? ` — "${f.title}"` : ""}`);
    }
    lines.push("");
  }

  return lines.join("\n") + "\n";
}

// ---------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------

const patterns = listFiles();
const perFile = collect([...patterns.primary, ...patterns.secondary]);
const text = render(perFile, patterns);

if (process.argv.includes("--check")) {
  const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (current.trim() === text.trim()) {
    const itemCount = perFile.reduce((n, f) => n + f.items.length, 0);
    console.log(`owner-rulings index is current — ${itemCount} items across ${perFile.length} files.`);
    process.exit(0);
  }
  console.error(
    `owner-rulings index is STALE. Regenerating from source disagrees with docs/ward-flow/OWNER-RULINGS.md.\n` +
      `Run: node scripts/ward-flow/owner-rulings-index.mjs`,
  );
  process.exit(1);
}

writeFileSync(OUT, text, "utf8");
const itemCount = perFile.reduce((n, f) => n + f.items.length, 0);
const unparsedCount = perFile.filter((f) => f.items.length === 0).length;
console.log(`wrote ${OUT} — ${itemCount} items across ${perFile.length} files (${unparsedCount} unparsed).`);
