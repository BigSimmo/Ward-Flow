import { describe, expect, it } from "vitest";

import { exampleTriage, requirements, restSets } from "@/components/ward-redesign/triage-risk/triage-risk-state";
import { summaryModel, summaryText } from "@/components/ward-redesign/triage-risk/triage-risk-summary";
import {
  boxToDomains,
  checkReviewTime,
  domainsToBox,
  hasPhrase,
  NA,
  parseHeadedText,
  reviewTimeStamp,
  toggleBoxPhrase,
  toggleDomainChip,
} from "@/components/ward-redesign/triage-risk/triage-risk-text";

// The pure text rules of the triage and risk mock-up (6 Nov 2026). Synthetic mental state text only.

const BOX = [
  "Speech: Pressured, hard to interrupt",
  'Mood and affect: Irritable. "I just need sleep"',
  "Thought content: Grandiose delusions. King of the city; special mission",
  "Perception: No perceptual disturbance",
  "Insight and judgement: No insight",
].join("\n");

describe("phrase matching", () => {
  it("is whole word and case-blind", () => {
    expect(hasPhrase("Disoriented", "Oriented", "cog")).toBe(false);
    expect(hasPhrase("Alert, oriented", "Oriented", "cog")).toBe(true);
  });

  it("does not count a phrase that is negated or inside a longer phrase of its domain", () => {
    expect(hasPhrase("No suicidal thoughts", "Suicidal thoughts", "tc")).toBe(false);
    expect(hasPhrase("Denies suicidal thoughts", "Suicidal thoughts", "tc")).toBe(false);
    expect(hasPhrase("Nil suicidal thoughts today", "Suicidal thoughts", "tc")).toBe(false);
    expect(hasPhrase("Passive suicidal thoughts", "Suicidal thoughts", "tc")).toBe(true);
  });
});

describe("one box taps", () => {
  it("replaces a contradicting phrase and says what it replaced", () => {
    const result = toggleBoxPhrase("Cognition: Oriented", "cog", "Disoriented");
    expect(result.box).toBe("Cognition: Disoriented");
    expect(result.replaced).toEqual(["Oriented"]);
  });

  it("lets Not assessed replace the line, and any phrase replace Not assessed", () => {
    const marked = toggleBoxPhrase("Cognition: Alert, oriented", "cog", "Not assessed").box;
    expect(marked).toBe("Cognition: Not assessed");
    expect(toggleBoxPhrase(marked, "cog", "Alert").box).toBe("Cognition: Alert");
  });

  it("removes a phrase on a second tap and drops an emptied line", () => {
    expect(toggleBoxPhrase("Speech: Pressured", "speech", "Pressured").box).toBe("");
  });
});

describe("Not assessed in By domain", () => {
  it("stands alone, and a phrase replaces it", () => {
    expect(toggleDomainChip(["Alert"], "cog", NA).chips).toEqual([NA]);
    expect(toggleDomainChip([NA], "cog", "Alert").chips).toEqual(["Alert"]);
  });
});

describe("layout switch", () => {
  it("parses each line into chips and free text, and round trips unchanged", () => {
    const domains = boxToDomains(BOX);
    expect(domains.speech).toEqual({ chips: ["Pressured", "Hard to interrupt"], detail: "" });
    expect(domains.tc).toEqual({ chips: ["Grandiose delusions"], detail: "King of the city; special mission" });
    expect(domains.mood).toEqual({ chips: ["Irritable"], detail: '"I just need sleep"' });
    expect(domainsToBox(domains, BOX)).toBe(BOX);
  });

  it("makes a phrase added after free text a chip", () => {
    const domains = boxToDomains('Mood and affect: Irritable. "I just need sleep", angry');
    expect(domains.mood).toEqual({ chips: ["Irritable", "Angry"], detail: '"I just need sleep"' });
  });

  it("clears a domain whose line was deleted and never brings a deleted line back", () => {
    const withoutPerception = BOX.split("\n")
      .filter((line) => !line.startsWith("Perception"))
      .join("\n");
    const domains = boxToDomains(withoutPerception);
    expect(domains.perc).toBeUndefined();
    const emptied = { ...domains, speech: { chips: [], detail: "" } };
    const back = domainsToBox(emptied, withoutPerception);
    expect(back).not.toMatch(/Perception|Speech/);
  });

  it("keeps a line typed in another case as one line", () => {
    const back = domainsToBox(boxToDomains("speech: Pressured"), "speech: Pressured");
    expect(back).toBe("Speech: Pressured");
  });

  it("reads Not assessed", () => {
    expect(boxToDomains("Cognition: Not assessed. By phone").cog).toEqual({ chips: [NA], detail: "By phone" });
  });
});

describe("headings", () => {
  it("reads known headings only, in any case", () => {
    const parsed = parseHeadedText(
      "why now: lower case heading works\nMother: said he has not slept\nREQUEST: admission today",
    );
    expect(parsed).toEqual([
      ["Why now", "lower case heading works Mother: said he has not slept"],
      ["Request", "admission today"],
    ]);
  });

  it("reads the separate Thought form and Thought content headings and keeps a bracketed note", () => {
    expect(parseHeadedText("Thought form: Tangential\nThought content: Guilt")).toEqual([
      ["Thought form", "Tangential"],
      ["Thought content", "Guilt"],
    ]);
    expect(parseHeadedText("History (12 Oct, check): Lives with mother")).toEqual([
      ["History (12 Oct, check)", "Lives with mother"],
    ]);
  });
});

describe("reviewed time", () => {
  const now = new Date(2026, 10, 6, 12, 0).getTime();

  it("accepts DD/MM/YYYY HH:MM in the past", () => {
    expect(checkReviewTime("06/11/2026 09:42", now)).toEqual({ ok: true, message: "", future: false });
  });

  it("rejects a short format, a date that does not exist and a future time, in plain words", () => {
    expect(checkReviewTime("06/11 09:42", now).message).toBe("Use DD/MM/YYYY HH:MM, for example 06/11/2026 09:42.");
    expect(checkReviewTime("31/11/2026 09:42", now).message).toBe(
      "That date or time does not exist. Use DD/MM/YYYY HH:MM.",
    );
    expect(checkReviewTime("06/11/2026 24:00", now).ok).toBe(false);
    expect(checkReviewTime("06/11/2030 09:42", now)).toEqual({
      ok: false,
      message: "That time is in the future. Enter when you reviewed.",
      future: true,
    });
    expect(checkReviewTime("", now)).toEqual({ ok: false, message: "", future: false });
  });

  it("stamps Now with the full date", () => {
    expect(reviewTimeStamp(new Date(2026, 10, 6, 9, 5))).toBe("06/11/2026 09:05");
  });
});

describe("Rest of current risk and the copied summary", () => {
  it("leaves a factor the mental state contradicts out of Not present and names it to check", () => {
    const state = { ...exampleTriage(), rest: "np" };
    const sets = restSets(state, "now");
    expect(sets.conflicts.map((c) => c.factor.key)).toContain("other.now.delu");
    expect(sets.covered.map((f) => f.key)).not.toContain("other.now.delu");
    const labels = requirements(state, new Date(2026, 10, 6, 12, 0).getTime()).map((r) => r.label);
    expect(labels).toContain("Conflict: check Current delusional beliefs");
    expect(labels).toContain("Confirm what Rest of current risk covers");
    const text = summaryText(summaryModel(state));
    expect(text).toMatch(/\nUrgency: /);
    expect(text).toMatch(/\n\n/);
    expect(text).toMatch(/\nSpeech: Pressured, hard to interrupt/);
    expect(text).toMatch(/\nCognition: Not recorded/);
    expect(text).toMatch(/Rest of current risk, not present \(not yet confirmed\), covers: /);
    expect(text).toMatch(/Not covered, check: current delusional beliefs\./);
  });
});
