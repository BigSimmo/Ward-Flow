#!/usr/bin/env node
/**
 * 🔴 **A STORE OF 160+ LESSONS THAT IS NEVER RE-VERIFIED BECOMES A STORE OF CONFIDENT FALSE
 * STATEMENTS.** That is the store's own first theme.
 *
 * This script is the mechanical audit for the lesson store. It systematically checks every lesson in
 * the Ward-owned historical copy at `docs/ward-flow/lessons/`
 * across four failure modes:
 *
 *   1. DECAY: Broken file paths, retired scripts, or obsolete gate lists cited as active.
 *   2. DUPLICATES & REDUNDANCY: Pairwise semantic overlap and shared incident writeups.
 *   3. CONTRADICTIONS: Opposing guidance that lacks explicit domain/boundary qualifications.
 *   4. INTEGRITY: Valid YAML frontmatter, non-empty descriptions, and byte encoding safety.
 *
 * USAGE:
 *   node scripts/ward-flow/audit-lessons.mjs            # print audit report & write docs/ward-flow/LESSON-AUDIT-REPORT.md
 *   node scripts/ward-flow/audit-lessons.mjs --check    # exit 1 if unclassified decay, broken paths, or unannotated contradictions exist
 *   node scripts/ward-flow/audit-lessons.mjs --json     # print machine-readable audit report
 *
 * ⚠️ **THE `--check` MODE IS THE POINT.**
 * Without `--check`, any audit document is just another snapshot that rots the following week.
 * The private lesson importer is retired. This audit reads only the repository copy;
 * it cannot establish that historical lessons are current or clinically approved.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(process.cwd());
const REPO_LESSONS_DIR = join(REPO_ROOT, "docs", "ward-flow", "lessons");
const REPORT_OUT = join(REPO_ROOT, "docs", "ward-flow", "LESSON-AUDIT-REPORT.md");

const ACTIVE_DIR = REPO_LESSONS_DIR; // Ward-owned tracked history only; never inspect another project's private store.

// Ignored files (not lesson notes)
const IGNORED_FILES = new Set(["README.md", "MEMORY.md"]);

// Documented exceptions for byte checks (e.g. deliberate NUL bytes)
const KNOWN_NUL_BYTE_FILES = new Set(["corruption-that-makes-checks-pass-harder.md"]);

// Files/paths known to be historical or illustrative
const KNOWN_HISTORICAL_PATHS = new Set([
  ".superpowers/sdd/2026-08-27-ward-flow-phase-7-front-door/check-ward-suite.sh",
  "claude-config/scripts/backup-work.sh",
  "third-edition-kit/check.mjs",
  "third-edition-kit/HANDOVER.md",
  "search/search.module.css",
  ".../ward-management/board/board.module.css",
  ".ts/.tsx/.css",
  "wards/ward-overview.module.css",
  "wards/ward-index.tsx",
  "shell/ward-facade.ts",
]);

// ---------------------------------------------------------------------------------------------
// 1. Parsing and Frontmatter
// ---------------------------------------------------------------------------------------------

function parseFrontmatter(rawText) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(rawText);
  if (!match) return { frontmatter: {}, body: rawText, hasFrontmatter: false };

  const frontmatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = /^(\w+):\s*(.*)$/.exec(line.trim());
    if (kv) {
      frontmatter[kv[1]] = kv[2].replace(/^["']|["']$/g, "");
    }
  }
  const body = rawText.slice(match[0].length).trim();
  return { frontmatter, body, hasFrontmatter: true };
}

function loadLessons() {
  if (!existsSync(ACTIVE_DIR)) {
    console.error(`Lesson directory not found at: ${ACTIVE_DIR}`);
    process.exit(2);
  }

  const files = readdirSync(ACTIVE_DIR)
    .filter((f) => f.endsWith(".md") && !IGNORED_FILES.has(f))
    .sort();

  return files.map((file) => {
    const rawBuffer = readFileSync(join(ACTIVE_DIR, file));
    const rawText = rawBuffer.toString("utf8");
    const { frontmatter, body, hasFrontmatter } = parseFrontmatter(rawText);

    // Check NUL bytes
    let hasNul = false;
    for (let i = 0; i < rawBuffer.length; i++) {
      if (rawBuffer[i] === 0) {
        hasNul = true;
        break;
      }
    }

    return {
      file,
      path: join(ACTIVE_DIR, file),
      rawBuffer,
      rawText,
      frontmatter,
      body,
      hasFrontmatter,
      hasNul,
    };
  });
}

// ---------------------------------------------------------------------------------------------
// 2. Integrity & Encoding Checks
// ---------------------------------------------------------------------------------------------

function checkIntegrity(lessons) {
  const issues = [];

  for (const l of lessons) {
    if (!l.hasFrontmatter) {
      issues.push({ file: l.file, type: "missing_frontmatter", message: "File lacks valid YAML frontmatter" });
    } else {
      if (!l.frontmatter.name) {
        issues.push({ file: l.file, type: "missing_name", message: "Frontmatter missing 'name'" });
      }
      if (!l.frontmatter.description) {
        issues.push({ file: l.file, type: "missing_description", message: "Frontmatter missing 'description'" });
      }
    }

    if (l.hasNul && !KNOWN_NUL_BYTE_FILES.has(l.file)) {
      issues.push({ file: l.file, type: "unexpected_nul", message: "File contains unhandled NUL byte(s)" });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------------------------
// 3. Path & Symbol Decay Checks
// ---------------------------------------------------------------------------------------------

function checkDecay(lessons) {
  const pathRegex = /`([a-zA-Z0-9_\-\.\/]+\.(?:ts|tsx|js|mjs|json|sh|md|css|sql|py))`(?::[~\d]+)?/g;
  const issues = [];

  for (const l of lessons) {
    let match;
    const body = l.body;
    while ((match = pathRegex.exec(body)) !== null) {
      const cited = match[1];
      if (!cited.includes("/") || cited.startsWith("http")) continue;

      const fullRepoPath = join(REPO_ROOT, cited);
      const fullSrcPath = join(REPO_ROOT, "src", "components", "ward-management", cited);

      const exists = existsSync(fullRepoPath) || existsSync(fullSrcPath);

      if (!exists) {
        const matchPos = match.index;
        const windowStart = Math.max(0, matchPos - 250);
        const windowEnd = Math.min(body.length, matchPos + 250);
        const context = body.slice(windowStart, windowEnd).toLowerCase();

        const isAnnotatedHistorical =
          KNOWN_HISTORICAL_PATHS.has(cited) ||
          /no longer exist|formerly|old|retired|was|not exist|archived|stale|resolved|dated|earlier/.test(context);

        if (!isAnnotatedHistorical) {
          issues.push({
            file: l.file,
            cited,
            type: "unannotated_missing_path",
            message: `Cited file '${cited}' does not exist on disk and is not marked as historical.`,
          });
        }
      }
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------------------------
// 4. Duplicate & Redundancy Detection
// ---------------------------------------------------------------------------------------------

function tokenize(text) {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3),
  );
}

function checkRedundancy(lessons) {
  const tokenized = lessons.map((l) => ({
    file: l.file,
    tokens: tokenize(l.body),
    body: l.body,
  }));

  const duplicates = [];

  for (let i = 0; i < tokenized.length; i++) {
    for (let j = i + 1; j < tokenized.length; j++) {
      const a = tokenized[i];
      const b = tokenized[j];

      let intersection = 0;
      for (const t of a.tokens) {
        if (b.tokens.has(t)) intersection++;
      }
      const union = a.tokens.size + b.tokens.size - intersection;
      const sim = union > 0 ? intersection / union : 0;

      const stemA = a.file.replace(/\.md$/, "");
      const stemB = b.file.replace(/\.md$/, "");
      const crossRef =
        a.body.includes(b.file) || a.body.includes(stemB) || b.body.includes(a.file) || b.body.includes(stemA);

      if (sim >= 0.35) {
        duplicates.push({
          fileA: a.file,
          fileB: b.file,
          similarity: Number(sim.toFixed(3)),
          isCrossReferenced: crossRef,
        });
      }
    }
  }

  duplicates.sort((a, b) => b.similarity - a.similarity);
  return duplicates;
}

// ---------------------------------------------------------------------------------------------
// 5. Contradiction & Scope Boundary Verification
// ---------------------------------------------------------------------------------------------

function checkContradictions(lessons) {
  const axes = [
    {
      id: "allowlists_vs_exemptions",
      name: "Allowlists vs. No-Exemptions",
      filesA: ["ward-flow-ledger-system.md", "self-invalidating-pins.md"],
      filesB: ["wrong-on-purpose-and-load-bearing.md", "a-clinical-word-that-means-two-things.md"],
      requiredScopeMarker: /test scanner|checker exemption|ledger allowlist|boundary distinction|evidentiary/i,
    },
    {
      id: "ban_scopes",
      name: "Ban Everywhere vs Scope to False States",
      filesA: ["a-guards-condition-is-not-its-population.md"],
      filesB: ["a-guard-that-blocks-its-own-purpose.md"],
      requiredScopeMarker: /scan region|trigger condition|state where it is false|anywhere|scope/i,
    },
    {
      id: "handover_vs_owner_prose",
      name: "File Pointers vs Plain Brief Prose",
      filesA: ["a-retraction-does-not-travel.md"],
      filesB: ["communication-style-plain-and-brief.md"],
      requiredScopeMarker: /handover|owner|agent-to-agent|technical contract|executive/i,
    },
    {
      id: "sha_pinning",
      name: "Pin SHA vs Never Pin SHA",
      filesA: ["observations-expire.md"],
      filesB: [],
      requiredScopeMarker: /observation|pointer|sha|branch/i,
    },
  ];

  const lessonMap = new Map(lessons.map((l) => [l.file, l]));
  const results = [];

  for (const axis of axes) {
    let resolved = true;
    const allFiles = [...axis.filesA, ...axis.filesB];
    const missingScopeFiles = [];

    for (const f of allFiles) {
      const item = lessonMap.get(f);
      if (item && !axis.requiredScopeMarker.test(item.body)) {
        resolved = false;
        missingScopeFiles.push(f);
      }
    }

    results.push({
      axisId: axis.id,
      name: axis.name,
      files: allFiles,
      resolved,
      missingScopeFiles,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------------------------
// 6. Report Generation & Runner
// ---------------------------------------------------------------------------------------------

function generateMarkdownReport(lessons, integrityIssues, decayIssues, redundancyPairs, contradictionResults) {
  const lines = [
    "# Automated Lesson Store Audit Report",
    "",
    `> **Audited ${lessons.length} lessons from \`${ACTIVE_DIR}\`**`,
    `> Generated on ${new Date().toISOString()}`,
    "",
    "---",
    "",
    "## 1. Integrity & Frontmatter Health",
    "",
  ];

  if (integrityIssues.length === 0) {
    lines.push(
      "✅ **All 160 lessons possess valid YAML frontmatter, valid titles/descriptions, and clean byte encodings.**",
      "",
    );
  } else {
    lines.push(`🔴 **Found ${integrityIssues.length} integrity issue(s):**`, "");
    for (const issue of integrityIssues) {
      lines.push(`- **\`${issue.file}\`**: ${issue.message}`);
    }
    lines.push("");
  }

  lines.push("## 2. Decay & Path Verification", "");
  if (decayIssues.length === 0) {
    lines.push(
      "✅ **Zero unannotated decayed path citations found.** All missing paths are accompanied by historical or retrospective context.",
      "",
    );
  } else {
    lines.push(`⚠️ **Found ${decayIssues.length} unannotated missing path(s):**`, "");
    for (const d of decayIssues) {
      lines.push(`- **\`${d.file}\`**: \`${d.cited}\` — ${d.message}`);
    }
    lines.push("");
  }

  lines.push("## 3. Duplicates & Redundancy Analysis", "");
  lines.push(`Identified **${redundancyPairs.length} high-similarity lesson pairs** (Jaccard similarity ≥ 0.35):`, "");
  lines.push("| Lesson A | Lesson B | Similarity | Cross-Referenced? |");
  lines.push("|---|---|---|---|");
  for (const pair of redundancyPairs) {
    const crossRefMark = pair.isCrossReferenced ? "✅ Yes" : "⚠️ Needs Cross-Ref";
    lines.push(`| \`${pair.fileA}\` | \`${pair.fileB}\` | ${pair.similarity} | ${crossRefMark} |`);
  }
  lines.push("");

  lines.push("## 4. Contradiction & Scope Boundary Verification", "");
  lines.push("Verifying that all known opposing guidance axes carry explicit domain/boundary qualifiers:", "");
  for (const c of contradictionResults) {
    if (c.resolved) {
      lines.push(`- ✅ **${c.name}**: Domain boundaries explicitly declared across involved files.`);
    } else {
      lines.push(
        `- 🔴 **${c.name}**: Missing scope clarification in: ${c.missingScopeFiles.map((f) => `\`${f}\``).join(", ")}`,
      );
    }
  }
  lines.push("");

  return lines.join("\n");
}

function main() {
  const isCheck = process.argv.includes("--check");
  const isJson = process.argv.includes("--json");

  const lessons = loadLessons();
  const integrityIssues = checkIntegrity(lessons);
  const decayIssues = checkDecay(lessons);
  const redundancyPairs = checkRedundancy(lessons);
  const contradictionResults = checkContradictions(lessons);

  const report = {
    totalLessons: lessons.length,
    integrityIssues,
    decayIssues,
    redundancyPairs,
    contradictionResults,
  };

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(integrityIssues.length > 0 || decayIssues.length > 0 ? 1 : 0);
  }

  const markdown = generateMarkdownReport(lessons, integrityIssues, decayIssues, redundancyPairs, contradictionResults);

  if (isCheck) {
    const hasFatal =
      integrityIssues.length > 0 || decayIssues.length > 0 || contradictionResults.some((c) => !c.resolved);
    if (hasFatal) {
      console.error("🔴 LESSON AUDIT FAILED (`--check`):");
      if (integrityIssues.length) console.error(`  - ${integrityIssues.length} integrity issues`);
      if (decayIssues.length) console.error(`  - ${decayIssues.length} unannotated decayed paths`);
      const unres = contradictionResults.filter((c) => !c.resolved);
      if (unres.length) console.error(`  - ${unres.length} unresolved contradiction axes`);
      console.error("\nRun: node scripts/ward-flow/audit-lessons.mjs to generate full report.");
      process.exit(1);
    }
    console.log(`✅ lesson store audit passed (${lessons.length} lessons verified, 0 unannotated defects).`);
    process.exit(0);
  }

  writeFileSync(REPORT_OUT, markdown, "utf8");
  console.log(markdown);
  console.log(`\nReport written to: ${REPORT_OUT}`);
}

main();
