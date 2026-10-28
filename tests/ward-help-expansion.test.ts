import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GLOSSARY, glossaryForSites } from "@/components/ward-management/help/ward-help-content";
import {
  CONFUSABLE_TERMS,
  glossaryGroup,
  relatedTerms,
} from "@/components/ward-management/help-content/ward-help-glossary";
import { ACCESSIBILITY_HELP, COMMON_QUESTIONS } from "@/components/ward-management/help-content/ward-help-reference";
import { searchHelp } from "@/components/ward-management/help/ward-help-search-index";

describe("Help expansion source parity", () => {
  it("retains meanings, classifies generated forms and active site codes, and has no missing related term", () => {
    const docs = readFileSync("docs/ward-flow/word-list.md", "utf8");
    for (const entry of glossaryForSites([])) {
      expect(docs, entry.term).toContain(entry.term);
      expect(glossaryGroup(entry.term)).toBeTruthy();
    }
    expect(glossaryGroup("Form 1A")).toBe("Records and forms");
    expect(glossaryGroup("TEST-SITE")).toBe("People, services and short forms");
    for (const term of CONFUSABLE_TERMS.flat()) {
      expect(
        GLOSSARY.some((entry) => entry.term === term),
        term,
      ).toBe(true);
      for (const related of relatedTerms(term)) expect(relatedTerms(related)).toContain(term);
    }
  });
  it("keeps accessibility wording traceable to the existing guide", () => {
    const source = readFileSync("docs/ward-flow/desk-guides/accessibility.md", "utf8")
      .replaceAll("**", "")
      .toLowerCase();
    for (const item of ACCESSIBILITY_HELP)
      for (const sentence of item.text.split(/(?<=\.) /u)) expect(source).toContain(sentence.toLowerCase());
  });
  it("makes accessibility and connection guidance searchable from the same source", () => {
    const answer = searchHelp("colour code without colour", "coordinator");
    expect(answer.kind).toBe("results");
    if (answer.kind === "results")
      expect(answer.results.some((item) => item.key.startsWith("accessibility:"))).toBe(true);
    expect(new Set(COMMON_QUESTIONS.map((item) => item.question)).size).toBe(COMMON_QUESTIONS.length);
  });
});
