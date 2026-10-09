import { useCallback, useEffect, useRef, useState } from "react";

/**
 * One kept referral draft, held in this tab's JavaScript memory only.
 *
 * The slide-out keeps the draft here as the referrer types (debounced autosave), and again when it
 * is closed with "Keep draft", so closing never loses work; a reopened slide-out carries on from
 * it. Typed text must never reach browser storage (D-18), so the draft lives in a module variable:
 * a reload or a new tab starts empty. `tests/ward-referral-drawer-sheet.dom.test.tsx` checks that
 * keeping and autosaving a draft write nothing to `localStorage` or `sessionStorage`.
 */
let kept: unknown = null;
/** Wall-clock milliseconds when the draft was last kept, for the "Draft kept" age. */
let keptAtMs: number | null = null;

export function keepReferralDraft<T>(draft: T): void {
  kept = draft;
  keptAtMs = Date.now();
}

export function readKeptReferralDraft<T>(): T | null {
  return (kept as T | null) ?? null;
}

export function readKeptReferralDraftAt(): number | null {
  return kept === null ? null : keptAtMs;
}

export function discardReferralDraft(): void {
  kept = null;
  keptAtMs = null;
}

/** How long after the last keystroke the draft is kept. */
export const REFERRAL_DRAFT_AUTOSAVE_MS = 800;

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
 * - `stop()` is for Discard and Send: no later save may bring the draft back.
 *
 * Returns when the draft was last kept (wall-clock ms) and a ticking `nowMs` for its age.
 */
export function useReferralDraftAutosave<T>({
  draft,
  draftJson,
  enabled,
  dirty,
  initialKeptAt,
  initialKeptJson,
}: {
  draft: T;
  draftJson: string;
  enabled: boolean;
  dirty: boolean;
  /** When a reopened draft was kept, or null for a fresh one. */
  initialKeptAt: number | null;
  /** The reopened draft's own JSON, so reopening alone does not count as a change. */
  initialKeptJson: string | null;
}) {
  const [keptAt, setKeptAt] = useState<number | null>(initialKeptAt);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const latest = useRef({ draft, draftJson, enabled, dirty });
  const lastKeptJson = useRef<string | null>(initialKeptJson);
  const stopped = useRef(false);
  const reopened = initialKeptJson !== null;

  useEffect(() => {
    latest.current = { draft, draftJson, enabled, dirty };
  });

  useEffect(() => {
    if (!enabled || stopped.current) return;
    if (!dirty) {
      // Back to how a fresh sheet opened: drop the copy this sheet kept, so it cannot come back.
      if (reopened || lastKeptJson.current === null) return;
      const timer = window.setTimeout(() => {
        if (stopped.current) return;
        discardReferralDraft();
        lastKeptJson.current = null;
        setKeptAt(null);
      }, REFERRAL_DRAFT_AUTOSAVE_MS);
      return () => {
        window.clearTimeout(timer);
      };
    }
    if (draftJson === lastKeptJson.current) return;
    const timer = window.setTimeout(() => {
      if (stopped.current) return;
      keepReferralDraft(latest.current.draft);
      lastKeptJson.current = latest.current.draftJson;
      const at = readKeptReferralDraftAt();
      setKeptAt(at);
      setNowMs(at ?? Date.now());
    }, REFERRAL_DRAFT_AUTOSAVE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [enabled, dirty, draftJson, reopened]);

  // Unmounting with a change still waiting settles it at once, so no close path loses it.
  useEffect(
    () => () => {
      const current = latest.current;
      if (stopped.current || !current.enabled) return;
      if (!current.dirty) {
        if (!reopened && lastKeptJson.current !== null) discardReferralDraft();
        return;
      }
      if (current.draftJson !== lastKeptJson.current) keepReferralDraft(current.draft);
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

  const stop = useCallback(() => {
    stopped.current = true;
    setKeptAt(null);
  }, []);

  /** Keep now, without waiting for the debounce (the guard's "Keep draft"). */
  const keepNow = useCallback(() => {
    if (stopped.current) return;
    keepReferralDraft(latest.current.draft);
    lastKeptJson.current = latest.current.draftJson;
  }, []);

  return { keptAt, nowMs, stop, keepNow };
}
