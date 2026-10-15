"use client";

import { useState } from "react";
import { FOLLOW_UP_STATES, isFollowUpState, type FollowUpState } from "../ward-admissions";
import type { DischargeRecord, WardRecordActor } from "../ward-discharge-records";
import { formatInstantWithDay } from "../ward-clock";
import { useWardFlow, useWardFlowClock } from "../ward-flow-provider";
import { useWardFeatureFlag } from "../shell/ward-feature-flag-store";
import { activeCommunityTreatmentOrder } from "../ward-patients";
import { followUpWithinWindowCheck } from "./discharge-follow-up-check";
import styles from "./discharges-third-edition.module.css";

export function DischargeFollowUp({ record, actor }: { record: DischargeRecord; actor: WardRecordActor }) {
  const { dispatch, rejections, patients } = useWardFlow();
  const now = useWardFlowClock();
  // Top 25 item 11: the seven day check on every discharge, with extra items on a CTO. Warns only.
  const sevenDayOn = useWardFeatureFlag("top25-follow-up-7day");
  const linkedPatientId = record.identity.kind === "linked" ? record.identity.patient.id : null;
  const check = sevenDayOn
    ? followUpWithinWindowCheck({
        followUp: record.followUp,
        careJourney: record.careJourney,
        leftAt: record.leftAt,
        expectedDischargeAt: record.expectedDischargeAt,
        now,
        onCto:
          linkedPatientId !== null &&
          activeCommunityTreatmentOrder((patients ?? []).find((patient) => patient.id === linkedPatientId)) !==
            undefined,
      })
    : null;
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
      {check ? (
        <div data-testid="ward-discharge-follow-up-7day" data-warning={check.warning ? "true" : undefined}>
          <p>
            {check.warning ? "Check: " : "Done: "}
            {check.sentence} This does not stop the discharge.
          </p>
          {check.ctoItems ? (
            <ul aria-label="Community treatment order follow up">
              {check.ctoItems.map((item) => (
                <li key={item.label}>
                  {item.done ? "Done: " : "Still to do: "}
                  {item.label}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
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
