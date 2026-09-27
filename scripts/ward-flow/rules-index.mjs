#!/usr/bin/env node
/**
 * 🔴 **A HAND-MAINTAINED INDEX OF 161 FILES GOES STALE, AND STALENESS IS THE FIRST THEME IN THE
 * INDEX ITSELF.** So this generates it instead.
 *
 * The lesson store is the source of truth. Each lesson carries its own `name`, `description` and
 * `type` in frontmatter. This reads them and writes `docs/ward-flow/RULES.md`.
 *
 *     node scripts/ward-flow/rules-index.mjs            # write the index
 *     node scripts/ward-flow/rules-index.mjs --check    # fail if the committed index is out of date
 *
 * ⚠️ **THE `--check` MODE IS THE POINT.** An index that is merely regenerable still rots, because
 * nobody remembers to regenerate it. `--check` is what a gate runs, so the tree cannot carry an
 * index that disagrees with the store.
 *
 * ✅ **THEMES ARE MATCHED BY KEYWORD, AND ANYTHING UNMATCHED IS LISTED UNDER "UNFILED" RATHER THAN
 * DROPPED.** A classifier that silently discards what it cannot place produces a tidy index that is
 * missing exactly the lessons nobody has thought about yet — which is the failure this store exists
 * to prevent. The unfiled list is a feature; it is the queue of lessons needing a home.
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const STORE = join(process.env.USERPROFILE ?? process.env.HOME ?? "", ".claude", "projects", "D--Repos-Database", "memory");
const OUT = join(process.cwd(), "docs", "ward-flow", "RULES.md");

/** Theme → keywords matched against name + description. Order matters: first match wins. */
const THEMES = [
  ["Staleness — a true statement that stopped being true", ["stale", "expire", "no longer", "lag", "outstanding", "retraction", "supersede", "tree before", "observations"]],
  ["Checks that cannot fail", ["cannot fail", "vacuity", "vacuous", "floor", "safeguard", "mutation", "control", "guard", "coverage", "unfailable", "measuring nothing", "absence"]],
  ["Claims wider than their evidence", ["width", "wider", "scoped", "assert only", "prefix", "enumerate", "grep", "sample", "population", "diagnosis"]],
  ["Never the exit code", ["exit code", "exit-code", "pipe", "failure message", "runner", "wrapper"]],
  ["What no test can see", ["no test", "breakpoint", "token", "css", "render", "visual", "paint", "unreachable", "mockup", "screen"]],
  ["Other chats and agents", ["chat", "agent", "subagent", "peer", "relay", "delegat", "parallel", "verifier", "controller", "model split"]],
  ["Git, merges and protected work", ["git", "merge", "fold", "branch", "worktree", "commit", "backup", "protected", "reflog", "ancestor", "stash"]],
  ["Clinical meaning on screen", ["clinical", "patient", "ward flow", "word", "sentence", "phrase", "disclos", "caveat", "qualif"]],
];

function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return {};
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^(\w+):\s*(.*)$/.exec(line.trim());
    if (kv) out[kv[1]] = kv[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

function collect() {
  if (!existsSync(STORE)) {
    console.error(`lesson store not found at ${STORE}`);
    process.exit(2);
  }
  const files = readdirSync(STORE).filter((f) => f.endsWith(".md") && f !== "MEMORY.md").sort();
  return files.map((file) => {
    const fm = frontmatter(readFileSync(join(STORE, file), "utf8"));
    return { file, description: fm.description ?? "(no description)", type: fm.type ?? "?" };
  });
}

function themeOf(entry) {
  const hay = `${entry.file} ${entry.description}`.toLowerCase();
  for (const [name, keys] of THEMES) if (keys.some((k) => hay.includes(k))) return name;
  return null;
}

function render(entries) {
  const grouped = new Map(THEMES.map(([n]) => [n, []]));
  const unfiled = [];
  for (const e of entries) {
    const t = themeOf(e);
    if (t) grouped.get(t).push(e);
    else unfiled.push(e);
  }
  const lines = [
    "# Ward Flow — the rules, generated",
    "",
    "> 🔴 **GENERATED FILE. DO NOT EDIT BY HAND.**",
    "> `node scripts/ward-flow/rules-index.mjs` regenerates it; `--check` fails when it is out of date.",
    "> **The lesson store is the source of truth** — one file per lesson, written the day something",
    "> went wrong. Edit a lesson there, not here.",
    "",
    `**${entries.length} lessons.** Generated from \`~/.claude/projects/D--Repos-Database/memory\`.`,
    "",
    "⚠️ **A lesson naming a file, function or count can go stale exactly as any other claim does.**",
    "Re-derive before acting on one. This index proves the lessons EXIST, never that they are current.",
    "",
  ];
  for (const [name] of THEMES) {
    const rows = grouped.get(name);
    if (!rows.length) continue;
    lines.push(`## ${name} — ${rows.length}`, "");
    for (const r of rows) lines.push(`- **${r.description}** · \`${r.file}\``);
    lines.push("");
  }
  if (unfiled.length) {
    lines.push(
      `## Unfiled — ${unfiled.length}`,
      "",
      "✅ **Not a defect. This is the queue of lessons that have no theme yet** — listed rather than",
      "dropped, because a classifier that silently discards what it cannot place hides exactly the",
      "lessons nobody has thought about.",
      "",
    );
    for (const r of unfiled) lines.push(`- **${r.description}** · \`${r.file}\``);
    lines.push("");
  }
  return lines.join("\n");
}

const entries = collect();
const text = render(entries);

if (process.argv.includes("--check")) {
  const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (current.trim() === text.trim()) {
    console.log(`rules index is current — ${entries.length} lessons.`);
    process.exit(0);
  }
  console.error(
    `rules index is STALE. The lesson store has ${entries.length} lessons and docs/ward-flow/RULES.md does not match.\n` +
      `Run: node scripts/ward-flow/rules-index.mjs`,
  );
  process.exit(1);
}

writeFileSync(OUT, text, "utf8");
console.log(`wrote ${OUT} — ${entries.length} lessons.`);
