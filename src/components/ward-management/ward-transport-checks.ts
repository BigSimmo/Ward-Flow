/**
 * Transport checks (audit fixes, 13 Oct 2026). Pure reads of the movement record, shared by the
 * patient page, the transport officer page and the engine, so each surface reads one rule.
 *
 * Nothing here blocks a step. A check that is not met is shown as a warning, and a person who goes
 * ahead records which checks were open and a coded reason (`TransportException`).
 */
import { cadNumberProblem, providerNeedsCadNumber } from "@/components/ward-management/ward-cad-number";
import { minuteOfDayFromClockText, MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import {
  TRANSPORT_EXCEPTION_GAPS,
  TRANSPORT_EXCEPTION_REASONS,
  type Movement,
  type MovementUploadedForm,
  type TransportException,
  type TransportExceptionGap,
  type TransportExceptionReason,
  type TransportLegalStatus,
  type TransportProvider,
} from "@/components/ward-management/ward-model";

export const TRANSPORT_EXCEPTION_GAP_LABELS: Record<TransportExceptionGap, string> = {
  legal_status_differs: "Transport status differs from Legal now",
  transport_order_missing: "Form 4A transport order not uploaded",
  fit_to_travel_missing: "Fit to travel not recorded",
};

export const TRANSPORT_EXCEPTION_REASON_LABELS: Record<TransportExceptionReason, string> = {
  paper_sighted: "Paper copy sighted",
  treating_team_confirmed: "Confirmed with the treating team",
  urgent_to_follow: "Urgent move, record to follow",
};

/**
 * The transport status the legal form in force gives (Legal now). A voluntary patient travels
 * voluntarily; a person referred, detained or an involuntary inpatient travels involuntarily.
 * Undefined only when the record holds no legal status at all.
 */
export function legalNowTransportStatus(movement: Pick<Movement, "legalStatus">): TransportLegalStatus | undefined {
  if (movement.legalStatus === undefined) return undefined;
  return movement.legalStatus === "Voluntary" ? "voluntary" : "involuntary";
}

/** Legal now in words for the booking form: the status and the form in force, if any. */
export function legalNowText(movement: Pick<Movement, "legalStatus" | "legalForm">): string {
  if (movement.legalStatus === undefined) return "Legal status not recorded";
  return movement.legalForm ? `${movement.legalStatus}, Form ${movement.legalForm.code}` : movement.legalStatus;
}

/** True when a booked transport status disagrees with Legal now. */
export function transportStatusClashes(
  movement: Pick<Movement, "legalStatus">,
  status: TransportLegalStatus | undefined,
): boolean {
  const inForce = legalNowTransportStatus(movement);
  return status !== undefined && inForce !== undefined && status !== inForce;
}

/* ------------------------------------------------------------------ forms pack */

export type PackSlotKey = "legal" | "order" | "risk";

export const PACK_SLOT_PATTERN: Record<PackSlotKey, RegExp> = {
  legal: /\bForm\s*(1A|1B|3D)\b/i,
  order: /\bForm\s*4A\b/i,
  risk: /\brisk assessment\b/i,
};

/** The latest recorded form that fills a slot, if any. */
export function packForm(
  movement: Pick<Movement, "uploadedForms">,
  key: PackSlotKey,
): MovementUploadedForm | undefined {
  const forms = movement.uploadedForms ?? [];
  for (let index = forms.length - 1; index >= 0; index -= 1) {
    if (PACK_SLOT_PATTERN[key].test(forms[index]!.formName)) return forms[index];
  }
  return undefined;
}

/**
 * Whether this job needs the transport forms pack, read from the legal form in force (Legal now)
 * and the booking. Josh, 9 Oct 2026: a voluntary transfer needs no forms; an unrecorded status
 * still needs the pack. Audit A4-12: Legal now decides first, so an unrecorded booking for a
 * voluntary patient no longer asks for Form 1A and 4A. "unknown" is a job with no status anywhere.
 */
export function packRequirement(
  movement: Pick<Movement, "legalStatus" | "transport">,
): "required" | "not_required" | "unknown" {
  const inForce = legalNowTransportStatus(movement);
  const booked = movement.transport?.transportLegalStatus;
  if (inForce === "involuntary" || booked === "involuntary") return "required";
  if (inForce === "voluntary" || booked === "voluntary") return "not_required";
  return "unknown";
}

/* ------------------------------------------------------------------ bed hold and ETA */

/** The bed hold's end when the quoted ETA falls after it, so the booker can extend or rebook. */
export function holdEndsBeforeEta(
  movement: Pick<Movement, "pullExpiresAt">,
  etaAt: Instant | undefined,
): Instant | undefined {
  const holdEnd = movement.pullExpiresAt;
  if (holdEnd === undefined || etaAt === undefined) return undefined;
  return etaAt > holdEnd ? holdEnd : undefined;
}

/* ------------------------------------------------------------------ collection */

/**
 * The checks still open when the patient is collected: the Form 4A transport order for a job that
 * needs the pack (A4-11), and fit to travel (S-2). Each is a warning with a recorded reason.
 */
export function collectionGaps(
  movement: Pick<Movement, "legalStatus" | "transport" | "uploadedForms" | "medicalClearance">,
): TransportExceptionGap[] {
  const gaps: TransportExceptionGap[] = [];
  if (packRequirement(movement) !== "not_required" && packForm(movement, "order") === undefined)
    gaps.push("transport_order_missing");
  if (movement.medicalClearance?.cleared !== true) gaps.push("fit_to_travel_missing");
  return gaps;
}

/**
 * Audit r1 item 4: a journey with no transport leg (nobody collected the patient) is never asked
 * fit to travel at Collected, so arrival asks instead. A warning with a recorded reason, never a block.
 */
export function arrivalGaps(movement: Pick<Movement, "transport" | "medicalClearance">): TransportExceptionGap[] {
  if (movement.transport?.collectedAt !== undefined) return [];
  return movement.medicalClearance?.cleared === true ? [] : ["fit_to_travel_missing"];
}

/**
 * The engine's check of a submitted exception: known gaps, at least one, and a known reason.
 * Returns the record to store, or the refusal reason.
 */
export function transportExceptionRecord(
  input: { gaps: unknown; reason: unknown },
  at: Instant,
  by: WardFlowRole,
  step: TransportException["step"],
): TransportException | string {
  const gaps = input.gaps;
  if (
    !Array.isArray(gaps) ||
    gaps.length === 0 ||
    !gaps.every((gap) => (TRANSPORT_EXCEPTION_GAPS as readonly unknown[]).includes(gap))
  )
    return "exception gaps must be chosen from TRANSPORT_EXCEPTION_GAPS";
  if (!(TRANSPORT_EXCEPTION_REASONS as readonly unknown[]).includes(input.reason))
    return "exception reason must be chosen from TRANSPORT_EXCEPTION_REASONS";
  return {
    at,
    by,
    step,
    gaps: [...new Set(gaps as TransportExceptionGap[])],
    reason: input.reason as TransportExceptionReason,
  };
}

/** One line per recorded exception, for the job and the movement: "Collected 10:42: ... Reason". */
export function transportExceptionText(exception: TransportException): string {
  const gaps = exception.gaps.map((gap) => TRANSPORT_EXCEPTION_GAP_LABELS[gap]).join("; ");
  return `${gaps}. ${TRANSPORT_EXCEPTION_REASON_LABELS[exception.reason]}`;
}

/* ------------------------------------------------------------------------------------------- *
 * Transport booking answers, shared by the ED, community and out-of-area booking popups.
 * ------------------------------------------------------------------------------------------- */

/**
 * `HH:MM`, or digits only ("0930", the iPhone number pad has no ":"), to minutes since midnight.
 * Refuses rather than guesses: a blank or malformed time returns `undefined`, never a made-up value.
 */
export function minutesFromTimeInput(value: string): number | undefined {
  return minuteOfDayFromClockText(value);
}

/**
 * A typed `HH:MM` plus "today" or "tomorrow" (owner's third ruling, 2026-09-17: a time read off a
 * phone call, not a date picker) as an `Instant`, finding "today" by rounding `now` down to its day.
 * `undefined` when the time cannot be read.
 */
export function instantFromEstimatedTimeInputs(
  timeValue: string,
  day: "today" | "tomorrow",
  now: Instant,
): number | undefined {
  const minuteOfDay = minutesFromTimeInput(timeValue);
  if (minuteOfDay === undefined) return undefined;
  const startOfToday = Math.floor(now / MINUTES_PER_DAY) * MINUTES_PER_DAY;
  return startOfToday + (day === "tomorrow" ? MINUTES_PER_DAY : 0) + minuteOfDay;
}

/**
 * The patient page's free-text arrival estimate. Up to three digits is minutes from now ("45",
 * "~45m", "+30", "45 min"). Anything else is a clock time read by the same rule as every other
 * time box on the site, with "tomorrow" and "AWST" allowed around it ("0930", "9:30 tomorrow").
 * Returns undefined rather than guessing.
 */
export function instantFromEtaText(value: string, now: Instant): number | undefined {
  const clean = value.trim();
  if (!clean) return undefined;
  const relative = /^[~+]?\s*(\d{1,3})\s*(?:m|min|mins|minutes)?$/i.exec(clean);
  if (relative) return now + Number(relative[1]);
  const day = /tomorrow/i.test(clean) ? "tomorrow" : "today";
  const clockText = clean
    .replace(/\s*tomorrow\s*/i, " ")
    .replace(/\s*AWST\s*/i, " ")
    .trim();
  return instantFromEstimatedTimeInputs(clockText, day, now);
}

/** The answers a transport booking popup collects. `undefined` and `""` mean not yet answered. */
export type TransportBookingAnswers = {
  provider: TransportProvider | undefined;
  escortRequired: boolean | undefined;
  cadNumber: string;
  transportLegalStatus: TransportLegalStatus | undefined;
  estimatedTime: string;
  estimatedDay: "today" | "tomorrow";
};

/** What each unanswered booking question asks, in the order the popups show them. */
const TRANSPORT_ANSWER_ASKS = {
  provider: "choose who is collecting the patient",
  time: "enter the estimated time",
  escort: "answer the escort question",
  legalStatus: "state whether the transport is voluntary or involuntary",
} as const;

export type TransportAnswer = keyof typeof TRANSPORT_ANSWER_ASKS;

/**
 * Whether a booking with this draft's chosen provider will show "CAD to follow" if saved now: a
 * dispatched service with no number typed. A warning beside the box, never a missing answer.
 */
export function transportCadToFollow(draft: Pick<TransportBookingAnswers, "provider" | "cadNumber">): boolean {
  return draft.provider !== undefined && providerNeedsCadNumber(draft.provider) && draft.cadNumber.trim().length === 0;
}

/**
 * The booking questions still unanswered, in the popup's order. Blocker mock-up (Josh approved 26
 * Oct 2026): the ED popup names them and moves to the first. The CAD number is not one of them:
 * a blank books as "CAD to follow" (Josh, 27 Oct 2026), and a typed number the rule refuses is a
 * wrong answer, not a missing one.
 */
export function transportAnswersMissing(draft: TransportBookingAnswers, now: Instant): TransportAnswer[] {
  const missing: TransportAnswer[] = [];
  if (draft.provider === undefined) missing.push("provider");
  if (instantFromEstimatedTimeInputs(draft.estimatedTime, draft.estimatedDay, now) === undefined) missing.push("time");
  if (draft.escortRequired === undefined) missing.push("escort");
  if (draft.transportLegalStatus === undefined) missing.push("legalStatus");
  return missing;
}

/**
 * Why the booking confirm control is unavailable, or `undefined` when every answer is in. Owner's
 * third ruling, 2026-09-17: the CAD number, legal status and time are read off the phone call and
 * none is filled in for the person booking.
 */
export function transportAnswersBlockedReason(draft: TransportBookingAnswers, now: Instant): string | undefined {
  const missing = transportAnswersMissing(draft, now).map((answer) => TRANSPORT_ANSWER_ASKS[answer]);
  const cadProblem = draft.cadNumber.trim().length > 0 ? cadNumberProblem(draft.cadNumber) : undefined;
  // A typed CAD number the rule refuses is a wrong answer, not a missing one, so it gets its own
  // sentence rather than the list of answers still to give.
  const refused = cadProblem !== undefined ? cadNumberSentence(cadProblem) : "";
  if (missing.length === 0) return refused || undefined;
  const unanswered = `Before booking, ${missing.join(", ")}.`;
  return refused ? `${refused} ${unanswered}` : unanswered;
}

/** The CAD rule's reason as a sentence for a form, e.g. "The CAD number looks like a placeholder, ...". */
export function cadNumberSentence(problem: string): string {
  return `${problem.charAt(0).toUpperCase()}${problem.slice(1)}.`;
}
