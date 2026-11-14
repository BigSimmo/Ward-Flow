/**
 * **THE SCREEN'S `permit()` — role, place and record, for one change (R-STRUCT-1, D-223).**
 *
 * `usePermit(change)` asks `permit()` (`ward-permit.ts`) for the session's `Desk` (`useDesk`) and the
 * records this desk holds, so a control can be hidden when this desk can never make the change for
 * this record (a place rule), shown disabled with its reason when it cannot for now, or enabled. The
 * shared server asks the same function, so the screen and the server give one answer in one set of
 * words. `GatedAction` (`src/components/wf/gated-action.tsx`) draws the answer.
 *
 * The records come from the fields the place rules read. Outside a provider only
 * the role phase runs.
 */
import { useCallback, useMemo } from "react";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { permit, type Change, type Permit, type PermitRecords } from "@/components/ward-management/ward-permit";
import { useDesk } from "@/components/ward-management/shell/use-desk";

/** The state fields the place rules and record checks read. */
type PermitStateFields = Pick<
  WardFlowState,
  "units" | "movements" | "referrals" | "admissions" | "broadcastAlerts" | "undoRecords"
>;

/** The records `permit()` reads, from the fields a provider holds. */
function permitRecordsOf(fields: PermitStateFields): PermitRecords {
  return { state: fields as WardFlowState, places: wardPlaceLookup(fields.units) };
}

/** The records this desk holds, or undefined outside a provider. */
function usePermitRecords(): PermitRecords | undefined {
  const fields = useOptionalWardFlowSelect(
    "units",
    "movements",
    "referrals",
    "admissions",
    "broadcastAlerts",
    "undoRecords",
  );
  const units = fields?.units;
  const movements = fields?.movements;
  const referrals = fields?.referrals;
  const admissions = fields?.admissions;
  const broadcastAlerts = fields?.broadcastAlerts;
  const undoRecords = fields?.undoRecords;
  return useMemo(
    () =>
      units && movements && referrals && admissions && broadcastAlerts
        ? permitRecordsOf({ units, movements, referrals, admissions, broadcastAlerts, undoRecords })
        : undefined,
    [units, movements, referrals, admissions, broadcastAlerts, undoRecords],
  );
}

/** `permit()` for this desk and this change, with the records the desk holds. */
export function usePermit(change: Change): Permit {
  const desk = useDesk();
  const records = usePermitRecords();
  return permit(desk, change, records);
}

/** `permit()` for this desk, asked once per record: for a list or a row picked at render time. */
export function usePermitFor(): (change: Change) => Permit {
  const desk = useDesk();
  const records = usePermitRecords();
  return useCallback((change: Change) => permit(desk, change, records), [desk, records]);
}
