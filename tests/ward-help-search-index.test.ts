import { describe, expect, it } from "vitest";

import {
  CLINICAL_REPLY,
  isClinicalQuestion,
  searchHelp,
  type HelpSearchAnswer,
} from "@/components/ward-management/help/ward-help-search-index";

/** Help search (variant A, 27 Oct 2026): one local index over approved Help content only. */

function results(answer: HelpSearchAnswer) {
  if (answer.kind !== "results") throw new Error(`expected results, got ${answer.kind}`);
  return answer.results;
}

describe("searchHelp", () => {
  it("is empty for blank or stop-word queries", () => {
    expect(searchHelp("", "coordinator").kind).toBe("empty");
    expect(searchHelp("   ", "coordinator").kind).toBe("empty");
  });

  it("finds a how-to with Show me first for its words", () => {
    const top = results(searchHelp("pull a bed", "bed_manager"))[0];
    expect(top.group).toBe("Guides");
    expect(top.title.toLowerCase()).toContain("pull");
  });

  it("searches across groups: settings, shortcuts and glossary", () => {
    expect(results(searchHelp("dark mode", "ward")).some((r) => r.group === "Settings" || r.group === "Guides")).toBe(
      true,
    );
    expect(results(searchHelp("keyboard shortcut", "ward")).some((r) => r.group === "Shortcuts")).toBe(true);
    expect(results(searchHelp("pulled", "ward")).some((r) => r.group === "Glossary")).toBe(true);
  });

  it("gives the same results every time", () => {
    expect(searchHelp("book transport", "officer")).toEqual(searchHelp("book transport", "officer"));
  });

  it("offers closest topics when nothing matches fully", () => {
    const answer = searchHelp("transport zzzqqq xxyyzz", "coordinator");
    expect(answer.kind).toBe("none");
  });

  it("answers clinical questions with the approved reply and no results", () => {
    for (const q of [
      "what dose of medication should I give",
      "should I admit this patient",
      "diagnosis for psychosis",
    ]) {
      expect(isClinicalQuestion(q)).toBe(true);
      expect(searchHelp(q, "ward").kind).toBe("clinical");
    }
    expect(CLINICAL_REPLY).toBe(
      "Help covers how to use Ward Flow, not clinical decisions. For clinical questions, please use your clinical guidelines or speak to the treating team.",
    );
  });

  it("keeps app words that sound clinical searchable", () => {
    expect(isClinicalQuestion("at risk")).toBe(false);
    expect(isClinicalQuestion("legal status")).toBe(false);
  });
});
