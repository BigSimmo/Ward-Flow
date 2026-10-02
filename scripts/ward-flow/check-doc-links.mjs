#!/usr/bin/env node
/**
 * Fails if a relative link in `docs/ward-flow/**` (or `--all`) points at a file that is not there,
 * or points to a non-existent heading anchor in a target Markdown file.
 *
 * Owner ruling, 17 September 2026 (second round, item 24): "Fix the old broken document links."
 * The 17 September audit counted roughly 59.
 *
 * ⚠️ WHY A BROKEN LINK HERE COSTS MORE THAN ELSEWHERE. This directory is how six AI sessions and
 * the owner hand work to each other. A handover that points at a decision record which has moved
 * does not degrade gracefully — the next reader concludes the decision was never written down, and
 * decides it again, differently. Several documents here exist only because that happened.
 *
 * ⚠️ WHAT IT DOES NOT CHECK. Absolute URLs (http/https), and links inside fenced code blocks
 * (which are usually examples of a path rather than a reference to one). Those absences are
 * deliberate: a checker that flagged an example path would train people to ignore it.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PROJECT_ROOT = fileURLToPath(new URL("../..", import.meta.url));
export const WARD_ROOT = join(PROJECT_ROOT, "docs/ward-flow");

export const LINK = /\[[^\]]*\]\(([^)]+)\)/g;
export const FILE_URL = /\[[^\]]*\]\((file:[^)]+)\)/g;
export const FENCE = /```[\s\S]*?```|`[^`\n]*`/g;

/** Deliberately outside the repository. See the note beside its use. Exact targets only. */
export const EXTERNAL_BY_DESIGN = new Set([
  "../../../development-system.md",
  "../../../../.claude/worktree-ownership.md",
]);

/** Convert a Markdown heading line into its GitHub-compatible anchor slug */
export function headingToSlug(text) {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, "") // strip HTML tags
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // replace markdown links with label
    .replace(/`([^`]+)`/g, "$1") // strip backticks
    .replace(/[^\w\s-]/g, "") // remove punctuation
    .trim()
    .replace(/\s+/g, "-"); // whitespace to hyphens
}

/** Extract all heading slugs and HTML anchor identifiers from Markdown content */
export function extractSlugs(content) {
  const slugs = new Set();
  const counts = {};
  for (const line of content.split("\n")) {
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      const baseSlug = headingToSlug(headingMatch[1]);
      if (baseSlug) {
        if (!counts[baseSlug]) {
          counts[baseSlug] = 1;
          slugs.add(baseSlug);
        } else {
          counts[baseSlug]++;
          slugs.add(`${baseSlug}-${counts[baseSlug] - 1}`);
        }
      }
    }
    const htmlMatches = line.matchAll(/<(?:a|span)[^>]*(?:id|name)=["']([^"']+)["']/gi);
    for (const match of htmlMatches) {
      slugs.add(match[1]);
    }
    const attributeMatch = line.match(/\{#([^}]+)\}/);
    if (attributeMatch) {
      slugs.add(attributeMatch[1]);
    }
  }
  return slugs;
}

const fileSlugCache = new Map();

/** Retrieve cached slugs for a file path */
export function getSlugsForFile(filePath) {
  if (!fileSlugCache.has(filePath)) {
    try {
      fileSlugCache.set(filePath, extractSlugs(readFileSync(filePath, "utf8")));
    } catch {
      fileSlugCache.set(filePath, new Set());
    }
  }
  return fileSlugCache.get(filePath);
}

export function clearSlugCache() {
  fileSlugCache.clear();
}

export function markdownFiles(dir, out = [], rootScan = false) {
  for (const entry of readdirSync(dir)) {
    if (rootScan && ["node_modules", ".git", ".next", "tmp", ".worktrees"].includes(entry)) {
      continue;
    }
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) markdownFiles(path, out, rootScan);
    else if (entry.endsWith(".md")) out.push(path);
  }
  return out;
}

export function brokenLinksIn(file, source, slugGetter = getSlugsForFile) {
  const withoutCode = source.replace(FENCE, (match) => match.replace(/[^\n]/g, " "));
  const broken = [];
  for (const match of withoutCode.matchAll(LINK)) {
    const raw = match[1].trim().split(/\s+/)[0];
    if (/^(https?:|mailto:)/.test(raw)) continue;
    // `file:` URLs are handled separately in the reporter
    if (/^file:/.test(raw)) continue;
    if (EXTERNAL_BY_DESIGN.has(raw)) continue;

    let targetPath = raw;
    let anchor = null;
    const hashIndex = raw.indexOf("#");
    if (hashIndex !== -1) {
      targetPath = raw.slice(0, hashIndex);
      anchor = raw.slice(hashIndex + 1);
    }

    // In-file anchor link e.g. [heading](#some-heading)
    if (targetPath.length === 0) {
      if (anchor && slugGetter) {
        const slugs = slugGetter(file);
        const cleanAnchor = anchor.toLowerCase().replace(/^#/, "");
        if (!slugs.has(anchor) && !slugs.has(cleanAnchor)) {
          broken.push({
            file,
            line: withoutCode.slice(0, match.index).split("\n").length,
            target: raw,
            reason: `anchor '#${anchor}' not found in current file`,
          });
        }
      }
      continue;
    }

    const resolvedTarget = resolve(dirname(file), targetPath);
    if (!existsSync(resolvedTarget)) {
      broken.push({
        file,
        line: withoutCode.slice(0, match.index).split("\n").length,
        target: raw,
        reason: "file does not exist",
      });
      continue;
    }

    // If target exists and has an anchor, check target headings or code line range
    if (anchor) {
      const isSourceFile = /\.(ts|tsx|js|mjs|cjs|json|css|py|sh|ps1|html|ya?ml)$/i.test(resolvedTarget);
      const isLineRange = /^L\d+(-L?\d+)?$/i.test(anchor);

      if (isSourceFile && isLineRange) {
        // Valid GitHub source-code line citation
        continue;
      }

      if (resolvedTarget.endsWith(".md") && slugGetter) {
        const slugs = slugGetter(resolvedTarget);
        const cleanAnchor = anchor.toLowerCase().replace(/^#/, "");
        if (!slugs.has(anchor) && !slugs.has(cleanAnchor)) {
          broken.push({
            file,
            line: withoutCode.slice(0, match.index).split("\n").length,
            target: raw,
            reason: `heading anchor '#${anchor}' not found in target file`,
          });
        }
      }
    }
  }
  return broken;
}

// CLI entrypoint execution
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const isAll = process.argv.includes("--all");
  const scanRoot = isAll ? PROJECT_ROOT : WARD_ROOT;
  const files = markdownFiles(scanRoot, [], isAll);
  const broken = files.flatMap((file) => brokenLinksIn(file, readFileSync(file, "utf8")));

  const fileUrlHits = files.flatMap((file) =>
    [...readFileSync(file, "utf8").matchAll(FILE_URL)].map(() => file)
  );

  console.log(`Scanned ${files.length} markdown file(s) under ${isAll ? "repository root" : "docs/ward-flow"}.\n`);

  if (fileUrlHits.length > 0) {
    const where = [...new Set(fileUrlHits)].map((f) => f.slice(PROJECT_ROOT.length).replaceAll("\\", "/"));
    console.log(`⚠️  ${fileUrlHits.length} file:// link(s) across ${where.length} file(s), which resolve for nobody:`);
    for (const f of where) console.log(`    ${f}`);
    console.log("    Absolute paths into one machine's worktree. Reported, not failed: repointing them");
    console.log("    needs the content they referred to, which only their author ever had. Counting");
    console.log("    them as broken relative links would bury the ones this repo can actually fix.\n");
  }

  if (broken.length === 0) {
    console.log("Every relative link and heading anchor resolves.\n");
    console.log("⚠️  Absolute URLs are NOT checked, so this says nothing about whether");
    console.log("    an external web page still exists.\n");
    process.exit(0);
  }

  console.log("🔴 Links pointing at files or anchors that are not there:\n");
  for (const item of broken) {
    console.log(`  ${item.file.slice(PROJECT_ROOT.length).replaceAll("\\", "/")}:${item.line}  ->  ${item.target} (${item.reason})`);
  }
  console.log(`\n${broken.length} broken link(s) across ${new Set(broken.map((b) => b.file)).size} file(s).`);
  console.log("\nRepoint each one. Where the target is genuinely gone, say so in the text rather than");
  console.log("deleting the sentence — a removed link loses the fact that something once existed.\n");
  process.exit(1);
}
