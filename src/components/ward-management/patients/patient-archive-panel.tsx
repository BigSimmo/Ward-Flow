"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
  const [problem, setProblem] = useState<string | null>(null);
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
                  setProblem(null);
                }}
              />{" "}
              {PATIENT_ARCHIVE_REASON_LABELS[option]}
            </label>
          ))}
        </fieldset>
        {problem ? <p role="alert">{problem}</p> : null}
        {confirming && reason !== null ? (
          <ArchiveConfirm
            patientId={patientId}
            displayName={displayName}
            reason={reason}
            onProblem={(outcome) => {
              setProblem(
                outcome?.status === "refused"
                  ? `The record was not archived. ${outcome.message ?? "It may have care recorded against it now."}`
                  : (outcome?.message ??
                      "Archive is not confirmed. Keep this page open and press Retry in the save status before making it again."),
              );
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
  onProblem,
  onKeep,
}: {
  patientId: PatientId;
  displayName: string;
  reason: PatientArchiveReason;
  onProblem: (outcome?: WardCommandOutcome) => void;
  onKeep: () => void;
}) {
  const raise = useWardRaise(useRouteRole());
  const router = useRouter();
  const toast = useOptionalToast();
  const pending = useRef(false);
  const [saving, setSaving] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
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
          // The same fences as useUndoableStep: no Undo after a workspace or role change, or before the board is ready.
          if (outcome.isCurrent && !outcome.isCurrent()) {
            toast.push({
              tone: "warning",
              title: "Undo is unavailable because the workspace or working role changed. Review the current board.",
            });
            return undefined;
          }
          if (outcome.canUndo && !outcome.canUndo()) {
            toast.push({
              tone: "warning",
              title:
                "Undo is unavailable until the shared board is ready. Wait for it to reconnect, then check the board.",
            });
            return false;
          }
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
    if (!mounted.current || (outcome?.isCurrent && !outcome.isCurrent())) return;
    if (outcome?.status === "accepted") {
      offerUndo(outcome);
      router.replace("/ward-flow/search");
    } else {
      onProblem(outcome || undefined);
      if (outcome?.status === "failed" && outcome.confirmation) {
        void outcome.confirmation.then(
          (terminal) => {
            if (terminal.commandId === outcome.commandId && terminal.status !== "failed") settle(terminal);
          },
          () => {},
        );
        return;
      }
    }
    pending.current = false;
    setSaving(false);
  };
  const archive = () => {
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    try {
      const completion = raise("ARCHIVE_PATIENT", { patientId, reason });
      if (completion && "then" in completion) void completion.then(settle, () => settle());
      else settle(completion);
    } catch {
      settle();
    }
  };
  return (
    <div role="group" aria-label="Confirm archive">
      <p>Archive {displayName}&apos;s record? It leaves every list. Only the audit trail will show it.</p>
      <Button
        variant="pri"
        disabledReason={saving ? "Archive is still awaiting confirmation" : undefined}
        onClick={archive}
        data-testid="ward-patient-archive-confirm"
      >
        Archive record
      </Button>{" "}
      <Button
        variant="sec"
        disabledReason={saving ? "Archive is still awaiting confirmation" : undefined}
        onClick={onKeep}
      >
        Keep as is
      </Button>
    </div>
  );
}
