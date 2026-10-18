/** Compatibility entry point. Provider/auth cleanup can import the React-free cache directly. */
export {
  draftNeedsChartReattachment,
  clearReferralDraftSession,
  keepReferralDraft,
  readKeptReferralDraft,
  readKeptReferralDraftAt,
  discardReferralDraft,
  rememberReferrerContact,
  readLastReferrerContact,
  forgetReferrerContact,
  REFERRAL_DRAFT_AUTOSAVE_MS,
  referralDraftAgeText,
} from "./referral-draft-cache";
export { useReferralDraftRecovery, useReferralDraftAutosave } from "./referral-draft-hooks";
