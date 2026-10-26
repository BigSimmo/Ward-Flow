"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/wf";
import type { Admission } from "../ward-admissions";
import { perthDateTimeLocal } from "../ward-clock";
import {
  INVOLUNTARY_DEPARTURE_REFUSAL,
  departureNeedsPaperAuthority,
  type DischargeOpenHandle,
  type WardRecordActor,
} from "../ward-discharge-records";
import { useWardFlowClock, useWardFlowSelect } from "../ward-flow-provider";
import { useWardFormSave } from "../use-ward-form-save";
import { useRouteRole } from "../ward-role-gate";
import styles from "./ward-leave-paper-authority.module.css";

const AUTHORITIES = [
  { id: "revocation", label: "Revocation of the order" },
  { id: "5A", label: "Form 5A, community treatment order" },
  { id: "5B", label: "Form 5B, continuation" },
] as const;

/** Whether this stay must have its paper recorded before the drawer records it has left (WT-02). */
export function useLeaveNeedsPaperAuthority(
  admission: Admission | undefined,
  destination: Admission["leavingDestination"],
): boolean {
  const { patients, movements, plannedAdmissions } = useWardFlowSelect("patients", "movements", "plannedAdmissions");
  return (
    admission !== undefined &&
    admission.state === "occupied" &&
    departureNeedsPaperAuthority({ patients, movements, plannedAdmissions }, admission, destination)
  );
}

/**
 * Walk-through WT-02 (26 Oct 2026): an involuntary patient leaves for the community only on a
 * recorded revocation or community treatment order, and the ward had no way to record one from
 * the bed. This records the paper's own authority and written time, as typed. Nothing here works
 * out an order, a time or an expiry.
 */
export function WardLeavePaperAuthority({
  admissionId,
  who,
  unitId,
}: {
  admissionId: string;
  who: string;
  unitId: string;
}) {
  // The ward screen records as the ward, as it does the departure. The bed manager may not record
  // a care step, so it is told who does.
  const actor: WardRecordActor | null =
    useRouteRole() === "bed_manager" ? null : { role: "ward", actingUnitId: unitId };
  const { dispatch, dayZero, openDischargeRecord, readDischargeRecord } = useWardFlowSelect(
    "dispatch",
    "dayZero",
    "openDischargeRecord",
    "readDischargeRecord",
  );
  const now = useWardFlowClock();
  const save = useWardFormSave(`leave-paper-${admissionId}`);
  const [handle, setHandle] = useState<DischargeOpenHandle | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const reason = INVOLUNTARY_DEPARTURE_REFUSAL.replace("This patient", who);
  if (!actor) {
    return (
      <p className={styles.note} data-testid="ward-drawer-leave-paper">
        {reason} The ward or the bed coordinator records it.
      </p>
    );
  }
  if (!handle) {
    return (
      <div className={styles.note} data-testid="ward-drawer-leave-paper">
        <p>{reason}</p>
        <Button
          variant="sec"
          size="sm"
          onClick={() => {
            setLocalError(null);
            save.forget();
            // Opening the stay's record is the audited read the Discharges detail makes too.
            setHandle(openDischargeRecord(actor, admissionId));
          }}
        >
          Record the paper
        </Button>
      </div>
    );
  }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const authority = AUTHORITIES.find(({ id }) => id === data.get("authority"))?.id;
    const written = data.get("written");
    const date = typeof written === "string" ? perthDateTimeLocal(written) : undefined;
    const read = readDischargeRecord(actor, admissionId, handle);
    if (!authority || !date || !data.has("checked")) {
      setLocalError("Choose the authority, type the date and time written on it, and tick that you checked it.");
      return;
    }
    if (read.status !== "allowed" || read.value.identity.kind !== "linked") {
      setLocalError("This stay's record could not be opened. Close the drawer and try again.");
      return;
    }
    setLocalError(null);
    const record = read.value;
    const patient = read.value.identity.patient;
    save.submit(
      () =>
        dispatch({
          type: "RECORD_ADMISSION_CARE",
          role: actor.role,
          now,
          ...(actor.role === "ward" ? { actingUnitId: actor.actingUnitId } : {}),
          admissionId,
          patientId: patient.id,
          expectedGeneration: record.generation,
          expectedRevision: record.revision,
          change: {
            kind: "legal",
            authority,
            writtenAt: (date.getTime() - dayZero.getTime()) / 60_000,
            paperChecked: true,
          },
        }),
      () => setHandle(null),
    );
  };
  return (
    <form className={styles.form} onSubmit={submit} data-testid="ward-drawer-leave-paper">
      <p>{reason}</p>
      <fieldset>
        <legend>Paper authority</legend>
        {AUTHORITIES.map(({ id, label }) => (
          <label key={id}>
            <input type="radio" name="authority" value={id} required /> {label}
          </label>
        ))}
      </fieldset>
      <p className={styles.hint}>
        A community treatment order also needs the community clinician and appointment, recorded in the stay&apos;s care
        journey on Discharges.
      </p>
      <label>
        Date and time written on it
        <input name="written" type="datetime-local" required />
      </label>
      <label>
        <input name="checked" type="checkbox" required /> I have checked the paper for this admission
      </label>
      {localError || save.error ? <p role="alert">{localError ?? save.error}</p> : null}
      <div className={styles.actions}>
        <Button variant="pri" size="sm" type="submit" disabled={save.pending}>
          Record the paper
        </Button>
        <Button variant="sec" size="sm" onClick={() => setHandle(null)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
