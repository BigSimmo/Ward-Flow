#!/usr/bin/env node
/**
 * check-docs-script-refs.mjs — verify that every `npm run <script>` mentioned in
 * the maintained docs corresponds to a real script in package.json.
 *
 * ward-flow/check-doc-links.mjs validates selected local file paths; this checker
 * covers maintained `npm run <script>` references — a renamed/removed script leaves
 * stale instructions that the agents (Codex/Claude/Cursor) then follow. This closes
 * that gap.
 *
 * Only references inside inline code spans (`npm run x`) and fenced code blocks are
 * scanned, so prose like "npm run the build" is never misread. Placeholder tokens
 * (containing <…>) and an explicit allowlist are skipped.
 *
 * Scans root entrypoints, nested client instructions, and docs/**\/*.md excluding docs/archive, docs/audit,
 * and dated point-in-time filenames (historical records). Pass --all to include them.
 *
 * Paired docs-script-refs historical markers exclude only preserved source sections.
 * Markers must be balanced even in --all mode. Runs in verify:cheap and Ward static CI.
 * Historical directories
 * and dated point-in-time records stay excluded unless --all is requested.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scanAll = process.argv.includes("--all");

const DATED_DOC = /\b20\d{2}-\d{2}(-\d{2})?\b/;
// 🔴 "lessons" ADDED 2026-09-12, when the lesson store was versioned into
// docs/ward-flow/lessons/ and this gate went red on the same night. A lesson is a record of a
// past incident and QUOTES the command that was run at the time — the single stale reference
// was `npm run gate`, inside the lesson about a pipe that reported a refusal as success. That
// command is the evidence; rewriting it to a script that exists today would falsify the record
// the file exists to preserve. Same category as the branch-review-ledger "Checks" cells named
// in the ALLOWLIST comment below.
// ⚠️ The cost: a lesson RECOMMENDING a command that no longer exists is no longer caught here.
// `--all` still scans these, so it is skipped by default rather than made unreachable.
const HISTORICAL_DIRS = new Set(["archive", "audit", "lessons"]);

// Root prose is selected explicitly; the original source README has a maintained
// boundary surrounding a marked historical record, not live foreign setup advice.
export const MAINTAINED_ROOT_DOCS = Object.freeze(["README.md", "README.local-source.md", "SECURITY.md"]);

// Script tokens that appear in docs as illustrative placeholders, or real scripts
// that were renamed but are legitimately referenced in historical records (e.g. the
// branch-review-ledger "Checks" cells record what was run at the time).
const ALLOWLIST = new Set([
  "<script>",
  "<name>",
  "your-script",
  "test:e2e:advisory", // renamed to test:e2e:regression (2026-07); kept for historical ledger accuracy
]);

/** Preserve historical evidence while checking all current surrounding guidance. */
export function stripHistoricalSections(markdown, includeHistorical = false) {
  let inside = false;
  const result = [];
  for (const line of markdown.split("\n")) {
    const trimmed = line.trim();
    if (/<!--\s*docs-script-refs:historical-/.test(line)) {
      if (trimmed === "<!-- docs-script-refs:historical-start -->" && !inside) inside = true;
      else if (trimmed === "<!-- docs-script-refs:historical-end -->" && inside) inside = false;
      else throw new Error("Malformed, nested or reversed historical command markers");
      result.push("");
    } else result.push(inside && !includeHistorical ? "" : line);
  }
  if (inside) throw new Error("Unclosed historical command section");
  return result.join("\n");
}

/** Find nested native instructions without traversing dependencies or other worktrees. */
export function collectInstructionDocs(dir, root = dir, targets = []) {
  const excluded = new Set(["node_modules", ".git", ".next", ".worktrees", "worktrees", "archive", "audit"]);
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && !excluded.has(entry.name))
      collectInstructionDocs(path.join(dir, entry.name), root, targets);
    else if (entry.isFile() && ["AGENTS.md", "CLAUDE.md", "GEMINI.md"].includes(entry.name))
      targets.push(path.relative(root, path.join(dir, entry.name)).split(path.sep).join("/"));
  }
  return targets;
}

/** Script names defined in package.json. */
export function parsePackageScripts(pkgJsonText) {
  const pkg = JSON.parse(pkgJsonText);
  return new Set(Object.keys(pkg.scripts ?? {}));
}

/**
 * Extract `npm run <script>` tokens that appear inside inline code spans or fenced
 * code blocks. Returns the unique script names referenced. `pnpm run` / `yarn run`
 * are matched too for completeness.
 */
export function extractScriptRefs(markdown) {
  const codeRegions = [];
  for (const m of markdown.matchAll(/```[\s\S]*?```/g)) codeRegions.push(m[0]);
  for (const m of markdown.matchAll(/`[^`\n]+`/g)) codeRegions.push(m[0]);

  const names = new Set();
  for (const region of codeRegions) {
    for (const m of region.matchAll(/\b(?:npm|pnpm|yarn)\s+run\s+([A-Za-z0-9][A-Za-z0-9:_-]*)/g)) {
      names.add(m[1]);
    }
  }
  return [...names];
}

/** Referenced script names that are neither defined nor allowlisted. */
export function findStaleRefs(refs, validScripts, allowlist = ALLOWLIST) {
  return refs.filter((name) => !validScripts.has(name) && !allowlist.has(name) && !name.includes("<"));
}

function collectDocs(dirRelative, targets) {
  for (const entry of readdirSync(path.join(repoRoot, dirRelative), { withFileTypes: true })) {
    const entryRelative = path.posix.join(dirRelative, entry.name);
    if (entry.isDirectory()) {
      if (HISTORICAL_DIRS.has(entry.name) && !scanAll) continue;
      collectDocs(entryRelative, targets);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    if (!scanAll && DATED_DOC.test(entry.name)) continue;
    targets.push(entryRelative);
  }
}

function main() {
  const validScripts = parsePackageScripts(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  const targets = [...MAINTAINED_ROOT_DOCS, ...collectInstructionDocs(repoRoot)];
  collectDocs("docs", targets);

  let stale = 0;
  let checked = 0;
  for (const target of new Set(targets)) {
    let markdown;
    try {
      markdown = readFileSync(path.join(repoRoot, target), "utf8");
    } catch {
      continue;
    }
    let current;
    try {
      current = stripHistoricalSections(markdown, scanAll);
    } catch (error) {
      stale++;
      console.error(`${target}: ${error.message}`);
      continue;
    }
    const refs = extractScriptRefs(current);
    checked += refs.length;
    const bad = findStaleRefs(refs, validScripts);
    if (bad.length > 0) {
      stale += bad.length;
      console.error(`\n${target}:`);
      for (const name of bad) console.error(`  STALE  npm run ${name}  (no such script in package.json)`);
    }
  }

  if (stale > 0) {
    console.error(`\ndocs script-ref check FAILED: ${stale} stale reference(s) across ${checked} checked.`);
    process.exit(1);
  }
  console.log(`docs script-ref check passed: ${checked} npm-run reference(s) resolve to real scripts.`);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
