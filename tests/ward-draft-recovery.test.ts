// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSessionDrafts,
  draftSessionVersion,
  readSessionDraft,
  sessionDraftKey,
  setDraftAccount,
  writeSessionDraft,
} from "@/components/ward-management/ward-session-drafts";

describe("synthetic session draft storage", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    clearSessionDrafts();
    setDraftAccount("synthetic-demo");
  });
  it("scopes versioned drafts by account, session, scenario and subject without localStorage", () => {
    const local = vi.spyOn(window.localStorage, "setItem");
    const key = sessionDraftKey("demo-a", "referral", "synthetic-1");
    expect(writeSessionDraft(key, "synthetic draft", draftSessionVersion())).toBe(true);
    expect(readSessionDraft(key)).toBe("synthetic draft");
    expect(readSessionDraft(sessionDraftKey("demo-b", "referral", "synthetic-1"))).toBeNull();
    expect(readSessionDraft(sessionDraftKey("demo-a", "referral", "synthetic-2"))).toBeNull();
    setDraftAccount("synthetic-other");
    expect(readSessionDraft(key)).toBeNull();
    expect(local).not.toHaveBeenCalled();
    local.mockRestore();
  });
  it("refuses malformed and incompatible values", () => {
    const key = sessionDraftKey("demo", "legal", "new");
    for (const value of [
      "{",
      JSON.stringify({ version: 8, value: "synthetic" }),
      JSON.stringify({ version: 1, value: 5 }),
    ]) {
      window.sessionStorage.setItem(key, value);
      expect(readSessionDraft(key)).toBeNull();
    }
  });
  it("fences stale writes after sign-out/reset", () => {
    const owner = draftSessionVersion();
    const key = sessionDraftKey("demo", "referral", "new");
    clearSessionDrafts();
    expect(writeSessionDraft(key, "synthetic stale", owner)).toBe(false);
    expect(readSessionDraft(key)).toBeNull();
  });
  it("handles unavailable or full sessionStorage", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(writeSessionDraft(sessionDraftKey("demo", "legal", "new"), "synthetic", draftSessionVersion())).toBe(false);
    spy.mockRestore();
  });
});

import { SESSION_DRAFT_MAX_AGE_MS, SESSION_DRAFT_MAX_CHARS } from "@/components/ward-management/ward-session-drafts";
import { keepReferralDraft, readKeptReferralDraft } from "@/components/ward-management/referrals/referral-draft-store";

it("rejects future/invalid timestamps and expires at the session's 12-hour limit", () => {
  clearSessionDrafts();
  const key = sessionDraftKey("demo", "legal", "new");
  const now = Date.now();
  for (const timestamps of [
    { savedAt: now + 60000, expiresAt: now + 120000 },
    { savedAt: "invalid", expiresAt: now + 120000 },
    { savedAt: now, expiresAt: now + SESSION_DRAFT_MAX_AGE_MS + 60000 },
  ]) {
    window.sessionStorage.setItem(key, JSON.stringify({ version: 1, value: "synthetic", ...timestamps }));
    expect(readSessionDraft(key)).toBeNull();
  }
  writeSessionDraft(key, "synthetic", draftSessionVersion());
  vi.useFakeTimers();
  vi.setSystemTime(now + SESSION_DRAFT_MAX_AGE_MS + 1);
  expect(readSessionDraft(key)).toBeNull();
  vi.useRealTimers();
});
it("bounds session text and excludes attachment bytes while preserving the memory draft", () => {
  clearSessionDrafts();
  const key = sessionDraftKey("demo", "referral", "new");
  expect(writeSessionDraft(key, "x".repeat(SESSION_DRAFT_MAX_CHARS + 1), draftSessionVersion())).toBe(false);
  const draft = { documentation: { charts: [{ base64: "synthetic-attachment-bytes" }] } };
  keepReferralDraft(draft, undefined, key);
  expect(readKeptReferralDraft()).toBe(draft);
  expect(readSessionDraft(key)).not.toContain("synthetic-attachment-bytes");
  expect(JSON.parse(readSessionDraft(key)!)).toEqual({ documentation: { charts: [] }, needsChartReattachment: true });
});
