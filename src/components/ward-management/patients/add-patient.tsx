"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from "react";

import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { duplicateCandidates, GENDERS, type Gender } from "@/components/ward-management/ward-patients";
import { takeHandedOffPatientQuery } from "@/components/ward-management/search/patient-query-handoff";
import { useWardModalFocus } from "../ward-modal-focus";

import styles from "./add-patient.module.css";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

/**
 * ADD A PATIENT — Front-door intake form for acute mental health bed coordination.
 * Third Edition styling fidelity with multi-panel workflow:
 * 1. Identity & Demographics
 * 2. Triage Urgency (ATS 1 to ATS 5)
 * 3. Legal status (Voluntary, Form 1A, Form 3B, Form 4A - never render Mental Health Act section numbers!)
 * 4. Clinical Presenting Complaint & Notes
 * 5. Live duplicate detection candidate card panel with match score
 *
 * Owner Rule D4: Any unconnected prototype button displays "Not wired in this prototype."
 * Owner Rule D5: No computed legal time limits; NEVER render Mental Health Act section numbers.
 */

type PatientDraft = {
  umrn: string;
  givenName: string;
  familyName: string;
  dateOfBirth: string;
};

const REQUIRED_FIELDS: readonly { readonly key: keyof PatientDraft; readonly name: string }[] = [
  { key: "umrn", name: "Record number" },
  { key: "givenName", name: "Given name" },
  { key: "familyName", name: "Family name" },
  { key: "dateOfBirth", name: "Date of birth" },
];

function initialDraft(prefillGivenName = ""): PatientDraft {
  return { umrn: "", givenName: prefillGivenName, familyName: "", dateOfBirth: "" };
}

function unansweredFieldNames(draft: PatientDraft): string[] {
  return REQUIRED_FIELDS.filter((field) => draft[field.key].trim() === "").map((field) => field.name);
}

type AnsweredDraft = PatientDraft;

function answeredDraft(draft: PatientDraft): AnsweredDraft | undefined {
  const umrn = draft.umrn.trim();
  const givenName = draft.givenName.trim();
  const familyName = draft.familyName.trim();
  const dateOfBirth = draft.dateOfBirth.trim();
  if (umrn === "" || givenName === "" || familyName === "" || dateOfBirth === "") return undefined;
  return { umrn, givenName, familyName, dateOfBirth };
}

const UNAVAILABLE_REASON_ID = "ward-add-patient-unavailable-reason";
const GENDER_NOT_RECORDED = "not-recorded" as const;
type GenderChoice = Gender | typeof GENDER_NOT_RECORDED;

const NEAR_MATCH_MINIMUM_TERM_LENGTH = 4;

type TriageLevel = "1" | "2" | "3" | "4" | "5";

interface TriageOption {
  code: TriageLevel;
  label: string;
  timeframe: string;
  description: string;
}

const TRIAGE_OPTIONS: readonly TriageOption[] = [
  { code: "1", label: "ATS 1", timeframe: "Immediate", description: "Resuscitation" },
  { code: "2", label: "ATS 2", timeframe: "10 min", description: "Emergency" },
  { code: "3", label: "ATS 3", timeframe: "30 min", description: "Urgent" },
  { code: "4", label: "ATS 4", timeframe: "60 min", description: "Semi-urgent" },
  { code: "5", label: "ATS 5", timeframe: "120 min", description: "Non-urgent" },
];

type StatutoryLegalStatus = "Voluntary" | "Form 1A" | "Form 3B" | "Form 4A";

interface LegalOption {
  code: StatutoryLegalStatus;
  title: string;
  subtitle: string;
}

/**
 * Owner Rule D5: No computed legal time limits; NO Mental Health Act section numbers rendered!
 */
const LEGAL_STATUS_OPTIONS: readonly LegalOption[] = [
  { code: "Voluntary", title: "Voluntary", subtitle: "Voluntary inpatient status" },
  { code: "Form 1A", title: "Form 1A", subtitle: "Referral for examination by a psychiatrist" },
  { code: "Form 3B", title: "Form 3B", subtitle: "Detention order" },
  { code: "Form 4A", title: "Form 4A", subtitle: "Transport order" },
];

const INDIGENOUS_STATUS_OPTIONS = [
  { value: "not-stated", label: "Not stated / not recorded" },
  { value: "neither", label: "Neither Aboriginal nor Torres Strait Islander origin" },
  { value: "aboriginal", label: "Aboriginal but not Torres Strait Islander origin" },
  { value: "torres-strait", label: "Torres Strait Islander but not Aboriginal origin" },
  { value: "both", label: "Both Aboriginal and Torres Strait Islander origin" },
] as const;

const HEALTH_SERVICES = [
  { value: "", label: "Select health service..." },
  { value: "East Metro", label: "East Metropolitan Health Service (EMHS)" },
  { value: "North Metro", label: "North Metropolitan Health Service (NMHS)" },
  { value: "South Metro", label: "South Metropolitan Health Service (SMHS)" },
  { value: "WA Country", label: "WA Country Health Service (WACHS)" },
] as const;

const PRESENTING_FACILITIES = [
  { value: "", label: "Select presenting facility..." },
  { value: "rph-ed", label: "Royal Perth Hospital (RPH ED)" },
  { value: "scgh-ed", label: "Sir Charles Gairdner Hospital (SCGH ED)" },
  { value: "fsh-ed", label: "Fiona Stanley Hospital (FSH ED)" },
  { value: "arm-ed", label: "Armadale Health Service (ARM ED)" },
  { value: "sjgm-ed", label: "St John of God Midland (SJGM ED)" },
  { value: "rgh-ed", label: "Rockingham General Hospital (RGH ED)" },
  { value: "jhc-ed", label: "Joondalup Health Campus (JHC ED)" },
  { value: "peel-ed", label: "Peel Health Campus (PEEL ED)" },
] as const;

const PRESENTING_COMPLAINTS = [
  { value: "assessment", label: "Provisional psychiatric assessment required" },
  { value: "psychosis", label: "Acute psychosis / reality distortion" },
  { value: "mood", label: "Severe mood disorder / major depressive crisis" },
  { value: "behavioral", label: "Behavioural disturbance / acute agitation" },
  { value: "safety", label: "Acute safety risk / self-harm presentation" },
  { value: "other", label: "Other acute mental health presentation" },
] as const;

export function AddPatientForm() {
  const { dispatch, patients, movements } = useWardFlow();
  const now = useWardFlowClock();
  const router = useRouter();

  const [handoff] = useState(() => takeHandedOffPatientQuery());
  const carriedSearch = handoff?.assignTo === "carried" ? handoff.text : "";
  const [assignedSearch, setAssignedSearch] = useState<string | null>(null);

  const [draft, setDraft] = useState<PatientDraft>(() =>
    initialDraft(handoff?.assignTo === "given-name" ? handoff.text : ""),
  );

  const [genderChoice, setGenderChoice] = useState<GenderChoice>(GENDER_NOT_RECORDED);
  const [indigenousStatus, setIndigenousStatus] = useState<string>("not-stated");
  const [address, setAddress] = useState<string>("");
  const [suburb, setSuburb] = useState<string>("");
  const [healthService, setHealthService] = useState<string>("");
  const [facility, setFacility] = useState<string>("");

  const [triageUrgency, setTriageUrgency] = useState<TriageLevel>("4");
  const [legalStatus, setLegalStatus] = useState<StatutoryLegalStatus>("Voluntary");
  const [presentingComplaint, setPresentingComplaint] = useState<string>("assessment");
  const [clinicalNotes, setClinicalNotes] = useState<string>("");

  const [lastRejection, setLastRejection] = useState<string | undefined>(undefined);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [d4Notice, setD4Notice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const resetDialogRef = useRef<HTMLDivElement | null>(null);
  useWardModalFocus(showResetConfirm, resetDialogRef, () => setShowResetConfirm(false));

  const isDirty = useMemo(() => {
    return (
      draft.umrn.trim().length > 0 ||
      draft.givenName.trim().length > 0 ||
      draft.familyName.trim().length > 0 ||
      draft.dateOfBirth.trim().length > 0 ||
      genderChoice !== GENDER_NOT_RECORDED ||
      address.trim().length > 0 ||
      suburb.trim().length > 0 ||
      healthService.trim().length > 0 ||
      facility.trim().length > 0 ||
      clinicalNotes.trim().length > 0
    );
  }, [draft, genderChoice, address, suburb, healthService, facility, clinicalNotes]);

  useEffect(() => {
    if (!isDirty || isSubmitting) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, isSubmitting]);

  const performReset = () => {
    setDraft(initialDraft());
    setGenderChoice(GENDER_NOT_RECORDED);
    setAddress("");
    setSuburb("");
    setClinicalNotes("");
    setShowResetConfirm(false);
  };

  const priorPatientsRef = useRef<typeof patients | undefined>(undefined);

  const answered = answeredDraft(draft);
  const outstanding = unansweredFieldNames(draft);

  const candidates = useMemo(() => duplicateCandidates(patients, draft), [patients, draft]);
  const nearMatches = candidates.nearSpelling;

  const hasCheckedAnything =
    draft.umrn.trim().length > 0 ||
    (draft.givenName.trim().length > 0 && draft.familyName.trim().length > 0) ||
    [draft.givenName, draft.familyName].some((term) => term.trim().length >= NEAR_MATCH_MINIMUM_TERM_LENGTH);

  const exactMatches = useMemo(() => {
    return [
      ...candidates.recordNumberCollision,
      ...candidates.sameNameSameBirthDate,
      ...candidates.sameNameBirthDateNotMatched,
    ].filter((patient, index, all) => all.findIndex((other) => other.id === patient.id) === index);
  }, [candidates]);

  const foundSomething = exactMatches.length > 0 || nearMatches.length > 0;

  useEffect(() => {
    const prior = priorPatientsRef.current;
    if (prior === undefined) return;
    if (patients.length <= prior.length) {
      setLastRejection("Patient could not be added. Check the identity details and existing records.");
      priorPatientsRef.current = undefined;
      setIsSubmitting(false);
      return;
    }
    const priorIds = new Set(prior.map((patient) => patient.id));
    const added = patients.filter((patient) => !priorIds.has(patient.id));
    if (added.length === 0) {
      setIsSubmitting(false);
      throw new Error("AddPatientForm: patients grew but no new id was found against the prior snapshot.");
    }
    priorPatientsRef.current = undefined;
    router.push(`/mockups/ward-flow/people/${added[0].id}`);
  }, [patients, router]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    if (!answered) {
      setAttemptedSubmit(true);
      return;
    }
    setIsSubmitting(true);
    setLastRejection(undefined);
    priorPatientsRef.current = patients;
    const suburbTrimmed = suburb.trim();
    dispatch({
      type: "ADD_PATIENT",
      role: "coordinator",
      now,
      umrn: answered.umrn,
      givenName: answered.givenName,
      familyName: answered.familyName,
      dateOfBirth: answered.dateOfBirth,
      ...(genderChoice === GENDER_NOT_RECORDED ? {} : { gender: genderChoice }),
      ...(suburbTrimmed.length === 0 ? {} : { suburb: suburbTrimmed }),
    });
  }

  function ignoreUnavailableActivation(event: MouseEvent<HTMLButtonElement>) {
    if (isSubmitting) {
      event.preventDefault();
      return;
    }
    if (answered) return;
    event.preventDefault();
    setAttemptedSubmit(true);
  }

  function handleUnconnected(featureName?: string) {
    setD4Notice("Not wired in this prototype.");
  }

  const activeBoardList = useMemo(() => {
    return patients.slice(0, 5);
  }, [patients]);

  return (
    <div
      className={styles.screen}
      data-testid="ward-add-patient-screen"
      data-ward-design="third-edition"
      data-ward-rebuilt-screen="add-patient"
    >
      <main id="main-content" className={styles.main}>
        {/* Navigation context and breadcrumb */}
        <nav className={styles.breadcrumb} aria-label="Breadcrumb navigation">
          <Link className={styles.backLink} href="/mockups/ward-flow/search">
            Back to patient search
          </Link>
        </nav>

        {/* Page header */}
        <header className={styles.pageHeader}>
          <div className={styles.titleRow}>
            <div className={styles.titleGroup}>
              <h1 className={styles.pageTitle} id="pageTitle">
                Add a patient
              </h1>
              <span className={styles.chipMark} title="Synthetic prototype">
                Synthetic prototype
              </span>
            </div>
            <div className={styles.headerActions}>
              <button
                type="button"
                className={styles.headerBtn}
                onClick={() => handleUnconnected("Save draft")}
                aria-label="Save draft"
              >
                Save draft
              </button>
              <button
                type="button"
                className={styles.headerBtn}
                onClick={() => handleUnconnected("Print intake")}
                aria-label="Print intake"
              >
                Print
              </button>
            </div>
          </div>
          <p className={styles.pageSubtitle}>
            Front-door patient intake for acute mental health bed coordination. Complete the multi-panel intake form and
            verify duplicate records.
          </p>
        </header>

        {/* Owner Rule D4 notification */}
        {d4Notice ? (
          <div className={styles.d4Alert} role="status" aria-live="polite" data-testid="ward-add-patient-d4-notice">
            <span>{d4Notice}</span>
            <button
              type="button"
              className={styles.d4Close}
              onClick={() => setD4Notice(null)}
              aria-label="Dismiss notice"
            >
              ×
            </button>
          </div>
        ) : null}

        <div className={styles.apWork}>
          {/* Main Intake Form Column */}
          <div className={styles.apMainCol}>
            <form className={styles.form} onSubmit={handleSubmit} data-testid="ward-add-patient-form">
              {/* Carried search section */}
              {carriedSearch && assignedSearch !== carriedSearch ? (
                <section
                  className={styles.carriedSearch}
                  aria-label="Search carried forward"
                  data-testid="ward-add-patient-carried-search"
                >
                  <h3>From your search</h3>
                  <p className={styles.carriedValue}>{carriedSearch}</p>
                  <p>Choose a field for this text, or enter the details below.</p>
                  <div className={styles.prefillActions}>
                    <button
                      type="button"
                      disabled={draft.givenName.trim() !== ""}
                      onClick={() => {
                        setDraft((current) =>
                          current.givenName.trim() ? current : { ...current, givenName: carriedSearch },
                        );
                        setAssignedSearch(carriedSearch);
                      }}
                    >
                      Use as given name
                    </button>
                    <button
                      type="button"
                      disabled={draft.umrn.trim() !== ""}
                      onClick={() => {
                        setDraft((current) => (current.umrn.trim() ? current : { ...current, umrn: carriedSearch }));
                        setAssignedSearch(carriedSearch);
                      }}
                    >
                      Use as record number
                    </button>
                  </div>
                  {draft.givenName.trim() || draft.umrn.trim() ? (
                    <p className={styles.carriedNote}>Fields already entered will not be replaced.</p>
                  ) : null}
                </section>
              ) : null}

              {/* ═══ Panel 1: Identity & Demographics ═══ */}
              <section className={`${styles.panelCard} ${styles.identityPanel}`} aria-labelledby="apIdH">
                <div className={styles.panelHead}>
                  <h2 className={styles.panelHeading} id="apIdH">
                    Identity &amp; Demographics
                  </h2>
                  <p className={styles.panelSubhead}>
                    Patient identity details. Adding the patient saves record number, name, date of birth, gender when
                    recorded, and suburb when entered.
                  </p>
                </div>
                <div className={styles.panelBody}>
                  <div className={styles.apGrid}>
                    <div className={styles.apField}>
                      <label className={styles.fieldLegend} htmlFor="ward-add-patient-umrn">
                        UMRN (Unit Medical Record Number)
                        <span className={styles.requiredMarker} aria-hidden="true">
                          Required
                        </span>
                      </label>
                      <input
                        id="ward-add-patient-umrn"
                        data-testid="ward-add-patient-umrn"
                        className={styles.input}
                        type="text"
                        aria-label="UMRN (Unit Medical Record Number)"
                        aria-required="true"
                        autoComplete="off"
                        placeholder="e.g. UM100042"
                        value={draft.umrn}
                        onChange={(event) => setDraft((current) => ({ ...current, umrn: event.target.value }))}
                      />
                    </div>

                    <div className={styles.apField}>
                      <label className={styles.fieldLegend} htmlFor="ward-add-patient-date-of-birth">
                        Date of birth
                        <span className={styles.requiredMarker} aria-hidden="true">
                          Required
                        </span>
                      </label>
                      <input
                        id="ward-add-patient-date-of-birth"
                        data-testid="ward-add-patient-date-of-birth"
                        className={styles.input}
                        type="date"
                        aria-label="Date of birth"
                        aria-required="true"
                        value={draft.dateOfBirth}
                        onChange={(event) => setDraft((current) => ({ ...current, dateOfBirth: event.target.value }))}
                      />
                    </div>

                    <div className={styles.apField}>
                      <label className={styles.fieldLegend} htmlFor="ward-add-patient-given-name">
                        Given name
                        <span className={styles.requiredMarker} aria-hidden="true">
                          Required
                        </span>
                      </label>
                      <input
                        id="ward-add-patient-given-name"
                        data-testid="ward-add-patient-given-name"
                        className={styles.input}
                        type="text"
                        aria-label="Given name"
                        aria-required="true"
                        autoComplete="off"
                        placeholder="Given name"
                        value={draft.givenName}
                        onChange={(event) => setDraft((current) => ({ ...current, givenName: event.target.value }))}
                      />
                    </div>

                    <div className={styles.apField}>
                      <label className={styles.fieldLegend} htmlFor="ward-add-patient-family-name">
                        Family name
                        <span className={styles.requiredMarker} aria-hidden="true">
                          Required
                        </span>
                      </label>
                      <input
                        id="ward-add-patient-family-name"
                        data-testid="ward-add-patient-family-name"
                        className={styles.input}
                        type="text"
                        aria-label="Family name"
                        aria-required="true"
                        autoComplete="off"
                        placeholder="Family name"
                        value={draft.familyName}
                        onChange={(event) => setDraft((current) => ({ ...current, familyName: event.target.value }))}
                      />
                    </div>

                    {/* Gender Identity Control */}
                    <div className={`${styles.apField} ${styles.apSpan2} ${styles.genderField}`}>
                      <label className={styles.fieldLegend} htmlFor="ward-add-patient-gender" id="apGenderL">
                        Gender
                        <span className={styles.optionalMarker}>Optional · bed placement matching</span>
                      </label>
                      <div className={styles.genderControlGroup}>
                        <div
                          className={styles.segmentedGroup}
                          role="group"
                          aria-labelledby="apGenderL"
                          data-testid="ward-add-patient-gender-buttons"
                        >
                          <button
                            type="button"
                            className={styles.segBtn}
                            aria-pressed={genderChoice === "Female"}
                            onClick={() => setGenderChoice("Female")}
                          >
                            Female
                          </button>
                          <button
                            type="button"
                            className={styles.segBtn}
                            aria-pressed={genderChoice === "Male"}
                            onClick={() => setGenderChoice("Male")}
                          >
                            Male
                          </button>
                          <button
                            type="button"
                            className={styles.segBtn}
                            aria-pressed={genderChoice === GENDER_NOT_RECORDED}
                            onClick={() => setGenderChoice(GENDER_NOT_RECORDED)}
                          >
                            Not yet recorded
                          </button>
                        </div>
                        {/* Synced select for standard select readers & test suites */}
                        <select
                          id="ward-add-patient-gender"
                          data-testid="ward-add-patient-gender"
                          className={styles.select}
                          aria-label="Gender"
                          value={genderChoice}
                          onChange={(event) => setGenderChoice(event.target.value as GenderChoice)}
                        >
                          <option value={GENDER_NOT_RECORDED}>Not yet recorded</option>
                          {GENDERS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                      <p className={styles.fieldNote}>Optional. Leave unrecorded unless known.</p>
                    </div>

                    {/* Indigenous status */}
                    <div className={styles.apField}>
                      <label className={styles.fieldLegend} htmlFor="ward-add-patient-indigenous">
                        Indigenous status
                      </label>
                      <select
                        id="ward-add-patient-indigenous"
                        className={styles.select}
                        value={indigenousStatus}
                        onChange={(e) => setIndigenousStatus(e.target.value)}
                      >
                        {INDIGENOUS_STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <p className={styles.fieldNote}>
                        Not saved to the record.
                      </p>
                    </div>

                    {/* Address */}
                    <div className={styles.apField}>
                      <label className={styles.fieldLegend} htmlFor="ward-add-patient-address">
                        Address
                        <span className={styles.optionalMarker}>Optional</span>
                      </label>
                      <input
                        id="ward-add-patient-address"
                        className={styles.input}
                        type="text"
                        placeholder="Street address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                      />
                      <p className={styles.fieldNote}>
                        Not saved to the record.
                      </p>
                    </div>

                    {/* Suburb — optional; ADD_PATIENT stores Patient.suburb when provided. */}
                    <div className={styles.apField}>
                      <label className={styles.fieldLegend} htmlFor="ward-add-patient-suburb">
                        Suburb
                        <span className={styles.optionalMarker}>Optional · catchment lookup</span>
                      </label>
                      <input
                        id="ward-add-patient-suburb"
                        data-testid="ward-add-patient-suburb"
                        className={styles.input}
                        type="text"
                        placeholder="e.g. Armadale"
                        value={suburb}
                        onChange={(e) => setSuburb(e.target.value)}
                      />
                    </div>

                    {/* Presenting facility */}
                    <div className={styles.apField}>
                      <label className={styles.fieldLegend} htmlFor="ward-add-patient-facility">
                        Presenting facility
                      </label>
                      <select
                        id="ward-add-patient-facility"
                        className={styles.select}
                        value={facility}
                        onChange={(e) => setFacility(e.target.value)}
                      >
                        {PRESENTING_FACILITIES.map((fac) => (
                          <option key={fac.value} value={fac.value}>
                            {fac.label}
                          </option>
                        ))}
                      </select>
                      <p className={styles.fieldNote}>
                        Not saved to the record.
                      </p>
                    </div>

                    {/* Health service catchment */}
                    <div className={styles.apField}>
                      <label className={styles.fieldLegend} htmlFor="ward-add-patient-service">
                        Health service catchment
                      </label>
                      <select
                        id="ward-add-patient-service"
                        className={styles.select}
                        value={healthService}
                        onChange={(e) => setHealthService(e.target.value)}
                      >
                        {HEALTH_SERVICES.map((svc) => (
                          <option key={svc.value} value={svc.value}>
                            {svc.label}
                          </option>
                        ))}
                      </select>
                      <p className={styles.fieldNote}>
                        Not saved to the record.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section className={styles.demonstrationBoundary} aria-labelledby="apDemoH">
                <div>
                  <p className={styles.demonstrationEyebrow}>Demonstration fields</p>
                  <h2 id="apDemoH">Clinical details below are not saved</h2>
                </div>
                <p>
                  ATS category, legal status, presenting complaint and clinical notes are available to demonstrate the
                  intake layout. Adding the patient does not add these details to the patient record.
                </p>
              </section>

              {/* ═══ Panel 2: Triage Urgency (ATS 1 to ATS 5 selector pills) ═══ */}
              <section className={`${styles.panelCard} ${styles.triagePanel}`} aria-labelledby="apTriageH">
                <div className={styles.panelHead}>
                  <h2 className={styles.panelHeading} id="apTriageH">
                    Triage Urgency
                  </h2>
                  <p className={styles.panelSubhead}>
                    Australasian Triage Scale (ATS) category determining clinical acuity and bed placement priority.
                  </p>
                </div>
                <div className={styles.panelBody}>
                  <div className={styles.triagePillGroup} role="group" aria-label="Triage Urgency Category">
                    {TRIAGE_OPTIONS.map((opt) => {
                      const isSelected = triageUrgency === opt.code;
                      return (
                        <button
                          key={opt.code}
                          type="button"
                          className={styles.triagePill}
                          aria-pressed={isSelected}
                          data-triage={opt.code}
                          onClick={() => setTriageUrgency(opt.code)}
                          title={`${opt.label} · ${opt.description} (${opt.timeframe})`}
                        >
                          <span className={styles.triageCode}>{opt.label}</span>
                          <span className={styles.triageDesc}>{opt.description}</span>
                          <span className={styles.triageTime}>{opt.timeframe}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className={styles.fieldNote}>
                    Not wired in this prototype — the ATS category is not saved when you add the patient.
                  </p>
                </div>
              </section>

              {/* ═══ Panel 3: Legal status buttons (Voluntary, Form 1A, Form 3B, Form 4A - never render section numbers!) ═══ */}
              <section className={`${styles.panelCard} ${styles.legalPanel}`} aria-labelledby="apLegalH">
                <div className={styles.panelHead}>
                  <h2 className={styles.panelHeading} id="apLegalH">
                    Legal status
                  </h2>
                  <p className={styles.panelSubhead}>
                    Current statutory detention and treatment authorization under Western Australia statutory forms.
                  </p>
                </div>
                <div className={styles.panelBody}>
                  <div className={styles.legalButtonGroup} role="group" aria-label="Legal status">
                    {LEGAL_STATUS_OPTIONS.map((opt) => {
                      const isSelected = legalStatus === opt.code;
                      return (
                        <button
                          key={opt.code}
                          type="button"
                          className={styles.legalBtn}
                          aria-pressed={isSelected}
                          data-legal={opt.code}
                          onClick={() => setLegalStatus(opt.code)}
                          title={`${opt.title} — ${opt.subtitle}`}
                        >
                          <span className={styles.legalBtnTitle}>{opt.title}</span>
                          <span className={styles.legalBtnSubtitle}>{opt.subtitle}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className={styles.fieldNote}>
                    Not wired in this prototype — the legal status is not saved when you add the patient.
                  </p>
                </div>
              </section>

              {/* ═══ Panel 4: Clinical Presenting Complaint & Notes ═══ */}
              <section className={`${styles.panelCard} ${styles.clinicalPanel}`} aria-labelledby="apClinicalH">
                <div className={styles.panelHead}>
                  <h2 className={styles.panelHeading} id="apClinicalH">
                    Clinical Presenting Complaint &amp; Notes
                  </h2>
                  <p className={styles.panelSubhead}>
                    Initial psychiatric presentation summary and admission coordination notes.
                  </p>
                </div>
                <div className={styles.panelBody}>
                  <div className={styles.clinicalStack}>
                    <div className={styles.apField}>
                      <label className={styles.fieldLegend} htmlFor="ward-add-patient-complaint">
                        Presenting complaint / reason for admission
                      </label>
                      <select
                        id="ward-add-patient-complaint"
                        className={styles.select}
                        value={presentingComplaint}
                        onChange={(e) => setPresentingComplaint(e.target.value)}
                      >
                        {PRESENTING_COMPLAINTS.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.apField}>
                      <label className={styles.fieldLegend} htmlFor="ward-add-patient-notes">
                        Clinical intake notes
                      </label>
                      <textarea
                        id="ward-add-patient-notes"
                        className={styles.textarea}
                        rows={3}
                        placeholder="Enter clinical presentation, risk assessment notes, collateral information, or special nursing requirements..."
                        value={clinicalNotes}
                        onChange={(e) => setClinicalNotes(e.target.value)}
                      />
                    </div>
                  </div>
                  <p className={styles.fieldNote}>
                    Not wired in this prototype — the presenting complaint and clinical notes are not saved when you add
                    the patient.
                  </p>
                </div>
              </section>

              {/* Submission actions and notices */}
              {lastRejection ? (
                <p className={styles.rejection} data-testid="ward-add-patient-rejection" role="alert">
                  {lastRejection}
                </p>
              ) : null}

              <div className={styles.actionRow}>
                <button
                  type="submit"
                  className={styles.submit}
                  data-testid="ward-add-patient-submit"
                  disabled={isSubmitting}
                  aria-disabled={answered ? undefined : "true"}
                  aria-describedby={answered ? undefined : UNAVAILABLE_REASON_ID}
                  onClick={ignoreUnavailableActivation}
                >
                  {isSubmitting ? "Adding patient..." : "Add patient"}
                </button>
                <button
                  type="button"
                  className={styles.secondaryActionBtn}
                  data-testid="ward-add-patient-reset"
                  onClick={() => {
                    if (isDirty) {
                      setShowResetConfirm(true);
                    } else {
                      performReset();
                    }
                  }}
                >
                  Reset form
                </button>
              </div>

              {answered ? null : (
                <p
                  className={styles.unavailableReason}
                  id={UNAVAILABLE_REASON_ID}
                  data-testid="ward-add-patient-unavailable"
                  role={attemptedSubmit ? "alert" : undefined}
                >
                  Required: {outstanding.join(", ")}.
                </p>
              )}
            </form>
          </div>

          {/* Side Column: Duplicate Check, What happens next, Already on the board, System reconciliation */}
          <aside className={styles.apSideCol} aria-label="Duplicate checking and board context">
            {/* ═══ Live Duplicate Detection Candidate Card Panel ═══ */}
            <section
              className={`${styles.duplicateNotice} ${styles.dupCandidatePanel}`}
              aria-label="Possible existing records"
              data-testid="ward-add-patient-duplicate-check"
            >
              <div className={styles.duplicateHead}>
                <h2 className={styles.infoHeading}>The duplicate check</h2>
                <span className={styles.duplicateScopeTag}>Active cross-service check</span>
              </div>
              <p className={styles.checkScope}>Duplicate check covers all {patients.length} patient records.</p>

              {!hasCheckedAnything ? (
                <p className={styles.duplicateIdle} data-testid="ward-add-patient-duplicate-unchecked">
                  Enter a record number or a name of at least {NEAR_MATCH_MINIMUM_TERM_LENGTH} letters to check for
                  duplicates.
                </p>
              ) : !foundSomething ? (
                <p className={styles.duplicateIdle} data-testid="ward-add-patient-duplicate-none">
                  No existing record matches this record number or name.
                </p>
              ) : (
                <div className={styles.duplicateResultsGroup}>
                  {candidates.recordNumberCollision.length > 0 ? (
                    <p className={styles.duplicateLead} data-testid="ward-add-patient-duplicate-umrn">
                      {draft.umrn.trim()} already belongs to{" "}
                      {candidates.recordNumberCollision
                        .map((patient) => `${patient.givenName} ${patient.familyName} (born ${patient.dateOfBirth})`)
                        .join(", ")}
                      .
                    </p>
                  ) : null}

                  {candidates.sameNameSameBirthDate.length > 0 ? (
                    <p className={styles.duplicateLead} data-testid="ward-add-patient-duplicate-same-name-same-dob">
                      Already in this system with the same name AND the same date of birth — almost certainly the same
                      person.
                    </p>
                  ) : null}

                  {candidates.sameNameBirthDateNotMatched.length > 0 ? (
                    <p className={styles.duplicateLead} data-testid="ward-add-patient-duplicate-same-name">
                      Already in this system with the same name. The date of birth does not confirm it either way — open
                      the record and check.
                    </p>
                  ) : null}

                  {/* Candidate cards, each labelled with why it matched (strictly no button tags per test
                      line 376). The labels used to carry percentages (100%, 98%, 85%, 72%) that nothing
                      computed, which overclaimed how sure the check is (25 September 2026 audit, A8). The
                      reason alone is what the comparison actually found. */}
                  {exactMatches.length > 0 ? (
                    <ul className={styles.duplicateList}>
                      {exactMatches.map((candidate) => {
                        const isUmrnCol = candidates.recordNumberCollision.some((c) => c.id === candidate.id);
                        const isSameDob = candidates.sameNameSameBirthDate.some((c) => c.id === candidate.id);
                        const matchLabel = isUmrnCol
                          ? "Record number collision"
                          : isSameDob
                            ? "Same name & DOB"
                            : "Same name";

                        return (
                          <li
                            key={candidate.id}
                            className={styles.duplicateCard}
                            data-testid={`ward-add-patient-duplicate-${candidate.id}`}
                          >
                            <div className={styles.cardHeaderRow}>
                              <strong className={styles.cardPatientName}>
                                {candidate.givenName} {candidate.familyName}
                              </strong>
                              <span className={styles.matchScorePill}>{matchLabel}</span>
                            </div>
                            <div className={styles.cardMetaRow}>
                              <span className={styles.metaPid}>{candidate.umrn}</span>
                              <span> · born </span>
                              <span className={styles.metaDob}>{candidate.dateOfBirth}</span>
                              {candidate.gender && <span> · {candidate.gender}</span>}
                              {candidate.suburb && <span> · {candidate.suburb}</span>}
                            </div>
                            <div className={styles.cardFootRow}>
                              <span className={styles.cardFootId}>ID: {candidate.id}</span>
                              <span className={styles.cardFootStatus}>Existing record</span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}

                  {nearMatches.length > 0 ? (
                    <p className={styles.duplicateLead} data-testid="ward-add-patient-duplicate-lead">
                      {nearMatches.length === 1
                        ? "A person already in this system has"
                        : "People already in this system have"}{" "}
                      {nearMatches.length === 1 ? "a name" : "names"} one keystroke from this one. Check whether this is
                      the same person before adding a second record.
                    </p>
                  ) : null}

                  {nearMatches.length > 0 ? (
                    <ul className={styles.duplicateList}>
                      {nearMatches.map((candidate) => (
                        <li
                          key={candidate.id}
                          className={styles.duplicateCard}
                          data-testid={`ward-add-patient-duplicate-${candidate.id}`}
                        >
                          <div className={styles.cardHeaderRow}>
                            <strong className={styles.cardPatientName}>
                              {candidate.givenName} {candidate.familyName}
                            </strong>
                            <span className={styles.matchScorePillNear}>Similar spelling</span>
                          </div>
                          <div className={styles.cardMetaRow}>
                            <span className={styles.metaPid}>{candidate.umrn}</span>
                            <span> · born </span>
                            <span className={styles.metaDob}>{candidate.dateOfBirth}</span>
                            {candidate.gender && <span> · {candidate.gender}</span>}
                            {candidate.suburb && <span> · {candidate.suburb}</span>}
                          </div>
                          <div className={styles.cardFootRow}>
                            <span className={styles.cardFootId}>ID: {candidate.id}</span>
                            <span className={styles.cardFootStatus}>1 keystroke difference</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )}
            </section>

            {/* ═══ What happens next ═══ */}
            <section className={`${styles.panelCard} ${styles.nextPanel}`} aria-labelledby="apNextH">
              <div className={styles.panelHead}>
                <h2 className={styles.panelHeading} id="apNextH">
                  What happens next
                </h2>
              </div>
              <div className={styles.panelBody}>
                <p className={styles.sideNote}>
                  Adding the patient establishes their identity record on the active coordination board. From their
                  patient profile, a referral to mental health, transport order, or acute bed request can be raised.
                </p>
              </div>
            </section>

            {/* ═══ Already on the board ═══ */}
            <section className={`${styles.panelCard} ${styles.boardPanel}`} aria-labelledby="apBoardH">
              <div className={styles.panelHead}>
                <div className={styles.panelTitleWithCount}>
                  <h2 className={styles.panelHeading} id="apBoardH">
                    Already on the board
                  </h2>
                  <span className={styles.boardCountBadge}>{movements.length} active</span>
                </div>
                <p className={styles.panelSubhead}>Recent admissions across health services.</p>
              </div>
              <div className={styles.panelBody}>
                <div className={styles.boardList}>
                  {activeBoardList.map((p) => (
                    <div key={p.id} className={styles.boardRow}>
                      <span className={styles.boardRowName}>
                        <b>
                          {p.familyName}, {p.givenName}
                        </b>
                        <span className={styles.boardRowLoc}> · {p.suburb || "WA"}</span>
                      </span>
                      <span className={styles.boardRowId}>{p.umrn}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ═══ System reconciliation ═══ */}
            <section className={`${styles.panelCard} ${styles.reconciliationPanel}`} aria-labelledby="apReconcileH">
              <div className={styles.panelHead}>
                <h2 className={styles.panelHeading} id="apReconcileH">
                  System reconciliation
                </h2>
              </div>
              <div className={styles.panelBody}>
                <p className={styles.sideNote}>
                  Reconciled across Western Australia: <b>{movements.length}</b> active movements. The duplicate check
                  cross-references all active records across all four health services.
                </p>
              </div>
            </section>
          </aside>
        </div>
        {showResetConfirm && (
          <div
            role="presentation"
            style={{
              position: "fixed",
              inset: 0,
              background: "var(--scrim, rgba(15, 23, 42, 0.45))",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              padding: "1rem",
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowResetConfirm(false);
            }}
          >
            <div
              ref={resetDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="reset-dialog-title"
              aria-describedby="reset-dialog-desc"
              style={{
                background: "var(--surface)",
                color: "var(--ink)",
                padding: "1.5rem",
                borderRadius: "var(--r1, 0.5rem)",
                maxWidth: "28rem",
                width: "92%",
                boxShadow: "var(--lift)",
                border: "1px solid var(--line-strong)",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
            >
              <h3 id="reset-dialog-title" style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>
                Reset patient form?
              </h3>
              <p id="reset-dialog-desc" style={{ margin: 0, fontSize: "0.95rem", color: "var(--ink-soft)", lineHeight: 1.5 }}>
                You have entered patient details or clinical notes. Resetting the form will clear all unsaved fields in this session.
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  className={styles.secondaryActionBtn}
                  data-testid="ward-add-patient-reset-cancel"
                  onClick={() => setShowResetConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.secondaryActionBtn}
                  data-testid="ward-add-patient-reset-confirm"
                  style={{ background: "var(--bad, #dc2626)", color: "#fff", borderColor: "transparent" }}
                  onClick={performReset}
                >
                  Reset form
                </button>
              </div>
            </div>
          </div>
        )}
        <WardPrototypeFooter
          testId="ward-add-patient-governance"
          note="Front-door patient intake · Not a medical device"
        />
      </main>
    </div>
  );
}
