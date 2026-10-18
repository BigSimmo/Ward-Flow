import { useCallback, useEffect, useRef, useState } from "react";

import {
  clearSessionDrafts,
  draftSessionVersion,
  readSessionDraft,
  removeSessionDraft,
  writeSessionDraft,
  sessionDraftKey,
} from "../ward-session-drafts";

/** One memory copy and one explicitly opted-in synthetic session copy, with a single autosave owner. */
let keptStorageKey: string | undefined;
let recoverySaved = true;
const referralRecoverySaved = () => recoverySaved;
/** The reminder lasts until charts are attached again or the recovered draft is cleared. */
export function draftNeedsChartReattachment(draft: unknown, charts: readonly unknown[]): boolean {
  return (
    charts.length === 0 &&
    typeof draft === "object" &&
    draft !== null &&
    "needsChartReattachment" in draft &&
    draft.needsChartReattachment === true
  );
}
let kept: unknown = null;
/** Wall-clock milliseconds when the draft was last kept, for the "Draft kept" age. */
let keptAtMs: number | null = null;
// A sign-out also invalidates callbacks owned by a drawer that is still unmounting.
let sessionVersion = 0;

function referralDraftSessionVersion(): number {
  return sessionVersion;
}

/** A new signed-in person must never inherit the previous person's draft or sender. */
export function clearReferralDraftSession(): void {
  sessionVersion += 1;
  clearSessionDrafts();
  keptStorageKey = undefined;
  kept = null;
  keptAtMs = null;
  lastReferrer = null;
}

export function keepReferralDraft<T>(draft: T, ownerVersion = sessionVersion, storageKey?: string): boolean {
  if (ownerVersion !== sessionVersion) return false;
  keptStorageKey = storageKey;
  if (storageKey) {
    // Attachment bytes stay in memory. A refresh restores choices/text and requires reattachment.
    const copy = draft as { documentation?: { charts?: unknown[] }; needsChartReattachment?: boolean };
    const projection = copy.documentation
      ? {
          ...copy,
          documentation: { ...copy.documentation, charts: [] },
          needsChartReattachment: !!copy.documentation.charts?.length || !!copy.needsChartReattachment,
        }
      : copy;
    recoverySaved = writeSessionDraft(storageKey, JSON.stringify(projection), draftSessionVersion());
  }
  kept = draft;
  keptAtMs = Date.now();
  return true;
}

export function readKeptReferralDraft<T>(storageKey?: string): T | null {
  if (kept !== null && (!storageKey || storageKey === keptStorageKey)) return kept as T;
  if (!storageKey) return null;
  const raw = readSessionDraft(storageKey);
  if (raw === null) {
    // Preserve the existing single-memory-draft ownership when another person opens a sheet.
    const scope = storageKey.slice(0, storageKey.lastIndexOf(":"));
    return keptStorageKey?.startsWith(scope + ":") ? (kept as T | null) : null;
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    const textFields = [
      "activePatientKey",
      "destType",
      "activeSection",
      "ageBand",
      "selectedRecipient",
      "catchmentSuburb",
      "catchmentTeam",
      "catchmentService",
      "homeRegion",
      "sourceKind",
      "originSiteCode",
      "sendingTeam",
      "referralSex",
      "referralGender",
      "arrivalEta",
      "legalStatus",
      "urgency",
      "security",
      "provisionalDiag",
      "doctorNote",
      "clinicalSummary",
      "transport",
      "transitNote",
    ];
    const isRecord = (item: unknown): item is Record<string, unknown> =>
      !!item && typeof item === "object" && !Array.isArray(item);
    if (
      (record.needsChartReattachment !== undefined && typeof record.needsChartReattachment !== "boolean") ||
      textFields.some((field) => typeof record[field] !== "string") ||
      !Array.isArray(record.selectedUnitIds) ||
      record.selectedUnitIds.some((id) => typeof id !== "string") ||
      !isRecord(record.contact) ||
      Object.values(record.contact).some((item) => typeof item !== "string") ||
      !isRecord(record.documentation) ||
      !Array.isArray(record.documentation.charts) ||
      record.documentation.charts.length !== 0 ||
      Object.entries(record.documentation).some(([name, item]) => name !== "charts" && typeof item !== "string") ||
      !isRecord(record.riskFlags) ||
      Object.values(record.riskFlags).some((item) => typeof item !== "boolean") ||
      !isRecord(record.clearanceChecks) ||
      !isRecord(record.communityNeeds) ||
      !isRecord(record.edNeeds) ||
      typeof record.highAcuity !== "boolean" ||
      typeof record.catchmentConfirmed !== "boolean"
    ) {
      removeSessionDraft(storageKey);
      return null;
    }
    kept = value;
    keptStorageKey = storageKey;
    keptAtMs = Date.now();
    return value as T;
  } catch {
    return null;
  }
}

export function readKeptReferralDraftAt(): number | null {
  return kept === null ? null : keptAtMs;
}

/** Select only the named synthetic subject; a different person's memory draft retains its owner. */
export function useReferralDraftRecovery<T extends { activePatientKey: string }>(
  scenario: string,
  patientId: string | undefined,
  prefillKey: string | null,
  patientKey: string,
) {
  const [draftStorageKey] = useState(() => sessionDraftKey(scenario, "referral", patientId ?? "new"));
  const [draftRestored] = useState(() => readSessionDraft(draftStorageKey) !== null);
  const [storedDraft] = useState(() => readKeptReferralDraft<T>(draftStorageKey));
  const [draftOwnerVersion] = useState(referralDraftSessionVersion);
  const kept =
    !patientId ||
    (storedDraft !== null &&
      ((prefillKey !== null && storedDraft.activePatientKey === prefillKey) ||
        storedDraft.activePatientKey === patientKey))
      ? storedDraft
      : null;
  const keepsAnotherPersonsDraft = storedDraft !== null && kept === null;
  const draftDiscardOwner = keepsAnotherPersonsDraft ? null : draftOwnerVersion;
  return {
    draftStorageKey,
    draftRestored,
    draftOwnerVersion,
    storedDraft,
    kept,
    keepsAnotherPersonsDraft,
    draftDiscardOwner,
  };
}

/** A null owner never discards: a sheet that did not write the kept draft must not clear it. */
export function discardReferralDraft(ownerVersion: number | null = sessionVersion): boolean {
  if (ownerVersion === null || ownerVersion !== sessionVersion) return false;
  if (keptStorageKey) removeSessionDraft(keptStorageKey);
  kept = null;
  keptAtMs = null;
  return true;
}

/**
 * A2-6 (audit 13 Oct 2026): the referrer's own contact details from the last referral sent in this
 * tab, so the next referral starts with them filled in. Tab memory only, like the draft (D-18).
 */
let lastReferrer: unknown = null;

export function rememberReferrerContact<T>(contact: T, ownerVersion = sessionVersion): boolean {
  if (ownerVersion !== sessionVersion) return false;
  lastReferrer = contact;
  return true;
}

export function readLastReferrerContact<T>(): T | null {
  return (lastReferrer as T | null) ?? null;
}

export function forgetReferrerContact(): void {
  lastReferrer = null;
}

/** How long after the last keystroke the draft is kept. */
export const REFERRAL_DRAFT_AUTOSAVE_MS = 500;

/** "just now", "4m ago", "1h 05m ago": the age of a kept draft. */
export function referralDraftAgeText(keptAt: number, nowMs: number): string {
  const minutes = Math.floor(Math.max(nowMs - keptAt, 0) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m ago`;
}

/**
 * Keeps `draft` in this tab's memory while the referrer types: `REFERRAL_DRAFT_AUTOSAVE_MS` after
 * the last change, and at once if the slide-out unmounts with a change still waiting.
 *
 * - `enabled` false: the hook leaves the store alone (for example, it holds another person's draft).
 * - `dirty` false on a fresh sheet means the draft is back to how it opened, so a copy kept earlier
 *   in this sheet is out of date and is dropped. A reopened draft keeps its copy.
 * - `stop()` is permanent for Send or a remount. Discard may opt into resuming after a content
 *   edit if closing is cancelled; changing the visible section alone never resumes it.
 *
 * Returns when the draft was last kept (wall-clock ms) and a ticking `nowMs` for its age.
 */
export function useReferralDraftAutosave<T>({
  draft,
  storageKey,
  draftJson,
  contentJson = draftJson,
  enabled,
  dirty,
  initialKeptAt,
  initialKeptJson,
}: {
  draft: T;
  storageKey?: string;
  draftJson: string;
  /** Edited content only, excluding view state. Defaults to the complete draft for simple callers. */
  contentJson?: string;
  enabled: boolean;
  dirty: boolean;
  /** When a reopened draft was kept, or null for a fresh one. */
  initialKeptAt: number | null;
  /** The reopened draft's own JSON, so reopening alone does not count as a change. */
  initialKeptJson: string | null;
}) {
  const [sessionSaved, setSessionSaved] = useState(true);
  const [keptAt, setKeptAt] = useState<number | null>(initialKeptAt);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [ownerVersion] = useState(referralDraftSessionVersion);
  const [sessionOwner] = useState(draftSessionVersion);
  const latest = useRef({ draft, draftJson, contentJson, enabled, dirty });
  const lastKeptJson = useRef<string | null>(initialKeptJson);
  const stoppedPermanently = useRef(false);
  const stoppedContentJson = useRef<string | null>(null);
  const reopened = initialKeptJson !== null;

  useEffect(() => {
    latest.current = { draft, draftJson, contentJson, enabled, dirty };
  });

  useEffect(() => {
    if (
      !enabled ||
      stoppedPermanently.current ||
      ownerVersion !== sessionVersion ||
      sessionOwner !== draftSessionVersion()
    )
      return;
    if (stoppedContentJson.current !== null) {
      if (contentJson === stoppedContentJson.current) return;
      stoppedContentJson.current = null;
    }
    if (!dirty) {
      // Back to how a fresh sheet opened: drop the copy this sheet kept, so it cannot come back.
      if (reopened || lastKeptJson.current === null) return;
      const timer = window.setTimeout(() => {
        if (
          stoppedPermanently.current ||
          stoppedContentJson.current === latest.current.contentJson ||
          ownerVersion !== sessionVersion ||
          sessionOwner !== draftSessionVersion()
        )
          return;
        discardReferralDraft(ownerVersion);
        lastKeptJson.current = null;
        setKeptAt(null);
      }, REFERRAL_DRAFT_AUTOSAVE_MS);
      return () => {
        window.clearTimeout(timer);
      };
    }
    if (draftJson === lastKeptJson.current) return;
    const timer = window.setTimeout(() => {
      if (
        stoppedPermanently.current ||
        stoppedContentJson.current === latest.current.contentJson ||
        ownerVersion !== sessionVersion ||
        sessionOwner !== draftSessionVersion()
      )
        return;
      keepReferralDraft(latest.current.draft, ownerVersion, storageKey);
      setSessionSaved(referralRecoverySaved());
      lastKeptJson.current = latest.current.draftJson;
      const at = readKeptReferralDraftAt();
      setKeptAt(at);
      setNowMs(at ?? Date.now());
    }, REFERRAL_DRAFT_AUTOSAVE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [enabled, dirty, draftJson, contentJson, reopened, ownerVersion, sessionOwner, storageKey]);

  // Unmounting with a change still waiting settles it at once, so no close path loses it.
  useEffect(
    () => () => {
      const current = latest.current;
      if (
        stoppedPermanently.current ||
        stoppedContentJson.current === current.contentJson ||
        !current.enabled ||
        ownerVersion !== sessionVersion ||
        sessionOwner !== draftSessionVersion()
      )
        return;
      if (!current.dirty) {
        if (!reopened && lastKeptJson.current !== null) {
          discardReferralDraft(ownerVersion);
        }
        return;
      }
      if (current.draftJson !== lastKeptJson.current) {
        keepReferralDraft(current.draft, ownerVersion, storageKey);
      }
    },
    // `reopened` is fixed for the sheet's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // The age reads in whole minutes, so a half-minute tick is enough.
  useEffect(() => {
    if (keptAt === null) return;
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 30_000);
    return () => {
      window.clearInterval(interval);
    };
  }, [keptAt]);

  const stop = useCallback(({ resumeOnContentEdit = false }: { resumeOnContentEdit?: boolean } = {}) => {
    stoppedPermanently.current = !resumeOnContentEdit;
    stoppedContentJson.current = resumeOnContentEdit ? latest.current.contentJson : null;
    lastKeptJson.current = null;
    setKeptAt(null);
  }, []);

  /** Keep now, without waiting for the debounce (the guard's "Keep draft"). */
  const keepNow = useCallback(() => {
    if (
      stoppedPermanently.current ||
      stoppedContentJson.current === latest.current.contentJson ||
      ownerVersion !== sessionVersion ||
      sessionOwner !== draftSessionVersion()
    )
      return;
    stoppedContentJson.current = null;
    keepReferralDraft(latest.current.draft, ownerVersion, storageKey);
    lastKeptJson.current = latest.current.draftJson;
  }, [ownerVersion, sessionOwner, storageKey]);

  return { keptAt, nowMs, stop, keepNow, sessionSaved };
}
