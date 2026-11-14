import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
/**
 * Triage and risk (Josh approved the build, 9 Nov 2026; wording held for his sign-off): the pure
 * rules behind three clinical prompts.
 *
 * - Safety plan builder: the six Stanley–Brown steps and reasons for living, in the person's words,
 *   written under the plan's existing Safety plan headings. It never adds a heading twice and never
 *   adds a line that is already there, so adding again is safe.
 * - Means safety: shown when Plan or intent, or Access to means, is marked present. An unanswered
 *   row reads "Not asked yet"; unmarked never means No.
 * - Follow-up: for an outcome other than Accepted. The hint suggests; it never chooses.
 *
 * Every answer stays in React state; nothing here is recorded on signing. Synthetic data only.
 */
import { recordExtrasFor } from "@/components/ward-management/patients/patient-record-extras";

import { allFactors, type TextKey, type TriageState } from "./triage-risk-state";
import { isHeadingLine } from "./triage-risk-text";

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---- Safety plan builder ------------------------------------------------------------------------

/** A step 5 service: its name, its number (or none), and who checked the number and when. */
export type SafetyPlanService = {
  name: string;
  phone: string | null;
  /** Who checked the name and number against the service (D-186, Q12). Null until Josh supplies it (Q41). */
  checkedBy: string | null;
  /** When it was checked, as typed (D-186, Q12). Null until Josh supplies it (Q41, D-209 item 8). */
  checkedOn: string | null;
};

/**
 * Services offered as tap-to-add chips in step 5. D-186 (Q12): a number reads "Not checked" until both
 * its checked by and checked on are filled in. D-209 item 8 (Josh, 14 Nov 2026): the five numbers were
 * checked against the Mental Health Commission WA Helplines page (page updated 3 Nov 2026) and match;
 * the list is kept as it is. Copy-only text, never a call link (D-189 item 5).
 */
const CHECKED_BY = "Josh";
const CHECKED_ON = "14 Nov 2026";

export const SAFETY_PLAN_SERVICES: readonly SafetyPlanService[] = [
  {
    name: "Mental Health Emergency Response Line (metro WA)",
    phone: "1300 555 788",
    checkedBy: CHECKED_BY,
    checkedOn: CHECKED_ON,
  },
  { name: "Lifeline", phone: "13 11 14", checkedBy: CHECKED_BY, checkedOn: CHECKED_ON },
  { name: "13YARN", phone: "13 92 76", checkedBy: CHECKED_BY, checkedOn: CHECKED_ON },
  { name: "Kids Helpline", phone: "1800 55 1800", checkedBy: CHECKED_BY, checkedOn: CHECKED_ON },
  { name: "Emergency", phone: "000", checkedBy: CHECKED_BY, checkedOn: CHECKED_ON },
  { name: "Community team on-call", phone: null, checkedBy: null, checkedOn: null },
];

/** A service's number check in words: "Not checked" until both who and when are filled in. */
export const serviceCheck = ({ checkedBy, checkedOn }: SafetyPlanService) =>
  checkedBy?.trim() && checkedOn?.trim() ? `checked by ${checkedBy.trim()} on ${checkedOn.trim()}` : "Not checked";

/**
 * A service as the text step 5 holds: its name, then its number when it has one, with the number's
 * check beside it. The plan, Summary and Copy summary carry this text, so the check travels with it.
 */
export const serviceText = (service: SafetyPlanService) =>
  service.phone ? `${service.name} ${service.phone} (${serviceCheck(service)})` : service.name;

export type SafetyPlanDraft = {
  warning: string;
  own: string;
  distract: string;
  people: string;
  services: string;
  safer: string;
  reasons: string;
  withPerson: boolean;
};

export const BLANK_SAFETY_PLAN: SafetyPlanDraft = {
  warning: "",
  own: "",
  distract: "",
  people: "",
  services: "",
  safer: "",
  reasons: "",
  withPerson: false,
};

type StepKey = Exclude<keyof SafetyPlanDraft, "withPerson">;

/**
 * The fields, in order: the six steps then reasons for living. `heading` is the plan heading the
 * line goes under; `lead` starts the line, and never starts with a heading's name ("Warning signs"
 * is a formulation heading, so step 1 reads "Step 1, warning signs").
 */
export const SAFETY_PLAN_STEPS: readonly {
  key: StepKey;
  n: number | null;
  label: string;
  heading: string;
  lead: string;
  placeholder: string;
}[] = [
  {
    key: "warning",
    n: 1,
    label: "Warning signs",
    heading: "Plan",
    lead: "Step 1, warning signs",
    placeholder: "Thoughts, moods or situations that come before a crisis",
  },
  {
    key: "own",
    n: 2,
    label: "Things I can do on my own",
    heading: "Plan",
    lead: "Step 2, things I can do on my own",
    placeholder: "What takes my mind off it, without contacting anyone",
  },
  {
    key: "distract",
    n: 3,
    label: "People and places that distract me",
    heading: "Plan",
    lead: "Step 3, people and places that distract me",
    placeholder: "Who to be with, or where to go",
  },
  {
    key: "people",
    n: 4,
    label: "People I can ask for help",
    heading: "Crisis",
    lead: "Step 4, people I can ask for help",
    placeholder: "Name and phone",
  },
  {
    key: "services",
    n: 5,
    label: "Services",
    heading: "Crisis",
    lead: "Step 5, services",
    placeholder: "Services to call, and their numbers",
  },
  {
    key: "safer",
    n: 6,
    label: "Making the environment safer",
    heading: "Means safety",
    lead: "Step 6, making the environment safer",
    placeholder: "What is removed or held, and by whom",
  },
  {
    key: "reasons",
    n: null,
    label: "Reasons for living",
    heading: "Plan",
    lead: "Reasons for living",
    placeholder: "What matters most to me",
  },
];

/** The safety plan headings, in the plan's order (`GUIDES.rp`). */
const PLAN_HEADINGS = ["Plan", "Means safety", "Crisis", "Follow-up"] as const;
export const MADE_WITH_PERSON = "Safety plan made with the person.";

/** How many of the six numbered steps have something in them. */
export const stepsFilled = (draft: SafetyPlanDraft) =>
  SAFETY_PLAN_STEPS.filter((step) => step.n !== null && draft[step.key].trim()).length;

const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`);

/** The lines the builder adds, each with its heading, in the plan's heading order. */
function safetyPlanLines(draft: SafetyPlanDraft): [heading: string, line: string][] {
  const lines: [string, string][] = SAFETY_PLAN_STEPS.filter((step) => draft[step.key].trim()).map((step) => [
    step.heading,
    sentence(`${step.lead}: ${draft[step.key].trim().replace(/\s*\n\s*/g, "; ")}`),
  ]);
  if (draft.withPerson) lines.push(["Follow-up", MADE_WITH_PERSON]);
  const order = (heading: string) => PLAN_HEADINGS.indexOf(heading as (typeof PLAN_HEADINGS)[number]);
  return lines
    .map((entry, index) => [entry, index] as const)
    .sort(([a, i], [b, j]) => order(a[0]) - order(b[0]) || i - j)
    .map(([entry]) => entry);
}

/**
 * Puts one line under a heading. An empty heading ("Plan: ") takes it on its own line; a heading
 * with text gets it after the last line before the next heading; a missing heading is added at the
 * end. A line already in the text (alone, or straight after its heading) is left as it is.
 */
export function insertUnderHeading(text: string, heading: string, line: string): string {
  const lines = text.split("\n");
  const headRe = new RegExp(String.raw`^${escapeRegExp(heading)}\s*:(.*)$`, "i");
  const already = lines.some((l) => {
    const trimmed = l.trim();
    const head = trimmed.match(headRe);
    return trimmed === line || (head !== null && head[1].trim() === line);
  });
  if (already) return text;
  const at = lines.findIndex((l) => headRe.test(l.trim()));
  if (at === -1) {
    const body = text.replace(/\s+$/, "");
    return `${body}${body ? "\n" : ""}${heading}: ${line}\n`;
  }
  const own = lines[at].trim().match(headRe)?.[1].trim() ?? "";
  if (own.length <= 2) {
    lines[at] = `${lines[at].replace(/\s*:.*$/, "")}: ${line}`;
    return lines.join("\n");
  }
  let end = at + 1;
  while (end < lines.length && !isHeadingLine(lines[end])) end += 1;
  while (end > at + 1 && !lines[end - 1].trim()) end -= 1;
  lines.splice(end, 0, line);
  return lines.join("\n");
}

/** The plan text with the builder's lines added under the Safety plan headings. */
export function applySafetyPlan(text: string, draft: SafetyPlanDraft): string {
  return safetyPlanLines(draft).reduce((next, [heading, line]) => insertUnderHeading(next, heading, line), text);
}

/** Adds an item to a step's text ("a; b"), or takes it out when it is already there. */
export function toggleItem(text: string, item: string): string {
  const items = text
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  const next = items.includes(item) ? items.filter((part) => part !== item) : [...items, item];
  return next.join("; ");
}

export const hasItem = (text: string, item: string) =>
  text
    .split(";")
    .map((part) => part.trim())
    .includes(item);

// ---- Means safety -------------------------------------------------------------------------------

/** The two current flags that bring Means safety: Plan or intent, and Access to means. */
const MEANS_FLAGS = ["suicide.now.plan", "suicide.now.means"] as const;

export const MEANS_ROWS: readonly (readonly [id: string, label: string, text: TextKey])[] = [
  ["med", "Medicines", "meansMed"],
  ["gun", "Firearms", "meansGun"],
  ["lig", "Ligatures", "meansLig"],
  ["other", "Heights, car, other", "meansOther"],
];

export const MEANS_STATUS = [
  ["held", "Held or removed"],
  ["none", "No access"],
  ["open", "Still accessible"],
] as const;

export const MEANS_NOT_ASKED = "Not asked yet";
export const MEANS_STILL_OPEN = "Still accessible. Add to the safety plan who will hold or remove it.";

const STATUS_NAME: Readonly<Record<string, string>> = Object.fromEntries(MEANS_STATUS);

/** Means safety shows once Plan or intent, or Access to means, is marked present. */
export const meansSafetyShown = (state: Pick<TriageState, "f">) => MEANS_FLAGS.some((key) => state.f[key] === "y");

/** Asked, and found still accessible: the quiet prompt shows. Never a block. */
export const meansStillOpen = (state: Pick<TriageState, "means">, row: string) =>
  Boolean(state.means[row]?.asked && state.means[row]?.status === "open");

/** One row in words: "Medicines: held or removed, mother holds them", or "Medicines: not asked yet". */
function meansRowText(state: Pick<TriageState, "means" | "text">, [id, label, key]: (typeof MEANS_ROWS)[number]) {
  const answer = state.means[id];
  if (!answer?.asked) return `${label}: ${MEANS_NOT_ASKED.toLowerCase()}`;
  const status = answer.status ? STATUS_NAME[answer.status].toLowerCase() : "asked";
  const where = state.text[key].trim();
  return `${label}: ${status}${where ? `, ${where}` : ""}`;
}

/** Every row, for the summary: null when the block is not shown. */
export function meansSummary(state: Pick<TriageState, "f" | "means" | "text">): string | null {
  if (!meansSafetyShown(state)) return null;
  return MEANS_ROWS.map((row) => meansRowText(state, row)).join("; ");
}

/** The answered rows only, to prefill step 6 of the builder; "" when none is answered. */
export function meansPrefill(state: Pick<TriageState, "f" | "means" | "text">): string {
  if (!meansSafetyShown(state)) return "";
  return MEANS_ROWS.filter(([id]) => state.means[id]?.asked)
    .map((row) => meansRowText(state, row))
    .join("; ");
}

// ---- Follow-up ----------------------------------------------------------------------------------

/**
 * The follow-up windows, read from the values register (D-186 item 16): synthetic until Josh signs
 * them. `hintHours` is the window the hint suggests; `soonHours` and `weekDays` name the other
 * choices; `recentDischargeDays` is how recent a hospital discharge brings the hint.
 */
export const FOLLOW_UP_WINDOWS = {
  soonHours: CLINICAL_VALUES.triageFollowUpSoon.value,
  hintHours: CLINICAL_VALUES.triageFollowUpHint.value,
  weekDays: CLINICAL_VALUES.triageFollowUpWeek.value,
  recentDischargeDays: CLINICAL_VALUES.triageRecentDischarge.value,
} as const;

/**
 * Review question 6 (labelling only): true while any follow-up window the choices and the hint offer
 * is unsigned in the values register, so the form marks them "Window not signed." as the see-by
 * window is marked. No value changes.
 */
export const FOLLOW_UP_WINDOWS_UNSIGNED = (
  [
    CLINICAL_VALUES.triageFollowUpSoon,
    CLINICAL_VALUES.triageFollowUpHint,
    CLINICAL_VALUES.triageFollowUpWeek,
  ] as readonly { status: string }[]
).some((entry) => entry.status !== "signed");

export const FOLLOW_UP_CHOICES = [
  ["24h", `Within ${FOLLOW_UP_WINDOWS.soonHours} h`],
  ["72h", `Within ${FOLLOW_UP_WINDOWS.hintHours} h`],
  ["7d", `Within ${FOLLOW_UP_WINDOWS.weekDays} days`],
  ["none", "Not needed"],
] as const;

/** The outcome that needs no follow-up row: the person is accepted to the service. */
const ACCEPTED = "Accepted";

/** Follow-up shows for any chosen outcome other than Accepted. */
export const followUpShown = (outcome: string | null) => outcome !== null && outcome !== ACCEPTED;

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DAY = 86_400_000;

/** "17 Aug 2026" as a calendar date, or null for anything less than a whole day, month and year. */
function parseDay(text: string): Date | null {
  const match = text.trim().match(/^(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4})$/);
  if (!match) return null;
  const month = MONTHS.indexOf(match[2].toLowerCase());
  if (month === -1) return null;
  const date = new Date(Number(match[3]), month, Number(match[1]));
  return date.getDate() === Number(match[1]) ? date : null;
}

type EpisodeLike = { kind: string; end?: string };

/**
 * Whole days since the most recent hospital discharge (an admission's end) within the window, or
 * null when there is none. A date in the future, or one typed without a day, is ignored.
 */
export function daysSinceDischarge(episodes: readonly EpisodeLike[], today: Date): number | null {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const days = episodes
    .filter((e) => e.kind === "admission" && e.end)
    .map((e) => parseDay(e.end ?? ""))
    .filter((d): d is Date => d !== null)
    .map((d) => Math.round((start - d.getTime()) / DAY))
    .filter((n) => n >= 0 && n <= FOLLOW_UP_WINDOWS.recentDischargeDays);
  return days.length ? Math.min(...days) : null;
}

/** The record's recent hospital discharge for a person, read from the synthetic record extras. */
export const recentDischargeFor = (patientId: string, today: Date) =>
  daysSinceDischarge(recordExtrasFor(patientId)?.episodes ?? [], today);

/** Any current risk factor marked present. */
const currentRiskMarked = (state: TriageState) => allFactors(state).some((f) => f.kind === "now" && f.mark === "y");

/**
 * The follow-up hint, or null. It shows for a recent discharge or marked current risk, and stays
 * away once a choice at or inside the suggested window is made. It never chooses.
 */
export function followUpHint(state: TriageState, dischargedDaysAgo: number | null): string | null {
  if (!followUpShown(state.outcome)) return null;
  if (state.followUp === "24h" || state.followUp === "72h") return null;
  const consider = `Consider a follow-up contact within ${FOLLOW_UP_WINDOWS.hintHours} hours. You choose.`;
  if (dischargedDaysAgo !== null)
    return `Discharged from hospital ${dischargedDaysAgo === 1 ? "1 day" : `${dischargedDaysAgo} days`} ago. ${consider}`;
  if (currentRiskMarked(state)) return `Current risk is marked. ${consider}`;
  return null;
}

const FOLLOW_UP_NAME: Readonly<Record<string, string>> = Object.fromEntries(FOLLOW_UP_CHOICES);

/** Follow-up in words for the summary and the handover, or null when the row is not shown or not answered. */
export function followUpText(state: TriageState): string | null {
  if (!followUpShown(state.outcome) || !state.followUp) return null;
  const why = state.text.followUpWhy.trim();
  const who = state.text.followUpWho.trim();
  if (state.followUp === "none") return `Not needed${why ? `: ${why}` : ""}`;
  return `${FOLLOW_UP_NAME[state.followUp]}${who ? `, ${who} to contact` : ""}`;
}
