import type { DirectoryCheckRecord } from "./on-call/on-call-checks";
import type { HomeServiceReturnRecord } from "./out-of-area/home-service-return";
import type { SiteHandoverSignOffRecord } from "./site-sign-off/site-handover-sign-off";
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
};

export const CLOSING_LOOP_CONTEXT_KEYS = {
  homeServiceReturns: true,
  directoryChecks: true,
  siteHandoverSignOffs: true,
} as const;

const NONE: never[] = [];

export function closingLoopContext(state: WardFlowState): Required<ClosingLoopContext> {
  return {
    homeServiceReturns: Array.isArray(state.homeServiceReturns) ? state.homeServiceReturns : NONE,
    directoryChecks: Array.isArray(state.directoryChecks) ? state.directoryChecks : NONE,
    siteHandoverSignOffs: Array.isArray(state.siteHandoverSignOffs) ? state.siteHandoverSignOffs : NONE,
  };
}
