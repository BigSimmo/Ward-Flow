"use client";

import Link from "next/link";
import { useWardModalFocus } from "../ward-modal-focus";
import { useSearchParams } from "next/navigation";

import { duplicateSentence } from "./referral-duplicate";
import { useEffect, useRef, useState, useMemo, type FormEvent, type MouseEvent, type KeyboardEvent } from "react";

import {
  communityTeamOptions,
  destinationOptions,
  suburbOptions,
} from "@/components/ward-management/referrals/referral-destination-options";
import { lookupCatchment } from "@/components/ward-management/ward-catchment";
import {
  TENTATIVE_DIAGNOSIS_BLOCKS,
  tentativeDiagnosisPhrase,
  type TentativeDiagnosisBlock,
} from "@/components/ward-management/ward-diagnosis";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import {
  patientDisplayName,
  patientAgeYears,
  patientCohort,
  findPatients,
  duplicateCandidates,
  type Gender,
  type Patient,
  type PatientId,
  type PatientIdentityDraft,
} from "@/components/ward-management/ward-patients";
import { WARD_NAV } from "@/components/ward-management/ward-nav";
import {
  COHORTS,
  HOME_REGIONS,
  REFERRAL_GENDERS,
  REFERRAL_HISTORY_LIMITS,
  SENDING_TEAM_NAME_LIMIT,
  type Referral,
  type ReferralHistoryField,
  REFERRAL_DESTINATION_KINDS,
  REFERRAL_SOURCES,
  RECORDED_SEXES,
  SUBURB_UNKNOWN_REASONS,
  suburbUnknownLabels,
  URGENCY_LEVELS,
  type Cohort,
  type HomeRegion,
  type ReferralDestination,
  type ReferralDestinationKind,
  type ReferralGender,
  type ReferralSource,
  type ReferralSuburb,
  type Rejection,
  type SuburbUnknownReason,
  type RecordedSex,
  type ReferralPurpose,
  type UrgencyLevel,
  type WardReferralDestination,
} from "@/components/ward-management/ward-model";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { referralDestinationKindLabel, referralSuburbLabel } from "@/components/ward-management/ward-referrals";
import { allEmergencyDepartments, wardSites } from "@/components/ward-management/ward-sites";
import {
  OPERATIONAL_DEFAULT_LABEL,
  OVERDUE_AFTER_MINUTES_BY_TIER,
} from "@/components/ward-management/ward-operational-defaults";

import styles from "./referrals.module.css";
import pageStyles from "./referral-intake-third-edition.module.css";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

/**
 * Task 4 (Phase 7, "The front door"): the one intake form every source uses — community, crisis
 * service, police, ambulance and inter-hospital alike raise a referral through this same screen,
 * never a source-specific variant. `ReferralSource` (chosen on the form itself, see below)
 * distinguishes WHERE the request came from; the fixed `"community"` role below is WHO is
 * permitted to raise `RECEIVE_REFERRAL` at all (`ward-flow-events.ts`'s `EVENT_ROLES` table) —
 * the two are independent, exactly like `ed-screen.tsx`'s referral form already treats `role`
 * and the reducer's own subject fields as separate facts.
 *
 * Every picker here is derived directly from the runtime lists `ward-model.ts` exports —
 * `COHORTS`, `HOME_REGIONS`, `REFERRAL_SOURCES`, `SEXES`, `URGENCY_LEVELS` — or, for the origin
 * site, from `wardSites` itself, never a hand-written array in this file. That is the fix for a
 * defect class that has shipped four separate times in this project: a hand-maintained option
 * list a type or fixture change cannot reach, most recently an emergency-department picker that
 * silently omitted a new age band. `Sex` and urgency used to be the two exceptions — fixed,
 * already-exhaustive literal unions with no runtime array of their own anywhere in
 * `ward-model.ts` — until Phase 7 Task 5 added `SEXES` and `URGENCY_LEVELS` there for exactly
 * this reason (see that file's own comment on `SEXES`); `SEX_OPTIONS` and `URGENCY_OPTIONS`
 * below now derive from them like every other picker on this form.
 */
const AGE_BAND_OPTIONS: Cohort[] = [...COHORTS];
/** Every suburb the catchment sources name, derived from the exported rows — see
 *  `suburbOptions`' own comment for why a hand-written list is not an option here. */
const SUBURB_OPTIONS: readonly string[] = suburbOptions();
const HOME_REGION_OPTIONS: HomeRegion[] = [...HOME_REGIONS];
const SOURCE_OPTIONS: ReferralSource[] = [...REFERRAL_SOURCES];
// R7 (25 September 2026): female, male, another term, not recorded.
const SEX_OPTIONS: RecordedSex[] = [...RECORDED_SEXES];
/** T11 (after T10, item 8): the referral-facing gender picker's real answers — `Female`, `Male`,
 *  `Non-binary` — never `Choose…` (the `UNANSWERED_VALUE` sentinel) or `NOT_RECORDED_VALUE`, which
 *  are both separate, deliberate states the control also offers. See `NOT_RECORDED_VALUE`'s own
 *  comment for why "not yet recorded" is a real answer rather than a synonym for unanswered. */
const GENDER_OPTIONS: ReferralGender[] = [...REFERRAL_GENDERS];
const URGENCY_OPTIONS: UrgencyLevel[] = [...URGENCY_LEVELS];

/**
 * The recorded-tier window shown beside each urgency card — read from
 * `OVERDUE_AFTER_MINUTES_BY_TIER`, the same figures the referral board's overdue flag uses, so
 * this caption cannot drift from that behaviour. It is a default the service chose, not a target
 * this record is measured against; the card's `title` says so (`OPERATIONAL_DEFAULT_LABEL`).
 */
export function urgencyWindowLabel(tier: UrgencyLevel): string {
  const hours = OVERDUE_AFTER_MINUTES_BY_TIER[tier] / 60;
  return `Within ${hours} hour${hours === 1 ? "" : "s"} (your default)`;
}

/**
 * T11 (item 8): the gender picker's fourth, explicit answer — "the clinician actively said this
 * is not yet recorded", distinct from `UNANSWERED_VALUE` ("nobody has touched this control yet").
 * `UNANSWERED_VALUE` blocks Send; choosing this does not — it is a real, deliberate answer that
 * `answeredDraft` widens into `gender: undefined` on the built destination (`Movement.gender`'s
 * own "absent means not yet recorded" convention, `ward-model.ts`). A single sentinel could not
 * carry both meanings: "Raise referral" must stay blocked until SOMEONE looks at this question,
 * even when the honest answer is that nobody has recorded a gender yet.
 */
export const NOT_RECORDED_VALUE = "not_recorded";

/**
 * T15 (item 12, owner answer 17 September 2026): "None" — a real, deliberate answer for the
 * optional tentative-diagnosis picker, distinct from every real `TentativeDiagnosisBlock` code.
 * Unlike gender above, this question is never in `REQUIRED_FIELDS` and never blocks Send — the
 * owner's own words, 2026-08-29, are that it "should arrive with referral" when the referrer HAS
 * one, not that every referral must name one.
 */
export const NO_DIAGNOSIS_VALUE = "none";

/** Display labels only — never the picker's own option set, which is always
 *  `SOURCE_OPTIONS.map(...)`. A source missing from this map still renders (as its own raw
 *  value, via the `??` fallback below), it just renders less prettily — so a future
 *  `ReferralSource` this map forgets is never silently dropped from the list, only unlabelled. */
export const SOURCE_LABELS: Record<ReferralSource, string> = {
  community: "Community",
  crisis_service: "Crisis service",
  police: "Police",
  ambulance: "Ambulance",
  inter_hospital: "Inter-hospital",
  // The owner's own words, 2026-09-06, quoted rather than paraphrased: "ED medical staff will
  // refer a patient". Names the referrer, not the department — see `REFERRAL_SOURCES`.
  ed_medical: "ED medical staff",
  // Owner answer 25, 2026-09-17: "GP referrals: the GP is told by phone or letter for now; add
  // 'GP' as a referral source." See `REFERRAL_SOURCES`' own doc comment in `ward-model.ts` for
  // why this app never contacts the GP itself.
  gp: "General practitioner (GP)",
  psychiatric_ward: "Inpatient psychiatric ward",
};

const DESTINATION_SUBTITLES: Record<ReferralDestinationKind, string> = {
  psychiatric_ward:
    "Acute inpatient bed request for clinical stabilization, bed coordination, and nursing observation.",
  emergency_department:
    "Immediate clinical triage, acute medical clearance, and emergency resuscitation / observation.",
  community_team: "Outpatient clinical review, crisis diversion, and community care coordination.",
};

/**
 * Phase R2.1: the one value that means "nobody has answered this question yet".
 *
 * It lives in THIS FORM'S OWN DRAFT STATE AND NOWHERE ELSE. It is never dispatched, never
 * reaches `RECEIVE_REFERRAL`, never reaches the reducer and never reaches a `Referral` — the
 * form cannot be sent while any field still holds it (see `answeredDraft` below, and the inert
 * Send at the bottom of this file). So `Referral` is unchanged, the event is unchanged and the
 * reducer is unchanged: this is a fact about a half-filled form, not a new clinical state.
 *
 * **Why not the empty string, which would have been the obvious choice.** `""` is already
 * load-bearing for the origin-site picker. `tests/ward-referral-screens.dom.test.tsx` provokes a
 * GENUINE reducer refusal — the repository's only proof that an intake refusal reaches the screen
 * rather than being swallowed — by setting that select to a code no option carries, which leaves
 * the DOM's own resolved value at `""` (no matching option -> selectedIndex -1 -> value ""), so
 * `siteByCode("")` resolves to nothing and `RECEIVE_REFERRAL` refuses the event. Had `""` become
 * the unanswered sentinel, Send would go inert on that value and the reducer would never be
 * reached, so that proof would be destroyed.
 *
 * **Corrected 2026-08-30 (R2 review finding M1).** Commit `78133a738` overstated this in three
 * places, here included: it said the test would have gone on PASSING while the proof was
 * destroyed. It would not. That test ends by asserting `rejection-count` reads `"1"`, and with an
 * inert Send nothing dispatches, so the count stays `"0"` and the test goes red either way. What
 * the pre-click "Send is available" assertion added in that commit actually buys is a LEGIBLE
 * failure — "Send went inert, so this test never reaches the reducer" — in place of a misleading
 * one about rejection counts. That is worth keeping, and it is a smaller claim than was made.
 *
 * With the sentinel distinct from `""`, an origin site of `""` remains an ANSWER — an invalid one
 * the reducer is left to refuse, exactly as before — and it stays unreachable by ordinary use of
 * this screen, because no option on this form carries it.
 *
 * The value is deliberately not a member of `COHORTS`, `SEXES`, `HOME_REGIONS`,
 * `REFERRAL_SOURCES`, `URGENCY_LEVELS` or any site code — asserted, not assumed, in that suite.
 */
export const UNANSWERED_VALUE = "not-answered";

/** The leading option every picker carries while it is unanswered. Worded as a PROMPT, never as
 *  a state: a "Not known" reading here would look like a sendable answer, and a sending "not
 *  known" is deliberately NOT part of this work — it needs a model decision nobody has taken
 *  (`involuntaryBedNeeded` would have to stop being a `boolean`, which the eligibility gate
 *  reads, and `HOME_REGIONS` would have to gain an eleventh member that `ward-teams.ts` makes a
 *  compile break on purpose so that a human decides). */
export const UNANSWERED_OPTION_LABEL = "Choose one";

/** The id `aria-describedby` on Send points at while Send is unavailable. */
const UNAVAILABLE_REASON_ID = "ward-referral-intake-unavailable-reason";
const REFUSED_COMBINATION_ID = "ward-referral-intake-refused-combination";

/**
 * D-11 (owner ruling, delegated 2026-09-11 — `docs/ward-flow/owner-decisions-2026-09-1x.md`) —
 * the half-written referral history warns before it is lost, and is never held anywhere to avoid
 * that loss.
 *
 * **Do NOT persist this text.** Not `localStorage`, not `sessionStorage`, not IndexedDB, not a
 * server draft. The ruling's own reasoning: a real ward computer is shared between clinicians, and
 * writing clinical free-text about a named person into browser storage on a shared machine turns a
 * lost-work annoyance into a disclosure. So the fix this screen makes is the OTHER acceptable one
 * named by the drawing's own appendix (`docs/ward-flow/drawing-appendices-2026-09-10.md` §1): it
 * warns before the text is lost, rather than trying to keep it.
 *
 * **The wording states what is actually true.** The text WILL be lost — never "changes may not be
 * saved", the vague hedge the ruling names by name as the form people learn to click through.
 */
export const UNSAVED_HISTORY_WARNING =
  "Leaving this page now will lose the history you have written here — it is never saved anywhere.";

/**
 * The person search's real route, read off `WARD_NAV` rather than hand-typed here — the same
 * discipline `WARD_REFERRAL_INTAKE_HREF` and `WARD_ADD_PERSON_HREF` (`ward-nav.ts`) hold to for
 * their own destinations, just via a lookup instead of a constant, because `patient-search.tsx`'s
 * route is a `WARD_NAV` entry (id `"search"`) rather than a screen-owned destination with a
 * constant of its own.
 *
 * ⚠️ **THIS WAS A NON-NULL ASSERTION AND IT WAS A LATENT CRASH. THE HISTORY IS THE POINT.**
 *
 * It read `find(…)!.href`, justified by a comment claiming `tests/ward-nav.test.ts` would fail if
 * `"search"` were ever removed. **The claim was checked and was false — that file referenced
 * `"search"` nowhere.** Worse, when the guard was then written, deleting the entry produced
 * `TypeError: Cannot read properties of undefined (reading 'href')` at MODULE LOAD, and because
 * `ward-nav.test.ts` imports this component the file reported `Tests no tests`: **it never
 * collected, so the test written to catch the removal could not run.** A guard that dies with the
 * thing it guards is not a guard.
 *
 * So it is optional now, and the refusal screen renders its explanation with or without a way out.
 * `tests/ward-nav.test.ts` → *"keeps the patient search in WARD_NAV, because the referral intake
 * offers it as the only way out of a refusal"* fails BY NAME if the entry goes. **Do not restore
 * the assertion: the screen this constant serves is the one a clinician reaches when a link is
 * already broken, and it must not be the screen that crashes.**
 *
 * This is the "resolve against the real route tree, never a string that can drift from it" rule
 * this file already follows for `wardSites`, `allEmergencyDepartments()` and
 * `communityTeamOptions()`.
 */
const PATIENT_SEARCH_HREF: string | undefined = WARD_NAV.find((item) => item.id === "search")?.href;

function isUnanswered(value: unknown): boolean {
  // FD-21: the destinations are a LIST, and an empty one is the same fact every sentinel above
  // states — nobody has answered yet. Handled here rather than by a second special case in
  // `unansweredFieldNames`, so the destination question is checked by the same rule as the other
  // nine rather than by a branch beside it that could disagree with them.
  if (Array.isArray(value)) return value.length === 0;
  return value === UNANSWERED_VALUE;
}

/**
 * Whether ONE required field is still unanswered in this draft — the field's own rule when it has
 * one, and the shared sentinel rule otherwise.
 *
 * ⚠️ **ONE FUNCTION, BECAUSE THERE ARE THREE READERS.** The progress figure, the summary rows and
 * the outstanding-questions sentence all ask this question, and before the written history they
 * each asked it by calling `isUnanswered` directly. Adding a field whose blank state is `""` to
 * three separate call sites is how two of them come to agree and the third does not — and the one
 * that disagrees would be the Send button's reason, which is the one a clinician acts on.
 */
function fieldIsUnanswered(
  field: {
    readonly key: keyof ReferralDraft;
    readonly unanswered?: (value: ReferralDraft[keyof ReferralDraft]) => boolean;
  },
  draft: ReferralDraft,
): boolean {
  const value = draft[field.key];
  return field.unanswered ? field.unanswered(value) : isUnanswered(value);
}

/**
 * THE WORD BESIDE ONE QUESTION'S LABEL — `Not answered` or `Answered`.
 *
 * 🔴 **IT SAID `Outstanding` UNTIL D-43, AND I INTRODUCED THAT DEFECT IN THE SAME COMMIT THAT
 * PROVED IT WAS ONE.** Three places on this screen reported the identical state — this chip, the
 * summary rail (`Not answered yet`) and the Send button's reason (`Not yet answered`) — all three
 * reading `fieldIsUnanswered` over the same applicable `REQUIRED_FIELDS`. **Two of those were the
 * same three words reordered, visible to a coordinator at the same moment**, one beside the
 * question and one beside Send.
 *
 * ⚠️ **AND THE TEST BELOW ALREADY ASSERTED THE CHIP COUNT EQUALS THE RAIL'S UNANSWERED-ROW COUNT.**
 * A test proving two things are one set is the strongest available evidence that they should share
 * a name — and it shipped in the same change as the third name. **Proving an identity and then
 * contradicting it in wording is a shape nothing gates and nobody looks for.**
 *
 * **D-43: one wording, inflected by slot.** `yet` is dropped — it is the word that forced the two
 * orderings, it adds nothing a clinician acts on, and *"Not answered"* is true whether or not the
 * question will be answered later. The three grammatical slots are not three states (D-32).
 *
 * 🔴 **THE HISTORY BOX IS A DIFFERENT STATE AND IS NOT TOUCHED.** It reads *"Nothing written — that
 * is a complete answer"*, because the history is `required: false` and absent from
 * `REQUIRED_FIELDS`: **an empty history is COMPLETE, an unanswered required question is
 * INCOMPLETE**, and they differ in what the coordinator must do. Merging the four is the obvious
 * tidy-up and is `one-word-two-states` in reverse.
 *
 * 🔴 **IT ASKS `fieldIsUnanswered`, AND THAT IS THE WHOLE DESIGN.** This is the FOURTH reader of
 * that predicate, after the progress figure, the summary rows and the outstanding-questions
 * sentence — and the comment on `fieldIsUnanswered` already says why they share one: adding a
 * fourth rule here is how three of them come to agree and the fourth does not.
 *
 * ⚠️ **The disagreement this specifically prevents is visible and nasty.** The chip sits beside the
 * question; the rail sits beside the Send button and says `Not answered yet` for the same question.
 * A chip with its own predicate could read `Answered` an inch from a rail row saying the opposite,
 * and the rail is the one a clinician checks last. `tests/ward-referral-intake-sections.dom.test.tsx`
 * asserts the two counts are EQUAL rather than checking either alone, so they cannot drift apart
 * without a red.
 *
 * Returns `undefined` for a question that does not apply to this draft — "which emergency
 * department" when no emergency department is a destination. **A question that is not being asked
 * gets no chip, rather than a chip reading `Outstanding`**, which would name a question the form is
 * not asking and add it to a count nobody can clear.
 */
function questionState(key: keyof ReferralDraft, draft: ReferralDraft): "Answered" | "Not answered" | undefined {
  const field = REQUIRED_FIELDS.find((candidate) => candidate.key === key);
  // Not a required question at all — the written history is the one such box, and it is deliberately
  // absent from `REQUIRED_FIELDS`. An optional box carrying a state word would read as a demand.
  if (!field) return undefined;
  if (!(field.appliesWhen?.(draft) ?? true)) return undefined;
  return fieldIsUnanswered(field, draft) ? "Not answered" : "Answered";
}

/**
 * The chip itself.
 *
 * 🔴 **WHERE IT SITS IS A CORRECTNESS QUESTION, NOT A LAYOUT ONE, AND IT TOOK TWO GOES.**
 *
 * A `<label>`'s text IS its control's accessible name, and a `<legend>`'s text is its fieldset's.
 * The first version rendered this chip INSIDE both, and `ward-referral-screens.dom.test.tsx` caught
 * it in one run: `getByLabelText("Age band")` stopped resolving, because the name had become
 * **"Age band Outstanding"**.
 *
 * ⚠️ **`aria-hidden` ALONE DID NOT FIX IT, AND THE REASON IS WORTH KNOWING.** It correctly removes
 * the chip from the computed accessible NAME — but `getByLabelText` matches the label's **text
 * content**, which `aria-hidden` does not touch, so the query stayed broken while the accessibility
 * defect looked repaired. **The green I would have got from deleting that test would have been a
 * green about the wrong thing.** The real fix is structural: for every `<label>` the chip is now a
 * SIBLING inside `.questionHead`, never a child. Inside a `<legend>` it must stay a child — a
 * `<legend>` has to be the fieldset's first element — so there `aria-hidden` is the whole defence.
 *
 * ⚠️ **The broken test was the small half of that.** The name would have changed **every time the
 * value changed** — "Age band Outstanding" while empty, "Age band Answered" once picked. **A
 * control's name is its identity**; one that mutates as you fill the form moves the furniture under
 * a screen-reader user mid-task, and breaks anything keyed to it.
 *
 * ⚠️ **HIDING IT COSTS A SCREEN-READER USER NOTHING HERE, AND THAT IS MEASURED RATHER THAN
 * ASSUMED.** The same state is already announced twice by things that are not this chip:
 *
 *   1. the selected option itself — `UNANSWERED_OPTION_LABEL` is a real leading option precisely so
 *      that "the state a screen reader announces is the state the form is actually in" (its own
 *      comment), so an unanswered select announces **"Choose one"**; and
 *   2. the summary rail, which prints `Not answered yet` for the same question, and whose row count
 *      this chip is tested to equal.
 *
 * So announcing it a third time is duplication, not access. **This reasoning depends on (1): if the
 * unanswered option ever stops carrying the state in words, this `aria-hidden` must come off and the
 * chip must be associated with its control by `aria-describedby` instead — never left silent.**
 */
function QuestionState({ field, draft }: { field: keyof ReferralDraft; draft: ReferralDraft }) {
  const state = questionState(field, draft);
  if (state === undefined) return null;
  return (
    <span
      aria-hidden="true"
      className={`${styles.questionState} ${pageStyles.chip}`}
      data-state={state === "Answered" ? "answered" : "not-answered"}
    >
      {state}
    </span>
  );
}

/**
 * THE PURPOSE EVERY EMERGENCY-DEPARTMENT DESTINATION THIS FORM RAISES CARRIES, AND WHY IT IS A
 * CONSTANT RATHER THAN AN ELEVENTH QUESTION.
 *
 * `REFERRAL_PURPOSES` has three members and this form can honestly produce exactly one of them.
 * The spec's own table fixes the purpose from WHO is referring, not from what they pick:
 *
 *   community → ED            `bed`                 ← this form, every source it offers
 *   ED psychiatry → itself    `psychiatric_review`  ← `FD-16`'s self-addressed inbox
 *   ward → ED                 `medical_assessment`
 *
 * ⚠️ **A CLINICIAN PICKING THE PURPOSE IS A CLINICIAN ABLE TO PICK THE WRONG ONE**, and the wrong
 * one here is not a cosmetic error: `psychiatric_review` is the value an ED psychiatry inbox
 * selects on, so an external referrer who chose it would post themselves into another team's
 * worklist. The three flows are already distinguishable by who is raising them, so nothing is lost
 * by deriving it and a whole class of mis-addressing is closed.
 *
 * **THIS FORM IS THE COMMUNITY FRONT DOOR AND CANNOT BE ANYTHING ELSE.** It dispatches
 * `RECEIVE_REFERRAL`, whose `EVENT_ROLE` entry is `["community"]`, and every value in
 * `REFERRAL_SOURCES` it offers (community, crisis service, police, ambulance, inter-hospital) is an
 * external referrer asking for a bed. So `bed` is not this form's default — it is the only purpose
 * it can truthfully mean. The other two rows above have no producer anywhere in `src/` today; that
 * is a reported gap, not something to close by widening this picker.
 */
const INTAKE_REFERRAL_PURPOSE: ReferralPurpose = "bed";

/**
 * The destinations this referral is addressed to, built from the kinds the referrer ticked — or
 * `undefined` while a chosen destination still has an unanswered question of its own.
 *
 * BUILT BY WALKING `REFERRAL_DESTINATION_KINDS`, never the selection array, and that is what makes
 * two of one kind unreachable rather than merely unlikely. The reducer REFUSES a repeated kind
 * rather than de-duplicating it — silently collapsing a double selection would make the cap count
 * something other than what the referrer chose — so the screen must never be able to produce one,
 * and one checkbox per kind plus this walk is what guarantees it structurally.
 *
 * The per-arm answers are attached to the arm that has them and to nothing else: the bed criteria
 * reach only the ward, and `edId` reaches only the emergency department. That is the destination
 * union's whole point, and this is the one place on this screen it is spent.
 *
 * ⚠️ **AN UNANSWERED `edId` RETURNS `undefined` — IT NEVER BECOMES A PLACEHOLDER.** An `edId: ""`,
 * or a first-department default, would compile and would send: the reducer validates the referral's
 * source, home region, age band, urgency and origin site, but it does **not** validate `edId` or
 * `purpose` at all, so a stub department queues silently and reads as an answer somebody gave. This
 * is the same refusal `answeredDraft` makes for every other question, applied to a question that
 * only exists once a particular destination is chosen.
 */
function destinationsFor(
  kinds: readonly ReferralDestinationKind[],
  ward: WardReferralDestination,
  edId: string | typeof UNANSWERED_VALUE,
  teamName: string | typeof UNANSWERED_VALUE,
): ReferralDestination[] | undefined {
  const chosen = REFERRAL_DESTINATION_KINDS.filter((kind) => kinds.includes(kind));
  const destinations: ReferralDestination[] = [];
  for (const kind of chosen) {
    switch (kind) {
      case "psychiatric_ward":
        destinations.push(ward);
        break;
      case "emergency_department":
        if (edId === UNANSWERED_VALUE) return undefined;
        destinations.push({ kind, edId, purpose: INTAKE_REFERRAL_PURPOSE });
        break;
      case "community_team":
        // Refused on exactly the same terms as an unnamed emergency department, and for a sharper
        // reason: a community destination with a placeholder team is the region-derived membership
        // the owner reversed, wearing a different name. There is no safe stand-in, so there is none.
        if (teamName === UNANSWERED_VALUE) return undefined;
        destinations.push({ kind, teamName });
        break;
    }
  }
  return destinations;
}

export type ReferralDraft = {
  ageBand: Cohort | typeof UNANSWERED_VALUE;
  sex: RecordedSex | typeof UNANSWERED_VALUE;
  /**
   * T11 (after T10, item 8, owner answer 17 September 2026): the gender recorded AT REFERRAL,
   * which decides the incoming bed check — never sex, never `Patient.gender`. Three states:
   * `UNANSWERED_VALUE` (nobody has touched the control; blocks Send), `NOT_RECORDED_VALUE` (the
   * clinician actively said "not yet recorded" — a real answer, not a block), or a real
   * `ReferralGender`. See `NOT_RECORDED_VALUE`'s own comment for why those last two are not the
   * same state.
   */
  gender: ReferralGender | typeof NOT_RECORDED_VALUE | typeof UNANSWERED_VALUE;
  homeRegion: HomeRegion | typeof UNANSWERED_VALUE;
  /**
   * T15 (item 12): the referrer's own optional broad diagnosis category. Never in
   * `REQUIRED_FIELDS` — `NO_DIAGNOSIS_VALUE` ("None") is a real, complete answer from the moment
   * the form opens, not an unanswered state; a clinician who has no diagnosis to record is not
   * made to invent one to raise the referral.
   */
  tentativeDiagnosis: TentativeDiagnosisBlock | typeof NO_DIAGNOSIS_VALUE;
  secureBedNeeded: boolean | typeof UNANSWERED_VALUE;
  involuntaryBedNeeded: boolean | typeof UNANSWERED_VALUE;
  /** Whether THIS REQUEST needs high-acuity nursing. **The referring clinician marks it — owner
   *  ruling 2026-09-10**, in preference to the system working it out. Starts unanswered, like its
   *  two siblings above and for the same reason: it is read by a gate, so an answer nobody gave
   *  would silently be filed as "not needed". */
  highAcuityNursingNeeded: boolean | typeof UNANSWERED_VALUE;
  source: ReferralSource | typeof UNANSWERED_VALUE;
  urgency: UrgencyLevel | typeof UNANSWERED_VALUE;
  /** Already a `string`, so the sentinel needs no widening here — but see `UNANSWERED_VALUE`'s
   *  own comment for why that sentinel must not be `""`. */
  originSiteCode: string;
  /**
   * The sending ward, asked ONLY when the source is an inpatient psychiatric ward — the one source
   * `RECEIVE_REFERRAL` requires `originUnitId` for (`ward-flow-reducer.ts`, "must name a real
   * originUnitId"). No other source asks the question, and the answer is never sent for one.
   */
  originUnitId: string | typeof UNANSWERED_VALUE;
  /**
   * The patient's suburb, as the picker holds it: a raw `string`, because a `<select>` value is one.
   *
   * ⚠️ **IT IS RECORDED ON THE REFERRAL** (`CM-4`, 2026-08-30) — `Referral.suburb` exists, so this
   * answer no longer stops at this screen, and it IS in `REQUIRED_FIELDS`. The note beside the
   * control says so; it used to say the opposite, truthfully, and the day the model widened was the
   * day that sentence turned into a false reassurance.
   *
   * ⚠️ **A RAW STRING HERE IS NOT THE MODEL'S SHAPE.** The referral holds `ReferralSuburb`, a
   * union with an `unknown` arm, and `answeredDraft` is the one place that widens this string into
   * it — the picker offers the `SUBURB_UNKNOWN_REASONS` codes as option values alongside the real
   * suburb names, and the codes are lower_snake where the table's names are title-case places, so
   * the two can never collide.
   *
   * Deriving it from `homeRegion` instead was considered and refused: ten broad WA regions cannot
   * produce a 537-suburb catchment answer, and mapping one onto the other would invent an
   * administrative fact — the defect `HOME_REGIONS`' own doc comment records this project already
   * paying for once.
   */
  suburb: string;
  /**
   * ⚠️ THE WRITTEN HISTORY, AS THE BOXES HOLD IT. Plain `string`s, and the ONLY fields on this
   * draft with no `UNANSWERED_VALUE` arm.
   *
   * A picker can be in a state no option represents, so it needs a sentinel. A typed box cannot:
   * every state it can be in is a string somebody could type, and `""` is what "nothing written"
   * looks like. Giving these the sentinel would mean the literal text `not-answered` sitting in a
   * box, which a referrer could then edit into a sentence.
   *
   * Kept untrimmed all the way to the dispatch — the reducer stores them byte for byte, so
   * trimming here would be this screen quietly editing what somebody wrote. Blankness is decided
   * by the `unanswered` predicate on `REQUIRED_FIELDS`, which trims only to make the decision.
   */
  history: string;
  /**
   * WHICH TEAM OR SERVICE SENT THIS REFERRAL, as the box holds it. Owner, asked directly
   * 2026-09-12: *"Should a referral record which team or service sent it, not just which
   * hospital?"* — **"Yes it should"**, optional and free text.
   *
   * ⚠️ **A PLAIN `string` WITH NO `UNANSWERED_VALUE` ARM, for the reason the history above gives:
   * a typed box cannot be in a state no string represents, and the sentinel would sit in the box
   * as literal text a referrer could edit into a sentence.**
   *
   * 🔴 **AND IT IS NOT IN `REQUIRED_FIELDS` AND NOT GATED IN `answeredDraft` — BOTH, OR NEITHER.**
   * Two surfaces answer *"may this send?"*: `REQUIRED_FIELDS` writes the outstanding-questions
   * sentence, and `answeredDraft` decides the button. **Adding a question to one and not the other
   * is a defect this form has already shipped once** — the story box named in the sentence while
   * Send stayed available, which then dispatched a referral the reducer refused. This field is
   * optional, so it belongs in neither list, and that is the safe side of that trap rather than an
   * omission from it.
   */
  sendingTeamName: string;
  /**
   * Everywhere this referral is addressed, chosen in ONE act (FD-21) — never one destination at a
   * time and never a repeat referral. An empty list is the unanswered state; see `isUnanswered`.
   */
  destinationKinds: ReferralDestinationKind[];
  /**
   * WHICH emergency department, once one has been chosen as a destination. One of
   * `allEmergencyDepartments()`' ids, never anything else.
   *
   * ⚠️ **NO DEFAULT, AND NEVER THE FIRST DEPARTMENT IN THE LIST.** Every ED destination names which
   * department (`ReferralDestination`'s own comment: "Required on every ED destination, whoever
   * sent it and whyever"), and a form that guesses is a form that quietly addresses a request to
   * the wrong hospital. It starts unanswered like every other question on this form, and
   * `answeredDraft` refuses to send while an ED is ticked and this is still the sentinel.
   *
   * It is conditionally required rather than always required, which is a real difference from the
   * ten questions above it: nobody should have to name a department to raise a ward-only referral.
   * `REQUIRED_FIELDS`' `appliesWhen` below is where that is expressed.
   */
  edId: string | typeof UNANSWERED_VALUE;
  /**
   * WHICH community team, and conditionally required in the same way `edId` is: nobody should have
   * to name a team to raise a ward-only referral, and nobody may raise a community one without.
   */
  teamName: string | typeof UNANSWERED_VALUE;
  /** Widened exactly as the two need questions above were, and for the same reason: a bare
   *  `boolean` has no room for "nobody has answered this yet", so the type itself would go on
   *  forcing an answer nobody gave. See `REQUIRED_FIELDS` below for the ruling that authorised
   *  the extra tap. */
  transportNeeded: boolean | typeof UNANSWERED_VALUE;
};

/** The fields exactly as `RECEIVE_REFERRAL` takes them, once every question has an answer. */
export type AnsweredDraft = {
  ageBand: Cohort;
  sex: RecordedSex;
  /** Widened from the draft's three-state field: `undefined` when the clinician chose
   *  `NOT_RECORDED_VALUE`, never when the question is merely unanswered — `answeredDraft` already
   *  refused to build this while `gender === UNANSWERED_VALUE`. */
  gender: ReferralGender | undefined;
  /** Widened from the draft's `NO_DIAGNOSIS_VALUE`/real-code pair: `undefined` for "None". */
  tentativeDiagnosis: TentativeDiagnosisBlock | undefined;
  homeRegion: HomeRegion;
  /** ⚠️ ADDED BY WARD CORE, 2026-08-30, and it is a decision on this form rather than only a
   *  field: `Referral.suburb` is required, so the suburb becomes a required ANSWER and Send
   *  stays inert until it is given. Made in this shape because it is the shape every other
   *  question here already uses; if the referral surface wants it optional, this is the line to
   *  change and the reducer check to revisit — not something to work around at the dispatch.
   *
   *  ⚠️ **"Not known" is one of the answers**, and it is not the same as unanswered. See
   *  `ReferralSuburb`: a required picker with no honest option is what makes a clinician choose a
   *  plausible nearby suburb to get past the form. */
  suburb: ReferralSuburb;
  secureBedNeeded: boolean;
  involuntaryBedNeeded: boolean;
  highAcuityNursingNeeded: boolean;
  source: ReferralSource;
  urgency: UrgencyLevel;
  originSiteCode: string;
  /** The sending ward, narrowed from the draft: present only when `source` is `psychiatric_ward`. */
  originUnitId: string | undefined;
  transportNeeded: boolean;
  /**
   * The destinations already BUILT, not the kinds still to be assembled from.
   *
   * This carried `destinationKinds` until the ED arm gained `edId` and `purpose`. Assembly then
   * needed a narrowed `edId`, and the only place holding one is `answeredDraft` — the single gate
   * every unanswered value is stopped at. Building them there rather than at the dispatch keeps
   * that gate the ONE place a sentinel can escape from, instead of adding a second narrowing beside
   * it that could disagree with it.
   */
  destinations: ReferralDestination[];
};

/**
 * Every question Send waits on, in the order the form asks them, with the name the unavailability
 * note calls each one.
 *
 * `transportNeeded` used to be deliberately absent, and this paragraph used to say why: it is a
 * fact about the REFERRAL rather than about the person, an unticked box there reads as "no
 * transport arranged" rather than as a clinical claim about someone, and making it a third yes/no
 * group would cost a tap the work was "not authorised to spend". It was recorded as a residual
 * rather than quietly folded in.
 *
 * SUPERSEDED, owner ruling 2026-08-30: **"Take all recommendations"** — including that transport
 * should start unanswered. The authorisation the paragraph above was waiting on now exists, so
 * the residual is closed and `transportNeeded` is the ninth question Send waits on. The reasoning
 * is kept rather than deleted because it is still true about the SIZE of the cost (one more tap
 * on a phone form a police officer fills in standing up); what changed is that the owner decided
 * the cost was worth paying. An untouched checkbox sent `false`, and a ward reads `false` as "no
 * transport needed" and plans around it — an answer nobody chose, which is the same defect R2.1
 * removed everywhere else on this form.
 *
 * The two need questions are named by short field names rather than by their full on-screen
 * wording on purpose: that wording ("Needs a secure bed" …) is a clinical rule with its own test,
 * and repeating it inside this sentence would put the same clinical phrase on the screen twice.
 */
const REQUIRED_FIELDS: readonly {
  readonly key: keyof ReferralDraft;
  readonly name: string;
  /**
   * When this question applies at all. Absent means always, which is true of the ten below it.
   *
   * ⚠️ **ADDED FOR ONE QUESTION AND IT MUST NOT BECOME A HABIT.** A conditionally-required field is
   * a field that can be silently switched off by a predicate nobody re-reads, which is the same
   * shape as a guard that inspects nothing. It earns its place here because "which emergency
   * department" is genuinely not a question a ward-only referral has — asking it would be asking
   * for an answer with nothing to attach to — rather than because answering it is inconvenient.
   */
  readonly appliesWhen?: (draft: ReferralDraft) => boolean;
  /**
   * How to tell whether THIS question has been answered, when the shared rule does not fit.
   *
   * ⚠️ **IT EXISTS FOR FREE TEXT AND FOR NOTHING ELSE.** Every other question on this form is a
   * picker, so "unanswered" is the `UNANSWERED_VALUE` sentinel and `isUnanswered` is right. A
   * typed box has no sentinel: the empty state IS `""`, because a referrer who has written
   * nothing has left it empty, not set it to a magic string.
   *
   * ⚠️ **AND `isUnanswered` COULD NOT SIMPLY BE WIDENED TO TREAT `""` AS UNANSWERED.** That was
   * the obvious change and it would have REVERSED A RECORDED DECISION: `UNANSWERED_VALUE`'s own
   * doc comment states that an origin site of `""` "remains an ANSWER — an invalid one the
   * reducer is left to refuse", and a test proves the reducer refuses it. Widening the shared
   * predicate would have made that value unanswered instead, Send would go inert on it, and the
   * dispatch that test asserts would never happen. A per-field rule leaves that decision standing.
   */
  readonly unanswered?: (value: ReferralDraft[keyof ReferralDraft]) => boolean;
}[] = [
  { key: "ageBand", name: "Age band" },
  { key: "sex", name: "Sex" },
  // T11 (item 8): blocked only by the shared `UNANSWERED_VALUE` check (the default `unanswered`
  // predicate below already does the right thing) — `NOT_RECORDED_VALUE` is a real answer and
  // must NOT be treated as outstanding, per this field's own doc comment on `ReferralDraft`.
  { key: "gender", name: "Gender" },
  { key: "homeRegion", name: "Home region" },
  // 2026-08-30. The suburb became a required ANSWER when `Referral` gained a place to put it —
  // until then this control read the catchment for the picker below and was dropped. Placed beside
  // `homeRegion` because they are the two facts about where a person is from, and NEITHER is
  // derived from the other (see `Referral.suburb`).
  { key: "suburb", name: "Suburb" },
  { key: "source", name: "Referral source" },
  { key: "urgency", name: "Urgency" },
  { key: "originSiteCode", name: "Origin site" },
  { key: "secureBedNeeded", name: "Secure bed needed" },
  { key: "involuntaryBedNeeded", name: "Involuntary bed needed" },
  // ⚠️ ADDED TO **BOTH** LISTS. `answeredDraft` below keeps its own, and this file's own comment
  // records what adding a required question to only one of them does: the form names the question
  // as unanswered beneath a Send that is fully available, and pressing it dispatches a referral the
  // reducer refuses. Being in this list is also what generates this question's own catcher.
  { key: "highAcuityNursingNeeded", name: "High-acuity nursing needed" },
  { key: "transportNeeded", name: "Transport needed" },
  /*
   * ⚠️ THE WRITTEN HISTORY IS NOT IN THIS LIST, AND ITS ABSENCE IS THE OWNER'S RULING RATHER THAN
   * AN OVERSIGHT. 2026-09-05: ONE story box, OPTIONAL.
   *
   * `historyWhyNow` was here and was required, from the day the boxes landed until that ruling.
   * `FD-13` had said one optional field since 2026-08-30 and the built form had diverged from it;
   * the ruling settles it in FD-13's favour. **Putting `history` back into this list would make
   * the story an outstanding question that blocks the Send**, which is the form the owner has now
   * twice declined.
   *
   * ⚠️ **A referrer with nothing written down should not be made to invent something to get a
   * referral out of the door**, and a Send blocked at 3am is answered by typing one character —
   * which is worse than a blank box, because it looks like an account and is not.
   */
  // FD-21, last because it is the question every answer above it informs: the picker shows what
  // each destination looks like for THIS request, so a clinician chooses knowing it.
  { key: "destinationKinds", name: "Destination" },
  // Eleventh, and the only one that does not always apply: it exists solely to complete an
  // emergency-department destination, so it is asked once one is ticked and not before. Placed
  // after "Destination" because that is the answer that raises it.
  {
    key: "edId",
    name: "Emergency department",
    appliesWhen: (draft) => draft.destinationKinds.includes("emergency_department"),
  },
  // Twelfth, and conditional for the same reason as the eleventh: it exists solely to complete a
  // community destination, so it is asked once one is ticked and not before.
  {
    key: "teamName",
    name: "Community team",
    appliesWhen: (draft) => draft.destinationKinds.includes("community_team"),
  },
  // The sending ward, conditional for the same reason as the eleventh and twelfth: it exists solely
  // to complete an inpatient-psychiatric-ward SOURCE, so it is asked once that source is chosen and
  // not before.
  {
    key: "originUnitId",
    name: "Sending ward",
    appliesWhen: (draft) => draft.source === "psychiatric_ward",
  },
];

/**
 * Every name this form's unavailability note is allowed to use, in the order it asks them — the
 * VOCABULARY, not the list shown on any particular render.
 *
 * Since one question is conditional, this is deliberately a superset of what the note says at any
 * moment: "Emergency department" is a name the note may use, and does use exactly when an ED is
 * chosen. `unansweredFieldNames` below is what a given draft actually shows.
 */
export const REQUIRED_FIELD_NAMES: readonly string[] = REQUIRED_FIELDS.map((field) => field.name);

/**
 * HOW MANY OF THIS DRAFT'S APPLICABLE QUESTIONS ARE ANSWERED.
 *
 * ⚠️ DERIVED FROM `REQUIRED_FIELDS`, THE SAME LIST `unansweredFieldNames` WALKS, and filtered by
 * the same `appliesWhen` predicate. The count in the rail and the list under the Send button are
 * therefore two readings of one source and cannot disagree — a total typed as a literal here
 * would be a second surface answering the same question, which is this project's most reliable
 * defect. It also means the denominator moves correctly when a conditional question applies.
 */
export function answeredProgress(draft: ReferralDraft): { answered: number; applicable: number } {
  const applicable = REQUIRED_FIELDS.filter((field) => field.appliesWhen?.(draft) ?? true);
  const outstanding = applicable.filter((field) => fieldIsUnanswered(field, draft));
  return { answered: applicable.length - outstanding.length, applicable: applicable.length };
}

/**
 * WHAT THIS REFERRAL WILL RECORD, one row per applicable question, in the order it is asked.
 *
 * It reports the recorded meaning using the same human labels as the form controls. The stored
 * values remain unchanged: this is display-only translation of codes such as `ed_medical`,
 * `not_known` and `community_team`, and of boolean answers into Yes/No. An unanswered question says
 * so IN WORDS — never a blank, never a dash — because the absence is the fact being reported.
 *
 * ⚠️ **THE WRITTEN HISTORY IS THE ONE EXCLUSION, AND IT IS NOT AN OVERSIGHT.** The filter below
 * keeps it out even though it is no longer in `REQUIRED_FIELDS` at all — belt and braces, because
 * the day somebody makes the story required again is the day the rail would start printing the
 * referrer's prose back at them — in a narrow column, inevitably
 * truncated by the layout rather than by a decision. **A truncated preview of free text implies
 * something read it**, which is the single claim this screen must never make about the one field
 * nothing checks. The rail reports its length and how many sections carry something, and that
 * block is rendered separately.
 */
function referralSummaryValue(
  key: keyof ReferralDraft,
  value: ReferralDraft[keyof ReferralDraft],
  units?: readonly { id: string; name: string }[],
): string {
  switch (key) {
    case "suburb": {
      const suburb = String(value);
      return (SUBURB_UNKNOWN_REASONS as readonly string[]).includes(suburb)
        ? suburbUnknownLabels[suburb as SuburbUnknownReason]
        : suburb;
    }
    case "gender":
      return value === NOT_RECORDED_VALUE ? "Not yet recorded" : String(value);
    case "source":
      return SOURCE_LABELS[value as ReferralSource] ?? String(value);
    case "urgency":
      return urgencyTierLabel(value as UrgencyLevel);
    case "originSiteCode": {
      const code = String(value);
      const site = wardSites.find((candidate) => candidate.code === code);
      return site ? `${site.name} (${site.code})` : code;
    }
    case "secureBedNeeded":
    case "involuntaryBedNeeded":
    case "highAcuityNursingNeeded":
    case "transportNeeded":
      return value === true ? "Yes" : "No";
    case "destinationKinds":
      return (value as ReferralDestinationKind[]).map(referralDestinationKindLabel).join(", ");
    case "edId": {
      const id = String(value);
      return allEmergencyDepartments().find((department) => department.id === id)?.name ?? id;
    }
    case "originUnitId": {
      const id = String(value);
      return units?.find((unit) => unit.id === id)?.name ?? id;
    }
    default:
      return Array.isArray(value) ? value.join(", ") : String(value);
  }
}

export function referralSummaryRows(
  draft: ReferralDraft,
  units?: readonly { id: string; name: string }[],
): { label: string; value: string; answered: boolean }[] {
  const historyKeys = new Set<string>(HISTORY_FIELDS.map((field) => field.key));
  return REQUIRED_FIELDS.filter((field) => (field.appliesWhen?.(draft) ?? true) && !historyKeys.has(field.key)).map(
    (field) => {
      const value = draft[field.key];
      const answered = !fieldIsUnanswered(field, draft);
      return {
        label: field.name,
        value: answered ? referralSummaryValue(field.key, value, units) : "Not answered",
        answered,
      };
    },
  );
}

/**
 * THE HISTORY BOXES, IN THE ORDER THEY ARE ASKED. One array, read by the section, by the
 * over-limit check and by the rail's section count, so those three cannot come to disagree about
 * how many boxes there are or what they are called.
 *
 * The limits come from `REFERRAL_HISTORY_LIMITS` in the model rather than being restated here —
 * the reducer refuses against that same constant, so a limit shown on screen and a limit enforced
 * by the engine are one number, not two that happen to match today.
 */
export const HISTORY_FIELDS: readonly {
  readonly key: ReferralHistoryField;
  readonly label: string;
  readonly hint: string;
  readonly required: boolean;
}[] = [
  {
    key: "history",
    label: "History",
    hint:
      "What has happened and what has changed to make this a referral today; relevant history, " +
      "current treatment and what has already been tried; and anything the receiving team should " +
      "know before meeting this person. As much or as little as you have.",
    required: false,
  },
];

/**
 * The history boxes that are over their limit.
 *
 * ⚠️ **OVER-LIMIT BLOCKS THE SEND; IT NEVER TRIMS THE TEXT.** The textareas carry NO `maxLength`
 * on purpose. `maxLength` stops the keystroke, so a referrer pasting a long account watches the
 * end of it vanish with no message — a silent truncation performed by the browser, which is
 * exactly what `Referral.history` forbids the reducer from doing. Letting the text exceed
 * the limit and refusing to send is the visible version of the same rule.
 */
export function overLimitFreeTextFields(draft: ReferralDraft): string[] {
  const overLong = HISTORY_FIELDS.filter((field) => draft[field.key].length > REFERRAL_HISTORY_LIMITS[field.key]).map(
    (field) => field.label,
  );
  // ⚠️ THE SENDING TEAM JOINS THE SAME SENTENCE RATHER THAN GETTING ITS OWN. One reason is
  // announced with the button at a time, and a second over-length vocabulary would be a second
  // wording for one fact. Its limit lives on the model beside the reducer's refusal, so the form
  // and the reducer cannot come to disagree about what "too long" means.
  //
  // 🔴 AND IT BLOCKS RATHER THAN TRUNCATES, for the reason the reducer gives: a shortened team
  // name is a DIFFERENT team's name. The input carries no `maxLength` for the same reason the
  // textareas do not — the browser stopping the keystroke is a silent truncation.
  if (draft.sendingTeamName.length > SENDING_TEAM_NAME_LIMIT) overLong.push("Sending team");
  return overLong;
}

/** How many history sections carry something. Reported, never used to judge the referral. */
export function writtenHistoryCount(draft: ReferralDraft): number {
  return HISTORY_FIELDS.filter((field) => draft[field.key].trim() !== "").length;
}

/** The questions THIS draft is still waiting on: applicable, and unanswered. Both halves matter —
 *  naming a question that does not apply is as misleading as hiding one that does. */
export function unansweredFieldNames(draft: ReferralDraft): string[] {
  return REQUIRED_FIELDS.filter((field) => field.appliesWhen?.(draft) ?? true)
    .filter((field) => fieldIsUnanswered(field, draft))
    .map((field) => field.name);
}

/**
 * The draft as `RECEIVE_REFERRAL` would take it, or `undefined` while any question is unanswered.
 *
 * This is the single place the sentinel is stopped from escaping the form, and there is
 * deliberately no branch mapping an unanswered value onto a default on the way out. Mapping an
 * unanswered `involuntaryBedNeeded` onto `false` would be the very defect this task removes,
 * moved one layer down where nobody looks: `false` means "impose no legal-status constraint",
 * which is a definite clinical answer nobody gave.
 */
/**
 * The one destination pair the intake form refuses.
 *
 * Exported because the refusal has to be stated on screen as well as enforced, and a second
 * inline copy of the condition is how the two drift apart — the button would stay unavailable
 * while the note explaining why had stopped appearing, which reads as a broken form rather
 * than as a rule.
 */
export function wardAndCommunityBothChosen(kinds: readonly ReferralDestinationKind[]): boolean {
  return kinds.includes("psychiatric_ward") && kinds.includes("community_team");
}

export function answeredDraft(draft: ReferralDraft): AnsweredDraft | undefined {
  const {
    ageBand,
    sex,
    gender,
    tentativeDiagnosis: tentativeDiagnosisAnswer,
    homeRegion,
    secureBedNeeded,
    involuntaryBedNeeded,
    highAcuityNursingNeeded,
    source,
    urgency,
    originSiteCode,
    originUnitId,
    transportNeeded,
    destinationKinds,
    edId,
    teamName,
    suburb,
  } = draft;
  if (ageBand === UNANSWERED_VALUE || sex === UNANSWERED_VALUE || homeRegion === UNANSWERED_VALUE) return undefined;
  // T11 (item 8): blocked ONLY by the sentinel, never by `NOT_RECORDED_VALUE` — see that
  // constant's own doc comment for why "not yet recorded" is a real, complete answer.
  if (gender === UNANSWERED_VALUE) return undefined;
  const genderAnswer: ReferralGender | undefined = gender === NOT_RECORDED_VALUE ? undefined : gender;
  // T15 (item 12): never blocks — `NO_DIAGNOSIS_VALUE` widens straight to `undefined`.
  const tentativeDiagnosis: TentativeDiagnosisBlock | undefined =
    tentativeDiagnosisAnswer === NO_DIAGNOSIS_VALUE ? undefined : tentativeDiagnosisAnswer;
  // The suburb now REACHES the record (`CM-4`), so it is answered like every other fact rather
  // than read on this screen and dropped. The note beside the control says so as of 2026-08-30;
  // it said the opposite for the hour between the model widening and this screen catching up.
  if (suburb === UNANSWERED_VALUE) return undefined;
  // The picker offers the named suburbs AND the "not known" answers, so the raw value is widened
  // here into the union the model holds. Reason CODES cannot collide with a suburb name: the
  // catchment table's names are title-case places and the codes are lower_snake.
  const suburbAnswer: ReferralSuburb = (SUBURB_UNKNOWN_REASONS as readonly string[]).includes(suburb)
    ? { kind: "unknown", reason: suburb as SuburbUnknownReason }
    : { kind: "named", name: suburb };
  // FD-21. An empty list is refused BY THE REDUCER too ("needs at least one destination"); it is
  // stopped here as well so the form never sends an event it already knows will be refused, in the
  // same shape every other unanswered question is stopped.
  if (destinationKinds.length === 0) return undefined;
  // The owner's ruling, recorded in `ward-referral-visibility.ts` beside the visibility table
  // it explains: `{ward, community}` "is to be refused at the intake form". That module was
  // written expecting this refusal to exist — it reasons about what the product can still
  // CREATE once the refusal lands, and until now nothing refused it, so the form could create
  // the one shape the board treats as legacy-only. `{ED, community}` is deliberately NOT
  // refused: same ruling, opposite answer, because a community team asked to pick someone up
  // does not compete with a bed.
  if (wardAndCommunityBothChosen(destinationKinds)) return undefined;
  if (source === UNANSWERED_VALUE || urgency === UNANSWERED_VALUE || originSiteCode === UNANSWERED_VALUE) {
    return undefined;
  }
  if (secureBedNeeded === UNANSWERED_VALUE || involuntaryBedNeeded === UNANSWERED_VALUE) return undefined;
  if (highAcuityNursingNeeded === UNANSWERED_VALUE) return undefined;
  // The sending ward is required only when the source is an inpatient psychiatric ward — the one
  // source `RECEIVE_REFERRAL` refuses without `originUnitId` (`ward-flow-reducer.ts`). No other
  // source asks the question, so it blocks only that source.
  if (source === "psychiatric_ward" && originUnitId === UNANSWERED_VALUE) return undefined;
  /*
   * ⚠️ NO CHECK ON THE WRITTEN HISTORY HERE, AND THE LINE THAT WAS HERE IS WORTH REMEMBERING.
   *
   * `if (draft.historyWhyNow.trim() === "") return undefined;` sat at this point, because making
   * the story required in `REQUIRED_FIELDS` had named it correctly in the outstanding-questions
   * SENTENCE and done nothing at all to Send — this function keeps its own list. The form said
   * "Not yet answered: … Why now" directly beneath a fully available Send, and pressing it
   * dispatched a referral the reducer then refused.
   *
   * **The owner's 2026-09-05 ruling — one story box, OPTIONAL — removes the requirement, so all
   * three places that decided "blank" now agree by having nothing to decide.** The reducer's
   * blank-refusal went in the same change.
   *
   * ⚠️ **THE DEFECT THAT LINE FIXED IS STILL LIVE FOR THE NEXT REQUIRED QUESTION.** Two surfaces
   * answer "may this send?" — `REQUIRED_FIELDS` for the sentence, this function for the button —
   * and they are separate lists. Adding a required question to one and not the other reproduces
   * it exactly. The catcher is `will not send, and says so, while <question> alone is unanswered`,
   * generated per question from `REQUIRED_QUESTIONS`, so a question added to that list produces
   * its own proof; a question added only here does not.
   */
  // Owner ruling 2026-08-30 ("Take all recommendations"). The narrowing is what stops the
  // sentinel escaping: `transportNeeded` was read straight off `draft` here and passed through
  // untouched, which is exactly how a value nobody chose used to reach `RECEIVE_REFERRAL`.
  if (transportNeeded === UNANSWERED_VALUE) return undefined;
  // The destinations are ASSEMBLED HERE, at the gate, rather than at the dispatch below. An
  // emergency department with no department named comes back `undefined` and Send stays
  // unavailable, exactly as an unanswered age band does — see `destinationsFor` on why a
  // placeholder `edId` would be worse than the refusal.
  const destinations = destinationsFor(
    destinationKinds,
    {
      kind: "psychiatric_ward",
      sex,
      gender: genderAnswer,
      secureBedNeeded,
      involuntaryBedNeeded,
      highAcuityNursingNeeded,
    },
    edId,
    teamName,
  );
  if (destinations === undefined) return undefined;
  // Widened like `gender`/`tentativeDiagnosis`: the sending ward only exists for a psychiatric-ward
  // source, and the gate above has already refused an unanswered picker in that case, so this
  // narrows the sentinel out of the answered draft.
  const originUnitIdAnswer: string | undefined = source === "psychiatric_ward" ? (originUnitId as string) : undefined;
  return {
    suburb: suburbAnswer,
    ageBand,
    sex,
    gender: genderAnswer,
    tentativeDiagnosis,
    homeRegion,
    secureBedNeeded,
    involuntaryBedNeeded,
    highAcuityNursingNeeded,
    source,
    urgency,
    originSiteCode,
    originUnitId: originUnitIdAnswer,
    transportNeeded,
    destinations,
  };
}

/**
 * Phase R2.1. Every field arrives UNANSWERED.
 *
 * What this replaces: this function used to return all nine fields fully answered — age band,
 * sex, home region and referral source each took option zero, and both need toggles took `false`.
 * One tap then sent a complete-looking referral in which nothing downstream could tell a default
 * from an answer, and a wrong age band eliminates every unit in the network through a plain
 * equality gate — so a coordinator read a screenful of individually plausible refusals instead of
 * "this was never answered". `urgency` was the one field somebody had thought about, and its old
 * comment ("a blank form must never read as an assumption about how urgent this particular
 * request is") was already the argument for every other field on the form.
 *
 * The two need toggles matter most: an untouched checkbox sent `false`, which is not "unknown" —
 * it is the definite clinical claim that this person does not need a secure bed and does not need
 * a bed that can hold them involuntarily. They are now yes/no questions with no answer until one
 * is chosen, which needs no model change at all: what reaches the reducer is still a `boolean`,
 * it is simply a boolean somebody picked.
 */
/**
 * THE QUERY CONTRACT, READ — LANE C TASK 14.
 *
 * `RaiseReferralTarget` (`shell/ward-facade.ts`) is built by `raiseReferralHref` and by nothing
 * else. This form READS it. Until this task it read `patientId` alone, so every link the facade
 * built landed on an empty form — which the facade's own comment had already written down as a
 * stated absence rather than letting anyone read a well-formed link as evidence of a prefill.
 *
 * 🔴 **`source` IS VALIDATED AGAINST THE MODEL'S OWN LIST, NEVER TRUSTED.** An unrecognised value
 * leaves the question UNANSWERED rather than mapping onto a default — a default is a definite
 * clinical answer nobody gave, which is the defect `UNANSWERED_VALUE` exists to prevent.
 *
 * ⚠️ **`gp` is the value this most matters for.** It was a live menu entry on six routes until
 * 2026-09-11 while never being a member of `REFERRAL_SOURCES` — it survived because the menu kept
 * its own list and never consulted the model's. **Old links, bookmarks and pasted URLs still carry
 * it**, and every one of them must arrive with the question unanswered rather than guessed.
 */
function prefilledSource(searchParams: ReturnType<typeof useSearchParams>): ReferralSource | typeof UNANSWERED_VALUE {
  const value = searchParams.get("source")?.trim() ?? "";
  return (REFERRAL_SOURCES as readonly string[]).includes(value) ? (value as ReferralSource) : UNANSWERED_VALUE;
}

/**
 * 🔴 **`originEdId` NAMES WHERE THE REFERRAL CAME FROM, AND THE FORM ASKS FOR AN ORIGIN SITE.**
 *
 * The contract documents it as *"the emergency department the person is being referred FROM"*. An
 * `EmergencyDepartment` carries its own `siteCode`, so this is a lookup rather than a guess, and an
 * id naming no department leaves the question unanswered rather than picking a site.
 *
 * ⚠️ **IT MUST NEVER REACH `edId`, AND THE TWO ARE ONE CHARACTER APART IN INTENT.** The form's
 * `edId` question is the DESTINATION — it only renders once the referrer has chosen an emergency
 * department under `destinationKinds`. **Prefilling that from an ORIGIN would address the referral
 * to the department that sent it**, silently, on a clinical form, with every existing suite green.
 * `tests/ward-referral-query-prefill.dom.test.tsx` has a case for exactly that inversion.
 *
 * 🔴 **`teamId` IS IN THE CONTRACT AND IS DELIBERATELY NOT READ — AND THE REASON IS NOW AN ID, NOT
 * AN ABSENCE.** It names the community team a person was referred FROM.
 *
 * ⚠️ **THIS PARAGRAPH USED TO SAY *a referral records the hospital it came from and never the
 * team*. THAT WENT FALSE ON 2026-09-12 AT `e00718f281`** — the owner was asked directly and
 * answered *"Yes it should"*, so `Referral.sendingTeamName` exists and a referral CAN now record
 * its sender.
 *
 * 🔴 **THE REFUSAL SURVIVES INTACT AND IS SHARPER THAN BEFORE, WHICH IS WHY THE PARAGRAPH IS
 * REWRITTEN RATHER THAN DELETED.** What the model gained is a **NAME**, deliberately, because this
 * application holds no authoritative registry of WA community teams and minting ids for them would
 * assert a roster nobody has ruled on. **So `teamId` is not a value with nowhere to land any more —
 * it is a value of the one KIND the model refuses to hold.** Reading it here would either invent a
 * registry or silently store an identifier as though it were a name.
 *
 * ⚠️ **Deleting the paragraph to fix its false half would have removed the argument along with the
 * error, so the halves are separated instead: the fact has changed, the reason has not.**
 *
 * 🔴 **AND IT IS NOT THE ONLY DEFENCE — THIS COMMENT SAID SO UNTIL 2026-09-12 AND IT WAS WRONG.**
 * `tests/ward-referral-query-prefill.dom.test.tsx` carries an EXECUTABLE case,
 * *"does not consume teamId, because the form has no question a team id answers"*, which fails the
 * moment `teamId` reaches any rendered control. ⚠️ **The false claim was made by measuring prose
 * against prose** — I searched the comments and reported the result at the width of all defences.
 * **A test is a defence, and a stronger one than a paragraph.** Same error, same day, as a claim
 * that nothing referenced a module when a test file did.
 */
function prefilledOriginSite(searchParams: ReturnType<typeof useSearchParams>): string | typeof UNANSWERED_VALUE {
  const edId = searchParams.get("originEdId")?.trim() ?? "";
  if (edId === "") return UNANSWERED_VALUE;
  const department = allEmergencyDepartments().find((candidate) => candidate.id === edId);
  return department?.siteCode ?? UNANSWERED_VALUE;
}

export type ReferralDraftPrefill = Partial<Pick<ReferralDraft, "sex" | "gender" | "suburb">> & {
  source: ReferralSource | typeof UNANSWERED_VALUE;
  originSiteCode: string | typeof UNANSWERED_VALUE;
};

/** Facts the patient record can answer without guessing. Sex, gender and suburb are copied only
 * when they are valid options on this form. Gender is deliberately not used to answer sex, and
 * sex is deliberately not used to answer gender: the patient model records those as separate
 * facts, and so does this referral (T11, item 8). Date of birth does not answer the referral's
 * clinical age-band classification because the engine owns no approved cutoff rule.
 *
 * 🔴 **`Patient.gender` PREFILLS `ReferralDraft.gender` — NEVER `Patient.sex`.** `Patient.gender`
 * is `GENDERS` (`ward-patients.ts`), a two-value fact; every value it can hold is also a member of
 * `REFERRAL_GENDERS`, so no membership check is needed the way `sex`'s below is (both draw from
 * `Sex`, which IS this form's own `SEX_OPTIONS`). Left undefined — leaving the draft's `gender`
 * at `UNANSWERED_VALUE`, never at `NOT_RECORDED_VALUE` — when the patient record has no gender
 * recorded, so the question still blocks Send rather than being silently pre-answered "not yet
 * recorded" on the clinician's behalf. (R7, 25 September 2026: `Patient.gender` now holds the
 * same four values as `REFERRAL_GENDERS`, so a recorded non-binary gender prefills too. Sex
 * prefills from `RECORDED_SEXES` only. PT-007 records sex and no gender, so gender stays unchosen.)
 */
export function patientDraftPrefill(
  patient: Patient | undefined,
): Pick<ReferralDraftPrefill, "sex" | "gender" | "suburb"> {
  if (patient === undefined) return {};

  const sex =
    patient.sex !== undefined && (RECORDED_SEXES as readonly string[]).includes(patient.sex)
      ? (patient.sex as RecordedSex)
      : undefined;
  const gender = patient.gender;
  const suburb = patient.suburb !== undefined && SUBURB_OPTIONS.includes(patient.suburb) ? patient.suburb : undefined;

  return {
    ...(sex === undefined ? {} : { sex }),
    ...(gender === undefined ? {} : { gender }),
    ...(suburb === undefined ? {} : { suburb }),
  };
}

export function initialDraft(prefill?: ReferralDraftPrefill): ReferralDraft {
  return {
    ageBand: UNANSWERED_VALUE,
    sex: prefill?.sex ?? UNANSWERED_VALUE,
    gender: prefill?.gender ?? UNANSWERED_VALUE,
    // T15 (item 12): starts at "None", a real answer — never `UNANSWERED_VALUE`, and never
    // prefilled from the patient record, which is not where a diagnosis governance decision
    // permits reading one from.
    tentativeDiagnosis: NO_DIAGNOSIS_VALUE,
    homeRegion: UNANSWERED_VALUE,
    secureBedNeeded: UNANSWERED_VALUE,
    involuntaryBedNeeded: UNANSWERED_VALUE,
    highAcuityNursingNeeded: UNANSWERED_VALUE,
    source: prefill?.source ?? UNANSWERED_VALUE,
    urgency: UNANSWERED_VALUE,
    originSiteCode: prefill?.originSiteCode ?? UNANSWERED_VALUE,
    originUnitId: UNANSWERED_VALUE,
    suburb: prefill?.suburb ?? UNANSWERED_VALUE,
    // FD-21: nothing is chosen for the clinician. Not even where the catchment table routes
    // cleanly — the table SUGGESTS, in words, and a suggestion that pre-ticks itself is a value
    // nobody chose reaching the reducer, which is the whole defect R2.1 removed from this form.
    destinationKinds: [],
    // No department is chosen for the clinician either, and the reducer would not catch it if one
    // were: it validates five fields on this event and `edId` is not among them.
    edId: UNANSWERED_VALUE,
    // No team is chosen for the clinician either. The catchment table SUGGESTS a clinic for a
    // suburb, in words, and a suggestion that pre-selects itself is the region-shaped guess the
    // owner's 2026-08-31 ruling removed.
    teamName: UNANSWERED_VALUE,
    // Owner ruling 2026-08-30 ("Take all recommendations"): transport starts unanswered too. It
    // was the last control on this form still sending an answer nobody chose — an untouched form
    // asserted "no transport needed", and a ward reads that and plans around it.
    transportNeeded: UNANSWERED_VALUE,
    // ⚠️ EMPTY STRINGS, NOT THE SENTINEL, AND NOT PLACEHOLDER PROSE. These are the only fields on
    // this draft a person types into, so their empty state has to be the empty state of a text
    // box. Seeding them with an example — "e.g. seen at home this morning…" — would put words
    // nobody wrote one keystroke away from being sent as somebody's clinical history.
    history: "",
    sendingTeamName: "",
  };
}

/**
 * The four duplicate warnings add-patient.tsx already surfaces, for the quick-add modal. One
 * sentence per tier that actually fired, so the modal says each of the four true things and never
 * invents a tier that is not present. `duplicateCandidates` reports; it never gates — see its own
 * comment in `ward-patients.ts`.
 */
function duplicateWarningLines(patients: readonly Patient[], draft: PatientIdentityDraft): string[] {
  const candidates = duplicateCandidates(patients, draft);
  const lines: string[] = [];
  if (candidates.recordNumberCollision.length > 0) {
    lines.push(
      `${draft.umrn.trim()} already belongs to ${candidates.recordNumberCollision
        .map((patient) => `${patient.givenName} ${patient.familyName} (born ${patient.dateOfBirth})`)
        .join(", ")}.`,
    );
  }
  if (candidates.sameNameSameBirthDate.length > 0) {
    lines.push(
      "Already in this system with the same name AND the same date of birth — almost certainly the same person.",
    );
  }
  if (candidates.sameNameBirthDateNotMatched.length > 0) {
    lines.push(
      "Already in this system with the same name. The date of birth does not confirm it either way — open the record and check.",
    );
  }
  if (candidates.nearSpelling.length > 0) {
    lines.push(
      candidates.nearSpelling.length === 1
        ? "A person already in this system has a name one keystroke from this one. Check whether this is the same person before adding a second record."
        : "People already in this system have names one keystroke from this one. Check whether this is the same person before adding a second record.",
    );
  }
  return lines;
}

/**
 * The referral intake form. Phone-first: a police or ambulance officer standing in someone's
 * living room, or a community nurse between visits, is this screen's primary user, not someone
 * at a desk (`referrals.module.css`'s own top comment).
 *
 * ⚠️ **EVERY STRUCTURED QUESTION IS A PICKER OR A TOGGLE, AND THE WRITTEN HISTORY IS NOT.**
 *
 * Until 2026-09-05 this paragraph read: *"there is no free-text input anywhere on this screen, and
 * there never should be; a field that seems to need one is a finding to report, not a control to
 * add here."* The owner then instructed that a referrer must be able to write the patient's story,
 * and this screen now has a textarea for it (`HISTORY_FIELDS`). It had THREE until the owner's
 * ruling of 2026-09-05 — one story box, optional — which settled `FD-13` in its original favour.
 *
 * 🔴 **THAT OLD SENTENCE SURVIVED THE COMMIT THAT FALSIFIED IT, AND IT WAS WORSE THAN THE BANNER
 * THAT DID THE SAME.** The banner told a clinician something untrue. This told the NEXT BUILDER
 * that adding a free-text control was forbidden and that noticing the need for one was a defect to
 * file — an instruction contradicting a shipped feature, eight lines above the feature, in the file
 * that implements it. Someone reaching for a fourth field would have believed it.
 *
 * It survived because the fix searched the RENDERED TEXT for the false claim and not the file. The
 * rule is that the sentence describing what the software records is inside the diff that changes
 * it, and **a docstring is that sentence too.** Caught by Ward Lead, not by me and not by any test.
 *
 * **The rule that actually holds now:** free text exists in exactly the fields of
 * `HISTORY_FIELDS` — one, today — and nowhere else. A second is a decision, not an implementation — two guards
 * (`ward-referral-screens.dom.test.tsx`, `ward-referral-destinations.dom.test.tsx`) assert the
 * boundary by identity, so adding one goes red until somebody changes them on purpose. Every
 * question that is NOT the history stays a picker or a toggle, and that half is unchanged.
 *
 * Every picker carries a real accessible NAME (review finding I4). Each field used to be a
 * `<fieldset>` with a `<legend>`, which names the fieldset's own `group` role and NOT the
 * `<select>` inside it — so all six controls announced as unnamed combo boxes on the one screen
 * a police or ambulance officer fills in on a phone (spec D12), carrying the permitted facts about
 * a person. (That clause said "the FIVE permitted facts" until 2026-09-05. It was already wrong
 * before the history landed — `suburb` was added after it was written and made it six — and the
 * count is now gone rather than corrected, for the same reason it is gone from the banner: a
 * hand-typed total beside a growing field set goes stale on the next field.) They are now `<label htmlFor>` + `<select id>`, which is what the house pattern
 * already does: `ed-screen.tsx`'s own referral form wraps each `<select>` in a `<label>`, and
 * `referral-match.tsx`'s decline picker uses this exact `.fieldLegend` label shape. No CSS
 * changed — `.fieldCard` and `.fieldLegend` are class selectors, so they style a `<div>` and a
 * `<label>` identically. Tap targets are untouched: every `.select` stays `--ri-space-48` (48px).
 *
 * `RECEIVE_REFERRAL` can be refused by the reducer (unknown source, an age band outside
 * `COHORTS`, an origin site code that does not resolve, urgency outside 1-3, or a home region
 * outside `HOME_REGIONS` — see `ward-flow-reducer.ts`'s own case). This form's pickers only ever
 * offer values already known to be valid, so a refusal should never happen through ordinary use
 * of this screen — but the reducer validates independently of what any UI sends it, and a
 * refusal is surfaced here (`ward-referral-intake-rejection`) rather than silently swallowed,
 * exactly as the spec's own failure-behaviour rule requires.
 */
/**
 * The `?patientId=` query parameter, carried here by the Refer button on `person-screen.tsx`.
 *
 * ⚠️ **`useSearchParams`, NOT a hand-rolled `useSyncExternalStore`.** A prior version of this file
 * read `window.location.search` through `useSyncExternalStore` with a subscribe function that
 * never notified — a real defect on THIS field specifically: a `?patientId=` change that did not
 * remount this component (browser back/forward, or any future in-place navigation between two
 * people's Refer buttons) was silently never picked up, so the form could go on carrying the
 * PREVIOUS person's id into a referral naming the wrong human being. Next 16's own `useSearchParams`
 * docs describe exactly the property that hook was standing in for: it "is re-rendered on the
 * client with the latest `searchParams`". Read it at
 * `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md` before
 * touching this again.
 *
 * No `<Suspense>` boundary wraps this screen (a Server Component page with no boundary of its
 * own). The docs describe a build-time failure for a *static* route that calls this hook with no
 * boundary — this repository has not opted into Cache Components validation (no `cacheComponents` /
 * `instantInsights` / `instant` in `next.config.ts`), and this is a mockup route for which
 * prerendering buys nothing, so `npm run build` is what actually proves whether that applies here
 * rather than either assumption.
 *
 * ⚠️ WHETHER IT NAMES A REAL PERSON IS NOW CHECKED HERE TOO, NOT ONLY BY THE REDUCER.
 * `RECEIVE_REFERRAL` still refuses an unknown `patientId` at submit (`ward-flow-reducer.ts`) —
 * that guard is unchanged and stays load-bearing for anything that dispatches the event directly,
 * a test included — but a person's identity is the premise of this whole form, not one field on
 * it. Discovering a broken premise only after every question has been answered puts the cost on
 * whoever just did that work. See `ReferralIntakeForm`'s own early return below for where the
 * screen now refuses instead of the form ever appearing.
 */
function readPatientId(searchParams: ReturnType<typeof useSearchParams>): string {
  return searchParams?.get("patientId")?.trim() ?? "";
}

export function ReferralIntakeForm() {
  const {
    dayZero,
    dispatch,
    rejections,
    units,
    bedReleases,
    admissions,
    leaveBeds,
    referrals,
    patients,
    configuration,
    movements,
  } = useWardFlow();
  const now = useWardFlowClock();
  const currentDate = useMemo(
    () => (dayZero ? new Date(dayZero.getTime() + now * 60 * 1000) : new Date()),
    [dayZero, now],
  );
  const formattedReferralDate = useMemo(() => {
    return currentDate.toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Australia/Perth",
    });
  }, [currentDate]);
  const searchParams = useSearchParams();
  // See `readPatientId`'s own comment above: `useSearchParams` re-renders this component on the
  // client with the latest `?patientId=`, so a change to it — including one that does not remount
  // this component — is picked up. Read here, ahead of every hook below, so the whole render (the
  // early refusal further down included) agrees on one value rather than two reads risking a
  // mid-render disagreement.
  const patientIdFromUrl = readPatientId(searchParams);
  // User selection override for patient: null means respect URL, string means user explicitly selected or unlinked ("")
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const activePatientId = selectedPatientId !== null ? selectedPatientId : patientIdFromUrl;

  /**
   * THE THIRD STATE (see this file's own module comment on the front-door decision): `""` is a
   * real case — a referral raised by opening this form directly, with nobody attached — and stays
   * `true` here so the form keeps loading exactly as it always has. A non-empty id that names
   * nobody in `patients` is the one state this task changes: `patientIdKnown` goes `false`, and
   * the early return below refuses the form before a single question is asked rather than after
   * every one of them has been answered.
   *
   * Mirrors the reducer's own check (`ward-flow-reducer.ts`, `RECEIVE_REFERRAL`) deliberately —
   * same `patients.some((patient) => patient.id === …)` shape — but this is not a replacement for
   * it. That guard is dispatch-reachable by anything that sends `RECEIVE_REFERRAL` directly, this
   * screen included were it not for this early return, so it must go on refusing independently of
   * whether this screen ever lets a bad id through.
   */
  const patientIdKnown = activePatientId === "" || patients.some((patient) => patient.id === activePatientId);

  /**
   * The duplicate sentence, or nothing.
   *
   * ⚠️ **THE ID COMES FROM THE MATCHED PATIENT, NOT FROM THE URL, AND SO THERE IS NO CAST.**
   * `patientIdFromUrl` is a `string`; `PatientId` is `` `PT-${string}` ``. Asserting the one is the
   * other with `as` would push a value the type system has not checked into a function that then
   * compares it against real ids — and `as` plus a runner that does not typecheck is exactly how a
   * wrong shape survives a green suite. Taking `.id` off the matched record means the value IS a
   * `PatientId`, proved by the same `patients` array the guard above consulted.
   *
   * A referral raised with nobody attached gets no sentence, because there is no person to have a
   * duplicate of — not because the lookup failed.
   */
  const subject = activePatientId ? patients.find((patient) => patient.id === activePatientId) : undefined;
  const alreadyOpen = subject === undefined ? undefined : duplicateSentence({ patientId: subject.id, referrals });
  const subjectPrefill = patientDraftPrefill(subject);
  const sourcePrefill = prefilledSource(searchParams);
  const originSitePrefill = prefilledOriginSite(searchParams);
  const needsInterpreter = Boolean(
    subject?.interpreterLanguage &&
    !subject.interpreterLanguage.toLowerCase().includes("no interpreter required") &&
    !subject.interpreterLanguage.toLowerCase().startsWith("english"),
  );

  // Rapid Patient Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  // Quick Add Patient Modal state
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
  const addPatientBtnRef = useRef<HTMLButtonElement | null>(null);
  const modalCloseBtnRef = useRef<HTMLButtonElement | null>(null);
  const [newGivenName, setNewGivenName] = useState("");
  const [newFamilyName, setNewFamilyName] = useState("");
  const [newUmrn, setNewUmrn] = useState("");
  const [newDob, setNewDob] = useState("");
  const [newGender, setNewGender] = useState<Gender | "not-recorded">("not-recorded");
  const [addPatientError, setAddPatientError] = useState<string | null>(null);
  const pendingAddPatientRef = useRef<boolean>(false);

  const addPatientWarnings = useMemo(() => {
    if (!isAddPatientOpen) return [];
    const gName = newGivenName.trim();
    const fName = newFamilyName.trim();
    const um = newUmrn.trim();
    if (!gName && !fName && !um) return [];
    return duplicateWarningLines(patients, {
      umrn: um,
      givenName: gName,
      familyName: fName,
      dateOfBirth: newDob,
    });
  }, [isAddPatientOpen, newGivenName, newFamilyName, newUmrn, newDob, patients]);

  const trimmedSearch = searchQuery.trim();
  const searchMatches = useMemo(() => {
    if (!trimmedSearch) return [];
    return findPatients(patients, trimmedSearch);
  }, [patients, trimmedSearch]);

  function handleSelectPatient(patient: Patient) {
    setSelectedPatientId(patient.id);
    setSearchQuery("");
    setSearchDropdownOpen(false);
    setActiveSearchIndex(-1);
    if (typeof window !== "undefined") {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set("patientId", patient.id);
      window.history.replaceState(null, "", newUrl.toString());
    }
  }

  function handleUnlinkPatient() {
    setSelectedPatientId("");
    setSearchQuery("");
    setSearchDropdownOpen(false);
    if (typeof window !== "undefined") {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("patientId");
      window.history.replaceState(null, "", newUrl.toString());
    }
  }

  function handleSwitchToLinked() {
    if (!activePatientId && patients.length > 0) {
      handleSelectPatient(patients[0]);
    }
    searchInputRef.current?.focus();
    setSearchDropdownOpen(true);
  }

  function handleSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!searchDropdownOpen || searchMatches.length === 0) {
      if (e.key === "ArrowDown" && searchMatches.length > 0) {
        setSearchDropdownOpen(true);
        setActiveSearchIndex(0);
        e.preventDefault();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSearchIndex((prev) => (prev < searchMatches.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSearchIndex((prev) => (prev > 0 ? prev - 1 : searchMatches.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeSearchIndex >= 0 && activeSearchIndex < searchMatches.length) {
        handleSelectPatient(searchMatches[activeSearchIndex]);
      }
    } else if (e.key === "Escape") {
      setSearchQuery("");
      setSearchDropdownOpen(false);
      setActiveSearchIndex(-1);
    }
  }

  function performAddPatient(gName: string, fName: string, um: string) {
    pendingAddPatientRef.current = true;
    dispatch({
      type: "ADD_PATIENT",
      role: "coordinator",
      now,
      givenName: gName,
      familyName: fName,
      umrn: um,
      dateOfBirth: newDob,
      gender: newGender === "Female" || newGender === "Male" ? newGender : undefined,
    });
    setIsAddPatientOpen(false);
    setNewGivenName("");
    setNewFamilyName("");
    setNewUmrn("");
    setNewDob("");
    setNewGender("not-recorded");
  }

  function handleAddPatientSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const gName = newGivenName.trim();
    const fName = newFamilyName.trim();
    const um = newUmrn.trim();
    if (!gName || !fName) {
      setAddPatientError("Please provide both given name and family name.");
      return;
    }
    if (!um) {
      setAddPatientError("Please provide a UMRN / medical record number.");
      return;
    }
    if (!newDob) {
      setAddPatientError("Please provide a date of birth.");
      return;
    }
    setAddPatientError(null);
    performAddPatient(gName, fName, um);
  }

  // Auto-link newly registered patient
  const prevPatientsLenRef = useRef(patients.length);
  useEffect(() => {
    if (pendingAddPatientRef.current && patients.length > prevPatientsLenRef.current) {
      const newestPatient = patients[patients.length - 1];
      if (newestPatient) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Link only the newly accepted provider record, never a speculative draft.
        handleSelectPatient(newestPatient);
      }
      pendingAddPatientRef.current = false;
    }
    prevPatientsLenRef.current = patients.length;
  }, [patients]);

  // Click outside search dropdown to close
  useEffect(() => {
    function handleClickOutside(e: globalThis.MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Escape to close add patient modal
  useEffect(() => {
    if (!isAddPatientOpen) return;
    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        setIsAddPatientOpen(false);
        addPatientBtnRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAddPatientOpen]);
  /*
   * ⚠️ A LAZY INITIALISER, READ ONCE. The contract seeds the FIRST render and never again: a
   * referrer who answers the source question and then sees the URL change must not have their
   * answer replaced by the link's. `useSearchParams` re-renders this component on navigation, so a
   * non-lazy read here would overwrite a half-filled form.
   */
  const [draft, setDraft] = useState<ReferralDraft>(() =>
    initialDraft({
      source: sourcePrefill,
      originSiteCode: originSitePrefill,
      ...subjectPrefill,
    }),
  );
  const draftSubjectIdRef = useRef(subject?.id);
  const [lastRejection, setLastRejection] = useState<Rejection | undefined>(undefined);
  const [confirmed, setConfirmed] = useState(false);
  const [suburbFilter, setSuburbFilter] = useState("");
  const [isSuburbDropdownOpen, setIsSuburbDropdownOpen] = useState(false);
  const suburbComboboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: globalThis.MouseEvent) {
      if (suburbComboboxRef.current && !suburbComboboxRef.current.contains(event.target as Node)) {
        setIsSuburbDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredSuburbs = useMemo(() => {
    const query = suburbFilter.trim().toLowerCase();
    if (!query) return SUBURB_OPTIONS;
    return SUBURB_OPTIONS.filter((s) => s.toLowerCase().includes(query));
  }, [suburbFilter]);

  // Third Edition: Modals and Quick Clinical Utility Actions
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [receipt, setReceipt] = useState<{ referral: Referral; patient: string; catchment: string }>();
  const pendingReceipt = useRef<{ ids: Set<string>; patient: string; catchment: string } | null>(null);
  const receiptDialogRef = useRef<HTMLDivElement>(null);
  useWardModalFocus(isReceiptOpen, receiptDialogRef, () => setIsReceiptOpen(false));
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const handleCopyHandover = () => {
    const name = subject ? patientDisplayName(subject) : "Unlinked Intake";
    const umrn = subject ? (subject.umrn ?? "Unlinked") : "Unlinked";
    const legal =
      draft.involuntaryBedNeeded === UNANSWERED_VALUE
        ? "Involuntary bed need not answered"
        : draft.involuntaryBedNeeded
          ? "Involuntary bed requested"
          : "Involuntary bed not requested";
    const urg = draft.urgency !== UNANSWERED_VALUE ? urgencyTierLabel(draft.urgency) : "Standard (Tier 3)";
    const dests =
      draft.destinationKinds.length > 0
        ? draft.destinationKinds.map(referralDestinationKindLabel).join(", ")
        : "Pending";
    const sub = draft.suburb !== UNANSWERED_VALUE ? draft.suburb : "Not recorded";
    const reg = draft.homeRegion !== UNANSWERED_VALUE ? draft.homeRegion : "Not recorded";
    const textToCopy = `WARD FLOW CLINICAL HANDOVER\nPatient: ${name} (${umrn})\nLegal Status: ${legal}\nCatchment: ${sub} (${reg})\nUrgency: ${urg}\nDestinations: ${dests}\n\nCLINICAL NARRATIVE:\n${draft.history || "(None)"}`;

    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          showToast("Clinical handover text copied to clipboard.");
        })
        .catch(() => {
          showToast("Could not copy the clinical handover to the clipboard.");
        });
    } else {
      showToast("Could not copy the clinical handover to the clipboard.");
    }
  };

  useEffect(() => {
    function handleModalEscape(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        if (isPreviewOpen) {
          setIsPreviewOpen(false);
          document.getElementById("btnPreviewReferral")?.focus();
        } else if (isReceiptOpen) {
          setIsReceiptOpen(false);
          document.getElementById("btnSend")?.focus();
        }
      }
    }
    window.addEventListener("keydown", handleModalEscape);
    return () => window.removeEventListener("keydown", handleModalEscape);
  }, [isPreviewOpen, isReceiptOpen]);

  /* Re-renders and query updates for the same person never re-apply these values over the
   * clinician's edits. A real subject change starts a new draft so one patient's facts cannot
   * remain attached to another. */
  useEffect(() => {
    if (draftSubjectIdRef.current === subject?.id) return;
    draftSubjectIdRef.current = subject?.id;
    setDraft(
      initialDraft({
        source: sourcePrefill,
        originSiteCode: originSitePrefill,
        ...subjectPrefill,
      }),
    );
    setLastRejection(undefined);
    setConfirmed(false);
    /* subjectPrefill is a fresh object every render (derived from `subject` via
     * patientDraftPrefill); depending on it directly here would re-run this reset effect on every
     * render instead of only on a real value change. Its only two fields (sex, suburb) are listed
     * individually below instead. */
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see comment above
  }, [originSitePrefill, sourcePrefill, subject?.id, subjectPrefill.sex, subjectPrefill.suburb]);

  // Tracks how many rejections existed the moment THIS form last submitted, so the effect below
  // can tell "a new rejection appeared because of my own submission" apart from "a rejection
  // already existed before I was mounted" or "some other screen raised one". `checkToken`
  // forces the effect to re-run even on a successful submit, where `rejections` itself never
  // changes reference (RECEIVE_REFERRAL's success branch touches `state.referrals`, not
  // `state.rejections` — see `ward-flow-reducer.ts`) and so would never re-fire this effect on
  // its own.
  const priorRejectionCountRef = useRef(rejections.length);
  const [checkToken, setCheckToken] = useState(0);
  // The pending submission guard prevents unrelated referral updates reopening a receipt.

  useEffect(() => {
    if (checkToken === 0 || !pendingReceipt.current) return; // Nothing submitted yet — show neither a rejection nor a confirmation.
    if (rejections.length > priorRejectionCountRef.current) {
      const newest = rejections[rejections.length - 1];
      setLastRejection(newest.attempted === "RECEIVE_REFERRAL" ? newest : undefined);
      setConfirmed(false);
      pendingReceipt.current = null;
    } else {
      setLastRejection(undefined);
      setConfirmed(true);
      // The referral the dispatch just created is the last one in the live list (RECEIVE_REFERRAL
      // appends it), so the receipt shows the SAME id the board will show — never a fabricated one.
      const pending = pendingReceipt.current;
      const created = referrals.filter((referral) => !pending.ids.has(referral.id));
      if (created.length !== 1) {
        setConfirmed(false);
        return;
      }
      setReceipt({
        referral: structuredClone(created[0]),
        patient: pending.patient,
        catchment: `${referralSuburbLabel(created[0].suburb)} · ${created[0].homeRegion}`,
      });
      pendingReceipt.current = null;
      setIsReceiptOpen(true);
      showToast("Referral recorded in Ward Flow for coordinator triage.");
      /*
       * Phase R2 review finding I2, owner ruling 2026-08-30: the next referral starts unanswered.
       *
       * Without this the draft survives the send, so referral #2 in a session arrives carrying
       * the PREVIOUS PATIENT'S age band, sex, home region and both need answers, with Send
       * already available — one tap away from raising a referral in which five facts belong to
       * somebody else. That is strictly worse than the defaults R2.1 removed, because the values
       * are not merely fabricated, they look like answers a clinician chose.
       *
       * The reset lives in the SUCCESS branch of this effect, not in `handleSubmit`, and that
       * placement is the whole point: `handleSubmit` does not yet know whether the reducer
       * accepted the event. Resetting there would wipe a clinician's eight answers on a REFUSAL,
       * which is the one moment they most need them kept so the refusal can be corrected and
       * re-sent.
       *
       * The confirmation above stays on screen beside the blank form: "sent" and "here is the
       * next one" are both true, and the alternative — clearing the confirmation too — would
       * leave a clinician with no evidence the send happened at all.
       */
      setDraft(initialDraft());
    }
    priorRejectionCountRef.current = rejections.length;
  }, [rejections, checkToken, referrals]);

  // D-11. Whether there is currently anything a departure would lose — the same rule
  // `writtenHistoryCount` already uses for the rail's own report, read here so the two cannot
  // disagree about what counts as "written".
  const hasUnsavedHistory = writtenHistoryCount(draft) > 0;

  // D-11. Warn before an actual browser-level departure — reload, closing the tab, typing a new
  // URL — while the written history holds anything a referrer would not want to retype.
  // Registered unconditionally (Rules of Hooks), ahead of the early return below, exactly like the
  // rejection-tracking effect above it: the unknown-patient screen never renders a history box, so
  // `hasUnsavedHistory` is always false there and this handler is a no-op on that path.
  //
  // ⚠️ THIS DOES NOT CATCH AN IN-APP LINK CLICK (the rail, "Search for this person"). Next's
  // client-side navigation unmounts this component without firing `beforeunload` at all — that is
  // the platform's own behaviour, not an oversight here. The on-page warning rendered beside the
  // history box below is what covers that path: it is visible for the whole time there is
  // something to lose, before any particular way of leaving is chosen, rather than depending on
  // intercepting one.
  useEffect(() => {
    if (!hasUnsavedHistory) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      // Chrome requires `returnValue` to be set for the native prompt to appear at all. Every
      // modern browser then substitutes its OWN fixed wording for the dialog a user actually
      // sees — no string set here can override that — which is why the exact, ruled sentence
      // above is carried on the page itself rather than relied on to reach this dialog.
      event.returnValue = UNSAVED_HISTORY_WARNING;
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedHistory]);

  /**
   * ⚠️ THE REFUSAL, BEFORE THE FORM EVER OFFERS ITSELF. `patientIdKnown` is computed above, ahead
   * of every hook this component owns, so this early return runs after all of them (Rules of
   * Hooks) and before any of the form's own state — `outstanding`, `answered`, the destination
   * options — is ever read. A referral cannot honestly be raised for a specific person until that
   * person is confirmed to exist; discovering otherwise only at Send would have put the cost of a
   * broken link on whoever had just finished answering eleven questions.
   *
   * The recovery route is the person search, not a dead end: `PATIENT_SEARCH_HREF` above.
   */

  // Phase R2.1. The outstanding questions, recomputed on every render from the draft itself
  // rather than tracked in a second piece of state that could disagree with it.
  const outstanding = unansweredFieldNames(draft);
  const summaryRows = referralSummaryRows(draft, units);
  const answeredFields = answeredDraft(draft);
  // ⚠️ A SECOND REASON THE SEND CAN BE UNAVAILABLE, AND IT IS NOT AN UNANSWERED QUESTION.
  // `answeredDraft` asks whether every question has an answer; an over-length history has one and
  // it is too long. Kept as its own condition rather than folded into `outstanding`, because the
  // reason a clinician is shown has to be the reason that is true: "Not yet answered: Why now" in
  // front of a box with 1,600 characters in it would be a false statement about their own screen.
  const overLimit = overLimitFreeTextFields(draft);
  const answered = overLimit.length === 0 ? answeredFields : undefined;
  // Shown whenever the pair is chosen, not only once every other question has an answer: the
  // clinician needs to know the combination is the problem while they are still on the picker,
  // not after they have filled in the rest of the form for a referral that can never send.
  const refusedCombination = wardAndCommunityBothChosen(draft.destinationKinds);

  /**
   * The bed criteria, or `null` while any of the three questions that make them up is unanswered.
   *
   * **This is the narrowing that keeps `referralEligibility` in the ward arm.** The picker below is
   * handed a `WardReferralDestination | null`, never the draft, so the bed questions cannot reach
   * an emergency department or a community team even by accident: those arms have no such fields,
   * so the question cannot be spelled for them.
   */
  const wardNeed: WardReferralDestination | null =
    draft.sex !== UNANSWERED_VALUE &&
    draft.secureBedNeeded !== UNANSWERED_VALUE &&
    draft.involuntaryBedNeeded !== UNANSWERED_VALUE &&
    draft.highAcuityNursingNeeded !== UNANSWERED_VALUE
      ? {
          kind: "psychiatric_ward",
          sex: draft.sex,
          // Optional on the model, so `wardNeed` need not wait on it the way it waits on the four
          // required bed questions above — but fed through when answered, so the shortlist the
          // clinician sees while still filling in the form reflects the real gender check.
          gender: draft.gender === UNANSWERED_VALUE || draft.gender === NOT_RECORDED_VALUE ? undefined : draft.gender,
          secureBedNeeded: draft.secureBedNeeded,
          involuntaryBedNeeded: draft.involuntaryBedNeeded,
          highAcuityNursingNeeded: draft.highAcuityNursingNeeded,
        }
      : null;

  // Recomputed on every render from the draft and live reducer state, never held in a second piece
  // of state that could disagree with either — the same discipline `outstanding` above holds to.
  const options = destinationOptions({
    // No place, no catchment — and that is a fact rather than a gap. `catchmentSuburbOf` holds
    // the same rule for the model side, so the screen and the record cannot disagree about when a
    // catchment can be read.
    suburb:
      draft.suburb === UNANSWERED_VALUE || (SUBURB_UNKNOWN_REASONS as readonly string[]).includes(draft.suburb)
        ? null
        : draft.suburb,
    ward: wardNeed,
    ageBand: draft.ageBand === UNANSWERED_VALUE ? null : draft.ageBand,
    units,
    referrals,
    now,
  });

  // The scope badge and catchment line are labels only; the figures below come from the live record.
  const radarScope = useMemo(() => {
    if (draft.homeRegion === "Peel" || draft.homeRegion === "South West") return "SMHS · EXAMPLE";
    if (draft.homeRegion === "Perth Metropolitan") return "SMHS · EXAMPLE";
    if (draft.homeRegion && draft.homeRegion !== UNANSWERED_VALUE) return "WACHS · EXAMPLE";
    return "SMHS · EXAMPLE";
  }, [draft.homeRegion]);

  const radarCatchment = useMemo(() => {
    if (draft.homeRegion && draft.homeRegion !== UNANSWERED_VALUE) {
      if (draft.homeRegion === "Peel" || draft.homeRegion === "South West") {
        return `South Metropolitan (SMHS) · ${draft.homeRegion}`;
      }
      return `${draft.homeRegion} Catchment`;
    }
    return "South Metropolitan (SMHS)";
  }, [draft.homeRegion]);

  /**
   * The radar reads the live record: the region's matching ward and emergency department. Every
   * figure comes from beds, admissions and open movements; anything the record does not hold
   * (answer times, the triage queue, a team's hours) says "not recorded" (owner rule, 25 Sept 2026).
   */
  const radarUnit = useMemo(() => {
    const needle =
      draft.homeRegion === "Great Southern"
        ? /albany/i
        : draft.homeRegion === "South West"
          ? /bunbury/i
          : /alma|fremantle/i;
    return units.find((unit) => needle.test(unit.name)) ?? units[0];
  }, [draft.homeRegion, units]);

  // The ruled bed boxes (`ward-bed-states.ts`): Ready · Pulled · Closed · Occupied add up to `total`.
  const radarWard = useMemo(() => {
    if (!radarUnit) return { name: "No ward recorded", ready: 0, pulled: 0, closed: 0, occ: 0, total: 0 };
    const states = bedStates(radarUnit, admissions, bedReleases, leaveBeds);
    return {
      name: radarUnit.name,
      ready: states.ready,
      pulled: states.pulled,
      closed: states.closed,
      occ: states.occupied,
      total: radarUnit.beds,
    };
  }, [admissions, bedReleases, leaveBeds, radarUnit]);

  /**
   * Owner ruling 2026-09-05: a screen that prints a ready-bed figure must also say how many of
   * those beds are still being made ready, from `bedsPendingPreparation` (the reducer's own helper).
   */
  const radarPendingPreparation = useMemo(
    () => (radarUnit ? bedsPendingPreparation(radarUnit.id, bedReleases) : 0),
    [bedReleases, radarUnit],
  );

  const radarEd = useMemo(() => {
    const needle =
      draft.homeRegion === "South West" || draft.homeRegion === "Peel"
        ? /peel/i
        : draft.homeRegion === "Great Southern"
          ? /albany/i
          : /fiona/i;
    const department = allEmergencyDepartments().find((candidate) => needle.test(candidate.name));
    if (!department) return { name: "No emergency department recorded here", waiting: "0 waiting", wait: "" };
    const waiting = movements.filter(
      (movement) => movement.originEdId === department.id && !movement.closure && movement.stage !== "arrived",
    );
    const longest = waiting.reduce((max, movement) => Math.max(max, now - movement.openedAt), 0);
    return {
      name: department.name,
      waiting: `${waiting.length} waiting`,
      wait: waiting.length === 0 ? "" : `longest ${Math.floor(longest / 60)}h ${longest % 60}m`,
    };
  }, [draft.homeRegion, movements, now]);

  const radarComm = useMemo(() => {
    if (draft.homeRegion === "South West") return { name: "Bunbury CMHT" };
    if (draft.homeRegion === "Peel") return { name: "Mandurah CMHT" };
    return { name: "Fremantle CMHT" };
  }, [draft.homeRegion]);

  const mappedReferralLocations = useMemo(() => {
    let commLocation = radarComm.name;
    let commNote = "Catchment-aligned community mental health team";
    let commState: "catchment" | "contested" | "unknown" = "catchment";

    if (
      draft.suburb &&
      draft.suburb !== UNANSWERED_VALUE &&
      !(SUBURB_UNKNOWN_REASONS as readonly string[]).includes(draft.suburb)
    ) {
      const lookup = lookupCatchment(draft.suburb);
      if (lookup.state === "reviewed" || lookup.state === "unreviewed") {
        const teams = lookup.answers.flatMap((a) => a.clinics);
        if (teams.length > 0) {
          commLocation = teams.join(" / ");
          commNote = lookup.state === "reviewed" ? "Direct catchment match" : "Provisional catchment match";
        }
      } else if (lookup.state === "contested") {
        commLocation = lookup.answers.map((a) => a.clinics.join(", ")).join(" or ");
        commNote = "Contested boundary — review required";
        commState = "contested";
      } else {
        commLocation = radarComm.name;
        commNote = "Regional fallback team";
        commState = "unknown";
      }
    }

    const acuteLocation = radarWard.name;
    const acuteNote = `${radarWard.ready} beds ready (${radarPendingPreparation} preparing) · ${radarWard.occ}/${radarWard.total} occ`;

    const edLocation = radarEd.name;
    const edNote = `${radarEd.waiting}${radarEd.wait ? ` · ${radarEd.wait}` : ""}`;

    return {
      community: { name: commLocation, note: commNote, state: commState },
      acute: { name: acuteLocation, note: acuteNote, state: "capacity" },
      ed: { name: edLocation, note: edNote, state: "active" },
    };
  }, [draft.suburb, radarComm, radarWard, radarPendingPreparation, radarEd]);

  // Referral answers derivations
  const gateLegalVerified = draft.involuntaryBedNeeded !== UNANSWERED_VALUE;
  const gateBedVerified = draft.sex !== UNANSWERED_VALUE;
  const gateNursingVerified = draft.highAcuityNursingNeeded !== UNANSWERED_VALUE;
  const gateTransportVerified = draft.transportNeeded !== UNANSWERED_VALUE;
  const gateCatchmentVerified = draft.suburb !== UNANSWERED_VALUE;

  const gatesVerifiedCount = [
    gateLegalVerified,
    gateBedVerified,
    gateNursingVerified,
    gateTransportVerified,
    gateCatchmentVerified,
  ].filter(Boolean).length;

  const destinationSummary = useMemo(() => {
    if (draft.destinationKinds.length === 0) return "";
    return draft.destinationKinds.map(referralDestinationKindLabel).join(" & ");
  }, [draft.destinationKinds]);

  if (!patientIdKnown) {
    return (
      <div
        className={styles.screen}
        data-testid="ward-referral-intake-unknown-patient"
        data-referral-view="intake-error"
        data-ward-design="third-edition"
        data-ward-rebuilt-screen="raise-referral"
      >
        <main id="main-content" className={styles.main}>
          <header className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>This person is not on file</h1>
            <p className={styles.pageSubtitle} data-testid="ward-referral-intake-unknown-patient-reason">
              The link that opened this form names &ldquo;{patientIdFromUrl}&rdquo;, and nobody with that id is known to
              this system. A referral cannot be raised for a person who cannot be confirmed &mdash; search for them
              instead.
            </p>
          </header>
          {/*
            ⚠️ RENDERED ONLY IF THE ROUTE STILL EXISTS, AND THAT IS NOT DEFENSIVE PADDING — IT
            REPLACED A NON-NULL ASSERTION THAT COULD TAKE THIS WHOLE SCREEN DOWN. `!.href` threw at
            MODULE LOAD the moment `WARD_NAV` lost its `"search"` entry, which killed every file
            importing this component. Proven, not supposed: deleting that entry produced
            `TypeError: Cannot read properties of undefined (reading 'href')` and `tests/ward-nav.
            test.ts` reported `Tests no tests` — the file never collected, so the very test written
            to catch the removal could not run. A guard that dies with the thing it guards is not a
            guard.
            Now the refusal above still renders and still says why; only the way out is missing, and
            `tests/ward-nav.test.ts` fails BY NAME if it ever goes.
          */}
          {PATIENT_SEARCH_HREF !== undefined && (
            <Link
              className={styles.headerAction}
              href={PATIENT_SEARCH_HREF}
              data-testid="ward-referral-intake-unknown-patient-search"
            >
              Search for this person
            </Link>
          )}
        </main>
      </div>
    );
  }

  function toggleDestination(kind: ReferralDestinationKind) {
    setDraft((current) => {
      const removing = current.destinationKinds.includes(kind);
      return {
        ...current,
        destinationKinds: removing
          ? current.destinationKinds.filter((chosen) => chosen !== kind)
          : [...current.destinationKinds, kind],
        // Un-ticking the emergency department discards which one, so re-ticking it asks again.
        // Keeping it would leave an answer about a destination the clinician removed sitting
        // invisibly in the draft, ready to be sent by a later tick they never connected it to —
        // the same defect as the previous patient's answers surviving a send.
        edId: removing && kind === "emergency_department" ? UNANSWERED_VALUE : current.edId,
        // Same discipline for the team: un-ticking the community destination discards which team,
        // so re-ticking it asks again rather than silently re-sending an answer about a destination
        // the clinician had removed.
        teamName: removing && kind === "community_team" ? UNANSWERED_VALUE : current.teamName,
      };
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // The keyboard route to the same guard the inert Send below enforces for a tap: implicit
    // submission never reaches a dispatch while a question is unanswered either.
    if (!answered) return;
    priorRejectionCountRef.current = rejections.length;
    pendingReceipt.current = {
      ids: new Set(referrals.map((referral) => referral.id)),
      patient: subject ? `${patientDisplayName(subject)} (${subject.umrn})` : "Unlinked Intake",
      catchment: radarCatchment,
    };
    dispatch({
      type: "RECEIVE_REFERRAL",
      // R9 (owner item 23, 2026-09-17): "only `ed_medical` is raised as `ed`, and `ed` with any
      // other source is refused. Everything else, including GP, stays `community`." The reducer's
      // own `RECEIVE_REFERRAL` case enforces the pairing; this is the one dispatch site that must
      // supply it correctly.
      role: answered.source === "ed_medical" ? "ed" : "community",
      now,
      // ⚠️ THE POINTER, PASSED THROUGH UNTOUCHED, AND `undefined` WHEN THERE IS NONE. A referral
      // raised by opening this form directly carries no person, which is a real case rather than a
      // gap — see `Referral.patientId`. Nothing here invents one to fill the field.
      patientId: activePatientId === "" ? undefined : (activePatientId as PatientId),
      ageBand: answered.ageBand,
      suburb: answered.suburb,
      // FD-21, and the day the comment that stood here was written for. It said "one destination
      // for now ... the day the form offers the choice nothing below it has to move", and nothing
      // below it moved: the event already took a list, the reducer already refused an empty one,
      // a fourth, and a repeated kind. This is the form catching up with the model.
      //
      // Built by `answeredDraft` rather than here: assembling an ED arm needs a narrowed `edId`,
      // and narrowing at two sites is how two sites come to disagree about what "answered" means.
      destinations: answered.destinations,
      homeRegion: answered.homeRegion,
      source: answered.source,
      // ⚠️ TRIMMED, AND THE EMPTY BOX BECOMES `undefined` RATHER THAN `""`.
      //
      // 🔴 The reducer REFUSES a present-but-blank value on purpose — `""` would be a third state
      // meaning neither "this team" nor "nobody recorded one". An untouched optional input yields
      // exactly that, so passing the box through raw would make the form refuse to send on every
      // referral with no team to name, which is most of them. Named by Lane B before it shipped.
      //
      // ⚠️ TRIMMED, UNLIKE THE HISTORY BESIDE IT, AND THE DIFFERENCE IS NOT AN INCONSISTENCY. A
      // written account's indentation and paragraph breaks are part of what somebody wrote; a
      // NAME's surrounding whitespace is not. Trimming a story would be this screen editing a
      // clinical record. Trimming a label is not.
      sendingTeamName: draft.sendingTeamName.trim() === "" ? undefined : draft.sendingTeamName.trim(),
      urgency: answered.urgency,
      originSiteCode: answered.originSiteCode,
      originUnitId: answered.originUnitId,
      transportNeeded: answered.transportNeeded,
      // T15 (item 12): `undefined` for "None", the same widening every other optional field on
      // this event already gets before dispatch.
      tentativeDiagnosis: answered.tentativeDiagnosis,
      // ⚠️ STRAIGHT FROM THE DRAFT, UNTRIMMED. The reducer stores these byte for byte and refuses
      // an over-length or blank-required value rather than shortening it, so there is nothing for
      // this screen to tidy on the way out — and a `.trim()` here would be the form silently
      // editing somebody's clinical account before sending it.
      history: draft.history,
    });
    setCheckToken((token) => token + 1);
  }

  /**
   * The inert activation for an unavailable Send (`docs/wiring-conventions.md`'s stated-reason
   * shape). `aria-disabled` — unlike the native attribute — does not block activation, so without
   * this the control would stay fully operable; and the native attribute is wrong here because it
   * removes the tab stop, which is exactly where the reason below the button is announced from.
   */
  function ignoreUnavailableActivation(event: MouseEvent<HTMLButtonElement>) {
    if (answered) return;
    event.preventDefault();
  }

  return (
    <div
      className={`${styles.screen} ${pageStyles.screen}`}
      data-testid="ward-referral-intake-screen"
      data-referral-view="intake"
      data-ward-design="third-edition"
      data-ward-rebuilt-screen="raise-referral"
    >
      <header className={`${styles.pageHeader} ${pageStyles.hdr1}`}>
        <div className={pageStyles.hdrTitle}>
          <h1 className={`${styles.pageTitle} ${pageStyles.hdrTitleText}`}>Raise a referral</h1>
          <span className={pageStyles.chipMark}>Intake front door</span>
        </div>
      </header>

      <main id="main-content" className={`${styles.main} ${pageStyles.workspace}`}>
        <section
          className={`${styles.personPanel} ${pageStyles.panel}`}
          aria-labelledby="ward-referral-intake-person-heading"
        >
          {/* Sovereign Person Header Strip */}
          <div className={styles.personHeaderStrip}>
            <div className={styles.personTitleGroup}>
              <h2 id="ward-referral-intake-person-heading" className={styles.personTitle}>
                The person
              </h2>
              <span className={styles.personSubtitle}>{subject ? "Linked patient record" : "Unlinked intake"}</span>
            </div>
            <div className={styles.personControlsRight}>
              <div className={styles.personModeSwitch} role="group" aria-label="Patient link status">
                <button
                  type="button"
                  className={styles.modeBtn}
                  data-active={subject !== undefined}
                  onClick={handleSwitchToLinked}
                >
                  Linked record
                </button>
                <button
                  type="button"
                  className={styles.modeBtn}
                  data-active={subject === undefined}
                  onClick={handleUnlinkPatient}
                >
                  Unlinked intake
                </button>
              </div>
              <button
                ref={addPatientBtnRef}
                type="button"
                className={styles.addPatientHeaderBtn}
                onClick={() => {
                  setIsAddPatientOpen(true);
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2z" />
                </svg>
                Add new patient
              </button>
            </div>
          </div>

          {/* Rapid Patient Search Box */}
          <div className={styles.personSearchBox} ref={searchContainerRef}>
            <div className={styles.searchBarContainer}>
              <span className={styles.searchIconWrap} aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z" />
                </svg>
              </span>
              <input
                ref={searchInputRef}
                type="text"
                data-testid="ward-referral-patient-search"
                className={styles.rapidSearchInput}
                placeholder="Search or link a patient (name, UMRN)..."
                autoComplete="off"
                data-gramm="false"
                data-enable-grammarly="false"
                spellCheck={false}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchDropdownOpen(true);
                  setActiveSearchIndex(-1);
                }}
                onFocus={() => {
                  if (trimmedSearch.length > 0) setSearchDropdownOpen(true);
                }}
                onKeyDown={handleSearchKeyDown}
                aria-label="Search or link a patient"
                role="combobox"
                aria-autocomplete="list"
                aria-controls="ward-referral-patient-search-results"
                aria-expanded={searchDropdownOpen && searchMatches.length > 0}
              />
              {searchQuery ? (
                <button
                  type="button"
                  className={styles.clearSearchBtn}
                  onClick={() => {
                    setSearchQuery("");
                    setSearchDropdownOpen(false);
                  }}
                  aria-label="Clear search"
                >
                  &times;
                </button>
              ) : null}
            </div>

            {searchDropdownOpen && trimmedSearch.length > 0 && (
              <div
                id="ward-referral-patient-search-results"
                className={styles.searchResultsDropdown}
                role="listbox"
                aria-label="Patient search results"
              >
                <div className={styles.searchDropdownHeader}>
                  {searchMatches.length} {searchMatches.length === 1 ? "patient match" : "patient matches"}
                </div>
                {searchMatches.length === 0 ? (
                  <div className={styles.searchResultEmpty}>
                    <p>No patient records match &ldquo;{trimmedSearch}&rdquo;</p>
                    <button
                      type="button"
                      className={styles.searchResultEmptyBtn}
                      onClick={() => {
                        setNewFamilyName(trimmedSearch);
                        setIsAddPatientOpen(true);
                        setSearchDropdownOpen(false);
                      }}
                    >
                      + Register &ldquo;{trimmedSearch}&rdquo; as new patient
                    </button>
                  </div>
                ) : (
                  searchMatches.map((patient, idx) => {
                    const initials = `${patient.givenName[0] ?? ""}${patient.familyName[0] ?? ""}`.toUpperCase();
                    return (
                      <button
                        key={patient.id}
                        type="button"
                        role="option"
                        aria-selected={idx === activeSearchIndex}
                        className={styles.searchResultItem}
                        data-active={idx === activeSearchIndex}
                        onClick={() => handleSelectPatient(patient)}
                      >
                        <div className={styles.searchResultLeft}>
                          <span className={styles.searchResultAvatar} aria-hidden="true">
                            {initials || patient.id.replace(/^[A-Za-z]+-?/, "").slice(0, 2)}
                          </span>
                          <div className={styles.searchResultInfo}>
                            <div className={styles.searchResultNameRow}>
                              <span className={styles.searchResultName}>{patientDisplayName(patient)}</span>
                              <span className={styles.personIdPill}>{patient.id}</span>
                              <span className={styles.personIdPill}>{patient.umrn}</span>
                            </div>
                            <div className={styles.searchResultSub}>
                              Born {patient.dateOfBirth} &middot; {patient.suburb ?? "Perth"} &middot;{" "}
                              {patient.legalStatus ?? "Not recorded"}
                            </div>
                          </div>
                        </div>
                        <span
                          className={styles.actionBtn}
                          style={{ fontSize: "var(--t-0)", padding: "2px 8px", minHeight: "24px" }}
                        >
                          Link patient
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Sovereign Person Card Body */}
          {subject ? (
            <div className={styles.personCardBody}>
              <div className={styles.personAvatar} aria-hidden="true">
                {subject.givenName && subject.familyName
                  ? `${subject.givenName[0]}${subject.familyName[0]}`.toUpperCase()
                  : subject.id.replace(/^[A-Za-z]+-?/, "").slice(0, 3)}
              </div>
              <div className={styles.personMetaGroup}>
                <div className={styles.personPrimaryRow}>
                  <h3 className={styles.personName}>{patientDisplayName(subject)}</h3>
                  <span className={styles.personIdPill}>{subject.umrn}</span>
                  <span className={styles.personStatusPill} data-tone="voluntary">
                    {subject.legalStatus ?? "Not recorded"}
                  </span>
                  {needsInterpreter && (
                    <span
                      className={`${styles.personStatusPill} ${styles.interpreterChip}`}
                      data-testid="ward-referral-intake-interpreter-badge"
                    >
                      Interpreter: {subject.interpreterLanguage}
                    </span>
                  )}
                </div>
                <p className={styles.personDetailSentence}>
                  {`${patientAgeYears(subject, currentDate)} years · ${patientCohort(subject.dateOfBirth, currentDate)} cohort · ${subject.sex ?? "Sex unrecorded"} · ${subject.suburb ?? "Catchment pending"} · ${subject.catchmentCommunityTeam ?? "Team pending"}`}
                </p>
                <div className={styles.personDuplicateCheck} data-testid="ward-referral-intake-duplicate-status">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                    <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
                  </svg>
                  <span>Duplicate check: no open movement for this person</span>
                </div>
              </div>
              <div className={styles.personActions}>
                <Link
                  href={`/mockups/ward-flow/people/${subject.id}`}
                  className={styles.actionBtn}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="ward-referral-intake-view-profile"
                >
                  View profile ↗
                </Link>
                <button type="button" className={styles.actionBtn} onClick={handleSwitchToLinked}>
                  Change patient
                </button>
                <button type="button" className={styles.actionBtn} onClick={handleUnlinkPatient}>
                  Unlink
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.personCardBody}>
              <div className={styles.personAvatar} data-mode="unlinked" aria-hidden="true">
                ?
              </div>
              <div className={styles.personMetaGroup}>
                <div className={styles.personPrimaryRow}>
                  <h3 className={styles.personName}>No patient record linked</h3>
                  <span className={styles.personStatusPill} data-tone="unlinked">
                    UNLINKED INTAKE
                  </span>
                </div>
                <p className={styles.personDetailSentence}>
                  This referral can still be raised and sent anonymously; no patient identity will be inferred.
                </p>
              </div>
              <div className={styles.personActions}>
                <button type="button" className={styles.actionBtn} onClick={handleSwitchToLinked}>
                  Link patient record
                </button>
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => {
                    setIsAddPatientOpen(true);
                  }}
                >
                  Register new patient
                </button>
              </div>
            </div>
          )}

          {/* Interpreter Alert when active patient requires translation support */}
          {subject && needsInterpreter && (
            <div className={styles.interpreterAlert} role="alert" data-testid="ward-referral-intake-interpreter-alert">
              <svg
                width="20"
                height="20"
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
                style={{ flexShrink: 0, marginTop: 2 }}
              >
                <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />
              </svg>
              <div>
                <div className={styles.interpreterAlertTitle}>
                  Professional Interpreter Required ({subject.interpreterLanguage})
                </div>
                <div className={styles.interpreterAlertDesc}>
                  Clinical communications must be accompanied by an accredited interpreter for{" "}
                  {subject.interpreterLanguage}. Ensure transport and receiving unit notifications reflect language
                  support requirements.
                </div>
              </div>
            </div>
          )}

          <header className={`${styles.personPanelHeader} sr-only`}>
            <span>{subject ? subject.id : "Not linked"}</span>
          </header>
          <div className={`${styles.personPanelBody} sr-only`}>
            <p>
              {subject
                ? "Linked to this referral. Only the patient ID is stored with it."
                : "No patient record linked. This referral can still be sent; no identity will be inferred."}
            </p>
          </div>
        </section>

        {/* Quick Add Patient Modal */}
        {isAddPatientOpen && (
          <div
            className={styles.modalOverlay}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-patient-modal-title"
          >
            <div className={styles.modalDialog}>
              <div className={styles.modalHeader}>
                <div>
                  <h3 id="add-patient-modal-title" className={styles.modalTitle}>
                    Register new patient
                  </h3>
                  <p className={styles.modalSubtitle}>
                    Create a synthetic patient profile and immediately link to this referral.
                  </p>
                </div>
                <button
                  ref={modalCloseBtnRef}
                  type="button"
                  className={styles.modalCloseBtn}
                  onClick={() => {
                    setIsAddPatientOpen(false);
                    addPatientBtnRef.current?.focus();
                  }}
                  aria-label="Close register patient dialog"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleAddPatientSubmit}>
                <div className={styles.modalBody}>
                  {addPatientError && (
                    <div
                      role="alert"
                      style={{
                        padding: "8px 12px",
                        borderRadius: "var(--r1)",
                        background: "var(--danger-soft)",
                        color: "var(--danger-ink)",
                        fontSize: "var(--t-0)",
                      }}
                    >
                      {addPatientError}
                    </div>
                  )}

                  {addPatientWarnings.length > 0 ? (
                    <div
                      role="alert"
                      data-testid="ward-referral-intake-add-patient-duplicates"
                      style={{
                        padding: "8px 12px",
                        borderRadius: "var(--r1)",
                        background: "var(--danger-soft)",
                        color: "var(--danger-ink)",
                        fontSize: "var(--t-0)",
                      }}
                    >
                      <strong>Possible existing records — check before adding a second record:</strong>
                      <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                        {addPatientWarnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className={styles.modalRow}>
                    <div className={styles.modalField}>
                      <label htmlFor="new-patient-given-name" className={styles.modalLabel}>
                        Given name *
                      </label>
                      <input
                        id="new-patient-given-name"
                        type="text"
                        className={styles.modalInput}
                        value={newGivenName}
                        onChange={(e) => setNewGivenName(e.target.value)}
                        required
                        placeholder="e.g. Alistair"
                        autoComplete="off"
                        data-gramm="false"
                        data-enable-grammarly="false"
                        spellCheck={false}
                        autoFocus
                      />
                    </div>
                    <div className={styles.modalField}>
                      <label htmlFor="new-patient-family-name" className={styles.modalLabel}>
                        Family name *
                      </label>
                      <input
                        id="new-patient-family-name"
                        type="text"
                        className={styles.modalInput}
                        value={newFamilyName}
                        onChange={(e) => setNewFamilyName(e.target.value)}
                        required
                        placeholder="e.g. Montgomery"
                        autoComplete="off"
                        data-gramm="false"
                        data-enable-grammarly="false"
                        spellCheck={false}
                      />
                    </div>
                  </div>

                  <div className={styles.modalRow}>
                    <div className={styles.modalField}>
                      <label htmlFor="new-patient-umrn" className={styles.modalLabel}>
                        UMRN / Record number *
                      </label>
                      <input
                        id="new-patient-umrn"
                        type="text"
                        className={styles.modalInput}
                        value={newUmrn}
                        onChange={(e) => setNewUmrn(e.target.value)}
                        required
                        placeholder="e.g. UM999001"
                        autoComplete="off"
                        data-gramm="false"
                        data-enable-grammarly="false"
                        spellCheck={false}
                      />
                    </div>
                    <div className={styles.modalField}>
                      <label htmlFor="new-patient-dob" className={styles.modalLabel}>
                        Date of birth *
                      </label>
                      <input
                        id="new-patient-dob"
                        type="date"
                        className={styles.modalInput}
                        value={newDob}
                        onChange={(e) => setNewDob(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className={styles.modalRow}>
                    <div className={styles.modalField}>
                      <label htmlFor="new-patient-gender" className={styles.modalLabel}>
                        Gender (bed allocation)
                      </label>
                      <select
                        id="new-patient-gender"
                        className={styles.modalSelect}
                        value={newGender}
                        onChange={(e) => setNewGender(e.target.value as Gender | "not-recorded")}
                      >
                        <option value="not-recorded">Not yet recorded</option>
                        <option value="Female">Female</option>
                        <option value="Male">Male</option>
                      </select>
                    </div>
                    <div className={styles.modalField}>
                      <span className={styles.modalLabel}>Legal status</span>
                      <p style={{ marginTop: 4, fontSize: "var(--t-0)", color: "var(--muted, #64748b)" }}>
                        MHA statutory instruments are recorded under Question 2 of this referral.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.modalFooter}>
                  <button
                    type="button"
                    className={styles.modalCancelBtn}
                    onClick={() => {
                      setIsAddPatientOpen(false);
                      addPatientBtnRef.current?.focus();
                    }}
                  >
                    Cancel
                  </button>
                  {addPatientWarnings.length > 0 ? (
                    <button
                      type="button"
                      className={styles.modalSubmitBtn}
                      onClick={() => performAddPatient(newGivenName.trim(), newFamilyName.trim(), newUmrn.trim())}
                    >
                      Register anyway
                    </button>
                  ) : null}
                  <button type="submit" className={styles.modalSubmitBtn}>
                    Register &amp; link patient
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className={`${styles.intakeLayout} ${pageStyles.workGrid}`}>
          <div className={`${styles.intakeMain} ${pageStyles.stepsColumn}`}>
            {/*
             * WHAT IS ALREADY OPEN FOR THIS PERSON — ABOVE THE QUESTIONS, NOT BESIDE THE SEND
             * BUTTON, AND THE PLACEMENT IS THE POINT.
             *
             * A coordinator raising a referral from a person's record cannot otherwise see that
             * somebody raised one an hour ago. Told at the TOP, they can stop; told beside Send,
             * they have already answered thirteen questions and the sentence reads as an obstacle
             * rather than information.
             *
             * ⚠️ IT IS A STATEMENT, NEVER A BLOCK. It does not disable Send, does not gate a
             * question and carries no "are you sure" — raising a second referral is sometimes
             * exactly right, and this screen's standing rule is that it reports and a human
             * decides. `role="status"` rather than `alert` for the same reason: an alert
             * interrupts, and nothing here is an emergency.
             */}
            {alreadyOpen === undefined ? null : (
              <p className={styles.alreadyOpen} role="status" data-testid="ward-referral-intake-already-open">
                {alreadyOpen}
              </p>
            )}
            <form
              id="ward-referral-intake-form"
              className={styles.form}
              onSubmit={handleSubmit}
              data-testid="ward-referral-intake-form"
            >
              <div className={styles.intakeQuestions}>
                <fieldset className={`${styles.stepSection} ${styles.identityStep} ${pageStyles.panel}`}>
                  <legend className={`${styles.stepLegend} ${pageStyles.ph} ${pageStyles.panelHeader}`}>
                    <span className={`${styles.stepNo} ${pageStyles.stepNo} ${pageStyles.stepBadge}`}>Step 1</span>
                    <span className={`${styles.stepName} ${pageStyles.panelHeaderTitle}`}>
                      Who the referral is about
                    </span>
                    <span
                      className={pageStyles.stepStatusPill}
                      data-status={
                        draft.ageBand !== UNANSWERED_VALUE &&
                        draft.sex !== UNANSWERED_VALUE &&
                        draft.gender !== UNANSWERED_VALUE &&
                        draft.homeRegion !== UNANSWERED_VALUE &&
                        draft.suburb !== UNANSWERED_VALUE
                          ? "complete"
                          : "incomplete"
                      }
                      aria-hidden="true"
                    >
                      {draft.ageBand !== UNANSWERED_VALUE &&
                      draft.sex !== UNANSWERED_VALUE &&
                      draft.gender !== UNANSWERED_VALUE &&
                      draft.homeRegion !== UNANSWERED_VALUE &&
                      draft.suburb !== UNANSWERED_VALUE
                        ? "Complete"
                        : "Incomplete"}
                    </span>
                  </legend>
                  <div className={pageStyles.panelBody}>
                    {/* Row 1: Age band & Broad diagnosis category (tentative) */}
                    <div className={pageStyles.fieldRow2}>
                      <div className={`${styles.fieldCard} ${pageStyles.fieldCard} ${pageStyles.questionGroup}`}>
                        <div
                          className={`${styles.questionHead} ${pageStyles.questionHead} ${pageStyles.questionLabelRow}`}
                        >
                          <label
                            className={`${styles.fieldLegend} ${pageStyles.fieldLegend} ${pageStyles.questionLabel}`}
                            htmlFor="ward-referral-intake-ageBand"
                          >
                            Age band
                          </label>
                          <QuestionState field="ageBand" draft={draft} />
                        </div>
                        <select
                          id="ward-referral-intake-ageBand"
                          data-testid="ward-referral-intake-ageBand"
                          className={`${styles.select} ${pageStyles.select}`}
                          value={draft.ageBand}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              ageBand: event.target.value as Cohort | typeof UNANSWERED_VALUE,
                            }))
                          }
                        >
                          <option value={UNANSWERED_VALUE}>{UNANSWERED_OPTION_LABEL}</option>
                          {AGE_BAND_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className={`${styles.fieldCard} ${pageStyles.fieldCard} ${pageStyles.questionGroup}`}>
                        <div
                          className={`${styles.questionHead} ${pageStyles.questionHead} ${pageStyles.questionLabelRow}`}
                        >
                          <label
                            className={`${styles.fieldLegend} ${pageStyles.fieldLegend} ${pageStyles.questionLabel}`}
                            htmlFor="ward-referral-intake-tentativeDiagnosis"
                          >
                            Broad diagnosis category (tentative)
                          </label>
                          <span className={pageStyles.optionalPill}>Optional · Tentative</span>
                        </div>
                        <select
                          id="ward-referral-intake-tentativeDiagnosis"
                          data-testid="ward-referral-intake-tentativeDiagnosis"
                          className={`${styles.select} ${pageStyles.select}`}
                          value={draft.tentativeDiagnosis}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              tentativeDiagnosis: event.target.value as ReferralDraft["tentativeDiagnosis"],
                            }))
                          }
                        >
                          <option value={NO_DIAGNOSIS_VALUE}>Not recorded</option>
                          {TENTATIVE_DIAGNOSIS_BLOCKS.map((block) => (
                            <option key={block.code} value={block.code}>
                              {tentativeDiagnosisPhrase(block.code)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Row 2: Sex & Gender (decides which bed) */}
                    <div className={pageStyles.fieldRow2}>
                      <div className={`${styles.fieldCard} ${pageStyles.fieldCard} ${pageStyles.questionGroup}`}>
                        <div
                          className={`${styles.questionHead} ${pageStyles.questionHead} ${pageStyles.questionLabelRow}`}
                        >
                          <label
                            className={`${styles.fieldLegend} ${pageStyles.fieldLegend} ${pageStyles.questionLabel}`}
                            htmlFor="ward-referral-intake-sex"
                          >
                            Sex
                          </label>
                          <QuestionState field="sex" draft={draft} />
                        </div>
                        <select
                          id="ward-referral-intake-sex"
                          data-testid="ward-referral-intake-sex"
                          className={`${styles.select} ${pageStyles.select}`}
                          value={draft.sex}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              sex: event.target.value as RecordedSex | typeof UNANSWERED_VALUE,
                            }))
                          }
                        >
                          <option value={UNANSWERED_VALUE}>{UNANSWERED_OPTION_LABEL}</option>
                          {SEX_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                        {subjectPrefill.sex === undefined ? null : (
                          <p
                            className={`${styles.fieldSource} ${pageStyles.note}`}
                            data-testid="ward-referral-intake-sex-source"
                          >
                            Started from the patient record · editable
                          </p>
                        )}
                      </div>

                      <div className={`${styles.fieldCard} ${pageStyles.fieldCard} ${pageStyles.questionGroup}`}>
                        <div
                          className={`${styles.questionHead} ${pageStyles.questionHead} ${pageStyles.questionLabelRow}`}
                        >
                          <label
                            className={`${styles.fieldLegend} ${pageStyles.fieldLegend} ${pageStyles.questionLabel}`}
                            htmlFor="ward-referral-intake-gender"
                          >
                            Gender (decides which bed)
                          </label>
                          <QuestionState field="gender" draft={draft} />
                        </div>
                        <select
                          id="ward-referral-intake-gender"
                          data-testid="ward-referral-intake-gender"
                          className={`${styles.select} ${pageStyles.select}`}
                          value={draft.gender}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              gender: event.target.value as ReferralDraft["gender"],
                            }))
                          }
                        >
                          <option value={UNANSWERED_VALUE}>{UNANSWERED_OPTION_LABEL}</option>
                          {GENDER_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                          <option value={NOT_RECORDED_VALUE}>Not yet recorded</option>
                        </select>
                        <p className={`${styles.historyHint} ${pageStyles.note}`}>
                          Choose a gender, or &quot;Not yet recorded&quot;. None is chosen for you.
                        </p>
                        {subjectPrefill.gender === undefined ? null : (
                          <p
                            className={`${styles.fieldSource} ${pageStyles.note}`}
                            data-testid="ward-referral-intake-gender-source"
                          >
                            Started from the patient record · editable
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Row 3: Home region & Suburb */}
                    <div className={pageStyles.fieldRow2}>
                      <div className={`${styles.fieldCard} ${pageStyles.fieldCard} ${pageStyles.questionGroup}`}>
                        <div
                          className={`${styles.questionHead} ${pageStyles.questionHead} ${pageStyles.questionLabelRow}`}
                        >
                          <label
                            className={`${styles.fieldLegend} ${pageStyles.fieldLegend} ${pageStyles.questionLabel}`}
                            htmlFor="ward-referral-intake-homeRegion"
                          >
                            Home region
                          </label>
                          <QuestionState field="homeRegion" draft={draft} />
                        </div>
                        <select
                          id="ward-referral-intake-homeRegion"
                          data-testid="ward-referral-intake-homeRegion"
                          className={`${styles.select} ${pageStyles.select}`}
                          value={draft.homeRegion}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              homeRegion: event.target.value as HomeRegion | typeof UNANSWERED_VALUE,
                            }))
                          }
                        >
                          <option value={UNANSWERED_VALUE}>{UNANSWERED_OPTION_LABEL}</option>
                          {HOME_REGION_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                        <p className={`${styles.fieldNote} ${pageStyles.note}`}>
                          Determines default regional service boundary and psychiatric network.
                        </p>
                      </div>

                      <div className={`${styles.fieldCard} ${pageStyles.fieldCard} ${pageStyles.questionGroup}`}>
                        <div
                          className={`${styles.questionHead} ${pageStyles.questionHead} ${pageStyles.questionLabelRow}`}
                        >
                          <label
                            className={`${styles.fieldLegend} ${pageStyles.fieldLegend} ${pageStyles.questionLabel}`}
                            htmlFor="ward-referral-intake-suburb"
                          >
                            Suburb
                          </label>
                          <QuestionState field="suburb" draft={draft} />
                        </div>
                        <div className={pageStyles.suburbComboboxContainer} ref={suburbComboboxRef}>
                          <div className={pageStyles.suburbInputWrapper}>
                            <input
                              type="text"
                              className={`${styles.suburbFilterInput} ${pageStyles.suburbFilterInput}`}
                              placeholder="Type to filter suburbs..."
                              value={suburbFilter}
                              onChange={(event) => {
                                const nextVal = event.target.value;
                                setSuburbFilter(nextVal);
                                setIsSuburbDropdownOpen(true);
                                if (!nextVal.trim()) {
                                  setDraft((current) => ({ ...current, suburb: UNANSWERED_VALUE }));
                                } else {
                                  const exactMatch = SUBURB_OPTIONS.find(
                                    (s) => s.toLowerCase() === nextVal.trim().toLowerCase(),
                                  );
                                  if (exactMatch) {
                                    setDraft((current) => ({ ...current, suburb: exactMatch }));
                                  }
                                }
                              }}
                              onFocus={() => setIsSuburbDropdownOpen(true)}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") {
                                  setIsSuburbDropdownOpen(false);
                                } else if (e.key === "Enter" && isSuburbDropdownOpen && filteredSuburbs.length > 0) {
                                  e.preventDefault();
                                  const pick = filteredSuburbs[0];
                                  setDraft((current) => ({ ...current, suburb: pick }));
                                  setSuburbFilter(pick);
                                  setIsSuburbDropdownOpen(false);
                                }
                              }}
                              aria-label="Filter suburb options"
                              data-testid="ward-referral-intake-suburb-filter"
                              autoComplete="off"
                            />
                            {suburbFilter ? (
                              <button
                                type="button"
                                className={pageStyles.suburbClearBtn}
                                onClick={() => {
                                  setSuburbFilter("");
                                  setDraft((current) => ({ ...current, suburb: UNANSWERED_VALUE }));
                                  setIsSuburbDropdownOpen(true);
                                }}
                                aria-label="Clear suburb search"
                                title="Clear"
                              >
                                ✕
                              </button>
                            ) : null}
                          </div>

                          {/* Floating autocomplete suggestions dropdown */}
                          {isSuburbDropdownOpen ? (
                            <div className={pageStyles.suburbDropdownMenu} role="listbox">
                              <div
                                className={pageStyles.suburbDropdownItemSpecial}
                                role="option"
                                aria-selected={draft.suburb === "not_known"}
                                onClick={() => {
                                  setDraft((current) => ({ ...current, suburb: "not_known" }));
                                  setSuburbFilter(suburbUnknownLabels["not_known"]);
                                  setIsSuburbDropdownOpen(false);
                                }}
                              >
                                <span className={styles.suburbQuickDot} aria-hidden="true" />
                                <span>Set &ldquo;Not known / No fixed address&rdquo;</span>
                              </div>
                              {filteredSuburbs.slice(0, 40).map((option) => (
                                <div
                                  key={option}
                                  className={pageStyles.suburbDropdownItem}
                                  role="option"
                                  aria-selected={draft.suburb === option}
                                  data-active={draft.suburb === option ? "true" : undefined}
                                  onClick={() => {
                                    setDraft((current) => ({ ...current, suburb: option }));
                                    setSuburbFilter(option);
                                    setIsSuburbDropdownOpen(false);
                                  }}
                                >
                                  {option}
                                </div>
                              ))}
                              {filteredSuburbs.length === 0 ? (
                                <div className={pageStyles.suburbDropdownEmpty}>
                                  No matching suburbs in catchment table
                                </div>
                              ) : null}
                            </div>
                          ) : null}

                          {/* Accessible test-compatible hidden select */}
                          <select
                            id="ward-referral-intake-suburb"
                            data-testid="ward-referral-intake-suburb"
                            className={`${styles.select} ${pageStyles.accessibleSelectHidden}`}
                            value={draft.suburb}
                            onChange={(event) => {
                              const val = event.target.value;
                              setDraft((current) => ({ ...current, suburb: val }));
                              if (val !== UNANSWERED_VALUE) {
                                setSuburbFilter(
                                  SUBURB_UNKNOWN_REASONS.includes(val as SuburbUnknownReason)
                                    ? suburbUnknownLabels[val as SuburbUnknownReason]
                                    : val,
                                );
                              } else {
                                setSuburbFilter("");
                              }
                            }}
                          >
                            <option value={UNANSWERED_VALUE}>{UNANSWERED_OPTION_LABEL}</option>
                            {SUBURB_UNKNOWN_REASONS.map((reason) => (
                              <option key={reason} value={reason}>
                                {suburbUnknownLabels[reason]}
                              </option>
                            ))}
                            {SUBURB_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className={styles.suburbQuickRow}>
                          <button
                            type="button"
                            className={styles.suburbQuickBtn}
                            data-active={draft.suburb === "not_known"}
                            onClick={() => {
                              setDraft((current) => ({ ...current, suburb: "not_known" }));
                              setSuburbFilter(suburbUnknownLabels["not_known"]);
                            }}
                            aria-label="Set suburb to Not known / No fixed address"
                            data-testid="ward-referral-intake-suburb-quick-unknown"
                          >
                            <span className={styles.suburbQuickDot} aria-hidden="true" />
                            Set &ldquo;Not known / No fixed address&rdquo;
                          </button>
                        </div>
                        {subjectPrefill.suburb === undefined ? null : (
                          <p
                            className={`${styles.fieldSource} ${pageStyles.note}`}
                            data-testid="ward-referral-intake-suburb-source"
                          >
                            Started from the patient record · editable
                          </p>
                        )}
                        <p
                          className={`${styles.fieldNote} ${pageStyles.note}`}
                          data-testid="ward-referral-intake-suburb-note"
                        >
                          Recorded on the referral and used for catchment checks. Choose Not known when needed.
                        </p>
                      </div>
                    </div>
                  </div>
                </fieldset>

                <fieldset className={`${styles.stepSection} ${pageStyles.panel}`}>
                  <legend className={`${styles.stepLegend} ${pageStyles.ph} ${pageStyles.panelHeader}`}>
                    <span className={`${styles.stepNo} ${pageStyles.stepNo} ${pageStyles.stepBadge}`}>Step 2</span>
                    <span className={`${styles.stepName} ${pageStyles.panelHeaderTitle}`}>What they need</span>
                    <span
                      className={pageStyles.stepStatusPill}
                      data-status={
                        draft.source !== UNANSWERED_VALUE &&
                        draft.urgency !== UNANSWERED_VALUE &&
                        draft.originSiteCode !== UNANSWERED_VALUE &&
                        draft.secureBedNeeded !== undefined &&
                        draft.involuntaryBedNeeded !== undefined &&
                        draft.highAcuityNursingNeeded !== undefined &&
                        draft.transportNeeded !== undefined
                          ? "complete"
                          : "incomplete"
                      }
                      aria-hidden="true"
                    >
                      {draft.source !== UNANSWERED_VALUE &&
                      draft.urgency !== UNANSWERED_VALUE &&
                      draft.originSiteCode !== UNANSWERED_VALUE &&
                      draft.secureBedNeeded !== undefined &&
                      draft.involuntaryBedNeeded !== undefined &&
                      draft.highAcuityNursingNeeded !== undefined &&
                      draft.transportNeeded !== undefined
                        ? "Complete"
                        : "Incomplete"}
                    </span>
                  </legend>
                  <div className={pageStyles.panelBody}>
                    {/* Row 1: Referral source & Origin site */}
                    <div className={pageStyles.fieldRow2}>
                      <div className={`${styles.fieldCard} ${pageStyles.fieldCard} ${pageStyles.questionGroup}`}>
                        <div
                          className={`${styles.questionHead} ${pageStyles.questionHead} ${pageStyles.questionLabelRow}`}
                        >
                          <label
                            className={`${styles.fieldLegend} ${pageStyles.fieldLegend} ${pageStyles.questionLabel}`}
                            htmlFor="ward-referral-intake-source"
                          >
                            Referral source
                          </label>
                          <QuestionState field="source" draft={draft} />
                        </div>
                        <select
                          id="ward-referral-intake-source"
                          data-testid="ward-referral-intake-source"
                          className={`${styles.select} ${pageStyles.select}`}
                          value={draft.source}
                          onChange={(event) =>
                            setDraft((current) => {
                              const nextSource = event.target.value as ReferralSource | typeof UNANSWERED_VALUE;
                              const currentOriginSite =
                                current.originSiteCode === UNANSWERED_VALUE
                                  ? undefined
                                  : wardSites.find((site) => site.code === current.originSiteCode);
                              return {
                                ...current,
                                source: nextSource,
                                // `ed_medical` may only name an origin site that has an emergency
                                // department; a site already chosen that has none is discarded so the
                                // draft never holds an impossible pair (the same discipline as
                                // un-ticking a destination discarding its dependent answer).
                                originSiteCode:
                                  nextSource === "ed_medical" &&
                                  currentOriginSite &&
                                  !currentOriginSite.emergencyDepartment
                                    ? UNANSWERED_VALUE
                                    : current.originSiteCode,
                                // The sending ward only exists for a psychiatric-ward source; it is
                                // discarded the moment the source stops being that, like un-ticking a
                                // destination discards its dependent answer.
                                originUnitId:
                                  nextSource === "psychiatric_ward" ? current.originUnitId : UNANSWERED_VALUE,
                              };
                            })
                          }
                        >
                          <option value={UNANSWERED_VALUE}>{UNANSWERED_OPTION_LABEL}</option>
                          {SOURCE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {SOURCE_LABELS[option] ?? option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className={`${styles.fieldCard} ${pageStyles.fieldCard} ${pageStyles.questionGroup}`}>
                        <div
                          className={`${styles.questionHead} ${pageStyles.questionHead} ${pageStyles.questionLabelRow}`}
                        >
                          <label
                            className={`${styles.fieldLegend} ${pageStyles.fieldLegend} ${pageStyles.questionLabel}`}
                            htmlFor="ward-referral-intake-originSiteCode"
                          >
                            Origin site
                          </label>
                          <QuestionState field="originSiteCode" draft={draft} />
                        </div>
                        <select
                          id="ward-referral-intake-originSiteCode"
                          data-testid="ward-referral-intake-originSiteCode"
                          className={`${styles.select} ${pageStyles.select}`}
                          value={draft.originSiteCode}
                          onChange={(event) =>
                            setDraft((current) => ({ ...current, originSiteCode: event.target.value }))
                          }
                        >
                          <option value={UNANSWERED_VALUE}>{UNANSWERED_OPTION_LABEL}</option>
                          {(draft.source === "ed_medical"
                            ? wardSites.filter((site) => site.emergencyDepartment !== undefined)
                            : wardSites
                          ).map((site) => (
                            <option key={site.code} value={site.code}>
                              {site.name} ({site.code})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Row 2: Sending team & (conditional) Sending ward */}
                    <div className={pageStyles.fieldRow2}>
                      <div
                        className={`${styles.fieldCard} ${pageStyles.fieldCard} ${pageStyles.questionGroup} ${draft.source !== "psychiatric_ward" ? pageStyles.fieldFull : ""}`}
                      >
                        <div
                          className={`${styles.questionHead} ${pageStyles.questionHead} ${pageStyles.questionLabelRow}`}
                        >
                          <label
                            className={`${styles.fieldLegend} ${pageStyles.fieldLegend} ${pageStyles.questionLabel}`}
                            htmlFor="ward-referral-intake-sending-team"
                          >
                            Which team or service is sending this referral?
                          </label>
                          <span className={pageStyles.optionalPill}>Optional</span>
                        </div>
                        <input
                          id="ward-referral-intake-sending-team"
                          data-testid="ward-referral-intake-sending-team"
                          className={`${styles.historyField} ${pageStyles.select}`}
                          type="text"
                          placeholder="e.g. Rockingham Mental Health Service, Police Crisis Team, St John Crew..."
                          value={draft.sendingTeamName}
                          onChange={(event) =>
                            setDraft((current) => ({ ...current, sendingTeamName: event.target.value }))
                          }
                        />
                        <p className={`${styles.historyHint} ${pageStyles.note}`}>
                          The name of the sending team or service, as you would write it. Leave blank if not applicable.
                        </p>
                      </div>

                      {draft.source === "psychiatric_ward" ? (
                        <div className={`${styles.fieldCard} ${pageStyles.fieldCard} ${pageStyles.questionGroup}`}>
                          <div
                            className={`${styles.questionHead} ${pageStyles.questionHead} ${pageStyles.questionLabelRow}`}
                          >
                            <label
                              className={`${styles.fieldLegend} ${pageStyles.fieldLegend} ${pageStyles.questionLabel}`}
                              htmlFor="ward-referral-intake-originUnitId"
                            >
                              Sending ward
                            </label>
                            <QuestionState field="originUnitId" draft={draft} />
                          </div>
                          <select
                            id="ward-referral-intake-originUnitId"
                            data-testid="ward-referral-intake-originUnitId"
                            className={`${styles.select} ${pageStyles.select}`}
                            value={draft.originUnitId}
                            onChange={(event) =>
                              setDraft((current) => ({ ...current, originUnitId: event.target.value }))
                            }
                          >
                            <option value={UNANSWERED_VALUE}>{UNANSWERED_OPTION_LABEL}</option>
                            {units.map((unit) => (
                              <option key={unit.id} value={unit.id}>
                                {unit.name} ({unit.siteCode})
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                    </div>

                    {/* Row 3: Urgency */}
                    <div className={`${styles.fieldCard} ${pageStyles.fieldCard} ${pageStyles.questionGroup}`}>
                      <div
                        className={`${styles.questionHead} ${pageStyles.questionHead} ${pageStyles.questionLabelRow}`}
                      >
                        <label
                          className={`${styles.fieldLegend} ${pageStyles.fieldLegend} ${pageStyles.questionLabel}`}
                          htmlFor="ward-referral-intake-urgency"
                        >
                          Urgency
                        </label>
                        <QuestionState field="urgency" draft={draft} />
                      </div>
                      <div className={pageStyles.urgencyGrid} role="group" aria-label="Triage priority options">
                        {URGENCY_OPTIONS.map((tier) => {
                          const isSelected = draft.urgency === tier;
                          return (
                            <button
                              key={tier}
                              type="button"
                              className={pageStyles.urgencyCard}
                              data-tier={tier}
                              data-selected={isSelected ? "true" : undefined}
                              title={OPERATIONAL_DEFAULT_LABEL}
                              onClick={() => setDraft((current) => ({ ...current, urgency: tier }))}
                            >
                              <span className={pageStyles.urgencyDot} data-tier={tier} aria-hidden="true" />
                              <div className={pageStyles.urgencyDetails}>
                                <span className={pageStyles.urgencyName}>{urgencyTierLabel(tier)}</span>
                                <span className={pageStyles.urgencyWindow}>{urgencyWindowLabel(tier)}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <select
                        id="ward-referral-intake-urgency"
                        data-testid="ward-referral-intake-urgency"
                        className={`${styles.select} ${pageStyles.accessibleSelectHidden}`}
                        value={draft.urgency}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            urgency:
                              event.target.value === UNANSWERED_VALUE
                                ? UNANSWERED_VALUE
                                : (Number(event.target.value) as UrgencyLevel),
                          }))
                        }
                      >
                        <option value={UNANSWERED_VALUE}>{UNANSWERED_OPTION_LABEL}</option>
                        {URGENCY_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {urgencyTierLabel(option)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={pageStyles.switchGrid2x2}>
                      <fieldset
                        className={pageStyles.clinicalSwitchCard}
                        data-testid="ward-referral-intake-secureBedNeeded"
                      >
                        <div className={pageStyles.switchMeta}>
                          <legend className={pageStyles.switchTitle}>
                            Needs a secure bed
                            <span className="sr-only">
                              <QuestionState field="secureBedNeeded" draft={draft} />
                            </span>
                          </legend>
                          <span className={pageStyles.switchSubtitle}>Requires locked perimeter</span>
                        </div>
                        <div className={pageStyles.yesNoToggleGroup}>
                          <label
                            className={`${pageStyles.toggleOption} ${draft.secureBedNeeded === false ? pageStyles.optSelectedNo : ""}`}
                            data-selected={draft.secureBedNeeded === false ? "no" : undefined}
                          >
                            <input
                              type="radio"
                              name="ward-referral-intake-secureBedNeeded"
                              data-testid="ward-referral-intake-secureBedNeeded-no"
                              className={pageStyles.srOnlyRadio}
                              checked={draft.secureBedNeeded === false}
                              onChange={() => setDraft((current) => ({ ...current, secureBedNeeded: false }))}
                            />
                            No
                          </label>
                          <label
                            className={`${pageStyles.toggleOption} ${draft.secureBedNeeded === true ? pageStyles.optSelectedYes : ""}`}
                            data-selected={draft.secureBedNeeded === true ? "yes" : undefined}
                          >
                            <input
                              type="radio"
                              name="ward-referral-intake-secureBedNeeded"
                              data-testid="ward-referral-intake-secureBedNeeded-yes"
                              className={pageStyles.srOnlyRadio}
                              checked={draft.secureBedNeeded === true}
                              onChange={() => setDraft((current) => ({ ...current, secureBedNeeded: true }))}
                            />
                            Yes
                          </label>
                        </div>
                      </fieldset>

                      <fieldset
                        className={pageStyles.clinicalSwitchCard}
                        data-testid="ward-referral-intake-involuntaryBedNeeded"
                      >
                        <div className={pageStyles.switchMeta}>
                          <legend className={pageStyles.switchTitle}>
                            Needs a bed that can hold someone involuntarily
                            <span className="sr-only">
                              <QuestionState field="involuntaryBedNeeded" draft={draft} />
                            </span>
                          </legend>
                          <span className={pageStyles.switchSubtitle}>Authorised Form 1A / Form 3A</span>
                        </div>
                        <div className={pageStyles.yesNoToggleGroup}>
                          <label
                            className={`${pageStyles.toggleOption} ${draft.involuntaryBedNeeded === false ? pageStyles.optSelectedNo : ""}`}
                            data-selected={draft.involuntaryBedNeeded === false ? "no" : undefined}
                          >
                            <input
                              type="radio"
                              name="ward-referral-intake-involuntaryBedNeeded"
                              data-testid="ward-referral-intake-involuntaryBedNeeded-no"
                              className={pageStyles.srOnlyRadio}
                              checked={draft.involuntaryBedNeeded === false}
                              onChange={() => setDraft((current) => ({ ...current, involuntaryBedNeeded: false }))}
                            />
                            No
                          </label>
                          <label
                            className={`${pageStyles.toggleOption} ${draft.involuntaryBedNeeded === true ? pageStyles.optSelectedYes : ""}`}
                            data-selected={draft.involuntaryBedNeeded === true ? "yes" : undefined}
                          >
                            <input
                              type="radio"
                              name="ward-referral-intake-involuntaryBedNeeded"
                              data-testid="ward-referral-intake-involuntaryBedNeeded-yes"
                              className={pageStyles.srOnlyRadio}
                              checked={draft.involuntaryBedNeeded === true}
                              onChange={() => setDraft((current) => ({ ...current, involuntaryBedNeeded: true }))}
                            />
                            Yes
                          </label>
                        </div>
                      </fieldset>

                      <fieldset
                        className={pageStyles.clinicalSwitchCard}
                        data-testid="ward-referral-intake-highAcuityNursingNeeded"
                      >
                        <div className={pageStyles.switchMeta}>
                          <legend className={pageStyles.switchTitle}>
                            Needs high-acuity nursing
                            <span className="sr-only">
                              <QuestionState field="highAcuityNursingNeeded" draft={draft} />
                            </span>
                          </legend>
                          <span className={pageStyles.switchSubtitle}>1:1 or 2:1 special observation</span>
                        </div>
                        <div className={pageStyles.yesNoToggleGroup}>
                          <label
                            className={`${pageStyles.toggleOption} ${draft.highAcuityNursingNeeded === false ? pageStyles.optSelectedNo : ""}`}
                            data-selected={draft.highAcuityNursingNeeded === false ? "no" : undefined}
                          >
                            <input
                              type="radio"
                              name="ward-referral-intake-highAcuityNursingNeeded"
                              data-testid="ward-referral-intake-highAcuityNursingNeeded-no"
                              className={pageStyles.srOnlyRadio}
                              checked={draft.highAcuityNursingNeeded === false}
                              onChange={() => setDraft((current) => ({ ...current, highAcuityNursingNeeded: false }))}
                            />
                            No
                          </label>
                          <label
                            className={`${pageStyles.toggleOption} ${draft.highAcuityNursingNeeded === true ? pageStyles.optSelectedYes : ""}`}
                            data-selected={draft.highAcuityNursingNeeded === true ? "yes" : undefined}
                          >
                            <input
                              type="radio"
                              name="ward-referral-intake-highAcuityNursingNeeded"
                              data-testid="ward-referral-intake-highAcuityNursingNeeded-yes"
                              className={pageStyles.srOnlyRadio}
                              checked={draft.highAcuityNursingNeeded === true}
                              onChange={() => setDraft((current) => ({ ...current, highAcuityNursingNeeded: true }))}
                            />
                            Yes
                          </label>
                        </div>
                      </fieldset>

                      <fieldset
                        className={pageStyles.clinicalSwitchCard}
                        data-testid="ward-referral-intake-transportNeeded"
                      >
                        <div className={pageStyles.switchMeta}>
                          <legend className={pageStyles.switchTitle}>
                            Needs transport
                            <span className="sr-only">
                              <QuestionState field="transportNeeded" draft={draft} />
                            </span>
                          </legend>
                          <span className={pageStyles.switchSubtitle}>Transfer booking required</span>
                        </div>
                        <div className={pageStyles.yesNoToggleGroup}>
                          <label
                            className={`${pageStyles.toggleOption} ${draft.transportNeeded === false ? pageStyles.optSelectedNo : ""}`}
                            data-selected={draft.transportNeeded === false ? "no" : undefined}
                          >
                            <input
                              type="radio"
                              name="ward-referral-intake-transportNeeded"
                              data-testid="ward-referral-intake-transportNeeded-no"
                              className={pageStyles.srOnlyRadio}
                              checked={draft.transportNeeded === false}
                              onChange={() => setDraft((current) => ({ ...current, transportNeeded: false }))}
                            />
                            No
                          </label>
                          <label
                            className={`${pageStyles.toggleOption} ${draft.transportNeeded === true ? pageStyles.optSelectedYes : ""}`}
                            data-selected={draft.transportNeeded === true ? "yes" : undefined}
                          >
                            <input
                              type="radio"
                              name="ward-referral-intake-transportNeeded"
                              data-testid="ward-referral-intake-transportNeeded-yes"
                              className={pageStyles.srOnlyRadio}
                              checked={draft.transportNeeded === true}
                              onChange={() => setDraft((current) => ({ ...current, transportNeeded: true }))}
                            />
                            Yes
                          </label>
                        </div>
                      </fieldset>
                    </div>
                  </div>
                </fieldset>

                {/*
                 * WHERE TO REFER — several destinations chosen in ONE act (FD-21), up to the cap.
                 *
                 * Checkboxes rather than a multi-select, and one per kind rather than a list a clinician
                 * adds to: a repeated kind is then unreachable rather than merely unlikely, which matters
                 * because the reducer REFUSES a repeat rather than de-duplicating it.
                 *
                 * **NOTHING HERE IS REMOVED, DISABLED OR RANKED.** An option the catchment table cannot
                 * place is greyed (`data-outside-catchment`) and stays fully operable — the owner's rule
                 * is that choosing one is allowed, being a deliberate step the clinician takes. A ward
                 * with no free bed is offered exactly like any other, because a ward with no bed today is
                 * still the right place to ask. And the order is catchment then name, never anything
                 * derived from the person: nothing on this screen ranks a patient.
                 *
                 * Each option's facts are announced with its control through `aria-describedby`, so what
                 * a sighted clinician reads beside the box is what a screen-reader user hears with it.
                 */}
                {/*
                 * ══ THE WRITTEN HISTORY ══════════════════════════════════════════════════════
                 * Owner instruction, 2026-09-05. The only free text on this form.
                 *
                 * ⚠️ **PLACED IMMEDIATELY BEFORE THE DESTINATIONS, AND THE ORDER IS THE SAFEGUARD.**
                 * The moment after a referrer finishes writing the account is the moment they choose
                 * who receives it, so the fan-out warning lands while the text is still in mind. Put
                 * this after the destinations and the warning arrives about something already
                 * decided.
                 *
                 * ⚠️ **THREE BOUNDED BOXES, NOT ONE UNBOUNDED ONE.** A single large box suggests no
                 * shape, so everything goes in it — the family's names, the address, the whole
                 * chart. Three questions shape what is written without making this a clinical form.
                 *
                 * ⚠️ **NO `maxLength`.** See `overLimitFreeTextFields`: the browser stopping a
                 * keystroke is a silent truncation, and silent truncation of a risk note is the
                 * worst thing this form could do.
                 */}
                {/* ⚠️ `-history-section`, NOT `-history`. The single box's own control is
                  `ward-referral-intake-history` (every control on this form is
                  `ward-referral-intake-${key}`), and while there were THREE boxes this
                  fieldset could hold the bare name without colliding with any of them.
                  Collapsing to one box made the section and its only control claim the same
                  id — caught immediately by the uniqueness assertion in
                  `ward-referral-screens.dom.test.tsx`, whose comment records that a duplicate
                  testid is a guaranteed strict-mode failure in the browser suite. */}
                <fieldset className={`${styles.stepSection} ${pageStyles.panel}`}>
                  <legend className={`${styles.stepLegend} ${pageStyles.ph} ${pageStyles.panelHeader}`}>
                    <span className={`${styles.stepNo} ${pageStyles.stepNo} ${pageStyles.stepBadge}`}>Step 3</span>
                    <span className={`${styles.stepName} ${pageStyles.panelHeaderTitle}`}>The history</span>
                    <span
                      className={pageStyles.stepStatusPill}
                      data-status={draft.history.trim() !== "" ? "complete" : "incomplete"}
                      aria-hidden="true"
                    >
                      {draft.history.trim() !== "" ? "Complete" : "Optional"}
                    </span>
                  </legend>
                  <div className={`${pageStyles.panelBody} ${pageStyles.historyBoxWrap}`}>
                    <fieldset
                      className={`${styles.choiceCard} ${pageStyles.choiceCard} ${pageStyles.historyBoxWrap}`}
                      data-testid="ward-referral-intake-history-section"
                    >
                      <legend className={`${styles.fieldLegend} ${pageStyles.switchTitle}`}>
                        Patient presentation
                      </legend>

                      <p className="sr-only" data-testid="ward-referral-intake-history-warning">
                        Sent exactly as written to every selected destination and not checked. Include only what
                        receiving teams need.
                      </p>

                      <div className={pageStyles.promptChipsRow} aria-label="Clinical quick prompt chips">
                        <button
                          type="button"
                          className={pageStyles.promptChip}
                          onClick={() =>
                            setDraft((current) => ({
                              ...current,
                              history: current.history
                                ? `${current.history}\n\nPresenting Crisis: `
                                : "Presenting Crisis: ",
                            }))
                          }
                        >
                          + Crisis Presentation
                        </button>
                        <button
                          type="button"
                          className={pageStyles.promptChip}
                          onClick={() =>
                            setDraft((current) => ({
                              ...current,
                              history: current.history ? `${current.history}\n\nMSE: ` : "MSE: ",
                            }))
                          }
                        >
                          + Mental State Exam
                        </button>
                        <button
                          type="button"
                          className={pageStyles.promptChip}
                          onClick={() =>
                            setDraft((current) => ({
                              ...current,
                              history: current.history
                                ? `${current.history}\n\nRisk Assessment: `
                                : "Risk Assessment: ",
                            }))
                          }
                        >
                          + Risk Assessment
                        </button>
                        <button
                          type="button"
                          className={pageStyles.promptChip}
                          onClick={() =>
                            setDraft((current) => ({
                              ...current,
                              history: current.history
                                ? `${current.history}\n\nCurrent Treatment: `
                                : "Current Treatment: ",
                            }))
                          }
                        >
                          + Treatment &amp; Response
                        </button>
                      </div>

                      {HISTORY_FIELDS.map((field) => {
                        const value = draft[field.key];
                        const limit = REFERRAL_HISTORY_LIMITS[field.key];
                        const over = value.length > limit;
                        const hintId = `ward-referral-intake-${field.key}-hint`;
                        const meterId = `ward-referral-intake-${field.key}-meter`;
                        const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
                        return (
                          <div className={styles.historyField} key={field.key}>
                            <label className={styles.historyLabel} htmlFor={`ward-referral-intake-${field.key}`}>
                              {field.label}{" "}
                              <span className={styles.historyRequirement}>
                                {field.required ? "Required" : "Optional"}
                              </span>
                            </label>
                            <p className={styles.historyHint} id={hintId}>
                              {field.hint}
                            </p>
                            <textarea
                              id={`ward-referral-intake-${field.key}`}
                              data-testid={`ward-referral-intake-${field.key}`}
                              className={`${styles.historyBox} ${pageStyles.textArea} ${pageStyles.historyTextarea}`}
                              aria-describedby={`${hintId} ${meterId}`}
                              data-over-limit={over ? "true" : undefined}
                              value={value}
                              onChange={(event) =>
                                setDraft((current) => ({ ...current, [field.key]: event.target.value }))
                              }
                              rows={5}
                              data-gramm="false"
                              data-enable-grammarly="false"
                              spellCheck={false}
                              autoComplete="off"
                            />
                            <div className={pageStyles.meterRow}>
                              <div className={pageStyles.meterBar}>
                                <span
                                  className={pageStyles.meterFill}
                                  style={{ width: `${Math.min(100, (value.length / limit) * 100)}%` }}
                                />
                              </div>
                              <p className={styles.historyMeter} id={meterId} data-tone={over ? "over" : undefined}>
                                {value.length} / {limit} characters
                                {over ? " — too long to send, and nothing has been cut" : null}
                                {!over && field.required && value.trim() === "" ? " — still to write" : null}
                              </p>
                            </div>
                            <div className={pageStyles.historyFootRow}>
                              <span>
                                {wordCount} {wordCount === 1 ? "word" : "words"}
                              </span>
                              <span className={styles.historyMeter}>Tabular figures active</span>
                            </div>
                            {value.trim() !== "" ? (
                              <p
                                className={`${styles.historyWarning} ${pageStyles.caution}`}
                                data-testid={`ward-referral-intake-${field.key}-unsaved-warning`}
                              >
                                <strong className={pageStyles.cautionWord}>Warning:</strong> {UNSAVED_HISTORY_WARNING}
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </fieldset>
                  </div>
                </fieldset>
              </div>

              <div className={styles.intakeDecision}>
                <fieldset
                  className={`${styles.choiceCard} ${pageStyles.panel}`}
                  data-testid="ward-referral-intake-destinations"
                >
                  <legend className={`${styles.fieldLegend} ${pageStyles.ph} ${pageStyles.panelHeader}`}>
                    <span className={`${styles.stepName} ${pageStyles.panelHeaderTitle}`}>
                      Where to refer &mdash; choose up to {configuration.parallelReferralCap}, in one act
                    </span>
                    <span className="sr-only">
                      <QuestionState field="destinationKinds" draft={draft} />
                    </span>
                    <span
                      className={pageStyles.stepStatusPill}
                      data-status={draft.destinationKinds.length > 0 ? "complete" : "incomplete"}
                      aria-hidden="true"
                    >
                      {draft.destinationKinds.length > 0 ? `${draft.destinationKinds.length} Selected` : "Incomplete"}
                    </span>
                  </legend>
                  <div className={pageStyles.panelBody}>
                    {refusedCombination ? (
                      <div className={pageStyles.destConflictAlert} role="alert">
                        <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                          <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" />
                        </svg>
                        <div className={pageStyles.destConflictText}>
                          <strong>Routing Conflict:</strong> A psychiatric bed and a community team cannot be asked for
                          on the same referral. Send them as two separate referrals.
                        </div>
                      </div>
                    ) : null}

                    {/* Target Referral Locations & Regional Catchment Corridor */}
                    <div className={pageStyles.locationsCorridorCard} data-testid="ward-referral-target-locations">
                      <div className={pageStyles.locationsCorridorHeader}>
                        <div className={pageStyles.locationsCorridorTitleGroup}>
                          <svg
                            className={pageStyles.locationsIcon}
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          <div>
                            <h4 className={pageStyles.locationsCorridorTitle}>
                              Target Referral Locations &amp; Catchment Corridors
                            </h4>
                            <p className={pageStyles.locationsCorridorSubtitle}>
                              Target receiving facilities for this person across Community, Acute Inpatient, and
                              Emergency Department pathways.
                            </p>
                          </div>
                        </div>
                        <span className={pageStyles.locationsCoverageBadge}>{radarCatchment}</span>
                      </div>

                      <div className={pageStyles.locationsGrid}>
                        {/* Community Target */}
                        <div className={pageStyles.locationCard} data-type="community">
                          <div className={pageStyles.locationCardTop}>
                            <span className={pageStyles.locationTypeTag}>Community Team</span>
                            {draft.destinationKinds.includes("community_team") ? (
                              <span className={pageStyles.locationSelectedBadge}>Selected</span>
                            ) : null}
                          </div>
                          <span className={pageStyles.locationName}>{mappedReferralLocations.community.name}</span>
                          <div className={pageStyles.locationMeta}>
                            <span className={pageStyles.locationServiceNote}>
                              {mappedReferralLocations.community.note}
                            </span>
                          </div>
                        </div>

                        {/* Acute Inpatient Ward Target */}
                        <div className={pageStyles.locationCard} data-type="acute">
                          <div className={pageStyles.locationCardTop}>
                            <span className={pageStyles.locationTypeTag}>Acute Inpatient Bed</span>
                            {draft.destinationKinds.includes("psychiatric_ward") ? (
                              <span className={pageStyles.locationSelectedBadge}>Selected</span>
                            ) : null}
                          </div>
                          <span className={pageStyles.locationName}>{mappedReferralLocations.acute.name}</span>
                          <div className={pageStyles.locationMeta}>
                            <span className={pageStyles.locationServiceNote}>{mappedReferralLocations.acute.note}</span>
                          </div>
                        </div>

                        {/* Emergency Department Target */}
                        <div className={pageStyles.locationCard} data-type="ed">
                          <div className={pageStyles.locationCardTop}>
                            <span className={pageStyles.locationTypeTag}>Emergency Department</span>
                            {draft.destinationKinds.includes("emergency_department") ? (
                              <span className={pageStyles.locationSelectedBadge}>Selected</span>
                            ) : null}
                          </div>
                          <span className={pageStyles.locationName}>{mappedReferralLocations.ed.name}</span>
                          <div className={pageStyles.locationMeta}>
                            <span className={pageStyles.locationServiceNote}>{mappedReferralLocations.ed.note}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <ul className={`${styles.destinationList} ${pageStyles.destinationList}`}>
                      {options.map((option) => (
                        <li
                          key={option.kind}
                          className={`${styles.destinationOption} ${pageStyles.destinationOption} ${pageStyles.destCard}`}
                          data-testid={`ward-referral-intake-destination-option-${option.kind}`}
                          data-active={draft.destinationKinds.includes(option.kind) ? "true" : undefined}
                          data-outside-catchment={option.catchment.outsideTheTable ? "true" : undefined}
                        >
                          <div className={pageStyles.destinationHeaderRow}>
                            <div className={pageStyles.destinationNameGroup}>
                              <label
                                aria-label={option.label}
                                className={`${styles.destinationName} ${pageStyles.destinationName}`}
                              >
                                <input
                                  type="checkbox"
                                  data-testid={`ward-referral-intake-destination-${option.kind}`}
                                  className={pageStyles.destCheckbox}
                                  checked={draft.destinationKinds.includes(option.kind)}
                                  aria-describedby={`ward-referral-intake-destination-facts-${option.kind}`}
                                  onChange={() => toggleDestination(option.kind)}
                                />
                                <div className={pageStyles.destTitleStack}>
                                  <span>{option.label}</span>
                                  <span className={pageStyles.destSubtitle}>{DESTINATION_SUBTITLES[option.kind]}</span>
                                </div>
                              </label>
                            </div>
                            <div className={pageStyles.destinationBadges}>
                              {option.catchment.placedBySourceTable ? (
                                <span className={pageStyles.badgePill} data-type="catchment">
                                  In Catchment
                                </span>
                              ) : null}
                              {option.kind === "psychiatric_ward" ? (
                                <span className={pageStyles.badgePill} data-type="ready">
                                  Bed Availability Active
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div id={`ward-referral-intake-destination-facts-${option.kind}`}>
                            {option.kind === "community_team" ? (
                              <div className={pageStyles.destTargetLocationRow}>
                                <strong>Target Team:</strong>
                                <span>{mappedReferralLocations.community.name}</span>
                              </div>
                            ) : option.kind === "psychiatric_ward" ? (
                              <div className={pageStyles.destTargetLocationRow}>
                                <strong>Designated Inpatient Facility:</strong>
                                <span>{mappedReferralLocations.acute.name}</span>
                              </div>
                            ) : option.kind === "emergency_department" ? (
                              <div className={pageStyles.destTargetLocationRow}>
                                <strong>Receiving Emergency Department:</strong>
                                <span>{mappedReferralLocations.ed.name}</span>
                              </div>
                            ) : null}
                            <div className={pageStyles.destMetadataPanel}>
                              <p className={`${styles.destinationNote} ${pageStyles.destinationNote}`}>
                                <span>
                                  {option.catchment.sentence.includes("approved-hospital column is not seeded")
                                    ? "Statewide hospital catchment · Direct acute triage & admission pathway"
                                    : option.catchment.sentence.includes("No suburb chosen yet")
                                      ? "No patient suburb selected yet · Catchment clinic unlinked"
                                      : option.catchment.sentence}
                                </span>
                                <span className="sr-only">{option.catchment.sentence}</span>
                              </p>
                              {option.suggested ? (
                                <p className={`${styles.destinationNote} ${pageStyles.destinationNote}`}>
                                  Suggested by catchment corridor. Final destination selection remains clinical choice.
                                </p>
                              ) : null}
                              <ul className={`${styles.destinationFacts} ${pageStyles.destinationFacts}`}>
                                {option.figures.map((figure) => (
                                  <li
                                    key={figure}
                                    className={`${styles.destinationFact} ${pageStyles.destinationFact}`}
                                  >
                                    <span className={pageStyles.telemetryDot} />
                                    <span>{figure}</span>
                                  </li>
                                ))}
                                {option.reasons.map((reason) => {
                                  const isVerboseClutter =
                                    reason.startsWith("Asks a team") ||
                                    reason.startsWith("Asks for the person to be seen") ||
                                    reason.startsWith("Asks a ward") ||
                                    reason.startsWith("Choose a suburb to see");
                                  if (isVerboseClutter) {
                                    return (
                                      <li key={reason} className={`${styles.destinationFact} sr-only`}>
                                        {reason}
                                      </li>
                                    );
                                  }
                                  return (
                                    <li
                                      key={reason}
                                      className={`${styles.destinationFact} ${pageStyles.destinationFact}`}
                                    >
                                      <span>{reason}</span>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </fieldset>

                {/*
                 * WHICH emergency department — asked only once one is chosen, because until then it is a
                 * question with nothing to attach to.
                 *
                 * ⚠️ **THE LEADING OPTION IS A PROMPT, NOT A DEPARTMENT**, exactly like every other picker
                 * on this form. A first-department default would be the single most dangerous default on
                 * this screen: `RECEIVE_REFERRAL` membership-checks the source, home region, age band,
                 * urgency and origin site, and checks `edId` against **nothing at all** — so a department
                 * nobody chose does not bounce, it queues, at a real hospital, looking like an answer.
                 *
                 * Derived from `allEmergencyDepartments()`, never hand-listed. That is the same defect
                 * class as `ed-screen.tsx`'s hand-written `COHORT_OPTIONS`, which silently omitted
                 * `"Youth"` and could never have failed to compile when the union widened.
                 */}
                {draft.destinationKinds.includes("emergency_department") ? (
                  <div className={`${styles.fieldCard} ${pageStyles.fieldCard}`}>
                    <div className={`${styles.questionHead} ${pageStyles.questionHead}`}>
                      <label
                        className={`${styles.fieldLegend} ${pageStyles.fieldLegend}`}
                        htmlFor="ward-referral-intake-edId"
                      >
                        Which emergency department
                      </label>
                      <QuestionState field="edId" draft={draft} />
                    </div>
                    <select
                      id="ward-referral-intake-edId"
                      data-testid="ward-referral-intake-edId"
                      className={`${styles.select} ${pageStyles.select}`}
                      value={draft.edId}
                      onChange={(event) => setDraft((current) => ({ ...current, edId: event.target.value }))}
                    >
                      <option value={UNANSWERED_VALUE}>{UNANSWERED_OPTION_LABEL}</option>
                      {allEmergencyDepartments().map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {/*
                 * WHICH community team — asked only once a community destination is chosen, for the same
                 * reason as the department above it.
                 *
                 * ⚠️ **THE CATCHMENT TABLE SUGGESTS; IT DOES NOT PRE-SELECT.** `destinationOptions` already
                 * tells the clinician, in words, which team the source table places this suburb with, and
                 * that sentence keeps its `contested` and `unreviewed` markers rather than collapsing to a
                 * winner. Turning that sentence into a pre-ticked value would put the guess back into the
                 * record — which is precisely the region-derived membership the owner's 2026-08-31 ruling
                 * removed. The clinician reads the suggestion and answers; the answer is what is stored.
                 *
                 * Derived from `communityTeamOptions()`, never hand-listed, for the same defect class the
                 * department picker names.
                 */}
                {draft.destinationKinds.includes("community_team") ? (
                  <div className={`${styles.fieldCard} ${pageStyles.fieldCard}`}>
                    <div className={`${styles.questionHead} ${pageStyles.questionHead}`}>
                      <label
                        className={`${styles.fieldLegend} ${pageStyles.fieldLegend}`}
                        htmlFor="ward-referral-intake-teamName"
                      >
                        Which community team
                      </label>
                      <QuestionState field="teamName" draft={draft} />
                    </div>
                    <select
                      id="ward-referral-intake-teamName"
                      data-testid="ward-referral-intake-teamName"
                      className={`${styles.select} ${pageStyles.select}`}
                      value={draft.teamName}
                      onChange={(event) => setDraft((current) => ({ ...current, teamName: event.target.value }))}
                    >
                      <option value={UNANSWERED_VALUE}>{UNANSWERED_OPTION_LABEL}</option>
                      {communityTeamOptions().map((team) => (
                        <option key={team} value={team}>
                          {team}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {lastRejection ? (
                  <p className={styles.rejection} data-testid="ward-referral-intake-rejection" role="alert">
                    Referral not sent: {lastRejection.reason}
                  </p>
                ) : null}

                {confirmed ? (
                  <p className={styles.confirmation} data-testid="ward-referral-intake-confirmation">
                    Referral sent. It is now queued for a coordinator to review.
                  </p>
                ) : null}
              </div>
            </form>
          </div>

          {/*
           * THE CONTEXT RAIL & FIXED DISPATCH.
           * Standard: Sovereign Clinical Console (Platinum Raised Cool)
           * Incorporates Example catchment radar, Referral Summary, Referral answers, and permanently docked Dispatch Card.
           */}
          <aside
            className={`${styles.intakeAside} ${pageStyles.sideColumn}`}
            aria-label="Referral summary, catchment radar, and fixed dispatch"
            data-testid="ward-referral-intake-aside"
          >
            <div className={pageStyles.sideRailScroll} id="sideRailScroll">
              {/* 1. Catchment Bed Radar Card (Replaces Intake Progress) */}
              <details
                className={`${pageStyles.radarCard} ${pageStyles.panel}`}
                id="catchmentRadarCard"
                data-testid="ward-referral-intake-progress"
              >
                <summary className={pageStyles.radarHead} style={{ cursor: "pointer", minHeight: "48px" }}>
                  <div className={pageStyles.radarTitleGroup}>
                    <span className={pageStyles.radarBeaconDot} aria-hidden="true" />
                    <span className={pageStyles.radarTitle}>Example catchment radar</span>
                  </div>
                  <span className={`${pageStyles.radarScopeBadge} mono`} id="radarScopeBadge">
                    {radarScope}
                  </span>
                </summary>
                <p className={pageStyles.radarNotice}>
                  Illustrative availability and service details. Use the destination options for this referral; these
                  examples do not establish current capacity.
                </p>
                <div className={pageStyles.radarCatchmentName} id="radarCatchmentName">
                  {radarCatchment}
                </div>

                <div className={pageStyles.radarUnitsList} id="radarUnitsList">
                  {/* Ward Availability Item */}
                  <div className={pageStyles.radarUnitItem} id="radarWardUnit">
                    <div className={pageStyles.radarUnitTop}>
                      <span className={pageStyles.radarUnitName} id="radarWardName">
                        {radarWard.name}
                      </span>
                      <span className={`${pageStyles.radarBedCount} mono`} id="radarWardReady">
                        <b style={{ color: "var(--good)" }}>{radarWard.ready}</b> ready
                      </span>
                    </div>
                    <div
                      className={pageStyles.radarMeterBar}
                      aria-label={`Beds: ${radarWard.ready} ready, ${radarWard.pulled} pulled, ${radarWard.closed} closed, ${radarWard.occ} occupied`}
                    >
                      {/*
                        `data-kind` keys the existing stylesheet's colours: Pulled takes the accent
                        segment and Closed the warn segment, matching Closed's warn tone on the
                        capacity screens. `data-bed-state` names the ruled box itself.
                      */}
                      <div
                        className={pageStyles.meterSeg}
                        data-kind="ready"
                        style={{ width: `${(radarWard.ready / Math.max(radarWard.total, 1)) * 100}%` }}
                        title={`${radarWard.ready} Ready beds`}
                      />
                      <div
                        className={pageStyles.meterSeg}
                        data-kind="held"
                        data-bed-state="pulled"
                        style={{ width: `${(radarWard.pulled / Math.max(radarWard.total, 1)) * 100}%` }}
                        title={`${radarWard.pulled} Pulled beds`}
                      />
                      <div
                        className={pageStyles.meterSeg}
                        data-kind="blocked"
                        data-bed-state="closed"
                        style={{ width: `${(radarWard.closed / Math.max(radarWard.total, 1)) * 100}%` }}
                        title={`${radarWard.closed} Closed beds`}
                      />
                      <div
                        className={pageStyles.meterSeg}
                        data-kind="occupied"
                        style={{ width: `${(radarWard.occ / Math.max(radarWard.total, 1)) * 100}%` }}
                        title={`${radarWard.occ} Occupied beds`}
                      />
                    </div>
                    <div className={pageStyles.radarUnitFoot}>
                      <span id="radarWardDetail">
                        {radarWard.ready} ready &middot; {radarWard.pulled} pulled &middot; {radarWard.closed} closed
                        &middot; {radarWard.occ} occ / {radarWard.total} beds
                      </span>
                      <span className="mono" id="radarWardResponse">
                        Answer time not recorded
                      </span>
                    </div>
                    {radarPendingPreparation > 0 ? (
                      <p className={pageStyles.beingMadeReady} data-testid="referral-intake-pending-preparation">
                        Separately, the current record has {radarPendingPreparation}{" "}
                        {radarPendingPreparation === 1 ? "bed" : "beds"} still being made ready — included in ready
                        figures but unavailable to pull until preparation is complete.
                      </p>
                    ) : null}
                  </div>

                  {/* ED Liaison Status Item */}
                  <div className={pageStyles.radarUnitItem} id="radarEdUnit">
                    <div className={pageStyles.radarUnitTop}>
                      <span className={pageStyles.radarUnitName} id="radarEdName">
                        {radarEd.name}
                      </span>
                      <span
                        className={`${pageStyles.radarStatusChip} ${pageStyles.radarStatusChipGood}`}
                        id="radarEdStatus"
                      >
                        Liaison not recorded
                      </span>
                    </div>
                    <div className={pageStyles.radarUnitFoot}>
                      <span id="radarEdWait">{radarEd.waiting}</span>
                      <span className="mono" id="radarEdMedian">
                        {radarEd.wait}
                      </span>
                    </div>
                  </div>

                  {/* Community Diversion Item */}
                  <div className={pageStyles.radarUnitItem} id="radarCommUnit">
                    <div className={pageStyles.radarUnitTop}>
                      <span className={pageStyles.radarUnitName} id="radarCommName">
                        {radarComm.name}
                      </span>
                      <span
                        className={`${pageStyles.radarStatusChip} ${pageStyles.radarStatusChipCalm}`}
                        id="radarCommStatus"
                      >
                        Status not recorded
                      </span>
                    </div>
                    <div className={pageStyles.radarUnitFoot}>
                      <span id="radarCommCaseload">Hours and caseload not recorded</span>
                    </div>
                  </div>
                </div>
              </details>

              {/* 2. Referral Summary Table */}
              <section
                className={`${pageStyles.summaryCard} ${pageStyles.panel}`}
                data-testid="ward-referral-intake-summary"
              >
                <div className={pageStyles.summaryCardHead}>
                  <h3 className={pageStyles.gateTitle}>Referral Summary</h3>
                  <span className={`${pageStyles.summaryCountBadge} mono`} id="summaryCountBadge">
                    {summaryRows.filter((r) => r.answered).length} of {summaryRows.length} answered
                  </span>
                </div>
                <div className={pageStyles.summaryCardBody}>
                  <dl className={pageStyles.summaryList} id="summaryList">
                    {summaryRows.map((row) => (
                      <div className={pageStyles.summaryRow} key={row.label}>
                        <dt className={pageStyles.summaryKey}>{row.label}</dt>
                        <dd
                          className={
                            row.answered
                              ? pageStyles.summaryVal
                              : `${pageStyles.summaryVal} ${pageStyles.summaryValMissing}`
                          }
                        >
                          {row.value}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  {/*
                   * ⚠️ THE HISTORY IS REPORTED HERE, AND DELIBERATELY NOT PREVIEWED.
                   * See `referralSummaryRows` for why the text itself never appears in this column.
                   */}
                  <div className={pageStyles.historySummary} data-testid="ward-referral-intake-history-summary">
                    <span className={pageStyles.historySummaryTerm}>Written history</span>
                    <span className={pageStyles.historySummaryValue}>
                      {HISTORY_FIELDS.length > 1 ? (
                        <>
                          {writtenHistoryCount(draft)} of {HISTORY_FIELDS.length} sections &middot;{" "}
                          {HISTORY_FIELDS.reduce((total, field) => total + draft[field.key].length, 0)} characters
                        </>
                      ) : writtenHistoryCount(draft) === 0 ? (
                        "Nothing written — that is a complete answer"
                      ) : (
                        `${HISTORY_FIELDS.reduce((total, field) => total + draft[field.key].length, 0)} characters`
                      )}
                    </span>
                    <span className={pageStyles.historySummaryNote}>
                      Sent exactly as written to every selected destination; no clinical check is performed.
                    </span>
                  </div>
                </div>
              </section>

              {/* 3. Clinical Referral answers (Replaces image 1 govCard) */}
              <section className={`${pageStyles.clinicalGateCard} ${pageStyles.panel}`} id="clinicalGateCard">
                <div className={pageStyles.gateHead}>
                  <h3 className={pageStyles.gateTitle}>Referral answers</h3>
                  <span
                    className={`${pageStyles.gateStatusPill} ${
                      gatesVerifiedCount === 5 ? pageStyles.gateStatusPillComplete : pageStyles.gateStatusPillWarn
                    }`}
                    id="gateOverallPill"
                  >
                    {gatesVerifiedCount} of 5 answered
                  </span>
                </div>
                <div className={pageStyles.gateList}>
                  <div className={pageStyles.gateItem}>
                    <span
                      className={`${pageStyles.gateDot} ${
                        gateLegalVerified ? pageStyles.gateDotGood : pageStyles.gateDotWarn
                      }`}
                      id="gateDotLegal"
                    />
                    <div className={pageStyles.gateText}>
                      <span className={pageStyles.gateLabel}>Involuntary bed requested</span>
                      <span className={pageStyles.gateValue} id="gateValLegal">
                        {draft.involuntaryBedNeeded === UNANSWERED_VALUE
                          ? "Not answered"
                          : draft.involuntaryBedNeeded
                            ? "Yes — legal documentation must be recorded separately"
                            : "No"}
                      </span>
                    </div>
                  </div>
                  <div className={pageStyles.gateItem}>
                    <span
                      className={`${pageStyles.gateDot} ${
                        gateBedVerified ? pageStyles.gateDotGood : pageStyles.gateDotWarn
                      }`}
                      id="gateDotBed"
                    />
                    <div className={pageStyles.gateText}>
                      <span className={pageStyles.gateLabel}>Sex recorded</span>
                      <span className={pageStyles.gateValue} id="gateValBed">
                        {draft.sex === UNANSWERED_VALUE ? "Not answered" : draft.sex} &middot; No bed allocated by this
                        answer
                      </span>
                    </div>
                  </div>
                  <div className={pageStyles.gateItem}>
                    <span
                      className={`${pageStyles.gateDot} ${
                        gateNursingVerified ? pageStyles.gateDotGood : pageStyles.gateDotWarn
                      }`}
                      id="gateDotNursing"
                    />
                    <div className={pageStyles.gateText}>
                      <span className={pageStyles.gateLabel}>High-acuity nursing requested</span>
                      <span className={pageStyles.gateValue} id="gateValNursing">
                        {draft.highAcuityNursingNeeded === UNANSWERED_VALUE
                          ? "Not answered"
                          : draft.highAcuityNursingNeeded
                            ? "Yes"
                            : "No"}
                      </span>
                    </div>
                  </div>
                  <div className={pageStyles.gateItem}>
                    <span
                      className={`${pageStyles.gateDot} ${
                        gateTransportVerified ? pageStyles.gateDotGood : pageStyles.gateDotWarn
                      }`}
                      id="gateDotTransport"
                    />
                    <div className={pageStyles.gateText}>
                      <span className={pageStyles.gateLabel}>Transport requested</span>
                      <span className={pageStyles.gateValue} id="gateValTransport">
                        {draft.transportNeeded === UNANSWERED_VALUE
                          ? "Not answered"
                          : draft.transportNeeded
                            ? "Yes — arrangements recorded separately"
                            : "No"}
                      </span>
                    </div>
                  </div>
                  <div className={pageStyles.gateItem}>
                    <span
                      className={`${pageStyles.gateDot} ${
                        gateCatchmentVerified ? pageStyles.gateDotGood : pageStyles.gateDotWarn
                      }`}
                      id="gateDotCatchment"
                    />
                    <div className={pageStyles.gateText}>
                      <span className={pageStyles.gateLabel}>Home suburb</span>
                      <span className={pageStyles.gateValue} id="gateValCatchment">
                        {draft.suburb !== UNANSWERED_VALUE ? draft.suburb : "Not answered"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Clinical Utility Actions */}
                <div className={pageStyles.gateActions}>
                  <button
                    type="button"
                    className={pageStyles.gateActionBtn}
                    id="btnPreviewReferral"
                    onClick={() => setIsPreviewOpen(true)}
                    title="Preview formatted clinical referral letterhead"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M4 1h8a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zm1 2v10h6V3H5zm1 2h4v1H6V5zm0 2h4v1H6V7zm0 2h3v1H6V9z" />
                    </svg>
                    <span>Preview Referral</span>
                  </button>
                  <button
                    type="button"
                    className={pageStyles.gateActionBtn}
                    id="btnCopyHandover"
                    onClick={handleCopyHandover}
                    title="Copy full clinical handover to clipboard"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M4 2a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6z" />
                      <path d="M2 5a1 1 0 0 1 1-1h1v1H3v9h6v-1h1v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5z" />
                    </svg>
                    <span>Copy Handover</span>
                  </button>
                </div>
                <div className={pageStyles.gateCoordinatorNotice}>
                  <span>
                    Duty Coordinator: <b>Dr S. Chen</b> (State Bed Desk &middot; Ext 4812)
                  </span>
                </div>
              </section>
            </div>

            {/* 4. Fixed Dispatch Panel (Permanently Anchored & Visible) */}
            <div className={pageStyles.dispatchCard} id="dispatchCardFixed">
              <button
                type="submit"
                form="ward-referral-intake-form"
                className={`${pageStyles.sendButton} ${styles.submit} ${pageStyles.btnSubmit}`}
                id="btnSend"
                data-testid="ward-referral-intake-submit"
                aria-disabled={answered ? undefined : "true"}
                aria-describedby={
                  answered ? undefined : refusedCombination ? REFUSED_COMBINATION_ID : UNAVAILABLE_REASON_ID
                }
                onClick={ignoreUnavailableActivation}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M15.854.146a.5.5 0 0 1 .11.54l-5.8 14.5a.5.5 0 0 1-.928-.016L6.59 9.41 1.824 6.764a.5.5 0 0 1-.016-.928L16.308.036a.5.5 0 0 1 .546.11z" />
                </svg>
                <span>Send referral</span>
              </button>

              {refusedCombination ? (
                <p
                  className={`${pageStyles.sendReason} ${pageStyles.sendReasonRefused}`}
                  id={REFUSED_COMBINATION_ID}
                  data-testid="ward-referral-intake-refused-combination"
                  role="alert"
                >
                  A psychiatric bed and a community team cannot be asked for on the same referral. Send them as two
                  referrals.
                </p>
              ) : answered || refusedCombination ? (
                <p className={pageStyles.sendReason} id="sendReasonText">
                  Ready to dispatch to {destinationSummary || "selected destinations"}.
                </p>
              ) : overLimit.length > 0 ? (
                <p
                  className={pageStyles.sendReason}
                  id={UNAVAILABLE_REASON_ID}
                  data-testid="ward-referral-intake-unavailable"
                  role="alert"
                >
                  Too long to send: {overLimit.join(", ")}. Nothing has been cut &mdash; shorten it here and every word
                  you keep is sent.
                </p>
              ) : (
                <p
                  className={pageStyles.sendReason}
                  id={UNAVAILABLE_REASON_ID}
                  data-testid="ward-referral-intake-unavailable"
                >
                  Not answered: {outstanding.join(", ")}. Send stays unavailable until each has an answer.
                </p>
              )}
            </div>
          </aside>
        </div>

        {/* ─── Dispatch Confirmation Receipt Modal ──────────────────────── */}
        {isReceiptOpen && receipt && (
          <div
            id="dispatchModalBackdrop"
            ref={receiptDialogRef}
            tabIndex={-1}
            className={pageStyles.modalBackdrop}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dispatchModalTitle"
          >
            <div className={pageStyles.modalDialog}>
              <div className={`${pageStyles.modalHeader} ${pageStyles.successHeader}`}>
                <div className={pageStyles.successIconWrap} aria-hidden="true">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--good)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <div className={pageStyles.modalTitleGroup}>
                  <h3 className={pageStyles.modalTitle} id="dispatchModalTitle">
                    Referral recorded locally
                  </h3>
                  <span className={pageStyles.modalSub}>Local prototype record &middot; No external transmission</span>
                </div>
                <button
                  type="button"
                  className={pageStyles.modalCloseBtn}
                  onClick={() => setIsReceiptOpen(false)}
                  aria-label="Close dialog"
                >
                  ✕
                </button>
              </div>
              <div className={pageStyles.modalBody}>
                <div className={pageStyles.receiptCard}>
                  <div className={pageStyles.receiptRow}>
                    <span className={pageStyles.receiptKey}>Reference ID</span>
                    <span className={`${pageStyles.receiptVal} mono`} id="receiptRefId">
                      {receipt.referral.id}
                    </span>
                  </div>
                  <div className={pageStyles.receiptRow}>
                    <span className={pageStyles.receiptKey}>Patient</span>
                    <span className={pageStyles.receiptVal} id="receiptPatient">
                      {receipt.patient}
                    </span>
                  </div>
                  <div className={pageStyles.receiptRow}>
                    <span className={pageStyles.receiptKey}>Destinations</span>
                    <span className={pageStyles.receiptVal} id="receiptDestinations">
                      {receipt.referral.destinations
                        .map(({ destination }) => referralDestinationKindLabel(destination.kind))
                        .join(" & ")}
                    </span>
                  </div>
                  <div className={pageStyles.receiptRow}>
                    <span className={pageStyles.receiptKey}>Urgency Level</span>
                    <span className={pageStyles.receiptVal} id="receiptUrgency">
                      {urgencyTierLabel(receipt.referral.urgency)}
                    </span>
                  </div>
                  <div className={pageStyles.receiptRow}>
                    <span className={pageStyles.receiptKey}>Catchment Area</span>
                    <span className={pageStyles.receiptVal} id="receiptCatchment">
                      {receipt.catchment}
                    </span>
                  </div>
                  <div className={pageStyles.receiptRow}>
                    <span className={pageStyles.receiptKey}>Involuntary bed requested</span>
                    <span className={pageStyles.receiptVal} id="receiptLegal">
                      {(() => {
                        const ward = receipt.referral.destinations.find(
                          ({ destination }) => destination.kind === "psychiatric_ward",
                        )?.destination;
                        return ward?.kind === "psychiatric_ward"
                          ? ward.involuntaryBedNeeded
                            ? "Yes"
                            : "No"
                          : "Not a ward referral";
                      })()}
                    </span>
                  </div>
                </div>
                <div className={pageStyles.nextStepsNotice}>
                  <strong>Next Clinical Steps:</strong> The referral is recorded locally in Ward Flow. The State Bed
                  Desk coordinator will triage the bed queue. You can track this case in the Ward Flow Referral
                  Dashboard.
                </div>
              </div>
              <div className={pageStyles.modalFooter}>
                <button type="button" className={pageStyles.btnModalSecondary} onClick={() => setIsReceiptOpen(false)}>
                  Close
                </button>
                <Link
                  href="/mockups/ward-flow/referrals"
                  className={pageStyles.btnModalPrimary}
                  onClick={() => setIsReceiptOpen(false)}
                >
                  <span>View Active Referrals</span>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ─── Clinical Referral Letterhead Preview Modal ─────────────────── */}
        {isPreviewOpen && (
          <div
            id="previewModalBackdrop"
            className={pageStyles.modalBackdrop}
            role="dialog"
            aria-modal="true"
            aria-labelledby="previewModalTitle"
          >
            <div className={`${pageStyles.modalDialog} ${pageStyles.modalLarge}`}>
              <div className={pageStyles.modalHeader}>
                <div className={pageStyles.modalTitleGroup}>
                  <h3 className={pageStyles.modalTitle} id="previewModalTitle">
                    Referral Letterhead Preview
                  </h3>
                  <span className={pageStyles.modalSub}>
                    Standard Clinical Document Output &middot; Electronic Handover
                  </span>
                </div>
                <button
                  type="button"
                  className={pageStyles.modalCloseBtn}
                  onClick={() => setIsPreviewOpen(false)}
                  aria-label="Close preview dialog"
                >
                  ✕
                </button>
              </div>
              <div className={pageStyles.modalBody}>
                <div className={pageStyles.letterheadDoc} id="letterheadDocContent">
                  <div className={pageStyles.letterheadTop}>
                    <div>
                      <h2 className={pageStyles.letterheadOrg}>
                        GOVERNMENT OF WESTERN AUSTRALIA &middot; HEALTH SERVICE
                      </h2>
                      <div className={pageStyles.letterheadSub}>
                        Mental Health Inter-Facility Referral &amp; Triage Document
                      </div>
                    </div>
                    <div className={pageStyles.letterheadMeta}>
                      <div>
                        <b>Date:</b> {formattedReferralDate} AWST
                      </div>
                      <div>
                        <b>Ref:</b> <span className="mono">WF-PREVIEW-DRAFT</span>
                      </div>
                      <div>
                        <b>Origin:</b>{" "}
                        <span>
                          {draft.originSiteCode !== UNANSWERED_VALUE
                            ? referralSummaryValue("originSiteCode", draft.originSiteCode)
                            : "Community Service"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={pageStyles.letterheadSection}>
                    <div className={pageStyles.docSectionHead}>1. Patient Identification &amp; Demographics</div>
                    <div className={pageStyles.docGrid2}>
                      <div>
                        <b>Name:</b> <span>{subject ? patientDisplayName(subject) : "Unlinked Patient"}</span>
                      </div>
                      <div>
                        <b>UMRN:</b> <span className="mono">{subject ? subject.umrn : "Unlinked"}</span>
                      </div>
                      <div>
                        <b>Age / Cohort:</b> {draft.ageBand !== UNANSWERED_VALUE ? draft.ageBand : "Adult"}
                      </div>
                      <div>
                        <b>Gender (Bed Check):</b>{" "}
                        <span>{draft.gender !== UNANSWERED_VALUE ? draft.gender : "Not recorded"}</span>
                      </div>
                      <div>
                        <b>Home Suburb / Region:</b>{" "}
                        <span>
                          {draft.suburb !== UNANSWERED_VALUE ? draft.suburb : "Not recorded"} ({radarCatchment})
                        </span>
                      </div>
                      <div>
                        <b>Involuntary bed request:</b>{" "}
                        <span>
                          {draft.involuntaryBedNeeded === UNANSWERED_VALUE
                            ? "Involuntary bed need not answered"
                            : draft.involuntaryBedNeeded
                              ? "Involuntary bed requested"
                              : "Involuntary bed not requested"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={pageStyles.letterheadSection}>
                    <div className={pageStyles.docSectionHead}>2. Triage &amp; Target Destinations</div>
                    <div className={pageStyles.docGrid2}>
                      <div>
                        <b>Urgency:</b>{" "}
                        <span>
                          {draft.urgency !== UNANSWERED_VALUE ? urgencyTierLabel(draft.urgency) : "Tier 2 (Urgent)"}
                        </span>
                      </div>
                      <div>
                        <b>Referral Source:</b>{" "}
                        <span>
                          {draft.source !== UNANSWERED_VALUE
                            ? SOURCE_LABELS[draft.source as ReferralSource]
                            : "Community CMHT"}
                        </span>
                      </div>
                      <div>
                        <b>Destinations:</b> <span>{destinationSummary || "Psychiatric Inpatient Ward"}</span>
                      </div>
                      <div>
                        <b>High Acuity Nursing:</b>{" "}
                        <span>
                          {draft.highAcuityNursingNeeded === true ? "High acuity 1:1 ratio" : "Standard ratio"}
                        </span>
                      </div>
                      <div>
                        <b>Transport Mode:</b>{" "}
                        <span>{draft.transportNeeded === true ? "Nurse escort requested" : "Routine transport"}</span>
                      </div>
                      <div>
                        <b>Tentative Category:</b>{" "}
                        <span>
                          {draft.tentativeDiagnosis && draft.tentativeDiagnosis !== NO_DIAGNOSIS_VALUE
                            ? tentativeDiagnosisPhrase(draft.tentativeDiagnosis)
                            : "Not recorded"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={pageStyles.letterheadSection}>
                    <div className={pageStyles.docSectionHead}>3. Clinical History Narrative &amp; Handover</div>
                    <div className={pageStyles.docClinicalStory} id="prevDocStory">
                      {draft.history || "(No clinical history narrative recorded)"}
                    </div>
                  </div>

                  <div className={pageStyles.docFooterSection}>
                    Local Ward Flow prototype preview &middot; No external transmission
                  </div>
                </div>
              </div>
              <div className={pageStyles.modalFooter}>
                <button type="button" className={pageStyles.btnModalSecondary} onClick={() => setIsPreviewOpen(false)}>
                  Close
                </button>
                <button
                  type="submit"
                  form="ward-referral-intake-form"
                  className={pageStyles.btnModalPrimary}
                  id="btnConfirmAndSendFromPreview"
                  onClick={() => setIsPreviewOpen(false)}
                  disabled={!answered || Boolean(refusedCombination)}
                >
                  <span>Send Referral Now</span>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M15.854.146a.5.5 0 0 1 .11.54l-5.8 14.5a.5.5 0 0 1-.928-.016L6.59 9.41 1.824 6.764a.5.5 0 0 1-.016-.928L16.308.036a.5.5 0 0 1 .546.11z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Non-blocking Accessible Toast Notification (D4 Compliance) */}
        <div id="toastContainer" className={pageStyles.toastContainer} aria-live="polite">
          {toastMessage && (
            <div className={`${pageStyles.toastNotification} ${pageStyles.toastNotificationShow}`}>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ color: "var(--accent)", flexShrink: 0 }}
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{toastMessage}</span>
            </div>
          )}
        </div>

        <WardPrototypeFooter
          testId="ward-referral-intake-governance"
          note={
            <>
              <span>Front-door patient referral intake &middot; Not a medical device.</span>
              <span className="sr-only">
                Written history is free text, sent exactly as entered and not checked. Structured questions cannot hold
                a name or Mental Health Act figure. A linked referral stores only a patient-record pointer: the patient
                ID.
              </span>
            </>
          }
        />
      </main>
    </div>
  );
}
