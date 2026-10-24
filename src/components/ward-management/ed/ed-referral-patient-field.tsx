"use client";

import { useId, useState } from "react";

import { matchReferralPatient, referralPatientLabel } from "../referrals/referral-patient-match";
import type { Patient } from "../ward-patients";
import styles from "./ed.module.css";

/**
 * A2-1 (audit 13 Oct 2026): the ED "Raise referral" form starts from a person. The clinician finds
 * a registered patient by name or UMRN, or says plainly that the person is not yet identified.
 * Until one is chosen the form's blocked reason says so, and nothing is filed.
 */
export function EdReferralPatientField({
  patients,
  patientId,
  unidentified,
  onChange,
  invalid = false,
  className,
}: {
  patients: readonly Patient[];
  patientId: Patient["id"] | undefined;
  unidentified: boolean;
  onChange: (next: { patientId: Patient["id"] | undefined; unidentified: boolean }) => void;
  /** Marks the name box after a blocked raise with nobody chosen (the form's missing-field pass). */
  invalid?: boolean;
  className?: string;
}) {
  const id = useId();
  const chosen = patients.find((patient) => patient.id === patientId);
  const [typed, setTyped] = useState(() => (chosen ? referralPatientLabel(chosen) : ""));
  return (
    <div
      className={className ? `${styles.referralField} ${className}` : styles.referralField}
      data-testid="ward-ed-referral-patient-field"
    >
      <label htmlFor={`${id}-patient`}>Patient</label>
      <input
        id={`${id}-patient`}
        type="text"
        aria-invalid={invalid || undefined}
        list={`${id}-patients`}
        data-testid="ward-ed-referral-patient"
        placeholder="Name or UMRN"
        autoComplete="off"
        value={typed}
        disabled={unidentified}
        onChange={(event) => {
          setTyped(event.target.value);
          onChange({ patientId: matchReferralPatient(patients, event.target.value)?.id, unidentified: false });
        }}
      />
      <datalist id={`${id}-patients`}>
        {patients.map((patient) => (
          <option key={patient.id} value={referralPatientLabel(patient)} />
        ))}
      </datalist>
      <label className={styles.referralCheckbox}>
        <input
          type="checkbox"
          data-testid="ward-ed-referral-unidentified"
          checked={unidentified}
          onChange={(event) => {
            setTyped("");
            onChange({ patientId: undefined, unidentified: event.target.checked });
          }}
        />
        Not yet identified
      </label>
    </div>
  );
}
