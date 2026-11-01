"use client";

import type { RefObject } from "react";

import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import type { RoleGate } from "@/components/ward-management/ward-role-gate";
import { Button, Checkbox, Dialog, Radio } from "@/components/wf";

import styles from "./patient-clearance-dialog.module.css";

export type ClearanceDraft = "" | "cleared" | "not-cleared";

const OUTCOMES = [
  { value: "cleared", label: "Medical clearance provided" },
  { value: "not-cleared", label: "Not medically cleared" },
] as const;

/**
 * Record treating-team medical clearance (approved pop-up, 31 Oct 2026). The outcome is two choices
 * with neither chosen, the statement is a checkbox, and Save says why it is unavailable until both
 * are done. The safeguard sentences are kept word for word. The record screen owns the draft, the
 * save and the dispatch; this only draws the form.
 */
export function PatientClearanceDialog({
  open,
  onClose,
  returnFocusRef,
  patientName,
  umrn,
  gate,
  hasJourney,
  draft,
  onDraftChange,
  attested,
  onAttestedChange,
  pending,
  error,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLElement | null>;
  /** Surname first (D-83). */
  patientName: string;
  umrn?: string;
  gate: RoleGate;
  /** False when no journey is open to record against. */
  hasJourney: boolean;
  draft: ClearanceDraft;
  onDraftChange: (draft: ClearanceDraft) => void;
  attested: boolean;
  onAttestedChange: (attested: boolean) => void;
  pending: boolean;
  error?: string;
  /** Called only when every condition holds. */
  onSave: () => void;
}) {
  // A4-32: say why Save is not yet available, beside it.
  const saveReason = !gate.allowed
    ? gate.reason
    : !draft
      ? "Choose the outcome to save"
      : !attested
        ? "Tick the statement to save"
        : !hasJourney
          ? "No journey is open to record against"
          : undefined;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      closeOnScrim={!pending}
      returnFocusRef={returnFocusRef}
      title="Record treating-team medical clearance"
      description={
        <>
          <strong className={styles.name}>{patientName}</strong>
          {umrn ? (
            <>
              {" · "}
              <span className={styles.mono}>{umrn}</span>
            </>
          ) : null}
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

        <fieldset className={styles.options} disabled={pending}>
          <legend className={styles.legend}>Treating-team clearance outcome</legend>
          {OUTCOMES.map((option) => (
            <Radio
              key={option.value}
              className={styles.option}
              name="patient-clearance-outcome"
              value={option.value}
              checked={draft === option.value}
              onChange={() => onDraftChange(option.value)}
              label={option.label}
            />
          ))}
        </fieldset>

        <Checkbox
          className={styles.attestation}
          disabled={pending}
          checked={attested}
          onChange={(event) => onAttestedChange(event.target.checked)}
          label={<span>This is the treating team&apos;s stated outcome.</span>}
        />

        <p className={styles.note}>
          No notification is sent. This records the stated outcome in the shared synthetic journey.
        </p>

        <div className={styles.actions}>
          <Button variant="ghost" disabled={pending} onClick={onClose}>
            Close
          </Button>
          <Button
            variant="pri"
            loading={pending}
            aria-disabled={pending || undefined}
            disabledReason={saveReason}
            onClick={(event) => {
              if (pending || saveReason) {
                ignoreUnavailableActivation(event);
                return;
              }
              onSave();
            }}
          >
            {pending ? "Saving clearance outcome…" : "Save clearance outcome"}
          </Button>
        </div>
        {gate.allowed ? null : gate.note}
        {pending ? (
          <p className={styles.note} role="status">
            Saving clearance outcome…
          </p>
        ) : null}
        {error ? (
          <p className={styles.error} role="alert">
            Clearance was not recorded: {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
