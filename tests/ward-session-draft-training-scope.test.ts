// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearSessionDrafts,
  draftSessionVersion,
  readSessionDraft,
  sessionDraftKey,
  setDraftScenarioScope,
  writeSessionDraft,
} from "@/components/ward-management/ward-session-drafts";

/* Feature 47: the training world's drafts are fenced without deleting the real world's. Synthetic text. */

const REAL = "standard/3";
const TRAINING = "training/standard/0";

describe("training draft scope", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    clearSessionDrafts();
  });
  afterEach(() => clearSessionDrafts());

  it("keeps the real world's draft while training runs, and drops training drafts on the way back", () => {
    setDraftScenarioScope(REAL);
    const realKey = sessionDraftKey(REAL, "referral", "WF-001");
    writeSessionDraft(realKey, "synthetic real draft", draftSessionVersion());
    expect(readSessionDraft(realKey)).toBe("synthetic real draft");

    setDraftScenarioScope(TRAINING);
    expect(readSessionDraft(realKey)).toBe("synthetic real draft");
    const trainingKey = sessionDraftKey(TRAINING, "referral", "WF-001");
    writeSessionDraft(trainingKey, "synthetic practice draft", draftSessionVersion());
    expect(readSessionDraft(trainingKey)).toBe("synthetic practice draft");

    // A training reset replaces the outgoing training world's drafts only.
    setDraftScenarioScope("training/standard/1");
    expect(readSessionDraft(trainingKey)).toBeNull();
    expect(readSessionDraft(realKey)).toBe("synthetic real draft");

    expect(
      writeSessionDraft(
        sessionDraftKey("training/standard/1", "referral", "WF-002"),
        "synthetic practice draft",
        draftSessionVersion(),
      ),
    ).toBe(true);
    setDraftScenarioScope(REAL);
    expect(readSessionDraft(realKey)).toBe("synthetic real draft");
    expect(Object.keys(window.sessionStorage).filter((key) => key.includes("training"))).toEqual([]);
  });

  it("still replaces another real world's drafts", () => {
    setDraftScenarioScope(REAL);
    const realKey = sessionDraftKey(REAL, "referral", "WF-001");
    writeSessionDraft(realKey, "synthetic real draft", draftSessionVersion());
    setDraftScenarioScope("standard/4");
    expect(readSessionDraft(realKey)).toBeNull();
  });
});
