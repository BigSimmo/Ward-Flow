import { useCallback, useEffect, useRef, useState } from "react";
import { draftSessionVersion, readSessionDraft, removeSessionDraft, sessionDraftKey } from "../ward-session-drafts";
import { useWardFlowSelect } from "../ward-flow-provider";
import { resolveSubjectPatient } from "../ward-patient-resolver";
import { PATIENT_KEY_PREFIX } from "./referral-patient-key";
import {
  REFERRAL_DRAFT_AUTOSAVE_MS,
  referralDraftSessionVersion,
  referralRecoverySaved,
  keepReferralDraft,
  readKeptReferralDraft,
  readKeptReferralDraftAt,
  discardReferralDraft,
} from "./referral-draft-cache";

/** Select only the named synthetic subject; a different person's memory draft retains its owner. */
export function useReferralDraftRecovery<T extends { activePatientKey: string }>(
  scenario: string,
  patientId: string | undefined,
  prefillKey: string | null,
  patientKey: string,
) {
  const [draftStorageKey] = useState(() => sessionDraftKey(scenario, "referral", patientId ?? "new"));
  const [{ draftRestored, storedDraft }] = useState(() => {
    const hasSessionCopy = readSessionDraft(draftStorageKey) !== null;
    const storedDraft = readKeptReferralDraft<T>(draftStorageKey);
    return { storedDraft, draftRestored: hasSessionCopy && storedDraft !== null };
  });
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
  const latest = useRef({ draft, draftJson, contentJson, enabled, dirty, storageKey });
  const lastKeptJson = useRef<string | null>(initialKeptJson);
  const stoppedPermanently = useRef(false);
  const stoppedContentJson = useRef<string | null>(null);
  const reopened = initialKeptJson !== null;

  useEffect(() => {
    latest.current = { draft, draftJson, contentJson, enabled, dirty, storageKey };
  });

  useEffect(() => {
    if (
      !enabled ||
      stoppedPermanently.current ||
      ownerVersion !== referralDraftSessionVersion() ||
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
          ownerVersion !== referralDraftSessionVersion() ||
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
        ownerVersion !== referralDraftSessionVersion() ||
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
        ownerVersion !== referralDraftSessionVersion() ||
        sessionOwner !== draftSessionVersion()
      )
        return;
      if (!current.dirty) {
        if (!reopened && lastKeptJson.current !== null) {
          discardReferralDraft(ownerVersion);
        }
        return;
      }
      // The key can move to the chosen person's own after mount, so settle under the current one.
      if (current.draftJson !== lastKeptJson.current) {
        keepReferralDraft(current.draft, ownerVersion, current.storageKey);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Unmount only: `reopened`, `ownerVersion` and `sessionOwner` are fixed for the sheet's life.
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
      ownerVersion !== referralDraftSessionVersion() ||
      sessionOwner !== draftSessionVersion()
    )
      return;
    stoppedContentJson.current = null;
    keepReferralDraft(latest.current.draft, ownerVersion, storageKey);
    lastKeptJson.current = latest.current.draftJson;
  }, [ownerVersion, sessionOwner, storageKey]);

  return { keptAt, nowMs, stop, keepNow, sessionSaved };
}

/**
 * L12 (Josh, 4 Nov 2026): one kept draft per person. Once a person from the register is chosen the
 * draft is kept under their own key, so starting another referral never replaces it. The previous
 * key's copy from this sheet is retired when the person changes, as the single slot did before.
 */
export function useLiveReferralDraftKey(
  activePatientKey: string,
  openedKey: string,
  keepsAnotherPersonsDraft: boolean,
): string {
  const { scenario, worldGeneration, movements, patients, referrals } = useWardFlowSelect(
    "scenario",
    "worldGeneration",
    "movements",
    "patients",
    "referrals",
  );
  // A registered person with an open movement is chosen by the movement id, so resolve it to them.
  const movement = movements.find((entry) => entry.id === activePatientKey);
  const personId = activePatientKey.startsWith(PATIENT_KEY_PREFIX)
    ? activePatientKey.slice(PATIENT_KEY_PREFIX.length)
    : movement
      ? resolveSubjectPatient(movement, { movements, patients, referrals }).patient?.id
      : undefined;
  const liveKey = personId ? sessionDraftKey(`${scenario}/${worldGeneration}`, "referral", personId) : openedKey;
  const previousKey = useRef(liveKey);
  useEffect(() => {
    if (previousKey.current !== liveKey && !keepsAnotherPersonsDraft) removeSessionDraft(previousKey.current);
    previousKey.current = liveKey;
  }, [liveKey, keepsAnotherPersonsDraft]);
  return liveKey;
}
