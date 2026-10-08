import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Movement } from "@/components/ward-management/ward-model";
import { transportStatusLabel } from "@/components/ward-management/ward-derivations";
import { edById, siteByCode } from "@/components/ward-management/ward-sites";
import { movementHasBedHold } from "@/components/ward-management/ward-movement-bed-hold";

/** The current physical location and destination commitment are separate facts. Acceptance
 * does not reserve a bed, and a requested vehicle has not collected the patient. */
export function movementSearchState(movement: Movement, admissions: readonly Admission[] = []) {
  const job = movement.transport;
  const inTransit =
    movement.closure === undefined &&
    movement.stage !== "arrived" &&
    job?.arrivedAt === undefined &&
    job?.cancelledAt === undefined &&
    (movement.stage === "moving" || job?.collectedAt !== undefined);
  const sourceAdmission = admissions.find(
    (admission) => admission.id === movement.sourceAdmissionId && admission.state === "occupied",
  );
  const hasBedHold = movementHasBedHold(movement, admissions);
  // A stopped journey records collection but no onward location. It must not put the person
  // back in ED simply because cancellation ended the active transport leg.
  const departedWithoutArrival = job?.collectedAt !== undefined && job.arrivedAt === undefined;
  const setting = inTransit
    ? "transit"
    : departedWithoutArrival
      ? "unknown"
      : sourceAdmission
        ? "inpatient"
        : edById(movement.originEdId)
          ? "ed"
          : "unknown";
  const holdStatus = inTransit
    ? "In-Transit"
    : hasBedHold
      ? "Bed hold active"
      : movement.acceptedUnitId
        ? "Accepted, awaiting bed"
        : "Unplaced";
  return {
    setting,
    sourceAdmission,
    hasBedHold,
    holdStatus,
    transportStatus: !job && movement.transportNeed?.needed === false ? "Not required" : transportStatusLabel(job),
  };
}

/** Unknown origins carry an absence label rather than an invented metropolitan/regional service. */
export function movementOriginService(movement: Movement): string {
  const ed = edById(movement.originEdId);
  return (ed ? siteByCode(ed.siteCode)?.service : undefined) ?? "Service not recorded";
}

export function referralOriginService(originSiteCode: string): string {
  return siteByCode(originSiteCode)?.service ?? "Service not recorded";
}
