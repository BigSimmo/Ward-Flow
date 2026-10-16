#!/usr/bin/env node
/**
 * shell-sweep.mjs
 *
 * Checks that sixteen Ward Flow mockup pages (docs/ward-flow/mockups/*-third-edition.html)
 * share one identical shell: the stylesheet, the skip link, the rail, the header bar, the
 * menu drawers, the live region, the reconciliation line, and the shared shell script's
 * functions (openMenu, setInert, trapTab, filterBar, selectPatient, and the rest).
 *
 * Reads every file as plain text. No browser, no DOM library, no network. Read-only:
 * this script never writes to any file in the repository.
 *
 * Usage (from the repository root):
 *   node shell-sweep.mjs
 *   node shell-sweep.mjs --files=command-third-edition.html            (sanity check: reference vs itself)
 *   node shell-sweep.mjs --files=delays-third-edition.html,ward-third-edition.html   (subset, for testing)
 *
 * Exit code 0 when all sixteen pages report SAME SHELL, 1 otherwise (or on a fatal setup error).
 */

import fs from "node:fs";
import path from "node:path";

// ─────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────

const MOCKUPS_DIR = path.resolve(process.cwd(), "docs/ward-flow/mockups");
const REFERENCE_FILE = "command-third-edition.html";

// Every docs/ward-flow/mockups/*-third-edition.html except command-third-edition.html
// (the reference) and design-system-third-edition.html (explicitly excluded by the brief).
const OTHER_PAGES = [
  "delays-third-edition.html",
  "statistics-community-third-edition.html",
  "statistics-third-edition.html",
  "capacity-third-edition.html",
  "ward-third-edition.html",
  "bed-board-third-edition.html",
  "search-hub-third-edition.html",
  "raise-a-referral-third-edition.html",
  "patient-search-third-edition.html",
  "community-team-third-edition.html",
  "statistics-ward-third-edition.html",
  "movement-third-edition.html",
  "emergency-department-third-edition.html",
  "statistics-emergency-department-third-edition.html",
  "patient-now-third-edition.html",
];

// The page-slug each file's shared shell script uses to mark "this is the current rail
// link" (var cur = key === "<slug>";) and in its appearance-storage key
// (ward-flow-<slug>-appearance). Used only to blank an ALLOWED per-page difference before
// comparing function bodies/regions — never to decide identity of files.
function slugFor(filename) {
  return filename.replace(/-third-edition\.html$/, "");
}

// The five example shell functions named in the brief. Used only to find, inside COMMAND's
// own file, which <script> block is "the shell script" (see readme note below on why this
// is NOT simply "the largest <script> block" on Command itself).
const EXAMPLE_SHELL_FUNCTIONS = ["openMenu", "setInert", "trapTab", "filterBar", "selectPatient"];

// ─────────────────────────────────────────────────────────────────────────
// CLI args (for development/testing only; plain `node shell-sweep.mjs` is the real run)
// ─────────────────────────────────────────────────────────────────────────

const argFilesFlag = process.argv.slice(2).find((a) => a.startsWith("--files="));
let pagesToCheck = [REFERENCE_FILE, ...OTHER_PAGES];
if (argFilesFlag) {
  const requested = argFilesFlag
    .slice("--files=".length)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.endsWith(".html") ? s : s + "-third-edition.html"));
  pagesToCheck = requested;
}

// ─────────────────────────────────────────────────────────────────────────
// Small text-scanning primitives
// ─────────────────────────────────────────────────────────────────────────

function readPage(filename) {
  const full = path.join(MOCKUPS_DIR, filename);
  try {
    return { text: fs.readFileSync(full, "utf8"), error: null };
  } catch (e) {
    return { text: null, error: e.message };
  }
}

/** First <style ...>...</style> block's raw inner content, or null. */
function extractFirstStyleBody(text) {
  const m = /<style\b[^>]*>([\s\S]*?)<\/style>/i.exec(text);
  return m ? m[1] : null;
}

/** All <script ...>...</script> blocks: [{ body, start, end }], document order. */
function extractAllScriptBlocks(text) {
  const out = [];
  const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(text))) {
    out.push({ body: m[1], start: m.index, end: m.index + m[0].length });
  }
  return out;
}

/**
 * Balanced same-tag-name scan starting at a matched opening tag. Pure text scan (no real
 * HTML/DOM parsing) so it works whether the tag is real markup or sits inside a JS string
 * template (as the reconciliation line and one drawer do in this codebase) — the literal
 * characters "<tag" / "</tag>" are what we're counting, not a parsed tree.
 */
function scanBalancedTag(text, startIdx, openTagText) {
  const nameMatch = /^<\s*([a-zA-Z][a-zA-Z0-9]*)/.exec(openTagText);
  if (!nameMatch) return null;
  const tagName = nameMatch[1];

  if (/\/>\s*$/.test(openTagText)) {
    return { start: startIdx, end: startIdx + openTagText.length, raw: openTagText, tagName };
  }

  const openRe = new RegExp("<" + tagName + "(?=[\\s>/])", "gi");
  const closeRe = new RegExp("</" + tagName + "\\s*>", "gi");
  let depth = 1;
  let from = startIdx + openTagText.length;

  while (depth > 0) {
    openRe.lastIndex = from;
    closeRe.lastIndex = from;
    const nextOpen = openRe.exec(text);
    const nextClose = closeRe.exec(text);
    if (!nextClose) return null; // unbalanced — extraction failed, caller reports NOT PRESENT
    if (nextOpen && nextOpen.index < nextClose.index) {
      depth++;
      from = nextOpen.index + nextOpen[0].length;
    } else {
      depth--;
      from = nextClose.index + nextClose[0].length;
      if (depth === 0) {
        return { start: startIdx, end: from, raw: text.slice(startIdx, from), tagName };
      }
    }
  }
  return null;
}

/** First region whose opening tag matches openRe (non-global RegExp), or null. */
function findFirstRegion(text, openRe) {
  const m = openRe.exec(text);
  if (!m) return null;
  return scanBalancedTag(text, m.index, m[0]);
}

/** All regions whose opening tag matches openRe (global RegExp), non-overlapping. */
function findAllRegions(text, openRe) {
  const out = [];
  openRe.lastIndex = 0;
  let m;
  while ((m = openRe.exec(text))) {
    const region = scanBalancedTag(text, m.index, m[0]);
    if (region) {
      out.push(region);
      openRe.lastIndex = region.end;
    } else {
      openRe.lastIndex = m.index + m[0].length;
    }
  }
  return out;
}

function extractAttr(tagText, attr) {
  const m = new RegExp(attr + '="([^"]*)"', "i").exec(tagText);
  return m ? m[1] : null;
}

/**
 * Balanced brace scan for a function body, quote/comment-aware so that braces inside
 * string literals (this codebase embeds literal CSS/SVG strings with { } in them, e.g. the
 * renderDiagram() inline <style> string) don't desynchronise the count. Template-literal
 * ${...} interpolation is not given special nested-brace handling — noted as a limitation,
 * this codebase does not appear to use template literals for shell markup.
 */
function findMatchingBrace(text, openIdx) {
  let depth = 0;
  let i = openIdx;
  const n = text.length;
  let state = "code";
  while (i < n) {
    const c = text[i];
    if (state === "code") {
      if (c === '"') state = "dq";
      else if (c === "'") state = "sq";
      else if (c === "`") state = "tpl";
      else if (c === "/" && text[i + 1] === "/") state = "line";
      else if (c === "/" && text[i + 1] === "*") state = "block";
      else if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) return i;
      }
      i++;
    } else if (state === "dq" || state === "sq" || state === "tpl") {
      const quote = state === "dq" ? '"' : state === "sq" ? "'" : "`";
      if (c === "\\") i += 2;
      else {
        if (c === quote) state = "code";
        i++;
      }
    } else if (state === "line") {
      if (c === "\n") state = "code";
      i++;
    } else if (state === "block") {
      if (c === "*" && text[i + 1] === "/") {
        state = "code";
        i += 2;
      } else i++;
    }
  }
  return -1;
}

function functionDefined(blockBody, name) {
  return new RegExp("function\\s+" + escapeRegex(name) + "\\s*\\(").test(blockBody);
}

/** Returns the full "function name(...) { ... }" text, or null if not found/unbalanced. */
function extractFunctionSource(blockBody, name) {
  const defRe = new RegExp("function\\s+" + escapeRegex(name) + "\\s*\\(");
  const m = defRe.exec(blockBody);
  if (!m) return null;
  const braceStart = blockBody.indexOf("{", m.index);
  if (braceStart === -1) return null;
  const braceEnd = findMatchingBrace(blockBody, braceStart);
  if (braceEnd === -1) return null;
  return blockBody.slice(m.index, braceEnd + 1);
}

function extractAllFunctionNames(blockBody) {
  const names = [];
  const seen = new Set();
  const re = /function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
  let m;
  while ((m = re.exec(blockBody))) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      names.push(m[1]);
    }
  }
  return names;
}

function collapseWhitespace(s) {
  return s.replace(/\s+/g, " ").trim();
}

/** Whitespace-only normalisation, used for shell-function body comparison (task 4). */
function normalizeWhitespaceOnly(s) {
  return collapseWhitespace(s);
}

/**
 * Blanks the four things the brief says are ALLOWED to differ per page, then collapses
 * whitespace. Used for the six shell markup regions (task 2/3). Structural (tag-aware)
 * blanking runs first, on the un-collapsed text, so tag boundaries stay intact; the
 * whitespace collapse runs last.
 */
function normalizeAndBlank(rawText) {
  let text = rawText;

  // 4. Primary action's button label: blank inner text of any element whose class
  //    attribute contains the token "primary" (e.g. <summary class="primary">New referral</summary>).
  text = blankInnerTextOfClassMatch(text, /primary/i);

  // 2. Live-tally figures, element form: blank inner text of any element whose class
  //    attribute contains "count", "tally", "num" or "fig".
  text = blankInnerTextOfClassMatch(text, /count|tally|num|fig/i);

  // 3. Appearance storage key: ward-flow-<page>-appearance
  text = text.replace(/ward-flow-[a-z0-9-]+-appearance/gi, "ward-flow-PAGE-appearance");

  // 1. aria-current="page" attribute position (the current rail link): in this codebase the
  //    literal attribute text is shared/static; what actually varies per page is the page
  //    identity the shared shell compares against, e.g. `var cur = key === "delays";`.
  text = text.replace(/key\s*===\s*"[a-z0-9-]+"/gi, 'key === "PAGE"');

  // 2 (digits half of the live-tally rule): blank every run of digits that sits in TEXT,
  // not inside a tag (so <h1>, id="foo2", h2/h3 etc. are left alone — those are structural,
  // not a live tally).
  text = text.replace(/<[^>]*>|\d+/g, (m) => (m[0] === "<" ? m : "0"));

  return collapseWhitespace(text);
}

/** Replaces the inner text of every element whose class attribute matches classTokenRe with a placeholder. */
function blankInnerTextOfClassMatch(text, classTokenRe) {
  const openRe = /<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\bclass="([^"]*)"[^>]*>/g;
  let result = "";
  let cursor = 0;
  let m;
  while ((m = openRe.exec(text))) {
    if (!classTokenRe.test(m[2])) continue;
    if (m.index < cursor) continue; // inside an already-blanked region
    const region = scanBalancedTag(text, m.index, m[0]);
    if (!region) continue;
    const openTagLen = m[0].length;
    const innerStart = region.start + openTagLen;
    const innerEnd = region.end - (region.tagName.length + 3); // "</" + name + ">"
    if (innerEnd <= innerStart) continue;
    result += text.slice(cursor, innerStart) + "‹BLANKED›";
    cursor = innerEnd;
    openRe.lastIndex = region.end;
  }
  result += text.slice(cursor);
  return result;
}

function firstDiffIndex(a, b) {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) return i;
  }
  return a.length === b.length ? -1 : len;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─────────────────────────────────────────────────────────────────────────
// Region selectors — decided by inspecting Command once; the SAME selector text is then
// applied, unchanged, to every page.
// ─────────────────────────────────────────────────────────────────────────

const SKIP_RE = () => /<a\b[^>]*\bclass="skip"[^>]*>/i;
const RAIL_RE = () => /<(nav|aside)\b[^>]*\bclass="[^"]*\brail\b[^"]*"[^>]*>/i;
const BAR_RE = () => /<header\b[^>]*\bclass="[^"]*\bhdr1\b[^"]*"[^>]*>/i;
const LIVE_RE = () => /<[a-zA-Z][a-zA-Z0-9]*\b[^>]*\baria-live="[^"]*"[^>]*>/i;
const RECON_RE = () => /<[a-zA-Z][a-zA-Z0-9]*\b[^>]*\bclass="[^"]*\brailCheck\b[^"]*"[^>]*>/i;
const DRAWER_RE = () => /<details\b[^>]*\bclass="menu(?:\s[^"]*)?"[^>]*>/gi;

// ─────────────────────────────────────────────────────────────────────────
// Per-page extraction
// ─────────────────────────────────────────────────────────────────────────

function extractShellArtifacts(text, referenceFunctionNames) {
  const style = extractFirstStyleBody(text);
  const scriptBlocks = extractAllScriptBlocks(text);

  const skip = findFirstRegion(text, SKIP_RE());
  const rail = findFirstRegion(text, RAIL_RE());
  const bar = findFirstRegion(text, BAR_RE());
  const live = findFirstRegion(text, LIVE_RE());
  const recon = findFirstRegion(text, RECON_RE());
  const drawers = findAllRegions(text, DRAWER_RE());

  // Pick "the shell script" block: the one with the highest count of the reference
  // function names. Falls back to the largest block by character length only when NO
  // block contains any reference name at all (see the note in the final report about why
  // this is not simply "the largest <script> block", which is what the brief's own prose
  // says but is contradicted by Command's own file — see limitation note in the report).
  let shellBlock = null;
  let bestScore = -1;
  for (const block of scriptBlocks) {
    let score = 0;
    for (const name of referenceFunctionNames) {
      if (functionDefined(block.body, name)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      shellBlock = block;
    }
  }
  let shellBlockSelection = "name-overlap";
  if (bestScore <= 0 && scriptBlocks.length > 0) {
    shellBlock = scriptBlocks.reduce((a, b) => (b.body.length > a.body.length ? b : a));
    shellBlockSelection = "largest-fallback (no reference function names found in any block)";
  }
  if (scriptBlocks.length === 0) {
    shellBlockSelection = "no <script> blocks found";
  }

  return { style, scriptBlocks, shellBlock, shellBlockSelection, skip, rail, bar, live, recon, drawers, bestScore };
}

function drawerId(region, index) {
  return extractAttr(region.raw, "id") || "#" + index;
}

// ─────────────────────────────────────────────────────────────────────────
// Build the reference (Command) artifacts
// ─────────────────────────────────────────────────────────────────────────

const refRead = readPage(REFERENCE_FILE);
if (refRead.error) {
  console.error("FATAL: could not read reference page " + REFERENCE_FILE + ": " + refRead.error);
  process.exit(2);
}
const refText = refRead.text;

// Find Command's own shell block using the five example functions directly (this cannot be
// circular the way the general "score against reference names" method is, because on
// Command itself we do not yet have a reference name list).
const refScriptBlocksRaw = extractAllScriptBlocks(refText);
let refShellBlock = null;
let refShellScore = -1;
for (const block of refScriptBlocksRaw) {
  let score = 0;
  for (const name of EXAMPLE_SHELL_FUNCTIONS) {
    if (functionDefined(block.body, name)) score++;
  }
  if (score > refShellScore) {
    refShellScore = score;
    refShellBlock = block;
  }
}

if (!refShellBlock || refShellScore === 0) {
  console.error(
    "STOP: none of the reference page's <script> blocks define any of the example shell " +
      "functions (" +
      EXAMPLE_SHELL_FUNCTIONS.join(", ") +
      "). This brief does not cover what to do if Command itself does not contain its own " +
      "named example functions — handing back rather than guessing.",
  );
  process.exit(2);
}

const REFERENCE_FUNCTION_NAMES = extractAllFunctionNames(refShellBlock.body);

const refArtifacts = extractShellArtifacts(refText, REFERENCE_FUNCTION_NAMES);
// Override with the directly-located block so the reference's own comparison is self-consistent.
refArtifacts.shellBlock = refShellBlock;
refArtifacts.shellBlockSelection = "example-function-match (ground truth for Command)";

if (refArtifacts.style === null) {
  console.error("FATAL: reference page has no <style> block at all — cannot build a shared-stylesheet baseline.");
  process.exit(2);
}

const refDrawersById = new Map();
refArtifacts.drawers.forEach((d, i) => refDrawersById.set(drawerId(d, i), d));

const refFunctionSources = new Map();
for (const name of REFERENCE_FUNCTION_NAMES) {
  refFunctionSources.set(name, extractFunctionSource(refShellBlock.body, name));
}

// ─────────────────────────────────────────────────────────────────────────
// Compare one page against the reference
// ─────────────────────────────────────────────────────────────────────────

function threeState(found, isSame) {
  if (!found) return "NOT PRESENT";
  return isSame ? "IDENTICAL" : "DIFFERS";
}

function comparePage(filename) {
  const isReferenceItself = filename === REFERENCE_FILE;
  const read = readPage(filename);
  if (read.error) {
    return { filename, fatalError: read.error };
  }
  const text = read.text;

  let art;
  try {
    art = extractShellArtifacts(text, REFERENCE_FUNCTION_NAMES);
  } catch (e) {
    return { filename, fatalError: "extraction threw: " + (e && e.stack ? e.stack : e) };
  }

  const result = { filename, slug: slugFor(filename) };

  // 1. Stylesheet — verbatim containment, no normalisation.
  if (art.style === null) {
    result.stylesheet = "NOT PRESENT";
  } else if (art.style.includes(refArtifacts.style)) {
    result.stylesheet = "IDENTICAL";
  } else {
    result.stylesheet = "DIFFERS";
    const idx = firstDiffIndex(refArtifacts.style, art.style);
    result.stylesheetDiff = {
      idx,
      ref: refArtifacts.style.slice(Math.max(0, idx), idx + 200),
      page: art.style.slice(Math.max(0, idx), idx + 200),
    };
  }

  // 2. Skip link / rail / header bar / live region / reconciliation line — normalise + blank, compare.
  for (const [key, refRegion, pageRegion] of [
    ["skip", refArtifacts.skip, art.skip],
    ["rail", refArtifacts.rail, art.rail],
    ["bar", refArtifacts.bar, art.bar],
    ["live", refArtifacts.live, art.live],
    ["recon", refArtifacts.recon, art.recon],
  ]) {
    if (!pageRegion) {
      result[key] = "NOT PRESENT";
      continue;
    }
    const refNorm = normalizeAndBlank(refRegion.raw);
    const pageNorm = normalizeAndBlank(pageRegion.raw);
    if (refNorm === pageNorm) {
      result[key] = "IDENTICAL";
    } else {
      result[key] = "DIFFERS";
      const idx = firstDiffIndex(refNorm, pageNorm);
      result[key + "Diff"] = {
        idx,
        ref: refNorm.slice(Math.max(0, idx), idx + 200),
        page: pageNorm.slice(Math.max(0, idx), idx + 200),
      };
    }
  }

  // 3. Drawers — match by id against Command's drawer set.
  const pageDrawersById = new Map();
  art.drawers.forEach((d, i) => pageDrawersById.set(drawerId(d, i), d));
  let identicalDrawers = 0;
  const drawerNotes = [];
  for (const [id, refDrawer] of refDrawersById) {
    const pageDrawer = pageDrawersById.get(id);
    if (!pageDrawer) {
      drawerNotes.push(id + ": NOT PRESENT on this page");
      continue;
    }
    const refNorm = normalizeAndBlank(refDrawer.raw);
    const pageNorm = normalizeAndBlank(pageDrawer.raw);
    if (refNorm === pageNorm) {
      identicalDrawers++;
    } else {
      const idx = firstDiffIndex(refNorm, pageNorm);
      drawerNotes.push(id + ": DIFFERS");
      result["drawerDiff_" + id] = {
        idx,
        ref: refNorm.slice(Math.max(0, idx), idx + 200),
        page: pageNorm.slice(Math.max(0, idx), idx + 200),
      };
    }
  }
  const extraDrawerIds = [...pageDrawersById.keys()].filter((id) => !refDrawersById.has(id));
  for (const id of extraDrawerIds) drawerNotes.push(id + ": present on this page but not on Command");
  result.drawers = {
    found: art.drawers.length,
    identical: identicalDrawers,
    expected: refDrawersById.size,
    notes: drawerNotes,
  };

  // 4. Shell script functions.
  const shellBlock = art.shellBlock;
  const functionStatus = new Map(); // name -> "IDENTICAL" | "DIFFERENT" | "DIFFERENT (page-identity only)" | "ABSENT"
  let identicalFns = 0;
  for (const name of REFERENCE_FUNCTION_NAMES) {
    if (!shellBlock || !functionDefined(shellBlock.body, name)) {
      functionStatus.set(name, "ABSENT");
      continue;
    }
    const pageSrc = extractFunctionSource(shellBlock.body, name);
    const refSrc = refFunctionSources.get(name);
    if (pageSrc === null || refSrc === null) {
      functionStatus.set(name, "ABSENT (unbalanced braces — extraction failed)");
      continue;
    }
    if (normalizeWhitespaceOnly(pageSrc) === normalizeWhitespaceOnly(refSrc)) {
      functionStatus.set(name, "IDENTICAL");
      identicalFns++;
    } else if (normalizeAndBlank(pageSrc) === normalizeAndBlank(refSrc)) {
      // Only differs by one of the four allowed per-page substitutions (e.g. the
      // key === "<page>" comparison inside railLink()).
      functionStatus.set(name, "DIFFERENT (page-identity only)");
    } else {
      functionStatus.set(name, "DIFFERENT");
    }
  }
  result.shellFunctions = {
    total: REFERENCE_FUNCTION_NAMES.length,
    identical: identicalFns,
    statusByName: functionStatus,
    blockSelection: art.shellBlockSelection,
    blockScore: art.bestScore,
  };

  // Verdict.
  const drawersOk =
    result.drawers.found === result.drawers.expected && result.drawers.identical === result.drawers.expected;
  const same =
    result.stylesheet === "IDENTICAL" &&
    result.skip === "IDENTICAL" &&
    result.rail === "IDENTICAL" &&
    result.bar === "IDENTICAL" &&
    drawersOk &&
    result.live === "IDENTICAL" &&
    result.recon === "IDENTICAL" &&
    result.shellFunctions.identical === result.shellFunctions.total;
  result.verdict = same ? "SAME SHELL" : "DRIFT";
  result.isReferenceItself = isReferenceItself;
  return result;
}

// ─────────────────────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────────────────────

const results = pagesToCheck.map(comparePage);

// ─────────────────────────────────────────────────────────────────────────
// Report
// ─────────────────────────────────────────────────────────────────────────

function pad(s, w) {
  s = String(s);
  return s.length >= w ? s.slice(0, w) : s + " ".repeat(w - s.length);
}

console.log("");
console.log("Ward Flow mockup shell sweep — reference: " + REFERENCE_FILE);
console.log(
  "Reference shell script: block " +
    (refArtifacts.scriptBlocks.indexOf(refShellBlock) + 1) +
    " of " +
    refArtifacts.scriptBlocks.length +
    " <script> blocks (" +
    refShellBlock.body.length +
    " chars), selected by " +
    refArtifacts.shellBlockSelection +
    ". Defines " +
    REFERENCE_FUNCTION_NAMES.length +
    " named functions used as the comparison set.",
);
console.log("");

const cols = [
  ["Page", 34],
  ["Stylesheet", 12],
  ["Skip", 12],
  ["Rail", 12],
  ["Bar", 12],
  ["Drawers", 11],
  ["Live", 12],
  ["Recon", 12],
  ["ShellFns", 11],
  ["Verdict", 10],
];
console.log(cols.map(([name, w]) => pad(name, w)).join(" "));
console.log(cols.map(([, w]) => "-".repeat(w)).join(" "));

let allSame = results.length > 0;
for (const r of results) {
  if (r.fatalError) {
    console.log(pad(r.filename, 34) + "FATAL: " + r.fatalError);
    allSame = false;
    continue;
  }
  const label = r.filename + (r.isReferenceItself ? " (ref)" : "");
  const drawersCell = r.drawers.found + "f/" + r.drawers.identical + "i/" + r.drawers.expected + "e";
  const shellFnCell = r.shellFunctions.identical + "/" + r.shellFunctions.total;
  console.log(
    [
      pad(label, 34),
      pad(r.stylesheet, 12),
      pad(r.skip, 12),
      pad(r.rail, 12),
      pad(r.bar, 12),
      pad(drawersCell, 11),
      pad(r.live, 12),
      pad(r.recon, 12),
      pad(shellFnCell, 11),
      pad(r.verdict, 10),
    ].join(" "),
  );
  if (r.verdict !== "SAME SHELL") allSame = false;
}

console.log("");
console.log(
  "Drawers column: <found>f/<identical>i/<expected>e — expected = " +
    refDrawersById.size +
    " (Command's own drawer count: " +
    [...refDrawersById.keys()].join(", ") +
    ").",
);
console.log(
  "ShellFns column: <identical>/<total> — total = " + REFERENCE_FUNCTION_NAMES.length + " reference functions.",
);

// ---- DIFFERS detail (200 chars each side) ----
console.log("");
console.log("=".repeat(78));
console.log("DIFFERS detail (first 200 characters from both sides at the point of divergence)");
console.log("=".repeat(78));

const diffKeys = [
  ["stylesheet", "stylesheetDiff", "STYLESHEET"],
  ["skip", "skipDiff", "SKIP LINK"],
  ["rail", "railDiff", "RAIL"],
  ["bar", "barDiff", "HEADER BAR"],
  ["live", "liveDiff", "LIVE REGION"],
  ["recon", "reconDiff", "RECONCILIATION LINE"],
];

let anyDiffPrinted = false;
for (const r of results) {
  if (r.fatalError) continue;
  for (const [stateKey, diffKey, label] of diffKeys) {
    if (r[stateKey] === "DIFFERS" && r[diffKey]) {
      anyDiffPrinted = true;
      console.log("");
      console.log("--- " + r.filename + " — " + label + " (diverges at offset " + r[diffKey].idx + ") ---");
      console.log("Command : " + JSON.stringify(r[diffKey].ref));
      console.log("Page    : " + JSON.stringify(r[diffKey].page));
    }
  }
  for (const k of Object.keys(r)) {
    if (k.startsWith("drawerDiff_")) {
      anyDiffPrinted = true;
      const id = k.slice("drawerDiff_".length);
      console.log("");
      console.log("--- " + r.filename + " — DRAWER " + id + " (diverges at offset " + r[k].idx + ") ---");
      console.log("Command : " + JSON.stringify(r[k].ref));
      console.log("Page    : " + JSON.stringify(r[k].page));
    }
  }
  if (r.drawers && r.drawers.notes.length) {
    console.log("");
    console.log("--- " + r.filename + " — drawer notes ---");
    for (const n of r.drawers.notes) console.log("  " + n);
    anyDiffPrinted = true;
  }
}
if (!anyDiffPrinted) console.log("(none)");

// ---- Shell function detail ----
console.log("");
console.log("=".repeat(78));
console.log("SHELL FUNCTION detail (ABSENT or DIFFERENT only; IDENTICAL functions omitted)");
console.log("=".repeat(78));

const CAP = 12;
for (const r of results) {
  if (r.fatalError) continue;
  const bad = [...r.shellFunctions.statusByName.entries()].filter(([, status]) => status !== "IDENTICAL");
  if (bad.length === 0) continue;
  console.log("");
  console.log(
    "--- " +
      r.filename +
      " — shell block selection: " +
      r.shellFunctions.blockSelection +
      " (matched " +
      r.shellFunctions.blockScore +
      " reference names) ---",
  );
  for (const [name, status] of bad.slice(0, CAP)) {
    console.log("  " + pad(name, 22) + status);
  }
  if (bad.length > CAP) console.log("  ... and " + (bad.length - CAP) + " more (absent/different)");
}

// ---- Limitations / method notes ----
console.log("");
console.log("=".repeat(78));
console.log("NOTES");
console.log("=".repeat(78));
console.log(
  "- Stylesheet identity is verbatim containment of Command's first <style> block inside\n" +
    "  each page's own first <style> block (no whitespace normalisation), per the brief.\n" +
    "- The six markup regions (skip link, rail, header bar, drawers, live region,\n" +
    "  reconciliation line) are located by plain-text regex + balanced-tag scan, not a DOM\n" +
    "  parser. jsdom is present in node_modules but was deliberately not used: the\n" +
    "  reconciliation line and one drawer (pinMenu) exist only inside a JS string template\n" +
    "  that is rendered at runtime, never as real static DOM, so a DOM parser could not see\n" +
    "  them; a single text-based scanner handles all six regions the same way instead of\n" +
    "  mixing two techniques.\n" +
    '- "The shell script is the largest <script> block" (the brief\'s own wording) is FALSE\n' +
    "  on Command's own file: Command's largest block (163,723 chars) is page-specific\n" +
    "  render/data logic and defines none of openMenu/setInert/trapTab/filterBar/\n" +
    "  selectPatient; the actual shared shell (98,872 chars, exported as\n" +
    "  window.WardFlowShell) is the file's THIRD <script> block, not its largest. This\n" +
    "  script instead selects, per page, whichever <script> block contains the most of\n" +
    '  Command\'s reference function names, falling back to "largest block" only when a\n' +
    "  page's scripts contain none of them at all (as happens for patient-search-third-\n" +
    "  edition.html today). Each page's chosen method is printed above the shell-function\n" +
    "  detail for that page.",
);

console.log("");
console.log(allSame ? "RESULT: all " + results.length + " pages report SAME SHELL." : "RESULT: drift found.");

process.exitCode = allSame ? 0 : 1;
