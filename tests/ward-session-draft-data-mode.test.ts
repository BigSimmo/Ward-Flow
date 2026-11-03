// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearSessionDrafts,
  draftSessionVersion,
  draftStorageAllowed,
  readSessionDraft,
  sessionDraftKey,
  setDraftDataMode,
  writeSessionDraft,
} from "@/components/ward-management/ward-session-drafts";

// Q392: drafts reach browser storage only in the prototype data mode.
describe("session drafts and the data mode", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    setDraftDataMode("prototype");
    clearSessionDrafts();
  });
  afterEach(() => {
    setDraftDataMode("prototype");
    clearSessionDrafts();
  });

  it("stores and restores a synthetic draft in prototype mode", () => {
    expect(draftStorageAllowed()).toBe(true);
    const key = sessionDraftKey("standard/0", "referral", "new");
    expect(writeSessionDraft(key, "Synthetic Person, free text", draftSessionVersion())).toBe(true);
    expect(readSessionDraft(key)).toBe("Synthetic Person, free text");
  });

  it("writes nothing to sessionStorage outside prototype mode and clears what was there", () => {
    const stored = sessionDraftKey("standard/0", "referral", "new");
    expect(writeSessionDraft(stored, "Synthetic Person, earlier draft", draftSessionVersion())).toBe(true);

    setDraftDataMode("live");
    expect(draftStorageAllowed()).toBe(false);
    expect(window.sessionStorage.length).toBe(0);

    const key = sessionDraftKey("standard/0", "legal", "new");
    expect(writeSessionDraft(key, "Synthetic Person, free text", draftSessionVersion())).toBe(false);
    expect(readSessionDraft(key)).toBeNull();
    expect(readSessionDraft(stored)).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
  });

  it("treats an unknown mode as not prototype", () => {
    setDraftDataMode("");
    expect(draftStorageAllowed()).toBe(false);
    const key = sessionDraftKey("standard/0", "referral", "new");
    expect(writeSessionDraft(key, "Synthetic Person", draftSessionVersion())).toBe(false);
    expect(window.sessionStorage.length).toBe(0);
  });
});
