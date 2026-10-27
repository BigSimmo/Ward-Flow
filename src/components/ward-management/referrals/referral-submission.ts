import { HEALTH_SERVICES, TRAVEL_MODES, type HealthService, type ReferralGender, type TravelMode } from "../ward-model";
import { isSyntheticReferralTimelineBase } from "../ward-referral-seed-time";

/**
 * WS-01 (workflow speed audit, 26 Oct 2026): the gender picker's explicit "Not yet recorded"
 * answer, kept apart from "" (nobody has answered). The same split as the ED board's own picker
 * (`GENDER_NOT_RECORDED_VALUE`, `ed/ed-screen-model.ts`), restated here so the drawer does not load
 * the ED screen model. It is sent as no gender, as "" used to be.
 */
export const REFERRAL_GENDER_NOT_RECORDED = "not_recorded";
/** WS-01: the Send refusal while a ward referral's gender identity is unanswered. */
export const GENDER_UNANSWERED = 'Choose the gender identity, or "Not yet recorded".';
/** The drawer's gender answer: unanswered (""), not yet recorded, or a recorded gender. */
export type ReferralGenderAnswer = ReferralGender | "" | typeof REFERRAL_GENDER_NOT_RECORDED;

/** The recorded gender an answer sends: none for unanswered or not yet recorded. */
export function referralGenderOf(answer: ReferralGenderAnswer): ReferralGender | undefined {
  return answer === "" || answer === REFERRAL_GENDER_NOT_RECORDED ? undefined : answer;
}

export const CHART_MAX_BYTES = 2 * 1024 * 1024;
export const CHART_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg"] as const;
export const REFERRAL_RISK_FLAGS = ["aggression", "absconding", "medical", "vulnerable", "suicide"] as const;

export type ReferralChart = {
  kind: "medication" | "observation" | "other";
  name: string;
  mimeType: (typeof CHART_MIME_TYPES)[number];
  sizeBytes: number;
  /**
   * Actual selected file, retained in the synthetic session only; never browser storage. Absent on
   * the shared board, which keeps only the name, type and size (audit F-01).
   */
  base64?: string;
};

/** Medical clearance, item by item (ward referrals). Each item is answered or left unrecorded. */
export const CLEARANCE_CHECKS = [
  "examination",
  "bloods",
  "ecg",
  "drugScreen",
  "breathAlcohol",
  "observations",
] as const;
export type ClearanceCheck = (typeof CLEARANCE_CHECKS)[number];
export const CLEARANCE_CHECK_LABELS: Record<ClearanceCheck, string> = {
  examination: "Physical examination",
  bloods: "Bloods",
  ecg: "ECG",
  drugScreen: "Urine drug screen",
  breathAlcohol: "Breath alcohol",
  observations: "Observations stable",
};
export const CLEARANCE_STATUSES = ["done", "to_follow", "not_done"] as const;
export type ClearanceStatus = (typeof CLEARANCE_STATUSES)[number];
export const CLEARANCE_STATUS_LABELS: Record<ClearanceStatus, string> = {
  done: "Done",
  to_follow: "To follow",
  not_done: "Not done",
};
export type ClearanceChecklist = Partial<Record<ClearanceCheck, ClearanceStatus>>;

/** What a community team or an ED needs to know before the person reaches them. All optional. */
export const FIRST_CONTACT_TARGETS = ["24 hours", "72 hours", "7 days"] as const;
/**
 * WT-13: Pull the bed now saves a `TRAVEL_MODES` word as written. A referral sent before then holds
 * one of four short codes, read here in the shared list's words; nothing chosen reads as such.
 */
const OLD_TRANSPORT_CODES: Record<string, TravelMode> = {
  mht: "Mental Health Transport",
  rfds: "RFDS",
  stjohn: "Ambulance (St John)",
  carer: "Family or carer",
};
export function transportLabel(code: string): string {
  return OLD_TRANSPORT_CODES[code] ?? (code || "Transport not chosen");
}

/** WT-13: the one travel list every screen offers (`TRAVEL_MODES`). */
export const ED_ARRIVAL_MODES = TRAVEL_MODES;
/** What a saved referral may hold: the list, plus the old "Ambulance" choice so an older referral still reads. */
export const SAVED_ED_ARRIVAL_MODES = [...TRAVEL_MODES, "Ambulance"] as const;
export type ReferralNeeds =
  | {
      kind: "community";
      firstContact?: (typeof FIRST_CONTACT_TARGETS)[number];
      homeVisit?: boolean;
      interpreter?: boolean;
      carerContact?: boolean;
    }
  | {
      kind: "ed";
      comingBy?: (typeof SAVED_ED_ARRIVAL_MODES)[number];
      medicalReviewFirst?: boolean;
      /** Clock time as typed, "HH:MM" AWST. */
      expectedArrival?: string;
    };

/** "First contact within 72 hours, Home visit". Unanswered items are left out. */
export function referralNeedsWords(needs: ReferralNeeds): string[] {
  if (needs.kind === "community")
    return [
      needs.firstContact ? `First contact within ${needs.firstContact}` : "",
      needs.homeVisit === undefined ? "" : needs.homeVisit ? "Home visit" : "No home visit",
      needs.interpreter ? "Interpreter needed" : "",
      needs.carerContact ? "Contact the carer" : "",
    ].filter(Boolean);
  return [
    needs.comingBy ? `Coming by ${needs.comingBy}` : "",
    needs.medicalReviewFirst === undefined
      ? ""
      : needs.medicalReviewFirst
        ? "Medical review before psychiatry"
        : "No medical review needed first",
    needs.expectedArrival ? `Expected ${needs.expectedArrival} AWST` : "",
  ].filter(Boolean);
}

/** "Physical examination done, Bloods to follow". Unanswered items are left out. */
export function clearanceChecklistWords(checklist: ClearanceChecklist): string {
  return CLEARANCE_CHECKS.filter((check) => checklist[check])
    .map((check) => `${CLEARANCE_CHECK_LABELS[check]} ${CLEARANCE_STATUS_LABELS[checklist[check]!].toLowerCase()}`)
    .join(", ");
}

/**
 * A27 (Josh, 26 Oct 2026): the two required charts may be marked "to follow" when they are not to
 * hand at send time. The referral then says so plainly. Nothing is chased or timed automatically.
 */
const FOLLOWABLE_CHART_KINDS = ["medication", "observation"] as const;
export type FollowableChartKind = (typeof FOLLOWABLE_CHART_KINDS)[number];

export type ReferralContact = { name: string; email: string; phone: string; role: string; location: string };

export type ReferralIntakeDetails = {
  catchment: { teamName: string; service?: HealthService; confirmed: true };
  reasonForReferral: string;
  legalStatus: string;
  riskFlags: (typeof REFERRAL_RISK_FLAGS)[number][];
  medicalClearance: {
    cleared: boolean;
    expectedAt?: string;
    contactName?: string;
    contactPhone?: string;
    /** Only generated seed targets carry their original Perth midnight for display rebasing. */
    syntheticTimelineBase?: string;
  };
  triageAndRampCompleted: boolean;
  charts: ReferralChart[];
  /** Required charts the referrer marked to follow instead of attaching (A27). Absent when none. */
  chartsToFollow?: FollowableChartKind[];
  additionalDocuments: boolean;
  referrer: ReferralContact;
  arrival?: { transport: string; reference: string; estimatedAt?: string; syntheticTimelineBase?: string };
  clearanceChecklist?: ClearanceChecklist;
  needs?: ReferralNeeds;
};

const optionalBoolean = (value: unknown) => value === undefined || typeof value === "boolean";

function needsError(needs: ReferralNeeds): string | null {
  if (needs.kind === "community") {
    if (
      !onlyFields(needs, ["kind", "firstContact", "homeVisit", "interpreter", "carerContact"]) ||
      (needs.firstContact !== undefined && !FIRST_CONTACT_TARGETS.includes(needs.firstContact)) ||
      ![needs.homeVisit, needs.interpreter, needs.carerContact].every(optionalBoolean)
    )
      return "Check the follow-up needs.";
    return null;
  }
  if (
    needs.kind !== "ed" ||
    !onlyFields(needs, ["kind", "comingBy", "medicalReviewFirst", "expectedArrival"]) ||
    (needs.comingBy !== undefined && !SAVED_ED_ARRIVAL_MODES.includes(needs.comingBy)) ||
    !optionalBoolean(needs.medicalReviewFirst) ||
    (needs.expectedArrival !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(needs.expectedArrival))
  )
    return "Check the ED needs.";
  return null;
}

function onlyFields(value: unknown, keys: readonly string[]): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).every((key) => keys.includes(key))
  );
}

/** "name", "name and email", "name, email and role". */
function joinAnd(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

const CONTACT_MISSING_PREFIX = "Enter your ";

/**
 * #823: true for the Send refusal that lists missing contact fields. The footer stops repeating it
 * once those fields are filled, so the warning clears as soon as the contact details are valid.
 */
export function isMissingContactMessage(message: string): boolean {
  return message.startsWith(CONTACT_MISSING_PREFIX);
}

/**
 * L6 (review 12 Oct 2026): the message names exactly what is still missing, in the form's order,
 * so the send footer and the field errors agree ("Enter your email", never "Enter your name, role
 * and location" once the name is in).
 */
export function referralContactError(contact: ReferralContact): string | null {
  if (!onlyFields(contact, ["name", "email", "phone", "role", "location"]))
    return `${CONTACT_MISSING_PREFIX}name, email, phone number, role and location or service.`;
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const missing: string[] = [];
  if (!text(contact.name).trim()) missing.push("name");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(contact.email))) missing.push("email");
  if (!/^[+\d\s().-]+$/.test(text(contact.phone)) || text(contact.phone).replace(/\D/g, "").length < 8)
    missing.push("phone number");
  if (!text(contact.role).trim()) missing.push("role");
  if (!text(contact.location).trim()) missing.push("location or service");
  if (missing.length) return `${CONTACT_MISSING_PREFIX}${joinAnd(missing)}.`;
  if ([contact.name, contact.role, contact.location].some((v) => v.length > 200))
    return "Shorten your name, role or location to 200 characters.";
  if (contact.email.length > 254) return "Shorten your email to 254 characters.";
  if (contact.phone.length > 40) return "Shorten your phone number to 40 characters.";
  return null;
}

/** How long the reason for referral may be, the sheet's note and any prefix it adds included. */
export const REFERRAL_REASON_MAX_CHARACTERS = 1000;

/** Validate the same envelope at the engine boundary, including callers outside this drawer. */
export function referralIntakeError(intake: ReferralIntakeDetails): string | null {
  if (
    !onlyFields(intake, [
      "catchment",
      "reasonForReferral",
      "legalStatus",
      "riskFlags",
      "medicalClearance",
      "triageAndRampCompleted",
      "charts",
      "chartsToFollow",
      "additionalDocuments",
      "referrer",
      "arrival",
      "clearanceChecklist",
      "needs",
    ]) ||
    !onlyFields(intake.catchment, ["teamName", "service", "confirmed"]) ||
    intake.catchment.confirmed !== true ||
    typeof intake.catchment.teamName !== "string" ||
    !intake.catchment.teamName.trim() ||
    intake.catchment.teamName.length > 200
  )
    return "Confirm the patient's catchment.";
  if (intake.catchment.service !== undefined && !HEALTH_SERVICES.includes(intake.catchment.service))
    return "Choose a recorded catchment service.";
  if (
    typeof intake.reasonForReferral !== "string" ||
    intake.reasonForReferral.length > REFERRAL_REASON_MAX_CHARACTERS ||
    typeof intake.legalStatus !== "string" ||
    intake.legalStatus.length > 100
  )
    return "Clinical presentation is invalid or too long.";
  if (!Array.isArray(intake.riskFlags) || intake.riskFlags.some((flag) => !REFERRAL_RISK_FLAGS.includes(flag)))
    return "Choose recorded risk flags.";
  const medical = intake.medicalClearance;
  if (
    !onlyFields(medical, ["cleared", "expectedAt", "contactName", "contactPhone", "syntheticTimelineBase"]) ||
    typeof medical.cleared !== "boolean"
  )
    return "Answer medical clearance.";
  if (medical.syntheticTimelineBase !== undefined && !isSyntheticReferralTimelineBase(medical.syntheticTimelineBase))
    return "Check the synthetic medical review timeline.";
  if (
    !medical.cleared &&
    (typeof medical.expectedAt !== "string" ||
      !Number.isFinite(Date.parse(medical.expectedAt)) ||
      typeof medical.contactName !== "string" ||
      !medical.contactName.trim() ||
      medical.contactName.length > 200 ||
      typeof medical.contactPhone !== "string" ||
      !medical.contactPhone.trim() ||
      medical.contactPhone.length > 40)
  )
    return "Record expected medical clearance, a clarification contact and their phone number.";
  if (typeof intake.triageAndRampCompleted !== "boolean" || typeof intake.additionalDocuments !== "boolean")
    return "Answer the documentation questions.";
  if (!Array.isArray(intake.charts) || intake.charts.length > 3) return "Attach up to three charts / documents.";
  for (const chart of intake.charts) {
    if (
      !onlyFields(chart, ["kind", "name", "mimeType", "sizeBytes", "base64"]) ||
      !["medication", "observation", "other"].includes(chart.kind) ||
      typeof chart.name !== "string" ||
      !chart.name.trim() ||
      chart.name.length > 255 ||
      !CHART_MIME_TYPES.includes(chart.mimeType) ||
      !Number.isInteger(chart.sizeBytes) ||
      chart.sizeBytes <= 0 ||
      chart.sizeBytes > CHART_MAX_BYTES ||
      (chart.base64 !== undefined &&
        (typeof chart.base64 !== "string" ||
          !/^[A-Za-z0-9+/]+={0,2}$/.test(chart.base64) ||
          chart.base64.length !== 4 * Math.ceil(chart.sizeBytes / 3)))
    )
      return "Charts must be nonempty PDF, PNG or JPEG files up to 2 MB.";
  }
  if (new Set(intake.charts.map((chart) => chart.kind)).size !== intake.charts.length)
    return "Attach one file per document row.";
  const toFollow = intake.chartsToFollow;
  if (
    toFollow !== undefined &&
    (!Array.isArray(toFollow) ||
      toFollow.length === 0 ||
      toFollow.some((kind) => !FOLLOWABLE_CHART_KINDS.includes(kind)) ||
      new Set(toFollow).size !== toFollow.length ||
      toFollow.some((kind) => intake.charts.some((chart) => chart.kind === kind)))
  )
    return "Mark a chart to follow only when it is not attached.";
  const ready = (kind: FollowableChartKind) =>
    intake.charts.some((chart) => chart.kind === kind) || (toFollow?.includes(kind) ?? false);
  if (!ready("medication") || !ready("observation"))
    return "Attach the medication and observation charts, or mark them to follow.";
  if (intake.additionalDocuments && !intake.charts.some((chart) => chart.kind === "other"))
    return "Attach the additional document or choose No.";
  if (!intake.additionalDocuments && intake.charts.some((chart) => chart.kind === "other"))
    return "Confirm the additional document.";
  if (
    intake.arrival &&
    (!onlyFields(intake.arrival, ["transport", "reference", "estimatedAt", "syntheticTimelineBase"]) ||
      typeof intake.arrival.transport !== "string" ||
      intake.arrival.transport.length > 100 ||
      typeof intake.arrival.reference !== "string" ||
      intake.arrival.reference.length > 200 ||
      (intake.arrival.estimatedAt !== undefined && !Number.isFinite(Date.parse(intake.arrival.estimatedAt))))
  )
    return "Check the proposed arrival plan.";
  if (
    intake.arrival?.syntheticTimelineBase !== undefined &&
    !isSyntheticReferralTimelineBase(intake.arrival.syntheticTimelineBase)
  )
    return "Check the synthetic arrival timeline.";
  const checklist = intake.clearanceChecklist;
  if (
    checklist !== undefined &&
    (!onlyFields(checklist, CLEARANCE_CHECKS) ||
      Object.values(checklist).some((status) => !CLEARANCE_STATUSES.includes(status)))
  )
    return "Check the medical clearance checklist.";
  if (intake.needs !== undefined) {
    const error =
      typeof intake.needs === "object" && intake.needs !== null ? needsError(intake.needs) : "Check the needs.";
    if (error) return error;
  }
  return referralContactError(intake.referrer);
}
