// M135: audit to-dos are tracked to closure.
// Every it.todo / test.fixme must name an owner: a PR or issue number, Josh, a D-number, or the
// audit item (M<n>) its file or text belongs to. A to-do is stale when the PR that blocks it has
// merged (read from local Git history: the PR it names in a blocked/held/waits line, or the PRs its
// cited decision says it waits for), or when it waits on a ruling that decisions.md now records.
// Known stale to-dos are listed below; the list may only shrink, and an entry must be removed once
// its to-do is closed.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { collect } from "../scripts/ward-flow/skip-inventory.mjs";

type Site = { file: string; line: number; kind: string; title: string | null; reason: string | null };

const ROOT = new URL("..", import.meta.url);
const decisions = readFileSync(new URL("docs/ward-flow/decisions.md", ROOT), "utf8");

function mergedPullRequests(): Set<number> | null {
  try {
    const subjects = execFileSync("git", ["log", "--format=%s", "HEAD"], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const merged = new Set<number>();
    for (const m of subjects.matchAll(/^Merge pull request #(\d+)\b|\(#(\d+)\)$/gmu)) merged.add(Number(m[1] ?? m[2]));
    return merged.size > 0 ? merged : null;
  } catch {
    return null;
  }
}
const merged = mergedPullRequests();

/** The lines around a to-do (its comment block and title), where its owner and blockers are named. */
function context(site: Site): string {
  const lines = readFileSync(new URL(site.file, ROOT), "utf8").split("\n");
  const start = Math.max(0, site.line - 9);
  return [...lines.slice(start, site.line + 2), site.title ?? "", site.reason ?? ""].join("\n");
}

function owner(site: Site, text: string): string | null {
  const audit = /ward-audit-(m\d+)/iu.exec(site.file);
  if (audit) return audit[1].toUpperCase();
  const token = /#\d{3,}|\bJosh\b|\bD-\d+\b|\bM\d+\b|\bissue\b/u.exec(text);
  return token ? token[0] : null;
}

/** PRs a to-do waits on: named on a blocked/held/waits line, or by the D-entry it cites as blocked. */
function blockingPullRequests(text: string, log = decisions): number[] {
  const prs = new Set<number>();
  for (const line of text.split("\n")) {
    if (!/\b(?:blocked|held by|holds?|waits?|until)\b/iu.test(line)) continue;
    for (const m of line.matchAll(/(?:PRs?\s*)?#(\d{3,})/gu)) prs.add(Number(m[1]));
    for (const m of line.matchAll(/\bD-(\d+)\b/gu)) {
      const entry = log.slice(log.search(new RegExp(`^## D-${m[1]}\\.`, "mu")));
      const body = entry.slice(0, entry.indexOf("\n## ", 4) === -1 ? undefined : entry.indexOf("\n## ", 4));
      for (const sentence of body.split(/(?<=\.)\s/u)) {
        if (!/\bwait/iu.test(sentence) || !/\bmerge/iu.test(sentence)) continue;
        for (const pr of sentence.matchAll(/#(\d{3,})/gu)) prs.add(Number(pr[1]));
      }
    }
  }
  return [...prs].sort();
}

/** A to-do that waits on "Josh's ruling on X" is answered once a decision heading names X. */
function answeredRuling(text: string, log = decisions): string | null {
  const wait = /ruling on ([a-z][a-z -]{3,40}?)\)/iu.exec(text);
  if (!wait) return null;
  const topic = wait[1].trim().toLowerCase();
  const heading = log.split("\n").find((line) => line.startsWith("## D-") && line.toLowerCase().includes(topic));
  return heading ? heading.slice(3, heading.indexOf(".")) : null;
}

type Finding = { key: string; problem: string };
function findings(sites: Site[]): Finding[] {
  const out: Finding[] = [];
  for (const site of sites.filter((s) => s.kind === "todo" || s.kind === "fixme")) {
    const text = context(site);
    const key = `${site.file} :: ${(site.title ?? `line ${site.line}`).slice(0, 60)}`;
    if (!owner(site, text)) out.push({ key, problem: "names no owner (PR, issue, Josh, D-number or audit item)" });
    if (merged) {
      const done = blockingPullRequests(text).filter((pr) => merged.has(pr));
      if (done.length > 0) out.push({ key, problem: `blocking PR ${done.map((n) => `#${n}`).join(", ")} has merged` });
    }
    const ruling = answeredRuling(text);
    if (ruling) out.push({ key, problem: `waits on a ruling that ${ruling} now records` });
  }
  return out;
}

// Stale on 10 Nov 2026 (M135 audit). Each needs its to-do replaced by a real test; remove the entry
// in the same change. The three D-115 to-dos (items 3, 4 and 6, which waited for #1581 and #1583)
// were closed in this change, so the list is empty.
const KNOWN_STALE: string[] = [];

describe("M135 audit to-dos are tracked to closure", () => {
  const { sites } = collect() as { sites: Site[] };
  const found = findings(sites);

  it("finds the to-dos at all", () => {
    expect(sites.filter((s) => s.kind === "todo").length).toBeGreaterThan(5);
  });

  it("no new to-do lacks an owner or outlives its blocker", () => {
    const fresh = found.filter((f) => !KNOWN_STALE.includes(f.key)).map((f) => `${f.key}: ${f.problem}`);
    expect(fresh).toEqual([]);
  });

  it.runIf(merged !== null)("each known stale to-do is still stale; remove its entry once it is closed", () => {
    const keys = new Set(found.map((f) => f.key));
    expect(KNOWN_STALE.filter((key) => !keys.has(key))).toEqual([]);
  });

  it("the check bites on each kind of stale to-do", () => {
    const log =
      "## D-900. Something (1 Jan 2027)\n- Items 3 wait until PRs #1581 and #1583 merge.\n## D-901. No initials search (1 Jan 2027)\n";
    expect(blockingPullRequests("// Blocked (D-900 item 3): an open PR holds that file.", log)).toEqual([1581, 1583]);
    expect(blockingPullRequests("// Blocked: held by #1234 until it merges")).toEqual([1234]);
    expect(blockingPullRequests("// Nothing waits here")).toEqual([]);
    expect(answeredRuling("needs Josh's ruling on initials search)", log)).toBe("D-901");
    expect(answeredRuling("needs Josh's ruling on bed colours)", log)).toBeNull();
    const plain = { file: "tests/x.test.ts", line: 1, kind: "todo", title: "something", reason: null };
    expect(owner(plain, "something")).toBeNull();
    expect(owner(plain, "waits for #1600")).toBe("#1600");
    expect(owner({ ...plain, file: "tests/ward-audit-m36-config.test.ts" }, "")).toBe("M36");
  });
});
