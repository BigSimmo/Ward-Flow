"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from "react";
import {
  BusFront,
  ChevronLeft,
  FileText,
  History,
  Lock,
  Printer,
  ShieldCheck,
  Stethoscope,
  UserPlus,
  UserRound,
  UsersRound,
} from "lucide-react";

import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardFoot,
  CardHead,
  Field,
  Icon,
  Segmented,
  Select,
  Sheet,
  StatusGlyph,
  TextInput,
  Textarea,
  buttonClass,
  cx,
  type ChoiceItem,
} from "@/components/wf";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { duplicateCandidates, GENDERS, type Gender, type Patient } from "@/components/ward-management/ward-patients";
import { takeHandedOffPatientQuery } from "@/components/ward-management/search/patient-query-handoff";

import styles from "./add-patient.module.css";

/**
 * ADD A PATIENT (v6, AddPatient.png). No hero: a slim bar with the way back and the synthetic-record
 * marker, then the Identity card (saved to the record), the Clinical intake card (layout only, not
 * saved), and one foot with Reset and the single primary, Add patient. The right column carries the
 * live duplicate check, what can follow once the person exists, and the latest records.
 *
 * Owner Rule D4: an unconnected control says exactly "Not wired in this prototype."
 * Owner Rule D5: legal status shows form names only, never Mental Health Act section numbers, and
 * no legal time limit is computed here.
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

function answeredDraft(draft: PatientDraft): PatientDraft | undefined {
  const umrn = draft.umrn.trim();
  const givenName = draft.givenName.trim();
  const familyName = draft.familyName.trim();
  const dateOfBirth = draft.dateOfBirth.trim();
  if (umrn === "" || givenName === "" || familyName === "" || dateOfBirth === "") return undefined;
  return { umrn, givenName, familyName, dateOfBirth };
}

const UNAVAILABLE_REASON_ID = "ward-add-patient-unavailable-reason";
const NOT_WIRED = "Not wired in this prototype.";
const GENDER_NOT_RECORDED = "not-recorded" as const;
type GenderChoice = Gender | typeof GENDER_NOT_RECORDED;

const GENDER_ITEMS: ChoiceItem<GenderChoice>[] = [
  ...GENDERS.map((gender) => ({ id: gender, label: gender })),
  { id: GENDER_NOT_RECORDED, label: "Not recorded" },
];

const NEAR_MATCH_MINIMUM_TERM_LENGTH = 4;
const RECENT_RECORDS_SHOWN = 7;

type TriageLevel = "1" | "2" | "3" | "4" | "5";

/** Australasian Triage Scale: category and its published time to be seen. Layout only, not saved. */
const TRIAGE_OPTIONS: readonly { code: TriageLevel; seen: string }[] = [
  { code: "1", seen: "now" },
  { code: "2", seen: "10m" },
  { code: "3", seen: "30m" },
  { code: "4", seen: "1h" },
  { code: "5", seen: "2h" },
];

const TRIAGE_ITEMS: ChoiceItem<TriageLevel>[] = TRIAGE_OPTIONS.map((option) => ({
  id: option.code,
  label: (
    <>
      <span className={styles.srOnly}>ATS</span> {option.code}
      <span className={styles.segSub}>{option.seen}</span>
    </>
  ),
}));

type StatutoryLegalStatus = "Voluntary" | "Form 1A" | "Form 3B" | "Form 4A";

/** Form names only (D5): no Act section numbers and no computed limits. Layout only, not saved. */
const LEGAL_ITEMS: ChoiceItem<StatutoryLegalStatus>[] = [
  { id: "Voluntary", label: "Voluntary" },
  { id: "Form 1A", label: "Form 1A" },
  { id: "Form 3B", label: "Form 3B" },
  { id: "Form 4A", label: "Form 4A" },
];

const INDIGENOUS_STATUS_OPTIONS = [
  { value: "not-stated", label: "Not stated" },
  { value: "neither", label: "Neither Aboriginal nor Torres Strait Islander origin" },
  { value: "aboriginal", label: "Aboriginal but not Torres Strait Islander origin" },
  { value: "torres-strait", label: "Torres Strait Islander but not Aboriginal origin" },
  { value: "both", label: "Both Aboriginal and Torres Strait Islander origin" },
] as const;

const HEALTH_SERVICES = [
  { value: "", label: "Select health service" },
  { value: "East Metro", label: "East Metropolitan (EMHS)" },
  { value: "North Metro", label: "North Metropolitan (NMHS)" },
  { value: "South Metro", label: "South Metropolitan (SMHS)" },
  { value: "WA Country", label: "WA Country (WACHS)" },
] as const;

const PRESENTING_FACILITIES = [
  { value: "", label: "Select presenting facility" },
  { value: "rph-ed", label: "Royal Perth ED" },
  { value: "scgh-ed", label: "Sir Charles Gairdner ED" },
  { value: "fsh-ed", label: "Fiona Stanley ED" },
  { value: "arm-ed", label: "Armadale ED" },
  { value: "sjgm-ed", label: "St John of God Midland ED" },
  { value: "rgh-ed", label: "Rockingham General ED" },
  { value: "jhc-ed", label: "Joondalup ED" },
  { value: "peel-ed", label: "Peel ED" },
] as const;

const PRESENTING_COMPLAINTS = [
  { value: "assessment", label: "Psychiatric assessment required" },
  { value: "psychosis", label: "Acute psychosis" },
  { value: "mood", label: "Severe mood disorder" },
  { value: "behavioral", label: "Behavioural disturbance" },
  { value: "safety", label: "Acute safety risk or self-harm" },
  { value: "other", label: "Other acute presentation" },
] as const;

type MatchKind = "record-number" | "same-name-same-dob" | "same-name" | "near";

const MATCH_LABEL: Record<MatchKind, string> = {
  "record-number": "Record number collision",
  "same-name-same-dob": "Same name & DOB",
  "same-name": "Same name",
  near: "Similar spelling",
};

export function AddPatientForm() {
  const { dispatch, patients, rejections } = useWardFlow();
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
  const priorSubmissionRef = useRef<{ patients: typeof patients; rejectionCount: number } | null>(null);

  const identityChanged =
    draft.umrn.trim().length > 0 ||
    draft.givenName.trim().length > 0 ||
    draft.familyName.trim().length > 0 ||
    draft.dateOfBirth.trim().length > 0 ||
    genderChoice !== GENDER_NOT_RECORDED ||
    indigenousStatus !== "not-stated";
  const placeChanged =
    address.trim().length > 0 ||
    suburb.trim().length > 0 ||
    healthService.trim().length > 0 ||
    facility.trim().length > 0;
  const intakeChanged =
    triageUrgency !== "4" ||
    legalStatus !== "Voluntary" ||
    presentingComplaint !== "assessment" ||
    clinicalNotes.trim().length > 0;
  const isDirty = identityChanged || placeChanged || intakeChanged;

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
    setIndigenousStatus("not-stated");
    setAddress("");
    setSuburb("");
    setHealthService("");
    setFacility("");
    setTriageUrgency("4");
    setLegalStatus("Voluntary");
    setPresentingComplaint("assessment");
    setClinicalNotes("");
    setAssignedSearch(null);
    setAttemptedSubmit(false);
    setLastRejection(undefined);
    setD4Notice(null);
    setIsSubmitting(false);
    priorSubmissionRef.current = null;
    setShowResetConfirm(false);
  };

  const answered = answeredDraft(draft);
  const outstanding = unansweredFieldNames(draft);
  const answeredCount = REQUIRED_FIELDS.length - outstanding.length;

  const candidates = useMemo(() => duplicateCandidates(patients, draft), [patients, draft]);

  const hasCheckedAnything =
    draft.umrn.trim().length > 0 ||
    (draft.givenName.trim().length > 0 && draft.familyName.trim().length > 0) ||
    [draft.givenName, draft.familyName].some((term) => term.trim().length >= NEAR_MATCH_MINIMUM_TERM_LENGTH);

  /** Every candidate once, strongest reason first: the exact tiers, then near spellings. */
  const matches = useMemo(() => {
    const out: { patient: Patient; kind: MatchKind }[] = [];
    const add = (list: readonly Patient[], kind: MatchKind) => {
      for (const patient of list) {
        if (!out.some((entry) => entry.patient.id === patient.id)) out.push({ patient, kind });
      }
    };
    add(candidates.recordNumberCollision, "record-number");
    add(candidates.sameNameSameBirthDate, "same-name-same-dob");
    add(candidates.sameNameBirthDateNotMatched, "same-name");
    add(candidates.nearSpelling, "near");
    return out;
  }, [candidates]);
  const nearMatches = candidates.nearSpelling;
  const foundSomething = matches.length > 0;

  const recentRecords = useMemo(() => patients.slice(-RECENT_RECORDS_SHOWN).reverse(), [patients]);

  useEffect(() => {
    const prior = priorSubmissionRef.current;
    if (!prior) return;
    if (patients.length <= prior.patients.length) {
      if (rejections.length > prior.rejectionCount && rejections[0]?.attempted === "ADD_PATIENT") {
        setLastRejection("Patient could not be added. Check the identity details and existing records.");
        priorSubmissionRef.current = null;
        setIsSubmitting(false);
      }
      return;
    }
    const priorIds = new Set(prior.patients.map((patient) => patient.id));
    const added = patients.filter((patient) => !priorIds.has(patient.id));
    if (added.length === 0) {
      setIsSubmitting(false);
      throw new Error("AddPatientForm: patients grew but no new id was found against the prior snapshot.");
    }
    priorSubmissionRef.current = null;
    router.push(`/mockups/ward-flow/people/${added[0].id}`);
  }, [patients, rejections, router]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    if (!answered) {
      setAttemptedSubmit(true);
      return;
    }
    setIsSubmitting(true);
    setLastRejection(undefined);
    priorSubmissionRef.current = { patients, rejectionCount: rejections.length };
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

  const setDraftField = (key: keyof PatientDraft) => (value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const resetSummary = [
    { key: "identity", on: identityChanged, label: "Identity", meta: "Number, names, birth date, gender" },
    { key: "place", on: placeChanged, label: "Address and facility", meta: "Address, suburb, service" },
    { key: "intake", on: intakeChanged, label: "Clinical intake", meta: "ATS, legal status, notes" },
  ];

  return (
    <div
      className={styles.screen}
      data-testid="ward-add-patient-screen"
      data-ward-design="v6"
      data-ward-rebuilt-screen="add-patient"
    >
      <main id="main-content" className={styles.main}>
        <h1 className={styles.srOnly} id="pageTitle">
          Add a patient
        </h1>

        <Card className={styles.topBar}>
          <nav className={styles.topLead} aria-label="Breadcrumb navigation">
            <Link
              className={buttonClass({ variant: "ghost", size: "sm", className: styles.backLink })}
              href="/mockups/ward-flow/search"
              aria-label="Back to patient search"
            >
              <Icon icon={ChevronLeft} size={14} />
              Patient search
            </Link>
          </nav>
          <span className={styles.topMarker}>
            <Icon icon={ShieldCheck} size={14} />
            Synthetic records only
          </span>
          <span className={styles.topActions}>
            {d4Notice ? (
              <span className={styles.d4Notice} role="status" data-testid="ward-add-patient-d4-notice">
                {d4Notice}
              </span>
            ) : null}
            <Button variant="ghost" size="sm" icon={Printer} onClick={() => setD4Notice(NOT_WIRED)}>
              Print
            </Button>
            <Button size="sm" onClick={() => setD4Notice(NOT_WIRED)}>
              Save draft
            </Button>
          </span>
        </Card>

        <div className={styles.layout}>
          <form className={styles.form} onSubmit={handleSubmit} data-testid="ward-add-patient-form">
            {carriedSearch && assignedSearch !== carriedSearch ? (
              <Card
                variant="compact"
                className={styles.carried}
                aria-label="Search carried forward"
                data-testid="ward-add-patient-carried-search"
              >
                <div className={styles.carriedText}>
                  <span className={styles.carriedLabel}>From your search</span>
                  <span className={styles.carriedValue}>{carriedSearch}</span>
                  {draft.givenName.trim() || draft.umrn.trim() ? (
                    <span className={styles.muted}>Fields already entered will not be replaced.</span>
                  ) : null}
                </div>
                <div className={styles.carriedActions}>
                  <Button
                    size="sm"
                    disabled={draft.givenName.trim() !== ""}
                    onClick={() => {
                      setDraft((current) =>
                        current.givenName.trim() ? current : { ...current, givenName: carriedSearch },
                      );
                      setAssignedSearch(carriedSearch);
                    }}
                  >
                    Use as given name
                  </Button>
                  <Button
                    size="sm"
                    disabled={draft.umrn.trim() !== ""}
                    onClick={() => {
                      setDraft((current) => (current.umrn.trim() ? current : { ...current, umrn: carriedSearch }));
                      setAssignedSearch(carriedSearch);
                    }}
                  >
                    Use as record number
                  </Button>
                </div>
              </Card>
            ) : null}

            <Card aria-labelledby="apIdH">
              <CardHead
                id="apIdH"
                icon={UserRound}
                title="Identity"
                aside={
                  <Badge size="sm" tone={answered ? "success" : "neutral"}>
                    {answeredCount} of {REQUIRED_FIELDS.length} required
                  </Badge>
                }
                action={<span className={styles.muted}>Saved to the record</span>}
              />
              <CardBody className={styles.grid}>
                <Field label={<Required>UMRN</Required>} id="ward-add-patient-umrn">
                  <TextInput
                    data-testid="ward-add-patient-umrn"
                    aria-label="UMRN (Unit Medical Record Number)"
                    aria-required="true"
                    autoComplete="off"
                    placeholder="UM100042"
                    className={styles.mono}
                    value={draft.umrn}
                    onChange={(event) => setDraftField("umrn")(event.target.value)}
                  />
                </Field>
                <Field label={<Required>Date of birth</Required>} id="ward-add-patient-date-of-birth">
                  <TextInput
                    data-testid="ward-add-patient-date-of-birth"
                    type="date"
                    aria-required="true"
                    className={styles.mono}
                    value={draft.dateOfBirth}
                    onChange={(event) => setDraftField("dateOfBirth")(event.target.value)}
                  />
                </Field>
                <Field label={<Required>Given name</Required>} id="ward-add-patient-given-name">
                  <TextInput
                    data-testid="ward-add-patient-given-name"
                    aria-required="true"
                    autoComplete="off"
                    value={draft.givenName}
                    onChange={(event) => setDraftField("givenName")(event.target.value)}
                  />
                </Field>
                <Field label={<Required>Family name</Required>} id="ward-add-patient-family-name">
                  <TextInput
                    data-testid="ward-add-patient-family-name"
                    aria-required="true"
                    autoComplete="off"
                    value={draft.familyName}
                    onChange={(event) => setDraftField("familyName")(event.target.value)}
                  />
                </Field>

                <div className={cx(styles.span2, styles.choiceField)}>
                  <div className={styles.choiceLabelRow}>
                    <span className={styles.choiceLabel} id="apGenderL">
                      Gender
                    </span>
                    <span className={styles.choiceHint}>optional, bed matching</span>
                  </div>
                  <div data-testid="ward-add-patient-gender">
                    <Segmented
                      label="Gender"
                      items={GENDER_ITEMS}
                      value={genderChoice}
                      onChange={setGenderChoice}
                      className={styles.segmented}
                    />
                  </div>
                </div>
                <Field
                  label="Aboriginal or Torres Strait Islander"
                  hint="not saved"
                  id="ward-add-patient-indigenous"
                  className={styles.span2}
                >
                  <Select value={indigenousStatus} onChange={(e) => setIndigenousStatus(e.target.value)}>
                    {INDIGENOUS_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Address" hint="not saved" id="ward-add-patient-address" className={styles.span2}>
                  <TextInput value={address} onChange={(e) => setAddress(e.target.value)} />
                </Field>
                <Field label="Suburb" hint="optional" id="ward-add-patient-suburb" className={styles.span2}>
                  <TextInput
                    data-testid="ward-add-patient-suburb"
                    value={suburb}
                    onChange={(e) => setSuburb(e.target.value)}
                  />
                </Field>

                <Field
                  label="Presenting facility"
                  hint="not saved"
                  id="ward-add-patient-facility"
                  className={styles.span2}
                >
                  <Select value={facility} onChange={(e) => setFacility(e.target.value)}>
                    {PRESENTING_FACILITIES.map((fac) => (
                      <option key={fac.value} value={fac.value}>
                        {fac.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Health service" hint="not saved" id="ward-add-patient-service" className={styles.span2}>
                  <Select value={healthService} onChange={(e) => setHealthService(e.target.value)}>
                    {HEALTH_SERVICES.map((svc) => (
                      <option key={svc.value} value={svc.value}>
                        {svc.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </CardBody>
            </Card>

            <Card aria-labelledby="apIntakeH">
              <CardHead
                id="apIntakeH"
                icon={Stethoscope}
                title="Clinical intake"
                aside={
                  <Badge size="sm" tone="neutral">
                    Not saved
                  </Badge>
                }
                action={<span className={styles.muted}>Shows the layout only</span>}
              />
              <CardBody className={styles.intakeGrid}>
                <div className={styles.choiceField}>
                  <div className={styles.choiceLabelRow}>
                    <span className={styles.choiceLabel}>Triage category</span>
                    <span className={styles.choiceHint}>ATS</span>
                  </div>
                  <Segmented
                    label="Triage category"
                    items={TRIAGE_ITEMS}
                    value={triageUrgency}
                    onChange={setTriageUrgency}
                    className={styles.segmented}
                  />
                </div>
                <div className={styles.choiceField}>
                  <div className={styles.choiceLabelRow}>
                    <span className={styles.choiceLabel}>Legal status</span>
                  </div>
                  <Segmented
                    label="Legal status"
                    items={LEGAL_ITEMS}
                    value={legalStatus}
                    onChange={setLegalStatus}
                    className={styles.segmented}
                  />
                </div>
                <Field label="Presenting complaint" id="ward-add-patient-complaint">
                  <Select value={presentingComplaint} onChange={(e) => setPresentingComplaint(e.target.value)}>
                    {PRESENTING_COMPLAINTS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Clinical intake notes" id="ward-add-patient-notes">
                  <Textarea
                    rows={1}
                    maxLength={500}
                    placeholder="Short note for the receiving team"
                    value={clinicalNotes}
                    onChange={(e) => setClinicalNotes(e.target.value)}
                    data-gramm="false"
                    data-enable-grammarly="false"
                    spellCheck={false}
                    autoComplete="off"
                  />
                </Field>
              </CardBody>
            </Card>

            <Card className={styles.submitBar}>
              <div className={styles.submitLead}>
                {lastRejection ? (
                  <p className={styles.rejection} data-testid="ward-add-patient-rejection" role="alert">
                    <StatusGlyph tone="danger" size={9} />
                    {lastRejection}
                  </p>
                ) : null}
                {answered ? null : (
                  <p
                    className={styles.unavailable}
                    id={UNAVAILABLE_REASON_ID}
                    data-testid="ward-add-patient-unavailable"
                    role={attemptedSubmit ? "alert" : undefined}
                  >
                    <Icon icon={Lock} size={14} />
                    <span>Required: {outstanding.join(", ")}.</span>
                  </p>
                )}
              </div>
              <div className={styles.submitActions}>
                <Button
                  variant="ghost"
                  data-testid="ward-add-patient-reset"
                  onClick={() => {
                    if (isDirty) setShowResetConfirm(true);
                    else performReset();
                  }}
                >
                  Reset
                </Button>
                <Button
                  type="submit"
                  variant="pri"
                  icon={UserPlus}
                  className={answered && !isSubmitting ? undefined : styles.submitOff}
                  data-testid="ward-add-patient-submit"
                  aria-disabled={answered && !isSubmitting ? undefined : "true"}
                  aria-describedby={answered ? undefined : UNAVAILABLE_REASON_ID}
                  onClick={ignoreUnavailableActivation}
                >
                  {isSubmitting ? "Adding patient..." : "Add patient"}
                </Button>
              </div>
            </Card>
          </form>

          <aside className={styles.side} aria-label="Duplicate checking and records">
            <Card aria-label="Possible existing records" data-testid="ward-add-patient-duplicate-check">
              <CardHead
                icon={UsersRound}
                title="Duplicate check"
                aside={
                  foundSomething ? (
                    <Badge size="sm" tone="warning">
                      {matches.length} to check
                    </Badge>
                  ) : null
                }
              />
              <CardBody flush>
                {!hasCheckedAnything ? (
                  <p className={styles.dupState} data-testid="ward-add-patient-duplicate-unchecked">
                    Enter a record number or a name of at least {NEAR_MATCH_MINIMUM_TERM_LENGTH} letters to check for
                    duplicates.
                  </p>
                ) : !foundSomething ? (
                  <p className={styles.dupState} data-testid="ward-add-patient-duplicate-none">
                    <StatusGlyph tone="success" size={9} />
                    No existing record matches this record number or name.
                  </p>
                ) : (
                  <>
                    <div className={styles.dupLeads}>
                      {candidates.recordNumberCollision.length > 0 ? (
                        <p className={styles.dupLead} data-testid="ward-add-patient-duplicate-umrn">
                          {draft.umrn.trim()} already belongs to{" "}
                          {candidates.recordNumberCollision
                            .map(
                              (patient) => `${patient.givenName} ${patient.familyName} (born ${patient.dateOfBirth})`,
                            )
                            .join(", ")}
                          .
                        </p>
                      ) : null}
                      {candidates.sameNameSameBirthDate.length > 0 ? (
                        <p className={styles.dupLead} data-testid="ward-add-patient-duplicate-same-name-same-dob">
                          Already in this system with the same name AND the same date of birth — almost certainly the
                          same person.
                        </p>
                      ) : null}
                      {candidates.sameNameBirthDateNotMatched.length > 0 ? (
                        <p className={styles.dupLead} data-testid="ward-add-patient-duplicate-same-name">
                          Already in this system with the same name. The date of birth does not confirm it either way —
                          open the record and check.
                        </p>
                      ) : null}
                      {nearMatches.length > 0 ? (
                        <p className={styles.dupLead} data-testid="ward-add-patient-duplicate-lead">
                          {nearMatches.length === 1
                            ? "A person already in this system has"
                            : "People already in this system have"}{" "}
                          {nearMatches.length === 1 ? "a name" : "names"} one keystroke from this one. Check whether
                          this is the same person before adding a second record.
                        </p>
                      ) : null}
                    </div>
                    <ul className={styles.dupList}>
                      {matches.map(({ patient, kind }) => (
                        <li
                          key={patient.id}
                          className={styles.dupRow}
                          data-testid={`ward-add-patient-duplicate-${patient.id}`}
                        >
                          <Avatar name={`${patient.givenName} ${patient.familyName}`} decorative />
                          <div className={styles.dupMain}>
                            <span className={styles.dupNameRow}>
                              <strong className={styles.dupName}>
                                {patient.givenName} {patient.familyName}
                              </strong>
                              <span className={styles.dupKind}>
                                <StatusGlyph tone={kind === "near" ? "neutral" : "warning"} size={9} />
                                {MATCH_LABEL[kind]}
                              </span>
                            </span>
                            <span className={styles.dupMeta}>
                              <span className={styles.mono}>{patient.umrn}</span>
                              <span> · born </span>
                              <span className={styles.mono}>{patient.dateOfBirth}</span>
                              {patient.gender ? <span> · {patient.gender}</span> : null}
                              {patient.suburb ? <span> · {patient.suburb}</span> : null}
                            </span>
                            <Link
                              className={buttonClass({ size: "sm", className: styles.dupOpen })}
                              href={`/mockups/ward-flow/people/${patient.id}`}
                            >
                              Use this record
                            </Link>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </CardBody>
              <CardFoot meta={`Duplicate check covers all ${patients.length} patient records.`} />
            </Card>

            <Card>
              <CardHead title="After adding" level={2} action={<span className={styles.muted}>Once added</span>} />
              <CardBody className={styles.afterRow}>
                <Button size="sm" icon={FileText} disabledReason="Add the patient first" reasonDisplay="tooltip">
                  Raise referral
                </Button>
                <Button size="sm" icon={BusFront} disabledReason="Add the patient first" reasonDisplay="tooltip">
                  Book transport
                </Button>
              </CardBody>
            </Card>

            <Card>
              <CardHead
                icon={History}
                title="Recently added"
                aside={<span className={styles.countPill}>{patients.length}</span>}
                action={<span className={styles.muted}>records</span>}
              />
              <CardBody flush>
                <ul className={styles.recentList}>
                  {recentRecords.map((p) => (
                    <li key={p.id}>
                      <Link className={styles.recentRow} href={`/mockups/ward-flow/people/${p.id}`}>
                        <span className={styles.recentName}>
                          <b>
                            {p.familyName}, {p.givenName}
                          </b>
                          {p.suburb ? <span className={styles.muted}> {p.suburb}</span> : null}
                        </span>
                        <span className={styles.mono}>{p.umrn}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          </aside>
        </div>

        <Sheet
          open={showResetConfirm}
          onClose={() => setShowResetConfirm(false)}
          title="Reset patient form?"
          description={draft.umrn.trim() ? `Add patient · ${draft.umrn.trim()}` : "Add patient"}
          portal={false}
          testId="ward-add-patient-reset-dialog"
          footer={
            <div className={styles.sheetFoot}>
              <Button data-testid="ward-add-patient-reset-cancel" onClick={() => setShowResetConfirm(false)}>
                Cancel
              </Button>
              <Button variant="danger" data-testid="ward-add-patient-reset-confirm" onClick={performReset}>
                Reset form
              </Button>
            </div>
          }
        >
          <div className={styles.resetBody}>
            <p className={styles.resetLead}>
              You have entered patient details or clinical notes. Resetting clears every unsaved field in this session.
            </p>
            <h3 className={styles.resetHead}>What gets cleared</h3>
            <ul className={styles.resetList}>
              {resetSummary.map((row) => (
                <li key={row.key} className={styles.resetRow}>
                  <StatusGlyph tone={row.on ? "warning" : "closed"} size={9} />
                  <span className={styles.resetLabel}>{row.label}</span>
                  <span className={styles.muted}>{row.on ? row.meta : "Nothing entered"}</span>
                </li>
              ))}
            </ul>
            <p className={styles.resetNote}>
              <StatusGlyph tone="info" size={9} />
              Nothing has been added to Ward Flow yet. No record is deleted.
            </p>
          </div>
        </Sheet>
      </main>
    </div>
  );
}

/** Required field label. The asterisk is drawn by CSS so the label text stays the field name. */
function Required({ children }: { children: string }) {
  return <span className={styles.req}>{children}</span>;
}
