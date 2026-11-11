import type { AuditDecision } from "./ward-audit";
import type { WardFlowEvent } from "./ward-flow-events";
import type { WardFlowState } from "./ward-flow-reducer";
import {
  reduceDowntimePackPrint,
  type DowntimePackPrintEvent,
  type DowntimePackPrintRecord,
} from "./ward-downtime-pack-prints";
import { reduceOutageWindow, type OutageWindowEvent, type OutageWindowRecord } from "./ward-outage-catch-up";
import {
  reduceSiteFeatureSwitch,
  type SiteFeatureSwitchEvent,
  type SiteFeatureSwitchRecord,
} from "./ward-site-feature-switches";

/**
 * BATCH 4, OUTAGES AND PILOT CONTROL (Josh's approved plan, 10 Nov 2026, D-135): the
 * reducer half of three small records. Each event writes its one record and changes nothing else:
 * no bed figure, confirmation, stay or flag default moves because of it.
 *
 * - `SET_SITE_FEATURE_SWITCH` (item 20): a listed feature switched off, or back on, at one site.
 * - `RECORD_DOWNTIME_PACK_PRINTED` (item 24): when each ward's downtime pack was printed or saved.
 * - `RECORD_OUTAGE_WINDOW` (item 25): "We were down from __ to __", typed by a coordinator.
 *
 * The reducer passes `reject` in, since this file may not import the reducer at run time.
 */
export type PilotControlEvent = SiteFeatureSwitchEvent | DowntimePackPrintEvent | OutageWindowEvent;

/** The three records, optional so older saves and hand-built states need not carry them. */
export type PilotControlState = {
  /** Features an admin switched off at one site. Site code, a listed feature, time and role only. */
  siteFeatureSwitches?: SiteFeatureSwitchRecord[];
  /** When each ward's downtime pack was printed or saved. Ward, time and role only, never the pack. */
  downtimePackPrints?: DowntimePackPrintRecord[];
  /** Outage windows a coordinator typed. Two typed times, the time recorded and a role only. */
  outageWindows?: OutageWindowRecord[];
};

export function reducePilotControlEvent(
  state: WardFlowState,
  event: PilotControlEvent,
  decision: AuditDecision,
  reject: (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState,
): WardFlowState {
  const refuse = (current: WardFlowState, reason: string) => reject(current, event, reason);
  const accept = () => {
    decision.outcome = "accepted";
    decision.reasonCode = "none";
  };
  switch (event.type) {
    case "SET_SITE_FEATURE_SWITCH":
      return reduceSiteFeatureSwitch(state, event, refuse, accept);
    case "RECORD_DOWNTIME_PACK_PRINTED":
      return reduceDowntimePackPrint(state, event, refuse, accept);
    case "RECORD_OUTAGE_WINDOW":
      return reduceOutageWindow(state, event, refuse, accept);
  }
}
