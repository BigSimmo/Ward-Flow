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

it("retains the attachment reattach reminder through later recovered autosaves", () => {
  clearSessionDrafts();
  const key = sessionDraftKey("demo", "referral", "new");
  keepReferralDraft({ documentation: { charts: [] }, needsChartReattachment: true }, undefined, key);
  expect(JSON.parse(readSessionDraft(key)!)).toMatchObject({ needsChartReattachment: true });
});

import { setDraftScenarioScope } from "@/components/ward-management/ward-session-drafts";
it("fences old-world writes on an observed incoming scenario replacement", () => {
  clearSessionDrafts();
  const oldKey = sessionDraftKey("standard/0", "referral", "new");
  const owner = draftSessionVersion();
  writeSessionDraft(oldKey, "synthetic old world", owner);
  setDraftScenarioScope("standard/1");
  expect(readSessionDraft(oldKey)).toBeNull();
  expect(writeSessionDraft(oldKey, "synthetic stale callback", owner)).toBe(false);
  const nextKey = sessionDraftKey("standard/1", "referral", "new");
  expect(writeSessionDraft(nextKey, "synthetic next world", owner)).toBe(true);
});

import { clearReferralDraftSession } from "@/components/ward-management/referrals/referral-draft-store";

const completeDraft = () => ({
  activePatientKey: "patient:PT-023",
  destType: "ward",
  activeSection: "patient",
  ageBand: "Adult",
  selectedUnitIds: [],
  selectedRecipient: "",
  documentation: {
    medical: "",
    expectedAt: "",
    contactName: "",
    contactPhone: "",
    triage: "",
    additional: "",
    charts: [],
  },
  contact: { name: "", email: "", phone: "", role: "", location: "" },
  catchmentSuburb: "",
  catchmentTeam: "",
  catchmentService: "",
  catchmentConfirmed: false,
  homeRegion: "",
  sourceKind: "ed",
  originSiteCode: "",
  sendingTeam: "",
  referralSex: "Not recorded",
  referralGender: "",
  highAcuity: false,
  arrivalEta: "",
  legalStatus: "",
  urgency: "",
  security: "Open",
  provisionalDiag: "",
  doctorNote: "",
  clinicalSummary: "",
  transport: "",
  transitNote: "",
  riskFlags: {},
  clearanceChecks: {},
  communityNeeds: {},
  edNeeds: {},
});

describe("referral recovery projection validation", () => {
  beforeEach(() => {
    clearReferralDraftSession();
    window.sessionStorage.clear();
  });
  it("accepts a complete incomplete-form projection with optional typed answers", () => {
    const key = sessionDraftKey("demo", "referral", "new");
    const draft = {
      ...completeDraft(),
      unidentified: null,
      atsCategory: 3,
      notOnWard: { unitId: "synthetic-unit", reason: "Recently discharged from this ward" },
      communityNeeds: { firstContact: "72 hours", homeVisit: false },
      edNeeds: { comingBy: "Ambulance", medicalReviewFirst: true, expectedArrival: "12:30" },
      clearanceChecks: { ecg: "to_follow" },
    };
    writeSessionDraft(key, JSON.stringify(draft), draftSessionVersion());
    expect(readKeptReferralDraft(key)).toEqual(draft);
  });
  it.each([
    { destType: "unknown" },
    { activeSection: "unknown" },
    { ageBand: "unknown" },
    { sourceKind: "unknown" },
    { homeRegion: "unknown" },
    { referralSex: "unknown" },
    { referralGender: "unknown" },
    { catchmentService: "unknown" },
    { unidentified: 42 },
    { unidentified: {} },
    { atsCategory: "3" },
    { atsCategory: 6 },
    { notOnWard: { unitId: 1, reason: "Recently discharged from this ward" } },
    { notOnWard: { unitId: "synthetic-unit", reason: "unknown" } },
    { documentation: { medical: "", charts: [] } },
    { contact: { name: "" } },
    { communityNeeds: { firstContact: "unknown" } },
    { communityNeeds: { homeVisit: "yes" } },
    { edNeeds: { comingBy: "unknown" } },
    { edNeeds: { expectedArrival: [] } },
    { clearanceChecks: { ecg: "unknown" } },
    { clearanceChecks: { unknown: "done" } },
    { riskFlags: { suicide: "yes" } },
    { selectedUnitIds: [null] },
    { needsChartReattachment: "yes" },
  ])("rejects and removes malformed field projection %#", (changes) => {
    const key = sessionDraftKey("demo", "referral", "new");
    writeSessionDraft(key, JSON.stringify({ ...completeDraft(), ...changes }), draftSessionVersion());
    expect(readKeptReferralDraft(key)).toBeNull();
    expect(window.sessionStorage.getItem(key)).toBeNull();
    expect(readKeptReferralDraft(key)).toBeNull();
  });
  it("removes malformed JSON instead of repeatedly attempting to restore it", () => {
    const key = sessionDraftKey("demo", "referral", "new");
    writeSessionDraft(key, "{", draftSessionVersion());
    expect(readKeptReferralDraft(key)).toBeNull();
    expect(window.sessionStorage.getItem(key)).toBeNull();
    window.sessionStorage.setItem(key, "{");
    expect(readSessionDraft(key)).toBeNull();
    expect(window.sessionStorage.getItem(key)).toBeNull();
  });
});

import { discardReferralDraft } from "@/components/ward-management/referrals/referral-draft-store";
import {
  referralRecoverySaved,
  referralDraftSessionVersion,
} from "@/components/ward-management/referrals/referral-draft-cache";

describe("single referral draft session ownership", () => {
  beforeEach(() => {
    clearReferralDraftSession();
    window.sessionStorage.clear();
  });

  it("moves a generic draft to its named key without leaving a second recoverable copy after discard", () => {
    const genericKey = sessionDraftKey("demo", "referral", "new");
    const namedKey = sessionDraftKey("demo", "referral", "PT-023");
    const draft = completeDraft();
    keepReferralDraft(draft, undefined, genericKey);
    expect(readKeptReferralDraft(namedKey)).toEqual(draft);
    keepReferralDraft({ ...draft, doctorNote: "Synthetic updated draft" }, undefined, namedKey);
    expect(readSessionDraft(genericKey)).toBeNull();
    expect(readSessionDraft(namedKey)).not.toBeNull();
    discardReferralDraft(); // Both accepted Send and Discard use this same cleanup.
    expect(readSessionDraft(namedKey)).toBeNull();
    expect(readKeptReferralDraft(genericKey)).toBeNull();
  });

  it("settles the prior owner when restoring an already-persisted named copy", () => {
    const genericKey = sessionDraftKey("demo", "referral", "new");
    const namedKey = sessionDraftKey("demo", "referral", "PT-023");
    const draft = completeDraft();
    keepReferralDraft(draft, undefined, genericKey);
    const recovered = { ...draft, doctorNote: "Synthetic recovered update" };
    writeSessionDraft(namedKey, JSON.stringify(recovered), draftSessionVersion());
    expect(readKeptReferralDraft(namedKey)).toEqual(recovered);
    expect(readSessionDraft(genericKey)).toBeNull();
    discardReferralDraft();
    expect(readSessionDraft(namedKey)).toBeNull();
  });

  it("retains the named memory draft when its first session write is unavailable", () => {
    const namedKey = sessionDraftKey("demo", "referral", "PT-023");
    const draft = completeDraft();
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });
    try {
      keepReferralDraft(draft, undefined, namedKey);
      expect(referralRecoverySaved()).toBe(false);
      expect(readKeptReferralDraft(namedKey)).toEqual(draft);
      expect(readSessionDraft(namedKey)).toBeNull();
    } finally {
      setItem.mockRestore();
    }
  });

  it("retains the last recoverable copy on migration failure and clears it on discard", () => {
    const genericKey = sessionDraftKey("demo", "referral", "new");
    const namedKey = sessionDraftKey("demo", "referral", "PT-023");
    const draft = completeDraft();
    keepReferralDraft(draft, undefined, genericKey);
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });
    const edited = { ...draft, doctorNote: "Synthetic unsaved update" };
    try {
      expect(keepReferralDraft(edited, undefined, namedKey)).toBe(true);
      expect(referralRecoverySaved()).toBe(false);
      expect(readKeptReferralDraft()).toEqual(edited);
      expect(readSessionDraft(genericKey)).not.toBeNull();
      expect(readSessionDraft(namedKey)).toBeNull();
    } finally {
      setItem.mockRestore();
    }
    discardReferralDraft();
    expect(readSessionDraft(genericKey)).toBeNull();
    expect(readKeptReferralDraft(genericKey)).toBeNull();
  });

  it("retires the previous key after a failed migration later succeeds", () => {
    const genericKey = sessionDraftKey("demo", "referral", "new");
    const namedKey = sessionDraftKey("demo", "referral", "PT-023");
    const draft = completeDraft();
    keepReferralDraft(draft, undefined, genericKey);
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });
    try {
      keepReferralDraft(draft, undefined, namedKey);
    } finally {
      setItem.mockRestore();
    }
    keepReferralDraft(draft, undefined, namedKey);
    expect(referralRecoverySaved()).toBe(true);
    expect(readSessionDraft(genericKey)).toBeNull();
    discardReferralDraft();
    expect(readSessionDraft(namedKey)).toBeNull();
  });
  it("resets both draft owners and refuses the outgoing session after a failed transfer", () => {
    const genericKey = sessionDraftKey("demo/0", "referral", "new");
    const namedKey = sessionDraftKey("demo/0", "referral", "PT-023");
    const owner = referralDraftSessionVersion();
    const draft = completeDraft();
    keepReferralDraft(draft, owner, genericKey);
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });
    try {
      keepReferralDraft(draft, owner, namedKey);
    } finally {
      setItem.mockRestore();
    }
    clearReferralDraftSession(); // Account termination and scenario replacement share this boundary.
    expect(readKeptReferralDraft()).toBeNull();
    expect(readSessionDraft(genericKey)).toBeNull();
    expect(readSessionDraft(namedKey)).toBeNull();
    expect(keepReferralDraft(draft, owner, genericKey)).toBe(false);
    const nextKey = sessionDraftKey("demo/1", "referral", "PT-023");
    keepReferralDraft(draft, undefined, nextKey);
    expect(readSessionDraft(nextKey)).not.toBeNull();
    discardReferralDraft();
    expect(readSessionDraft(nextKey)).toBeNull();
  });
  it("clears a matching preexisting generic alias after the named draft is restored and discarded", () => {
    const genericKey = sessionDraftKey("demo", "referral", "new");
    const namedKey = sessionDraftKey("demo", "referral", "PT-023");
    const draft = completeDraft();
    writeSessionDraft(genericKey, JSON.stringify(draft), draftSessionVersion());
    writeSessionDraft(namedKey, JSON.stringify(draft), draftSessionVersion());
    readKeptReferralDraft(namedKey); // A refresh starts with no in-memory previous owner.
    discardReferralDraft();
    expect(readSessionDraft(namedKey)).toBeNull();
    expect(readSessionDraft(genericKey)).toBeNull();
    expect(readKeptReferralDraft(genericKey)).toBeNull();
  });

  it.each(["different patient", "different scenario"])(
    "retains a generic draft for a %s during named cleanup",
    (difference) => {
      const genericKey = sessionDraftKey(
        difference === "different scenario" ? "other-demo" : "demo",
        "referral",
        "new",
      );
      const namedKey = sessionDraftKey("demo", "referral", "PT-023");
      const named = completeDraft();
      const generic = {
        ...named,
        activePatientKey: difference === "different patient" ? "patient:PT-024" : named.activePatientKey,
      };
      writeSessionDraft(genericKey, JSON.stringify(generic), draftSessionVersion());
      writeSessionDraft(namedKey, JSON.stringify(named), draftSessionVersion());
      readKeptReferralDraft(namedKey);
      discardReferralDraft();
      expect(readSessionDraft(namedKey)).toBeNull();
      expect(JSON.parse(readSessionDraft(genericKey)!)).toEqual(generic);
    },
  );
});
