"use client";

import { Dialog } from "@/components/wf";
import { useOptionalWardFlowSelect, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { calendarDateOf } from "@/components/ward-management/ward-clock";
import type { Patient } from "@/components/ward-management/ward-patients";
import { formatDateOfBirth, patientAgeYears } from "@/components/ward-management/ward-patients";
import { UMRN_NOT_RECORDED } from "@/components/ward-management/ward-patient-resolver";
import styles from "./arrival-identity-dialog.module.css";

/** The person the check names: the record's own fields, read for display only. */
export type ArrivalIdentityPerson = Pick<Patient, "familyName" | "givenName" | "umrn" | "dateOfBirth">;

/**
 * Walk-through WT-11 (26 Oct 2026): Confirm arrival took one tap with no second identifier, unlike
 * a departure, which checks the name and UMRN first (DA-08). The ward now confirms who is in front
 * of them, and where, before the arrival is recorded. Cancel leaves everything as it was.
 *
 * R-MOVE-10 (Josh, 14 Nov 2026): the ward's last identity check before a bed and a legal form attach
 * to a person. Titled for the ward, it lists three identifiers in one name order (surname first, in
 * capitals as on a wristband), the UMRN, the date of birth with age, and where the person came from.
 */
export function ArrivalIdentityDialog({
  open,
  person,
  identity,
  wardName,
  comingFrom,
  onConfirm,
  onClose,
  testId = "ward-arrival-identity",
}: {
  open: boolean;
  /** The linked person, when there is one; otherwise the check reads `identity`. */
  person?: ArrivalIdentityPerson;
  /** What to check when no person is linked (initials only, or a name not shown to this desk). */
  identity: string;
  wardName: string;
  /** Where the person is coming from, when known. */
  comingFrom?: string;
  onConfirm: () => void;
  onClose: () => void;
  testId?: string;
}) {
  const now = useWardFlowClock(0);
  const dayZero = useOptionalWardFlowSelect("dayZero")?.dayZero;
  const age =
    person?.dateOfBirth && dayZero !== undefined ? patientAgeYears(person, calendarDateOf(now, dayZero)) : undefined;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={`Confirm arrival at ${wardName}`}
      description="Check the wristband matches before you record the arrival."
      secondary={[{ label: "Cancel", onAction: onClose }]}
      primary={{ label: "Confirm arrival", onAction: onConfirm }}
      data-testid={testId}
    >
      <dl className={styles.facts} data-testid={`${testId}-check`}>
        {person ? (
          <>
            <dt>Name</dt>
            <dd className={styles.name}>
              {person.familyName.toUpperCase()}, {person.givenName}
            </dd>
            <dt>UMRN</dt>
            <dd className={styles.mono}>{person.umrn.trim() || UMRN_NOT_RECORDED}</dd>
            <dt>Date of birth</dt>
            <dd>
              {formatDateOfBirth(person.dateOfBirth)}
              {age !== undefined && Number.isFinite(age) && age >= 0 ? ` · ${age} y` : null}
            </dd>
          </>
        ) : (
          <>
            <dt>Check</dt>
            <dd>{identity}</dd>
          </>
        )}
        {comingFrom ? (
          <>
            <dt>Coming from</dt>
            <dd>{comingFrom}</dd>
          </>
        ) : null}
      </dl>
    </Dialog>
  );
}
