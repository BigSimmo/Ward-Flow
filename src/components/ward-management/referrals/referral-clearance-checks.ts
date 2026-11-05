/**
 * The medical clearance checklist words on their own, so the referral board's panels can label the
 * checks without loading the whole referral submission validator (#1467).
 */
/** Medical clearance, item by item (ward referrals). Each item is answered or left unrecorded. */
export const CLEARANCE_CHECKS = [
  "examination",
  "bloods",
  "ecg",
  "drugScreen",
  "breathAlcohol",
  "observations",
] as const;
export type ClearanceCheck = (typeof CLEARANCE_CHECKS)[number];
export const CLEARANCE_CHECK_LABELS: Record<ClearanceCheck, string> = {
  examination: "Physical examination",
  bloods: "Bloods",
  ecg: "ECG",
  drugScreen: "Urine drug screen",
  breathAlcohol: "Breath alcohol",
  observations: "Observations stable",
};
export const CLEARANCE_STATUSES = ["done", "to_follow", "not_done"] as const;
export type ClearanceStatus = (typeof CLEARANCE_STATUSES)[number];
export const CLEARANCE_STATUS_LABELS: Record<ClearanceStatus, string> = {
  done: "Done",
  to_follow: "To follow",
  not_done: "Not done",
};
export type ClearanceChecklist = Partial<Record<ClearanceCheck, ClearanceStatus>>;
