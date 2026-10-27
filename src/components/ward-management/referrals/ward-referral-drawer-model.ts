import { Hospital, Siren, User, Users } from "lucide-react";
import { useMemo } from "react";
import { formTitleForCode } from "@/lib/form-register";
import { useOptionalWardFlow } from "@/components/ward-management/ward-flow-provider";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { unitHasOpenBeds } from "@/components/ward-management/ward-bed-designation";
import { involuntaryBedNeededForLegalStatus } from "@/components/ward-management/ward-eligibility";
import { SELECTABLE_LEGAL_FORMS } from "@/components/ward-management/ward-legal-forms";
import { calendarDateOf, formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import {
  RECORDED_SEXES,
  type AtsCategory,
  type HomeRegion,
  type RecordedSex,
  type ReferralGender,
  type Cohort,
  type HealthService,
  type Movement,
  type Referral,
  type ReferralDestination,
} from "@/components/ward-management/ward-model";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { patientAgeYears, type Patient } from "@/components/ward-management/ward-patients";
import { unitHealthService } from "@/components/ward-management/ward-service-scope";
import { edById, siteByCode } from "@/components/ward-management/ward-sites";
import { type NotOnSendingWardReason } from "@/components/ward-management/ward-change-reasons";
import { type CommunityReferralPurpose } from "@/components/ward-management/ward-model-referral-parts";
import { communityReferralPurposeLabel } from "@/components/ward-management/ward-referrals";
import { chartAnswered, type DocumentationDraft } from "./referral-flow-panels";
import {
  GENDER_UNANSWERED,
  REFERRAL_GENDER_NOT_RECORDED,
  referralGenderOf,
  type ClearanceChecklist,
  type ReferralContact,
  type ReferralGenderAnswer,
  type ReferralNeeds,
} from "./referral-submission";
import { originName } from "@/components/ward-management/ward-movement-origin";

/**
 * The referral slide-out's constants, types and pure helpers, moved unchanged from
 * `ward-referral-drawer.tsx` so its sections can share them.
 */

/**
 * The legal-status choices, as bare register codes. Their visible text is built from the Chief
 * Psychiatrist register at render time by `legalStatusOptionLabel` below — never written here.
 *
 * WT-14 (walk-through, 26 Oct 2026): the referral offered only 1A, 4A and 5A while the ED raise,
 * Pull the bed and the ward's placement form offered the full intake list, so a patient on a 3B
 * could not be referred as one. The codes now come from the one intake list
 * (`SELECTABLE_LEGAL_FORMS`), in its order. The clinician chooses the form (product owner,
 * 24 Aug 2026), so no stage narrows it.
 *
 * `"Voluntary"` is not a form code and the register has no entry for it, so that option keeps its
 * own label and is not in this list.
 */
export const LEGAL_STATUS_FORM_CODES: readonly string[] = SELECTABLE_LEGAL_FORMS.map((form) => form.code);

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
export function legalStatusOptionLabel(code: string): string {
  const title = formTitleForCode(code);
  return title === null ? `Form ${code}` : `Form ${code} (${title})`;
}

export type WardReferralDrawerProps = {
  onClose: () => void;
  onSelectPatient?: (patientId: string) => void;
  withBackdrop?: boolean;
  /** Where the referral comes from. Sets the sample patient and the referring source. */
  initialCategory?: "community" | "ed" | "ward";
  /** Where the referral goes: the slide-out's first choice, Refer to. */
  initialDestination?: "ward" | "community" | "ed";
  /** A `Patient.id` from a Refer link. Used only when the record holds that person. */
  initialPatientId?: string;
  /** A `siteDirectory` code from a Refer link, for the referring site. */
  initialOriginSiteCode?: string;
  /** The referring community team's name, when the slide-out is opened from that team's page. */
  initialSendingTeam?: string;
  /** Wards chosen before opening (Home's shortlist), preselected on the Wards step. */
  initialUnitIds?: readonly string[];
  /**
   * Filled with the slide-out's own close, which asks before discarding a draft. The sheet around
   * it calls this for Escape and its backdrop so those ask too.
   */
  closeRequestRef?: React.MutableRefObject<(() => void) | null>;
};

export type MockPatientProfile = {
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
  transitNote: string;
  riskFlags: {
    aggression: boolean;
    absconding: boolean;
    medical: boolean;
    vulnerable: boolean;
    suicide: boolean;
  };
};

export const NOT_RECORDED = "Not recorded";

/**
 * D-69's one rule lives with the eligibility gates (`ward-eligibility.ts`), which acceptance also
 * reads; the drawer re-exports it so the two can never disagree.
 */
export { involuntaryBedNeededForLegalStatus };

export { GENDER_UNANSWERED, REFERRAL_GENDER_NOT_RECORDED, referralGenderOf, type ReferralGenderAnswer };

/**
 * WS-01: the person's recorded sex and gender identity, for the drawer to start from. The patient
 * record comes first; where it has none, the person's open journey (the ED board row a referral is
 * written from, which `patientKeyFor` opens the drawer on) is used, because that is what the board
 * already shows. Nothing is guessed: with neither recorded, sex reads "Not recorded" and gender
 * stays unanswered for the referrer.
 */
export function recordedSexAndGender(
  record: Pick<Patient, "sex" | "gender"> | undefined,
  journey: Pick<Movement, "sex" | "gender"> | undefined,
): { sex: RecordedSex; gender: ReferralGender | "" } {
  const recordSex = RECORDED_SEXES.find((sex) => sex === record?.sex && sex !== "Not recorded");
  const journeySex = journey?.sex === "Not recorded" ? undefined : journey?.sex;
  return {
    sex: recordSex ?? journeySex ?? "Not recorded",
    gender: record?.gender ?? journey?.gender ?? "",
  };
}

/** The ward destinations a referral drawer sends, one per chosen unit, from what the drawer records. */
export function wardReferralDestinations(
  unitIds: readonly string[],
  needs: {
    sex: RecordedSex;
    gender: ReferralGenderAnswer;
    security: string;
    legalStatus: string | null | undefined;
    highAcuity: boolean;
  },
): Extract<ReferralDestination, { kind: "psychiatric_ward" }>[] {
  return unitIds.map((unitId) => ({
    kind: "psychiatric_ward",
    unitId,
    sex: needs.sex,
    gender: referralGenderOf(needs.gender),
    secureBedNeeded: needs.security === "Secure",
    involuntaryBedNeeded: involuntaryBedNeededForLegalStatus(needs.legalStatus),
    highAcuityNursingNeeded: needs.highAcuity,
  }));
}

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
export const SAMPLE_PATIENTS: Record<string, { destType: string }> = {
  "WF-009": { destType: "ward" },
  "WF-004": { destType: "ward" },
  "WF-002": { destType: "community" },
  "WF-006": { destType: "ward" },
  custom: { destType: "ward" },
};

/**
 * A2-3 (audit 13 Oct 2026): a sheet opened with no named person starts on nobody, never a demo
 * person from another site. Sending stays blocked until a patient is found or added.
 */
export const NO_PATIENT_KEY = "none";

/** A registered person with no open movement is picked by this key, `patient:<id>`. */
export const PATIENT_KEY_PREFIX = "patient:";

const NO_RISK_FLAGS: MockPatientProfile["riskFlags"] = {
  aggression: false,
  absconding: false,
  medical: false,
  vulnerable: false,
  suicide: false,
};

export function sampleProfile(
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
    transitNote: "",
    riskFlags: NO_RISK_FLAGS,
  };
  if (!movement && registered) {
    const years = patientAgeYears(registered, calendarDateOf(now, record.dayZero));
    // "Not recorded" is a placeholder, never a marker: fall through to the recorded gender.
    const sexOrGender = registered.sex && registered.sex !== "Not recorded" ? registered.sex : registered.gender;
    return {
      ...blank,
      name: `${registered.familyName}, ${registered.givenName}`,
      age: Number.isFinite(years) && years >= 0 ? String(years) : "",
      gender: sexOrGender ? sexOrGender.charAt(0).toUpperCase() : "",
      umrn: registered.umrn || NOT_RECORDED,
      dob: registered.dateOfBirth || NOT_RECORDED,
      origin: NOT_RECORDED,
      // A registered person with no ED stay has no legal status on record here; never assume one.
      legalStatus: NOT_RECORDED,
      recordedExpiry: "not recorded",
      security: "Open",
      initials: `${registered.givenName.charAt(0)}${registered.familyName.charAt(0)}`.toUpperCase(),
      cohort: NOT_RECORDED,
      suburb: registered.suburb ?? "",
      catchment: registered.catchmentCommunityTeam ?? "",
      urgency: "",
    };
  }
  if (!movement && key === NO_PATIENT_KEY) {
    return {
      ...blank,
      name: "No patient chosen",
      age: "",
      gender: "",
      umrn: NOT_RECORDED,
      dob: NOT_RECORDED,
      origin: NOT_RECORDED,
      legalStatus: NOT_RECORDED,
      recordedExpiry: "not recorded",
      security: "Open",
      initials: "",
      cohort: NOT_RECORDED,
      suburb: "",
      catchment: "",
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
  const movementSexOrGender = patient?.sex ?? patient?.gender ?? movement.sex;
  return {
    ...blank,
    name: info.displayName,
    age: Number.isFinite(years) && years >= 0 ? String(years) : "",
    gender:
      movementSexOrGender && movementSexOrGender !== "Not recorded" ? movementSexOrGender.charAt(0).toUpperCase() : "",
    umrn: info.umrn,
    dob: patient?.dateOfBirth ?? NOT_RECORDED,
    origin: originName(movement) ?? NOT_RECORDED,
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
export function ageSexLabel(profile: MockPatientProfile): string {
  if (profile.age && profile.gender) return `${profile.age}${profile.gender}`;
  if (profile.age) return `${profile.age}, sex not recorded`;
  if (profile.gender) return `age not recorded, ${profile.gender}`;
  return "age and sex not recorded";
}

export type WardCapacityRecord = {
  unitId: string;
  siteCode: string;
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
  // Outside the provider this returns null, so the drawer shows no capacity rows rather than
  // throwing. Same result as the old try/catch around useWardFlow, without breaking hook rules.
  const flow = useOptionalWardFlow();
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
        siteCode: unit.siteCode,
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

export type DrawerCategory = "community" | "ed" | "ward";
export type DrawerView = "new" | "inbox";
export type DrawerSection = "patient" | "referral" | "documentation" | "placement";

/**
 * Refer to, the slide-out's first choice (Josh, 8 Oct 2026, option B). Where the referral goes
 * names the last two steps and the list of places to choose from.
 */
export const DESTINATIONS: Record<
  DrawerCategory,
  { label: string; icon: typeof User; check: string; place: string; places: string; phrase: string }
> = {
  ward: { label: "Ward", icon: Hospital, check: "Clearance", place: "ward", places: "Wards", phrase: "a ward" },
  community: {
    label: "Community",
    icon: Users,
    check: "Documents",
    place: "team",
    // D-77 short form: a community referral goes to one team.
    places: "Team",
    phrase: "a community team",
  },
  ed: { label: "ED", icon: Siren, check: "Documents", place: "ED", places: "EDs", phrase: "an emergency department" },
};

const SECTION_IDS: readonly DrawerSection[] = ["patient", "referral", "documentation", "placement"];

const COMMUNITY_SECTION_IDS = SECTION_IDS.filter((id) => id !== "documentation");

/** D-77 short form: a community referral has no Documents step. Its one clearance question is on Referral. */
export function sectionIdsFor(destination: DrawerCategory): readonly DrawerSection[] {
  return destination === "community" ? COMMUNITY_SECTION_IDS : SECTION_IDS;
}

export function sectionLabel(id: DrawerSection, destination: DrawerCategory): string {
  if (id === "patient") return "Patient";
  if (id === "referral") return "Referral";
  return id === "documentation" ? DESTINATIONS[destination].check : DESTINATIONS[destination].places;
}

/** "1 ward" or "2 wards". */
export function countOf(count: number, destination: DrawerCategory): string {
  const { place, places } = DESTINATIONS[destination];
  return `${count} ${count === 1 ? place : places.toLowerCase() === "eds" ? "EDs" : places.toLowerCase()}`;
}

// H-0821: one risk flag list for every screen.
export { RISK_FLAG_LABELS } from "./referral-risk-flags";

export const DESTINATION_LABELS: Record<DrawerCategory, string> = {
  ward: "Ward bed",
  community: "Community team",
  ed: "ED psychiatry",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "1991-09-17" as "17 Sep 1991"; anything else is shown as recorded. */
export function formatDob(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const month = MONTHS[Number(match[2]) - 1];
  return month ? `${Number(match[3])} ${month} ${match[1]}` : value;
}

/** How many answers the Documents step still needs, counted the way `documentationError` checks them. */
export function documentationNeeded(draft: DocumentationDraft): number {
  let needed = 0;
  if (!draft.medical) needed += 1;
  if (draft.medical === "no") {
    if (!draft.expectedAt) needed += 1;
    if (!draft.contactName.trim()) needed += 1;
    if (!draft.contactPhone.trim()) needed += 1;
  }
  if (!chartAnswered(draft, "medication")) needed += 1;
  if (!chartAnswered(draft, "observation")) needed += 1;
  if (draft.additional === "yes" && !draft.charts.some((chart) => chart.kind === "other")) needed += 1;
  return needed;
}

/** Every answer the Documents step asks for, the denominator `documentationNeeded` counts against. */
export function documentationItems(draft: DocumentationDraft): number {
  return 3 + (draft.medical === "no" ? 3 : 0) + (draft.additional === "yes" ? 1 : 0);
}

/** The contact fields asked at Send (`contactFieldErrors` checks each one), counted as items. */
export const CONTACT_FIELD_COUNT = 5;

/** Per-field contact messages for display; `referralContactError` stays the gate. */
export function contactFieldErrors(contact: ReferralContact): Partial<Record<keyof ReferralContact, string>> {
  const errors: Partial<Record<keyof ReferralContact, string>> = {};
  if (!contact.name.trim()) errors.name = "Enter your name";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) errors.email = "Enter your email";
  if (!/^[+\d\s().-]+$/.test(contact.phone) || contact.phone.replace(/\D/g, "").length < 8)
    errors.phone = "Enter a valid phone number";
  if (!contact.role.trim()) errors.role = "Enter your role";
  if (!contact.location.trim()) errors.location = "Enter your location or service";
  return errors;
}

/** D-74: a community team arm only once the referrer has said what it is for. */
export function communityDestinations(team: string, purpose: CommunityReferralPurpose | "") {
  return purpose ? [{ kind: "community_team" as const, teamName: team, purpose }] : [];
}

/** The one chosen community team or department, named; a team says what it is for once chosen (D-74). */
export function singleRecipientLabel(
  community: boolean,
  recipient: string,
  purpose: CommunityReferralPurpose | "",
): string {
  if (!community) return edById(recipient)?.name ?? recipient;
  return purpose ? `${recipient} (${communityReferralPurposeLabel(purpose)})` : recipient;
}

/** Why nothing can be sent yet: a chosen community team still needs its purpose (D-74). */
export function missingDestinationError(communityTeamChosen: boolean): string {
  return communityTeamChosen ? "Choose what the community referral is for." : "Select at least one referral location.";
}

/** "To Moodjar and 1 more", or the single name. */
export function recipientSummary(labels: string[]): string {
  if (!labels.length) return "No location chosen yet";
  const first = labels[0]!.split(" · ").at(-1);
  return labels.length === 1 ? `To ${first}` : `To ${first} and ${labels.length - 1} more`;
}

export const YES_NO = ["Yes", "No"] as const;
export const yesNo = (value: boolean | undefined) => (value === undefined ? undefined : value ? "Yes" : "No");

/** Everything a kept draft carries, so "Keep draft" can reopen exactly where the referrer stopped. */
export type KeptDraft = {
  activePatientKey: string;
  destType: DrawerCategory;
  activeSection: DrawerSection;
  ageBand: Cohort | "";
  selectedUnitIds: string[];
  selectedRecipient: string;
  /** D-74: what a community referral is for. Omitted until chosen. */
  communityPurpose?: CommunityReferralPurpose;
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
  referralGender: ReferralGenderAnswer;
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
  /** "Not yet identified": a short description when no person on file can be named. */
  unidentified?: string | null;
  /** Why a ward refers someone not in its beds, kept with the ward it was answered for. */
  notOnWard?: { unitId: string; reason: NotOnSendingWardReason };
};

export type CommunityNeeds = Omit<Extract<ReferralNeeds, { kind: "community" }>, "kind">;
export type EdNeeds = Omit<Extract<ReferralNeeds, { kind: "ed" }>, "kind">;

/** The needs card's answers as the record holds them, for the destination chosen. */
export function needsFor(
  destination: DrawerCategory,
  community: CommunityNeeds,
  ed: EdNeeds,
): ReferralNeeds | undefined {
  if (destination === "community") return { kind: "community", ...community };
  if (destination === "ed") return { kind: "ed", ...ed };
  return undefined;
}

/** The pick key for a person: their open movement when they have one, else the record itself. */
export function patientKeyFor(
  patientId: string,
  record: { movements: Movement[]; patients: Patient[]; referrals: Referral[] },
): string | null {
  if (!record.patients.some((patient) => patient.id === patientId)) return null;
  const open = record.movements.find(
    (movement) => !movement.closure && resolveSubjectPatient(movement, record).patient?.id === patientId,
  );
  return open ? open.id : `${PATIENT_KEY_PREFIX}${patientId}`;
}

/** The "Where this case is" link asks through the drawer's own dialog, so this guard leaves it alone. */
export const isOwnLeaveGuardAnchor = (anchor: HTMLAnchorElement) => anchor.hasAttribute("data-own-leave-guard");

export type WardReferralDrawerContentProps = WardReferralDrawerProps & {
  view: DrawerView;
  onViewChange: (view: DrawerView) => void;
  onRestart: () => void;
};
