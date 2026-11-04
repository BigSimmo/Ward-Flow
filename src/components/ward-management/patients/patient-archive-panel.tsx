"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Card, CardBody, CardHead, useToast } from "@/components/wf";
import { UNDO_TOAST_MS, UNDO_WINDOW_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { useRoleGate, useRouteRole } from "@/components/ward-management/ward-role-gate";
import {
  PATIENT_ARCHIVE_REASON_LABELS,
  PATIENT_ARCHIVE_REASONS,
  patientArchiveProblem,
  type PatientArchiveReason,
} from "@/components/ward-management/ward-patient-archive";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import type { PatientId } from "@/components/ward-management/ward-patients";

/** The layout's toast, or null where the panel renders without a `ToastProvider` (a test). */
function useOptionalToast() {
  try {
    return useToast();
  } catch {
    return null;
  }
}

/**
 * #816 (Josh, 26 Oct 2026: archive only, coordinator only): a record added in error can leave every
 * list. Shown only to the coordinator, and only while nothing else names the record, so a person
 * with care recorded against them is never archived. The audit trail keeps the record.
 */
export function PatientArchivePanel({ patientId, displayName }: { patientId: PatientId; displayName: string }) {
  const gate = useRoleGate();
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
  return (
    <Card data-testid="ward-patient-archive">
      <CardHead title="Record added in error" />
      <CardBody>
        <p>Archiving removes it from every list. The audit trail keeps it.</p>
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
        {confirming && reason !== null ? (
          <ArchiveConfirm
            patientId={patientId}
            displayName={displayName}
            reason={reason}
            onRefused={() => {
              setRefused(true);
              setConfirming(false);
            }}
            onKeep={() => setConfirming(false)}
          />
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

/** The confirm step. Mounted only once the coordinator starts, so the router is read only then. */
function ArchiveConfirm({
  patientId,
  displayName,
  reason,
  onRefused,
  onKeep,
}: {
  patientId: PatientId;
  displayName: string;
  reason: PatientArchiveReason;
  onRefused: () => void;
  onKeep: () => void;
}) {
  const raise = useWardRaise(useRouteRole());
  const router = useRouter();
  const toast = useOptionalToast();
  // Tier 1 item 6 (Josh, 4 Nov 2026): a record archived by mistake comes back from the toast's Undo.
  // The toast is the layout's, so it outlives this page as the coordinator lands on Search.
  const offerUndo = (outcome: WardCommandOutcome) => {
    if (!toast) return;
    const seq = outcome.undoStep?.undoType === "UNDO_PATIENT_RECORD" ? outcome.undoStep.seq : undefined;
    toast.push({
      tone: "success",
      title: `${displayName}'s record archived.`,
      body: `Undo within ${UNDO_WINDOW_MINUTES} min.`,
      undo: {
        durationMs: UNDO_TOAST_MS,
        onUndo: () => {
          const said = (undone: WardCommandOutcome | void) =>
            toast.push(
              undone && undone.status !== "accepted"
                ? { tone: "warning", title: `Not recorded: ${undone.message ?? "The Undo was refused."}` }
                : { tone: "info", title: `Undone. ${displayName}'s record is back.` },
            );
          const completion = raise("UNDO_PATIENT_RECORD", {
            patientId,
            ...(seq === undefined ? {} : { recordSeq: seq }),
          });
          if (completion && "then" in completion) void completion.then(said, () => said());
          else said(completion);
          return undefined;
        },
      },
    });
  };
  const settle = (outcome: WardCommandOutcome | void) => {
    if (outcome?.status === "accepted") {
      offerUndo(outcome);
      router.replace("/ward-flow/search");
    } else onRefused();
  };
  const archive = () => {
    const completion = raise("ARCHIVE_PATIENT", { patientId, reason });
    if (completion && "then" in completion) void completion.then(settle, () => settle());
    else settle(completion);
  };
  return (
    <div role="group" aria-label="Confirm archive">
      <p>Archive {displayName}&apos;s record? It leaves every list. Only the audit trail will show it.</p>
      <Button variant="pri" onClick={archive} data-testid="ward-patient-archive-confirm">
        Archive record
      </Button>{" "}
      <Button variant="sec" onClick={onKeep}>
        Keep as is
      </Button>
    </div>
  );
}
