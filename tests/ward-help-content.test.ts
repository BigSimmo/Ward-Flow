import { describe, expect, it } from "vitest";

import { KEYBOARD_SHORTCUTS, screenHelpFor } from "@/components/ward-management/help/ward-help-content";
import { railEntries } from "@/components/ward-management/shell/ward-rail-entries";

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
    expect(screenHelpFor("/ward-flow/constellation", entries)).toBeUndefined();
  });

  it("names the screen as the desk's own menu does", () => {
    expect(screenHelpFor("/ward-flow", entries, "coordinator")?.title).toBe("My list");
    expect(screenHelpFor("/ward-flow/ward/u1", entries, "ward")?.title).toBe("My ward");
    expect(screenHelpFor("/ward-flow/wards", entries, "ward")?.title).toBe("All wards");
    expect(screenHelpFor("/ward-flow/ed/e1", entries, "ed")?.title).toBe("My ED board");
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
