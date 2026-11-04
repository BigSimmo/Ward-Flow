import { DISCHARGE_ROLE_LABELS, type Admission } from "./ward-admissions";
import type { Instant } from "./ward-clock";
import type { WardFlowRole } from "./ward-flow-roles";
import type { WardFlowState } from "./ward-flow-reducer";
import { replaceAdmission } from "./ward-flow-state-records";

/** After the event's authority/validity checks, one date and provenance update for a stay and its pending releases. */
export function updateExpectedDischargeDate(
  state: WardFlowState,
  admission: Admission,
  expectedAt: Instant,
  now: Instant,
  role: WardFlowRole,
): WardFlowState {
  const moved = admission.expectedDischargeAt !== null && admission.expectedDischargeAt !== expectedAt;
  const withDate = replaceAdmission(state, admission.id, {
    ...admission,
    expectedDischargeAt: expectedAt,
    dischargeDateMoves: admission.dischargeDateMoves + (moved ? 1 : 0),
    dischargeDateSetAt: now,
    // Q66: new ward records say Nurse in charge; a coordinator is not recorded as the ward.
    dischargeDateSetBy: role === "ward" ? DISCHARGE_ROLE_LABELS[0] : null,
  });
  return {
    ...withDate,
    // Completed releases keep their historical dates; a changed plan never restates confirmation.
    bedReleases: withDate.bedReleases.map((release) =>
      release.admissionId === admission.id && release.state !== "discharged" ? { ...release, expectedAt } : release,
    ),
  };
}
