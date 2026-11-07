/**
 * Triage and risk mock-up: who a new triage can be for. The Start a triage step searches the
 * preview world's synthetic people (the same records New referral's patient search reads) and lists
 * the referrals still waiting for a triage. Pure: the step hands in the records, so this is tested
 * without a provider. Synthetic data only; nothing here is saved.
 */
import { rankByNameStart } from "@/components/ward-management/referrals/referral-patient-rank";
import { fieldsMatchEveryWord } from "@/components/ward-management/search/search-text";

import { PATIENT, type TriagePerson, type TriageReferral } from "./triage-risk-data";

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
};

const NOT_RECORDED = "Not recorded";
const SEX_WORD: Readonly<Record<string, string>> = { M: "Male", F: "Female" };

/** "1988-03-14" as the form shows dates, "14/03/1988"; anything else as it is. */
export function dobAsShown(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso || NOT_RECORDED;
}

/** One world record as the banner reads it. No previous triage: past risk is answered fresh. */
export function triagePersonFromWorld(input: WorldPersonInput): TriagePerson {
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
    alert: null,
    alertCount: 0,
    allergies: NOT_RECORDED,
    referral: input.openReferral,
    lastTriage: false,
    recordHref: `/ward-flow/people/${input.recordAddress}`,
    example: false,
  };
}

/** The worked Example comes first in a search, as the one person with a previous triage on record. */
export function startPeople(world: readonly TriagePerson[]): TriagePerson[] {
  return [PATIENT, ...world.filter((person) => person.umrn !== PATIENT.umrn)];
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
