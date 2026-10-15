import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MAX_LINES_BASELINE, MAX_LINES_DEFAULT, MAX_LINES_HEADROOM } from "../eslint-rules/max-lines-baseline.mjs";

const lineCount = (file: string) => readFileSync(file, "utf8").split("\n").length;

describe("file size caps follow the files down", () => {
  const entries = Object.entries(MAX_LINES_BASELINE) as [string, number][];

  it("keeps an entry only for a file still over the default cap", () => {
    const backUnder = entries.filter(([file]) => lineCount(file) <= MAX_LINES_DEFAULT).map(([file]) => file);
    expect(backUnder, "delete these entries from eslint-rules/max-lines-baseline.mjs").toEqual([]);
  });

  it("keeps each cap within the headroom of its file", () => {
    const loose = entries
      .filter(([file, cap]) => cap - lineCount(file) > MAX_LINES_HEADROOM)
      .map(([file, cap]) => `${file}: cap ${cap}, file ${lineCount(file)} lines`);
    expect(loose, "lower these caps in eslint-rules/max-lines-baseline.mjs").toEqual([]);
  });
});
