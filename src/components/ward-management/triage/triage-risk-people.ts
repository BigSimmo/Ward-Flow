/**
 * Triage and risk (built 7 Nov 2026): who a new triage can be for. The Start a triage step searches
 * the synthetic world's people (the same records New referral's patient search reads) and lists
 * the referrals still waiting for a triage. Pure: the screens hand in the records, so this is tested
 * without a provider. Synthetic data only.
 */
import { rankByNameStart } from "@/components/ward-management/referrals/referral-patient-rank";
import { fieldsMatchEveryWord } from "@/components/ward-management/search/search-text";
import { calendarDateOf, perthCalendarDay } from "@/components/ward-management/ward-clock";
import { MONTH_SHORT } from "@/components/ward-management/ward-month-names";

import {
  FACTOR_NAME,
  LEGAL,
  REVIEW,
  SIGNED_IN,
  TIER_LONG,
  type PreviousTriage,
  type TriagePerson,
  type TriageReferral,
} from "./triage-risk-data";
import type { TriageSignedRecord } from "./triage-record";

/** What the step needs from one world record (`sampleProfile` and the person's open referral). */
export type WorldPersonInput = {
  patientId: string;
  /** "Family, Given". */
  name: string;
  /** Whole years, or empty. */
  age: string;
  /** First letter of the recorded sex, or empty. */
  gender: string;
  umrn: string;
  /** ISO YYYY-MM-DD, as the record holds it. */
  dob: string;
  /** Where they are now, or "Not recorded". */
  origin: string;
  /** Legal status as typed on the record, or "Not recorded". */
  legalStatus: string;
  /** The coded record address the patient page opens on. */
  recordAddress: string;
  openReferral: TriageReferral | null;
  /** The person's last signed triage on the workspace, already read for the form; none when left out. */
  last?: PreviousTriage | null;
  /** Every signed triage on the workspace for the person, newest first; none when left out. */
  previous?: readonly PreviousTriage[];
  /** Health and safety alerts on the record (`recordExtrasFor`), allergies included; none when left out. */
  alerts?: readonly string[];
};

const NOT_RECORDED = "Not recorded";
const SEX_WORD: Readonly<Record<string, string>> = { M: "Male", F: "Female" };
const MONTHS = MONTH_SHORT;
const LEGAL_NAME: Readonly<Record<string, string>> = Object.fromEntries(LEGAL);
const REVIEW_NAME: Readonly<Record<string, string>> = Object.fromEntries(REVIEW);

/** "1988-03-14" as the form shows dates, "14/03/1988"; anything else as it is. */
export function dobAsShown(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso || NOT_RECORDED;
}

/** "07 Nov", on the board's synthetic Perth clock. */
function triageDay(at: number, dayZero: Date): string {
  const day = perthCalendarDay(calendarDateOf(at, dayZero));
  return `${String(day.day).padStart(2, "0")} ${MONTHS[day.monthIndex]}`;
}

/**
 * A signed triage as the next one reads it: codes in words, and the flags it may carry forward.
 * Only factors marked present are on the record; nothing typed is, so nothing typed is carried.
 */
export function previousTriageFrom(record: TriageSignedRecord, dayZero: Date): PreviousTriage {
  const when = triageDay(record.at, dayZero);
  const pastFlags = record.riskFlags.filter((key) => key.includes(".bg."));
  const nowFlags = record.riskFlags.filter((key) => key.includes(".now."));
  const names = pastFlags.map((key) => FACTOR_NAME[key] ?? key);
  return {
    label: `Last triage · ${when} · ${SIGNED_IN}`,
    when,
    urgencyText: `${record.urgency} ${TIER_LONG[record.urgency].toLowerCase()}`,
    by: SIGNED_IN,
    outcome: record.outcome,
    legal: LEGAL_NAME[record.legal] ?? NOT_RECORDED,
    review: REVIEW_NAME[record.review] ?? NOT_RECORDED,
    pastFlags,
    pastSummary: names.length
      ? `${names.join(" · ")}. Carries these flags only; you answer Rest of history today.`
      : "No past flags were marked then. Answer past risk fresh today.",
    nowFlags,
  };
}

const isAllergy = (alert: string) => /allerg/i.test(alert);

/** One world record as the banner reads it, with its last signed triage when there is one. */
export function triagePersonFromWorld(input: WorldPersonInput): TriagePerson {
  // The record's alerts, as the patient summary shows them: allergies on their own chip, the rest as
  // alerts. No allergy on the record reads "Not recorded", never "none".
  const recorded = input.alerts ?? [];
  const allergies = recorded.filter(isAllergy);
  const alerts = recorded.filter((alert) => !isAllergy(alert));
  const sex = SEX_WORD[input.gender] ?? (input.gender ? input.gender : "Sex not recorded");
  const legal = input.legalStatus && input.legalStatus !== NOT_RECORDED ? input.legalStatus : null;
  return {
    id: input.patientId,
    name: input.name,
    meta: `${sex} · ${input.age ? `${input.age}y` : "age not recorded"}`,
    umrn: input.umrn,
    dob: dobAsShown(input.dob),
    nowAt: input.origin || NOT_RECORDED,
    team: NOT_RECORDED,
    legal,
    legalTag: "As typed · Not legally checked.",
    alert: alerts[0] ?? null,
    alertCount: alerts.length,
    alerts,
    allergies: allergies.length ? allergies.join(" · ") : NOT_RECORDED,
    referral: input.openReferral,
    last: input.last ?? null,
    previous: input.previous ?? (input.last ? [input.last] : []),
    recordHref: `/ward-flow/people/${input.recordAddress}`,
  };
}

/**
 * People matching the typed text: every word must match the name, UMRN or date of birth (commas
 * separate names, as in header search), surnames that start with it first. Nothing is listed until
 * something is typed, so the step never shows the whole register.
 */
export function searchTriagePeople(people: readonly TriagePerson[], query: string, limit = 8): TriagePerson[] {
  const text = query.replace(/,/g, " ").trim();
  if (!text) return [];
  const matches = people.filter((person) => fieldsMatchEveryWord(text, [person.name, person.umrn, person.dob]));
  return rankByNameStart(matches, text).slice(0, limit);
}

/** Legal status in record words for a row: as typed, never checked, or not recorded. */
export function legalLine(person: TriagePerson): string {
  return person.legal ? `${person.legal}, as typed. Not legally checked.` : "Legal status not recorded.";
}
