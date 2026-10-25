"use client";

import {
  ChevronLeft,
  ChevronRight,
  FileText,
  History,
  Lock,
  ShieldCheck,
  UserPlus,
  UserRound,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type KeyboardEvent, type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { takeHandedOffPatientQuery } from "@/components/ward-management/search/patient-query-handoff";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { patientRegistrationScope } from "@/components/ward-management/ward-patient-registration";
import { useRouteRole } from "@/components/ward-management/ward-role-gate";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { WARD_REFERRAL_INTAKE_HREF } from "@/components/ward-management/ward-nav";
import { edById } from "@/components/ward-management/ward-sites";
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
  LiveChip,
  PhoneHero,
  PhoneListRow,
  PhoneSheet,
  Segmented,
  Select,
  Sheet,
  StatusGlyph,
  TextInput,
  useIsPhone,
  useIsTabletPortrait,
  useOptionalToast,
} from "@/components/wf";
import { useDirtyStateGuard } from "../use-dirty-state-guard";

import styles from "./add-patient.module.css";
import { patientHref } from "@/components/ward-management/shell/ward-facade";
import { encodeRecordAddress } from "@/components/ward-management/shell/ward-record-address";
import { SHARED_REFRESH_MS } from "@/components/ward-management/ward-operational-defaults";

/**
 * ADD A PATIENT (v6, AddPatient.png). No hero: a slim bar with the way back and the synthetic-record
 * marker, then the Identity card only (D-77 change 6: address, facility and intake belong to the referral
 * or the movement, not the person), and one foot with Reset and the single primary, Add patient. The right
 * column carries the live duplicate check and the latest records. Adding opens the new patient's page.
 *
 * Owner Rule D4: an unconnected control says exactly "Not wired in this prototype." Print and Save
 * draft only ever said that, so they are hidden until they work (overall review, 20 Oct 2026).
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

/**
 * DA-12 (design audit, Josh, 19 Oct 2026): the required fields in the order they appear, with the
 * control each one marks and the line it shows after a submit with it still blank. The first blank
 * one takes focus.
 */
const REQUIRED_CONTROLS: readonly {
  readonly key: keyof PatientDraft;
  readonly id: string;
  readonly missing: string;
}[] = [
  { key: "umrn", id: "ward-add-patient-umrn", missing: "Enter the UMRN." },
  { key: "dateOfBirth", id: "ward-add-patient-date-of-birth", missing: "Enter the date of birth." },
  { key: "givenName", id: "ward-add-patient-given-name", missing: "Enter the given name." },
  { key: "familyName", id: "ward-add-patient-family-name", missing: "Enter the family name." },
];

/** The refusal for a record number that is already on file, naming the existing record's UMRN. */
function duplicateUmrnRefusal(umrn: string): string {
  return `Patient could not be added. UMRN ${umrn} already belongs to an existing record. Open that record instead of adding a second one.`;
}

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
/** The phone's "On a larger screen" sheet: what the short phone form leaves out. */
const LARGER_SCREEN_ROWS: readonly (readonly [string, string])[] = [
  ["Gender, Aboriginal or Torres Strait Islander", "Optional · bed matching"],
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

type MatchKind = "record-number" | "same-name-same-dob" | "same-name" | "near";

const MATCH_LABEL: Record<MatchKind, string> = {
  "record-number": "Record number collision",
  "same-name-same-dob": "Same name & DOB",
  "same-name": "Same name",
  near: "Similar spelling",
};

export function AddPatientForm() {
  const { patients, worldGeneration } = useWardFlowSelect("patients", "worldGeneration");
  const now = useWardFlowClock();
  const role = useRouteRole();
  const access = useEffectiveWardAccess();
  // A ward adds a patient in its own name, registered to its own ward (role access plan v2, D-80).
  const raise = useWardRaise(role);
  const registrationScope = patientRegistrationScope(access.scope);
  // Smart features idea 9 (19 Oct 2026): an ED desk presents at its own ED unless someone picks another.
  const deskEdId = access.scope.kind === "ed" ? access.scope.edId : undefined;
  // Read the site from the ED directory so every ED desk, KEMH and PCH included, carries its own ED.
  const deskEdSiteCode = deskEdId ? (edById(deskEdId)?.siteCode ?? "") : "";
  const registrationUnavailable =
    access.scope.kind === "ward" && !registrationScope
      ? "Open a referral from a single source ward before registering the patient."
      : undefined;
  const router = useRouter();

  const [handoff] = useState(() => takeHandedOffPatientQuery());
  const carriedSearch = handoff?.assignTo === "carried" ? handoff.text : "";
  const [assignedSearch, setAssignedSearch] = useState<string | null>(null);

  const [draft, setDraft] = useState<PatientDraft>(() =>
    initialDraft(handoff?.assignTo === "given-name" ? handoff.text : ""),
  );

  const [genderChoice, setGenderChoice] = useState<GenderChoice>(GENDER_NOT_RECORDED);
  const [indigenousStatus, setIndigenousStatus] = useState<string>("not-stated");

  const [lastRejection, setLastRejection] = useState<string | undefined>(undefined);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  /** The UMRN of an existing record a save was refused for, so the UMRN field can say so. */
  const [duplicateUmrn, setDuplicateUmrn] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const toast = useOptionalToast();
  /**
   * Audit 24-7 (CT-08): the "Form cleared" toast lives in the layout and outlives this form, but its
   * Undo can only refill this form. Once the form has gone the toast is closed, so no Undo is offered
   * that cannot work.
   */
  const resetToastRef = useRef<{ id: string; dismiss: (id: string) => void } | null>(null);
  useEffect(
    () => () => {
      const open = resetToastRef.current;
      resetToastRef.current = null;
      if (open) open.dismiss(open.id);
    },
    [],
  );
  /*
   * v10 Add a patient, Phone. shell-7 (Josh, 13 Oct 2026): the short identity form and its
   * duplicate check show straight away; the "needs a larger screen" landing is gone. One quiet row
   * says gender and Aboriginal status are on a larger screen. Desktop never reads any of this.
   */
  const isPhone = useIsPhone();
  const isTabletPortrait = useIsTabletPortrait();
  const [phoneSheet, setPhoneSheet] = useState<"larger" | null>(null);
  const priorSubmissionRef = useRef<{
    patients: typeof patients;
    umrn: string;
    /** Typed identity, echoed when an accepted shared save stays outside this desk's view. */
    givenName: string;
    familyName: string;
    /** The command went to the shared workspace (it settled asynchronously). */
    shared?: boolean;
    /** The form as submitted; edits made while waiting are kept when the save finishes. */
    form: ReturnType<typeof formSnapshot>;
    generation: number;
    intent: "profile" | "refer";
    /** The desk's own ED, so a referral started here comes from that ED. */
    edSiteCode: string;
  } | null>(null);
  const [acceptedSubmission, setAcceptedSubmission] = useState<typeof priorSubmissionRef.current>(null);
  const [savedOutsideView, setSavedOutsideView] = useState<string | null>(null);
  /** An accepted shared save finished without its record; a late snapshot can still open it. */
  const lateSubmissionRef = useRef<typeof priorSubmissionRef.current>(null);
  if (acceptedSubmission && acceptedSubmission.generation !== worldGeneration) {
    setAcceptedSubmission(null);
    setLastRejection("The workspace changed. Review the record before trying again.");
    setIsSubmitting(false);
  }
  const submitIntentRef = useRef<"profile" | "refer">("profile");
  const [submitIntent, setSubmitIntent] = useState<"profile" | "refer">("profile");

  const identityChanged =
    draft.umrn.trim().length > 0 ||
    draft.givenName.trim().length > 0 ||
    draft.familyName.trim().length > 0 ||
    draft.dateOfBirth.trim().length > 0 ||
    genderChoice !== GENDER_NOT_RECORDED ||
    indigenousStatus !== "not-stated";
  const isDirty = identityChanged;

  useDirtyStateGuard({
    isDirty: isDirty && !isSubmitting,
    confirmMessage: "You have unsaved changes to this new admission. Are you sure you want to leave?",
  });

  /** Everything Reset clears, so Undo can put every field back (v10 acceptance check). */
  const formSnapshot = () => ({
    draft,
    genderChoice,
    indigenousStatus,
  });
  const restoreSnapshot = (snap: ReturnType<typeof formSnapshot>) => {
    setDraft(snap.draft);
    setGenderChoice(snap.genderChoice);
    setIndigenousStatus(snap.indigenousStatus);
  };

  const performReset = () => {
    if (isDirty && toast) {
      const snap = formSnapshot();
      const id = toast.push({
        tone: "info",
        title: "Form cleared",
        body: "Nothing was saved to the record.",
        undo: {
          durationMs: 8000,
          onUndo: () => {
            if (resetToastRef.current?.id === id) resetToastRef.current = null;
            restoreSnapshot(snap);
          },
          onExpire: () => {
            if (resetToastRef.current?.id === id) resetToastRef.current = null;
          },
        },
      });
      resetToastRef.current = { id, dismiss: toast.dismiss };
    }
    clearForm();
  };

  function finishSubmission() {
    setAttemptedSubmit(false);
    setDuplicateUmrn(null);
    setLastRejection(undefined);
    setIsSubmitting(false);
    priorSubmissionRef.current = null;
    setAcceptedSubmission(null);
    submitIntentRef.current = "profile";
    setSubmitIntent("profile");
    setShowResetConfirm(false);
  }

  function clearForm() {
    setSavedOutsideView(null);
    lateSubmissionRef.current = null;
    setDraft(initialDraft());
    setGenderChoice(GENDER_NOT_RECORDED);
    setIndigenousStatus("not-stated");
    setAssignedSearch(null);
    finishSubmission();
  }

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

  /** The new record from an accepted save, once a snapshot brings it. */
  const findAdded = (prior: NonNullable<typeof priorSubmissionRef.current>) => {
    const priorIds = new Set(prior.patients.map((patient) => patient.id));
    const umrn = prior.umrn.toLowerCase();
    return patients.find((patient) => !priorIds.has(patient.id) && patient.umrn.trim().toLowerCase() === umrn);
  };

  useEffect(() => {
    const late = lateSubmissionRef.current;
    const prior = late ?? acceptedSubmission;
    if (!prior || (!late && priorSubmissionRef.current !== prior)) return;
    if (prior.generation !== worldGeneration) {
      lateSubmissionRef.current = null;
      return;
    }
    const added = findAdded(prior);
    // A shared command can settle before its snapshot arrives. Only its own accepted identity counts.
    if (!added) return;
    priorSubmissionRef.current = null;
    lateSubmissionRef.current = null;
    if (late && isDirty) {
      // The save already finished and the form holds new typing: say where the record is, stay here.
      setSavedOutsideView(`${added.givenName} ${added.familyName} added, ${added.umrn}. It is now in Recent records.`);
      return;
    }
    setSavedOutsideView(null);
    // shell-24 (13 Oct 2026): say the save worked. The toast outlives the page change. A late
    // record already had its "added" toast when the wait ended, so it only says it is opening.
    toast?.push(
      late
        ? { tone: "info", title: `${added.givenName} ${added.familyName}, ${added.umrn}: record now available` }
        : { tone: "success", title: `${added.givenName} ${added.familyName} added, ${added.umrn}` },
    );
    if (prior.intent === "refer") {
      submitIntentRef.current = "profile";
      const params = new URLSearchParams();
      params.set("new", "1");
      params.set("patientId", encodeRecordAddress(added.id));
      const siteCode = prior.edSiteCode;
      if (siteCode) {
        params.set("site", siteCode);
        // The site is an emergency department, so the referral comes from that ED, not a community service.
        params.set("source", "ed");
      }
      router.push(`${WARD_REFERRAL_INTAKE_HREF}?${params.toString()}`);
      return;
    }
    router.push(patientHref(added.id));
    // findAdded reads `patients`, which is listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acceptedSubmission, patients, worldGeneration, router, toast, isDirty]);

  // Latest values for the outside-view timer, which must not restart on every snapshot.
  const latestRef = useRef({ patients, form: formSnapshot() });
  useEffect(() => {
    latestRef.current = { patients, form: formSnapshot() };
  });

  useEffect(() => {
    const prior = acceptedSubmission;
    if (!prior?.shared || priorSubmissionRef.current !== prior || prior.generation !== worldGeneration)
      return undefined;
    // A scoped desk never receives a standalone record it cannot see (no stay, referral or grant),
    // so its snapshot never brings the record. After one short wait per accepted save, finish on
    // the accepted outcome: echo only what was typed and stay here (Grok Bot for the owner, 18 Oct
    // 2026 15:58 AWST; no access is widened). A record that arrives later still opens.
    const timer = window.setTimeout(() => {
      if (priorSubmissionRef.current !== prior) return;
      const priorIds = new Set(prior.patients.map((patient) => patient.id));
      const umrn = prior.umrn.toLowerCase();
      const arrived = latestRef.current.patients.some(
        (patient) => !priorIds.has(patient.id) && patient.umrn.trim().toLowerCase() === umrn,
      );
      if (arrived) return;
      const saved = `${prior.givenName} ${prior.familyName} added, ${prior.umrn}`;
      const note = "Saved. The record is outside this desk's view, so it does not open here.";
      // Clear only the submitted draft; anything typed during the wait is kept.
      if (JSON.stringify(latestRef.current.form) === JSON.stringify(prior.form)) clearForm();
      else finishSubmission();
      lateSubmissionRef.current = prior;
      setSavedOutsideView(`${saved}. ${note}`);
      toast?.push({ tone: "success", title: saved, body: note });
    }, SHARED_REFRESH_MS);
    return () => window.clearTimeout(timer);
    // clearForm and finishSubmission only set state; the timer starts once per accepted save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acceptedSubmission, worldGeneration, toast]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || priorSubmissionRef.current?.generation === worldGeneration) return;
    if (registrationUnavailable) {
      setLastRejection(registrationUnavailable);
      return;
    }
    if (!answered) {
      showMissingFields();
      return;
    }
    setIsSubmitting(true);
    setLastRejection(undefined);
    setSavedOutsideView(null);
    lateSubmissionRef.current = null;
    const submission: NonNullable<typeof priorSubmissionRef.current> = {
      patients,
      umrn: answered.umrn,
      givenName: answered.givenName,
      familyName: answered.familyName,
      generation: worldGeneration,
      intent: submitIntentRef.current,
      edSiteCode: deskEdSiteCode,
      form: formSnapshot(),
    };
    priorSubmissionRef.current = submission;
    setAcceptedSubmission(null);
    const refuse = () => {
      if (priorSubmissionRef.current !== submission) return;
      priorSubmissionRef.current = null;
      // DA-12: a refusal for a record number already on file names that record's UMRN, but only a
      // record this desk can already see; anything else keeps the general refusal.
      const umrnKey = submission.umrn.trim().toLowerCase();
      const existing = [...latestRef.current.patients, ...submission.patients].find(
        (patient) => patient.umrn.trim().toLowerCase() === umrnKey,
      );
      if (existing) {
        setDuplicateUmrn(existing.umrn.trim());
        setLastRejection(duplicateUmrnRefusal(existing.umrn.trim()));
        document.getElementById("ward-add-patient-umrn")?.focus();
      } else {
        setLastRejection("Patient could not be added. Check the identity details and existing records.");
      }
      setIsSubmitting(false);
    };
    try {
      const completion = raise("ADD_PATIENT", {
        registrationScope,
        umrn: answered.umrn,
        givenName: answered.givenName,
        familyName: answered.familyName,
        dateOfBirth: answered.dateOfBirth,
        ...(genderChoice === GENDER_NOT_RECORDED ? {} : { gender: genderChoice }),
      });
      const settle = (outcome: WardCommandOutcome | void) => {
        if (priorSubmissionRef.current !== submission) return;
        if (outcome?.status !== "accepted" || outcome.isCurrent?.() === false) return refuse();
        setAcceptedSubmission(submission);
      };
      if (completion && "then" in completion) {
        submission.shared = true;
        void completion.then(settle, refuse);
      } else settle(completion);
    } catch {
      refuse();
    }
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
    showMissingFields();
  }

  /** Marks every blank required field and moves focus to the first one (DA-12). */
  function showMissingFields() {
    setAttemptedSubmit(true);
    const first = REQUIRED_CONTROLS.find((control) => draft[control.key].trim() === "");
    if (first) document.getElementById(first.id)?.focus();
  }

  /** The line under a required field: blank after a submit, or a record number already on file. */
  function fieldError(key: keyof PatientDraft): string | undefined {
    const value = draft[key].trim();
    if (key === "umrn" && duplicateUmrn !== null && value.toLowerCase() === duplicateUmrn.toLowerCase())
      return "This UMRN is already on file.";
    if (!attemptedSubmit || value !== "") return undefined;
    return REQUIRED_CONTROLS.find((control) => control.key === key)?.missing;
  }

  const setDraftField = (key: keyof PatientDraft) => (value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const resetSummary = [
    {
      key: "identity",
      on: identityChanged,
      label: "Identity",
      meta: "Number, names, birth date, gender, Aboriginal status",
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
                      href={patientHref(patient.id)}
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
            // F-08 (phone review, Oct 2026): the standard Demo pill, so a typed record reads as invented.
            chip={<LiveChip state="live" onHero />}
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
                <Link
                  className={buttonClass({ variant: "onHero", size: "sm" })}
                  href="/ward-flow/search"
                  aria-label="Back to patient search"
                >
                  <Icon icon={ChevronLeft} size={14} />
                  Patient search
                </Link>
              </span>
            }
            bar={
              <div className={styles.heroBar}>
                <p className={styles.heroLine}>
                  <Icon icon={ShieldCheck} size={14} />
                  Identity is saved to the record. Check for an existing record before adding.
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
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- catches Escape or arrow keys bubbling up from the focused control inside */}
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
              />
              <CardBody className={styles.grid}>
                <Field label={<Required>UMRN</Required>} id="ward-add-patient-umrn" error={fieldError("umrn")}>
                  <TextInput
                    data-testid="ward-add-patient-umrn"
                    aria-label="UMRN (Unit Medical Record Number)"
                    aria-required="true"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    enterKeyHint="done"
                    placeholder="UMRN"
                    className={styles.mono}
                    value={draft.umrn}
                    onChange={(event) => setDraftField("umrn")(event.target.value)}
                  />
                </Field>
                <Field
                  label={<Required>Date of birth</Required>}
                  id="ward-add-patient-date-of-birth"
                  error={fieldError("dateOfBirth")}
                >
                  <TextInput
                    data-testid="ward-add-patient-date-of-birth"
                    type="date"
                    aria-required="true"
                    className={styles.mono}
                    value={draft.dateOfBirth}
                    onChange={(event) => setDraftField("dateOfBirth")(event.target.value)}
                  />
                </Field>
                <Field
                  label={<Required>Given name</Required>}
                  id="ward-add-patient-given-name"
                  error={fieldError("givenName")}
                >
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
                <Field
                  label={<Required>Family name</Required>}
                  id="ward-add-patient-family-name"
                  error={fieldError("familyName")}
                >
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
              </CardBody>
            </Card>

            {/* Tablet portrait: the duplicate check sits under Identity, where it is needed while
                typing, not under the Add patient footer (device audit 11 Oct 2026). */}
            {isTabletPortrait ? duplicateCheck : null}

            <Card className={styles.submitBar}>
              <div className={styles.submitLead}>
                {savedOutsideView ? (
                  <p data-testid="ward-add-patient-saved-outside-view" role="status">
                    {savedOutsideView}
                  </p>
                ) : null}
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
                  disabledReason={registrationUnavailable}
                  aria-disabled={answered && !isSubmitting ? undefined : "true"}
                  aria-describedby={answered ? undefined : UNAVAILABLE_REASON_ID}
                  onClick={(event) => {
                    if (isSubmitting || !answered) {
                      ignoreUnavailableActivation(event);
                      return;
                    }
                    submitIntentRef.current = "refer";
                    setSubmitIntent("refer");
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
                  disabledReason={registrationUnavailable}
                  aria-disabled={answered && !isSubmitting ? undefined : "true"}
                  aria-describedby={answered ? undefined : UNAVAILABLE_REASON_ID}
                  onClick={(event) => {
                    if (isSubmitting || !answered) {
                      ignoreUnavailableActivation(event);
                      return;
                    }
                    submitIntentRef.current = "profile";
                    setSubmitIntent("profile");
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
                      <Link className={styles.recentRow} href={patientHref(p.id)}>
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
                name="Gender and Aboriginal status"
                meta="On a larger screen · optional"
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
              You have entered patient details. Resetting clears every unsaved field in this session.
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
