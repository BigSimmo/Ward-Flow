import { afterEach, describe, expect, it } from "vitest";

import { referralDraftMemory } from "@/components/ward-management/referrals/referral-draft-lifecycle";
import { endWardFlowBrowserSession } from "@/components/ward-management/ward-browser-data";
import {
  draftSessionVersion,
  readSessionDraft,
  sessionDraftKey,
  writeSessionDraft,
} from "@/components/ward-management/ward-session-drafts";

/**
 * Part A item 30 (26 Oct 2026, SM2-12, PS-10): when the app signs someone out, including the
 * automatic idle sign-out and an expired session, half-typed text is not kept for the next
 * person. Sign-out, expiry, a refused session and the idle lock's sign-out all end in
 * endWardFlowBrowserSession (see use-ward-supabase-shared.ts and ward-session-safeguards).
 */
// Typed-text entries only. A fresh, empty session marker (wf-draft-session) may be written later.
const wardDraftKeys = () =>
  Array.from({ length: window.sessionStorage.length }, (_, i) => window.sessionStorage.key(i)).filter((key) =>
    key?.startsWith("wf-draft:"),
  );

afterEach(() => {
  window.sessionStorage.clear();
});

describe("signing out clears half-typed text (A30)", () => {
  it("removes a saved draft and stops the outgoing form writing it back", () => {
    const owner = draftSessionVersion();
    const key = sessionDraftKey("synthetic-world", "referral", "PT-synthetic");
    expect(writeSessionDraft(key, "Synthetic half-typed reason", owner)).toBe(true);
    expect(readSessionDraft(key)).toBe("Synthetic half-typed reason");
    referralDraftMemory.kept = { reason: "Synthetic kept draft" };

    endWardFlowBrowserSession();

    expect(wardDraftKeys()).toEqual([]);
    expect(referralDraftMemory.kept).toBeNull();
    // A form still mounted for the outgoing person has a late autosave queued: it is fenced off.
    expect(writeSessionDraft(key, "Synthetic late autosave", owner)).toBe(false);
    expect(wardDraftKeys()).toEqual([]);
  });

  it("does not offer the outgoing person's draft to whoever signs in next", () => {
    const key = sessionDraftKey("synthetic-world", "legal", "PT-synthetic");
    writeSessionDraft(key, "Synthetic legal note", draftSessionVersion());

    endWardFlowBrowserSession();

    const nextKey = sessionDraftKey("synthetic-world", "legal", "PT-synthetic");
    expect(nextKey).not.toBe(key);
    expect(readSessionDraft(key)).toBeNull();
    expect(readSessionDraft(nextKey)).toBeNull();
  });
});
