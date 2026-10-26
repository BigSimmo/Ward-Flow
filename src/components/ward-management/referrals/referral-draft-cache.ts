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

const recoveryScope = (key: string) => key.slice(0, key.lastIndexOf(":") + 1);

/** A recovery copy is retired only when its scope and validated subject both match. */
function removeMatchingRecoveryCopy(candidateKey: string, storageKey: string, draft: unknown): void {
  const current = draft as { activePatientKey?: unknown } | null;
  if (recoveryScope(candidateKey) !== recoveryScope(storageKey) || typeof current?.activePatientKey !== "string")
    return;
  const raw = readSessionDraft(candidateKey);
  if (raw === null) return;
  try {
    const candidate: unknown = JSON.parse(raw);
    if (isRecoverableReferralDraft(candidate) && candidate.activePatientKey === current.activePatientKey)
      removeSessionDraft(candidateKey);
  } catch {
    // An unowned malformed copy cannot establish that it belongs to this person's draft.
  }
}

function adoptRecoveryStorageKey(storageKey: string, draft: unknown): void {
  const previousKey = referralDraftMemory.recoveryStorageKey;
  if (previousKey && previousKey !== storageKey) removeMatchingRecoveryCopy(previousKey, storageKey, draft);
  referralDraftMemory.recoveryStorageKey = storageKey;
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
    // A failed write keeps the last recoverable copy owned, so retry or Discard can settle it.
    if (referralDraftMemory.recoverySaved) adoptRecoveryStorageKey(storageKey, draft);
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
    const current = referralDraftMemory.kept as { activePatientKey?: unknown } | null;
    if (
      referralDraftMemory.kept !== null &&
      referralDraftMemory.keptStorageKey &&
      recoveryScope(referralDraftMemory.keptStorageKey) === recoveryScope(storageKey) &&
      current?.activePatientKey === value.activePatientKey
    )
      return referralDraftMemory.kept as T; // The current tab's edits take precedence over an old alias.
    referralDraftMemory.kept = value;
    referralDraftMemory.keptStorageKey = storageKey;
    adoptRecoveryStorageKey(storageKey, value);
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

/** Retire this subject's historical copies on Send/Discard, without inferring a patient ID. */
function clearMatchingRecoveryAlias(): void {
  const storageKey = referralDraftMemory.keptStorageKey ?? referralDraftMemory.recoveryStorageKey;
  if (!storageKey || typeof window === "undefined") return;
  const scope = recoveryScope(storageKey);
  try {
    // Snapshot keys before deleting. Read values only inside this account/session/scenario/form.
    const keys = Array.from({ length: window.sessionStorage.length }, (_, index) => window.sessionStorage.key(index));
    for (const key of keys)
      if (key?.startsWith(scope)) removeMatchingRecoveryCopy(key, storageKey, referralDraftMemory.kept);
  } catch {
    // Blocked storage cannot be cleaned here; the session owner and memory cleanup still apply.
  }
}

/** A null owner never discards: a sheet that did not write the kept draft must not clear it. */
export function discardReferralDraft(ownerVersion: number | null = referralDraftMemory.sessionVersion): boolean {
  if (ownerVersion === null || ownerVersion !== referralDraftMemory.sessionVersion) return false;
  clearMatchingRecoveryAlias();
  const storageKey = referralDraftMemory.keptStorageKey ?? referralDraftMemory.recoveryStorageKey;
  if (storageKey) {
    if (referralDraftMemory.recoveryStorageKey)
      removeMatchingRecoveryCopy(referralDraftMemory.recoveryStorageKey, storageKey, referralDraftMemory.kept);
    if (
      referralDraftMemory.keptStorageKey &&
      referralDraftMemory.keptStorageKey !== referralDraftMemory.recoveryStorageKey
    )
      removeMatchingRecoveryCopy(referralDraftMemory.keptStorageKey, storageKey, referralDraftMemory.kept);
  }
  referralDraftMemory.keptStorageKey = undefined;
  referralDraftMemory.recoveryStorageKey = undefined;
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

/** Content hashes of the charts seen lately, so each file is read once, not on every keystroke. */
const chartHashes = new Map<string, string>();

/** FNV-1a over the whole base64 text, cached by the text. A replaced file always hashes anew. */
function chartHash(base64: string): string {
  const known = chartHashes.get(base64);
  if (known !== undefined) return known;
  let hash = 0x811c9dc5;
  for (let index = 0; index < base64.length; index += 1) {
    hash ^= base64.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  const text = (hash >>> 0).toString(36);
  if (chartHashes.size >= 16) chartHashes.delete(chartHashes.keys().next().value!);
  chartHashes.set(base64, text);
  return text;
}

/**
 * H-0364 (code quality audit): the draft as text for the dirty check and the autosave compare,
 * with each chart's file content reduced to its length and a hash of the whole content. A chart
 * can be up to 8 MB of base64, and the whole draft was stringified on every keystroke. Each file
 * is hashed once and then looked up. Autosave still keeps the full draft; only the comparison
 * text is smaller. A different file, even one with the same name, size and ending, reads as a change.
 */
export function draftFingerprint(draft: unknown): string {
  return JSON.stringify(draft, (key, value: unknown) =>
    key === "base64" && typeof value === "string" ? `${value.length}:${chartHash(value)}` : value,
  );
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
