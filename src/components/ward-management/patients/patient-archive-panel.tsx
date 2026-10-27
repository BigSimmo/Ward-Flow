"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Card, CardBody, CardHead } from "@/components/wf";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { useRoleGate, useRouteRole } from "@/components/ward-management/ward-role-gate";
import {
  PATIENT_ARCHIVE_REASON_LABELS,
  PATIENT_ARCHIVE_REASONS,
  type PatientArchiveReason,
} from "@/components/ward-management/ward-patient-archive";
import { patientArchiveProblem } from "@/components/ward-management/ward-patient-archive-reducer";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import type { PatientId } from "@/components/ward-management/ward-patients";

/**
 * #816 (Josh, 26 Oct 2026: archive only, coordinator only): a record added in error can leave every
 * list. Shown only to the coordinator, and only while nothing else names the record, so a person
 * with care recorded against them is never archived. The audit trail keeps the record.
 */
export function PatientArchivePanel({ patientId, displayName }: { patientId: PatientId; displayName: string }) {
  const gate = useRoleGate();
  const raise = useWardRaise(useRouteRole());
  const router = useRouter();
  const state = useWardFlowSelect(
    "patients",
    "movements",
    "referrals",
    "admissions",
    "bedReleases",
    "leaveBeds",
    "rejections",
  );
  const [reason, setReason] = useState<PatientArchiveReason | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [refused, setRefused] = useState(false);
  if (!gate("ARCHIVE_PATIENT").allowed) return null;
  // The screen's own read of the lists it holds. The engine reads every list and stays the authority.
  if (patientArchiveProblem(state as Parameters<typeof patientArchiveProblem>[0], patientId) !== undefined) return null;
  const settle = (outcome: WardCommandOutcome | void) => {
    if (outcome?.status === "accepted") router.replace("/ward-flow/search");
    else {
      setRefused(true);
      setConfirming(false);
    }
  };
  const archive = () => {
    if (reason === null) return;
    const completion = raise("ARCHIVE_PATIENT", { patientId, reason });
    if (completion && "then" in completion) void completion.then(settle, () => settle());
    else settle(completion);
  };
  return (
    <Card data-testid="ward-patient-archive">
      <CardHead title="Record added in error" />
      <CardBody>
        <p>
          Nothing is recorded against this person yet. If this record should not exist, archive it. It leaves every
          list, and the audit trail keeps it.
        </p>
        <fieldset>
          <legend>Why should it go?</legend>
          {PATIENT_ARCHIVE_REASONS.map((option) => (
            <label key={option}>
              <input
                type="radio"
                name="ward-patient-archive-reason"
                value={option}
                checked={reason === option}
                onChange={() => {
                  setReason(option);
                  setRefused(false);
                }}
              />{" "}
              {PATIENT_ARCHIVE_REASON_LABELS[option]}
            </label>
          ))}
        </fieldset>
        {refused ? <p role="alert">The record was not archived. It may have care recorded against it now.</p> : null}
        {confirming ? (
          <div role="group" aria-label="Confirm archive">
            <p>Archive {displayName}&apos;s record? It leaves every list. Only the audit trail will show it.</p>
            <Button variant="pri" onClick={archive} data-testid="ward-patient-archive-confirm">
              Archive record
            </Button>{" "}
            <Button variant="sec" onClick={() => setConfirming(false)}>
              Keep record
            </Button>
          </div>
        ) : (
          <Button
            variant="sec"
            disabledReason={reason === null ? "Choose a reason first" : undefined}
            onClick={() => setConfirming(true)}
            data-testid="ward-patient-archive-start"
          >
            Archive this record
          </Button>
        )}
      </CardBody>
    </Card>
  );
}
