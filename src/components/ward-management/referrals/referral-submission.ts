import { HEALTH_SERVICES, type HealthService } from "../ward-model";

export const CHART_MAX_BYTES = 2 * 1024 * 1024;
export const CHART_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg"] as const;
export const REFERRAL_RISK_FLAGS = ["aggression", "absconding", "medical", "vulnerable", "suicide"] as const;

export type ReferralChart = {
  kind: "medication" | "observation" | "other";
  name: string;
  mimeType: (typeof CHART_MIME_TYPES)[number];
  sizeBytes: number;
  /** Actual selected file, retained in the synthetic session only; never browser storage. */
  base64: string;
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
export const ED_ARRIVAL_MODES = ["Ambulance", "Mental Health Transport", "Family or carer"] as const;
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
      comingBy?: (typeof ED_ARRIVAL_MODES)[number];
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
    needs.comingBy ? `Coming by ${needs.comingBy.toLowerCase()}` : "",
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

export type ReferralContact = { name: string; email: string; phone: string; role: string; location: string };

export type ReferralIntakeDetails = {
  catchment: { teamName: string; service?: HealthService; confirmed: true };
  reasonForReferral: string;
  legalStatus: string;
  riskFlags: (typeof REFERRAL_RISK_FLAGS)[number][];
  medicalClearance: { cleared: boolean; expectedAt?: string; contactName?: string; contactPhone?: string };
  triageAndRampCompleted: boolean;
  charts: ReferralChart[];
  additionalDocuments: boolean;
  referrer: ReferralContact;
  arrival?: { transport: string; reference: string; estimatedAt?: string };
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
    (needs.comingBy !== undefined && !ED_ARRIVAL_MODES.includes(needs.comingBy)) ||
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

export function referralContactError(contact: ReferralContact): string | null {
  if (
    !onlyFields(contact, ["name", "email", "phone", "role", "location"]) ||
    [contact.name, contact.role, contact.location].some((v) => typeof v !== "string" || !v.trim() || v.length > 200)
  )
    return "Enter your name, role and location / service.";
  if (
    typeof contact.email !== "string" ||
    contact.email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)
  )
    return "Enter a valid email address.";
  if (
    typeof contact.phone !== "string" ||
    contact.phone.length > 40 ||
    !/^[+\d\s().-]+$/.test(contact.phone) ||
    contact.phone.replace(/\D/g, "").length < 8
  )
    return "Enter a valid contact phone number.";
  return null;
}

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
    intake.reasonForReferral.length > 1000 ||
    typeof intake.legalStatus !== "string" ||
    intake.legalStatus.length > 100
  )
    return "Clinical presentation is invalid or too long.";
  if (!Array.isArray(intake.riskFlags) || intake.riskFlags.some((flag) => !REFERRAL_RISK_FLAGS.includes(flag)))
    return "Choose recorded risk flags.";
  const medical = intake.medicalClearance;
  if (
    !onlyFields(medical, ["cleared", "expectedAt", "contactName", "contactPhone"]) ||
    typeof medical.cleared !== "boolean"
  )
    return "Answer medical clearance.";
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
      typeof chart.base64 !== "string" ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(chart.base64) ||
      chart.base64.length !== 4 * Math.ceil(chart.sizeBytes / 3)
    )
      return "Charts must be nonempty PDF, PNG or JPEG files up to 2 MB.";
  }
  if (new Set(intake.charts.map((chart) => chart.kind)).size !== intake.charts.length)
    return "Attach one file per document row.";
  if (
    !intake.charts.some((chart) => chart.kind === "medication") ||
    !intake.charts.some((chart) => chart.kind === "observation")
  )
    return "Attach the medication and observation charts.";
  if (intake.additionalDocuments && !intake.charts.some((chart) => chart.kind === "other"))
    return "Attach the additional document or choose No.";
  if (!intake.additionalDocuments && intake.charts.some((chart) => chart.kind === "other"))
    return "Confirm the additional document.";
  if (
    intake.arrival &&
    (!onlyFields(intake.arrival, ["transport", "reference", "estimatedAt"]) ||
      typeof intake.arrival.transport !== "string" ||
      intake.arrival.transport.length > 100 ||
      typeof intake.arrival.reference !== "string" ||
      intake.arrival.reference.length > 200 ||
      (intake.arrival.estimatedAt !== undefined && !Number.isFinite(Date.parse(intake.arrival.estimatedAt))))
  )
    return "Check the proposed arrival plan.";
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
