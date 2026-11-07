import { describe, expect, it } from "vitest";
import { parseMergeLog, toMarkdown } from "../scripts/ward-flow/merged-since.mjs";

const record = (sha: string, date: string, subject: string, body = "") => `${sha}\x1f${date}\x1f${subject}\x1f${body}\x1e`;

describe("merged-since", () => {
  it("reads titles from merge bodies, squash subjects and the untitled-merge fallback", () => {
    const raw = [
      record("a".repeat(40), "2026-11-08", "Merge pull request #12 from BigSimmo/x", "Build the thing\n\nmore"),
      record("b".repeat(40), "2026-11-07", "Tidy the page (#11)"),
      record("c".repeat(40), "2026-11-07", "Merge pull request #10 from BigSimmo/y", ""),
      record("d".repeat(40), "2026-11-06", "Merge pull request #12 from BigSimmo/x", "Earlier merge of the same PR"),
      record("e".repeat(40), "2026-11-06", "A direct commit with no PR"),
    ].join("\n");
    const merges = parseMergeLog(raw, () => "First branch commit\n");
    expect(merges.map((m) => [m.number, m.title])).toEqual([
      [12, "Build the thing"],
      [11, "Tidy the page"],
      [10, "First branch commit"],
    ]);
    expect(toMarkdown(merges).split("\n")[0]).toBe("- #12 (2026-11-08): Build the thing");
  });
});
