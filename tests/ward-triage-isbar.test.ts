import { describe, expect, it } from "vitest";

import { copiedText } from "@/components/ward-management/ward-clipboard";
import { isbarText } from "@/components/ward-management/triage/triage-risk-isbar";
import { blankTriage, type TriageState } from "@/components/ward-management/triage/triage-risk-state";

import { EXAMPLE_PERSON } from "./helpers/triage-example";

/** Copy as iSoBAR (Josh, 9 Nov 2026): synthetic person, a few answers set, nothing invented. */
const line = (text: string, start: string) => text.split("\n").find((l) => l.startsWith(start)) ?? "";

describe("isbarText", () => {
  it("prints a dash for every value not on a blank form, and invents nothing", () => {
    const text = isbarText(blankTriage(EXAMPLE_PERSON));
    expect(text.split("\n").map((l) => l.split(":")[0])).toEqual([
      "iSoBAR handover · synthetic",
      "I Identify",
      "UMRN",
      "S Situation",
      "O Observations",
      "B Background",
      "A Assessment",
      "R Recommendation",
    ]);
    expect(line(text, "I ")).toBe("I Identify: Bed coordinator · – · Harlow, Jesse, 34y");
    expect(line(text, "S ")).toBe("S Situation: Urgency – · Outcome – · Legal –");
    expect(line(text, "O ")).toBe("O Observations: –");
    expect(line(text, "B ")).toBe("B Background: Past risk –");
    expect(line(text, "A ")).toBe("A Assessment: Current risk –");
    // D-187 item 17 (Q39): the safety plan's Plan and Crisis lines join the Recommendation.
    expect(line(text, "R ")).toBe("R Recommendation: Actions – · Review risk by – · Plan – · Crisis –");
  });

  it("reads the answers that are set, in iSoBAR order", () => {
    const blank = blankTriage(EXAMPLE_PERSON);
    const state: TriageState = {
      ...blank,
      urgency: "C",
      outcome: "Accepted",
      legal: "cto",
      review: "72h",
      actions: ["police"],
      f: {
        "violence.bg.prev": "y",
        "violence.now.intent": "y",
        "other.now.recdis": "y",
        "general.now.agit": "u",
      },
      text: {
        ...blank.text,
        mseBox: "Speech: Pressured, hard to interrupt\nInsight and judgement: No insight",
        rp: "Risk: Raised.\nProtective: Engaged with CMHT; mother supportive.\n",
      },
    };
    const text = isbarText(state, { at: "06/11 10:15", by: "Dr Q. Synthetic" });
    expect(line(text, "I ")).toMatch(/^I Identify: Dr Q\. Synthetic · /);
    expect(line(text, "S ")).toMatch(
      /^S Situation: Urgency C, .+ · Outcome Accepted · Legal Community treatment order/,
    );
    expect(line(text, "O ")).toBe(
      "O Observations: Speech: Pressured, hard to interrupt; Insight and judgement: No insight",
    );
    expect(line(text, "B ")).toBe("B Background: Past risk Previous violence · Recent discharge (28 days)");
    // Not known is not present: only flags marked present are handed over.
    expect(line(text, "A ")).toMatch(
      /^A Assessment: Current risk [^·]+ · Protective: Engaged with CMHT; mother supportive\.$/,
    );
    expect(line(text, "A ")).not.toMatch(/Agitat/i);
    expect(line(text, "R ")).toBe(
      "R Recommendation: Actions POLICE NOTIFIED · Review risk by 72 hours · Plan – · Crisis –",
    );
  });

  it("keeps the UMRN off the clipboard", () => {
    const copied = copiedText(isbarText(blankTriage(EXAMPLE_PERSON)));
    expect(copied).not.toContain(EXAMPLE_PERSON.umrn);
    expect(copied.split("\n")[0]).toBe("Synthetic prototype.");
  });
});
