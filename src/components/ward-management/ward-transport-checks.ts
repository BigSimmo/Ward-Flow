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
import { legalFormNowWords } from "@/components/ward-management/legal-forms/legal-form-progression";
import { originSiteCode } from "@/components/ward-management/ward-movement-origin";
import {
  legalNowTransportStatus,
  packRequirement,
  TRANSPORT_ORDER_PATTERN,
  TRANSPORT_PAPERWORK_STATUS_WORDS,
  transportOrderMissing,
  transportOrderOnFile,
} from "@/components/ward-management/ward-transport-paperwork";
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
  type Unit,
} from "@/components/ward-management/ward-model";

/** The paperwork rule's reads, kept importable from here (`ward-transport-paperwork.ts`). */
export { legalNowTransportStatus, packRequirement };

export const TRANSPORT_EXCEPTION_GAP_LABELS: Record<TransportExceptionGap, string> = {
  legal_status_differs: "Transport status differs from Legal now",
  // D-170 item 5: no form number. D-189 item 8(b): the paperwork table is not signed, so the check
  // says so (`ward-transport-paperwork.ts`).
  transport_order_missing: `Transport or transfer order not uploaded · ${TRANSPORT_PAPERWORK_STATUS_WORDS}`,
  fit_to_travel_missing: "Fit to travel not recorded",
};

/** The step an exception was recorded at, in words: one label per step, never "Booked" for all. */
export const TRANSPORT_EXCEPTION_STEP_LABELS: Record<TransportException["step"], string> = {
  booked: "Booked",
  handover_ready: "Handover ready",
  collected: "Collected",
  arrived: "Arrived",
};

export const TRANSPORT_EXCEPTION_REASON_LABELS: Record<TransportExceptionReason, string> = {
  paper_sighted: "Paper copy sighted",
  treating_team_confirmed: "Confirmed with the treating team",
  urgent_to_follow: "Urgent move, record to follow",
};

/**
 * Legal now in words for the booking form: the status and the form, from the one current legal
 * position (1.1, K1): the form as recorded, or "Form 3B ended" once a person records its end.
 */
export function legalNowText(movement: Pick<Movement, "legalStatus" | "legalForm">): string {
  if (movement.legalStatus === undefined) return "Legal status not recorded";
  const form = legalFormNowWords(movement);
  return form ? `${movement.legalStatus}, ${form}` : movement.legalStatus;
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
  // The one order matcher (D-186 item 6): Form 4A or 4C, from the paperwork rule.
  order: TRANSPORT_ORDER_PATTERN,
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

/** The fields the paperwork rule reads from a movement: status, booking, forms and both sites. */
export type TransportPaperworkRecord = Pick<
  Movement,
  "legalStatus" | "transport" | "legalForm" | "uploadedForms" | "originEdId" | "originCommunity" | "acceptedUnitId"
> &
  Partial<Pick<Movement, "referredUnitIds">>;

/** The live wards a caller holds (`state.units`), read for a destination's site. */
export type TransportSiteUnits = readonly Pick<Unit, "id" | "siteCode">[];

/**
 * Both ends of a move as site codes: the origin's, and the accepted (else first referred) ward's,
 * read from the caller's live `units` (never the frozen fixture). A ward not in them leaves the
 * destination unknown, and the paperwork rule then asks for the order.
 */
export function movementTransportSiteCodes(
  movement: TransportPaperworkRecord,
  units: TransportSiteUnits,
): {
  origin: string | undefined;
  destination: string | undefined;
} {
  const destinationId = movement.acceptedUnitId ?? movement.referredUnitIds?.[0];
  return {
    origin: originSiteCode(movement),
    destination: destinationId === undefined ? undefined : units.find((unit) => unit.id === destinationId)?.siteCode,
  };
}

/** The paperwork rule for this movement: an order is needed and none is recorded or uploaded. */
export function transportOrderGap(movement: TransportPaperworkRecord, units: TransportSiteUnits): boolean {
  const sites = movementTransportSiteCodes(movement, units);
  return transportOrderMissing(movement, sites.origin, sites.destination);
}

/**
 * The order fact a crew reads (Movements check-in drawer): the same one rule as the collection
 * check, so a person who passes it never reads "Not recorded" here (review R3, D-189 item 8(b)).
 */
export function transportOrderFactWords(movement: TransportPaperworkRecord, units: TransportSiteUnits): string {
  const value = transportOrderGap(movement, units)
    ? "Not recorded"
    : transportOrderOnFile(movement)
      ? "Recorded"
      : "Not needed";
  return `${value} · ${TRANSPORT_PAPERWORK_STATUS_WORDS}`;
}

/**
 * The checks still open when the patient is collected: the transport or transfer order, from the
 * one paperwork rule (A4-11, D-186 item 6), and fit to travel (S-2). Each is a warning with a
 * recorded reason.
 */
export function collectionGaps(
  movement: TransportPaperworkRecord & Pick<Movement, "medicalClearance">,
  units: TransportSiteUnits,
): TransportExceptionGap[] {
  const gaps: TransportExceptionGap[] = [];
  if (transportOrderGap(movement, units)) gaps.push("transport_order_missing");
  if (movement.medicalClearance?.cleared !== true) gaps.push("fit_to_travel_missing");
  return gaps;
}

/**
 * D-187 item 10 (Q31): fit to travel at booking and at Mark handover ready. Without medical
 * clearance recorded the screen asks for a reason every time; neither step is blocked, and the
 * engine accepts the press without one (D-189 item 9(e)).
 */
export type FitToTravelClearance = Pick<NonNullable<Movement["medicalClearance"]>, "cleared"> | undefined;

export function fitToTravelGaps(clearance: FitToTravelClearance): TransportExceptionGap[] {
  return clearance?.cleared === true ? [] : ["fit_to_travel_missing"];
}

/**
 * The checks open at Mark handover ready: fit to travel, for a journey with a live transport job.
 * A journey with no transport job is asked at arrival instead (`arrivalGaps`), so it is not asked
 * twice, and the reason is kept on the job it describes.
 */
export function handoverReadyGaps(
  movement: Pick<Movement, "transport" | "medicalClearance">,
  clearance: FitToTravelClearance = movement.medicalClearance,
): TransportExceptionGap[] {
  if (movement.transport === undefined || movement.transport.cancelledAt !== undefined) return [];
  return fitToTravelGaps(clearance);
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
 * `undefined` when the time cannot be read or no day is chosen.
 */
export function instantFromEstimatedTimeInputs(
  timeValue: string,
  day: "today" | "tomorrow" | undefined,
  now: Instant,
): number | undefined {
  const minuteOfDay = minutesFromTimeInput(timeValue);
  // No day chosen yet (Josh, 31 Oct 2026: the booking form starts with neither Today nor Tomorrow).
  if (minuteOfDay === undefined || day === undefined) return undefined;
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
  /**
   * Josh, 31 Oct 2026 (yes): the booking form starts with nothing chosen, so neither Today nor
   * Tomorrow is ticked until the person picks one. `undefined` is a missing answer.
   */
  estimatedDay?: "today" | "tomorrow";
};

/** What each unanswered booking question asks, in the order the popups show them. */
const TRANSPORT_ANSWER_ASKS = {
  provider: "choose who is collecting the patient",
  time: "enter the estimated time",
  day: "choose today or tomorrow",
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
  // Form rule (design audit W32, Josh's card 3, 5 Nov 2026): a blank estimated time warns
  // (`transportAnswerWarnings`). A typed time must still be readable and have its day (Josh, 31 Oct
  // 2026), so a half-given time is a wrong answer and still blocks.
  if (draft.estimatedTime.trim()) {
    if (instantFromEstimatedTimeInputs(draft.estimatedTime, draft.estimatedDay ?? "today", now) === undefined)
      missing.push("time");
    if (draft.estimatedDay === undefined) missing.push("day");
  }
  if (draft.escortRequired === undefined) missing.push("escort");
  if (draft.transportLegalStatus === undefined) missing.push("legalStatus");
  return missing;
}

/** W32: what a booking is logged without, as warnings. Booking still goes ahead. */
export function transportAnswerWarnings(draft: TransportBookingAnswers): string[] {
  return draft.estimatedTime.trim() ? [] : ["estimated time"];
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
