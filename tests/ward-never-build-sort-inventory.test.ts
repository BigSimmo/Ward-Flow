import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { SORT_INVENTORY, SORT_ORDER_CLASSES, type SortInventoryEntry } from "./ward-never-build-sort-inventory";

/*
 * Never-build rule in behaviour, not just wording (audit M116, D-71; D-110's neutral fit line).
 *
 * `ward-never-build-drift-guard.test.ts` catches suggesting words. This file catches the order
 * itself: every `.sort(` or `.toSorted(` comparator in `src/components/ward-management` keyed on
 * ready, free, occupancy, fit, score, rank, catchment or a like word must have an entry in
 * `ward-never-build-sort-inventory.ts` saying what it sorts, by what, and why that order is allowed
 * (or that it NEEDS JOSH). A comparator that calls a helper in the same file (`byName`,
 * `compareSites(a, b, lens)`) is read through that helper, two calls deep.
 *
 * Fixing a NEEDS JOSH list is Josh's call: this guard only makes the order visible and stops a new
 * capacity-ordered list arriving unannounced.
 */

const ROOT = join(process.cwd(), "src/components/ward-management");

/** Words that make a comparator a capacity, fit or score ordering. Matched on whole camelCase
 *  parts, so `readyForNextAt` counts as "ready" but `already` and `profit` do not. */
const CAPACITY_WORDS = new Set([
  "ready",
  "free",
  "occupancy",
  "occupied",
  "vacant",
  "vacancy",
  "vacancies",
  "fit",
  "fits",
  "score",
  "scores",
  "rank",
  "ranked",
  "ranking",
  "available",
  "availability",
  "capacity",
  "catchment",
  "percent",
  "beds",
  "rate",
  "eligible",
  "eligibility",
  "suitable",
  "suitability",
  "best",
  "spare",
  "empty",
  "full",
  "fullness",
  "fullest",
  "allocatable",
  "staffed",
  "supply",
  "headroom",
  "nearest",
  "distance",
  "road",
]);

type Source = { file: string; source: string };
type SortCall = { file: string; line: number; text: string; capacityWords: string[]; source: string };

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/u.test(name) && !/\.test\.tsx?$/u.test(name) ? [path] : [];
  });
}

/** The index of the bracket that closes the one at `open`. */
function closing(source: string, open: number): number {
  let depth = 0;
  for (let at = open; at < source.length; at++) {
    if ("([{".includes(source[at])) depth++;
    else if (")]}".includes(source[at]) && --depth === 0) return at;
  }
  return source.length;
}

/** A `const name = …;` or top-level `function name(…) {…}` in the same file, or "". */
function definition(source: string, name: string): string {
  const found = new RegExp(`(?:const|function)\\s+${name}\\b`, "u").exec(source);
  if (!found) return "";
  const isFunction = source.startsWith("function", found.index);
  let depth = 0;
  for (let at = found.index; at < source.length; at++) {
    const char = source[at];
    if ("([{".includes(char)) depth++;
    else if (")]}".includes(char)) {
      depth--;
      if (isFunction && depth === 0 && char === "}" && source[source.lastIndexOf("\n", at) + 1] === "}")
        return source.slice(found.index, at + 1);
    } else if (char === ";" && depth === 0) return source.slice(found.index, at + 1);
  }
  return source.slice(found.index);
}

/** The comparator plus the same-file helpers it names or calls, two levels deep. */
function withHelpers(source: string, comparator: string): string {
  let text = comparator;
  let frontier = comparator;
  const seen = new Set<string>();
  for (let level = 0; level < 2; level++) {
    const names = frontier.match(/\b[A-Za-z_$][\w$]*(?=\s*[([])|^[A-Za-z_$][\w$]*$/gu) ?? [];
    frontier = "";
    for (const name of new Set(names)) {
      if (seen.has(name)) continue;
      seen.add(name);
      frontier += `\n${definition(source, name)}`;
    }
    text += frontier;
  }
  return text;
}

function words(text: string): string[] {
  return (text.match(/[A-Za-z_$][\w$]*/gu) ?? []).flatMap((name) =>
    name
      .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
      .replaceAll("_", " ")
      .toLowerCase()
      .split(/\s+/u),
  );
}

/** Every sort call in the sources, skipping comment lines and calls inside a string. */
function sortCalls(sources: readonly Source[]): SortCall[] {
  return sources.flatMap(({ file, source }) =>
    [...source.matchAll(/\.(?:sort|toSorted)\(/gu)].flatMap((call) => {
      const lineStart = source.lastIndexOf("\n", call.index) + 1;
      const lineEnd = source.indexOf("\n", call.index);
      if (/^\s*(\/\/|\*|\/\*)/u.test(source.slice(lineStart, lineEnd))) return [];
      if ((source.slice(lineStart, call.index).match(/"/gu) ?? []).length % 2 === 1) return [];
      const open = call.index + call[0].length - 1;
      const comparator = source.slice(open + 1, closing(source, open)).trim();
      const capacityWords = [...new Set(words(withHelpers(source, comparator)).filter((w) => CAPACITY_WORDS.has(w)))];
      return [
        {
          file,
          line: source.slice(0, call.index).split("\n").length,
          text: `(${comparator.replace(/\s+/gu, " ")})`,
          capacityWords,
          source,
        },
      ];
    }),
  );
}

const capacityWordsOf = (source: string, text: string) =>
  new Set(words(withHelpers(source, text)).filter((word) => CAPACITY_WORDS.has(word)));

/** An entry covers a call when the call holds its text AND every capacity word the call sorts on
 *  is in that text (or a helper it names). Adding `b.freeBeds - a.freeBeds ||` in front of a
 *  declared `byName` therefore needs a new declaration. */
function covers(entry: SortInventoryEntry, call: SortCall): boolean {
  if (entry.file !== call.file || !call.text.includes(entry.match)) return false;
  const declared = capacityWordsOf(call.source, entry.match);
  return call.capacityWords.every((word) => declared.has(word));
}

/** Capacity-keyed calls with no inventory entry, as `file:line [words] comparator`. */
function undeclared(calls: readonly SortCall[], inventory: readonly SortInventoryEntry[]): string[] {
  return calls
    .filter((call) => call.capacityWords.length > 0 && !inventory.some((entry) => covers(entry, call)))
    .map((call) => `${call.file}:${call.line} [${call.capacityWords.join(", ")}] ${call.text.slice(0, 140)}`);
}

const SOURCES: Source[] = sourceFiles(ROOT).map((path) => ({
  file: relative(ROOT, path).replaceAll("\\", "/"),
  source: readFileSync(path, "utf8"),
}));
const CALLS = sortCalls(SOURCES);

describe("never-build sort inventory (D-71, audit M116)", () => {
  it("finds the sort calls it guards", () => {
    expect(SOURCES.length).toBeGreaterThan(100);
    expect(CALLS.length).toBeGreaterThan(300);
    expect(CALLS.filter((call) => call.capacityWords.length > 0).length).toBeGreaterThan(30);
  });

  it("every comparator keyed on ready, free, occupancy, fit, score or rank has an inventory entry", () => {
    expect(
      undeclared(CALLS, SORT_INVENTORY),
      "declare each new order in tests/ward-never-build-sort-inventory.ts; a capacity order beside a pick, pull or ask action is NEEDS JOSH (D-71)",
    ).toEqual([]);
  });

  it("each inventory entry still matches its own sort calls, so the list cannot go stale", () => {
    const stale = SORT_INVENTORY.flatMap((entry) => {
      const found = CALLS.filter((call) => covers(entry, call)).length;
      const expected = entry.occurrences ?? 1;
      return found === expected ? [] : [`${entry.file}: "${entry.match}" matches ${found} calls, not ${expected}`];
    });
    expect(stale).toEqual([]);
  });

  it("each entry is classified, keyed and explained", () => {
    for (const entry of SORT_INVENTORY) {
      expect(SORT_ORDER_CLASSES, `${entry.file}: ${entry.match}`).toContain(entry.order);
      expect(entry.key.trim(), `${entry.file}: ${entry.match}`).not.toBe("");
      expect(entry.reason.trim().length, `${entry.file}: ${entry.match}`).toBeGreaterThan(10);
    }
  });

  it("the flagged lists stay listed for Josh until he rules (D-71)", () => {
    const needsJosh = SORT_INVENTORY.filter((entry) => entry.order === "NEEDS JOSH").map((entry) => entry.file);
    expect(needsJosh).toEqual(
      expect.arrayContaining([
        "bed-meeting/tv-derivations.ts",
        "handover/handover-beds.tsx",
        "handover/handover-phone.tsx",
        "wards/ward-index.tsx",
        "statistics/statistics-map-view.tsx",
        "movements/movement-horizon-gantt.tsx",
      ]),
    );
  });

  it("catches a planted comparator on free beds, read through a helper, and passes a wait order", () => {
    const planted: Source[] = [
      {
        file: "planted/pick-list.tsx",
        source: [
          "const byFreeBeds = (a: Row, b: Row) => b.freeBeds - a.freeBeds;",
          "export const pickList = (rows: Row[]) => [...rows].sort(byFreeBeds);",
          "export const helper = (rows: Row[]) => rows.toSorted((a, b) => fitScore(b) - fitScore(a));",
          "export const queue = (rows: Row[]) => rows.sort((a, b) => a.openedAt - b.openedAt);",
          "// rows.sort((a, b) => b.ready - a.ready) in a comment is not code",
          'const words = "rows.sort((a, b) => b.ready - a.ready)";',
        ].join("\n"),
      },
    ];
    const calls = sortCalls(planted);
    expect(calls).toHaveLength(3);
    expect(undeclared(calls, [])).toEqual([
      "planted/pick-list.tsx:2 [free, beds] (byFreeBeds)",
      "planted/pick-list.tsx:3 [fit, score] ((a, b) => fitScore(b) - fitScore(a))",
    ]);
    const declared: SortInventoryEntry = {
      file: "planted/pick-list.tsx",
      match: "byFreeBeds",
      list: "wards",
      key: "free beds",
      order: "NEEDS JOSH",
      reason: "planted for the guard's own test",
    };
    expect(undeclared(calls, [declared])).toHaveLength(1);
  });
});
