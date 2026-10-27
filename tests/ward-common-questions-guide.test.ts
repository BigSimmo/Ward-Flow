import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GLOSSARY, SCREEN_HELP, screenHelpFor } from "@/components/ward-management/help/ward-help-content";
import { DESK_GUIDES, SAVED_OR_NOT, WHEN_IT_IS_DOWN } from "@/components/ward-management/help/ward-help-guide";

const guide = readFileSync("docs/ward-flow/desk-guides/common-questions.md", "utf8");

/** Every approved Help string a guide answer may quote. */
function approvedStrings(): Set<string> {
  const found = new Set<string>([...SAVED_OR_NOT, ...WHEN_IT_IS_DOWN]);
  for (const guideEntry of Object.values(DESK_GUIDES)) for (const line of guideEntry.limits) found.add(line);
  for (const term of GLOSSARY) found.add(term.meaning);
  const walk = (value: unknown) => {
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (typeof record.question === "string" && typeof record.answer === "string") found.add(record.answer);
      for (const child of Object.values(record)) walk(child);
    }
  };
  walk(SCREEN_HELP);
  // Page-pattern help (for example a ward's answer page) is reached through screenHelpFor.
  for (const path of ["/ward-flow/ward/example/answer", "/ward-flow/movements/example"]) walk(screenHelpFor(path, []));
  return found;
}

describe("common questions desk guide (P5)", () => {
  const answers = [...guide.matchAll(/^> (.+)$/gm)].map((m) => m[1]);

  it("has between 15 and 25 answers", () => {
    expect(answers.length).toBeGreaterThanOrEqual(15);
    expect(answers.length).toBeLessThanOrEqual(25);
  });

  it("quotes every answer word for word from Help", () => {
    const approved = approvedStrings();
    for (const answer of answers) expect(approved, answer).toContain(answer);
  });
});
