import { describe, expect, it } from "vitest";

import { foldedSections, foldLine } from "@/components/ward-redesign/triage-risk/triage-risk-fold";
import { blankTriage, exampleTriage } from "@/components/ward-redesign/triage-risk/triage-risk-state";
import { partText, summaryModel, summaryText } from "@/components/ward-redesign/triage-risk/triage-risk-summary";

// Triage and risk mock-up (7 Nov 2026): finished sections fold to one line, and each summary part
// copies alone for its PSOLIS box. Synthetic patient only.

const allDone = { rev: true, note: true, mse: true, dec: true, risk: true, plan: true };

describe("finished sections fold", () => {
  it("folds Assessment, Mental state and Triage decision once done, and only those", () => {
    const folded = foldedSections({ done: allDone, engaged: null, opening: null, signed: false });
    expect([...folded].sort()).toEqual(["dec", "mse", "note"]);
  });

  it("never folds the section being worked in, or one a jump or Change is opening", () => {
    expect(foldedSections({ done: allDone, engaged: "mse", opening: null, signed: false }).has("mse")).toBe(false);
    expect(foldedSections({ done: allDone, engaged: null, opening: "dec", signed: false }).has("dec")).toBe(false);
  });

  it("keeps an unfinished section open, and a signed triage open throughout", () => {
    const done = { ...allDone, mse: false };
    expect(foldedSections({ done, engaged: null, opening: null, signed: false }).has("mse")).toBe(false);
    expect(foldedSections({ done: allDone, engaged: null, opening: null, signed: true }).size).toBe(0);
  });
});

describe("the folded line", () => {
  it("says what Assessment holds", () => {
    expect(foldLine(exampleTriage(), "note")).toEqual([
      "60 words, 5 of 10 headings",
      "Psychosis, Aggression, Alcohol or drugs",
      "Aware: person opposed, carer aware",
    ]);
  });

  it("counts Mental state domains and names any not assessed", () => {
    const state = exampleTriage();
    state.text.mseBox += "\nCognition: Not assessed";
    expect(foldLine(state, "mse")).toEqual(["6 of 8 domains", "One box", "Not assessed: cognition"]);
  });

  it("gives the decision with the legal form only as typed", () => {
    const state = { ...exampleTriage(), urgency: "C" as const, outcome: "Accepted" };
    expect(foldLine(state, "dec")).toEqual([
      "Urgency C, within 12 hours",
      "Accepted",
      "Community treatment order, Form 5A · 28/01/2027 23:59 (as typed)",
    ]);
  });

  it("has nothing to say for a section that does not fold", () => {
    expect(foldLine(blankTriage(), "risk")).toEqual([]);
  });
});

describe("copy one part for its PSOLIS box", () => {
  const model = summaryModel(exampleTriage());

  it("keeps the part's lines in order, without its heading or the UMRN", () => {
    const review = partText(model.parts[0]!);
    expect(review.split("\n").slice(0, 3)).toEqual([
      "Reviewed: 06/11/2026 09:42",
      "Mode: Phone · ED",
      "Arrived by: Ambulance",
    ]);
    expect(review).not.toMatch(/REVIEW DETAILS|UMRN|40-2271/);
  });

  it("is the same text the whole summary uses for that part", () => {
    for (const part of model.parts) expect(summaryText(model)).toContain(partText(part));
  });

  it("gives Mental state as one line per domain, eight lines", () => {
    expect(partText(model.parts[2]!).split("\n")).toHaveLength(8);
  });
});
