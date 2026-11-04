/** Compatibility entry point. Provider/auth cleanup can import the React-free cache directly. */
export {
  draftFingerprint,
  draftNeedsChartReattachment,
  clearReferralDraftSession,
  keepReferralDraft,
  readKeptReferralDraft,
  readKeptReferralDraftAt,
  discardReferralDraft,
  setAsideReferralDraft,
  restartReferralDraft,
  rememberReferrerContact,
  readLastReferrerContact,
  forgetReferrerContact,
  REFERRAL_DRAFT_AUTOSAVE_MS,
  referralDraftAgeText,
} from "./referral-draft-cache";
export { useReferralDraftRecovery, useReferralDraftAutosave, useLiveReferralDraftKey } from "./referral-draft-hooks";
