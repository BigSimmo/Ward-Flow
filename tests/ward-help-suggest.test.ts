import { afterEach, describe, expect, it, vi } from "vitest";

import { GLOSSARY } from "@/components/ward-management/help/ward-help-content";
import { isClinicalQuestion } from "@/components/ward-management/help/ward-help-search-index";
import {
  completionRest,
  MAX_SUGGESTIONS,
  typeAheadHelp,
  type HelpSuggestions,
} from "@/components/ward-management/help/ward-help-suggest";

/**
 * Help suggestions as you type (Josh, 2 Nov 2026): from Help's own content only, phrased the way
 * the question starts, desk first, deterministic, never clinical and never stored.
 */

const texts = (answer: HelpSuggestions) => answer.suggestions.map((item) => item.text);
const top = (query: string, role: Parameters<typeof typeAheadHelp>[1] = "coordinator") =>
  typeAheadHelp(query, role, GLOSSARY).suggestions[0];

describe("typeAheadHelp: as you type", () => {
  it("waits for two letters", () => {
    expect(typeAheadHelp("", "coordinator", GLOSSARY).suggestions).toEqual([]);
    expect(typeAheadHelp(" p", "coordinator", GLOSSARY).suggestions).toEqual([]);
    expect(typeAheadHelp("pu", "coordinator", GLOSSARY).suggestions.length).toBeGreaterThan(0);
  });

  it.each([
    ["pul", "Pull the bed for a patient", "job"],
    ["how do i pu", "How do I pull the bed for a patient?", "job"],
    ["acc", "Accept or decline a referral", "job"],
    ["dark", "Use dark mode or the bright light theme", "job"],
    ["how to bo", "How to book transport", "job"],
    ["where is cap", "Where is Capacity?", "screen"],
    ["show me around dis", "Show me around Discharges", "walk"],
    ["log a cal", "Log a call", "job"],
    ["what is cl", "What is CLD?", "word"],
    ["awol mean", "What does AWOL mean?", "word"],
  ])("%s -> %s", (query, text, kind) => {
    expect(top(query)?.text).toBe(text);
    expect(top(query)?.kind).toBe(kind);
  });

  it("offers glossary words phrased as a meaning", () => {
    expect(texts(typeAheadHelp("what does hel", "coordinator", GLOSSARY))).toContain("What does Held up mean?");
  });

  it("matches a partial word through synonyms and small slips", () => {
    expect(top("hol")?.text).toBe("Pull the bed for a patient");
    expect(texts(typeAheadHelp("trasn", "coordinator", GLOSSARY))).toContain("Book transport");
    expect(texts(typeAheadHelp("cancel ambo", "coordinator", GLOSSARY))[0]).toBe("Cancel transport");
    expect(texts(typeAheadHelp("handovr", "coordinator", GLOSSARY))).toContain("Hand over to the next shift");
  });

  it("lists the desk's own jobs, walks and screens for a lead with no topic yet", () => {
    const how = typeAheadHelp("how do i ", "officer", GLOSSARY);
    expect(how.suggestions[0]?.text).toBe("How do I record a transport job?");
    expect(how.suggestions.every((item) => item.kind === "job" && item.text.startsWith("How do I"))).toBe(true);
    const show = typeAheadHelp("show me", "coordinator", GLOSSARY);
    expect(show.suggestions.every((item) => item.kind === "walk")).toBe(true);
    expect(show.completion).toBe(show.suggestions[0]?.text);
  });

  it("keeps a lead's own words: how to, can I, where are", () => {
    expect(top("can i pul")?.text).toBe("Can I pull the bed for a patient?");
    expect(top("how to pul")?.text).toBe("How to pull the bed for a patient");
  });

  it("gives at most six suggestions, each text once, with ranges inside the text", () => {
    for (const query of ["be", "pu", "how do i", "show me", "where", "shift", "tr"]) {
      const answer = typeAheadHelp(query, "coordinator", GLOSSARY);
      expect(answer.suggestions.length).toBeLessThanOrEqual(MAX_SUGGESTIONS);
      const lower = texts(answer).map((text) => text.toLowerCase());
      expect(new Set(lower).size).toBe(lower.length);
      for (const item of answer.suggestions)
        for (const [start, end] of item.matched) {
          expect(start).toBeGreaterThanOrEqual(0);
          expect(end).toBeLessThanOrEqual(item.text.length);
          expect(end).toBeGreaterThan(start);
        }
    }
  });

  it("marks what was typed in each suggestion", () => {
    const pull = top("how do i pu");
    expect(pull?.matched[0]).toEqual([0, "how do i pu".length]);
    const dark = top("dark");
    expect(dark?.matched.some(([start, end]) => dark.text.slice(start, end) === "dark")).toBe(true);
  });
});

describe("typeAheadHelp: completion", () => {
  it("completes only when the top suggestion reads on from what was typed", () => {
    expect(typeAheadHelp("pul", "coordinator", GLOSSARY).completion).toBe("Pull the bed for a patient");
    expect(typeAheadHelp("how do i pu", "coordinator", GLOSSARY).completion).toBe(
      "How do I pull the bed for a patient?",
    );
    expect(typeAheadHelp("PUL", "coordinator", GLOSSARY).completion).toBe("Pull the bed for a patient");
    // The top suggestion does not start with "dark", so there is nothing to fill in.
    expect(typeAheadHelp("dark", "coordinator", GLOSSARY).completion).toBeUndefined();
    expect(typeAheadHelp("telly", "coordinator", GLOSSARY).completion).toBeUndefined();
  });

  it("gives the rest to draw as ghost text", () => {
    expect(completionRest("pul", "Pull the bed for a patient")).toBe("l the bed for a patient");
    expect(completionRest("  PUL", "Pull the bed for a patient")).toBe("l the bed for a patient");
    expect(completionRest("dark", "Use dark mode")).toBe("");
    expect(completionRest("pul", undefined)).toBe("");
  });
});

describe("typeAheadHelp: the clinical guard wins", () => {
  it.each([
    "what dose",
    "what dos",
    "what dosgae ",
    "what is the dosage for",
    "medicat",
    "should i ad",
    "should we tr",
    "should i d",
    "is it safe to tr",
    "side eff",
    "self ha",
    "what treatm",
    "which diag",
    "suic",
  ])("offers nothing for %s", (query) => {
    expect(typeAheadHelp(query, "coordinator", GLOSSARY)).toEqual({ suggestions: [] });
  });

  it("never suggests a clinical-decision question", () => {
    for (const query of ["sh", "should", "how do i", "what", "what is", "safe", "tr", "di", "me", "se"])
      for (const item of typeAheadHelp(query, "ward", GLOSSARY).suggestions)
        expect(isClinicalQuestion(item.text)).toBe(false);
  });

  it("keeps app words that sound clinical", () => {
    expect(texts(typeAheadHelp("what is tentative diag", "coordinator", GLOSSARY))).toContain(
      "What is Tentative diagnosis?",
    );
    expect(top("how do i book transp")?.text).toBe("How do I book transport?");
  });
});

describe("typeAheadHelp: the desk", () => {
  it("puts the desk's own job before another desk's", () => {
    const firstJob = (role: Parameters<typeof typeAheadHelp>[1]) =>
      typeAheadHelp("transp", role, GLOSSARY).suggestions.find((item) => item.kind === "job")?.text;
    expect(firstJob("officer")).toBe("Record a transport job");
    expect(firstJob("coordinator")).toBe("Book transport");
    // Another desk's job may still appear, after the desk's own. Since the officer gained its own
    // transport jobs (5 Nov 2026), they fill the list ahead of the coordinator's Book transport.
    const officer = typeAheadHelp("transp", "officer", GLOSSARY).suggestions.filter((item) => item.kind === "job");
    expect(officer.map((item) => item.text)).toContain("Record a transport job");
    expect(officer.findIndex((item) => item.text === "Book transport")).not.toBe(0);
  });

  it("never offers a shortcut, walk or screen the desk cannot use", () => {
    const executive = texts(typeAheadHelp("shift", "executive", GLOSSARY));
    expect(executive.some((text) => text.includes("Shift+T"))).toBe(false);
    expect(texts(typeAheadHelp("shift", "coordinator", GLOSSARY)).some((text) => text.includes("Shift+T"))).toBe(true);
    expect(typeAheadHelp("where is cap", "officer", GLOSSARY).suggestions).toEqual([]);
    expect(texts(typeAheadHelp("show me", "officer", GLOSSARY))).not.toContain("Show me around Capacity");
  });
});

describe("typeAheadHelp: this device's usage", () => {
  it("breaks ties with how often each answer was used here", () => {
    const plain = typeAheadHelp("how do i ", "coordinator", GLOSSARY);
    const used = typeAheadHelp("how do i ", "coordinator", GLOSSARY, new Map([["log-call", 4]]));
    expect(plain.suggestions[0]?.howToId).not.toBe("log-call");
    expect(used.suggestions[0]?.howToId).toBe("log-call");
    expect(used.completion).toBe("How do I log a call?");
  });

  it("never lets usage beat a better match", () => {
    expect(typeAheadHelp("pul", "coordinator", GLOSSARY, new Map([["theme", 99]])).suggestions[0]?.howToId).toBe(
      "pull-bed",
    );
  });
});

describe("typeAheadHelp: deterministic and in memory only", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("gives the same suggestions every time", () => {
    for (const query of ["pul", "how do i pu", "what does hel", "trasn", "show me"])
      expect(typeAheadHelp(query, "ward", GLOSSARY)).toEqual(typeAheadHelp(query, "ward", GLOSSARY));
  });

  it("searches the sheet's own site directory", () => {
    const terms = [...GLOSSARY, { term: "ZQX", meaning: "Zephyr Quay Hospital" }];
    expect(texts(typeAheadHelp("what is zq", "coordinator", terms))).toContain("What is ZQX?");
    expect(texts(typeAheadHelp("what is zq", "coordinator", GLOSSARY))).not.toContain("What is ZQX?");
  });

  it("writes nothing to storage", () => {
    const local = { setItem: vi.fn(), getItem: vi.fn(() => null), removeItem: vi.fn() };
    const session = { setItem: vi.fn(), getItem: vi.fn(() => null), removeItem: vi.fn() };
    vi.stubGlobal("localStorage", local);
    vi.stubGlobal("sessionStorage", session);
    for (const query of ["pul", "how do i pu", "what does hel", "what dose", "show me"])
      typeAheadHelp(query, "coordinator", GLOSSARY, new Map([["pull-bed", 2]]));
    expect(local.setItem).not.toHaveBeenCalled();
    expect(session.setItem).not.toHaveBeenCalled();
    expect(local.getItem).not.toHaveBeenCalled();
  });

  it("is quick enough to run on every key", () => {
    typeAheadHelp("warm", "coordinator", GLOSSARY);
    const queries = ["pu", "pul", "how do i pu", "what does hel", "trasn", "show me around dis", "new ref"];
    // Time five separate batches and judge the fastest. A busy CI runner (four test workers on one
    // machine) can slow any single batch past the limit without the search itself being slow; that
    // failed two pull requests on 9 Nov 2026 at 2.07 and 2.08 ms. The best batch measures the code.
    const perCall: number[] = [];
    for (let batch = 0; batch < 5; batch += 1) {
      const start = performance.now();
      for (let round = 0; round < 10; round += 1)
        for (const query of queries) typeAheadHelp(query, "coordinator", GLOSSARY);
      perCall.push((performance.now() - start) / (10 * queries.length));
    }
    expect(Math.min(...perCall)).toBeLessThan(2);
  });
});
