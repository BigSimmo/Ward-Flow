// What's new, one file per entry (Josh, 4 Nov 2026): parallel pull requests each add their own file
// to `src/components/ward-management/help/whats-new/`, so no two of them edit the same lines. This
// module combines the files into the one list the app shows. `next.config.ts` and
// `vitest.config.mts` inline the result as `__WARD_WHATS_NEW__`, so the build, the dev server and
// the tests all read the same list.
//
// A file is named `<id>.json`, where the id starts with the date of the change
// (`2026-11-04-short-slug.json`), and holds `{ "line": "One plain sentence." }`. The combined list is
// sorted by date and then id and returned oldest first. It keeps the last six months (Josh, 5 Nov
// 2026): an entry stays while its date is on or after the build's Perth calendar date less
// WHATS_NEW_MONTHS calendar months, so a build on 5 Nov 2026 keeps 5 May 2026 and later. Where that
// day does not exist, the window starts on the month's last day (a build on 31 Aug keeps 28 or 29
// Feb). Older entry files stay in the repository; the build just leaves them out. A malformed file
// stops the build rather than shipping a broken note, even when it is outside the window.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export const WHATS_NEW_DIR = "src/components/ward-management/help/whats-new";
export const WHATS_NEW_MONTHS = 6;

const FILE_NAME = /^(\d{4}-\d{2}-\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*\.json$/;

/**
 * The first date (YYYY-MM-DD) What's new keeps: `now`'s calendar date in Perth, less `months`
 * calendar months, on the month's last day where that day does not exist.
 * @param {Date} now
 * @param {number} months
 */
export function whatsNewCutoff(now, months = WHATS_NEW_MONTHS) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Perth" }).format(now);
  const [year, month, day] = today.split("-").map(Number);
  const monthIndex = year * 12 + (month - 1) - months;
  const y = Math.floor(monthIndex / 12);
  const m = (monthIndex % 12) + 1;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const pad = (value) => String(value).padStart(2, "0");
  return `${String(y).padStart(4, "0")}-${pad(m)}-${pad(Math.min(day, lastDay))}`;
}

/**
 * @param {string} [root]
 * @param {Date} [now] the build date; tests pass a fixed one
 * @returns {{ id: string, date: string, line: string }[]}
 */
export function readWhatsNewEntries(root = process.cwd(), now = new Date()) {
  const cutoff = whatsNewCutoff(now);
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
    entries.push({ id: name.slice(0, -".json".length), date: match[1], line: data.line });
  }
  entries.sort((a, b) => (a.date === b.date ? (a.id < b.id ? -1 : 1) : a.date < b.date ? -1 : 1));
  return entries.filter((entry) => entry.date >= cutoff);
}
