// What's new, one file per entry (Josh, 4 Nov 2026): parallel pull requests each add their own file
// to `src/components/ward-management/help/whats-new/`, so no two of them edit the same lines. This
// module combines the files into the one list the app shows. `next.config.ts` and
// `vitest.config.mts` inline the result as `__WARD_WHATS_NEW__`, so the build, the dev server and
// the tests all read the same list.
//
// A file is named `<id>.json`, where the id starts with the date of the change
// (`2026-11-04-short-slug.json`), and holds `{ "line": "One plain sentence." }`. The combined list is
// sorted by introduction to the first-parent history (then id), keeps the newest
// WHATS_NEW_LIMIT entries and is returned oldest first. Uncommitted new entries come last.
// Source exports without full Git history keep all notes, so a guessed ordering cannot hide a late
// addition. The existing bundle-budget gate still applies to that larger fallback list. A malformed file stops the build rather than shipping a broken note.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export const WHATS_NEW_DIR = "src/components/ward-management/help/whats-new";
export const WHATS_NEW_LIMIT = 20;

const FILE_NAME = /^(\d{4}-\d{2}-\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*\.json$/;

/**
 * First-parent additions measure when a change landed, rather than when its note was authored.
 * Without full history, retain every note rather than apply a cap to guessed landing dates.
 * An entry absent from the main anchor is a PR/local new note and sorts last for preview.
 */
function introductionOrder(root) {
  const git = (...args) =>
    execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  try {
    if (path.resolve(git("rev-parse", "--show-toplevel")) !== path.resolve(root))
      throw new Error("Not the project checkout root");
    if (git("rev-parse", "--is-shallow-repository") !== "false") throw new Error("shallow history");
    // A PR may have merged newer main into its own first-parent line. Anchor to local main
    // so those imported notes cannot evict the PR's own new note. Equal trees also use main's
    // ordering, keeping a previously tested merge-ref consistent with the eventual main merge.
    let historyRef = "HEAD";
    try {
      const main = "refs/remotes/origin/main";
      const sameTree = git("rev-parse", `${main}^{tree}`) === git("rev-parse", "HEAD^{tree}");
      if (!sameTree) git("merge-base", "--is-ancestor", main, "HEAD");
      historyRef = main;
    } catch {
      // Offline fixtures, detached exports and branches without an applicable main use HEAD.
    }
    const committed = new Set(git("ls-tree", "-r", "--name-only", historyRef, "--", WHATS_NEW_DIR).split("\n"));
    const history = git(
      "log",
      "--first-parent",
      "--diff-merges=first-parent",
      "--diff-filter=A",
      "--format=@%H",
      "--name-only",
      historyRef,
      "--",
      WHATS_NEW_DIR,
    );
    const order = new Map();
    let rank = 1;
    for (const line of history.split("\n")) {
      if (line.startsWith("@")) rank -= 1;
      else if (line.startsWith(`${WHATS_NEW_DIR}/`) && !order.has(line)) order.set(line, rank);
    }
    return (name) => {
      const file = `${WHATS_NEW_DIR}/${name}`;
      if (order.has(file)) return order.get(file);
      if (!committed.has(file)) return 1;
      throw new Error(`No introduction found for ${file}`);
    };
  } catch {
    console.warn(
      "What's new: complete first-parent Git history unavailable; retaining all notes in filename order instead of applying the 20-note cap to guessed landing dates. Existing bundle budgets still apply.",
    );
    return undefined;
  }
}

/** @returns {{ id: string, date: string, line: string }[]} */
export function readWhatsNewEntries(root = process.cwd(), limit = WHATS_NEW_LIMIT) {
  const directory = path.join(root, WHATS_NEW_DIR);
  const entries = [];
  const introduced = introductionOrder(root);
  for (const name of readdirSync(directory)) {
    if (!name.endsWith(".json")) continue;
    const match = FILE_NAME.exec(name);
    if (!match || Number.isNaN(Date.parse(match[1])))
      throw new Error(`${WHATS_NEW_DIR}/${name}: name it <YYYY-MM-DD-short-slug>.json in lower case.`);
    let data;
    try {
      data = JSON.parse(readFileSync(path.join(directory, name), "utf8"));
    } catch (error) {
      throw new Error(`${WHATS_NEW_DIR}/${name}: not valid JSON (${error.message}).`, { cause: error });
    }
    if (!data || typeof data.line !== "string" || data.line.trim() === "" || Object.keys(data).length !== 1)
      throw new Error(`${WHATS_NEW_DIR}/${name}: write exactly { "line": "One plain sentence." }.`);
    entries.push({
      id: name.slice(0, -".json".length),
      date: match[1],
      line: data.line,
      order: introduced?.(name) ?? 0,
    });
  }
  entries.sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id === b.id ? 0 : 1));
  return (introduced ? entries.slice(-limit) : entries).map(({ id, date, line }) => ({ id, date, line }));
}
