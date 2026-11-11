import { ESLint } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";
import {
  MAX_LINES_BASELINE,
  MAX_LINES_COUNTING,
  MAX_LINES_DEFAULT,
  MAX_LINES_HEADROOM,
} from "../eslint-rules/max-lines-baseline.mjs";

// Count lines the way the lint cap does (code lines only, D-144): run ESLint's own max-lines rule
// with a cap of 0 on each listed file and read the line count from its message.
async function codeLineCounts(files: string[]) {
  const eslint = new ESLint({
    cwd: process.cwd(),
    cache: false,
    ruleFilter: ({ ruleId }) => ruleId === "max-lines",
    overrideConfig: { rules: { "max-lines": ["error", { ...MAX_LINES_COUNTING, max: 0 }] } },
  });
  const counts = new Map<string, number>();
  for (const result of await eslint.lintFiles(files)) {
    const message = result.messages.find((m) => m.ruleId === "max-lines");
    const count = Number(message?.message.match(/\((\d+)\)/)?.[1]);
    if (!Number.isInteger(count)) throw new Error(`no max-lines count for ${result.filePath}`);
    counts.set(files.find((file) => result.filePath.endsWith(file)) ?? result.filePath, count);
  }
  return counts;
}

describe("file size caps follow the files down", () => {
  const entries = Object.entries(MAX_LINES_BASELINE) as [string, number][];
  let lineCount: (file: string) => number;

  beforeAll(async () => {
    const counts = await codeLineCounts(entries.map(([file]) => file));
    lineCount = (file) => counts.get(file) ?? Number.NaN;
  }, 60_000);

  it("keeps an entry only for a file still over the default cap", () => {
    const backUnder = entries.filter(([file]) => lineCount(file) <= MAX_LINES_DEFAULT).map(([file]) => file);
    expect(backUnder, "delete these entries from eslint-rules/max-lines-baseline.mjs").toEqual([]);
  });

  it("keeps each cap within the headroom of its file", () => {
    const loose = entries
      .filter(([file, cap]) => !(cap - lineCount(file) <= MAX_LINES_HEADROOM))
      .map(([file, cap]) => `${file}: cap ${cap}, file ${lineCount(file)} code lines`);
    expect(loose, "lower these caps in eslint-rules/max-lines-baseline.mjs").toEqual([]);
  });
});
