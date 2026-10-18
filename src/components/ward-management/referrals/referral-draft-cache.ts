import { isRecoverableReferralDraft } from "./referral-draft-validation";
import { referralDraftMemory } from "./referral-draft-lifecycle";
export { clearReferralDraftSession } from "./referral-draft-lifecycle";

import { draftSessionVersion, readSessionDraft, removeSessionDraft, writeSessionDraft } from "../ward-session-drafts";

/** One memory copy and one explicitly opted-in synthetic session copy, with a single autosave owner. */
export const referralRecoverySaved = () => referralDraftMemory.recoverySaved;
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

export function referralDraftSessionVersion(): number {
  return referralDraftMemory.sessionVersion;
}

export function keepReferralDraft<T>(
  draft: T,
  ownerVersion = referralDraftMemory.sessionVersion,
  storageKey?: string,
): boolean {
  if (ownerVersion !== referralDraftMemory.sessionVersion) return false;
  referralDraftMemory.keptStorageKey = storageKey;
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
    referralDraftMemory.recoverySaved = writeSessionDraft(
      storageKey,
      JSON.stringify(projection),
      draftSessionVersion(),
    );
  }
  referralDraftMemory.kept = draft;
  referralDraftMemory.keptAtMs = Date.now();
  return true;
}

export function readKeptReferralDraft<T>(storageKey?: string): T | null {
  if (referralDraftMemory.kept !== null && (!storageKey || storageKey === referralDraftMemory.keptStorageKey))
    return referralDraftMemory.kept as T;
  if (!storageKey) return null;
  const raw = readSessionDraft(storageKey);
  if (raw === null) {
    // Preserve the existing single-memory-draft ownership when another person opens a sheet.
    const scope = storageKey.slice(0, storageKey.lastIndexOf(":"));
    return referralDraftMemory.keptStorageKey?.startsWith(scope + ":") ? (referralDraftMemory.kept as T | null) : null;
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecoverableReferralDraft(value)) {
      removeSessionDraft(storageKey);
      return null;
    }
    referralDraftMemory.kept = value;
    referralDraftMemory.keptStorageKey = storageKey;
    referralDraftMemory.keptAtMs = Date.now();
    return value as T;
  } catch {
    removeSessionDraft(storageKey);
    return null;
  }
}

export function readKeptReferralDraftAt(): number | null {
  return referralDraftMemory.kept === null ? null : referralDraftMemory.keptAtMs;
}

/** A null owner never discards: a sheet that did not write the kept draft must not clear it. */
export function discardReferralDraft(ownerVersion: number | null = referralDraftMemory.sessionVersion): boolean {
  if (ownerVersion === null || ownerVersion !== referralDraftMemory.sessionVersion) return false;
  if (referralDraftMemory.keptStorageKey) removeSessionDraft(referralDraftMemory.keptStorageKey);
  referralDraftMemory.kept = null;
  referralDraftMemory.keptAtMs = null;
  return true;
}

/**
 * A2-6 (audit 13 Oct 2026): the referrer's own contact details from the last referral sent in this
 * tab, so the next referral starts with them filled in. Tab memory only, like the draft (D-18).
 */
export function rememberReferrerContact<T>(contact: T, ownerVersion = referralDraftMemory.sessionVersion): boolean {
  if (ownerVersion !== referralDraftMemory.sessionVersion) return false;
  referralDraftMemory.lastReferrer = contact;
  return true;
}

export function readLastReferrerContact<T>(): T | null {
  return (referralDraftMemory.lastReferrer as T | null) ?? null;
}

export function forgetReferrerContact(): void {
  referralDraftMemory.lastReferrer = null;
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
