#!/usr/bin/env node
/**
 * Fails if a relative link in `docs/ward-flow/**` points at a file that is not there.
 *
 * Owner ruling, 17 September 2026 (second round, item 24): "Fix the old broken document links."
 * The 17 September audit counted roughly 59.
 *
 * ⚠️ WHY A BROKEN LINK HERE COSTS MORE THAN ELSEWHERE. This directory is how six AI sessions and
 * the owner hand work to each other. A handover that points at a decision record which has moved
 * does not degrade gracefully — the next reader concludes the decision was never written down, and
 * decides it again, differently. Several documents here exist only because that happened.
 *
 * ⚠️ WHAT IT DOES NOT CHECK. Absolute URLs, anchors within a file, and links inside fenced code
 * blocks (which are usually examples of a path rather than a reference to one). Those absences are
 * deliberate: a checker that flagged an example path would train people to ignore it.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const ROOT = join(PROJECT_ROOT, "docs/ward-flow");

const LINK = /\[[^\]]*\]\(([^)]+)\)/g;
const FILE_URL = /\[[^\]]*\]\((file:[^)]+)\)/g;
const FENCE = /```[\s\S]*?```|`[^`\n]*`/g;

/** Deliberately outside the repository. See the note beside its use. Exact targets only. */
const EXTERNAL_BY_DESIGN = new Set(["../../../development-system.md", "../../../../.claude/worktree-ownership.md"]);

function markdownFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) markdownFiles(path, out);
    else if (entry.endsWith(".md")) out.push(path);
  }
  return out;
}

export function brokenLinksIn(file, source) {
  const withoutCode = source.replace(FENCE, (match) => match.replace(/[^\n]/g, " "));
  const broken = [];
  for (const match of withoutCode.matchAll(LINK)) {
    const raw = match[1].trim().split(/\s+/)[0];
    if (/^(https?:|mailto:|#)/.test(raw)) continue;
    // `file:` URLs are a DIFFERENT failure and are counted separately below. They are absolute
    // paths into one machine's worktree, so they resolve for nobody else — including the person who
    // wrote them, once that worktree is gone. Reporting them as "broken relative links" would bury
    // sixteen real ones under thirty-eight of a kind nothing in this repo can fix.
    if (/^file:/.test(raw)) continue;
    // Deliberately outside the repository. `docs/ward-flow/lessons/MEMORY.md` is a generated index
    // of the lesson store, which lives in the user's Claude memory directory rather than here, and
    // two of its rows point at files above the repository root on purpose. Listing them by exact
    // target keeps the exemption narrow: any OTHER escaping link is still reported.
    if (EXTERNAL_BY_DESIGN.has(raw)) continue;
    const target = raw.split("#")[0];
    if (target.length === 0) continue;
    if (!existsSync(resolve(dirname(file), target))) {
      broken.push({
        file,
        line: withoutCode.slice(0, match.index).split("\n").length,
        target,
      });
    }
  }
  return broken;
}

const files = markdownFiles(ROOT);
const broken = files.flatMap((file) => brokenLinksIn(file, readFileSync(file, "utf8")));

const fileUrlHits = files.flatMap((file) => [...readFileSync(file, "utf8").matchAll(FILE_URL)].map(() => file));

console.log(`Scanned ${files.length} markdown file(s) under docs/ward-flow.\n`);

if (fileUrlHits.length > 0) {
  const where = [...new Set(fileUrlHits)].map((f) => f.slice(PROJECT_ROOT.length).replaceAll("\\", "/"));
  console.log(`⚠️  ${fileUrlHits.length} file:// link(s) across ${where.length} file(s), which resolve for nobody:`);
  for (const f of where) console.log(`    ${f}`);
  console.log("    Absolute paths into one machine's worktree. Reported, not failed: repointing them");
  console.log("    needs the content they referred to, which only their author ever had. Counting");
  console.log("    them as broken relative links would bury the ones this repo can actually fix.\n");
}

if (broken.length === 0) {
  console.log("Every relative link resolves.\n");
  console.log("⚠️  Absolute URLs and in-file anchors are NOT checked, so this says nothing about");
  console.log("    whether a linked page still exists on the web or a heading still has that name.\n");
  process.exit(0);
}

console.log("🔴 Links pointing at files that are not there:\n");
for (const item of broken) {
  console.log(`  ${item.file.slice(PROJECT_ROOT.length).replaceAll("\\", "/")}:${item.line}  ->  ${item.target}`);
}
console.log(`\n${broken.length} broken link(s) across ${new Set(broken.map((b) => b.file)).size} file(s).`);
console.log("\nRepoint each one. Where the target is genuinely gone, say so in the text rather than");
console.log("deleting the sentence — a removed link loses the fact that something once existed.\n");
process.exit(1);
