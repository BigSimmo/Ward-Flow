"use client";

import { useState } from "react";
import { FOLLOW_UP_STATES, isFollowUpState, type FollowUpState } from "../ward-admissions";
import type { DischargeRecord, WardRecordActor } from "../ward-discharge-records";
import { formatInstantWithDay } from "../ward-clock";
import { useWardFlow, useWardFlowClock } from "../ward-flow-provider";
import styles from "./discharges-third-edition.module.css";

export function DischargeFollowUp({ record, actor }: { record: DischargeRecord; actor: WardRecordActor }) {
  const { dispatch, rejections } = useWardFlow();
  const now = useWardFlowClock();
  const [submittedAtCount, setSubmittedAtCount] = useState<number | null>(null);
  const refused =
    submittedAtCount !== null &&
    rejections.length > submittedAtCount &&
    rejections.at(-1)?.attempted === "RECORD_ADMISSION_FOLLOW_UP";
  const [choice, setChoice] = useState<FollowUpState | "">("");
  const editable =
    (actor.role === "coordinator" || (actor.role === "ward" && actor.actingUnitId === record.unitId)) &&
    record.identity.kind === "linked" &&
    (record.admissionState === "occupied" || record.admissionState === "departed") &&
    record.leavingDestination !== "died-on-the-ward";
  const label = (state: FollowUpState) => (state === "arranged" ? "Arranged" : "Not arranged");
  return (
    <section aria-label="Follow-up arrangement" className={styles.drawerSection}>
      <h4>Follow-up arrangement</h4>
      <p role="status" data-testid="ward-discharge-follow-up-status">
        {record.followUp
          ? `${label(record.followUp.state)} · ${record.followUp.recordedBy} · ${formatInstantWithDay(record.followUp.recordedAt, now)}`
          : "Not recorded"}
      </p>
      <p>This records an arrangement status. It does not confirm that follow-up occurred.</p>
      {refused && <p role="alert">Follow-up status was not recorded. Reopen the current record and try again.</p>}
      {editable && (
        <form
          className={styles.filters}
          onSubmit={(event) => {
            event.preventDefault();
            if (
              !isFollowUpState(choice) ||
              record.identity.kind !== "linked" ||
              (actor.role !== "ward" && actor.role !== "coordinator")
            )
              return;
            setSubmittedAtCount(rejections.length);
            dispatch({
              type: "RECORD_ADMISSION_FOLLOW_UP",
              role: actor.role,
              now,
              ...(actor.role === "ward" ? { actingUnitId: actor.actingUnitId } : {}),
              admissionId: record.admissionId,
              patientId: record.identity.patient.id,
              expectedGeneration: record.generation,
              expectedRevision: record.revision,
              followUpState: choice,
            });
          }}
        >
          <label className={styles.filterField}>
            Arrangement status{" "}
            <select
              value={choice}
              onChange={(event) => {
                const value = event.target.value;
                setChoice(isFollowUpState(value) ? value : "");
              }}
            >
              <option value="">Choose status</option>
              {FOLLOW_UP_STATES.map((state) => (
                <option key={state} value={state}>
                  {label(state)}
                </option>
              ))}
            </select>
          </label>{" "}
          <button type="submit" className={styles.quietButton} disabled={!choice}>
            Record follow-up status
          </button>
        </form>
      )}
    </section>
  );
}
