"use client";

import { useMemo } from "react";
import { Badge, buttonClass, SrOnly, StatusGlyph } from "@/components/wf";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import {
  duplicateCandidates,
  type Patient,
  type PatientIdentityDraft,
} from "@/components/ward-management/ward-patients";
import { patientKeyFor } from "./ward-referral-drawer-model";
import styles from "./ward-referral-drawer-duplicate-check.module.css";

type MatchKind = "umrn" | "same" | "name" | "near";
const MATCH_LABEL: Record<MatchKind, string> = {
  umrn: "Same UMRN",
  same: "Same name and date of birth",
  name: "Same name",
  near: "Similar name",
};

/**
 * Item 38 (Josh, 9 Nov 2026, care plans and safety flags thread: defaults approved): a person added
 * from the referral's Patient step gets the same duplicate check as Add a patient
 * (`duplicateCandidates`), so a second record for someone already here is caught before it is made.
 * "Use this record" picks the existing person for this referral instead. It warns and never blocks,
 * as on Add a patient.
 */
export function ReferralDuplicateCheck({
  draft,
  onUse,
}: {
  draft: PatientIdentityDraft;
  /** Picks the person by their drawer key (`patientKeyFor`): their open journey, else the record. */
  onUse: (key: string) => void;
}) {
  const { patients, movements, referrals } = useWardFlowSelect("patients", "movements", "referrals");
  const candidates = useMemo(() => duplicateCandidates(patients, draft), [patients, draft]);
  const matches: { patient: Patient; kind: MatchKind }[] = [
    ...candidates.recordNumberCollision.map((patient) => ({ patient, kind: "umrn" as const })),
    ...candidates.sameNameSameBirthDate.map((patient) => ({ patient, kind: "same" as const })),
    ...candidates.sameNameBirthDateNotMatched.map((patient) => ({ patient, kind: "name" as const })),
    ...candidates.nearSpelling.map((patient) => ({ patient, kind: "near" as const })),
  ].filter((match, index, all) => all.findIndex((other) => other.patient.id === match.patient.id) === index);
  const typed = draft.umrn.trim() !== "" || draft.familyName.trim() !== "" || draft.givenName.trim() !== "";
  if (!typed) return null;
  return (
    <section
      className={styles.check}
      aria-label="Possible existing records"
      data-testid="ward-referral-duplicate-check"
    >
      <div aria-live="polite">
        {matches.length === 0 ? (
          <p className={styles.none} data-testid="ward-referral-duplicate-none">
            <StatusGlyph tone="success" size={9} />
            No existing record matches this UMRN or name.
          </p>
        ) : (
          <>
            <p className={styles.lead}>
              <Badge size="sm" tone="warning">
                {matches.length}
                <SrOnly> synthetic records</SrOnly> to check
              </Badge>{" "}
              This person may already be in the system. Check before adding them again.
            </p>
            <ul className={styles.list}>
              {matches.map(({ patient, kind }) => {
                // A record no longer in the list cannot be chosen, so its button is off, not silent.
                const key = patientKeyFor(patient.id, { patients, movements, referrals });
                return (
                  <li key={patient.id} className={styles.row} data-testid={`ward-referral-duplicate-${patient.id}`}>
                    <span className={styles.main}>
                      <strong>
                        {patient.familyName}, {patient.givenName}
                      </strong>
                      <span className={styles.meta}>
                        <span className={styles.mono}>{patient.umrn}</span> · born{" "}
                        <span className={styles.mono}>{patient.dateOfBirth}</span> · {MATCH_LABEL[kind]}
                      </span>
                    </span>
                    <button
                      type="button"
                      className={buttonClass({ size: "sm" })}
                      disabled={key === null}
                      onClick={() => {
                        if (key) onUse(key);
                      }}
                    >
                      Use this record
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
