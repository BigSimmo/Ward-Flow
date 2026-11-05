// What's new, one file per entry (Josh, 4 Nov 2026): parallel pull requests each add their own file
// to `src/components/ward-management/help/whats-new/`, so no two of them edit the same lines. This
// module combines the files into the one list the app shows. `next.config.ts` and
// `vitest.config.mts` inline the result as `__WARD_WHATS_NEW__`, so the build, the dev server and
// the tests all read the same list.
//
// A file is named `<id>.json`, where the id starts with the date of the change
// (`2026-11-04-short-slug.json`), and holds `{ "line": "One plain sentence." }`. The combined list is
// sorted by filename date and then id and retains every valid entry. The corner card limits its
// own display; Help can show every note, including older-dated entries merged later. Identical
// source files produce the same feed without relying on Git history. A malformed file stops the
// build rather than shipping a broken note.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export const WHATS_NEW_DIR = "src/components/ward-management/help/whats-new";
// Keep explicit caller limits available; the app retains all notes on every build host.
export const WHATS_NEW_LIMIT = Number.POSITIVE_INFINITY;

const FILE_NAME = /^(\d{4}-\d{2}-\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*\.json$/;

/** @returns {{ id: string, date: string, line: string }[]} */
export function readWhatsNewEntries(root = process.cwd(), limit = WHATS_NEW_LIMIT) {
  const directory = path.join(root, WHATS_NEW_DIR);
  const entries = [];
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
    });
  }
  entries.sort((a, b) => (a.id < b.id ? -1 : a.id === b.id ? 0 : 1));
  return entries.slice(-limit);
}
