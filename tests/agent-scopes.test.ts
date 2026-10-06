import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The review subagents under `.claude/agents/` each carry a `## Scope` list of backticked
 * paths and globs telling the agent where to look. Nothing pinned those paths, so when the RAG
 * module moved into `src/lib/rag/` the `rag-retrieval-reviewer` and
 * `clinical-governance-reviewer` scopes kept pointing at `src/lib/rag*.ts` and
 * `src/lib/{...,rag-quote-verification,rag-answer-support,...}.ts` — none of which matched a
 * file, and a `src/lib/rag*.ts` glob does not descend into the directory (audit M35). The
 * clinical-governance reviewer's grounded-evidence checks are the safety surface AGENTS.md
 * "RAG ranking protection" names as `src/lib/rag/**`, so its scope has to reach it.
 *
 * This test brace-expands every backticked scope entry and requires it to match at least one
 * path in the tree. The RAG-facing reviewers it once pinned to `src/lib/rag/**` were archived with
 * PsychSift on 26 September 2026; the archive is checked below.
 */

const repoRoot = process.cwd();
const agentsDir = join(repoRoot, ".claude/agents");

function braceExpand(pattern: string): string[] {
  const match = /\{([^{}]*)\}/.exec(pattern);
  if (!match) return [pattern];
  const [whole, inner] = match;
  return inner.split(",").flatMap((alternative) => braceExpand(pattern.replace(whole, alternative.trim())));
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git" || entry === ".next") continue;
    const full = join(dir, entry);
    const rel = full.slice(repoRoot.length + 1).replaceAll("\\", "/");
    if (statSync(full).isDirectory()) {
      out.push(`${rel}/`);
      walk(full, out);
    } else {
      out.push(rel);
    }
  }
  return out;
}

const tree = walk(repoRoot);

function globToRegExp(glob: string): RegExp {
  let source = "";
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i];
    if (char === "*") {
      if (glob[i + 1] === "*") {
        source += ".*";
        i += 1;
        if (glob[i + 1] === "/") i += 1;
      } else {
        source += "[^/]*";
      }
    } else if (/[.+?^${}()|[\]\\]/.test(char)) {
      source += `\\${char}`;
    } else {
      source += char;
    }
  }
  return new RegExp(`^${source}$`);
}

function matchesTree(glob: string): boolean {
  const regExp = globToRegExp(glob);
  return tree.some((entry) => regExp.test(entry) || regExp.test(entry.replace(/\/$/, "")));
}

function scopeEntries(markdown: string): string[] {
  const scope = /## Scope\n([\s\S]*?)(?:\n## |$)/.exec(markdown);
  if (!scope) return [];
  return [...scope[1].matchAll(/`([^`]+)`/g)]
    .map((entry) => entry[1])
    .filter((entry) => /^[\w./{}*,-]+$/.test(entry) && isRepoRelative(entry));
}

/**
 * Only repo-root-relative entries are checked. A scope line may also carry a fragment relative
 * to an earlier entry ("esp. `clinical-dashboard/{...}.tsx`" under `src/components/**`), which
 * cannot be resolved without parsing the prose.
 */
function isRepoRelative(entry: string): boolean {
  const head = entry.split("/")[0].replace(/\{.*$/, "");
  return head.length > 0 && tree.includes(`${head}/`);
}

const hasAgentConfig = existsSync(agentsDir);
const agents = hasAgentConfig ? readdirSync(agentsDir).filter((name) => name.endsWith(".md")) : [];
function describeConfiguredAgents(name: string, body: () => void) {
  if (hasAgentConfig) describe(name, body);
}

if (!hasAgentConfig) {
  describe("public review-agent configuration", () => {
    it("ships Ward instructions without partial Claude or Cursor agent configuration", () => {
      expect(readFileSync(join(repoRoot, "AGENTS.md"), "utf8")).toContain("Ward Flow");
      expect(existsSync(join(repoRoot, ".claude"))).toBe(false);
      const cursorDir = join(repoRoot, ".cursor");
      if (existsSync(cursorDir)) {
        expect(readdirSync(cursorDir).sort()).toEqual([
          "cloud-agent-install.sh",
          "cloud-agent-start.sh",
          "environment.json",
        ]);
      }
    });
  });
}

describeConfiguredAgents("review-agent scopes", () => {
  it("finds agents with a scope list", () => {
    // Pinned exactly rather than as a floor: after the four PsychSift reviewers were removed
    // (Josh, 26 September), only the rescoped Ward Flow frontend reviewer carries a scope list.
    // An exact list still fails if the parser silently finds nothing, and also if an agent
    // gains or loses a scope without this test being updated on purpose.
    const withScope = agents.filter((name) => scopeEntries(readFileSync(join(agentsDir, name), "utf8")).length > 0);
    expect(withScope).toEqual(["frontend-ui-reviewer.md"]);
  });

  for (const name of agents) {
    const entries = scopeEntries(readFileSync(join(agentsDir, name), "utf8"));
    for (const entry of entries) {
      for (const expanded of braceExpand(entry)) {
        it(`${name} scope entry ${expanded} matches a path in the tree`, () => {
          expect(matchesTree(expanded), `${name}: \`${entry}\` names ${expanded}, which matches nothing`).toBe(true);
        });
      }
    }
  }

  // The PsychSift-only reviewers left .claude/agents with PsychSift (26 September 2026). They are
  // archived, not deleted: each archived file still carries its scope list, so it can be restored
  // with its history.
  it.each([
    "clinical-governance-reviewer.md",
    "ingestion-worker-reviewer.md",
    "rag-retrieval-reviewer.md",
    "supabase-schema-guardian.md",
    "frontend-ui-reviewer.md",
  ])("the PsychSift %s is kept in .claude/agents-archive/psychsift", (name) => {
    const markdown = readFileSync(join(repoRoot, ".claude/agents-archive/psychsift", name), "utf8");
    expect(markdown).toMatch(/## Scope\n/);
  });

  it("frontend-ui-reviewer is scoped to Ward Flow's screens", () => {
    const markdown = readFileSync(join(agentsDir, "frontend-ui-reviewer.md"), "utf8");
    expect(scopeEntries(markdown)).toContain("src/components/ward-management/**");
  });
});

/**
 * Cursor loads its own copies of some Claude surfaces. They are the same rules for a different
 * editor, so where the Claude twin carries a safety contract the Cursor copy must carry it too
 * (audit L62, L102, L132): the repo-auditor is triage-only, the Supabase skill's repository
 * override cannot depend on a workstation path, and `.cursorignore` must not start with a BOM
 * (`.editorconfig` is `charset = utf-8`; a BOM on line 1 would silently break a real pattern
 * moved there).
 */
describeConfiguredAgents("cursor twins of the claude surfaces", () => {
  it("cursor repo-auditor skill is triage-only, like the claude repo-auditor agent", () => {
    const cursor = readFileSync(join(repoRoot, ".cursor/skills/repo-auditor/SKILL.md"), "utf8");
    const claude = readFileSync(join(repoRoot, ".claude/agents/repo-auditor.md"), "utf8");
    for (const contract of [
      "Do not delete or move files during a review",
      "treat as candidates only",
      "is **not** dead even if statically unimported",
    ]) {
      expect(claude, `claude twin lost its contract: ${contract}`).toContain(contract);
      expect(cursor, `cursor repo-auditor must carry the triage contract: ${contract}`).toContain(contract);
    }
    expect(cursor).not.toMatch(/safely remove/i);
  });

  it(".cursorignore has no UTF-8 byte-order mark", () => {
    const bytes = readFileSync(join(repoRoot, ".cursorignore"));
    expect([bytes[0], bytes[1], bytes[2]], ".cursorignore starts with EF BB BF").not.toEqual([0xef, 0xbb, 0xbf]);
  });
});
