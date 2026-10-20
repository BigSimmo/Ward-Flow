import { onWardSessionEnd } from "../ward-browser-data";
import { clearSessionDrafts } from "../ward-session-drafts";

/** Shared tab owner only: sign-out/reset must not load the referral form or recovery validator. */
export const referralDraftMemory: {
  keptStorageKey: string | undefined;
  recoveryStorageKey: string | undefined;
  recoverySaved: boolean;
  kept: unknown;
  keptAtMs: number | null;
  sessionVersion: number;
  lastReferrer: unknown;
} = {
  keptStorageKey: undefined,
  recoveryStorageKey: undefined,
  recoverySaved: true,
  kept: null,
  keptAtMs: null,
  sessionVersion: 0,
  lastReferrer: null,
};

/** Invalidate pending callbacks before an outgoing person's form unmounts. */
export function clearReferralDraftSession(): void {
  referralDraftMemory.sessionVersion += 1;
  clearSessionDrafts();
  referralDraftMemory.keptStorageKey = undefined;
  referralDraftMemory.recoveryStorageKey = undefined;
  referralDraftMemory.kept = null;
  referralDraftMemory.keptAtMs = null;
  referralDraftMemory.lastReferrer = null;
}

// The kept draft and last referrer belong to the account that typed them (Codex review on PR #487).
onWardSessionEnd(clearReferralDraftSession);
