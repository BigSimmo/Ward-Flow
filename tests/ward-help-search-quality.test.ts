import { describe, expect, it } from "vitest";

import {
  askHelp,
  closestHowTos,
  correctedQuestionWords,
  correctWords,
  questionWords,
} from "@/components/ward-management/help/ward-help-howto";
import { HELP_SYNONYMS } from "@/components/ward-management/help/ward-help-synonyms";
import { allowedSlips, editDistance, nearestWord } from "@/components/ward-management/help/ward-help-typo";

/**
 * Help search quality (P9): synonyms, typo tolerance and closest topics, checked against a golden
 * set of questions people type, each with the how-to that must come first. Local and deterministic.
 */

const GOLDEN: readonly (readonly [question: string, top: string])[] = [
  ["how do I pull a bed", "pull-bed"],
  ["hold bed", "pull-bed"],
  ["reserve a bed", "pull-bed"],
  ["keep the bed", "pull-bed"],
  ["pul a bed", "pull-bed"],
  ["release pulled bed", "release-pulled-bed"],
  ["give back the bed", "release-pulled-bed"],
  ["approve referral", "decide-referral"],
  ["reject referral", "decide-referral"],
  ["refuse referral", "decide-referral"],
  ["decline refferal", "decide-referral"],
  ["book ambulance", "book-transport"],
  ["book an ambo", "book-transport"],
  ["order a taxi", "book-transport"],
  ["trasnport", "book-transport"],
  ["cancel ambulance", "cancel-transport"],
  ["log a phone call", "log-call"],
  ["they rang", "log-call"],
  ["telephone", "log-call"],
  ["new referral", "new-referral"],
  ["sign off handover", "sign-off-handover"],
  ["handoff", "sign-off-handover"],
  ["handovr", "sign-off-handover"],
  ["print handover", "print-handover"],
  ["census", "confirm-numbers"],
  ["bed board", "bed-board"],
  ["dashboard", "bed-board"],
  ["telly", "tv"],
  ["television", "tv"],
  ["find a free bed", "find-bed"],
  ["empty bed", "find-bed"],
  ["vacant bed", "find-bed"],
  ["switch desk", "go-to-desk"],
  ["look up patient", "search-patient"],
  ["favorite ward", "pin-ward"],
  ["dark mode", "theme"],
  ["dakr mode", "theme"],
  // Typos in words the stemmer would shorten: mend the word first, then stem it.
  ["thme", "theme"],
  ["handove", "sign-off-handover"],
  ["compact rows", "density"],
  ["turn on notifications", "notifications"],
  ["mute sound", "buzz"],
  ["undo mistake", "undo"],
  ["revert", "undo"],
  ["crashed", "downtime"],
  ["tutorial", "tour"],
  ["graph", "statistics"],
  ["permissions", "give-access"],
  ["mha expiry", "mha-times"],
  ["tranport job pickup", "transport-job"],
];

describe("Help search golden set", () => {
  it("holds at least 40 questions, misspellings and synonyms included", () => {
    expect(GOLDEN.length).toBeGreaterThanOrEqual(40);
  });

  it.each(GOLDEN)("%s -> %s", (question, top) => {
    expect(askHelp(question, "coordinator")[0]?.howTo.id).toBe(top);
  });
});

describe("synonyms", () => {
  it("is one data list with each word once, never mapped to itself", () => {
    const words = HELP_SYNONYMS.map(([word]) => word);
    expect(new Set(words).size).toBe(words.length);
    for (const [word, family] of HELP_SYNONYMS) expect(word).not.toBe(family);
  });

  it("reads a synonym as its family word", () => {
    expect(questionWords("ambulance")).toEqual(questionWords("transport"));
  });
});

describe("typo tolerance", () => {
  it("counts inserted, removed, changed and swapped letters", () => {
    expect(editDistance("handover", "handover")).toBe(0);
    expect(editDistance("handovr", "handover")).toBe(1);
    expect(editDistance("trasnport", "transport")).toBe(1);
    expect(editDistance("bead", "bed")).toBe(1);
    expect(editDistance("kitten", "sitting")).toBe(3);
  });

  it("allows no slip under 4 letters, 1 up to 6 and 2 beyond", () => {
    expect(allowedSlips("bed")).toBe(0);
    expect(allowedSlips("ward")).toBe(1);
    expect(allowedSlips("theme")).toBe(1);
    expect(allowedSlips("transport")).toBe(2);
  });

  it("keeps short and known words, and words too far from any", () => {
    const known = new Set(["transport", "theme"]);
    expect(nearestWord("bd", ["bed"], new Set(["bed"]))).toBe("bd");
    expect(nearestWord("theme", ["transport", "theme"], known)).toBe("theme");
    expect(nearestWord("zzzzzzzz", ["transport", "theme"], known)).toBe("zzzzzzzz");
    expect(nearestWord("tranpsort", ["transport", "theme"], known)).toBe("transport");
  });

  it("mends a typo before stemming, so a shortened stem does not lose its slips", () => {
    expect(askHelp("thme", "coordinator")[0]?.howTo.id).toBe("theme");
    expect(askHelp("handove", "coordinator").length).toBeGreaterThan(0);
    expect(correctedQuestionWords("thme")).toEqual(questionWords("theme"));
    expect(correctedQuestionWords("handove")).toEqual(questionWords("handover"));
  });

  it("gives the same words for the same question every time", () => {
    const once = correctWords(questionWords("handovr trasnport"));
    expect(correctWords(questionWords("handovr trasnport"))).toEqual(once);
  });
});

describe("closest topics", () => {
  it("offers up to 3 topics sharing a word when nothing answers", () => {
    const closest = closestHowTos("bed giraffe elephant", "coordinator");
    expect(closest.length).toBeGreaterThan(0);
    expect(closest.length).toBeLessThanOrEqual(3);
  });

  it("offers nothing when no word is shared", () => {
    expect(closestHowTos("giraffe elephant", "coordinator")).toEqual([]);
  });
});
