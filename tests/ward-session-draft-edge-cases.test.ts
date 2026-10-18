// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSessionDrafts,
  draftSessionVersion,
  readSessionDraft,
  sessionDraftKey,
  SESSION_DRAFT_MAX_AGE_MS,
  writeSessionDraft,
} from "@/components/ward-management/ward-session-drafts";

const SESSION_KEY = "wf-draft-session:v1";

describe("session draft browser capability edges", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-18T00:00:00Z"));
    window.sessionStorage.clear();
    clearSessionDrafts();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    clearSessionDrafts();
    vi.useRealTimers();
  });
  it("uses getRandomValues when randomUUID is absent and keeps a draft recoverable later", () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.fill(0xa5);
      return bytes;
    });
    vi.stubGlobal("crypto", { getRandomValues });
    const key = sessionDraftKey("standard/0", "legal", "new");
    expect(writeSessionDraft(key, "synthetic capability draft", draftSessionVersion())).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(readSessionDraft(key)).toBe("synthetic capability draft");
    const session = JSON.parse(window.sessionStorage.getItem(SESSION_KEY)!);
    expect(session.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(getRandomValues).toHaveBeenCalledTimes(1);
    expect(sessionDraftKey("standard/0", "legal", "new")).toBe(key);
  });
  it("keeps a stable bounded in-memory session when only session metadata cannot be saved", () => {
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === SESSION_KEY) throw new Error("session metadata blocked");
      return setItem.call(this, key, value);
    });
    const owner = draftSessionVersion();
    const key = sessionDraftKey("standard/0", "legal", "new");
    expect(writeSessionDraft(key, "synthetic fallback draft", owner)).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(readSessionDraft(key)).toBe("synthetic fallback draft");
    vi.advanceTimersByTime(SESSION_DRAFT_MAX_AGE_MS);
    expect(readSessionDraft(key)).toBeNull();
    expect(writeSessionDraft(key, "synthetic expired session", owner)).toBe(false);
    clearSessionDrafts();
    const nextKey = sessionDraftKey("standard/0", "legal", "new");
    expect(nextKey).not.toBe(key);
    expect(writeSessionDraft(key, "synthetic stale owner", owner)).toBe(false);
    expect(writeSessionDraft(nextKey, "synthetic new session", draftSessionVersion())).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(readSessionDraft(nextKey)).toBe("synthetic new session");
  });
});
