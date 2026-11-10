#!/usr/bin/env node
/**
 * Change hotspots (Tier 7 plan, M142, 10 Nov 2026): rank source files by how often they change
 * times how big they are. A big file that changes often is where splitting (M141) pays most.
 *
 *   node scripts/ward-flow/hotspots.mjs                       last 90 days, top 20, src and backend
 *   node scripts/ward-flow/hotspots.mjs --since "30 days ago" --top 40 --json
 *   node scripts/ward-flow/hotspots.mjs --repo <path> --paths src
 *
 * Counts non-merge commits only. In a shallow clone the boundary commit is a grafted snapshot that
 * "adds" every file, so it is left out and the report says the history is shallow. Line counts are
 * read from the working tree; a file that no longer exists is not ranked. Tests are left out unless
 * --include-tests is given. Read-only: it runs `git log` and reads files, nothing else.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SOURCE_FILE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const TEST_FILE = /\.(?:test|spec)\.[a-z]+$|(?:^|\/)(?:tests?|__tests__|test-support)\//;
const IGNORED = /(?:^|\/)(?:node_modules|dist|\.next)\//;
const COMMIT_MARK = "\u0000commit ";
// git expands %x00 to the NUL byte that COMMIT_MARK starts with; an argument cannot hold a raw NUL.
const COMMIT_FORMAT = "%x00commit %H %cI";

/** Parse `git log --format=<COMMIT_FORMAT> --name-only` output into commits with their files. */
export function parseGitLog(text) {
  const commits = [];
  for (const block of text.split(COMMIT_MARK).slice(1)) {
    const [header, ...lines] = block.split("\n");
    const [sha, date] = header.trim().split(" ");
    const files = [...new Set(lines.map((line) => line.trim()).filter(Boolean))];
    commits.push({ sha, date, files });
  }
  return commits;
}

/** Whether a repository path is a source file this report ranks. */
export function isRankedFile(file, { includeTests = false } = {}) {
  if (!SOURCE_FILE.test(file) || IGNORED.test(file)) return false;
  return includeTests || !TEST_FILE.test(file);
}

/**
 * Rank files by commits x lines. `lineCount(file)` returns the file's current line count, or null
 * when the file no longer exists. Commits listed in `excludedShas` (shallow boundaries) are skipped.
 */
export function rankHotspots(commits, lineCount, { excludedShas = new Set(), includeTests = false, top = 20 } = {}) {
  const counted = commits.filter((commit) => !excludedShas.has(commit.sha));
  const changes = new Map();
  for (const commit of counted)
    for (const file of commit.files)
      if (isRankedFile(file, { includeTests })) changes.set(file, (changes.get(file) ?? 0) + 1);
  const ranked = [];
  for (const [file, commitCount] of changes) {
    const lines = lineCount(file);
    if (lines === null) continue;
    ranked.push({ file, commits: commitCount, lines, score: commitCount * lines });
  }
  ranked.sort((a, b) => b.score - a.score || b.commits - a.commits || a.file.localeCompare(b.file));
  const dates = counted.map((commit) => commit.date).sort();
  const mostChanged = [...ranked].sort((a, b) => b.commits - a.commits || b.lines - a.lines)[0] ?? null;
  return {
    commitsCounted: counted.length,
    commitsExcluded: commits.length - counted.length,
    oldest: dates[0] ?? null,
    newest: dates.at(-1) ?? null,
    filesRanked: ranked.length,
    mostChanged,
    top: ranked.slice(0, top),
  };
}

function git(repo, args) {
  // A hook's GIT_DIR or GIT_INDEX_FILE would point git at another repository than `repo`.
  const env = { ...process.env };
  for (const key of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR"]) delete env[key];
  return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", env, maxBuffer: 256 * 1024 * 1024 });
}

/** The shallow boundary commits of `repo`, empty for a full clone. */
export function shallowBoundaries(repo) {
  if (git(repo, ["rev-parse", "--is-shallow-repository"]).trim() !== "true") return new Set();
  const file = resolve(repo, git(repo, ["rev-parse", "--git-path", "shallow"]).trim());
  if (!existsSync(file)) return new Set();
  return new Set(readFileSync(file, "utf8").split("\n").filter(Boolean));
}

/** Run the report against a real repository. */
export function collectHotspots({
  repo,
  since = "90 days ago",
  paths = ["src", "backend"],
  top = 20,
  includeTests = false,
}) {
  const log = git(repo, [
    "log",
    "--no-merges",
    "--no-renames",
    `--since=${since}`,
    `--format=${COMMIT_FORMAT}`,
    "--name-only",
    "--",
    ...paths,
  ]);
  const boundaries = shallowBoundaries(repo);
  const lineCount = (file) => {
    const full = resolve(repo, file);
    if (!existsSync(full)) return null;
    const text = readFileSync(full, "utf8");
    return text === "" ? 0 : text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
  };
  const result = rankHotspots(parseGitLog(log), lineCount, { excludedShas: boundaries, includeTests, top });
  return {
    ...result,
    since,
    paths,
    head: git(repo, ["rev-parse", "--short=8", "HEAD"]).trim(),
    shallow: boundaries.size > 0,
  };
}

/** Plain text report, one ranked file per line. */
export function formatReport(report) {
  const lines = [
    `Change hotspots at ${report.head}, since ${report.since}, paths ${report.paths.join(" ")}`,
    `${report.commitsCounted} non-merge commits counted, ${report.oldest ?? "-"} to ${report.newest ?? "-"}; ${report.filesRanked} files ranked.`,
  ];
  if (report.shallow)
    lines.push(
      `SHALLOW HISTORY: ${report.commitsExcluded} grafted boundary commit(s) left out. Older changes are missing, so counts are low.`,
    );
  lines.push("", "rank  score    commits  lines  file");
  report.top.forEach((row, index) =>
    lines.push(
      `${String(index + 1).padStart(4)}  ${String(row.score).padStart(7)}  ${String(row.commits).padStart(7)}  ${String(row.lines).padStart(5)}  ${row.file}`,
    ),
  );
  if (report.mostChanged)
    lines.push(
      "",
      `Most changed: ${report.mostChanged.file} (${report.mostChanged.commits} commits, ${report.mostChanged.lines} lines).`,
    );
  return lines.join("\n");
}

function parseArguments(argv) {
  const options = { repo: process.cwd(), since: "90 days ago", paths: ["src", "backend"], top: 20, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = () => {
      const next = argv[++index];
      if (next === undefined) throw new Error(`${flag} needs a value`);
      return next;
    };
    if (flag === "--repo") options.repo = resolve(value());
    else if (flag === "--since") options.since = value();
    else if (flag === "--top") options.top = Number.parseInt(value(), 10);
    else if (flag === "--paths") options.paths = value().split(/[ ,]+/).filter(Boolean);
    else if (flag === "--json") options.json = true;
    else if (flag === "--include-tests") options.includeTests = true;
    else throw new Error(`unknown option ${flag}`);
  }
  if (!Number.isInteger(options.top) || options.top < 1) throw new Error("--top must be a whole number above 0");
  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error(`[hotspots] ${error.message}`);
    process.exit(2);
  }
  const report = collectHotspots(options);
  console.log(options.json ? JSON.stringify(report, null, 2) : formatReport(report));
}
