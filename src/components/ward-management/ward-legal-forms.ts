import type { ExaminationOutcome, LegalForm, Movement } from "@/components/ward-management/ward-model";
import { formTitleForCode } from "@/lib/form-register";
import {
  currentLegalPosition,
  legalFormNowWords,
} from "@/components/ward-management/legal-forms/legal-form-progression";

/**
 * The legal forms a clinician may choose from, and how a form names itself on screen.
 *
 * **Why this is its own module rather than part of `ward-model.ts`.** `ward-model.ts` declares
 * `ED_ACCESS_TARGET_MINUTES` — the departmental access target, a performance measure that has
 * already been mistaken for a legal deadline once. `tests/ward-flow-single-source.test.ts` keeps
 * the two quarantined: no file that spells out a `{code, kind}` legal-form literal may also
 * reference that constant. (That predicate was `{code, label, kind}` until this same change
 * deleted `LegalForm.label`; it was re-pointed to the two fields a populated form still carries,
 * which matches a strict superset of what it did before.) Declaring the list beside the constant tripped that guard, which
 * was the guard doing its job, so the list moved rather than the guard being relaxed.
 */

/**
 * The legal forms the intake picker offers, in the order it offers them. This list is the
 * single source for that picker, so admitting a further code later is a one-line change here.
 *
 * The software no longer decides which form a patient is on; the clinician chooses it and it
 * never changes by itself. Product owner, 2026-08-24: "A patient will be on 1A or 3D or other
 * forms potentially… so avoid any hard rules now please. Just focus on voluntary and
 * involuntary and I can choose what option in the patient selection." `RAISE_REFERRAL` no
 * longer derives a form from `legalStatus`, and `RECORD_EXAMINATION` no longer replaces or
 * clears one.
 *
 * **An entry carries a code, and no meaning.** Titles come from the register at render time
 * (`legalFormName`), never from here — the product owner approved adopting the official titles
 * on 2026-08-24 after being shown that this prototype's own labels had drifted from them.
 * `kind` is retained only because the fixture and the type already carried it; nothing reads
 * it, it is never displayed, and Form 3D has none because this model holds no classification
 * for a 3D and the register's categories were explicitly not adopted.
 *
 * No entry carries a `dueAt`. Forms record *that* they exist, never *when they lapse* — see
 * `LegalForm`'s own doc comment and `tests/ward-legal-figure-guard.test.ts`.
 */
export const SELECTABLE_LEGAL_FORMS: readonly LegalForm[] = [
  { code: "1A", kind: "examination" },
  { code: "3A", kind: "detention" },
  { code: "3B", kind: "detention" },
  { code: "3D" },
  { code: "4A", kind: "transport" },
  { code: "4C", kind: "transfer" },
  { code: "5A" },
  { code: "6A" },
];

/**
 * The forms the Forms page's Record a form sheet offers (gap list item 2, Josh 4 Nov 2026): the
 * forms the engine records from the paper, in register order. Unlike the intake picker above, it
 * holds the ward forms 3C, 3E, 6C and 6D, and none the engine would refuse (3B, 4A and 4C are
 * recorded at intake or on the move). 5B stays a continuation.
 */
export const RECORDABLE_LEGAL_FORMS: readonly LegalForm[] = [
  { code: "1A", kind: "examination" },
  { code: "3A", kind: "detention" },
  { code: "3C", kind: "detention" },
  { code: "3D" },
  { code: "3E" },
  { code: "5A" },
  { code: "6A" },
  { code: "6B" },
  { code: "6C" },
  { code: "6D" },
];

/** Continuations have a separate vocabulary; 5B is not an initial intake form. */
export const CONTINUATION_LEGAL_FORMS: readonly LegalForm[] = [...SELECTABLE_LEGAL_FORMS, { code: "5B" }];

/** Requires explicit recorded country context on the current Form 1A. */
export function countryExtensionEligible(movement: Movement): boolean {
  const region =
    movement.legalForm?.region ?? (movement.legalClock?.code === "1A" ? movement.legalClock.region : undefined);
  return !movement.closure && currentLegalPosition(movement).form?.code === "1A" && region === "country";
}

/**
 * How a legal form names itself on screen, code first — "Form 1A (Referral for examination by a
 * psychiatrist)".
 *
 * The title is the Chief Psychiatrist register's, resolved from the code every time it is
 * rendered. Ward Flow holds no titles of its own, so it cannot drift from the register the way
 * its old stored labels did. When the register does not list the code, `formTitleForCode`
 * returns `null` and this renders the **bare code** — never a substituted or locally-invented
 * title, and never the word "undefined".
 */
/** ", continued (Form 5B)" when a later form continues this one (owner ruling 2026-09-25), else "". */
function continuationSuffix(form: LegalForm): string {
  return form.continuedBy === undefined ? "" : `, continued (Form ${form.continuedBy.code})`;
}

export function legalFormName(form: LegalForm): string {
  const title = formTitleForCode(form.code);
  const name = title === null ? `Form ${form.code}` : `Form ${form.code} (${title})`;
  return name + continuationSuffix(form);
}

/**
 * The same name with the title first — "Referral for examination by a psychiatrist (1A)" — the
 * wording the console, mode and network surfaces already used. A code the register does not
 * list falls back to the same bare "Form 3D" as `legalFormName`, because there is no title to
 * put first.
 */
export function legalFormNameLabelFirst(form: LegalForm): string {
  const title = formTitleForCode(form.code);
  const name = title === null ? `Form ${form.code}` : `${title} (${form.code})`;
  return name + continuationSuffix(form);
}

/**
 * U1 (review 12 Oct 2026): legal status as a short chip that never needs truncating — "Form 3B"
 * when a form is recorded (the same style the New referral picker uses), else the recorded status
 * in its shortest plain words. The full wording (`legalStatusFull`) goes in the chip's title.
 */
const LEGAL_STATUS_SHORT: Record<Movement["legalStatus"], string> = {
  Voluntary: "Voluntary",
  "Referred for psychiatric examination": "Referred for exam",
  "Detained awaiting examination": "Awaiting exam",
  "Involuntary inpatient": "Involuntary",
};

export function legalStatusShort(movement: Pick<Movement, "legalForm" | "legalStatus">): string {
  // 1.1 (K1) and A1: the one current legal position, so the chip on Movements and Delays rows reads
  // "Form 3B ended" once a person records the end, as every other screen does.
  const form = legalFormNowWords(movement);
  // D-187 item 4 (Q25): a Voluntary person with a form on file shows both, "Voluntary · Form 3B" (or
  // "Voluntary · Form 3B ended"), so the chip never hides the recorded status behind the form.
  if (form && movement.legalStatus === "Voluntary") return `${LEGAL_STATUS_SHORT.Voluntary} · ${form}`;
  if (form) return form;
  return LEGAL_STATUS_SHORT[movement.legalStatus] ?? movement.legalStatus;
}

/** The same status in full: the register's form name, or the recorded status as written. */
export function legalStatusFull(movement: Pick<Movement, "legalForm" | "legalStatus">): string {
  // The form's name only: a recorded end has its own line wherever this shows (the chip's short words,
  // the printed pack's "Recorded as ended"), so it is not said twice.
  const legal = currentLegalPosition(movement);
  return legal.form ? legalFormName(legal.form) : movement.legalStatus;
}

/**
 * D-170 item 3 (Josh, 13 Nov 2026): how an examination outcome reads on screen. An examination has
 * an outcome; it is never "revoked". The stored code `"revoked"` is unchanged (saved records keep
 * it); only the words change, and every screen takes them from here. `EXAMINATION_OUTCOME_LABEL` is
 * the list wording (the outcome picker and the timeline); `examinationOutcomeShort` is the chip and
 * in-sentence wording.
 */
export const EXAMINATION_OUTCOME_LABEL: Record<ExaminationOutcome, string> = {
  inpatient_order: "Inpatient treatment order",
  community_order: "Community treatment order",
  revoked: "No order made, does not proceed",
  further_examination_ordered: "Further examination ordered",
};

const EXAMINATION_OUTCOME_SHORT: Record<ExaminationOutcome, string> = {
  inpatient_order: "Inpatient treatment order",
  community_order: "Community treatment order",
  revoked: "No order made",
  further_examination_ordered: "Further examination ordered",
};

/** "No order made", "Inpatient treatment order": the chip wording. An unknown code reads as itself. */
export function examinationOutcomeShort(outcome: ExaminationOutcome | string): string {
  return EXAMINATION_OUTCOME_SHORT[outcome as ExaminationOutcome] ?? outcome.replace(/_/g, " ");
}

/**
 * F-15 (A3-4): the in-sentence wording, "no order made", for the reasons and notices the engine
 * writes when an examination closes a record or a pulled bed is released after one. The same words
 * as the chip, lower-cased as `ed-screen-model.ts` already does, so no saved reason or notice
 * carries the stored code. An unknown code reads as itself.
 */
export function examinationOutcomeInSentence(outcome: ExaminationOutcome | string): string {
  return examinationOutcomeShort(outcome).toLowerCase();
}

/** The list wording, "No order made, does not proceed". An unknown code reads as itself. */
export function examinationOutcomeLabel(outcome: ExaminationOutcome | string): string {
  return EXAMINATION_OUTCOME_LABEL[outcome as ExaminationOutcome] ?? outcome.replace(/_/g, " ");
}
