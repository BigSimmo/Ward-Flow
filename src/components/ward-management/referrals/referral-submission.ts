import { HEALTH_SERVICES, TRAVEL_MODES, type HealthService, type ReferralGender, type TravelMode } from "../ward-model";
import { isSyntheticReferralTimelineBase } from "../ward-referral-seed-time";
import { clockZoneLabel, type ClockZoneLabel } from "../ward-clock";
import {
  CLEARANCE_CHECKS,
  CLEARANCE_CHECK_LABELS,
  CLEARANCE_STATUSES,
  CLEARANCE_STATUS_LABELS,
  type ClearanceChecklist,
} from "./referral-clearance-checks";

/**
 * WS-01 (workflow speed audit, 26 Oct 2026): the gender picker's explicit "Not yet recorded"
 * answer, kept apart from "" (nobody has answered). The same split as the ED board's own picker
 * (`GENDER_NOT_RECORDED_VALUE`, `ed/ed-screen-model.ts`), restated here so the drawer does not load
 * the ED screen model. It is sent as no gender, as "" used to be.
 */
export const REFERRAL_GENDER_NOT_RECORDED = "not_recorded";
/** WS-01: the Send refusal while a ward referral's gender identity is unanswered. */
export const GENDER_UNANSWERED = 'Choose the gender identity, or "Not yet recorded".';
/** A9-10: the Send refusal while a ward referral's bed security is unanswered. */
export const BED_SECURITY_UNANSWERED = "Choose the bed security.";
/** The drawer's gender answer: unanswered (""), not yet recorded, or a recorded gender. */
export type ReferralGenderAnswer = ReferralGender | "" | typeof REFERRAL_GENDER_NOT_RECORDED;

/** The recorded gender an answer sends: none for unanswered or not yet recorded. */
export function referralGenderOf(answer: ReferralGenderAnswer): ReferralGender | undefined {
  return answer === "" || answer === REFERRAL_GENDER_NOT_RECORDED ? undefined : answer;
}

export const CHART_MAX_BYTES = 2 * 1024 * 1024;
export const CHART_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg"] as const;
// `securityEscort` (Josh, 9 Nov 2026, care plans and safety flags thread: defaults approved).
export const REFERRAL_RISK_FLAGS = [
  "aggression",
  "absconding",
  "medical",
  "vulnerable",
  "suicide",
  "securityEscort",
] as const;

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

export {
  CLEARANCE_CHECKS,
  CLEARANCE_CHECK_LABELS,
  CLEARANCE_STATUSES,
  CLEARANCE_STATUS_LABELS,
  type ClearanceChecklist,
};

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
      /** Clock time as typed, "HH:MM" on the board's clock (AWST signed in, demo time in the demo). */
      expectedArrival?: string;
    };

/**
 * "First contact within 72 hours, Home visit". Unanswered items are left out. `zone` is the board's
 * clock words (`useClockZoneLabel`, F-113): "AWST" signed in, "demo time" in the demo.
 */
export function referralNeedsWords(needs: ReferralNeeds, zone: ClockZoneLabel = clockZoneLabel(false)): string[] {
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
    needs.expectedArrival ? `Expected ${needs.expectedArrival} ${zone}` : "",
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
  /**
   * Finding 40 (Josh, 27 Oct 2026): `notKnown` records "Catchment not known" for a ward or ED
   * referral, with the team left blank. The letter says so. A community team referral still needs
   * the team (`RECEIVE_REFERRAL` refuses it).
   *
   * Form rule (design audit FORM-REF, Josh, 5 Nov 2026): the catchment warns, never blocks. A
   * referral sent before anyone confirmed it carries `confirmed: false`, with the suggested team
   * (or none), and every letter says it is not confirmed.
   */
  catchment: { teamName: string; service?: HealthService; confirmed: boolean; notKnown?: true };
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
  /**
   * A9-06: a referral to a community team asks for no charts (D-77, the short form has no charts
   * step), so it says so here and the charts rule is not applied. RECEIVE_REFERRAL accepts it only
   * when every recipient is a community team.
   */
  chartsNotNeeded?: true;
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
 * so the send footer and the field errors agree ("Enter your phone number", never "Enter your name,
 * role and location" once the name is in).
 *
 * Finding 44 (Josh, 27 Oct 2026): the email never blocks a send. Name and a callable phone number
 * stay required, so the receiving desk can always ring back.
 */
export function referralContactError(contact: ReferralContact): string | null {
  if (!onlyFields(contact, ["name", "email", "phone", "role", "location"]) || typeof contact.email !== "string")
    return `${CONTACT_MISSING_PREFIX}name, phone number, role and location or service.`;
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const missing: string[] = [];
  if (!text(contact.name).trim()) missing.push("name");
  if (!PHONE_FORMAT.test(text(contact.phone)) || text(contact.phone).replace(/\D/g, "").length < 8)
    missing.push("phone number");
  if (!text(contact.role).trim()) missing.push("role");
  if (!text(contact.location).trim()) missing.push("location or service");
  if (missing.length) return `${CONTACT_MISSING_PREFIX}${joinAnd(missing)}.`;
  return referralContactLimitError(contact);
}

/**
 * Form rule (design audit FORM-REF, Josh, 5 Nov 2026): the referrer's contact details warn, never
 * block, so a referral sends with any of them blank. `referralContactError` above names what is
 * still missing for the warning. Only the shape and the length limits refuse a send, here and at the
 * engine boundary.
 */
function referralContactLimitError(contact: ReferralContact): string | null {
  if (
    !onlyFields(contact, ["name", "email", "phone", "role", "location"]) ||
    [contact.name, contact.email, contact.phone, contact.role, contact.location].some(
      (value) => typeof value !== "string",
    )
  )
    return "Check your contact details.";
  if ([contact.name, contact.role, contact.location].some((v) => v.length > 200))
    return "Shorten your name, role or location to 200 characters.";
  if (contact.email.length > 254) return "Shorten your email to 254 characters.";
  if (contact.phone.length > 40) return "Shorten your phone number to 40 characters.";
  return null;
}

/** The characters a phone number may hold, on the form and at the send boundary. */
const PHONE_FORMAT = /^[+\d\s().-]+$/;

/**
 * Audit M39 (Josh, 10 Nov 2026): a phone number may be left blank or part typed (FORM-REF warns about
 * both), but one that is typed must be a phone number: the form's own characters and at least one
 * digit. Checked when a referral is sent, by the drawer and by the engine, so a hostile client cannot
 * store a link or a script as the number to ring. Stored and older referrals are not re-checked.
 */
export function referrerPhoneError(phone: unknown): string | null {
  if (typeof phone !== "string" || phone.trim() === "") return null;
  if (PHONE_FORMAT.test(phone.trim()) && /\d/.test(phone)) return null;
  return "Enter a phone number in digits, or leave it blank.";
}

/** What refuses the drawer's Send for the contact: the limits, then a typed phone that is not one. */
export function referralContactSendError(contact: ReferralContact): string | null {
  return referralContactLimitError(contact) ?? referrerPhoneError(contact.phone);
}

/** Finding 40: the words a letter shows for the catchment, flagging "Catchment not known". */
export function referralCatchmentWords(catchment: ReferralIntakeDetails["catchment"]): string {
  if (catchment.notKnown) return "Catchment not known";
  // FORM-REF: sent before anyone confirmed it, so the letter says so rather than "confirmed".
  if (!catchment.confirmed)
    return catchment.teamName.trim() ? `${catchment.teamName} · not confirmed` : "Catchment not confirmed";
  return `${catchment.teamName} · confirmed${catchment.service ? ` · ${catchment.service}` : ""}`;
}

/** Finding 44: the referrer's phone, then their email only when one was given. */
export function referrerContactWords(referrer: Pick<ReferralContact, "phone" | "email">): string {
  return referrer.email.trim() ? `${referrer.phone} · ${referrer.email}` : referrer.phone;
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
      "chartsNotNeeded",
      "additionalDocuments",
      "referrer",
      "arrival",
      "clearanceChecklist",
      "needs",
    ]) ||
    !onlyFields(intake.catchment, ["teamName", "service", "confirmed", "notKnown"]) ||
    typeof intake.catchment.confirmed !== "boolean" ||
    (intake.catchment.notKnown !== undefined &&
      (intake.catchment.notKnown !== true || intake.catchment.confirmed !== true)) ||
    typeof intake.catchment.teamName !== "string" ||
    // FORM-REF: an unconfirmed catchment may carry the suggested team or none; a confirmed one names it.
    (intake.catchment.notKnown
      ? intake.catchment.teamName !== ""
      : intake.catchment.confirmed && !intake.catchment.teamName.trim()) ||
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
  // FORM-REF (Josh, 5 Nov 2026): whether clearance is complete is still asked, but the expected time
  // and the clarification contact warn, never block. Each one given must still be readable.
  if (
    !medical.cleared &&
    ((medical.expectedAt !== undefined &&
      (typeof medical.expectedAt !== "string" || !Number.isFinite(Date.parse(medical.expectedAt)))) ||
      (medical.contactName !== undefined &&
        (typeof medical.contactName !== "string" || medical.contactName.length > 200)) ||
      (medical.contactPhone !== undefined &&
        (typeof medical.contactPhone !== "string" || medical.contactPhone.length > 40)))
  )
    return "Check the expected medical clearance time and the clarification contact.";
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
  if (intake.chartsNotNeeded !== undefined) {
    // A9-06: a community team referral carries no charts, none to follow and no other document.
    if (
      intake.chartsNotNeeded !== true ||
      intake.charts.length > 0 ||
      toFollow !== undefined ||
      intake.additionalDocuments
    )
      return "A community team referral carries no charts.";
  } else if (!ready("medication") || !ready("observation"))
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
  return referralContactLimitError(intake.referrer);
}
