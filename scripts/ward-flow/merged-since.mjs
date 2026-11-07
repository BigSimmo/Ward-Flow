#!/usr/bin/env node
/**
 * Lists the pull requests merged into a branch since a revision or date, newest first, as Markdown
 * bullets. It feeds the "Merged since the last check" list on the Now page (docs/ward-flow/STATUS.md),
 * so nobody has to hand-summarise hundreds of merge titles.
 *
 *   node scripts/ward-flow/merged-since.mjs --since 2026-11-03            # by date
 *   node scripts/ward-flow/merged-since.mjs --since cd66be7a              # by revision
 *   node scripts/ward-flow/merged-since.mjs --since 2026-11-03 --ref origin/main --count
 *
 * Offline: reads local Git history only. A shallow clone lists only what it holds and says so.
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Parses `git log --first-parent --format=%H%x1f%cs%x1f%s%x1f%b%x1e` output into merge records. */
export function parseMergeLog(raw, secondParentSubject = () => "") {
  const merges = [];
  for (const record of raw.split("\x1e")) {
    const trimmed = record.replace(/^\n+/, "");
    if (!trimmed) continue;
    const [sha, date, subject = "", body = ""] = trimmed.split("\x1f");
    let number;
    let title;
    const merge = /^Merge pull request #(\d+) from \S+/u.exec(subject);
    const squash = /^(.*) \(#(\d+)\)$/u.exec(subject);
    if (merge) {
      number = Number(merge[1]);
      title =
        body
          .split("\n")
          .find((line) => line.trim())
          ?.trim() || secondParentSubject(sha).trim();
    } else if (squash) {
      number = Number(squash[2]);
      title = squash[1].trim();
    } else continue;
    // A PR merged twice (rare: a revert and a re-merge) is listed once, at its latest merge.
    if (merges.some((m) => m.number === number)) continue;
    merges.push({ sha: sha.slice(0, 9), date, number, title: title || "(no title)" });
  }
  return merges;
}

export function toMarkdown(merges) {
  return merges.map((m) => `- #${m.number} (${m.date}): ${m.title}`).join("\n");
}

function main(argv) {
  const arg = (name) => {
    const index = argv.indexOf(name);
    return index === -1 ? undefined : argv[index + 1];
  };
  const since = arg("--since");
  const ref = arg("--ref") ?? "HEAD";
  if (!since) {
    console.error("usage: merged-since.mjs --since <YYYY-MM-DD | revision> [--ref <branch>] [--count]");
    return 2;
  }
  const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const range = /^\d{4}-\d{2}-\d{2}$/u.test(since) ? [`--since=${since}`, ref] : [`${since}..${ref}`];
  const raw = git("log", "--first-parent", "--format=%H%x1f%cs%x1f%s%x1f%b%x1e", ...range);
  const merges = parseMergeLog(raw, (sha) => {
    // An untitled merge: use the branch's first own commit, skipping merges of main into it.
    try {
      const subjects = git("log", "--no-merges", "--format=%s", `${sha}^1..${sha}^2`).trim().split("\n");
      return subjects.at(-1) ?? "";
    } catch {
      return "";
    }
  });
  const shallow = git("rev-parse", "--is-shallow-repository").trim() === "true";
  if (argv.includes("--count")) console.log(String(merges.length));
  else console.log(toMarkdown(merges));
  if (shallow) console.error("note: shallow clone; older merges may be missing.");
  return 0;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url)
  process.exitCode = main(process.argv.slice(2));
