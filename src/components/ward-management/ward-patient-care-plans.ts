/**
 * Care plans, tribunal hearing dates, cultural support requests and the frequent presenter tag
 * (Josh, 9 Nov 2026, care plans and safety flags thread: defaults approved).
 *
 * Synthetic prototype only. Dates are held as typed ("YYYY-MM-DD", optional "HH:MM") and shown as
 * typed: nothing here computes a countdown or an "in N days" (D-93). A care plan attachment keeps
 * its file type and size only, never the file and never its name (the H-0049 uploaded-forms
 * precedent).
 */
import type { Instant } from "./ward-clock";
import type { WardFlowRole } from "./ward-flow-roles";
import type { UploadedFileType } from "./ward-model-vocabulary";
import { CLINICAL_VALUES } from "./ward-clinical-values";

export const CARE_PLAN_TYPES = [
  "Crisis/safety plan",
  "Frequent presenter plan",
  "Community care plan",
  "Other",
] as const;
export type CarePlanType = (typeof CARE_PLAN_TYPES)[number];

/** A short pick list of what helps. Nothing is pre-selected on the form. */
export const CARE_PLAN_HELPS = [
  "Quiet space",
  "Known staff member",
  "Family or carer involved early",
  "Clear plan explained",
  "Interpreter",
  "Cultural support",
  "Contact the community team",
] as const;
export type CarePlanHelp = (typeof CARE_PLAN_HELPS)[number];

/** Short typed fields. Refused, never shortened, over these lengths. */
export const CARE_PLAN_AGREED_BY_MAX = 60;
export const CARE_PLAN_CONTACT_NAME_MAX = 60;
export const CARE_PLAN_CONTACT_PHONE_MAX = 20;
export const CARE_PLAN_HELPS_EXTRA_MAX = 120;
/** A synthetic prototype keeps at most this many care plans per person (current plus superseded). */
export const CARE_PLAN_HISTORY_MAX = 20;

type CarePlanAttachment = {
  fileType: UploadedFileType;
  sizeBytes: number;
  addedAt: Instant;
  addedBy: WardFlowRole;
};

export type CarePlan = {
  id: string;
  type: CarePlanType;
  /** Role or team that agreed it, as typed. */
  agreedBy: string;
  /** "YYYY-MM-DD" as typed. */
  agreedOn: string;
  /** "YYYY-MM-DD" as typed. Never turned into a countdown. */
  reviewOn?: string;
  contactName?: string;
  contactPhone?: string;
  helps: CarePlanHelp[];
  /** At most one short line, as typed. */
  helpsExtra?: string;
  status: "Current" | "Superseded";
  attachment?: CarePlanAttachment;
  recordedAt: Instant;
  recordedBy: WardFlowRole;
};

/** The input a person fills in. Everything optional the form leaves blank stays absent. */
export type CarePlanInput = Omit<CarePlan, "id" | "status" | "attachment" | "recordedAt" | "recordedBy"> & {
  attachment?: { fileType: UploadedFileType; sizeBytes: number };
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/u;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/u;

export function isIsoDay(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DAY.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function isClockText(value: unknown): value is string {
  return typeof value === "string" && CLOCK.test(value);
}

function shortText(value: unknown, max: number): string | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed.length > max ? null : trimmed;
}

/** The plan to store, or a plain refusal. */
export function validateCarePlanInput(input: CarePlanInput): { plan: Omit<CarePlanInput, "attachment"> } | string {
  if (!CARE_PLAN_TYPES.includes(input.type)) return "Choose the plan type.";
  const agreedBy = shortText(input.agreedBy, CARE_PLAN_AGREED_BY_MAX);
  if (!agreedBy) return `Say who agreed the plan, in ${CARE_PLAN_AGREED_BY_MAX} characters or fewer.`;
  if (!isIsoDay(input.agreedOn)) return "Enter the date the plan was agreed.";
  if (input.reviewOn !== undefined && !isIsoDay(input.reviewOn)) return "The review date is not a real date.";
  const contactName = shortText(input.contactName, CARE_PLAN_CONTACT_NAME_MAX);
  const contactPhone = shortText(input.contactPhone, CARE_PLAN_CONTACT_PHONE_MAX);
  if (contactName === null || contactPhone === null) return "The key contact is too long.";
  if (contactPhone !== undefined && !/^[0-9 +()-]+$/u.test(contactPhone)) return "The phone number has letters in it.";
  const helpsExtra = shortText(input.helpsExtra, CARE_PLAN_HELPS_EXTRA_MAX);
  if (helpsExtra === null) return `Keep the note to ${CARE_PLAN_HELPS_EXTRA_MAX} characters.`;
  if (!Array.isArray(input.helps) || input.helps.some((help) => !CARE_PLAN_HELPS.includes(help)))
    return "Choose what helps from the list.";
  return {
    plan: {
      type: input.type,
      agreedBy,
      agreedOn: input.agreedOn,
      ...(input.reviewOn ? { reviewOn: input.reviewOn } : {}),
      ...(contactName ? { contactName } : {}),
      ...(contactPhone ? { contactPhone } : {}),
      helps: [...new Set(input.helps)],
      ...(helpsExtra ? { helpsExtra } : {}),
    },
  };
}

export function currentCarePlan(plans: readonly CarePlan[] | undefined): CarePlan | undefined {
  return plans?.find((plan) => plan.status === "Current");
}

// ── Tribunal hearing ─────────────────────────────────────────────────────────────────────────────

export const TRIBUNAL_OUTCOMES = ["Held", "Adjourned", "Cancelled"] as const;
export type TribunalOutcome = (typeof TRIBUNAL_OUTCOMES)[number];

export type TribunalHearing = {
  /** "YYYY-MM-DD" as typed. */
  date: string;
  /** "HH:MM" as typed, when known. */
  time?: string;
  recordedAt: Instant;
  recordedBy: WardFlowRole;
  outcome?: { value: TribunalOutcome; recordedAt: Instant; recordedBy: WardFlowRole };
};

/**
 * True once the typed hearing date (and time, when typed) is before today on the board's clock and
 * no outcome is recorded. A worded flag, never a countdown (D-93).
 */
export function tribunalHearingPassedWithoutOutcome(
  hearing: TribunalHearing | undefined,
  todayIso: string,
  nowClock?: string,
): boolean {
  // A device copy replaces the typed date with the not-kept placeholder (typed text is not kept on
  // the device), so only a real ISO day can be compared.
  if (!hearing || hearing.outcome || !/^\d{4}-\d{2}-\d{2}$/u.test(hearing.date)) return false;
  if (hearing.date < todayIso) return true;
  if (hearing.date > todayIso) return false;
  return Boolean(hearing.time && nowClock && hearing.time < nowClock);
}

// ── Cultural support ─────────────────────────────────────────────────────────────────────────────

/**
 * Set only when the person or family asks. NEVER derived from
 * `aboriginalOrTorresStraitIslanderStatus` or any other field.
 */
export const CULTURAL_SUPPORT_REQUESTS = ["Aboriginal liaison officer", "Other cultural support"] as const;
export type CulturalSupportRequest = (typeof CULTURAL_SUPPORT_REQUESTS)[number];

// ── Frequent presenter ───────────────────────────────────────────────────────────────────────────

/**
 * ED presentations in the last twelve months that make a person a frequent presenter. Default
 * approved by Josh, 9 Nov 2026 (care plans and safety flags thread), quoted from memory: check
 * before clinical use. The figure and its status live in `ward-clinical-values.ts`.
 */
export const FREQUENT_PRESENTER_ED_THRESHOLD = CLINICAL_VALUES.frequentPresenterEdPresentations.value;
const FREQUENT_PRESENTER_WINDOW_MONTHS = 12;

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/**
 * "14 Jun 2026" as "2026-06-14"; undefined for anything less precise ("Mar 2025"). A typed "Sept"
 * reads as September, as "Sep" does (time audit D14, 13 Nov 2026).
 */
export function isoDayOfDisplayDate(text: string): string | undefined {
  const match = /^(\d{1,2}) ([A-Za-z]{3,4}) (\d{4})$/u.exec(text.trim());
  if (!match) return undefined;
  const typed = match[2].toLowerCase();
  const month = MONTHS.indexOf(typed === "sept" ? "sep" : typed);
  if (month < 0) return undefined;
  const iso = `${match[3]}-${String(month + 1).padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  return isIsoDay(iso) ? iso : undefined;
}

/** The ED presentations whose start falls within the last twelve months up to and including today. */
export function edPresentationsInWindow(
  episodes: readonly { kind: string; start: string }[] | undefined,
  todayIso: string,
): number {
  const [y, m, d] = todayIso.split("-");
  const from = `${Number(y) - FREQUENT_PRESENTER_WINDOW_MONTHS / 12}-${m}-${d}`;
  return (episodes ?? []).filter((episode) => {
    if (episode.kind !== "ed") return false;
    const iso = isoDayOfDisplayDate(episode.start);
    return iso !== undefined && iso > from && iso <= todayIso;
  }).length;
}

function isFrequentPresenter(
  episodes: readonly { kind: string; start: string }[] | undefined,
  todayIso: string,
): boolean {
  return edPresentationsInWindow(episodes, todayIso) >= FREQUENT_PRESENTER_ED_THRESHOLD;
}

export function frequentPresenterTag(
  episodes: readonly { kind: string; start: string }[] | undefined,
  plans: readonly CarePlan[] | undefined,
  todayIso: string,
): string | undefined {
  if (!isFrequentPresenter(episodes, todayIso)) return undefined;
  return currentCarePlan(plans) ? "Frequent presenter · Care plan on file" : "Frequent presenter · No care plan";
}

// ── Carer told ───────────────────────────────────────────────────────────────────────────────────

type CarerToldOccasion = "admission" | "transfer" | "discharge";

export type CarerToldMoment = {
  occasion: CarerToldOccasion;
  /** "none": no such move on record; "not-yet": the move happened and nothing is recorded. */
  status: "told" | "not-yet" | "not-applicable" | "none";
  who?: string;
  contactedAt?: Instant;
};

type CarerToldRecord = {
  occasion: CarerToldOccasion;
  subjectId: string;
  party: string;
  outcome: "told" | "not_applicable";
  who?: string;
  contactedAt?: Instant;
  at: Instant;
};

/**
 * Whether the carer was told, for this person's latest admission, transfer and discharge, read from
 * the advisory support notification checklist (`RECORD_SUPPORT_NOTIFICATION`). `subjects` are the
 * checklist's completed moves for this person, newest first. Reads only what a person recorded.
 */
function carerToldOn(
  occasion: CarerToldOccasion,
  subjects: readonly { occasion: CarerToldOccasion; subjectId: string }[],
  notifications: readonly CarerToldRecord[] | undefined,
): CarerToldMoment {
  const subject = subjects.find((candidate) => candidate.occasion === occasion);
  if (!subject) return { occasion, status: "none" };
  let latest: CarerToldRecord | undefined;
  for (const record of notifications ?? [])
    if (record.occasion === occasion && record.subjectId === subject.subjectId && record.party === "carer")
      latest = record;
  if (!latest) return { occasion, status: "not-yet" };
  if (latest.outcome === "not_applicable") return { occasion, status: "not-applicable" };
  return { occasion, status: "told", who: latest.who, contactedAt: latest.contactedAt ?? latest.at };
}

/**
 * The discharge line, behind one adapter. The discharge thread owns "carer or family told" at
 * discharge (its discharge checklist, not yet merged); until then this reads the advisory support
 * notification checklist. Point this one function at their field once it lands.
 */
function carerToldAtDischarge(
  subjects: readonly { occasion: CarerToldOccasion; subjectId: string }[],
  notifications: readonly CarerToldRecord[] | undefined,
): CarerToldMoment {
  return carerToldOn("discharge", subjects, notifications);
}

export function carerToldMoments(
  subjects: readonly { occasion: CarerToldOccasion; subjectId: string }[],
  notifications: readonly CarerToldRecord[] | undefined,
): CarerToldMoment[] {
  return [
    carerToldOn("admission", subjects, notifications),
    carerToldOn("transfer", subjects, notifications),
    carerToldAtDischarge(subjects, notifications),
  ];
}
