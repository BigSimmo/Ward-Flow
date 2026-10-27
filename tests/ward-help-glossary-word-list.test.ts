import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { glossaryForSites } from "@/components/ward-management/help/ward-help-content";

// P4: Help's glossary and docs/ward-flow/word-list.md must name the same words.
// Site codes come from the site directory and are left out (glossaryForSites with no sites).
// The "Save problems" section lists on-screen messages, not glossary words.
const md = readFileSync(join(process.cwd(), "docs/ward-flow/word-list.md"), "utf8");

function wordListTerms(): string[] {
  const terms: string[] = [];
  let section = "";
  for (const line of md.split("\n")) {
    const heading = /^## (.+)$/.exec(line);
    if (heading) section = heading[1];
    const row = /^\| \*\*(.+?)\*\*/.exec(line);
    if (row && section !== "Save problems") terms.push(row[1].toLowerCase());
  }
  return terms;
}

describe("glossary and word list", () => {
  const glossary = glossaryForSites([]).map((t) => t.term.toLowerCase());
  const words = wordListTerms();

  it("every Help glossary word is in word-list.md", () => {
    expect(glossary.filter((term) => !words.includes(term))).toEqual([]);
  });

  it("every word-list.md word is in the Help glossary", () => {
    expect(words.filter((term) => !glossary.includes(term))).toEqual([]);
  });
});
