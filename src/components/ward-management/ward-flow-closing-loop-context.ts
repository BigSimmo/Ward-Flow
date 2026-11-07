import type { DirectoryCheckRecord } from "./on-call/on-call-checks";
import type { HomeServiceReturnRecord } from "./out-of-area/home-service-return";
import type { ReturnEarlyFlagRecord, ReturnEarlyNotice } from "./out-of-area/return-early";
import type { SiteHandoverSignOffRecord } from "./site-sign-off/site-handover-sign-off";
import type { TriageSignedRecord } from "./triage/triage-record";
import type { WardFlowState } from "./ward-flow-reducer";

/**
 * Closing-the-loop features (24 Oct 2026, package E): the records the provider hands to screens (and, since 31 Oct 2026, the site handover sign-offs),
 * kept here so the provider file stays under its line cap. Optional so hand-built test contexts
 * need not supply them.
 */
export type ClosingLoopContext = {
  /** Return requested vs home service agreed (`RECORD_HOME_SERVICE_RETURN`), the Out of area plan. */
  homeServiceReturns?: HomeServiceReturnRecord[];
  /** Recorded on-call directory checks (`RECORD_DIRECTORY_CHECK`), the On-call page. */
  directoryChecks?: DirectoryCheckRecord[];
  /**
   * Site handover sign-offs (`RECORD_SITE_HANDOVER_SIGN_OFF`, Josh's Q61, 31 Oct 2026), read by the
   * site bed manager's Handover page and History. A site bed manager is sent only its own site's.
   */
  siteHandoverSignOffs?: SiteHandoverSignOffRecord[];
  /** Out of area "Flag early" (`FLAG_RETURN_EARLY`, Josh, 3 Nov 2026): read by the plan and three desks' alerts. */
  returnEarlyFlags?: ReturnEarlyFlagRecord[];
  /** Shared mode nameless notices for a desk that cannot see the flagged stay (Josh, 4 Nov 2026). */
  returnEarlyNotices?: ReturnEarlyNotice[];
  /** Signed triages (`RECORD_TRIAGE_SIGNED`, 7 Nov 2026): codes only, read by the triage form and the patient record. */
  triages?: TriageSignedRecord[];
};

export const CLOSING_LOOP_CONTEXT_KEYS = {
  homeServiceReturns: true,
  directoryChecks: true,
  siteHandoverSignOffs: true,
  returnEarlyFlags: true,
  returnEarlyNotices: true,
  triages: true,
} as const;

const NONE: never[] = [];

export function closingLoopContext(state: WardFlowState): Required<ClosingLoopContext> {
  return {
    homeServiceReturns: Array.isArray(state.homeServiceReturns) ? state.homeServiceReturns : NONE,
    directoryChecks: Array.isArray(state.directoryChecks) ? state.directoryChecks : NONE,
    siteHandoverSignOffs: Array.isArray(state.siteHandoverSignOffs) ? state.siteHandoverSignOffs : NONE,
    returnEarlyFlags: Array.isArray(state.returnEarlyFlags) ? state.returnEarlyFlags : NONE,
    returnEarlyNotices: Array.isArray(state.returnEarlyNotices) ? state.returnEarlyNotices : NONE,
    triages: Array.isArray(state.triages) ? state.triages : NONE,
  };
}
