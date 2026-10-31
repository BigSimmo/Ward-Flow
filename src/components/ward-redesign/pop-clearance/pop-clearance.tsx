"use client";

// Preview copy of the "Record treating-team medical clearance" modal hand-built in
// `patients/patient-now-screen.tsx` (`showClearanceModal`), with its state, its save hook
// (`usePatientFormSave`) and its dispatch, redesigned on the kit Dialog over the patient record.

import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { resolvePatientNowRecord } from "@/components/ward-management/patients/patient-now-adapter";
import { decodeRecordAddress } from "@/components/ward-management/shell/ward-record-address";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { useRoleGate, useRouteRole } from "@/components/ward-management/ward-role-gate";
import { SAVE_NOT_CONFIRMED } from "@/components/ward-management/ward-save-failure";
import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { Button, Checkbox, Dialog, Radio } from "@/components/wf";

import styles from "./pop-clearance.module.css";

/** The sample record the patient mock-up shows (`patient/patient-page.tsx`). */
const SAMPLE_ADDRESS = "196zcp24w5t0";

const OUTCOMES = [
  { value: "cleared", label: "Medical clearance provided" },
  { value: "not-cleared", label: "Not medically cleared" },
] as const;

// Both local and shared dispatches report an outcome. Keep the current draft until accepted,
// and fence the completion so an old patient's save cannot dismiss another patient's form.
// (Today's `usePatientFormSave`, copied: the real one is not exported.)
function usePatientFormSave(scope: string) {
  const scopeToken = useMemo(() => ({ id: scope }), [scope]);
  const currentScope = useRef<object | null>(scopeToken);
  useLayoutEffect(() => {
    currentScope.current = scopeToken;
    return () => {
      currentScope.current = null;
    };
  }, [scopeToken]);
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ scope: object; message: string }>();
  function submit(record: () => ReturnType<WardCommandDispatch>, onAccepted: () => void) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(undefined);
    const submittedScope = scopeToken;
    const finish = (outcome?: WardCommandOutcome | void) => {
      inFlight.current = false;
      setPending(false);
      if (currentScope.current !== submittedScope) return;
      if (outcome?.status === "accepted" && outcome.isCurrent?.() !== false) onAccepted();
      else
        setError({
          scope: submittedScope,
          message: outcome?.message ?? SAVE_NOT_CONFIRMED,
        });
    };
    try {
      const completion = record();
      if (completion && "then" in completion) void completion.then(finish, () => finish());
      else finish(completion);
    } catch {
      finish();
    }
  }
  return {
    pending,
    error: error?.scope === scopeToken ? error.message : undefined,
    submit,
  };
}

/**
 * The Medical clearance mock-up, drawn over the patient record. `page` is the page it opens over.
 * Saving records `RECORD_MOVEMENT_MEDICAL_CLEARANCE` exactly as the record does; Close closes it.
 */
export function PopClearance({ page }: { page: ReactNode }) {
  const { patients, movements, referrals, admissions, units, dispatch } = useWardFlowSelect(
    "patients",
    "movements",
    "referrals",
    "admissions",
    "units",
    "dispatch",
  );
  const now = useWardFlowClock();
  const gate = useRoleGate();
  const routeRole = useRouteRole();
  const clearanceGate = gate("RECORD_MOVEMENT_MEDICAL_CLEARANCE");
  const selectedId = decodeRecordAddress(SAMPLE_ADDRESS) ?? SAMPLE_ADDRESS;
  const clearanceSave = usePatientFormSave(selectedId);
  const [showClearanceModal, setShowClearanceModal] = useState(true);
  const [clearanceDraft, setClearanceDraft] = useState<"" | "cleared" | "not-cleared">("");
  const [clearanceAttested, setClearanceAttested] = useState(false);

  const resolved = useMemo(
    () => resolvePatientNowRecord(selectedId, patients, movements, referrals, admissions, units, now),
    [selectedId, patients, movements, referrals, admissions, units, now],
  );
  if (!resolved) return <>{page}</>;
  const liveMovement = resolved.liveMovement ?? movements.find((m) => m.id === selectedId);
  // Surname first (D-83), from the same resolver the other popups use.
  const subject = liveMovement ?? { patientId: resolved.livePatient?.id ?? null, id: selectedId };
  const patient = resolveSubjectPatient(subject, { patients, referrals, movements });

  const closeClearanceModal = () => {
    if (!clearanceSave.pending) setShowClearanceModal(false);
  };
  // A4-32: say why Save is not yet available, beside it (the kit's reason, in today's words).
  const saveReason = !clearanceGate.allowed
    ? clearanceGate.reason
    : !clearanceDraft
      ? "Choose the outcome to save"
      : !clearanceAttested
        ? "Tick the statement to save"
        : !liveMovement
          ? "No journey is open to record against"
          : undefined;

  return (
    <>
      {page}
      <Dialog
        open={showClearanceModal}
        onClose={closeClearanceModal}
        closeOnScrim={!clearanceSave.pending}
        title="Record treating-team medical clearance"
        description={
          <>
            <strong className={styles.name}>{patient.formalName}</strong> ·{" "}
            <span className={styles.mono}>{patient.umrn}</span>
          </>
        }
        closeLabel="Close dialog"
        size="md"
        data-testid="patient-clearance-dialog"
      >
        <div className={styles.body}>
          <p className={styles.lead}>
            Record the medical clearance provided by the treating team. This prototype does not determine fitness for
            transport or legal transfer requirements.
          </p>

          <fieldset className={styles.options} disabled={clearanceSave.pending}>
            <legend className={styles.legend}>Treating-team clearance outcome</legend>
            {OUTCOMES.map((option) => (
              <Radio
                key={option.value}
                className={styles.option}
                name="patient-clearance-outcome"
                value={option.value}
                checked={clearanceDraft === option.value}
                onChange={() => setClearanceDraft(option.value)}
                label={option.label}
              />
            ))}
          </fieldset>

          <Checkbox
            className={styles.attestation}
            disabled={clearanceSave.pending}
            checked={clearanceAttested}
            onChange={(event) => setClearanceAttested(event.target.checked)}
            label={<span>This is the treating team&apos;s stated outcome.</span>}
          />

          <p className={styles.note}>
            No notification is sent. This records the stated outcome in the shared synthetic journey.
          </p>

          {/* One footer row, as the other popups: Close, then the reason and the one filled button. */}
          <div className={styles.actions}>
            <Button variant="ghost" disabled={clearanceSave.pending} onClick={closeClearanceModal}>
              Close
            </Button>
            <Button
              variant="pri"
              loading={clearanceSave.pending}
              disabledReason={saveReason}
              onClick={(e) => {
                if (
                  clearanceSave.pending ||
                  !liveMovement ||
                  !clearanceDraft ||
                  !clearanceAttested ||
                  !clearanceGate.allowed
                ) {
                  ignoreUnavailableActivation(e);
                  return;
                }
                clearanceSave.submit(
                  () =>
                    dispatch({
                      type: "RECORD_MOVEMENT_MEDICAL_CLEARANCE",
                      role: routeRole,
                      now,
                      movementId: liveMovement.id,
                      cleared: clearanceDraft === "cleared",
                    }),
                  () => setShowClearanceModal(false),
                );
              }}
            >
              {clearanceSave.pending ? "Saving clearance outcome…" : "Save clearance outcome"}
            </Button>
          </div>
          {clearanceGate.allowed ? null : clearanceGate.note}
          {clearanceSave.pending ? (
            <p className={styles.note} role="status">
              Saving clearance outcome…
            </p>
          ) : null}
          {clearanceSave.error ? (
            <p className={styles.error} role="alert">
              Clearance was not recorded: {clearanceSave.error}
            </p>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
