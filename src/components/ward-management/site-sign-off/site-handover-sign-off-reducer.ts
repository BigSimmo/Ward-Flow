import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import {
  siteShiftRefusal,
  siteSignOffFor,
  siteUnansweredBedCalls,
  siteWardSignOffs,
  siteWards,
  type SiteHandoverSignOffEvent,
  type SiteHandoverSignOffRecord,
} from "./site-handover-sign-off";

/*
 * The site sign-off's reducer slice, loaded lazily with the other slices
 * (`ward-flow-reducer-slices.ts`). Kept apart from `site-handover-sign-off.ts` so screens can read
 * the site checks without pulling a reducer slice into page code.
 */

type Reject = (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState;

/**
 * RECORD_SITE_HANDOVER_SIGN_OFF. Who may send it is `EVENT_ROLE`; which site is the shared server's
 * check (`commandScopeRefusal`). This records the sign-off and names what was open; it changes no
 * ward sign-off, bed call or other record.
 */
export function reduceSiteHandoverSignOff(
  state: WardFlowState,
  event: Extract<SiteHandoverSignOffEvent, { type: "RECORD_SITE_HANDOVER_SIGN_OFF" }>,
  reject: Reject,
): WardFlowState {
  if (typeof event.siteCode !== "string" || siteWards(state.units, event.siteCode).length === 0)
    return reject(state, event, `no site with wards found for code ${String(event.siteCode)}`);
  const shiftRefusal = siteShiftRefusal(event.shiftAt, event.now);
  if (shiftRefusal) return reject(state, event, shiftRefusal);
  const existing = Array.isArray(state.siteHandoverSignOffs) ? state.siteHandoverSignOffs : [];
  if (siteSignOffFor(existing, event.siteCode, event.shiftAt))
    return reject(state, event, "This site's handover is already signed off");
  const record: SiteHandoverSignOffRecord = {
    at: event.now,
    by: event.role,
    siteCode: event.siteCode,
    shiftAt: event.shiftAt,
    unsignedUnitIds: siteWardSignOffs(state.units, state.handoverSignOffs, event.siteCode, event.shiftAt)
      .filter((ward) => ward.signedAt === null)
      .map((ward) => ward.unitId),
    unansweredBedCallIds: siteUnansweredBedCalls(state, event.siteCode, event.now).map((call) => call.alertId),
  };
  return { ...state, siteHandoverSignOffs: [...existing, record] };
}
