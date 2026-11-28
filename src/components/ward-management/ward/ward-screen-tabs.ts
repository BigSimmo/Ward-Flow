import type { WardFlowTab, WardShiftView } from "./ward-home-tab-model";

// The Ward screen's props and its address tabs, split out of `ward-screen.tsx` to keep it under its line cap.

export type WardScreenProps = {
  departurePlanning?: boolean;
  unitId: string;
  presentation?: "overview" | "answer";
};

/**
 * One inpatient unit's scoped view, derived from the provider's live records. Unknown units
 * render an explicit empty state. Command feedback waits for that command's confirmed outcome;
 * counters and patient lists continue to come from authoritative state.
 */

export type WardTab = "attn" | "board" | "coming" | "out" | "beds" | "referrals" | "return";
export const WARD_TABS: readonly WardTab[] = ["attn", "board", "coming", "out", "beds", "referrals", "return"];
export const WARD_FLOW_TABS: readonly WardFlowTab[] = ["referrals", "admissions", "discharges"];
export const WARD_SHIFT_VIEWS: readonly WardShiftView[] = ["todo", "log"];
