import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import baseline from "./figure-dictionary-inline-baseline.json";
import { stripSourceComments } from "./helpers/strip-source-comments";

/**
 * NO INLINE FIGURE (figures spec 3.7, D-220): a census of each dictionary figure's defining
 * expression outside its home module, per file, over every file under `src/`.
 *
 * Modelled on the M121 `* 100` ratchet and the word list's exact counts. The count is EXACT in both
 * directions: a screen that works a figure out inline again fails, and a screen moved onto its row
 * (`src/components/ward-management/figures/`) fails too until its number in
 * `tests/figure-dictionary-inline-baseline.json` is lowered or removed. Never raise a number to make
 * this pass: read the figure from its row or its home function instead.
 *
 * The markers live in the baseline JSON, not in the app, so they cost no bundle bytes. Comments are
 * stripped first (`strip-source-comments.ts`), so an explanation never counts as an offence.
 *
 * Reads every file under src as text: that is the point of the guard (a census over every file),
 * the reason the source-text ratchet allows, so it is listed in `tests/source-text-tests.json`.
 */

type Baseline = {
  markers: Record<string, string[]>;
  homes: Record<string, string[]>;
  counts: Record<string, Record<string, number>>;
};

const root = path.resolve(import.meta.dirname, "..");
const { markers, homes, counts } = baseline as Baseline;

function sourceFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const relative = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(relative);
      else if (/\.tsx?$/.test(entry.name)) files.push(relative);
    }
  };
  walk("src");
  return files.sort();
}

const code = new Map(
  sourceFiles().map((file) => [file, stripSourceComments(readFileSync(path.join(root, file), "utf8"))]),
);

function census(id: string): Record<string, number> {
  const patterns = markers[id]!.map((marker) => new RegExp(marker, "g"));
  const homeFiles = new Set(homes[id] ?? []);
  const found: Record<string, number> = {};
  for (const [file, text] of code) {
    if (homeFiles.has(file)) continue;
    const hits = patterns.reduce((sum, pattern) => sum + (text.match(pattern)?.length ?? 0), 0);
    if (hits > 0) found[file] = hits;
  }
  return found;
}

describe("no inline figure: each figure is worked out in its home or read from its row", () => {
  it("names a home that exists for every figure with one, and no home for an unknown figure", () => {
    for (const [id, files] of Object.entries(homes)) {
      expect(Object.keys(markers), `homes.${id} has no markers`).toContain(id);
      for (const file of files) expect(existsSync(path.join(root, file)), `${id} home ${file}`).toBe(true);
    }
    expect(Object.keys(counts).filter((id) => !(id in markers))).toEqual([]);
  });

  it.each(Object.keys(markers))("%s: the per-file count matches the baseline exactly", (id) => {
    expect(
      census(id),
      `Inline "${id}" expressions changed. A new one: read the figure from its row or home function. ` +
        "One removed: lower or remove its number in tests/figure-dictionary-inline-baseline.json.",
    ).toEqual(counts[id] ?? {});
  });
});
