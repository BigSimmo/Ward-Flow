import { describe, expect, it } from "vitest";

import { isbarText } from "@/components/ward-management/triage/triage-risk-isbar";
import {
  BLANK_SAFETY_PLAN,
  FOLLOW_UP_WINDOWS,
  MADE_WITH_PERSON,
  applySafetyPlan,
  daysSinceDischarge,
  followUpHint,
  followUpShown,
  followUpText,
  insertUnderHeading,
  meansPrefill,
  meansSafetyShown,
  meansStillOpen,
  meansSummary,
  stepsFilled,
  toggleItem,
} from "@/components/ward-management/triage/triage-risk-safety";
import { blankTriage, requirements, type TriageState } from "@/components/ward-management/triage/triage-risk-state";
import { summaryModel, summaryText } from "@/components/ward-management/triage/triage-risk-summary";
import { headingFilled, parseHeadedText } from "@/components/ward-management/triage/triage-risk-text";

import { EXAMPLE_PERSON } from "./helpers/triage-example";

/** Safety plan builder, means safety and follow-up (9 Nov 2026). Synthetic person, React state only. */
const blank = () => blankTriage(EXAMPLE_PERSON);
const count = (text: string, re: RegExp) => (text.match(re) ?? []).length;

describe("safety plan builder", () => {
  const draft = {
    ...BLANK_SAFETY_PLAN,
    warning: "Not sleeping, pacing",
    own: "Walk the dog",
    people: "Marrowby, Rosa (sister) 0491 570 737",
    services: "Lifeline 13 11 14",
    safer: "Medicines: held or removed, sister holds them",
    reasons: "My daughter",
    withPerson: true,
  };

  it("adds each heading once, at the end, when the plan has none", () => {
    const text = applySafetyPlan("Risk: Raised today.", draft);
    for (const heading of ["Plan", "Means safety", "Crisis", "Follow-up"])
      expect(count(text, new RegExp(`^${heading}:`, "gm"))).toBe(1);
    expect(text.startsWith("Risk: Raised today.\nPlan: Step 1, warning signs: Not sleeping, pacing.")).toBe(true);
    expect(text).toContain("Follow-up: Safety plan made with the person.");
    // The step lines never start a known heading, so the summary reads them under the plan headings.
    const parsed = Object.fromEntries(parseHeadedText(text));
    expect(parsed.Plan).toContain("Reasons for living: My daughter.");
    expect(parsed["Warning signs"]).toBeUndefined();
    expect(parsed.Crisis).toContain("Step 5, services: Lifeline 13 11 14.");
    expect(parsed["Means safety"]).toContain("sister holds them");
  });

  it("is safe to add twice: no heading or line is duplicated", () => {
    const once = applySafetyPlan("", draft);
    expect(applySafetyPlan(once, draft)).toBe(once);
  });

  it("appends under an existing heading and fills an empty one", () => {
    const start = "Plan: Home with sister\nMeans safety: \nCrisis: MHERL\nFollow-up: GP Monday";
    const text = applySafetyPlan(start, { ...BLANK_SAFETY_PLAN, warning: "Pacing", safer: "Sister holds tablets" });
    expect(text.split("\n")).toEqual([
      "Plan: Home with sister",
      "Step 1, warning signs: Pacing.",
      "Means safety: Step 6, making the environment safer: Sister holds tablets.",
      "Crisis: MHERL",
      "Follow-up: GP Monday",
    ]);
    expect(headingFilled(text, "Means safety")).toBe(true);
  });

  it("inserts before the next heading, after any blank lines are skipped", () => {
    const text = insertUnderHeading("Plan: Home\n\nCrisis: Call", "Plan", "Step 2, things I can do on my own: Music.");
    expect(text).toBe("Plan: Home\nStep 2, things I can do on my own: Music.\n\nCrisis: Call");
    expect(insertUnderHeading(text, "Plan", "Step 2, things I can do on my own: Music.")).toBe(text);
  });

  it("keeps the existing Safety plan gate: it is met by a filled Plan heading", () => {
    const state: TriageState = { ...blank(), urgency: "B" };
    const gate = () => requirements(state, Date.now()).find((r) => r.label === "Safety plan");
    expect(gate()?.ok).toBe(false);
    state.text = { ...state.text, rp: applySafetyPlan("", { ...BLANK_SAFETY_PLAN, warning: "Pacing" }) };
    expect(gate()?.ok).toBe(true);
  });

  it("counts the six steps only and toggles tap-to-add items", () => {
    expect(stepsFilled(draft)).toBe(5);
    expect(stepsFilled({ ...BLANK_SAFETY_PLAN, reasons: "Family", withPerson: true })).toBe(0);
    expect(toggleItem("", "Lifeline 13 11 14")).toBe("Lifeline 13 11 14");
    expect(toggleItem("Lifeline 13 11 14; Emergency 000", "Lifeline 13 11 14")).toBe("Emergency 000");
    expect(applySafetyPlan("", { ...BLANK_SAFETY_PLAN, withPerson: true })).toBe(`Follow-up: ${MADE_WITH_PERSON}\n`);
  });
});

describe("means safety", () => {
  it("shows only when Plan or intent, or Access to means, is marked present", () => {
    expect(meansSafetyShown(blank())).toBe(false);
    expect(meansSafetyShown({ f: { "suicide.now.idea": "y" } })).toBe(false);
    expect(meansSafetyShown({ f: { "suicide.now.plan": "u" } })).toBe(false);
    expect(meansSafetyShown({ f: { "suicide.now.plan": "y" } })).toBe(true);
    expect(meansSafetyShown({ f: { "suicide.now.means": "y" } })).toBe(true);
  });

  it("reads unanswered rows as Not asked yet, never No, and prompts on Still accessible", () => {
    const state: TriageState = {
      ...blank(),
      f: { "suicide.now.means": "y" },
      means: { med: { asked: true, status: "open" }, gun: { asked: true, status: "none" } },
      text: { ...blank().text, meansMed: "Bedside drawer" },
    };
    expect(meansSummary(state)).toBe(
      "Medicines: still accessible, Bedside drawer; Firearms: no access; Ligatures: not asked yet; Heights, car, other: not asked yet",
    );
    expect(meansPrefill(state)).toBe("Medicines: still accessible, Bedside drawer; Firearms: no access");
    expect(meansStillOpen(state, "med")).toBe(true);
    expect(meansStillOpen(state, "gun")).toBe(false);
    expect(meansSummary({ ...state, f: {} })).toBeNull();
    expect(summaryText(summaryModel(state))).toContain("Means safety: Medicines: still accessible");
  });
});

describe("follow-up", () => {
  const today = new Date(2026, 10, 9, 10, 0);

  it("shows for every outcome but Accepted, and only once one is chosen", () => {
    expect(followUpShown(null)).toBe(false);
    expect(followUpShown("Accepted")).toBe(false);
    for (const outcome of ["Referred on", "Advice only", "No further action"])
      expect(followUpShown(outcome)).toBe(true);
  });

  it("hints for marked current risk, never for past risk alone, and never chooses", () => {
    const base: TriageState = { ...blank(), outcome: "Advice only" };
    expect(followUpHint(base, null)).toBeNull();
    expect(followUpHint({ ...base, f: { "violence.bg.prev": "y" } }, null)).toBeNull();
    const risky = { ...base, f: { "suicide.now.idea": "y" as const } };
    expect(followUpHint(risky, null)).toBe(
      `Current risk is marked. Consider a follow-up contact within ${FOLLOW_UP_WINDOWS.hintHours} hours. You choose.`,
    );
    expect(risky.followUp).toBeNull();
    expect(followUpHint({ ...risky, followUp: "72h" }, null)).toBeNull();
    expect(followUpHint({ ...risky, followUp: "7d" }, null)).not.toBeNull();
    expect(followUpHint({ ...risky, outcome: "Accepted" }, null)).toBeNull();
  });

  it("hints for a hospital discharge in the window, from the record", () => {
    const base: TriageState = { ...blank(), outcome: "Referred on" };
    expect(followUpHint(base, 12)).toBe(
      "Discharged from hospital 12 days ago. Consider a follow-up contact within 72 hours. You choose.",
    );
    expect(daysSinceDischarge([{ kind: "admission", end: "28 Oct 2026" }], today)).toBe(12);
    expect(daysSinceDischarge([{ kind: "admission", end: "2 Oct 2026" }], today)).toBeNull();
    expect(daysSinceDischarge([{ kind: "ed", end: "8 Nov 2026" }], today)).toBeNull();
    expect(daysSinceDischarge([{ kind: "admission", end: "Nov 2026" }], today)).toBeNull();
    expect(daysSinceDischarge([{ kind: "admission", end: "20 Nov 2026" }], today)).toBeNull();
    expect(
      daysSinceDischarge(
        [
          { kind: "admission", end: "1 Nov 2026" },
          { kind: "admission", end: "6 Nov 2026" },
        ],
        today,
      ),
    ).toBe(3);
  });

  it("reads into the summary and the iSoBAR R line", () => {
    const state: TriageState = {
      ...blank(),
      outcome: "Referred on",
      followUp: "72h",
      text: { ...blank().text, followUpWho: "Community team" },
    };
    expect(followUpText(state)).toBe("Within 72 h, Community team to contact");
    expect(summaryText(summaryModel(state))).toContain("Follow-up: Within 72 h, Community team to contact");
    expect(isbarText(state).split("\n").at(-1)).toBe(
      // D-187 item 17 (Q39): the safety plan's Plan and Crisis lines come before the follow-up.
      "R Recommendation: Actions – · Review risk by – · Plan – · Crisis – · Follow-up Within 72 h, Community team to contact",
    );
    expect(followUpText({ ...state, followUp: "none", text: { ...state.text, followUpWhy: "Has GP Monday" } })).toBe(
      "Not needed: Has GP Monday",
    );
    expect(followUpText({ ...state, outcome: "Accepted" })).toBeNull();
  });
});
