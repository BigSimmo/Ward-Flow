"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { formatInstant } from "@/components/ward-management/ward-clock";
import { duplicateCandidates, GENDERS, type Gender, type Patient } from "@/components/ward-management/ward-patients";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

import { Panel, PeopleProposalBar, ProposalHeader } from "./people-proposal-parts";
import styles from "./people-proposal.module.css";

type Draft = { umrn: string; givenName: string; familyName: string; dateOfBirth: string; suburb: string };

const REQUIRED: { key: keyof Draft; label: string }[] = [
  { key: "umrn", label: "Record number (UMRN)" },
  { key: "givenName", label: "Given name" },
  { key: "familyName", label: "Family name" },
  { key: "dateOfBirth", label: "Date of birth" },
];

const NEAR_MATCH_MINIMUM = 4;

function MatchRow({ patient, why }: { patient: Patient; why: string }) {
  return (
    <a className={styles.matchRow} href={`/mockups/ward-flow/people/proposal?id=${patient.id}`}>
      <span className={styles.avatar} aria-hidden="true">
        {patient.givenName[0]}
        {patient.familyName[0]}
      </span>
      <span className={styles.rowMain}>
        <span className={styles.rowTitle}>
          {patient.givenName[0]}.{patient.familyName[0]}. <span className={styles.num}>{patient.umrn}</span>
        </span>
        <span className={styles.rowSub}>
          {patient.dateOfBirth ? `Born ${patient.dateOfBirth}` : "Date of birth not recorded"} · {why}
        </span>
      </span>
      <span className={styles.mutedText}>Open ›</span>
    </a>
  );
}

/** Proposed Add a patient screen: only the fields that are saved, and a duplicate check that leads. */
export function AddPatientProposal() {
  const { dispatch, patients, rejections } = useWardFlow();
  const now = useWardFlowClock();
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>({ umrn: "", givenName: "", familyName: "", dateOfBirth: "", suburb: "" });
  const [gender, setGender] = useState<Gender | "">("");
  const [attempted, setAttempted] = useState(false);
  const [rejection, setRejection] = useState<string | null>(null);
  const prior = useRef<{ count: number; rejections: number } | null>(null);

  const missing = REQUIRED.filter((field) => draft[field.key].trim() === "");
  const candidates = useMemo(() => duplicateCandidates(patients, draft), [patients, draft]);
  const exact = [
    ...candidates.recordNumberCollision.map((patient) => ({ patient, why: "same record number" })),
    ...candidates.sameNameSameBirthDate.map((patient) => ({ patient, why: "same name and date of birth" })),
    ...candidates.sameNameBirthDateNotMatched.map((patient) => ({
      patient,
      why: "same name, different date of birth",
    })),
  ].filter((entry, index, all) => all.findIndex((other) => other.patient.id === entry.patient.id) === index);
  const near = candidates.nearSpelling.filter((patient) => !exact.some((entry) => entry.patient.id === patient.id));
  const checked =
    draft.umrn.trim() !== "" ||
    [draft.givenName, draft.familyName].some((term) => term.trim().length >= NEAR_MATCH_MINIMUM) ||
    (draft.givenName.trim() !== "" && draft.familyName.trim() !== "");
  const blockedByRecordNumber = candidates.recordNumberCollision.length > 0;

  useEffect(() => {
    const before = prior.current;
    if (!before) return;
    if (patients.length > before.count) {
      prior.current = null;
      router.push(`/mockups/ward-flow/people/proposal?id=${patients[patients.length - 1].id}`);
    } else {
      // The reducer appends refusals; only those after this submission belong to it.
      const refusal = rejections
        .slice(before.rejections)
        .filter((entry) => entry.attempted === "ADD_PATIENT")
        .at(-1);
      if (refusal) {
        prior.current = null;
        setRejection(refusal.reason);
      }
    }
  }, [patients, rejections, router]);

  function update(key: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttempted(true);
    setRejection(null);
    if (missing.length > 0 || blockedByRecordNumber) return;
    prior.current = { count: patients.length, rejections: rejections.length };
    dispatch({
      type: "ADD_PATIENT",
      role: "coordinator",
      now,
      umrn: draft.umrn.trim(),
      givenName: draft.givenName.trim(),
      familyName: draft.familyName.trim(),
      dateOfBirth: draft.dateOfBirth.trim(),
      ...(gender === "" ? {} : { gender }),
      ...(draft.suburb.trim() === "" ? {} : { suburb: draft.suburb.trim() }),
    });
  }

  const showError = (key: keyof Draft) => attempted && draft[key].trim() === "";

  return (
    <div className={styles.screen}>
      <PeopleProposalBar active="add" />
      <main id="main-content" className={styles.page} data-testid="add-patient-proposal">
        <ProposalHeader
          crumbs={[{ label: "Patients", href: "/mockups/ward-flow/search/proposal" }]}
          title="Add a patient"
          asAt={`${formatInstant(now)} AWST`}
        />
        <p className={styles.answer}>
          Check the patient is not already recorded, then add their identity. Clinical details are recorded later, on
          the referral.
        </p>

        <div className={styles.splitWide}>
          <Panel title="Identity" question="Record number, name and date of birth are required.">
            <form className={styles.form} onSubmit={submit} noValidate>
              <div className={styles.fieldGrid}>
                {REQUIRED.map((field) => (
                  <label className={styles.field} key={field.key}>
                    <span>
                      {field.label} <span className={styles.fieldHint}>Required</span>
                    </span>
                    <input
                      className={styles.input}
                      type={field.key === "dateOfBirth" ? "date" : "text"}
                      value={draft[field.key]}
                      placeholder={field.key === "umrn" ? "e.g. UM100042" : undefined}
                      autoComplete="off"
                      aria-invalid={showError(field.key)}
                      onChange={(event) => update(field.key, event.target.value)}
                    />
                    {showError(field.key) ? (
                      <p className={styles.fieldError}>Enter the {field.label.toLowerCase()}.</p>
                    ) : null}
                  </label>
                ))}
              </div>

              <fieldset className={`${styles.field} ${styles.fieldset}`}>
                <span>
                  Gender <span className={styles.fieldHint}>Optional · used for bed matching</span>
                </span>
                <div className={styles.segment} role="radiogroup" aria-label="Gender">
                  {[["", "Not recorded"] as const, ...GENDERS.map((value) => [value, value] as const)].map(
                    ([value, label]) => (
                      <label key={label}>
                        <input
                          type="radio"
                          name="add-patient-proposal-gender"
                          checked={gender === value}
                          onChange={() => setGender(value as Gender | "")}
                        />
                        <span>{label}</span>
                      </label>
                    ),
                  )}
                </div>
              </fieldset>

              <label className={styles.field}>
                <span>
                  Suburb <span className={styles.fieldHint}>Optional · used to find the community team</span>
                </span>
                <input
                  className={styles.input}
                  type="text"
                  value={draft.suburb}
                  placeholder="e.g. Armadale"
                  autoComplete="off"
                  onChange={(event) => update("suburb", event.target.value)}
                />
              </label>

              <p className={styles.note}>
                Indigenous status, address, presenting facility, triage category, legal status and clinical notes are
                not on this form because Ward Flow does not save them here yet. Not wired in this prototype.
              </p>

              {rejection ? (
                <p className={`${styles.note} ${styles.noteWarn}`} role="alert">
                  Not added: {rejection}
                </p>
              ) : null}
              {attempted && blockedByRecordNumber ? (
                <p className={`${styles.note} ${styles.noteWarn}`} role="alert">
                  This record number already belongs to a patient. Open their record instead of adding a new one.
                </p>
              ) : null}

              <div className={styles.formFoot}>
                <button type="submit" className={styles.primary}>
                  Add patient
                </button>
                <a className={styles.textLink} href="/mockups/ward-flow/search/proposal">
                  Cancel
                </a>
                {attempted && missing.length > 0 ? (
                  <span className={styles.mutedText} role="status">
                    Still needed: {missing.map((field) => field.label).join(", ")}.
                  </span>
                ) : null}
              </div>
            </form>
          </Panel>

          <Panel
            title="Already recorded?"
            question={`Checked against all ${patients.length} patient records as you type.`}
            meta={checked ? exact.length + near.length : undefined}
          >
            {!checked ? (
              <p className={styles.empty}>Enter a record number, or a name of at least {NEAR_MATCH_MINIMUM} letters.</p>
            ) : exact.length + near.length === 0 ? (
              <p className={styles.empty} data-testid="add-patient-proposal-no-match">
                <span className={styles.goodText}>No match found.</span> You can add this patient.
              </p>
            ) : (
              <div data-testid="add-patient-proposal-matches">
                {exact.length > 0 ? (
                  <>
                    <p className={styles.groupLabel}>
                      <span>Likely the same person</span>
                      <span>{exact.length}</span>
                    </p>
                    {exact.map((entry) => (
                      <MatchRow key={entry.patient.id} patient={entry.patient} why={entry.why} />
                    ))}
                  </>
                ) : null}
                {near.length > 0 ? (
                  <>
                    <p className={styles.groupLabel}>
                      <span>Similar spelling</span>
                      <span>{near.length}</span>
                    </p>
                    {near.slice(0, 8).map((patient) => (
                      <MatchRow key={patient.id} patient={patient} why="similar name" />
                    ))}
                  </>
                ) : null}
              </div>
            )}
          </Panel>
        </div>
        <WardPrototypeFooter />
      </main>
    </div>
  );
}
