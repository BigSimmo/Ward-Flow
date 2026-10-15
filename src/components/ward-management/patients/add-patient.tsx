"use client";

import {
  BusFront,
  ChevronLeft,
  ChevronRight,
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
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type KeyboardEvent, type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { takeHandedOffPatientQuery } from "@/components/ward-management/search/patient-query-handoff";
import type { TentativeDiagnosisBlock } from "@/components/ward-management/ward-diagnosis";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { WARD_REFERRAL_INTAKE_HREF } from "@/components/ward-management/ward-nav";
import {
  duplicateCandidates,
  GENDERS,
  type Gender,
  type Patient,
  patientAddedOnDayOf,
} from "@/components/ward-management/ward-patients";
import {
  Avatar,
  Badge,
  Button,
  buttonClass,
  Card,
  CardBody,
  CardFoot,
  CardHead,
  type ChoiceItem,
  cx,
  Field,
  Frac,
  Hero,
  Icon,
  PhoneHero,
  PhoneListRow,
  PhoneSheet,
  Segmented,
  Select,
  Sheet,
  StatusGlyph,
  Textarea,
  TextInput,
  useIsPhone,
  useIsTabletPortrait,
  useOptionalToast,
} from "@/components/wf";
import { useDirtyStateGuard } from "../use-dirty-state-guard";

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

const REQUIRED_FIELDS: readonly {
  readonly key: keyof PatientDraft;
  readonly name: string;
}[] = [
  { key: "umrn", name: "Record number" },
  { key: "givenName", name: "Given name" },
  { key: "familyName", name: "Family name" },
  { key: "dateOfBirth", name: "Date of birth" },
];

function initialDraft(prefillGivenName = ""): PatientDraft {
  return {
    umrn: "",
    givenName: prefillGivenName,
    familyName: "",
    dateOfBirth: "",
  };
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
/** The phone's "On a larger screen" sheet: what the short phone form leaves out. */
const LARGER_SCREEN_ROWS: readonly (readonly [string, string])[] = [
  ["Gender, Aboriginal or Torres Strait Islander", "Optional · bed matching"],
  ["Address, suburb", "Address is not saved"],
  ["Presenting facility, health service", "Not saved in this prototype"],
  ["Clinical intake", "ATS, legal form, complaint, notes · layout only"],
  ["Duplicate check beside the form", "The phone runs the same check below the form"],
];
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
  {
    value: "neither",
    label: "Neither Aboriginal nor Torres Strait Islander origin",
  },
  {
    value: "aboriginal",
    label: "Aboriginal but not Torres Strait Islander origin",
  },
  {
    value: "torres-strait",
    label: "Torres Strait Islander but not Aboriginal origin",
  },
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

const FACILITY_TO_SITE_CODE: Record<string, string> = {
  "rph-ed": "RPH",
  "scgh-ed": "SCGH",
  "fsh-ed": "FSH",
  "arm-ed": "ARM",
  "sjgm-ed": "SJGM",
  "rgh-ed": "RGH",
  "jhc-ed": "JHC",
  "peel-ed": "PEEL",
};

// Only complaints that name a diagnosis block get one. A safety risk, behavioural disturbance, an
// assessment or "other" is not a diagnosis, so the referral's provisional diagnosis is left unset.
const COMPLAINT_TO_DIAGNOSIS_BLOCK: Partial<Record<string, TentativeDiagnosisBlock>> = {
  psychosis: "F20–F29",
  mood: "F30–F39",
};

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
  const toast = useOptionalToast();
  /*
   * v10 Add a patient, Phone. shell-7 (Josh, 13 Oct 2026): the short identity form and its
   * duplicate check show straight away; the "needs a larger screen" landing is gone. One quiet row
   * says address and intake are on a larger screen. Desktop never reads any of this.
   */
  const isPhone = useIsPhone();
  const isTabletPortrait = useIsTabletPortrait();
  const [phoneSheet, setPhoneSheet] = useState<"larger" | null>(null);
  const priorSubmissionRef = useRef<{
    patients: typeof patients;
    rejectionCount: number;
  } | null>(null);
  const submitIntentRef = useRef<"profile" | "refer">("profile");
  const [submitIntent, setSubmitIntent] = useState<"profile" | "refer">("profile");

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

  useDirtyStateGuard({
    isDirty: isDirty && !isSubmitting,
    confirmMessage: "You have unsaved changes to this new admission. Are you sure you want to leave?",
  });

  /** Everything Reset clears, so Undo can put every field back (v10 acceptance check). */
  const formSnapshot = () => ({
    draft,
    genderChoice,
    indigenousStatus,
    address,
    suburb,
    healthService,
    facility,
    triageUrgency,
    legalStatus,
    presentingComplaint,
    clinicalNotes,
  });
  const restoreSnapshot = (snap: ReturnType<typeof formSnapshot>) => {
    setDraft(snap.draft);
    setGenderChoice(snap.genderChoice);
    setIndigenousStatus(snap.indigenousStatus);
    setAddress(snap.address);
    setSuburb(snap.suburb);
    setHealthService(snap.healthService);
    setFacility(snap.facility);
    setTriageUrgency(snap.triageUrgency);
    setLegalStatus(snap.legalStatus);
    setPresentingComplaint(snap.presentingComplaint);
    setClinicalNotes(snap.clinicalNotes);
  };

  const performReset = () => {
    if (isDirty && toast) {
      const snap = formSnapshot();
      toast.push({
        tone: "info",
        title: "Form cleared",
        body: "Nothing was saved to the record.",
        undo: { durationMs: 8000, onUndo: () => restoreSnapshot(snap) },
      });
    }
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
    submitIntentRef.current = "profile";
    setSubmitIntent("profile");
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
  const addedToday = patients.filter((patient) => patientAddedOnDayOf(patient, now)).length;

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
    // shell-24 (13 Oct 2026): say the save worked. The toast outlives the page change.
    toast?.push({
      tone: "success",
      title: `${added[0].givenName} ${added[0].familyName} added, ${added[0].umrn}`,
    });
    if (submitIntentRef.current === "refer") {
      submitIntentRef.current = "profile";
      const params = new URLSearchParams();
      params.set("new", "1");
      params.set("patientId", added[0].id);
      const siteCode = FACILITY_TO_SITE_CODE[facility];
      if (siteCode) {
        params.set("site", siteCode);
        // The site is an emergency department, so the referral comes from that ED, not a community service.
        params.set("source", "ed");
      }
      if (healthService.trim()) params.set("service", healthService.trim());
      params.set("ats", triageUrgency);
      params.set("legal", legalStatus);
      const diagBlock = COMPLAINT_TO_DIAGNOSIS_BLOCK[presentingComplaint];
      if (diagBlock) params.set("complaint", diagBlock);
      router.push(`${WARD_REFERRAL_INTAKE_HREF}?${params.toString()}`);
      return;
    }
    router.push(`/mockups/ward-flow/people/${added[0].id}`);
  }, [patients, rejections, router, toast, facility, healthService, triageUrgency, legalStatus, presentingComplaint]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    if (!answered) {
      setAttemptedSubmit(true);
      return;
    }
    setIsSubmitting(true);
    setLastRejection(undefined);
    priorSubmissionRef.current = {
      patients,
      rejectionCount: rejections.length,
    };
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

  /**
   * Enter in a field is an implicit submit, and the browser answers it by clicking the FIRST submit
   * button in the form, which is "Register & start referral". Enter should do the plain, primary
   * thing (Add patient), so it is routed there. The two buttons stay the only way to start a referral.
   */
  function submitPlainOnEnter(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Enter" || event.defaultPrevented) return;
    if (!(event.target instanceof HTMLInputElement)) return;
    if (event.target.type === "button" || event.target.type === "submit") return;
    event.preventDefault();
    submitIntentRef.current = "profile";
    setSubmitIntent("profile");
    event.currentTarget.requestSubmit();
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
    {
      key: "identity",
      on: identityChanged,
      label: "Identity",
      meta: "Number, names, birth date, gender",
    },
    {
      key: "place",
      on: placeChanged,
      label: "Address and facility",
      meta: "Address, suburb, service",
    },
    {
      key: "intake",
      on: intakeChanged,
      label: "Clinical intake",
      meta: "ATS, legal status, notes",
    },
  ];

  const duplicateCheck = (
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
                    .map((patient) => `${patient.givenName} ${patient.familyName} (born ${patient.dateOfBirth})`)
                    .join(", ")}
                  .
                </p>
              ) : null}
              {candidates.sameNameSameBirthDate.length > 0 ? (
                <p className={styles.dupLead} data-testid="ward-add-patient-duplicate-same-name-same-dob">
                  Already in this system with the same name AND the same date of birth — almost certainly the same
                  person.
                </p>
              ) : null}
              {candidates.sameNameBirthDateNotMatched.length > 0 ? (
                <p className={styles.dupLead} data-testid="ward-add-patient-duplicate-same-name">
                  Already in this system with the same name. The date of birth does not confirm it either way — open the
                  record and check.
                </p>
              ) : null}
              {nearMatches.length > 0 ? (
                <p className={styles.dupLead} data-testid="ward-add-patient-duplicate-lead">
                  {nearMatches.length === 1
                    ? "A person already in this system has"
                    : "People already in this system have"}{" "}
                  {nearMatches.length === 1 ? "a name" : "names"} one keystroke from this one. Check whether this is the
                  same person before adding a second record.
                </p>
              ) : null}
            </div>
            <ul className={styles.dupList}>
              {matches.map(({ patient, kind }) => (
                <li key={patient.id} className={styles.dupRow} data-testid={`ward-add-patient-duplicate-${patient.id}`}>
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
                      className={buttonClass({
                        size: "sm",
                        className: styles.dupOpen,
                      })}
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
  );

  return (
    <div
      className={styles.screen}
      data-testid="ward-add-patient-screen"
      data-ward-design="v6"
      data-ward-rebuilt-screen="add-patient"
    >
      <main id="main-content" className={styles.main} data-phone-form={isPhone ? "true" : undefined}>
        {isPhone ? (
          <PhoneHero
            level={1}
            eyebrow="Patients"
            title="Add a patient"
            sub="Identity only · same duplicate check"
            data-testid="ward-add-patient-phone-hero"
            // Device audit 11 Oct 2026: the landing shows no figures (a "0/4 Required" for a form that is
            // not shown read as a result); the short form shows only its own required count.
            figures={[
              {
                id: "required",
                value: `${answeredCount}/${REQUIRED_FIELDS.length}`,
                label: "Required",
              },
            ]}
          />
        ) : null}
        <PhoneSheet
          open={phoneSheet !== null}
          onClose={() => setPhoneSheet(null)}
          title="On a larger screen"
          description="Kept off the phone so the form stays short"
          height="content"
          secondary={{ label: "Done", onAction: () => setPhoneSheet(null) }}
          data-testid="ward-add-patient-phone-sheet"
        >
          <ul className={styles.phList}>
            {LARGER_SCREEN_ROWS.map(([name, meta]) => (
              <PhoneListRow as="li" key={name} name={name} meta={meta} />
            ))}
          </ul>
        </PhoneSheet>
        {isPhone ? null : (
          <Hero
            level={1}
            className={styles.apHero}
            eyebrow="Patients · new record"
            title="Add a patient"
            titleMeta={
              <span className={styles.draftPill} data-testid="ward-add-patient-draft-pill">
                <StatusGlyph tone="neutral" size={9} />
                Draft
              </span>
            }
            aside={
              <span className={styles.heroActions}>
                {d4Notice ? (
                  <span className={styles.d4Notice} role="status" data-testid="ward-add-patient-d4-notice">
                    {d4Notice}
                  </span>
                ) : null}
                <Link
                  className={buttonClass({ variant: "onHero", size: "sm" })}
                  href="/mockups/ward-flow/search"
                  aria-label="Back to patient search"
                >
                  <Icon icon={ChevronLeft} size={14} />
                  Patient search
                </Link>
                <Button
                  variant="onHero"
                  size="sm"
                  icon={Printer}
                  className={styles.desktopOnly}
                  onClick={() => setD4Notice(NOT_WIRED)}
                >
                  Print
                </Button>
                <Button variant="light" size="sm" onClick={() => setD4Notice(NOT_WIRED)}>
                  Save draft
                </Button>
              </span>
            }
            bar={
              <div className={styles.heroBar}>
                <p className={styles.heroLine}>
                  <Icon icon={ShieldCheck} size={14} />
                  Identity is saved to the record. Check for an existing record before adding. Synthetic records only.
                </p>
                <div className={styles.heroChips} data-testid="ward-add-patient-hero-chips">
                  <span className={styles.heroChip}>
                    <Frac
                      done={answeredCount}
                      total={REQUIRED_FIELDS.length}
                      label="required fields"
                      tone={answeredCount === REQUIRED_FIELDS.length ? "success" : undefined}
                    />
                    <span aria-hidden="true">required fields</span>
                  </span>
                  {/* Before anything is typed these read as a result; the duplicate count waits for
                      input and the record count says what the check covers (device audit 11 Oct 2026). */}
                  {hasCheckedAnything ? (
                    <span className={styles.heroChip}>
                      <b>{matches.length}</b> possible {matches.length === 1 ? "duplicate" : "duplicates"}
                    </span>
                  ) : null}
                  <span className={styles.heroChip}>
                    Checks <b>{patients.length}</b> records
                  </span>
                  <span className={styles.heroChip} data-testid="ward-add-patient-added-today">
                    <b>{addedToday}</b> added today
                  </span>
                </div>
              </div>
            }
          />
        )}

        <div className={styles.layout}>
          <form
            className={styles.form}
            onSubmit={handleSubmit}
            onKeyDown={submitPlainOnEnter}
            data-testid="ward-add-patient-form"
          >
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
                className={styles.idHead}
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
                    autoCorrect="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    enterKeyHint="done"
                    placeholder="UMRN not recorded"
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
                    autoCorrect="off"
                    autoCapitalize="words"
                    spellCheck={false}
                    enterKeyHint="done"
                    value={draft.givenName}
                    onChange={(event) => setDraftField("givenName")(event.target.value)}
                  />
                </Field>
                <Field label={<Required>Family name</Required>} id="ward-add-patient-family-name">
                  <TextInput
                    data-testid="ward-add-patient-family-name"
                    aria-required="true"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="words"
                    spellCheck={false}
                    enterKeyHint="done"
                    value={draft.familyName}
                    onChange={(event) => setDraftField("familyName")(event.target.value)}
                  />
                </Field>

                <div className={cx(styles.spanAll, styles.choiceField, styles.phHide)}>
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
                  className={cx(styles.spanAll, styles.phHide)}
                >
                  <Select value={indigenousStatus} onChange={(e) => setIndigenousStatus(e.target.value)}>
                    {INDIGENOUS_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field
                  label="Address"
                  hint="not saved"
                  id="ward-add-patient-address"
                  className={cx(styles.span2, styles.phHide)}
                >
                  <TextInput value={address} onChange={(e) => setAddress(e.target.value)} />
                </Field>
                <Field
                  label="Suburb"
                  hint="optional"
                  id="ward-add-patient-suburb"
                  className={cx(styles.span2, styles.phHide)}
                >
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
                  className={cx(styles.span2, styles.phHide)}
                >
                  <Select value={facility} onChange={(e) => setFacility(e.target.value)}>
                    {PRESENTING_FACILITIES.map((fac) => (
                      <option key={fac.value} value={fac.value}>
                        {fac.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="Health service"
                  hint="not saved"
                  id="ward-add-patient-service"
                  className={cx(styles.span2, styles.phHide)}
                >
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

            {/* Tablet portrait: the duplicate check sits under Identity, where it is needed while
                typing, not under the Add patient footer (device audit 11 Oct 2026). */}
            {isTabletPortrait ? duplicateCheck : null}

            <Card aria-labelledby="apIntakeH" className={styles.phHide}>
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
                <p
                  className={cx(styles.spanAll, styles.intakeHandoffNote)}
                  data-testid="ward-add-patient-intake-handoff-note"
                >
                  Structured selections (presenting facility, health service, ATS category, legal status, presenting
                  complaint) carry forward into the Referral Drawer when you choose{" "}
                  <strong>Register &amp; start referral →</strong>. Clinical narrative is captured via the Referral
                  Drawer&apos;s structured intake checklist (Ruling D-18: no free-text storage on patient registration).
                </p>
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
                  variant="sec"
                  icon={FileText}
                  className={answered && !isSubmitting ? undefined : styles.submitOff}
                  data-testid="ward-add-patient-register-and-refer"
                  aria-disabled={answered && !isSubmitting ? undefined : "true"}
                  aria-describedby={answered ? undefined : UNAVAILABLE_REASON_ID}
                  onClick={(event) => {
                    submitIntentRef.current = "refer";
                    setSubmitIntent("refer");
                    ignoreUnavailableActivation(event);
                  }}
                >
                  {isSubmitting && submitIntent === "refer" ? "Starting referral..." : "Register & start referral →"}
                </Button>
                <Button
                  type="submit"
                  variant="pri"
                  icon={UserPlus}
                  className={answered && !isSubmitting ? undefined : styles.submitOff}
                  data-testid="ward-add-patient-submit"
                  aria-disabled={answered && !isSubmitting ? undefined : "true"}
                  aria-describedby={answered ? undefined : UNAVAILABLE_REASON_ID}
                  onClick={(event) => {
                    submitIntentRef.current = "profile";
                    setSubmitIntent("profile");
                    ignoreUnavailableActivation(event);
                  }}
                >
                  {isSubmitting ? "Adding patient..." : "Add patient"}
                </Button>
              </div>
            </Card>
          </form>

          <aside className={styles.side} aria-label="Duplicate checking and records">
            {isTabletPortrait ? null : duplicateCheck}

            <Card className={styles.phHide}>
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

            <Card className={styles.phHide}>
              <CardHead
                icon={History}
                title="Recently added"
                aside={<span className={styles.countPill}>{recentRecords.length}</span>}
                action={<span className={styles.muted}>recent</span>}
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
            {isPhone ? (
              <PhoneListRow
                className={styles.phCard}
                name="Address, facility and intake"
                meta="On a larger screen · intake is not saved"
                onSelect={() => setPhoneSheet("larger")}
                value={<Icon icon={ChevronRight} size={16} />}
              />
            ) : null}
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
