"use client";

import { useState } from "react";

import { Button, useOptionalToast } from "@/components/wf";
import { ArrivalIdentityDialog } from "@/components/ward-management/arrival-identity-dialog";
import { plannedArrivalNeedsBedCountReason } from "@/components/ward-management/capacity/planned-admissions-reducer";
import type { PlannedAdmission } from "@/components/ward-management/ward-admissions";
import { useOptionalWardFlowSelect, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { patientIdentityLine } from "@/components/ward-management/ward-patient-resolver";
import { useRouteRole } from "@/components/ward-management/ward-role-gate";
import { dispatchPermission } from "@/components/ward-management/ward-role-permissions";
import { SAVE_NOT_CONFIRMED } from "@/components/ward-management/ward-save-failure";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";

/**
 * Audit four item 13 (A3-30, approved "with the shared control"): a planned-arrival alert that is
 * due offers Record arrival as its filled foot step. It asks through the one shared arrival confirm
 * (`ArrivalIdentityDialog`, item 45, "Record arrival at the ward?") and records the booking's own
 * arrival (`CONVERT_PLANNED_ADMISSION`), as the Planned panel does. A booking whose ward's bed count
 * is old needs a reason the Planned panel asks for, so then this returns null and Open bookings
 * stays the filled step. The engine has no undo for a booking's arrival, so none is offered.
 */
export function usePlannedArrivalOffered(booking: PlannedAdmission | undefined): boolean {
  const flow = useOptionalWardFlowSelect("units");
  const now = useWardFlowClock();
  const role = useRouteRole();
  if (!flow || !booking || booking.state !== "booked" || booking.expectedArrivalAt > now) return false;
  if (!dispatchPermission(role, "CONVERT_PLANNED_ADMISSION").allowed) return false;
  const unit = flow.units.find((candidate) => candidate.id === booking.unitId);
  if (!unit || unit.isClosed) return false;
  return !plannedArrivalNeedsBedCountReason(booking, unit, now);
}

export function AlertPlannedArrival({
  booking,
  displayName,
  wardName,
  className,
}: {
  booking: PlannedAdmission;
  displayName: string;
  wardName: string;
  className?: string;
}) {
  const role = useRouteRole();
  const raise = useWardRaise(role);
  const toast = useOptionalToast();
  const patientOf = usePatientOf();
  const [asking, setAsking] = useState(false);
  const person = booking.patientId && role !== "executive" ? patientOf({ patientId: booking.patientId }) : undefined;

  const record = () => {
    setAsking(false);
    const say = (outcome: WardCommandOutcome | void) => {
      if (outcome?.isCurrent && !outcome.isCurrent()) return;
      if (outcome && outcome.status !== "accepted") {
        const reason = outcome.message ?? "The action was refused.";
        toast?.push({
          tone: "warning",
          title: outcome.status === "refused" ? `Not recorded: ${reason}` : (outcome.message ?? SAVE_NOT_CONFIRMED),
        });
        return;
      }
      toast?.push({ tone: "success", title: `${displayName} arrived at ${wardName}` });
    };
    void Promise.resolve(
      raise("CONVERT_PLANNED_ADMISSION", {
        ...(role === "ward" ? { actingUnitId: booking.unitId } : {}),
        plannedAdmissionId: booking.id,
        unitId: booking.unitId,
      }),
    ).then(say, () => toast?.push({ tone: "warning", title: SAVE_NOT_CONFIRMED }));
  };

  return (
    <>
      <Button variant="pri" className={className} onClick={() => setAsking(true)} data-testid="alerts-planned-arrival">
        {/* Safety rule 5: every main button names the person. */}
        Record arrival for {displayName}
      </Button>
      <ArrivalIdentityDialog
        open={asking}
        person={person?.patient}
        identity={person ? patientIdentityLine(person) : displayName}
        wardName={wardName}
        onClose={() => setAsking(false)}
        onConfirm={record}
        testId="alerts-planned-arrival-identity"
      />
    </>
  );
}
