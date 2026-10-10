"use client";

import {
  Activity,
  Ambulance,
  BedDouble,
  CheckCircle2,
  ChevronDown,
  Copy,
  Eye,
  FileText,
  HeartHandshake,
  Hospital,
  Inbox,
  Info,
  ListChecks,
  MapPin,
  Phone,
  Search,
  Send,
  Shield,
  Siren,
  Stethoscope,
  Truck,
  User,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState, useId, useEffect, useMemo, useRef, useCallback } from "react";

import { useWardModalFocus } from "@/components/ward-management/ward-modal-focus";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import { formTitleForCode } from "@/lib/form-register";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { useRoleGate } from "@/components/ward-management/ward-role-gate";
import {
  arrivalEtaLabel,
  arrivalModeLabel,
  ArrivalTimeModal,
  canSetArrivalPlan,
  isArrivalLate,
} from "@/components/ward-management/referrals/arrival-time-modal";
import { LegalLimitsNotChecked } from "@/components/ward-management/legal-limits-not-checked";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { unitHasOpenBeds } from "@/components/ward-management/ward-bed-designation";
import {
  calendarDateOf,
  formatInstant,
  formatInstantWithDay,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import {
  ATS_CATEGORIES,
  COHORTS,
  URGENCY_LEVELS,
  HEALTH_SERVICES,
  HOME_REGIONS,
  RECORDED_SEXES,
  REFERRAL_GENDERS,
  suburbUnknownLabels,
  type AtsCategory,
  type HomeRegion,
  type RecordedSex,
  type ReferralGender,
  type ReferralDestination,
  type Cohort,
  type HealthService,
  type Movement,
  type Referral,
} from "@/components/ward-management/ward-model";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import {
  LATE_ARRIVAL_GRACE_MINUTES,
  OPERATIONAL_DEFAULT_LABEL,
  OVERDUE_AFTER_MINUTES_BY_TIER,
} from "@/components/ward-management/ward-operational-defaults";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { GENDERS, patientAgeYears, type Gender, type Patient } from "@/components/ward-management/ward-patients";

import { unitHealthService } from "@/components/ward-management/ward-service-scope";
import { allEmergencyDepartments, wardSites, edById, siteByCode } from "@/components/ward-management/ward-sites";
import styles from "./ward-referral-drawer.module.css";
import { catchmentRoutingDestinations, lookupCatchment } from "../ward-catchment";
import { communityTeamOptions, suburbOptions } from "./referral-destination-options";
import { TENTATIVE_DIAGNOSIS_BLOCKS, isTentativeDiagnosisBlock } from "../ward-diagnosis";
import {
  DocumentationPanel,
  ContactFields,
  UseMyDetailsButton,
  documentationError,
  EMPTY_DOCUMENTATION,
  ReferralDocumentLinks,
  type DocumentationDraft,
} from "./referral-flow-panels";
import { WardReferralInbox } from "./ward-referral-inbox";
import { duplicateSentence } from "./referral-duplicate";
import {
  discardReferralDraft,
  keepReferralDraft,
  readKeptReferralDraft,
  readKeptReferralDraftAt,
  referralDraftAgeText,
  useReferralDraftAutosave,
} from "./referral-draft-store";
import { referralIsbarText, referralLetterText, type ReferralTextInput } from "./referral-letter";
import { Frac, StatusGlyph, type WfTone } from "@/components/wf";
import { usePathname } from "next/navigation";
import { wardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { profileForChromeRole } from "@/components/ward-management/settings/settings-profile";
import { createReadmissionIndex, priorDischargeWithinWindow } from "@/components/ward-management/ward-readmission";
import { ReadmissionFlag } from "@/components/ward-management/ward-readmission-flag";
import {
  CLEARANCE_CHECKS,
  CLEARANCE_CHECK_LABELS,
  CLEARANCE_STATUSES,
  CLEARANCE_STATUS_LABELS,
  ED_ARRIVAL_MODES,
  FIRST_CONTACT_TARGETS,
  REFERRAL_RISK_FLAGS,
  referralContactError,
  referralIntakeError,
  type ClearanceChecklist,
  type ReferralContact,
  type ReferralIntakeDetails,
  type ReferralNeeds,
  clearanceChecklistWords,
  referralNeedsWords,
} from "./referral-submission";

/**
 * The legal-status choices, as bare register codes. Their visible text is built from the Chief
 * Psychiatrist register at render time by `legalStatusOptionLabel` below — never written here.
 *
 * `"Voluntary"` is not a form code and the register has no entry for it, so that option keeps its
 * own label and is not in this list.
 */
const LEGAL_STATUS_FORM_CODES = ["1A", "4A", "5A"] as const;

/**
 * "Form 4A (Transport order)" — the register's own title, looked up at render time.
 *
 * Mirrors `ward-legal-forms.ts`'s `legalFormName` exactly, including its `null` contract: a code
 * the register does not list renders as the BARE code, never a substituted or locally-invented
 * title. It is a small function of its own rather than a call to that one because `legalFormName`
 * takes a whole `LegalForm`, and this select owns bare codes with no form record behind them —
 * casting a `{ code }` object into a `LegalForm` would assert a shape that does not exist here.
 *
 * ⚠️ **THE POINT IS THAT THE TITLE IS NEVER SOURCE TEXT.**
 * `tests/ward-form-labels-from-register.test.ts` scans this directory's string literals and JSX
 * text for `Form <code> (<description>)` and fails on any match, on the reasoning that a correctly
 * built label is computed by a function call and so cannot appear as a literal. Writing a title
 * back into the JSX re-breaks that guard, which is how the three labels this replaced were caught.
 */
function legalStatusOptionLabel(code: string): string {
  const title = formTitleForCode(code);
  return title === null ? `Form ${code}` : `Form ${code} (${title})`;
}

function transportLabel(code: string): string {
  switch (code) {
    case "mht":
      return "Mental Health Transport (Contracted MHT)";
    case "rfds":
      return "RFDS Aeromedical Flight Escort";
    case "stjohn":
      return "St John Ambulance (Priority 2 Escort)";
    case "carer":
      return "Patient / Carer Accompanied Transport";
    default:
      return "Mental Health Transport";
  }
}

type WardReferralDrawerProps = {
  onClose: () => void;
  onSelectPatient?: (patientId: string) => void;
  withBackdrop?: boolean;
  /** Where the referral comes from. Sets the sample patient and the referring source. */
  initialCategory?: "community" | "ed" | "ward";
  /** Where the referral goes: the slide-out's first choice, Refer to. */
  initialDestination?: "ward" | "community" | "ed";
  /** A `Patient.id` from a Refer link. Used only when the record holds that person. */
  initialPatientId?: string;
  /** A `wardSites` code from a Refer link, for the referring site. */
  initialOriginSiteCode?: string;
  /**
   * Filled with the slide-out's own close, which asks before discarding a draft. The sheet around
   * it calls this for Escape and its backdrop so those ask too.
   */
  closeRequestRef?: React.MutableRefObject<(() => void) | null>;
};

type MockPatientProfile = {
  id: string;
  name: string;
  /** Whole years, or empty when the record holds no date of birth. */
  age: string;
  /** The first letter of the recorded sex, or empty when none is recorded. */
  gender: string;
  umrn: string;
  dob: string;
  medicare: string;
  origin: string;
  legalStatus: string;
  recordedExpiry: string;
  security: string;
  initials: string;
  provisionalDiag: string;
  doctorNote: string;
  clinicalSummary: string;
  cohort: string;
  suburb: string;
  catchment: string;
  destType: string;
  urgency: string;
  transportVal: string;
  transitNote: string;
  riskFlags: {
    aggression: boolean;
    absconding: boolean;
    medical: boolean;
    vulnerable: boolean;
    suicide: boolean;
  };
};

const NOT_RECORDED = "Not recorded";

/**
 * The drawer's sample patients: four real movements and one unregistered walk-in. Only the form
 * mode and the transport picked first are set here; every fact about the person comes from the
 * record through `sampleProfile`.
 *
 * These used to be typed-in profiles laid over real movement ids, each with a made-up name,
 * Medicare number, diagnosis, doctor, clinical summary and risk flags. WF-009 read "Tobias Wren"
 * where the record says Bao Davenport, and the medical-clearance switch below writes to that real
 * movement (25 September 2026 audit, A6). Josh chose "Real details" on 25 September 2026: the
 * record's own name, record number, origin, legal status and urgency, "Not recorded" where it holds
 * none, and the free-text fields start empty.
 */
const SAMPLE_PATIENTS: Record<string, { destType: string; transportVal: string }> = {
  "WF-009": { destType: "ward", transportVal: "mht" },
  "WF-004": { destType: "ward", transportVal: "mht" },
  "WF-002": { destType: "community", transportVal: "carer" },
  "WF-006": { destType: "ward", transportVal: "stjohn" },
  custom: { destType: "ward", transportVal: "mht" },
};

/** A registered person with no open movement is picked by this key, `patient:<id>`. */
const PATIENT_KEY_PREFIX = "patient:";

const NO_RISK_FLAGS: MockPatientProfile["riskFlags"] = {
  aggression: false,
  absconding: false,
  medical: false,
  vulnerable: false,
  suicide: false,
};

function sampleProfile(
  key: string,
  record: { movements: Movement[]; patients: Patient[]; referrals: Referral[]; dayZero: Date },
  now: Instant,
): MockPatientProfile {
  const sample = SAMPLE_PATIENTS[key] ?? SAMPLE_PATIENTS.custom!;
  const movement = record.movements.find((candidate) => candidate.id === key);
  const registered = key.startsWith(PATIENT_KEY_PREFIX)
    ? record.patients.find((candidate) => candidate.id === key.slice(PATIENT_KEY_PREFIX.length))
    : undefined;
  const blank = {
    id: key,
    medicare: NOT_RECORDED,
    provisionalDiag: "",
    doctorNote: "",
    clinicalSummary: "",
    destType: sample.destType,
    transportVal: sample.transportVal,
    transitNote: "",
    riskFlags: NO_RISK_FLAGS,
  };
  if (!movement && registered) {
    const years = patientAgeYears(registered, calendarDateOf(now, record.dayZero));
    return {
      ...blank,
      name: `${registered.familyName}, ${registered.givenName}`,
      age: Number.isFinite(years) && years >= 0 ? String(years) : "",
      gender: registered.sex ? registered.sex.charAt(0).toUpperCase() : "",
      umrn: registered.umrn || NOT_RECORDED,
      dob: registered.dateOfBirth || NOT_RECORDED,
      origin: NOT_RECORDED,
      legalStatus: "Voluntary",
      recordedExpiry: "not recorded",
      security: "Open",
      initials: `${registered.givenName.charAt(0)}${registered.familyName.charAt(0)}`.toUpperCase(),
      cohort: NOT_RECORDED,
      suburb: registered.suburb ?? "",
      catchment: registered.catchmentCommunityTeam ?? "",
      urgency: "",
    };
  }
  if (!movement) {
    return {
      ...blank,
      name: "Unregistered Walk-In",

      age: "",
      gender: "",
      umrn: NOT_RECORDED,
      dob: NOT_RECORDED,
      origin: NOT_RECORDED,
      legalStatus: NOT_RECORDED,
      recordedExpiry: "not recorded",
      security: "Open",
      initials: "UR",
      cohort: NOT_RECORDED,
      suburb: "",
      catchment: "",
      urgency: "",
    };
  }
  const info = resolveSubjectPatient(movement, record);
  const patient = info.patient;
  const years = patient ? patientAgeYears(patient, calendarDateOf(now, record.dayZero)) : Number.NaN;
  const dueAt = movement.legalForm?.dueAt;
  return {
    ...blank,
    name: info.displayName,
    age: Number.isFinite(years) && years >= 0 ? String(years) : "",
    gender: patient?.sex ? patient.sex.charAt(0).toUpperCase() : "",
    umrn: info.umrn,
    dob: patient?.dateOfBirth ?? NOT_RECORDED,
    origin: edById(movement.originEdId)?.name ?? NOT_RECORDED,
    legalStatus: movement.legalForm ? `Form ${movement.legalForm.code}` : movement.legalStatus,
    recordedExpiry: dueAt === undefined ? "not recorded" : `${formatInstantWithDay(dueAt, now)}, clinician-entered`,
    security: movement.security,
    initials: info.initials,
    cohort: movement.cohort,
    suburb: patient?.suburb ?? "",
    catchment: patient?.catchmentCommunityTeam ?? "",
    urgency: String(movement.urgency),
  };
}

/** "42M" as before when both are recorded; otherwise it says which part is missing. */
function ageSexLabel(profile: MockPatientProfile): string {
  if (profile.age && profile.gender) return `${profile.age}${profile.gender}`;
  if (profile.age) return `${profile.age}, sex not recorded`;
  if (profile.gender) return `age not recorded, ${profile.gender}`;
  return "age and sex not recorded";
}

export type WardCapacityRecord = {
  unitId: string;
  name: string;
  hospital: string;
  healthService: HealthService | undefined;
  cohort: Cohort;
  security: "Open" | "Secure";
  readyBeds: number;
  /** `bedStates().pulled` — allocated to a named patient who has not arrived yet. */
  pulledBeds: number;
  /** `bedStates().closed` — physically empty, but the ward is not offering it. */
  closedBeds: number;
  /** Of `readyBeds`, how many are still being made ready. */
  pendingPreparation?: number;
};

/**
 * Every ward in the network, with its live bed figures, read from the model.
 *
 * This used to be a typed-in list of eleven wards with typed bed counts. Five of those wards do not
 * exist in the network, and outside the provider the typed counts were shown as they stood (25
 * September 2026 audit, A6). "Secure" means a wholly locked ward, the meaning the model's own
 * restriction notice gives it (`isMoreRestrictiveThanRequired`, `ward-derivations.ts`).
 */
export function useWardCapacity(): WardCapacityRecord[] {
  let flow: ReturnType<typeof useWardFlow> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    flow = useWardFlow();
  } catch {
    flow = null;
  }
  const units = flow?.units;
  const bedReleases = flow?.bedReleases;
  const admissions = flow?.admissions;
  const leaveBeds = flow?.leaveBeds;
  return useMemo(() => {
    if (!units || !bedReleases) return [];
    return units.map((unit) => {
      // The ruled bed boxes (`ward-bed-states.ts`): Ready · Pulled · Closed · Occupied.
      const states = bedStates(unit, admissions ?? [], bedReleases, leaveBeds ?? []);
      return {
        unitId: unit.id,
        name: unit.name,
        hospital: siteByCode(unit.siteCode)?.name ?? unit.siteCode,
        healthService: unitHealthService(unit),
        cohort: unit.cohort,
        security: unitHasOpenBeds(unit) ? "Open" : "Secure",
        readyBeds: states.ready,
        pulledBeds: states.pulled,
        closedBeds: states.closed,
        pendingPreparation: bedsPendingPreparation(unit.id, [...bedReleases]),
      };
    });
  }, [units, bedReleases, admissions, leaveBeds]);
}

type DrawerCategory = "community" | "ed" | "ward";
type DrawerView = "new" | "inbox";
type DrawerSection = "patient" | "referral" | "documentation" | "placement";

/**
 * Refer to, the slide-out's first choice (Josh, 8 Oct 2026, option B). Where the referral goes
 * names the last two steps and the list of places to choose from.
 */
const DESTINATIONS: Record<
  DrawerCategory,
  { label: string; icon: typeof User; check: string; place: string; places: string; phrase: string }
> = {
  ward: { label: "Ward", icon: Hospital, check: "Clearance", place: "ward", places: "Wards", phrase: "a ward" },
  community: {
    label: "Community",
    icon: Users,
    check: "Documents",
    place: "team",
    places: "Teams",
    phrase: "a community team",
  },
  ed: { label: "ED", icon: Siren, check: "Documents", place: "ED", places: "EDs", phrase: "an emergency department" },
};

const SECTION_IDS: readonly DrawerSection[] = ["patient", "referral", "documentation", "placement"];

function sectionLabel(id: DrawerSection, destination: DrawerCategory): string {
  if (id === "patient") return "Patient";
  if (id === "referral") return "Referral";
  return id === "documentation" ? DESTINATIONS[destination].check : DESTINATIONS[destination].places;
}

/** "1 ward" or "2 wards". */
function countOf(count: number, destination: DrawerCategory): string {
  const { place, places } = DESTINATIONS[destination];
  return `${count} ${count === 1 ? place : places.toLowerCase() === "eds" ? "EDs" : places.toLowerCase()}`;
}

const RISK_FLAG_LABELS: Record<keyof MockPatientProfile["riskFlags"], string> = {
  aggression: "Aggression",
  absconding: "Absconding",
  medical: "Acute medical",
  vulnerable: "Vulnerable adult",
  suicide: "Suicide or self-harm",
};

const DESTINATION_LABELS: Record<DrawerCategory, string> = {
  ward: "Ward bed",
  community: "Community team",
  ed: "ED psychiatry",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "1991-09-17" as "17 Sep 1991"; anything else is shown as recorded. */
function formatDob(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const month = MONTHS[Number(match[2]) - 1];
  return month ? `${Number(match[3])} ${month} ${match[1]}` : value;
}

/** How many answers the Documents step still needs, counted the way `documentationError` checks them. */
function documentationNeeded(draft: DocumentationDraft): number {
  let needed = 0;
  if (!draft.medical) needed += 1;
  if (draft.medical === "no") {
    if (!draft.expectedAt) needed += 1;
    if (!draft.contactName.trim()) needed += 1;
    if (!draft.contactPhone.trim()) needed += 1;
  }
  if (!draft.triage) needed += 1;
  if (!draft.charts.some((chart) => chart.kind === "medication")) needed += 1;
  if (!draft.charts.some((chart) => chart.kind === "observation")) needed += 1;
  if (!draft.additional) needed += 1;
  if (draft.additional === "yes" && !draft.charts.some((chart) => chart.kind === "other")) needed += 1;
  return needed;
}

/** Per-field contact messages for display; `referralContactError` stays the gate. */
function contactFieldErrors(contact: ReferralContact): Partial<Record<keyof ReferralContact, string>> {
  const errors: Partial<Record<keyof ReferralContact, string>> = {};
  if (!contact.name.trim()) errors.name = "Enter your name";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) errors.email = "Enter your email";
  if (!/^[+\d\s().-]+$/.test(contact.phone) || contact.phone.replace(/\D/g, "").length < 8)
    errors.phone = "Enter a valid phone number";
  if (!contact.role.trim()) errors.role = "Enter your role";
  if (!contact.location.trim()) errors.location = "Enter your location or service";
  return errors;
}

/** "To Moodjar and 1 more", or the single name. */
function recipientSummary(labels: string[]): string {
  if (!labels.length) return "No location chosen yet";
  const first = labels[0]!.split(" · ").at(-1);
  return labels.length === 1 ? `To ${first}` : `To ${first} and ${labels.length - 1} more`;
}

function Field({
  label,
  htmlFor,
  required = false,
  hint,
  error,
  children,
  wide = false,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`${styles.formField} ${wide ? styles.fieldWide : ""}`} data-invalid={error ? true : undefined}>
      <div className={styles.fieldLabelRow}>
        <label htmlFor={htmlFor} className={required ? styles.required : undefined}>
          {label}
        </label>
        {hint ? <span className={styles.fieldHint}>{hint}</span> : null}
      </div>
      {children}
      {error ? (
        <p className={styles.fieldError}>
          <StatusGlyph tone="danger" size={9} />
          {error}
        </p>
      ) : null}
    </div>
  );
}

function SelectBox({ children }: { children: React.ReactNode }) {
  return (
    <span className={styles.selectBox}>
      {children}
      <ChevronDown aria-hidden="true" />
    </span>
  );
}

/** One answer from a short list, as a segmented row. Nothing is chosen until the referrer picks. */
function Choice<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  labels,
}: {
  legend: string;
  name: string;
  options: readonly T[];
  value: T | undefined;
  onChange: (value: T) => void;
  labels?: Partial<Record<T, string>>;
}) {
  return (
    <fieldset className={styles.radioField}>
      <legend>{legend}</legend>
      <div className={styles.segmented}>
        {options.map((option) => (
          <label key={option} data-selected={value === option}>
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
            />
            {labels?.[option] ?? option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const YES_NO = ["Yes", "No"] as const;
const yesNo = (value: boolean | undefined) => (value === undefined ? undefined : value ? "Yes" : "No");

function CardHead({
  icon: Icon,
  title,
  titleId,
  children,
}: {
  icon: typeof User;
  title: string;
  titleId?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={styles.cardHead}>
      <span className={styles.cardIcon} aria-hidden="true">
        <Icon aria-hidden="true" />
      </span>
      <h3 className={styles.cardTitle} id={titleId}>
        {title}
      </h3>
      {children ? <div className={styles.cardHeadAside}>{children}</div> : null}
    </div>
  );
}

export function WardReferralDrawer(props: WardReferralDrawerProps) {
  const [view, setView] = useState<DrawerView>("new");
  const [round, setRound] = useState(0);
  // A new request (another Refer link, or New referral after sending) restarts the draft.
  const requestKey = [
    props.initialCategory,
    props.initialDestination,
    props.initialPatientId,
    props.initialOriginSiteCode,
    round,
  ].join("|");
  return (
    <WardReferralDrawerContent
      key={requestKey}
      {...props}
      view={view}
      onViewChange={setView}
      onRestart={() => setRound((current) => current + 1)}
    />
  );
}

/** Everything a kept draft carries, so "Keep draft" can reopen exactly where the referrer stopped. */
type KeptDraft = {
  activePatientKey: string;
  destType: DrawerCategory;
  activeSection: DrawerSection;
  ageBand: Cohort | "";
  selectedUnitIds: string[];
  selectedRecipient: string;
  documentation: DocumentationDraft;
  contact: ReferralContact;
  catchmentSuburb: string;
  catchmentTeam: string;
  catchmentService: HealthService | "";
  catchmentConfirmed: boolean;
  homeRegion: HomeRegion | "";
  sourceKind: "community" | "ed";
  originSiteCode: string;
  sendingTeam: string;
  referralSex: RecordedSex;
  referralGender: ReferralGender | "";
  highAcuity: boolean;
  arrivalEta: string;
  legalStatus: string;
  urgency: string;
  /** Clinician-recorded ATS category, independent of Ward Flow urgency. Omitted when unrecorded. */
  atsCategory?: AtsCategory;
  security: string;
  provisionalDiag: string;
  doctorNote: string;
  clinicalSummary: string;
  transport: string;
  transitNote: string;
  riskFlags: Record<string, boolean>;
  clearanceChecks: ClearanceChecklist;
  communityNeeds: CommunityNeeds;
  edNeeds: EdNeeds;
};

type CommunityNeeds = Omit<Extract<ReferralNeeds, { kind: "community" }>, "kind">;
type EdNeeds = Omit<Extract<ReferralNeeds, { kind: "ed" }>, "kind">;

/** The needs card's answers as the record holds them, for the destination chosen. */
function needsFor(destination: DrawerCategory, community: CommunityNeeds, ed: EdNeeds): ReferralNeeds | undefined {
  if (destination === "community") return { kind: "community", ...community };
  if (destination === "ed") return { kind: "ed", ...ed };
  return undefined;
}

/** The pick key for a person: their open movement when they have one, else the record itself. */
function patientKeyFor(
  patientId: string,
  record: { movements: Movement[]; patients: Patient[]; referrals: Referral[] },
): string | null {
  if (!record.patients.some((patient) => patient.id === patientId)) return null;
  const open = record.movements.find(
    (movement) => !movement.closure && resolveSubjectPatient(movement, record).patient?.id === patientId,
  );
  return open ? open.id : `${PATIENT_KEY_PREFIX}${patientId}`;
}

function WardReferralDrawerContent({
  onClose,
  onSelectPatient,
  withBackdrop = false,
  initialCategory = "ward",
  initialDestination,
  initialPatientId,
  initialOriginSiteCode,
  closeRequestRef,
  view,
  onViewChange,
  onRestart,
}: WardReferralDrawerProps & {
  view: DrawerView;
  onViewChange: (view: DrawerView) => void;
  onRestart: () => void;
}) {
  const searchId = useId();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const touchStartY = useRef<number | null>(null);

  const capacityRecords = useWardCapacity();
  // No sign-in: the route gives the role, and the role gives the profile (or why there is none).
  const myProfile = profileForChromeRole(wardChromeRole(usePathname() ?? ""));
  // Feature 11: the sheet dispatches as the referral's source; routes whose role `EVENT_ROLE` omits
  // keep it through the listed cross-role pairs in `ward-role-permissions.ts`.
  const gate = useRoleGate();
  const sendGate = gate("RECEIVE_REFERRAL");
  const addPatientGate = gate("ADD_PATIENT");

  const {
    movements,
    patients,
    referrals,
    rejections,
    configuration,
    dayZero,
    dispatch,
    wardReferralInbox,
    admissions,
    units,
  } = useWardFlow();
  const now = useWardFlowClock();

  const [prefillKey] = useState(() =>
    initialPatientId ? patientKeyFor(initialPatientId, { movements, patients, referrals }) : null,
  );
  // A Refer link names its person: it reopens a kept draft only when that draft is for the same
  // person, and never someone else's.
  const [storedDraft] = useState(() => readKeptReferralDraft<KeptDraft>());
  const kept =
    !initialPatientId ||
    (storedDraft !== null &&
      ((prefillKey !== null && storedDraft.activePatientKey === prefillKey) ||
        storedDraft.activePatientKey === `${PATIENT_KEY_PREFIX}${initialPatientId}`))
      ? storedDraft
      : null;
  // Another person's kept draft stays as it was: this sheet does not autosave over it.
  const keepsAnotherPersonsDraft = storedDraft !== null && kept === null;
  const initialPatientKey =
    kept?.activePatientKey ??
    prefillKey ??
    (initialCategory === "community" ? "WF-002" : initialCategory === "ed" ? "WF-004" : "WF-009");

  const [activePatientKey, setActivePatientKey] = useState<string>(initialPatientKey);
  const [extraPatientKeys, setExtraPatientKeys] = useState<string[]>(
    initialPatientKey in SAMPLE_PATIENTS ? [] : [initialPatientKey],
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<DrawerSection>(kept?.activeSection ?? "patient");
  const bodyRef = useRef<HTMLDivElement>(null);
  const sectionId = useId();
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>(kept?.selectedUnitIds ?? []);
  const [selectedRecipient, setSelectedRecipient] = useState(kept?.selectedRecipient ?? "");
  const [ageBand, setAgeBand] = useState<Cohort | "">(kept?.ageBand ?? "");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [guardOpen, setGuardOpen] = useState(false);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [newPatientOpen, setNewPatientOpen] = useState(false);
  const [newPatient, setNewPatient] = useState({
    familyName: "",
    givenName: "",
    dateOfBirth: "",
    umrn: "",
    gender: "" as Gender | "",
    suburb: "",
  });
  const [newPatientError, setNewPatientError] = useState<string | null>(null);
  const pendingNewPatient = useRef<number | null>(null);
  const guardKeepRef = useRef<HTMLButtonElement>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [sendPending, setSendPending] = useState(false);
  const [sentReferralId, setSentReferralId] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<Instant | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState<Partial<Record<DrawerSection | "contact", boolean>>>({});
  const submissionRef = useRef<{ intake: ReferralIntakeDetails; rejectionCount: number } | null>(null);
  const confirmationHeadingRef = useRef<HTMLHeadingElement>(null);
  const [inboxUnitId, setInboxUnitId] = useState<string | null>(null);

  const sampleProfiles = useMemo(
    () =>
      Object.fromEntries(
        [...Object.keys(SAMPLE_PATIENTS), ...extraPatientKeys].map((key) => [
          key,
          sampleProfile(key, { movements, patients, referrals, dayZero }, now),
        ]),
      ) as Record<string, MockPatientProfile>,
    [movements, patients, referrals, dayZero, now, extraPatientKeys],
  );
  const defaultPatient = sampleProfiles[initialPatientKey]!;
  const [arrivalPlanOpen, setArrivalPlanOpen] = useState(false);
  const liveMovement = movements.find((m) => m.id === activePatientKey);
  const patientRecord = liveMovement
    ? resolveSubjectPatient(liveMovement, { patients, referrals, movements }).patient
    : activePatientKey.startsWith(PATIENT_KEY_PREFIX)
      ? patients.find((patient) => patient.id === activePatientKey.slice(PATIENT_KEY_PREFIX.length))
      : undefined;
  const movementCohort = liveMovement?.cohort;
  const effectiveCohort: Cohort | "" = movementCohort ?? ageBand;
  const arrivalRole = initialCategory === "community" ? "community" : initialCategory === "ed" ? "ed" : "ward";
  const [documentation, setDocumentation] = useState<DocumentationDraft>(kept?.documentation ?? EMPTY_DOCUMENTATION);
  const isMedicalCleared = documentation.medical === "yes";
  const [contact, setContact] = useState<ReferralContact>(
    kept?.contact ?? { name: "", email: "", phone: "", role: "", location: "" },
  );
  const initialLookup = lookupCatchment(defaultPatient.suburb);
  const initialTeams = catchmentRoutingDestinations(initialLookup);
  const [catchmentSuburb, setCatchmentSuburb] = useState(kept?.catchmentSuburb ?? defaultPatient.suburb);
  const [catchmentTeam, setCatchmentTeam] = useState(
    kept?.catchmentTeam ?? (initialTeams?.length === 1 ? initialTeams[0] : defaultPatient.catchment),
  );
  const [catchmentService, setCatchmentService] = useState<HealthService | "">(kept?.catchmentService ?? "");
  const [catchmentConfirmed, setCatchmentConfirmed] = useState(kept?.catchmentConfirmed ?? false);
  const [catchmentEditing, setCatchmentEditing] = useState(false);
  const [homeRegion, setHomeRegion] = useState<HomeRegion | "">(kept?.homeRegion ?? liveMovement?.homeRegion ?? "");
  // What a menu or link asks for wins over a kept draft; the draft fills in everything else.
  const [sourceKind, setSourceKind] = useState<"community" | "ed">(
    (initialOriginSiteCode ? undefined : kept?.sourceKind) ?? (initialCategory === "ed" ? "ed" : "community"),
  );
  const [originSiteCode, setOriginSiteCode] = useState(initialOriginSiteCode ?? kept?.originSiteCode ?? "");
  const [sendingTeam, setSendingTeam] = useState(kept?.sendingTeam ?? "");
  const [referralSex, setReferralSex] = useState<RecordedSex>(
    kept?.referralSex ?? RECORDED_SEXES.find((sex) => sex === patientRecord?.sex) ?? "Not recorded",
  );
  const [referralGender, setReferralGender] = useState<ReferralGender | "">(
    kept?.referralGender ?? patientRecord?.gender ?? "",
  );
  const [highAcuity, setHighAcuity] = useState(kept?.highAcuity ?? false);
  const [arrivalEta, setArrivalEta] = useState(kept?.arrivalEta ?? "");
  const [destType, setDestType] = useState<DrawerCategory>(initialDestination ?? kept?.destType ?? "ward");
  // Form field state - fully synced and editable
  const [legalStatus, setLegalStatus] = useState(
    kept?.legalStatus ??
      (defaultPatient.legalStatus.startsWith("Form")
        ? defaultPatient.legalStatus.split(" ").slice(0, 2).join(" ")
        : destType === "community" && defaultPatient.legalStatus === NOT_RECORDED
          ? "Voluntary"
          : defaultPatient.legalStatus),
  );
  const [urgency, setUrgency] = useState(kept?.urgency ?? defaultPatient.urgency);
  const [atsCategory, setAtsCategory] = useState<AtsCategory | undefined>(kept?.atsCategory);
  const [security, setSecurity] = useState(
    kept?.security ?? (defaultPatient.security.toLowerCase().includes("secure") ? "Secure" : "Open"),
  );
  const [provisionalDiag, setProvisionalDiag] = useState(kept?.provisionalDiag ?? defaultPatient.provisionalDiag);
  const [doctorNote, setDoctorNote] = useState(kept?.doctorNote ?? defaultPatient.doctorNote);
  const [clinicalSummary, setClinicalSummary] = useState(kept?.clinicalSummary ?? defaultPatient.clinicalSummary);
  const [transport, setTransport] = useState(kept?.transport ?? defaultPatient.transportVal);
  const [transitNote, setTransitNote] = useState(kept?.transitNote ?? defaultPatient.transitNote);
  const [riskFlags, setRiskFlags] = useState<Record<string, boolean>>(kept?.riskFlags ?? defaultPatient.riskFlags);
  const [clearanceChecks, setClearanceChecks] = useState<ClearanceChecklist>(kept?.clearanceChecks ?? {});
  const [communityNeeds, setCommunityNeeds] = useState<CommunityNeeds>(kept?.communityNeeds ?? {});
  const [edNeeds, setEdNeeds] = useState<EdNeeds>(kept?.edNeeds ?? {});

  const draftNow: KeptDraft = {
    activePatientKey,
    destType,
    activeSection,
    ageBand,
    selectedUnitIds,
    selectedRecipient,
    documentation,
    contact,
    catchmentSuburb,
    catchmentTeam,
    catchmentService,
    catchmentConfirmed,
    homeRegion,
    sourceKind,
    originSiteCode,
    sendingTeam,
    referralSex,
    referralGender,
    highAcuity,
    arrivalEta,
    legalStatus,
    urgency,
    atsCategory,
    security,
    provisionalDiag,
    doctorNote,
    clinicalSummary,
    transport,
    transitNote,
    riskFlags,
    clearanceChecks,
    communityNeeds,
    edNeeds,
  };
  // What the draft looked like on opening. A restored draft is never clean, so closing it asks again.
  const [openingDraft] = useState(() => (kept ? "" : JSON.stringify(draftNow)));
  const draftJson = JSON.stringify(draftNow);

  // Body scroll locking on mobile/desktop while drawer is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    touchStartY.current = null;
    if (deltaY > 60 && typeof window !== "undefined" && window.innerWidth <= 640) {
      requestClose();
    }
  };

  const drawerRef = useRef<HTMLDivElement>(null);

  // Asks before an unsent draft is lost: Keep editing, Keep draft or Discard.
  const dirty = !sentReferralId && draftJson !== openingDraft;
  // Autosave to the same tab-memory store as Keep draft, so no close path loses typed work (D-18:
  // memory only, never browser storage).
  const [initialKept] = useState(() => (kept ? { at: readKeptReferralDraftAt(), json: JSON.stringify(kept) } : null));
  const {
    keptAt: draftKeptAt,
    nowMs: draftNowMs,
    stop: stopDraftAutosave,
  } = useReferralDraftAutosave({
    draft: draftNow,
    draftJson,
    enabled: !keepsAnotherPersonsDraft,
    dirty,
    initialKeptAt: initialKept?.at ?? null,
    initialKeptJson: initialKept?.json ?? null,
  });
  const requestClose = useCallback(() => {
    if (guardOpen) setGuardOpen(false);
    else if (dirty) setGuardOpen(true);
    else onClose();
  }, [guardOpen, dirty, onClose]);
  useEffect(() => {
    if (!closeRequestRef) return;
    closeRequestRef.current = requestClose;
    return () => {
      closeRequestRef.current = null;
    };
  }, [closeRequestRef, requestClose]);
  useEffect(() => {
    if (guardOpen) guardKeepRef.current?.focus();
  }, [guardOpen]);
  function discardAndClose() {
    stopDraftAutosave();
    discardReferralDraft();
    setGuardOpen(false);
    onClose();
  }
  function keepAndClose() {
    keepReferralDraft(draftNow);
    setGuardOpen(false);
    onClose();
    announceToWardShell("Referral draft kept until this tab reloads.");
  }

  const handleDrawerClose = useCallback(() => {
    if (isSearchOpen) {
      setIsSearchOpen(false);
      setSearchQuery("");
    } else {
      requestClose();
    }
  }, [isSearchOpen, requestClose]);

  // The enclosing Sheet owns focus when embedded. Register another modal only
  // when this drawer supplies its own backdrop.
  useWardModalFocus(withBackdrop, drawerRef, handleDrawerClose);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        if (
          document.activeElement?.tagName !== "INPUT" &&
          document.activeElement?.tagName !== "TEXTAREA" &&
          document.activeElement?.tagName !== "SELECT"
        ) {
          e.preventDefault();
          onViewChange("new");
          setActiveSection("patient");
          requestAnimationFrame(() => searchInputRef.current?.focus());
          setIsSearchOpen(true);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onViewChange]);

  const currentPatient = sampleProfiles[activePatientKey] ?? sampleProfiles["WF-009"]!;

  function handleSelectPatient(key: string) {
    const p = sampleProfiles[key] ?? sampleProfile(key, { movements, patients, referrals, dayZero }, now);
    if (!sampleProfiles[key]) setExtraPatientKeys((keys) => [...keys, key]);
    setActivePatientKey(key);
    setAgeBand("");
    setNewPatientOpen(false);
    setSearchQuery("");
    setIsSearchOpen(false);
    setSelectedUnitIds([]);
    setSelectedRecipient("");
    setDocumentation(EMPTY_DOCUMENTATION);
    setCatchmentSuburb(p.suburb);
    const teams = catchmentRoutingDestinations(lookupCatchment(p.suburb));
    setCatchmentTeam(teams?.length === 1 ? teams[0] : p.catchment);
    setCatchmentService("");
    setCatchmentConfirmed(false);
    setCatchmentEditing(false);
    setHomeRegion(movements.find((movement) => movement.id === key)?.homeRegion ?? "");
    const record = resolveSubjectPatient(movements.find((movement) => movement.id === key) ?? {}, {
      patients,
      referrals,
      movements,
    }).patient;
    setReferralSex(RECORDED_SEXES.find((sex) => sex === record?.sex) ?? "Not recorded");
    setReferralGender(record?.gender ?? "");
    setHighAcuity(false);
    setArrivalEta("");
    setConfirmationOpen(false);
    setFlowError(null);
    setAttempted({});
    setArrivalPlanOpen(false);

    // Synchronize all form fields with selected patient profile
    const baseLegal = p.legalStatus.startsWith("Form") ? p.legalStatus.split(" ").slice(0, 2).join(" ") : p.legalStatus;
    setLegalStatus(destType === "community" && baseLegal === NOT_RECORDED ? "Voluntary" : baseLegal);
    setUrgency(p.urgency);
    setAtsCategory(undefined);
    setSecurity(p.security.toLowerCase().includes("secure") ? "Secure" : "Open");
    setProvisionalDiag(p.provisionalDiag);
    setDoctorNote(p.doctorNote);
    setClinicalSummary(p.clinicalSummary);
    setTransport(p.transportVal);
    setTransitNote(p.transitNote);
    setRiskFlags(p.riskFlags);
    setClearanceChecks({});
    setCommunityNeeds({});
    setEdNeeds({});

    if (onSelectPatient) {
      onSelectPatient(key);
    }
    announceToWardShell(`Selected patient ${p.name} for clinical referral.`);
  }

  function toggleRisk(key: string) {
    setRiskFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // The sample patients first, then any other registered person whose name or UMRN matches.
  const filteredPatients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const profiles = Object.values(sampleProfiles);
    if (!q) return profiles;
    const matches = profiles.filter((p) => {
      return (
        p.name.toLowerCase().includes(q) ||
        p.umrn.toLowerCase().includes(q) ||
        p.dob.toLowerCase().includes(q) ||
        p.origin.toLowerCase().includes(q)
      );
    });
    const shown = new Set(profiles.map((p) => p.umrn));
    const record = { movements, patients, referrals, dayZero };
    const more = patients
      .filter(
        (patient) =>
          !shown.has(patient.umrn) &&
          (`${patient.givenName} ${patient.familyName}`.toLowerCase().includes(q) ||
            `${patient.familyName}, ${patient.givenName}`.toLowerCase().includes(q) ||
            patient.umrn.toLowerCase().includes(q)),
      )
      .slice(0, 8)
      .map((patient) => sampleProfile(patientKeyFor(patient.id, record) ?? "custom", record, now));
    return [...matches, ...more];
  }, [searchQuery, sampleProfiles, movements, patients, referrals, dayZero, now]);

  // A new person is linked as soon as the record accepts them.
  useEffect(() => {
    if (pendingNewPatient.current === null || patients.length <= pendingNewPatient.current) return;
    pendingNewPatient.current = null;
    const added = patients[patients.length - 1];
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Link only the record the provider accepted.
    if (added) handleSelectPatient(`${PATIENT_KEY_PREFIX}${added.id}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Runs when the record grows, nothing else.
  }, [patients]);
  function addNewPatient(event: React.FormEvent) {
    event.preventDefault();
    const familyName = newPatient.familyName.trim();
    const givenName = newPatient.givenName.trim();
    const umrn = newPatient.umrn.trim();
    if (!familyName || !givenName) return setNewPatientError("Enter the family and given names.");
    if (!newPatient.dateOfBirth) return setNewPatientError("Enter the date of birth.");
    if (!umrn) return setNewPatientError("Enter the UMRN.");
    if (!addPatientGate.allowed) return setNewPatientError(addPatientGate.reason ?? null);
    setNewPatientError(null);
    pendingNewPatient.current = patients.length;
    dispatch({
      type: "ADD_PATIENT",
      role: sourceKind === "ed" ? "ed" : "community",
      now,
      givenName,
      familyName,
      umrn,
      dateOfBirth: newPatient.dateOfBirth,
      ...(newPatient.gender ? { gender: newPatient.gender } : {}),
      ...(newPatient.suburb.trim() ? { suburb: newPatient.suburb.trim() } : {}),
    });
  }

  // Live capacity for the patient's cohort and the chosen bed security.
  // Cheap enough to work out on each render, and the cohort can come from the record or the age band.
  const realTimeMatch = (() => {
    const patientCohort = movementCohort ?? ageBand;
    const matchingRecords = capacityRecords.filter((r) => r.cohort === patientCohort && r.security === security);
    const readyBedsCount = matchingRecords.reduce((sum, r) => sum + r.readyBeds, 0);
    const pulledBedsCount = matchingRecords.reduce((sum, r) => sum + r.pulledBeds, 0);
    const closedBedsCount = matchingRecords.reduce((sum, r) => sum + r.closedBeds, 0);
    // Owner ruling, 2026-09-05. `readyBedsCount` deliberately subtracts NOTHING for this:
    // a ward's figure must not lurch as cleaning starts and stops. The number stays; the
    // sentence beside it is what was missing here.
    const pendingPreparationCount = matchingRecords.reduce((sum, r) => sum + (r.pendingPreparation ?? 0), 0);
    const sortedUnits = [...matchingRecords].sort((a, b) => {
      const aMatch = a.healthService === catchmentService && catchmentConfirmed ? 1 : 0;
      const bMatch = b.healthService === catchmentService && catchmentConfirmed ? 1 : 0;
      if (aMatch !== bMatch) return bMatch - aMatch;
      return b.readyBeds - a.readyBeds;
    });
    return { readyBedsCount, pulledBedsCount, closedBedsCount, pendingPreparationCount, sortedUnits };
  })();

  const selectedDestinations: ReferralDestination[] =
    destType === "ward"
      ? selectedUnitIds
          .filter((id) => realTimeMatch.sortedUnits.some((unit) => unit.unitId === id))
          .map((unitId) => ({
            kind: "psychiatric_ward",
            unitId,
            sex: referralSex,
            gender: referralGender || undefined,
            secureBedNeeded: security === "Secure",
            involuntaryBedNeeded: legalStatus !== "Voluntary",
            highAcuityNursingNeeded: highAcuity,
          }))
      : !selectedRecipient
        ? []
        : destType === "community"
          ? [{ kind: "community_team", teamName: selectedRecipient }]
          : [{ kind: "emergency_department", edId: selectedRecipient, purpose: "psychiatric_review" }];
  const recipientLabels =
    destType === "ward"
      ? selectedDestinations
          .map((destination) =>
            destination.kind === "psychiatric_ward"
              ? capacityRecords.find((unit) => unit.unitId === destination.unitId)
              : undefined,
          )
          .filter((unit): unit is WardCapacityRecord => !!unit)
          .map((unit) => `${unit.hospital} · ${unit.name}`)
      : selectedRecipient
        ? [destType === "community" ? selectedRecipient : (edById(selectedRecipient)?.name ?? selectedRecipient)]
        : [];

  function patientError() {
    if (!patientRecord) return "Find a registered patient, or add a new patient.";
    if (!effectiveCohort) return "Choose the age band.";
    if (!catchmentConfirmed || !catchmentTeam.trim()) return "Confirm the patient's catchment before continuing.";
    if (!homeRegion) return "Choose the patient's home region.";
    return null;
  }
  function referralError() {
    if (
      !originSiteCode ||
      !wardSites.some((site) => site.code === originSiteCode && (sourceKind !== "ed" || !!site.emergencyDepartment))
    )
      return "Choose the location of referral.";
    if (sourceKind === "community" && !sendingTeam.trim()) return "Record the referring community service.";
    if (!URGENCY_LEVELS.some((tier) => String(tier) === urgency)) return "Choose the referral urgency.";
    return null;
  }
  const originValid =
    !!originSiteCode &&
    wardSites.some((site) => site.code === originSiteCode && (sourceKind !== "ed" || !!site.emergencyDepartment));
  const needed: Record<DrawerSection, number> = {
    patient: [!patientRecord, !effectiveCohort, !catchmentConfirmed || !catchmentTeam.trim(), !homeRegion].filter(
      Boolean,
    ).length,
    referral: [
      !originValid,
      sourceKind === "community" && !sendingTeam.trim(),
      !URGENCY_LEVELS.some((tier) => String(tier) === urgency),
    ].filter(Boolean).length,
    documentation: documentationNeeded(documentation),
    placement: selectedDestinations.length ? 0 : 1,
  };
  const totalNeeded = needed.patient + needed.referral + needed.documentation + needed.placement;
  function sectionFor(error: string | null): DrawerSection | null {
    if (!error) return null;
    if (patientError() === error) return "patient";
    if (referralError() === error) return "referral";
    if (documentationError(documentation) === error) return "documentation";
    return "placement";
  }
  function goNext(section: "patient" | "referral" | "documentation") {
    const error =
      patientError() ??
      (section !== "patient" ? referralError() : null) ??
      (section === "documentation" ? documentationError(documentation) : null);
    setFlowError(error);
    if (error) {
      const failed = sectionFor(error);
      if (failed) setAttempted((current) => ({ ...current, [failed]: true }));
      return;
    }
    setActiveSection(section === "patient" ? "referral" : section === "referral" ? "documentation" : "placement");
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }
  function goBack() {
    setFlowError(null);
    setActiveSection((current) =>
      current === "placement" ? "documentation" : current === "documentation" ? "referral" : "patient",
    );
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }
  function handleDispatch() {
    const error =
      patientError() ??
      referralError() ??
      documentationError(documentation) ??
      (selectedDestinations.length ? null : "Select at least one referral location.");
    setFlowError(error);
    if (error) {
      const failed = sectionFor(error);
      if (failed) setAttempted((current) => ({ ...current, [failed]: true }));
      return;
    }
    setConfirmationOpen(true);
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    requestAnimationFrame(() => confirmationHeadingRef.current?.focus());
  }
  function confirmAndSend(event: React.FormEvent) {
    event.preventDefault();
    if (sendPending || sentReferralId || !sendGate.allowed) return;
    const validation =
      patientError() ?? referralError() ?? documentationError(documentation) ?? referralContactError(contact);
    if (validation) {
      setFlowError(validation);
      setAttempted((current) => ({ ...current, contact: true }));
      return;
    }
    const needs = needsFor(destType, communityNeeds, edNeeds);
    const intake: ReferralIntakeDetails = {
      catchment: { teamName: catchmentTeam.trim(), service: catchmentService || undefined, confirmed: true },
      reasonForReferral: doctorNote,
      legalStatus,
      riskFlags: REFERRAL_RISK_FLAGS.filter((flag) => riskFlags[flag]),
      medicalClearance: {
        cleared: isMedicalCleared,
        ...(isMedicalCleared
          ? {}
          : {
              expectedAt: `${documentation.expectedAt}+08:00`,
              contactName: documentation.contactName,
              contactPhone: documentation.contactPhone,
            }),
      },
      triageAndRampCompleted: documentation.triage === "yes",
      charts: documentation.charts,
      additionalDocuments: documentation.additional === "yes",
      referrer: contact,
      ...(destType === "ward"
        ? {
            arrival: { transport, reference: transitNote, estimatedAt: arrivalEta ? `${arrivalEta}+08:00` : undefined },
            ...(Object.keys(clearanceChecks).length ? { clearanceChecklist: clearanceChecks } : {}),
          }
        : {}),
      ...(needs && referralNeedsWords(needs).length ? { needs } : {}),
    };
    const intakeError = referralIntakeError(intake);
    if (intakeError) {
      setFlowError(intakeError);
      return;
    }
    const cohort = effectiveCohort || undefined;
    const tier = URGENCY_LEVELS.find((level) => String(level) === urgency);
    if (!cohort || !tier || !homeRegion || !selectedDestinations.length) {
      setFlowError("Check the patient, urgency and selected recipients.");
      return;
    }
    submissionRef.current = { intake, rejectionCount: rejections.length };
    setSendPending(true);
    setFlowError(null);
    dispatch({
      type: "RECEIVE_REFERRAL",
      role: sourceKind === "ed" ? "ed" : "community",
      now,
      patientId: patientRecord?.id,
      ageBand: cohort,
      homeRegion,
      suburb: suburbKnown ? { kind: "named", name: catchmentSuburb } : { kind: "unknown", reason: "not_known" },
      destinations: selectedDestinations,
      source: sourceKind === "ed" ? "ed_medical" : "community",
      originSiteCode,
      sendingTeamName: sourceKind === "community" ? sendingTeam : undefined,
      urgency: tier,
      ...(atsCategory === undefined ? {} : { atsCategory }),
      transportNeeded: destType === "ward" && transport !== "carer",
      history: clinicalSummary,
      tentativeDiagnosis: isTentativeDiagnosisBlock(provisionalDiag) ? provisionalDiag : undefined,
      intake,
    });
  }
  useEffect(() => {
    const submitted = submissionRef.current;
    if (!sendPending || !submitted) return;
    const created = referrals.find((referral) => referral.intake === submitted.intake);
    if (created) {
      stopDraftAutosave();
      discardReferralDraft();
      setSentReferralId(created.id);
      setSentAt(now);
      setSendPending(false);

      announceToWardShell(`Referral ${created.id} sent to the selected locations.`);
    } else if (rejections.length > submitted.rejectionCount) {
      setFlowError(rejections[rejections.length - 1]?.reason ?? "Referral could not be sent.");
      setSendPending(false);
    }
  }, [sendPending, referrals, rejections, patientRecord?.id, now, stopDraftAutosave]);

  // Recipient inboxes, read from the provider the ward screen already uses.
  const inboxWards = capacityRecords
    .map((unit) => {
      const entries = wardReferralInbox?.(unit.unitId) ?? [];
      const toDecide = entries.filter((entry) => entry.state === "queued" && entry.withdrawnAt === undefined).length;
      return { unit, entries: entries.length, toDecide };
    })
    .filter((ward) => ward.entries > 0);
  const inboxCount = inboxWards.reduce((sum, ward) => sum + ward.toDecide, 0);
  const inboxWard = inboxWards.find((ward) => ward.unit.unitId === inboxUnitId) ?? inboxWards[0];

  const tier = URGENCY_LEVELS.find((level) => String(level) === urgency);
  const tierLabel = tier === undefined ? "Not recorded" : urgencyTierLabel(tier);
  const recordedFlags = (Object.keys(RISK_FLAG_LABELS) as (keyof typeof RISK_FLAG_LABELS)[]).filter(
    (key) => riskFlags[key],
  );
  const clearance: { label: string; tone: WfTone } =
    documentation.medical === "yes"
      ? { label: "Cleared", tone: "success" }
      : documentation.medical === "no"
        ? { label: "Pending", tone: "warning" }
        : { label: "Not answered", tone: "neutral" };
  const contactErrors = attempted.contact ? contactFieldErrors(contact) : {};
  const contactNeeded = Object.keys(contactFieldErrors(contact)).length;
  const patientShowErrors = attempted.patient && activeSection === "patient";
  // The sender's own submission, read back from the created referral.
  const sentDetails = sentReferralId ? referrals.find((referral) => referral.id === sentReferralId)?.intake : undefined;

  const destination = DESTINATIONS[destType];
  // A blank or unlisted suburb is sent as "Suburb not known", so a person of no fixed address can
  // still be referred. The catchment card says which will be sent.
  const suburbKnown =
    !!catchmentSuburb &&
    suburbOptions().some((suburb) => suburb.toLowerCase() === catchmentSuburb.trim().toLowerCase());
  const originLabel = originValid
    ? sourceKind === "ed"
      ? (wardSites.find((site) => site.code === originSiteCode)?.emergencyDepartment?.name ?? originSiteCode)
      : (siteByCode(originSiteCode)?.name ?? originSiteCode)
    : "";
  /** The board calls a referral overdue after this tier window, a service default (`OPERATIONAL_DEFAULT_LABEL`). */
  function decisionDueAt(from: Instant): string | undefined {
    return tier === undefined ? undefined : formatInstantWithDay(from + OVERDUE_AFTER_MINUTES_BY_TIER[tier], now);
  }
  // D-19: one place-free, count-free sentence about the person already named on this form.
  const alreadyOpen = patientRecord ? duplicateSentence({ patientId: patientRecord.id, referrals }) : undefined;
  // 28 day readmission: this person's most recent discharge in the 28 days before now, if any.
  const readmissionIndex = useMemo(
    () => createReadmissionIndex({ admissions, patients, referrals, movements, units }),
    [admissions, patients, referrals, movements, units],
  );
  const readmissionFlag = patientRecord ? priorDischargeWithinWindow(patientRecord, now, readmissionIndex) : null;
  const placeRow =
    selectedDestinations.length === 0
      ? "Choose"
      : recipientLabels.length === 1
        ? recipientLabels[0]!.split(" · ").at(-1)!
        : `${recipientLabels.length} chosen`;
  // Shown only once a ward referral has answered any clearance item.
  const checksDone =
    destType === "ward" && Object.keys(clearanceChecks).length
      ? CLEARANCE_CHECKS.filter((check) => clearanceChecks[check] === "done").length
      : undefined;
  const readyRows: { label: string; value: string; state: "done" | "follow" | "needed" }[] = [
    { label: "Refer to", value: destination.label, state: "done" },
    {
      label: "Patient",
      value: patientRecord ? currentPatient.name : "Needed",
      state: patientRecord ? "done" : "needed",
    },
    {
      label: "Catchment",
      value: catchmentConfirmed ? catchmentTeam : "To confirm",
      state: catchmentConfirmed ? "done" : "needed",
    },
    { label: "From", value: originLabel || "Needed", state: originValid ? "done" : "needed" },
    { label: "Legal status", value: legalStatus, state: legalStatus === NOT_RECORDED ? "needed" : "done" },
    {
      label: "Urgency",
      value: tier === undefined ? "Needed" : `Tier ${tier}`,
      state: tier === undefined ? "needed" : "done",
    },
    {
      label: destination.check,
      value: needed.documentation
        ? `${needed.documentation} to answer`
        : checksDone !== undefined
          ? `${checksDone} of ${CLEARANCE_CHECKS.length} done`
          : documentation.medical === "no"
            ? "Clearance to follow"
            : "Answered",
      state: needed.documentation ? "needed" : documentation.medical === "no" ? "follow" : "done",
    },
    { label: "Your contact", value: contactNeeded ? "Needed" : contact.name, state: contactNeeded ? "needed" : "done" },
    { label: destination.places, value: placeRow, state: selectedDestinations.length ? "done" : "needed" },
  ];
  const readyDone = readyRows.filter((row) => row.state !== "needed").length;
  const draftNeeds = needsFor(destType, communityNeeds, edNeeds);
  const letterInput: ReferralTextInput = {
    destinationPhrase: destination.phrase,
    patientName: patientRecord ? currentPatient.name : "",
    umrn: patientRecord ? currentPatient.umrn : "",
    ageSex: patientRecord ? ageSexLabel(currentPatient) : "",
    suburb: catchmentSuburb,
    from: originLabel,
    recipients: recipientLabels,
    urgency: tier === undefined ? "" : tierLabel,
    legalStatus,
    reason: doctorNote,
    history: clinicalSummary,
    risks: recordedFlags.map((key) => RISK_FLAG_LABELS[key]),
    clearance: clearance.label,
    clearanceChecklist: destType === "ward" ? clearanceChecklistWords(clearanceChecks) : "",
    needs: draftNeeds ? referralNeedsWords(draftNeeds) : [],
    referrer: { name: contact.name, role: contact.role, phone: contact.phone },
  };
  async function copyText(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyNotice(done);
    } catch {
      setCopyNotice("Copy unavailable in this browser");
    }
  }
  function chooseDestination(kind: DrawerCategory) {
    if (kind === destType || sendPending || sentReferralId) return;
    setDestType(kind);
    setSelectedUnitIds([]);
    setSelectedRecipient("");
    setConfirmationOpen(false);
    setFlowError(null);
    if (kind === "community" && legalStatus === NOT_RECORDED) setLegalStatus("Voluntary");
    announceToWardShell(`Referring to ${DESTINATIONS[kind].phrase}.`);
  }

  function selectSection(id: DrawerSection) {
    if (sendPending || sentReferralId) return;
    setPreviewOpen(false);
    setConfirmationOpen(false);

    setFlowError(null);
    setActiveSection(id);
    setIsSearchOpen(false);
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }

  const footStatus = (() => {
    if (view === "inbox") {
      return {
        tone: "info" as WfTone,
        first: inboxWard ? `${inboxWard.unit.name} inbox · ${inboxWard.toDecide} to decide` : "No referrals waiting",
        second: `${inboxWards.length} ${inboxWards.length === 1 ? "ward has" : "wards have"} referrals`,
      };
    }
    if (sentReferralId) {
      return {
        tone: "success" as WfTone,
        first: `Sent ${sentAt === null ? "" : formatInstantWithDay(sentAt, now)} · ${sentReferralId}`,
        second: `${recipientLabels.length} ${recipientLabels.length === 1 ? "location" : "locations"} notified`,
      };
    }
    if (flowError) {
      return { tone: "danger" as WfTone, first: flowError, second: recipientSummary(recipientLabels), alert: true };
    }
    if (confirmationOpen) {
      return {
        tone: (contactNeeded ? (attempted.contact ? "danger" : "neutral") : "success") as WfTone,
        first: contactNeeded
          ? `${contactNeeded} contact ${contactNeeded === 1 ? "detail" : "details"} needed`
          : "Ready to send",
        second: recipientSummary(recipientLabels),
      };
    }
    return {
      tone: (totalNeeded ? "neutral" : "success") as WfTone,
      first: totalNeeded ? `${totalNeeded} ${totalNeeded === 1 ? "answer" : "answers"} still needed` : "All answers in",
      second: recipientSummary(recipientLabels),
    };
  })();

  return (
    <>
      {withBackdrop ? <div className={styles.drawerBackdrop} onClick={requestClose} aria-hidden="true" /> : null}
      <div
        ref={drawerRef}
        className={styles.drawerWide}
        role={withBackdrop ? "dialog" : "complementary"}
        aria-modal={withBackdrop ? true : undefined}
        aria-labelledby="referralDrawerTitle"
        onKeyDownCapture={(event) => {
          if (event.key === "Escape" && isSearchOpen) {
            event.preventDefault();
            event.stopPropagation();
            setIsSearchOpen(false);
            setSearchQuery("");
          }
        }}
      >
        <div className={styles.drawerHead} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <div className={styles.dragHandle} aria-hidden="true" />
          <div className={styles.drawerHeadTop}>
            <span className={styles.headIcon} aria-hidden="true">
              <Send aria-hidden="true" />
            </span>
            <h2 className={styles.drawerTitle} id="referralDrawerTitle">
              Referrals
            </h2>
            <div className={styles.headTabs} role="group" aria-label="Referral views">
              <button type="button" aria-pressed={view === "new"} onClick={() => onViewChange("new")}>
                New referral
              </button>
              <button type="button" aria-pressed={view === "inbox"} onClick={() => onViewChange("inbox")}>
                Inbox <span className={styles.count}>{inboxCount}</span>
              </button>
            </div>
            <kbd className={styles.kbd} aria-hidden="true">
              Esc
            </kbd>
            <button
              type="button"
              className={styles.drawerCloseBtn}
              onClick={requestClose}
              aria-label="Close referral side drawer"
            >
              <X aria-hidden="true" />
            </button>
          </div>

          {view === "new" ? (
            <>
              {sentReferralId ? null : (
                <div className={styles.destRow}>
                  <span className={styles.destLabel} id={`${sectionId}-refer-to`}>
                    Refer to
                  </span>
                  <div className={styles.categoryTrack} role="group" aria-labelledby={`${sectionId}-refer-to`}>
                    {(["ward", "community", "ed"] as const).map((kind) => {
                      const KindIcon = DESTINATIONS[kind].icon;
                      return (
                        <button
                          key={kind}
                          type="button"
                          aria-pressed={destType === kind}
                          data-testid={`ward-referral-refer-to-${kind}`}
                          disabled={sendPending}
                          onClick={() => chooseDestination(kind)}
                        >
                          <KindIcon aria-hidden="true" />
                          {DESTINATIONS[kind].label}
                        </button>
                      );
                    })}
                  </div>
                  {originLabel ? (
                    <span className={styles.fromText} data-testid="ward-referral-from">
                      From <strong>{originLabel}</strong>
                    </span>
                  ) : null}
                </div>
              )}
              <div className={styles.stepper} role="group" aria-label="Referral sections">
                {SECTION_IDS.map((id, index) => {
                  const label = sectionLabel(id, destType);
                  const done = needed[id] === 0 || (id !== "placement" && !!sentReferralId);
                  const active = activeSection === id && !confirmationOpen && !previewOpen && !sentReferralId;

                  const erred = !!attempted[id] && needed[id] > 0;
                  return (
                    <button
                      key={id}
                      type="button"
                      className={styles.stepItem}
                      aria-pressed={activeSection === id}
                      aria-controls={`${sectionId}-${id}`}
                      aria-describedby={`${sectionId}-${id}-state`}
                      data-active={active}
                      data-done={done}
                      onClick={() => selectSection(id)}
                    >
                      <span className={styles.stepMark} aria-hidden="true">
                        {done && !active ? <StatusGlyph tone="success" size={10} /> : index + 1}
                      </span>
                      <span className={styles.stepText}>
                        <span className={styles.stepLabel}>{label}</span>
                        <span
                          className={styles.stepState}
                          id={`${sectionId}-${id}-state`}
                          data-erred={erred}
                          aria-hidden="true"
                        >
                          {erred ? <StatusGlyph tone="danger" size={8} /> : null}
                          {done ? "Complete" : `${needed[id]} needed`}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className={styles.inboxPicker}>
              <span className={styles.inboxPickerLabel}>Ward</span>
              <div className={styles.headTabs} role="group" aria-label="Recipient ward">
                {inboxWards.map((ward) => (
                  <button
                    key={ward.unit.unitId}
                    type="button"
                    aria-pressed={inboxWard?.unit.unitId === ward.unit.unitId}
                    onClick={() => setInboxUnitId(ward.unit.unitId)}
                  >
                    {ward.unit.name} <span className={styles.count}>{ward.toDecide}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={styles.sheetMain}>
          <div ref={bodyRef} className={styles.drawerBody}>
            {view === "inbox" ? (
              inboxWard ? (
                <div className={styles.inboxPane}>
                  <WardReferralInbox key={inboxWard.unit.unitId} unitId={inboxWard.unit.unitId} />
                </div>
              ) : (
                <div className={styles.emptyCard}>
                  <span className={styles.cardIcon} aria-hidden="true">
                    <Inbox aria-hidden="true" />
                  </span>
                  <h3>No referrals waiting</h3>
                  <p>Sent referrals arrive in each ward&apos;s inbox</p>
                </div>
              )
            ) : (
              <>
                {previewOpen ? (
                  <section className={styles.refCard} data-testid="ward-referral-letter-preview">
                    <CardHead icon={Eye} title="Letter preview">
                      <button
                        type="button"
                        className={styles.btn}
                        data-testid="ward-referral-copy-letter"
                        onClick={() => copyText(referralLetterText(letterInput, formatInstant(now)), "Letter copied")}
                      >
                        <Copy aria-hidden="true" />
                        Copy as text
                      </button>
                    </CardHead>
                    <div className={styles.cardBody}>
                      {totalNeeded ? (
                        <p className={styles.bodyMeta}>
                          <StatusGlyph tone="warning" size={9} />
                          {totalNeeded} {totalNeeded === 1 ? "answer" : "answers"} still needed. Sent as written.
                        </p>
                      ) : null}
                      <pre className={styles.letterText}>{referralLetterText(letterInput, formatInstant(now))}</pre>
                    </div>
                  </section>
                ) : null}
                {confirmationOpen && !previewOpen && (
                  <form
                    id="referralConfirmForm"
                    onSubmit={confirmAndSend}
                    className={styles.confirmationPanel}
                    // The drawer's own check (`referralContactError`) gates the send and names each
                    // missing field under it, so the browser's one-at-a-time bubble is not used.
                    noValidate
                  >
                    {sentReferralId ? (
                      <>
                        <section className={styles.refCard}>
                          <CardHead icon={Send} title="Delivery" />
                          <div className={styles.cardBody}>
                            <div className={styles.sentHead}>
                              <span className={styles.sentIcon} aria-hidden="true">
                                <CheckCircle2 aria-hidden="true" />
                              </span>
                              <div>
                                <h3 ref={confirmationHeadingRef} tabIndex={-1} className={styles.sentTitle}>
                                  Referral sent
                                </h3>
                                <p className={styles.sentMeta}>
                                  <span className={styles.mono}>{sentReferralId}</span>
                                  {sentAt !== null ? ` · sent ${formatInstantWithDay(sentAt, now)}` : ""}
                                </p>
                              </div>
                            </div>
                            <p className={styles.eyebrow}>Sent to {countOf(recipientLabels.length, destType)}</p>
                            <ul className={styles.recipientList}>
                              {recipientLabels.map((label) => (
                                <li key={label}>
                                  <StatusGlyph tone="neutral" size={10} />
                                  <strong>{label}</strong>
                                  <span title={OPERATIONAL_DEFAULT_LABEL}>
                                    {sentAt !== null && decisionDueAt(sentAt)
                                      ? `Awaiting review · due ${decisionDueAt(sentAt)}`
                                      : "Awaiting review"}
                                  </span>
                                </li>
                              ))}
                            </ul>
                            <div className={styles.cardActions}>
                              <Link className={styles.btn} href="/mockups/ward-flow/referrals">
                                <Users aria-hidden="true" />
                                View referrals board
                              </Link>
                            </div>
                          </div>
                        </section>
                        <section className={styles.refCard} data-testid="ward-referral-isbar">
                          <CardHead icon={ListChecks} title="Copy to notes">
                            <span className={styles.asideText}>ISBAR</span>
                          </CardHead>
                          <div className={styles.cardBody}>
                            <pre className={styles.letterText}>
                              {referralIsbarText(letterInput, {
                                referralId: sentReferralId,
                                sentAt: sentAt === null ? "" : formatInstantWithDay(sentAt, now),
                                decisionDue: sentAt === null ? undefined : decisionDueAt(sentAt),
                              })}
                            </pre>
                            <div className={styles.cardActions}>
                              <button
                                type="button"
                                className={styles.btn}
                                data-testid="ward-referral-copy-notes"
                                onClick={() =>
                                  copyText(
                                    referralIsbarText(letterInput, {
                                      referralId: sentReferralId,
                                      sentAt: sentAt === null ? "" : formatInstantWithDay(sentAt, now),
                                      decisionDue: sentAt === null ? undefined : decisionDueAt(sentAt),
                                    }),
                                    "Copied for the notes",
                                  )
                                }
                              >
                                <Copy aria-hidden="true" />
                                Copy to notes
                              </button>
                            </div>
                          </div>
                        </section>
                        {sentDetails ? (
                          <section className={styles.refCard}>
                            <CardHead icon={FileText} title="Submitted details">
                              <span className={styles.asideText}>Read-only</span>
                            </CardHead>
                            <div className={styles.cardBody}>
                              <dl className={styles.factGrid} data-columns="2">
                                <div>
                                  <dt>Catchment</dt>
                                  <dd>{sentDetails.catchment.teamName} · confirmed</dd>
                                </div>
                                <div>
                                  <dt>Medical clearance</dt>
                                  <dd>{sentDetails.medicalClearance.cleared ? "Cleared" : "Pending"}</dd>
                                </div>
                                <div>
                                  <dt>Triage and RAMP</dt>
                                  <dd>{sentDetails.triageAndRampCompleted ? "Completed" : "Not completed"}</dd>
                                </div>
                                <div>
                                  <dt>Referrer</dt>
                                  <dd>
                                    {sentDetails.referrer.name} · {sentDetails.referrer.role}
                                  </dd>
                                </div>
                                <div>
                                  <dt>Contact</dt>
                                  <dd>
                                    {sentDetails.referrer.phone} · {sentDetails.referrer.email}
                                  </dd>
                                </div>
                                <div>
                                  <dt>Location or service</dt>
                                  <dd>{sentDetails.referrer.location}</dd>
                                </div>
                                <div>
                                  <dt>Reason for referral</dt>
                                  <dd>{sentDetails.reasonForReferral || "Not recorded"}</dd>
                                </div>
                                <div>
                                  <dt>Legal status</dt>
                                  <dd>{sentDetails.legalStatus}</dd>
                                </div>
                                <div>
                                  <dt>Risk flags</dt>
                                  <dd>{sentDetails.riskFlags.join(", ") || "None selected"}</dd>
                                </div>
                                {sentDetails.arrival ? (
                                  <div>
                                    <dt>Proposed arrival</dt>
                                    <dd>
                                      {transportLabel(sentDetails.arrival.transport)} ·{" "}
                                      {sentDetails.arrival.estimatedAt?.replace("T", " ").replace("+08:00", "") ||
                                        "time not recorded"}
                                    </dd>
                                  </div>
                                ) : null}
                              </dl>
                              {sentDetails.charts.length ? (
                                <div className={styles.documentsBlock}>
                                  <p className={styles.eyebrow}>Documents</p>
                                  <ReferralDocumentLinks charts={sentDetails.charts} />
                                </div>
                              ) : null}
                            </div>
                          </section>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <section className={styles.refCard}>
                          <div className={styles.cardHead}>
                            <span className={styles.cardIcon} aria-hidden="true">
                              <Send aria-hidden="true" />
                            </span>
                            <h3 ref={confirmationHeadingRef} tabIndex={-1} className={styles.cardTitle}>
                              Confirm and send
                            </h3>
                          </div>
                          <div className={styles.cardBody}>
                            <dl className={styles.factGrid}>
                              <div>
                                <dt>Patient</dt>
                                <dd>{currentPatient.name}</dd>
                              </div>
                              <div>
                                <dt>Catchment</dt>
                                <dd>{catchmentTeam}</dd>
                              </div>
                              <div>
                                <dt>Clearance</dt>
                                <dd>{isMedicalCleared ? "Cleared" : "Pending"}</dd>
                              </div>
                              <div>
                                <dt>Charts</dt>
                                <dd>{documentation.charts.length} attached</dd>
                              </div>
                              <div>
                                <dt>Urgency</dt>
                                <dd>{tier === undefined ? "Not recorded" : `Tier ${tier}`}</dd>
                              </div>
                              <div>
                                <dt>Legal status</dt>
                                <dd>{legalStatus}</dd>
                              </div>
                              <div>
                                <dt>Source</dt>
                                <dd>{sourceKind === "ed" ? "Emergency" : "Community"}</dd>
                              </div>
                              <div>
                                <dt>Refer to</dt>
                                <dd>{DESTINATION_LABELS[destType]}</dd>
                              </div>
                            </dl>
                            <p className={styles.eyebrow}>Recipients {recipientLabels.length}</p>
                          </div>
                          <ul className={styles.recipientList}>
                            {recipientLabels.map((label) => (
                              <li key={label}>
                                <StatusGlyph tone="success" size={10} />
                                <strong>{label}</strong>
                                <span>Will receive</span>
                              </li>
                            ))}
                          </ul>
                        </section>
                        <section className={styles.refCard}>
                          <CardHead icon={Phone} title="Your contact details">
                            <UseMyDetailsButton
                              lookup={myProfile}
                              onFill={(details) => {
                                setContact(details);
                                announceToWardShell("Your details filled from your profile.");
                              }}
                            />
                          </CardHead>
                          <div className={styles.cardBody}>
                            <ContactFields contact={contact} onChange={setContact} errors={contactErrors} />
                          </div>
                        </section>
                        <p className={styles.deliveryNote}>
                          <Info aria-hidden="true" />
                          Each location gets it in its inbox. Sending reserves no bed.
                        </p>
                      </>
                    )}
                  </form>
                )}

                <div
                  id={`${sectionId}-patient`}
                  className={styles.sectionPanel}
                  hidden={previewOpen || confirmationOpen || activeSection !== "patient"}
                >
                  <section className={styles.refCard}>
                    <CardHead icon={User} title="Patient">
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnGhost}`}
                        aria-expanded={newPatientOpen}
                        aria-controls={`${sectionId}-new-patient`}
                        data-testid="ward-referral-new-patient-toggle"
                        onClick={() => {
                          setNewPatientOpen((open) => !open);
                          setNewPatientError(null);
                        }}
                      >
                        <UserPlus aria-hidden="true" />
                        New patient
                      </button>
                    </CardHead>
                    <div className={styles.cardBody}>
                      {newPatientOpen ? (
                        <form
                          id={`${sectionId}-new-patient`}
                          className={styles.newPatient}
                          onSubmit={addNewPatient}
                          noValidate
                          data-testid="ward-referral-new-patient"
                        >
                          <div className={styles.fieldGrid} data-layout="three">
                            <Field label="Family name" htmlFor={`${sectionId}-np-family`} required>
                              <input
                                id={`${sectionId}-np-family`}
                                className={styles.fieldInput}
                                value={newPatient.familyName}
                                maxLength={100}
                                autoComplete="off"
                                onChange={(e) => setNewPatient((p) => ({ ...p, familyName: e.target.value }))}
                              />
                            </Field>
                            <Field label="Given name" htmlFor={`${sectionId}-np-given`} required>
                              <input
                                id={`${sectionId}-np-given`}
                                className={styles.fieldInput}
                                value={newPatient.givenName}
                                maxLength={100}
                                autoComplete="off"
                                onChange={(e) => setNewPatient((p) => ({ ...p, givenName: e.target.value }))}
                              />
                            </Field>
                            <Field label="Date of birth" htmlFor={`${sectionId}-np-dob`} required>
                              <input
                                id={`${sectionId}-np-dob`}
                                type="date"
                                className={styles.fieldInput}
                                value={newPatient.dateOfBirth}
                                onChange={(e) => setNewPatient((p) => ({ ...p, dateOfBirth: e.target.value }))}
                              />
                            </Field>
                            <Field label="UMRN" htmlFor={`${sectionId}-np-umrn`} required>
                              <input
                                id={`${sectionId}-np-umrn`}
                                className={styles.fieldInput}
                                value={newPatient.umrn}
                                maxLength={20}
                                autoComplete="off"
                                onChange={(e) => setNewPatient((p) => ({ ...p, umrn: e.target.value }))}
                              />
                            </Field>
                            <Field label="Gender" htmlFor={`${sectionId}-np-gender`} hint="optional">
                              <SelectBox>
                                <select
                                  id={`${sectionId}-np-gender`}
                                  className={styles.fieldSelect}
                                  value={newPatient.gender}
                                  onChange={(e) =>
                                    setNewPatient((p) => ({ ...p, gender: e.target.value as Gender | "" }))
                                  }
                                >
                                  <option value="">Not recorded</option>
                                  {GENDERS.map((gender) => (
                                    <option key={gender}>{gender}</option>
                                  ))}
                                </select>
                              </SelectBox>
                            </Field>
                            <Field label="Suburb" htmlFor={`${sectionId}-np-suburb`} hint="optional">
                              <input
                                id={`${sectionId}-np-suburb`}
                                className={styles.fieldInput}
                                list={`${sectionId}-suburbs`}
                                value={newPatient.suburb}
                                maxLength={100}
                                autoComplete="off"
                                onChange={(e) => setNewPatient((p) => ({ ...p, suburb: e.target.value }))}
                              />
                            </Field>
                          </div>
                          {newPatientError ? (
                            <p className={styles.fieldError} role="alert">
                              <StatusGlyph tone="danger" size={9} />
                              {newPatientError}
                            </p>
                          ) : null}
                          <div className={styles.confirmRow}>
                            <button
                              type="submit"
                              className={`${styles.btn} ${styles.btnTint}`}
                              {...addPatientGate.buttonProps}
                            >
                              <UserPlus aria-hidden="true" />
                              Add patient
                            </button>
                            {addPatientGate.note}
                            <button type="button" className={styles.btn} onClick={() => setNewPatientOpen(false)}>
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : null}
                      <div className={styles.patientSearchWrap}>
                        <Search className={styles.patientSearchIcon} aria-hidden="true" />
                        <input
                          ref={searchInputRef}
                          type="search"
                          id={searchId}
                          className={styles.patientSearchInput}
                          aria-label="Find a patient"
                          placeholder="Find a patient by name or UMRN"
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setIsSearchOpen(true);
                          }}
                          onFocus={() => {
                            if (searchQuery.trim().length > 0) setIsSearchOpen(true);
                          }}
                          autoComplete="off"
                          spellCheck="false"
                          data-gramm="false"
                          data-enable-grammarly="false"
                        />
                        {searchQuery ? (
                          <button
                            type="button"
                            className={styles.patientSearchClear}
                            onClick={() => {
                              setSearchQuery("");
                              setIsSearchOpen(false);
                            }}
                            aria-label="Clear search input"
                          >
                            <X aria-hidden="true" />
                          </button>
                        ) : null}
                        <kbd className={styles.kbd}>/</kbd>

                        {isSearchOpen && filteredPatients.length > 0 ? (
                          <div className={styles.patientSearchResults} role="listbox" aria-label="Matching patients">
                            {filteredPatients.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                role="option"
                                aria-selected={activePatientKey === p.id}
                                className={styles.patientSearchResultItem}
                                data-active={activePatientKey === p.id}
                                onClick={() => handleSelectPatient(p.id)}
                              >
                                <span className={styles.resultAvatar} aria-hidden="true">
                                  {p.initials}
                                </span>
                                <span className={styles.resultText}>
                                  <span className={styles.searchResultName}>
                                    {p.name} ({ageSexLabel(p)})
                                  </span>
                                  <span className={styles.searchResultMeta}>
                                    <span className={styles.mono}>{p.umrn}</span> · {p.origin.split("·")[0].trim()}
                                  </span>
                                </span>
                                <span className={styles.searchResultBadge}>{p.legalStatus.split("·")[0].trim()}</span>
                                {activePatientKey === p.id ? <StatusGlyph tone="success" size={10} /> : null}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className={styles.patientIdentity}>
                        <span className={styles.patientAvatar} aria-hidden="true">
                          {currentPatient.initials}
                        </span>
                        <div className={styles.patientIdentityText}>
                          <p className={styles.patientName}>
                            {currentPatient.name} ({ageSexLabel(currentPatient)})
                          </p>
                          <p className={styles.patientSub}>
                            UMRN <span className={styles.mono}>{currentPatient.umrn}</span> · DOB{" "}
                            {formatDob(currentPatient.dob)} · Medicare {currentPatient.medicare}
                          </p>
                          <ReadmissionFlag flag={readmissionFlag} testId="ward-referral-readmission" />
                        </div>
                        <button
                          type="button"
                          className={styles.btn}
                          onClick={() => {
                            setSearchQuery("");
                            setIsSearchOpen(true);
                            searchInputRef.current?.focus();
                          }}
                        >
                          Switch
                        </button>
                      </div>

                      {alreadyOpen ? (
                        <div className={styles.suggestion} data-testid="ward-referral-already-open">
                          <StatusGlyph tone="warning" size={9} />
                          <span className={styles.suggestionText}>
                            <strong>{alreadyOpen}</strong>
                            <small>Check the Referrals board before sending another</small>
                          </span>
                          <Link
                            className={styles.btn}
                            href="/mockups/ward-flow/referrals"
                            onClick={(event) => {
                              if (dirty) {
                                event.preventDefault();
                                setGuardOpen(true);
                                return;
                              }
                              onClose();
                            }}
                          >
                            Open board
                          </Link>
                        </div>
                      ) : null}
                      {!liveMovement && patientRecord ? (
                        <div className={styles.fieldGrid}>
                          <Field
                            label="Age band"
                            htmlFor={`${sectionId}-age-band`}
                            required
                            error={patientShowErrors && !ageBand ? "Choose the age band" : null}
                          >
                            <SelectBox>
                              <select
                                id={`${sectionId}-age-band`}
                                className={styles.fieldSelect}
                                value={ageBand}
                                onChange={(e) => setAgeBand(e.target.value as Cohort | "")}
                              >
                                <option value="">Choose age band</option>
                                {COHORTS.map((cohort) => (
                                  <option key={cohort}>{cohort}</option>
                                ))}
                              </select>
                            </SelectBox>
                          </Field>
                        </div>
                      ) : null}

                      <div className={styles.priorityGrid} role="region" aria-label="Clinical Priority Grid">
                        <div className={styles.priorityCell}>
                          <p className={styles.eyebrow}>Legal order</p>
                          <p className={styles.priorityValue}>{currentPatient.legalStatus}</p>
                          <p className={styles.priorityMeta}>Expiry {currentPatient.recordedExpiry}</p>
                          <p className={styles.priorityMeta}>
                            <StatusGlyph tone="neutral" size={9} />
                            <LegalLimitsNotChecked variant="tag" />
                          </p>
                        </div>
                        <div className={styles.priorityCell}>
                          <p className={styles.eyebrow}>Clinical acuity</p>
                          <p className={styles.priorityValue}>{tierLabel}</p>
                          <p className={styles.priorityMeta}>
                            {provisionalDiag ? `Diagnosis ${provisionalDiag}` : "Diagnosis not recorded"}
                          </p>
                          <p className={styles.priorityMeta}>
                            {recordedFlags.length
                              ? recordedFlags
                                  .map((key, index) =>
                                    index === 0 ? RISK_FLAG_LABELS[key] : RISK_FLAG_LABELS[key].toLowerCase(),
                                  )
                                  .join(", ")
                              : "No risk flags selected"}
                          </p>
                        </div>
                        <div className={styles.priorityCell}>
                          <p className={styles.eyebrow}>Bed fit</p>
                          <p className={styles.priorityValue}>
                            {effectiveCohort || "Age band not chosen"} · {security.toLowerCase()}
                          </p>

                          <p className={styles.priorityMeta}>Origin {currentPatient.origin.split("·")[0].trim()}</p>
                          <p className={styles.priorityMeta}>
                            {destType === "ward" ? (
                              <>
                                <StatusGlyph tone={realTimeMatch.readyBedsCount > 0 ? "success" : "danger"} size={9} />
                                {realTimeMatch.readyBedsCount} ready · {realTimeMatch.pulledBedsCount} pulled ·{" "}
                                {realTimeMatch.closedBedsCount} closed
                              </>
                            ) : destType === "community" ? (
                              <>
                                <StatusGlyph tone="success" size={9} />
                                Community team, no bed requested
                              </>
                            ) : (
                              <>
                                <StatusGlyph tone="neutral" size={9} />
                                Observation beds not recorded
                              </>
                            )}
                          </p>
                        </div>
                        <div className={styles.priorityCell} data-testid="ward-referral-medical-clearance-card">
                          <p className={styles.eyebrow}>Medical clearance</p>
                          <p className={styles.priorityValue} data-testid="ward-referral-clearance-status">
                            <StatusGlyph tone={clearance.tone} size={9} />
                            {clearance.label}
                          </p>
                          <p className={styles.priorityMeta}>
                            {isMedicalCleared ? "Fit for admission & travel" : "Pre-admission exam needed"}
                          </p>
                          <button
                            type="button"
                            className={styles.textLink}
                            data-cleared={isMedicalCleared}
                            data-testid="ward-referral-medical-clearance-toggle"
                            onClick={() => setActiveSection("documentation")}
                          >
                            Review clearance
                          </button>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className={styles.refCard}>
                    <CardHead icon={MapPin} title="Catchment">
                      <span className={styles.asideText}>
                        {catchmentConfirmed ? (
                          <>
                            <StatusGlyph tone="success" size={9} /> Confirmed
                          </>
                        ) : (
                          "Needs confirming"
                        )}
                      </span>
                    </CardHead>
                    <div className={styles.cardBody}>
                      <p className={styles.bodyMeta}>
                        {patientRecord?.address
                          ? `Recorded address ${patientRecord.address}`
                          : "Address not recorded, search the suburb"}
                      </p>
                      <div className={styles.suggestion}>
                        <StatusGlyph tone={catchmentConfirmed ? "success" : "warning"} size={9} />
                        <span className={styles.suggestionText}>
                          <strong>{catchmentTeam || "Catchment needs confirmation"}</strong>
                          <small>
                            {catchmentConfirmed
                              ? "Catchment confirmed"
                              : catchmentSuburb
                                ? `Suggested from suburb ${catchmentSuburb}, confirm before continuing`
                                : "Confirm before continuing"}
                          </small>
                        </span>
                        <button
                          type="button"
                          className={styles.btn}
                          onClick={() => {
                            setCatchmentEditing(true);
                            setCatchmentConfirmed(false);
                          }}
                        >
                          Change
                        </button>
                      </div>
                      <p className={styles.bodyMeta} data-testid="ward-referral-suburb-note">
                        Suburb on the referral:{" "}
                        <strong>{suburbKnown ? catchmentSuburb : suburbUnknownLabels.not_known}</strong>
                      </p>
                      {(!catchmentTeam || catchmentEditing) && (
                        <div className={styles.fieldGrid}>
                          <Field label="Patient suburb" htmlFor={`${sectionId}-suburb`}>
                            <input
                              id={`${sectionId}-suburb`}
                              className={styles.fieldInput}
                              list={`${sectionId}-suburbs`}
                              value={catchmentSuburb}
                              onChange={(e) => {
                                setCatchmentSuburb(e.target.value);
                                setCatchmentConfirmed(false);
                                const teams = catchmentRoutingDestinations(lookupCatchment(e.target.value));
                                setCatchmentTeam(teams?.length === 1 ? teams[0] : "");
                              }}
                            />
                          </Field>
                          <Field label="Search catchment" htmlFor={`${sectionId}-team`}>
                            <input
                              id={`${sectionId}-team`}
                              className={styles.fieldInput}
                              list={`${sectionId}-teams`}
                              value={catchmentTeam}
                              maxLength={200}
                              onChange={(e) => {
                                setCatchmentTeam(e.target.value);
                                setCatchmentConfirmed(false);
                              }}
                            />
                          </Field>
                        </div>
                      )}
                      <datalist id={`${sectionId}-suburbs`}>
                        {suburbOptions().map((suburb) => (
                          <option key={suburb} value={suburb} />
                        ))}
                      </datalist>
                      <datalist id={`${sectionId}-teams`}>
                        {communityTeamOptions().map((team) => (
                          <option key={team} value={team} />
                        ))}
                      </datalist>
                      {lookupCatchment(catchmentSuburb).state === "contested" && (
                        <p className={styles.fieldError}>
                          <StatusGlyph tone="warning" size={9} />
                          Catchment sources disagree for this suburb. Select and confirm the catchment manually.
                        </p>
                      )}
                      <div className={styles.fieldGrid}>
                        <Field
                          label="Home region"
                          htmlFor={`${sectionId}-region`}
                          required
                          error={patientShowErrors && !homeRegion ? "Choose the home region" : null}
                        >
                          <SelectBox>
                            <select
                              id={`${sectionId}-region`}
                              className={styles.fieldSelect}
                              value={homeRegion}
                              aria-invalid={patientShowErrors && !homeRegion ? true : undefined}
                              onChange={(e) => {
                                setHomeRegion(e.target.value as HomeRegion);
                                setCatchmentConfirmed(false);
                              }}
                            >
                              <option value="">Choose region</option>
                              {HOME_REGIONS.map((region) => (
                                <option key={region}>{region}</option>
                              ))}
                            </select>
                          </SelectBox>
                        </Field>
                        <Field label="Service area" htmlFor={`${sectionId}-service`} hint="optional">
                          <SelectBox>
                            <select
                              id={`${sectionId}-service`}
                              className={styles.fieldSelect}
                              value={catchmentService}
                              onChange={(e) => {
                                setCatchmentService(e.target.value as HealthService | "");
                                setCatchmentConfirmed(false);
                              }}
                            >
                              <option value="">Not known, confirm later</option>
                              {HEALTH_SERVICES.map((service) => (
                                <option key={service}>{service}</option>
                              ))}
                            </select>
                          </SelectBox>
                        </Field>
                      </div>
                      <div className={styles.confirmRow}>
                        {catchmentConfirmed ? (
                          <span className={styles.confirmedNote}>
                            <StatusGlyph tone="success" size={10} />
                            Catchment confirmed
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              className={`${styles.btn} ${styles.btnTint}`}
                              disabled={!catchmentTeam.trim() || !homeRegion}
                              onClick={() => {
                                setCatchmentConfirmed(true);
                                setCatchmentEditing(false);
                                setFlowError(null);
                              }}
                            >
                              <CheckCircle2 aria-hidden="true" />
                              Confirm catchment
                            </button>
                            {!catchmentTeam.trim() || !homeRegion ? (
                              <span className={styles.bodyMeta}>
                                {!catchmentTeam.trim() ? "Choose the catchment first" : "Choose the home region first"}
                              </span>
                            ) : null}
                          </>
                        )}
                      </div>
                      {patientShowErrors && !catchmentConfirmed ? (
                        <p className={styles.fieldError}>
                          <StatusGlyph tone="danger" size={9} />
                          Confirm the catchment before continuing
                        </p>
                      ) : null}
                    </div>
                  </section>
                </div>

                <div
                  id={`${sectionId}-referral`}
                  className={styles.sectionPanel}
                  hidden={previewOpen || confirmationOpen || activeSection !== "referral"}
                >
                  <section className={styles.refCard}>
                    <CardHead icon={MapPin} title="From">
                      <span className={styles.asideText}>
                        {sourceKind === "ed" ? "Emergency referral" : "Community referral"}
                      </span>
                    </CardHead>
                    <div className={styles.cardBody}>
                      <div className={styles.fieldGrid}>
                        <div className={styles.formField}>
                          <div className={styles.fieldLabelRow}>
                            <span className={styles.required} id={`${sectionId}-source`}>
                              Source
                            </span>
                          </div>
                          <div className={styles.segmented} role="group" aria-labelledby={`${sectionId}-source`}>
                            {(["ed", "community"] as const).map((kind) => (
                              <button
                                key={kind}
                                type="button"
                                aria-pressed={sourceKind === kind}
                                onClick={() => {
                                  setSourceKind(kind);
                                  setOriginSiteCode("");
                                }}
                              >
                                {kind === "community" ? "Community" : "Emergency"}
                              </button>
                            ))}
                          </div>
                        </div>
                        <Field
                          label={sourceKind === "ed" ? "Referring emergency department" : "Referring service location"}
                          htmlFor={`${sectionId}-origin`}
                          required
                          error={attempted.referral && !originValid ? "Choose the location of referral" : null}
                        >
                          <SelectBox>
                            <select
                              id={`${sectionId}-origin`}
                              className={styles.fieldSelect}
                              value={originSiteCode}
                              onChange={(e) => setOriginSiteCode(e.target.value)}
                            >
                              <option value="">Choose location</option>
                              {wardSites
                                .filter((site) => sourceKind !== "ed" || site.emergencyDepartment)
                                .map((site) => (
                                  <option key={site.code} value={site.code}>
                                    {sourceKind === "ed" ? site.emergencyDepartment?.name : site.name}
                                  </option>
                                ))}
                            </select>
                          </SelectBox>
                        </Field>
                        {sourceKind === "community" && (
                          <Field
                            label="Referring community service"
                            htmlFor={`${sectionId}-sending`}
                            required
                            wide
                            error={
                              attempted.referral && !sendingTeam.trim()
                                ? "Record the referring community service"
                                : null
                            }
                          >
                            <input
                              id={`${sectionId}-sending`}
                              className={styles.fieldInput}
                              list={`${sectionId}-teams`}
                              value={sendingTeam}
                              maxLength={200}
                              onChange={(e) => setSendingTeam(e.target.value)}
                            />
                          </Field>
                        )}
                      </div>
                    </div>
                  </section>

                  <section className={styles.refCard}>
                    <CardHead icon={Shield} title="Legal status and urgency">
                      <span className={styles.asideText}>
                        <StatusGlyph tone="neutral" size={9} />
                        <LegalLimitsNotChecked variant="tag" />
                      </span>
                    </CardHead>
                    <div className={styles.cardBody}>
                      <div className={styles.fieldGrid} data-layout="wide-narrow">
                        <Field label="Legal status" htmlFor="refLegalSelect" required>
                          <SelectBox>
                            <select
                              className={styles.fieldSelect}
                              id="refLegalSelect"
                              value={legalStatus}
                              onChange={(e) => setLegalStatus(e.target.value)}
                            >
                              {/* The record's own status stays selectable even when it is not one of the usual
                              choices, so the select never shows a different status from the one recorded. */}
                              {legalStatus !== "Voluntary" &&
                              !LEGAL_STATUS_FORM_CODES.some((code) => legalStatus === `Form ${code}`) ? (
                                <option value={legalStatus}>
                                  {legalStatus.startsWith("Form ")
                                    ? legalStatusOptionLabel(legalStatus.slice(5))
                                    : legalStatus}
                                </option>
                              ) : null}
                              {LEGAL_STATUS_FORM_CODES.map((code) => (
                                <option key={code} value={`Form ${code}`}>
                                  {legalStatusOptionLabel(code)}
                                </option>
                              ))}
                              <option value="Voluntary">Voluntary</option>
                            </select>
                          </SelectBox>
                        </Field>
                        <fieldset className={styles.radioField}>
                          <legend className={styles.required}>Bed security</legend>
                          <div className={styles.segmented}>
                            {(["Secure", "Open"] as const).map((level) => (
                              <label key={level} data-selected={security === level}>
                                <input
                                  type="radio"
                                  name={`${sectionId}-security`}
                                  value={level}
                                  checked={security === level}
                                  onChange={() => {
                                    setSecurity(level);
                                    setSelectedUnitIds([]);
                                  }}
                                />
                                {level}
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      </div>
                      <fieldset className={styles.radioField}>
                        <legend className={styles.required}>Urgency</legend>
                        <div className={styles.tierGrid}>
                          {URGENCY_LEVELS.map((level) => {
                            const words = urgencyTierLabel(level).split(" · ")[1] ?? "";
                            return (
                              <label key={level} className={styles.tierTile} data-selected={urgency === String(level)}>
                                <input
                                  type="radio"
                                  name={`${sectionId}-urgency`}
                                  value={String(level)}
                                  aria-label={urgencyTierLabel(level)}
                                  checked={urgency === String(level)}
                                  onChange={() => setUrgency(String(level))}
                                />
                                <span className={styles.tierDigit} data-tier={level} aria-hidden="true">
                                  {level}
                                </span>
                                <span className={styles.tierWords}>
                                  {words.charAt(0).toUpperCase() + words.slice(1)}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </fieldset>
                      <Field
                        label="ATS category"
                        htmlFor={`${sectionId}-atsCategory`}
                        hint="optional — does not change Ward Flow urgency"
                      >
                        <SelectBox>
                          <select
                            id={`${sectionId}-atsCategory`}
                            data-testid="ward-referral-drawer-atsCategory"
                            className={styles.fieldSelect}
                            aria-label="ATS category (optional)"
                            value={atsCategory ?? ""}
                            onChange={(event) =>
                              setAtsCategory(ATS_CATEGORIES.find((category) => String(category) === event.target.value))
                            }
                          >
                            <option value="">ATS not recorded</option>
                            {ATS_CATEGORIES.map((category) => (
                              <option key={category} value={category}>
                                ATS {category}
                              </option>
                            ))}
                          </select>
                        </SelectBox>
                      </Field>
                    </div>
                  </section>

                  <section className={styles.refCard}>
                    <CardHead icon={Activity} title="Clinical presentation" />
                    <div className={styles.cardBody}>
                      <div className={styles.fieldGrid}>
                        <Field label="Provisional diagnosis" htmlFor="refDiagSelect" hint="optional">
                          <SelectBox>
                            <select
                              className={styles.fieldSelect}
                              id="refDiagSelect"
                              value={provisionalDiag}
                              onChange={(e) => setProvisionalDiag(e.target.value)}
                            >
                              <option value="">Not recorded</option>
                              {TENTATIVE_DIAGNOSIS_BLOCKS.map((block) => (
                                <option key={block.code} value={block.code}>
                                  {block.label}
                                </option>
                              ))}
                            </select>
                          </SelectBox>
                        </Field>
                        <Field label="Reason for referral" htmlFor="refDocInput" hint="optional">
                          <input
                            type="text"
                            className={styles.fieldInput}
                            id="refDocInput"
                            maxLength={1000}
                            placeholder="Why this service is needed"
                            value={doctorNote}
                            onChange={(e) => setDoctorNote(e.target.value)}
                            data-gramm="false"
                            data-enable-grammarly="false"
                            spellCheck={false}
                            autoComplete="off"
                          />
                        </Field>
                        <Field
                          label="Patient story"
                          htmlFor="refSummaryText"
                          hint={`${clinicalSummary.length}/10000`}
                          wide
                        >
                          <textarea
                            className={styles.clinicalTextarea}
                            id="refSummaryText"
                            maxLength={10000}
                            rows={2}
                            placeholder="What changed today, history, current treatment"
                            value={clinicalSummary}
                            onChange={(e) => setClinicalSummary(e.target.value)}
                            data-gramm="false"
                            data-enable-grammarly="false"
                            spellCheck={false}
                            autoComplete="off"
                          />
                        </Field>
                      </div>
                      <fieldset className={styles.radioField}>
                        <legend>
                          Risk flags <span className={styles.fieldHint}>select all active</span>
                        </legend>
                        <div className={styles.checkGrid}>
                          {(Object.keys(RISK_FLAG_LABELS) as (keyof typeof RISK_FLAG_LABELS)[]).map((key) => (
                            <label key={key} className={styles.checkChip} data-checked={!!riskFlags[key]}>
                              <input type="checkbox" checked={!!riskFlags[key]} onChange={() => toggleRisk(key)} />
                              {RISK_FLAG_LABELS[key]}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    </div>
                  </section>
                  {destType === "ward" && (
                    <section className={styles.refCard}>
                      <CardHead icon={BedDouble} title="Bed requirements" />
                      <div className={styles.cardBody}>
                        <div className={styles.fieldGrid} data-layout="three">
                          <Field label="Recorded sex" htmlFor={`${sectionId}-sex`}>
                            <SelectBox>
                              <select
                                id={`${sectionId}-sex`}
                                className={styles.fieldSelect}
                                value={referralSex}
                                onChange={(e) => setReferralSex(e.target.value as RecordedSex)}
                              >
                                {RECORDED_SEXES.map((sex) => (
                                  <option key={sex}>{sex}</option>
                                ))}
                              </select>
                            </SelectBox>
                          </Field>
                          <Field label="Gender identity" htmlFor={`${sectionId}-gender`}>
                            <SelectBox>
                              <select
                                id={`${sectionId}-gender`}
                                className={styles.fieldSelect}
                                value={referralGender}
                                onChange={(e) => setReferralGender(e.target.value as ReferralGender | "")}
                              >
                                <option value="">Not recorded</option>
                                {REFERRAL_GENDERS.map((gender) => (
                                  <option key={gender}>{gender}</option>
                                ))}
                              </select>
                            </SelectBox>
                          </Field>
                          <div className={styles.formField}>
                            <div className={styles.fieldLabelRow}>
                              <span id={`${sectionId}-acuity`}>High-acuity nursing</span>
                            </div>
                            <span className={styles.switchRow}>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={highAcuity}
                                aria-labelledby={`${sectionId}-acuity`}
                                className={styles.switch}
                                onClick={() => setHighAcuity((on) => !on)}
                              />
                              <span aria-hidden="true">{highAcuity ? "On" : "Off"}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </section>
                  )}
                  {destType === "community" && (
                    <section className={styles.refCard} data-testid="ward-referral-needs">
                      <CardHead icon={HeartHandshake} title="Follow-up needs">
                        <span className={styles.asideText}>Optional</span>
                      </CardHead>
                      <div className={styles.cardBody}>
                        <div className={styles.fieldGrid}>
                          <Choice
                            legend="First contact within"
                            name={`${sectionId}-first-contact`}
                            options={FIRST_CONTACT_TARGETS}
                            value={communityNeeds.firstContact}
                            onChange={(firstContact) => setCommunityNeeds((n) => ({ ...n, firstContact }))}
                          />
                          <Choice
                            legend="Home visit"
                            name={`${sectionId}-home-visit`}
                            options={YES_NO}
                            value={yesNo(communityNeeds.homeVisit)}
                            onChange={(v) => setCommunityNeeds((n) => ({ ...n, homeVisit: v === "Yes" }))}
                          />
                          <Choice
                            legend="Interpreter"
                            name={`${sectionId}-interpreter`}
                            options={YES_NO}
                            value={yesNo(communityNeeds.interpreter)}
                            onChange={(v) => setCommunityNeeds((n) => ({ ...n, interpreter: v === "Yes" }))}
                          />
                          <Choice
                            legend="Contact the carer"
                            name={`${sectionId}-carer`}
                            options={YES_NO}
                            value={yesNo(communityNeeds.carerContact)}
                            onChange={(v) => setCommunityNeeds((n) => ({ ...n, carerContact: v === "Yes" }))}
                          />
                        </div>
                      </div>
                    </section>
                  )}
                  {destType === "ed" && (
                    <section className={styles.refCard} data-testid="ward-referral-needs">
                      <CardHead icon={Ambulance} title="ED needs">
                        <span className={styles.asideText}>Optional</span>
                      </CardHead>
                      <div className={styles.cardBody}>
                        <div className={styles.fieldGrid}>
                          <Choice
                            legend="Coming by"
                            name={`${sectionId}-coming-by`}
                            options={ED_ARRIVAL_MODES}
                            labels={{ "Mental Health Transport": "MH Transport", "Family or carer": "Family" }}
                            value={edNeeds.comingBy}
                            onChange={(comingBy) => setEdNeeds((n) => ({ ...n, comingBy }))}
                          />
                          <Choice
                            legend="Medical review before psychiatry"
                            name={`${sectionId}-medical-first`}
                            options={YES_NO}
                            value={yesNo(edNeeds.medicalReviewFirst)}
                            onChange={(v) => setEdNeeds((n) => ({ ...n, medicalReviewFirst: v === "Yes" }))}
                          />
                          <Field label="Expected arrival, AWST" htmlFor={`${sectionId}-ed-arrival`}>
                            <input
                              id={`${sectionId}-ed-arrival`}
                              type="time"
                              className={styles.fieldInput}
                              value={edNeeds.expectedArrival ?? ""}
                              onChange={(e) =>
                                setEdNeeds((n) => ({ ...n, expectedArrival: e.target.value || undefined }))
                              }
                            />
                          </Field>
                        </div>
                      </div>
                    </section>
                  )}
                </div>

                <div
                  id={`${sectionId}-documentation`}
                  className={styles.sectionPanel}
                  hidden={previewOpen || confirmationOpen || activeSection !== "documentation"}
                >
                  {destType === "ward" && (
                    <section className={styles.refCard} data-testid="ward-referral-clearance-checklist">
                      <CardHead icon={Stethoscope} title="Medical clearance checklist">
                        <span className={styles.chip}>
                          <span className={styles.mono}>{checksDone ?? 0}</span> of {CLEARANCE_CHECKS.length} done
                        </span>
                      </CardHead>
                      <div className={styles.cardBody} data-tight="true">
                        <div className={styles.checkList}>
                          {CLEARANCE_CHECKS.map((check) => (
                            <Choice
                              key={check}
                              legend={CLEARANCE_CHECK_LABELS[check]}
                              name={`${sectionId}-clearance-${check}`}
                              options={CLEARANCE_STATUSES}
                              labels={CLEARANCE_STATUS_LABELS}
                              value={clearanceChecks[check]}
                              onChange={(status) => setClearanceChecks((c) => ({ ...c, [check]: status }))}
                            />
                          ))}
                        </div>
                      </div>
                    </section>
                  )}
                  <DocumentationPanel
                    key={activePatientKey}
                    draft={documentation}
                    onChange={setDocumentation}
                    referrerName={contact.name}
                    onReferrerNameChange={(name) => setContact((current) => ({ ...current, name }))}
                  />
                </div>

                <div
                  id={`${sectionId}-placement`}
                  className={styles.sectionPanel}
                  hidden={previewOpen || confirmationOpen || activeSection !== "placement"}
                >
                  {destType === "ward" ? (
                    <section className={styles.refCard}>
                      <CardHead icon={Users} title="Wards to refer">
                        <span className={styles.asideText}>Up to {configuration.parallelReferralCap}</span>
                        <span className={styles.chip}>
                          <span className={styles.mono}>{selectedUnitIds.length}</span> selected
                        </span>
                      </CardHead>
                      <div className={styles.cardBody} data-tight="true">
                        <div className={styles.legendRow}>
                          <span>
                            <StatusGlyph tone="success" size={9} />
                            <strong className={styles.mono}>{realTimeMatch.readyBedsCount}</strong> ready
                          </span>
                          <span>
                            <StatusGlyph tone="info" size={9} />
                            <strong className={styles.mono}>{realTimeMatch.pulledBedsCount}</strong> pulled
                          </span>
                          <span>
                            <StatusGlyph tone="closed" size={9} />
                            <strong className={styles.mono}>{realTimeMatch.closedBedsCount}</strong> closed
                          </span>
                          <span className={styles.legendAside}>
                            {currentPatient.cohort} · {security.toLowerCase()} · {realTimeMatch.sortedUnits.length}{" "}
                            {realTimeMatch.sortedUnits.length === 1 ? "ward" : "wards"}
                          </span>
                        </div>
                        {/*
                        Its OWN line, never appended to the figures above: "Ready 2" immediately followed by
                        "1 still being made ready" reads as 21. Renders only when there is one.
                      */}
                        {realTimeMatch.pendingPreparationCount > 0 ? (
                          <p className={styles.beingMadeReady} data-testid="referral-drawer-pending-preparation">
                            <StatusGlyph tone="neutral" size={9} />
                            <strong className={styles.mono}>{realTimeMatch.pendingPreparationCount}</strong> of them
                            still being made ready, offered and counted
                          </p>
                        ) : null}
                      </div>
                      <div className={styles.wardTable}>
                        <div className={styles.wardTableHead} aria-hidden="true">
                          <span>Ward</span>
                          <span>Ready</span>
                          <span>Waitlist</span>
                        </div>
                        <div role="list" aria-label="Placement Destination Options">
                          {realTimeMatch.sortedUnits.map((unit) => {
                            const selected = selectedUnitIds.includes(unit.unitId);
                            const inCatchment =
                              catchmentConfirmed && catchmentService ? unit.healthService === catchmentService : null;
                            const waiting =
                              referrals.filter((referral) =>
                                referral.destinations.some(
                                  (arm) =>
                                    arm.destination.kind === "psychiatric_ward" &&
                                    arm.destination.unitId === unit.unitId &&
                                    arm.state === "queued" &&
                                    arm.waitlistedAt !== undefined &&
                                    arm.withdrawnAt === undefined,
                                ),
                              ).length +
                              movements.filter(
                                (movement) => movement.waitlistedUnitIds?.includes(unit.unitId) && !movement.closure,
                              ).length;
                            return (
                              <label
                                key={unit.unitId}
                                role="listitem"
                                className={styles.wardRow}
                                data-catchment={inCatchment === null ? "unknown" : inCatchment ? "in" : "out"}
                                data-selected={selected}
                              >
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => {
                                    if (!selected && selectedUnitIds.length >= configuration.parallelReferralCap) {
                                      setFlowError(
                                        `Choose up to ${configuration.parallelReferralCap} referral locations.`,
                                      );
                                      return;
                                    }
                                    setSelectedUnitIds((ids) =>
                                      selected ? ids.filter((id) => id !== unit.unitId) : [...ids, unit.unitId],
                                    );
                                    setFlowError(null);
                                  }}
                                />
                                <span className={styles.wardIdentity}>
                                  <span className={styles.wardTitle}>
                                    <strong>{unit.name}</strong> {unit.hospital}
                                  </span>
                                  <span className={styles.wardMeta}>
                                    <span className={styles.fit} data-fit={unit.readyBeds > 0 ? "bed" : "none"}>
                                      <StatusGlyph tone={unit.readyBeds > 0 ? "success" : "warning"} size={9} />
                                      {unit.readyBeds > 0 ? "Bed ready" : "No bed now"}
                                    </span>{" "}
                                    ·{" "}
                                    {inCatchment === null
                                      ? "Catchment not confirmed"
                                      : inCatchment
                                        ? "In catchment"
                                        : "Outside catchment"}
                                    {unit.healthService ? ` · ${unit.healthService}` : ""} ·{" "}
                                    <span className={styles.mono}>{unit.unitId}</span>
                                  </span>
                                </span>
                                <span className={styles.wardFigure}>
                                  <strong className={styles.mono}>{unit.readyBeds}</strong>
                                  {(unit.pendingPreparation ?? 0) > 0 ? (
                                    <small>{unit.pendingPreparation} prep</small>
                                  ) : unit.pulledBeds > 0 ? (
                                    <small>{unit.pulledBeds} pulled</small>
                                  ) : null}
                                </span>
                                <span className={styles.wardFigure}>
                                  <strong className={styles.mono}>{waiting}</strong>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                        {!realTimeMatch.sortedUnits.length && (
                          <p className={styles.bodyMeta}>No wards match this cohort and bed security.</p>
                        )}
                      </div>
                    </section>
                  ) : (
                    <section className={styles.refCard}>
                      <CardHead
                        icon={Users}
                        title={destType === "community" ? "Community team" : "Emergency department"}
                      >
                        <span className={styles.asideText}>Choose one</span>
                        <span className={styles.chip}>
                          <span className={styles.mono}>{selectedRecipient ? 1 : 0}</span> selected
                        </span>
                      </CardHead>
                      <div className={styles.cardBody} data-tight="true">
                        <p className={styles.bodyMeta}>
                          <StatusGlyph tone="info" size={8} />
                          {destType === "community"
                            ? "Community referrals request no bed"
                            : "Goes to psychiatry, observation beds not recorded"}
                        </p>
                      </div>
                      <div
                        role="radiogroup"
                        aria-label={
                          destType === "community" ? "Community team to refer to" : "Emergency department to refer to"
                        }
                      >
                        {(destType === "community"
                          ? Array.from(new Set([catchmentTeam, ...communityTeamOptions()].filter(Boolean)))
                              .sort(
                                (a, b) =>
                                  Number(b === catchmentTeam) - Number(a === catchmentTeam) || a.localeCompare(b),
                              )
                              .map((team) => ({ value: team, name: team, inCatchment: team === catchmentTeam }))
                          : allEmergencyDepartments().map((ed) => ({
                              value: ed.id,
                              name: ed.name,
                              inCatchment: null,
                              inEd: movements.filter(
                                (movement) =>
                                  movement.originEdId === ed.id && !movement.closure && movement.stage !== "arrived",
                              ).length,
                            }))
                        ).map((option) => (
                          <label
                            key={option.value}
                            className={styles.wardRow}
                            data-variant="radio"
                            data-selected={selectedRecipient === option.value}
                          >
                            <input
                              type="radio"
                              name={`${sectionId}-recipient`}
                              value={option.value}
                              checked={selectedRecipient === option.value}
                              onChange={() => {
                                setSelectedRecipient(option.value);
                                setFlowError(null);
                              }}
                            />
                            <span className={styles.wardIdentity}>
                              <span className={styles.wardTitle}>
                                <strong>{option.name}</strong>
                              </span>
                              <span className={styles.wardMeta}>
                                {destType === "community"
                                  ? "Community team · no bed requested"
                                  : "Emergency department · psychiatry"}
                              </span>
                            </span>
                            {"inEd" in option ? (
                              <span className={styles.rowAside}>
                                <strong className={styles.mono}>{option.inEd}</strong> in ED
                              </span>
                            ) : null}
                            {option.inCatchment === null ? null : (
                              <span className={styles.rowAside}>
                                {option.inCatchment ? (
                                  <>
                                    <StatusGlyph tone="success" size={9} /> In catchment
                                  </>
                                ) : (
                                  "Outside catchment"
                                )}
                              </span>
                            )}
                          </label>
                        ))}
                      </div>
                    </section>
                  )}

                  <section className={styles.refCard}>
                    <CardHead icon={FileText} title="Referral summary" />
                    <div className={styles.cardBody}>
                      <dl className={styles.factGrid}>
                        <div>
                          <dt>Patient</dt>
                          <dd>{currentPatient.name}</dd>
                        </div>
                        <div>
                          <dt>Catchment</dt>
                          <dd>{catchmentConfirmed ? catchmentTeam : "Needs confirming"}</dd>
                        </div>
                        <div>
                          <dt>Documents</dt>
                          <dd>{documentation.charts.length} attached</dd>
                        </div>
                        <div>
                          <dt>Clearance</dt>
                          <dd>{clearance.label}</dd>
                        </div>
                      </dl>
                      {recipientLabels.length ? (
                        <ul className={styles.tickList}>
                          {recipientLabels.map((label) => (
                            <li key={label}>
                              <StatusGlyph tone="success" size={10} />
                              {label}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </section>
                  {destType === "ward" && selectedDestinations.length > 0 && (
                    <section className={styles.refCard}>
                      <CardHead icon={Truck} title="Arrival plan">
                        <span className={styles.chip}>Proposed</span>
                      </CardHead>
                      <div className={styles.cardBody}>
                        <div className={styles.fieldGrid} data-layout="three">
                          <Field label="Transport" htmlFor="refTransportSelect">
                            <SelectBox>
                              <select
                                className={styles.fieldSelect}
                                id="refTransportSelect"
                                value={transport}
                                onChange={(e) => setTransport(e.target.value)}
                              >
                                <option value="mht">Mental Health Transport</option>
                                <option value="rfds">RFDS aeromedical escort</option>
                                <option value="stjohn">St John Ambulance escort</option>
                                <option value="carer">Patient or carer accompanied</option>
                              </select>
                            </SelectBox>
                          </Field>
                          <Field label="Arrival, AWST" htmlFor={`${sectionId}-eta`}>
                            <input
                              id={`${sectionId}-eta`}
                              type="datetime-local"
                              className={styles.fieldInput}
                              value={arrivalEta}
                              onChange={(e) => setArrivalEta(e.target.value)}
                            />
                          </Field>
                          <Field label="Dispatch ref" htmlFor="refTransitInput">
                            <input
                              type="text"
                              className={styles.fieldInput}
                              id="refTransitInput"
                              placeholder="Dispatch or staging bay"
                              value={transitNote}
                              onChange={(e) => setTransitNote(e.target.value)}
                              data-gramm="false"
                              data-enable-grammarly="false"
                              spellCheck={false}
                              autoComplete="off"
                            />
                          </Field>
                        </div>
                        {liveMovement && canSetArrivalPlan(liveMovement) ? (
                          <div className={styles.suggestion} data-testid="ward-referral-arrival-plan-card">
                            <StatusGlyph tone="info" size={9} />
                            <span className={styles.suggestionText}>
                              {liveMovement.arrivalDetails ? (
                                <>
                                  <strong>
                                    Current journey, ETA{" "}
                                    {arrivalEtaLabel(liveMovement.arrivalDetails.estimatedArrivalAt, now)}
                                  </strong>
                                  <small>
                                    {arrivalModeLabel(liveMovement.arrivalDetails.mode)}
                                    {liveMovement.arrivalDetails.trackingNumber
                                      ? ` · ${liveMovement.arrivalDetails.trackingNumber}`
                                      : ""}
                                  </small>
                                </>
                              ) : (
                                <>
                                  <strong>No arrival plan recorded</strong>
                                  <small>Setting one records the mode and ward time, and clears the pull clock</small>
                                </>
                              )}
                              {isArrivalLate(liveMovement, now) ? (
                                <small
                                  className={styles.lateNote}
                                  role="status"
                                  data-testid="ward-referral-arrival-late"
                                  title={OPERATIONAL_DEFAULT_LABEL}
                                >
                                  <StatusGlyph tone="warning" size={9} />
                                  Late, more than {LATE_ARRIVAL_GRACE_MINUTES}m past the ward time. Not marked arrived.
                                </small>
                              ) : null}
                            </span>
                            <button
                              type="button"
                              className={styles.btn}
                              data-testid="ward-referral-arrival-plan-toggle"
                              onClick={() => setArrivalPlanOpen(true)}
                            >
                              {liveMovement.arrivalDetails ? "Edit arrival plan" : "Set arrival plan"}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </section>
                  )}
                </div>
              </>
            )}
          </div>
          {view === "new" ? (
            <aside
              className={styles.rail}
              id={`${sectionId}-summary`}
              aria-label="Referral summary"
              data-open={summaryOpen}
              data-testid="ward-referral-summary-rail"
            >
              {sentReferralId ? (
                <section className={styles.railCard}>
                  <p className={styles.eyebrow}>Next</p>
                  <p className={styles.bodyMeta}>Follow {sentReferralId} on the Referrals board.</p>
                  <Link className={styles.btn} href="/mockups/ward-flow/referrals" onClick={onClose}>
                    Open Referrals board
                  </Link>
                </section>
              ) : (
                <>
                  <section className={styles.railCard}>
                    <div className={styles.railHead}>
                      <h3 className={styles.cardTitle}>Ready to send</h3>
                      <Frac
                        done={readyDone}
                        total={readyRows.length}
                        label="items ready to send"
                        tone={readyDone === readyRows.length ? "success" : undefined}
                        className={styles.railFrac}
                      />
                      {kept || draftKeptAt !== null ? (
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnGhost}`}
                          onClick={() => {
                            stopDraftAutosave();
                            discardReferralDraft();
                            onRestart();
                          }}
                        >
                          Discard draft
                        </button>
                      ) : null}
                    </div>
                    {draftKeptAt !== null ? (
                      <p className={styles.draftStatus} data-testid="ward-referral-draft-status">
                        <StatusGlyph tone="success" size={8} />
                        Draft kept · {referralDraftAgeText(draftKeptAt, draftNowMs)}
                      </p>
                    ) : null}
                    <p className={styles.railCount}>
                      <strong className={styles.mono}>{readyDone}</strong> of {readyRows.length} ready
                    </p>
                    <span className={styles.railProgress} aria-hidden="true">
                      <i style={{ width: `${Math.round((readyDone / readyRows.length) * 100)}%` }} />
                    </span>
                    <dl className={styles.railRows}>
                      {readyRows.map((row) => (
                        <div key={row.label} data-state={row.state}>
                          <dt>
                            <StatusGlyph
                              tone={row.state === "done" ? "success" : row.state === "follow" ? "warning" : "neutral"}
                              size={9}
                            />
                            {row.label}
                          </dt>
                          <dd>{row.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                  <section className={styles.railCard} data-layout="pair">
                    <div title={OPERATIONAL_DEFAULT_LABEL}>
                      <p className={styles.eyebrow}>Decision due</p>
                      <strong className={styles.mono}>{decisionDueAt(now) ?? "Choose urgency"}</strong>
                      <small>{tier === undefined ? "No tier yet" : `Tier ${tier} default`}</small>
                    </div>
                    <div>
                      <p className={styles.eyebrow}>Already open</p>
                      <strong>{alreadyOpen ? "Yes" : "None"}</strong>
                      <small title={alreadyOpen ? "Check before sending" : "No open referral"}>
                        {alreadyOpen ? "Check before sending" : "No open referral"}
                      </small>
                    </div>
                  </section>
                  <button
                    type="button"
                    className={styles.btn}
                    data-testid="ward-referral-preview-letter"
                    aria-pressed={previewOpen}
                    onClick={() => {
                      setPreviewOpen((open) => !open);
                      setSummaryOpen(false);
                      if (bodyRef.current) bodyRef.current.scrollTop = 0;
                    }}
                  >
                    <Eye aria-hidden="true" />
                    {previewOpen ? "Back to edit" : "Preview letter"}
                  </button>
                </>
              )}
            </aside>
          ) : null}
        </div>
        {copyNotice ? (
          <p className={styles.copyNotice} role="status">
            <StatusGlyph tone={copyNotice.startsWith("Copy unavailable") ? "warning" : "success"} size={9} />
            {copyNotice}
          </p>
        ) : null}

        <div className={styles.sendReferralFoot}>
          <div className={styles.sendTargetSummary} role={footStatus.alert ? "alert" : undefined}>
            <span className={styles.sendTargetLabel} data-tone={footStatus.tone}>
              {footStatus.tone === "neutral" ? null : <StatusGlyph tone={footStatus.tone} size={9} />}
              <span>{footStatus.first}</span>
            </span>
            <span className={styles.sendTargetName}>{footStatus.second}</span>
          </div>
          <div className={styles.sendActionCluster}>
            {view === "inbox" ? (
              <Link className={styles.btnCancelReferral} href="/mockups/ward-flow/referrals" onClick={onClose}>
                Open referrals board
              </Link>
            ) : sentReferralId ? (
              <>
                <button type="button" className={styles.btnCancelReferral} onClick={onRestart}>
                  New referral
                </button>
                <button type="button" className={styles.btnSendReferral} onClick={onClose}>
                  Done
                </button>
              </>
            ) : previewOpen ? (
              <button type="button" className={styles.btnSendReferral} onClick={() => setPreviewOpen(false)}>
                Back to edit
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className={`${styles.btnCancelReferral} ${styles.summaryToggle}`}
                  aria-pressed={summaryOpen}
                  aria-controls={`${sectionId}-summary`}
                  onClick={() => setSummaryOpen((open) => !open)}
                >
                  Summary
                </button>
                <button
                  type="button"
                  className={styles.btnCancelReferral}
                  disabled={sendPending}
                  onClick={
                    confirmationOpen
                      ? () => {
                          setConfirmationOpen(false);
                          setFlowError(null);
                        }
                      : activeSection === "patient"
                        ? requestClose
                        : goBack
                  }
                >
                  {confirmationOpen ? "Back to referral" : activeSection === "patient" ? "Cancel" : "Back"}
                </button>
                <button
                  className={styles.btnSendReferral}
                  onClick={
                    confirmationOpen
                      ? undefined
                      : activeSection === "placement"
                        ? handleDispatch
                        : () => goNext(activeSection)
                  }
                  type={confirmationOpen ? "submit" : "button"}
                  form={confirmationOpen ? "referralConfirmForm" : undefined}
                  disabled={sendPending || (confirmationOpen && !sendGate.allowed)}
                  aria-describedby={confirmationOpen ? sendGate.buttonProps["aria-describedby"] : undefined}
                >
                  {sendPending
                    ? "Sending…"
                    : confirmationOpen
                      ? "Confirm and send"
                      : activeSection === "placement"
                        ? "Send referral"
                        : `Next: ${sectionLabel(SECTION_IDS[SECTION_IDS.indexOf(activeSection) + 1]!, destType)}`}
                </button>
                {confirmationOpen ? sendGate.note : null}
              </>
            )}
          </div>
        </div>
        {guardOpen ? (
          <div className={styles.guard}>
            <div
              className={styles.guardBox}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby={`${sectionId}-guard-title`}
              aria-describedby={`${sectionId}-guard-text`}
              data-testid="ward-referral-close-guard"
            >
              <h3 className={styles.cardTitle} id={`${sectionId}-guard-title`}>
                Close without sending?
              </h3>
              <p className={styles.bodyMeta} id={`${sectionId}-guard-text`}>
                {patientRecord
                  ? `The referral for ${currentPatient.name} is not sent. `
                  : "This referral is not sent. "}
                A kept draft stays until this tab reloads.
              </p>
              <div className={styles.guardActions}>
                <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={discardAndClose}>
                  Discard
                </button>
                <button type="button" className={styles.btn} onClick={keepAndClose}>
                  Keep draft
                </button>
                <button
                  type="button"
                  ref={guardKeepRef}
                  className={styles.btnSendReferral}
                  onClick={() => setGuardOpen(false)}
                >
                  Keep editing
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {liveMovement ? (
        <ArrivalTimeModal
          isOpen={arrivalPlanOpen}
          onClose={() => setArrivalPlanOpen(false)}
          movement={liveMovement}
          role={arrivalRole}
        />
      ) : null}
    </>
  );
}
