import { describe, expect, it } from "vitest";

import {
  ADMIN_SETTINGS_HELP,
  filterGlossary,
  GLOSSARY,
  KEYBOARD_SHORTCUTS,
  SCREEN_HELP,
  screenHelpFor,
} from "@/components/ward-management/help/ward-help-content";
import { formTitleForCode } from "@/lib/form-register";
import { BED_FINDER_MENU_ID, railEntries } from "@/components/ward-management/shell/ward-rail-entries";

// Usability audit, 24 Oct 2026: 14 of 31 screens showed Home's help, and some had none of their own.
const entries = railEntries();

describe("screen help", () => {
  it("gives detail pages their own help, never Home's", () => {
    expect(screenHelpFor("/ward-flow/settings", entries)?.id).toBe("settings");
    expect(screenHelpFor("/ward-flow/ward/u1", entries)?.id).toBe("ward");
    expect(screenHelpFor("/ward-flow/ward/u1/answer", entries)?.id).toBe("ward-answer");
    expect(screenHelpFor("/ward-flow/people/p1", entries)?.id).toBe("patient");
    expect(screenHelpFor("/ward-flow/people/new", entries)?.id).toBe("add-patient");
    expect(screenHelpFor("/ward-flow/ed/e1", entries)?.id).toBe("ed-board");
    expect(screenHelpFor("/ward-flow/legal-forms", entries)?.id).toBe("legal-forms");
    expect(screenHelpFor("/ward-flow/community/t1", entries)?.id).toBe("community-team");
    expect(screenHelpFor("/ward-flow/constellation", entries)).toBeUndefined();
  });

  it("names the screen as the desk's own menu does", () => {
    expect(screenHelpFor("/ward-flow", entries, "coordinator")?.title).toBe("My list");
    expect(screenHelpFor("/ward-flow/ward/u1", entries, "ward")?.title).toBe("My ward");
    expect(screenHelpFor("/ward-flow/wards", entries, "ward")?.title).toBe("All wards");
    expect(screenHelpFor("/ward-flow/ed/e1", entries, "ed")?.title).toBe("My ED board");
    expect(screenHelpFor("/ward-flow/community/t1", entries, "community")?.title).toBe("My team");
    expect(screenHelpFor("/ward-flow/community", entries, "community")?.title).toBe("Community");
  });

  it("answers each task on the screen where it is done", () => {
    const questions = (path: string) => screenHelpFor(path, entries)?.questions?.map((item) => item.question) ?? [];
    expect(questions("/ward-flow/people/p1")).toEqual([
      "How do I ask more wards?",
      "How do I pull a bed?",
      "How do I change a destination?",
      "Why can't I book transport?",
    ]);
    expect(questions("/ward-flow/referrals")).toContain("How do I ask more wards?");
    expect(questions("/ward-flow/ward/u1")).toContain("Why can't I answer this referral?");
    expect(questions("/ward-flow/handover")).toContain("How do I hand over to the next shift?");
  });

  it("lists each keyboard shortcut once", () => {
    const keys = KEYBOARD_SHORTCUTS.map((item) => item.keys);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

// Help and tour audit, 26 Oct 2026 (stream D).
describe("help and tour audit fixes", () => {
  it("explains the words and codes the screens use (HF-08)", () => {
    const terms = GLOSSARY.map((entry) => entry.term);
    for (const term of [
      "Tier",
      "CTO",
      "AWOL",
      "ETA",
      "CLD",
      "MDT",
      "MHA",
      "ED",
      "EDD",
      "Form 1A",
      "Form 4A",
      "Form 6A",
    ]) {
      expect(terms, term).toContain(term);
    }
    // Form names come from the Chief Psychiatrist's register, the same titles the screens show.
    expect(filterGlossary("Form 1A")[0]?.meaning).toContain(formTitleForCode("1A") ?? "missing");
  });

  it("gives the access admin's Settings home help about roles, not network rules (HF-02)", () => {
    expect(ADMIN_SETTINGS_HELP.actions.length).toBeLessThanOrEqual(3);
    const words = JSON.stringify(ADMIN_SETTINGS_HELP);
    for (const name of ["Give for 90 days", "Give a role", "Remove"]) expect(words).toContain(name);
    expect(words).not.toContain("Rules");
  });

  it("answers how to put a screen on the meeting room TV where the TV is opened (HF-10)", () => {
    const questions = (path: string) => screenHelpFor(path, entries)?.questions?.map((item) => item.question) ?? [];
    for (const path of ["/ward-flow/capacity", "/ward-flow/ward/u1", "/ward-flow/ed/e1"]) {
      expect(questions(path), path).toContain("How do I put this on the meeting room TV?");
    }
  });

  it("never tells staff the TV hides names, since every TV view shows them in full (D-83, WT-20)", () => {
    const answers = ["/ward-flow/capacity", "/ward-flow/ward/u1", "/ward-flow/ed/e1"]
      .flatMap((path) => screenHelpFor(path, entries)?.questions ?? [])
      .map((item) => item.answer)
      .join(" ");
    expect(answers).toContain("full names");
    expect(answers).not.toMatch(/initials/i);
  });

  it("names both ED row buttons that start a referral (WT-35)", () => {
    expect(screenHelpFor("/ward-flow/ed/e1", entries)?.actions.join(" ")).toMatch(/Refer to a ward.*Ask for a bed/);
  });

  it("gives a phone a line it can use instead of a keyboard hint (HF-14)", () => {
    const referrals = screenHelpFor("/ward-flow/referrals", entries);
    expect(referrals?.actions.join(" ")).toContain("On a keyboard");
    expect(referrals?.phoneActions?.join(" ")).not.toMatch(/keyboard|Press \?/);
  });

  it("describes Find a bed as a fixed-order filter, never a suggestion (HF-16)", () => {
    const words = JSON.stringify(SCREEN_HELP[BED_FINDER_MENU_ID]);
    expect(words).toContain("A to Z");
    expect(words).not.toMatch(/that fits?\b|could go/);
  });
});
