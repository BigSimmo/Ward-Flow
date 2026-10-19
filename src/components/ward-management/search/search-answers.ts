/**
 * COMMON QUESTIONS THE HEADER SEARCH ANSWERS, AND WHERE A PERSON IS NOW (search review, 19 Oct 2026).
 *
 * Typing "over 24 hours", "no bed yet" or "past expected discharge" into the header search found
 * nothing, although the Patients page already held every answer. This is a fixed, reviewed list of
 * phrasings, each answered by one test on the Patients page's own census rows (`patient-census.ts`),
 * so the two screens can never disagree about who is waiting or why. No AI and no scoring: a phrase
 * either matches the whole query or it does not, and the people it lists keep the census's
 * longest-wait-first order, the same order the Patients page shows. Nothing here ranks anyone by
 * risk, acuity or "best match", and the refusals in `search-refusals.ts` still run first.
 *
 * Deliberately NOT answered: "voluntary" and "involuntary". A census row shows the form when there
 * is one, in place of the legal status, so a status answer here would quietly drop people on a form;
 * deciding which forms count as involuntary is a legal call this list does not make.
 */
import { SELECTABLE_LEGAL_FORMS } from "@/components/ward-management/ward-legal-forms";

import { sortCensusRows, type Census, type CensusRow } from "./patient-census";

export type SearchQuestion = {
  id: string;
  /** The group heading the answer is listed under, e.g. "Waiting over 24 hours". */
  heading: string;
  test: (row: CensusRow) => boolean;
};

type QuestionDefinition = SearchQuestion & { phrases: RegExp };

/*
 * Each phrase must match the WHOLE query after `normaliseQuestion`, so a name that happens to
 * contain "moving" or "ward" is never read as a question.
 */
const QUESTIONS: readonly QuestionDefinition[] = [
  {
    id: "long",
    heading: "Waiting over 24 hours",
    phrases:
      /^(?:(?:waiting|waits?)\s+)?(?:over|more than|longer than|>)\s*(?:24|twenty four)\s*(?:h|hrs?|hours?)?$|^(?:over\s*24|over24|long waits?|long waiters?|waiting (?:over|more than) a day)$/,
    test: (row) => row.longWait,
  },
  {
    id: "wait",
    heading: "No bed yet",
    phrases: /^(?:no bed(?: yet)?|unplaced|waiting for (?:a )?beds?|without (?:a )?bed|need(?:s|ing)? (?:a )?bed)$/,
    test: (row) => row.group === "wait",
  },
  {
    id: "found",
    heading: "Bed found",
    phrases: /^(?:bed found|beds found|bed reserved|reserved beds?)$/,
    test: (row) => row.group === "found",
  },
  {
    id: "move",
    heading: "Moving now",
    phrases: /^(?:moving|moving now|in transit|on the way|en route|arriving)$/,
    test: (row) => row.group === "move",
  },
  {
    id: "edd",
    heading: "Past expected discharge",
    phrases:
      /^(?:past (?:expected )?(?:discharge|date)s?|past expected discharge date|overdue discharges?|discharges? overdue|delayed discharges?|discharges?)$/,
    test: (row) => row.pastExpected,
  },
  {
    id: "aed",
    heading: "Away at ED",
    phrases: /^(?:away at (?:the )?ed|at ed|back at (?:the )?ed|in ed from (?:a )?ward)$/,
    test: (row) => row.awayAtEd,
  },
  {
    id: "t1",
    heading: "Tier 1",
    phrases: /^tier\s*(?:1|one)$/,
    test: (row) => row.tier === 1,
  },
  {
    id: "form",
    heading: "Form recorded",
    phrases: /^(?:on (?:a )?forms?|forms? recorded|with (?:a )?forms?)$/,
    test: (row) => row.formCode !== null,
  },
];

/** Lower case, single spaces, no "?" and no leading "who is" / "show me" / "patients". */
export function normaliseQuestion(query: string): string {
  return query
    .toLowerCase()
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/\s*[?.!]+$/u, "")
    .replace(/^(?:who(?:'s|’s| is| are)?|show(?: me)?|list|find|any(?:one)?|all)\s+/u, "")
    .replace(/^(?:the\s+)?(?:patients?|people|persons?)\s+(?:who are\s+)?/u, "")
    .trim();
}

/** "Form 1A", "on form 1a" or a bare "1A": one of the forms the intake can record. */
function formQuestion(text: string): SearchQuestion | undefined {
  const match = /^(?:on\s+)?(?:form\s*)?(\d{1,2}[a-z]?)$/u.exec(text);
  if (!match) return undefined;
  const code = match[1]!.toUpperCase();
  if (!SELECTABLE_LEGAL_FORMS.some((form) => form.code === code)) return undefined;
  return { id: `form-${code.toLowerCase()}`, heading: `On Form ${code}`, test: (row) => row.formCode === code };
}

/** The question a query asks, or `undefined` when it is not one of the fixed phrasings. */
export function questionFor(query: string): SearchQuestion | undefined {
  const text = normaliseQuestion(query);
  if (text.length === 0) return undefined;
  return QUESTIONS.find((question) => question.phrases.test(text)) ?? formQuestion(text);
}

/** `rows` holds at most the caller's limit; `total` counts every row that answers the question. */
export type SearchAnswer = { question: SearchQuestion; rows: CensusRow[]; total: number };

/**
 * The census rows that answer a query, longest wait first, cut at `limit` like every other search
 * group. An answer with nobody in it is still an answer ("Waiting over 24 hours · 0"), so `rows`
 * may be empty while `question` is set.
 */
export function answerQuestion(
  query: string,
  census: Census | null | undefined,
  limit = Number.POSITIVE_INFINITY,
): SearchAnswer | undefined {
  if (!census) return undefined;
  const question = questionFor(query);
  if (!question) return undefined;
  const rows = sortCensusRows(census.rows.filter(question.test), "wait", () => false);
  return { question, rows: rows.slice(0, limit), total: rows.length };
}

/** One person's census row, by patient record id, for the preview's "where now" and "next" lines. */
export function censusRowsByPatient(census: Census | null | undefined): ReadonlyMap<string, CensusRow> {
  const byPatient = new Map<string, CensusRow>();
  for (const row of census?.rows ?? []) {
    if (row.patientRecordId !== null && !byPatient.has(row.patientRecordId)) byPatient.set(row.patientRecordId, row);
  }
  return byPatient;
}

/** "Dabakarn · Royal Perth Hospital": where the census says the person is now. */
export function whereNowLine(row: Pick<CensusRow, "where" | "whereSub">): string {
  return [row.where, row.whereSub].filter((part) => part.trim().length > 0).join(" · ");
}

/** "Find a bed · Bed desk", or `undefined` when the census records no step to take. */
export function nextStepLine(row: Pick<CensusRow, "next" | "nextWho" | "group">): string | undefined {
  if (row.group === "off" || row.next.trim().length === 0 || row.next === "On ward") return undefined;
  return [row.next, row.nextWho].filter((part) => part.trim().length > 0).join(" · ");
}
