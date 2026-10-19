import { afterEach, describe, expect, it } from "vitest";

import {
  clearLegacySessionDrafts,
  readSessionDraft,
  sessionDraftKey,
  writeSessionDraft,
  draftSessionVersion,
} from "@/components/ward-management/ward-session-drafts";

afterEach(() => window.sessionStorage.clear());

describe("session drafts saved before legal answers started blank", () => {
  it("drops a version 1 draft, which may hold the old Voluntary default, and keeps the current one", () => {
    const current = sessionDraftKey("standard/0", "referral", "new");
    const legacy = current.replace(/^wf-draft:v2:/, "wf-draft:v1:");
    expect(legacy).not.toBe(current);
    window.sessionStorage.setItem(legacy, JSON.stringify({ legalStatus: "Voluntary" }));
    expect(writeSessionDraft(current, JSON.stringify({ legalStatus: "" }), draftSessionVersion())).toBe(true);

    expect(readSessionDraft(legacy)).toBeNull();
    clearLegacySessionDrafts();
    expect(window.sessionStorage.getItem(legacy)).toBeNull();
    expect(readSessionDraft(current)).toBe(JSON.stringify({ legalStatus: "" }));
  });
});
