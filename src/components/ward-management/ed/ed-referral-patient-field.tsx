"use client";

import { useId, useState } from "react";

import { matchReferralPatient, referralPatientLabel } from "../referrals/referral-patient-match";
import { formatDateOfBirth, formatUmrn, patientListName, type Patient } from "../ward-patients";
import linkedStyles from "./ed-referral-linked.module.css";
import styles from "./ed.module.css";

/**
 * A2-1 (audit 13 Oct 2026): the ED "Raise referral" form starts from a person. The clinician finds
 * a registered patient by name or UMRN, or says plainly that the person is not yet identified.
 * Until one is chosen the form's blocked reason says so, and nothing is filed.
 *
 * Clinical-safety audit (1 Nov 2026): a record links only from a pick in the list or an exact UMRN,
 * never from a typed name alone, and the linked record's name, UMRN and date of birth show under
 * the box so the clinician can check it is the right person.
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
  // The form may be pointed at another person while open (a new "Ask for a bed"), so the box
  // follows the person the form is filing for, never the one it was opened with.
  const [shown, setShown] = useState({ patientId, unidentified });
  if (shown.patientId !== patientId || shown.unidentified !== unidentified) {
    setShown({ patientId, unidentified });
    if (unidentified) setTyped("");
    else if (matchReferralPatient(patients, typed)?.id !== patientId)
      setTyped(chosen ? referralPatientLabel(chosen) : "");
  }
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
        aria-describedby={chosen ? `${id}-linked` : undefined}
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
      {chosen ? (
        <p id={`${id}-linked`} className={linkedStyles.referralLinked} data-testid="ward-ed-referral-patient-linked">
          Linked: {patientListName(chosen)} · {formatUmrn(chosen.umrn)} · DOB {formatDateOfBirth(chosen.dateOfBirth)}
        </p>
      ) : null}
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
