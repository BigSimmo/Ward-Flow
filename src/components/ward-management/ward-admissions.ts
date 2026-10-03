import type { CareJourney } from "./ward-care-journey";
import { BED_RELEASE_BLOCKERS, type BedReleaseBlocker } from "@/components/ward-management/ward-change-reasons";
import { MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import type { TentativeDiagnosisBlock } from "@/components/ward-management/ward-diagnosis";
import type {
  HomeRegion,
  MovementId,
  RecordedSex,
  ReferralGender,
  Unit,
} from "@/components/ward-management/ward-model";
import type { PatientId } from "@/components/ward-management/ward-patients";

/**
 * The admission — a person inside a bed.
 *
 * Until this module existed the prototype knew a ward had 20 beds, 3 empty and 2 held, and
 * nothing at all about anybody occupying one. Every occupancy figure was therefore a number a
 * ward hand-maintained, and no screen could say how long a bed had been taken, when it was coming
 * free, or how far from home somebody had been placed. This record is what those two features —
 * the ward board and the out-of-area ledger — are derived FROM.
 *
 * Three standing rules govern everything below, and each has already been broken once elsewhere
 * in this prototype:
 *
 *   1. **No figure from the Mental Health Act.** Not a duration, not a timeframe, not a
 *      threshold, in code, comment, test or fixture. Three separate agents have written three
 *      different invented statutory figures into this directory and each reached the screen
 *      before it was caught (`tests/ward-legal-figure-guard.test.ts` records all three). Nothing
 *      here is a legal clock: `expectedDischargeAt` is a ward's own plan and `STAY_BANDS` is a
 *      display grouping the product owner supplied.
 *   2. **Chosen, never typed.** Every category is a fixed runtime array with a membership check.
 *      There is no `notes`, `note`, `comment` or free-text field of any kind, so the
 *      synthetic-data promise is true by construction rather than by a user reading a label and
 *      complying.
 *   3. **A TENTATIVE diagnosis, chosen from eleven broad blocks, and nothing finer.** This rule
 *      used to read "no diagnosis, and no placeholder for one". **The owner reversed that on
 *      2026-08-29**, in his words: "It can give a tentative diagnosis. This is because most
 *      referrals will require a diagnosis", and "Just create broad core categories used in
 *      Australia for mental health coding for now". `tentativeDiagnosis` below is that decision
 *      and the whole of it — a single value picked from `TENTATIVE_DIAGNOSIS_BLOCKS`, never
 *      typed, never a specific condition, never anybody's words. The record still carries no
 *      name, date of birth, record number, address or narrative history, and
 *      `tests/ward-admission-model.test.ts` asserts the field set structurally — widened in the
 *      SAME change as this field, by name, so the guard bound on it rather than being stepped
 *      around.
 *
 * Everything in this module — the type, its vocabularies and its helpers — lives in this ONE
 * file. Nothing here belongs in `ward-model.ts`.
 */

/**
 * The four states an admission passes through, in lifecycle order.
 *
 *   - `waitlisted` — accepted in principle, no bed given. Consumes nothing.
 *   - `pulled`     — the ward has GIVEN THE BED AWAY to this person. They may still be in an
 *                    emergency department waiting for transport. The bed is gone from this
 *                    moment; see `bedIsOccupied`.
 *   - `occupied`   — the person is physically in the bed.
 *   - `departed`   — gone. The bed is released; see `LEAVING_DESTINATIONS` for what "discharged"
 *                    means to the state as opposed to this ward.
 *
 * ⚠️ **THIS COMMENT SAID `left` UNTIL 2026-09-01 AND WAS WRONG FOR HOURS AFTER THE RENAME.** The
 * union above said `departed`; its own documentation, twelve lines up, said `left`. **Nothing could
 * catch it:** typecheck cannot read a comment, no test asserts prose, and it escaped a grep for
 * `"left"` because a comment writes the value in backticks rather than double quotes. Found by Ward
 * Verifier, whose own first pass missed it for the same reason.
 *
 * **A rename that compiles is not a rename that happened.** The old word must be looked for where a
 * READER is, not only where the compiler is — and the reader of a union's own comment is the person
 * most likely to trust it.
 *
 * A runtime array beside the union, the same treatment every other union in this feature that
 * needs a picker carries (`SEXES`, `COHORTS`, `SEX_DESIGNATIONS`, `MOVEMENT_STAGES`). A
 * hand-written `AdmissionState[]` option list in a component is how `COHORTS` came to silently
 * omit `"Youth"` from a picker — typed as the union, so widening it could never make the picker
 * fail to compile.
 */
export const ADMISSION_STATES = ["waitlisted", "pulled", "occupied", "departed"] as const;
export type AdmissionState = (typeof ADMISSION_STATES)[number];

export type StayBandId = "under-2-weeks" | "2-weeks-1-month" | "1-3-months" | "over-3-months";

export type StayBand = {
  id: StayBandId;
  label: string;
  /**
   * The exclusive ceiling in days: a stay belongs to the first band whose ceiling it is strictly
   * BELOW, so exactly 14 days has already left `under-2-weeks`. `null` marks the single open-ended
   * band, which must be last — a `null` ceiling anywhere earlier would swallow every longer stay
   * and `stayBand` would stop discriminating without a band id changing.
   */
  upToDays: number | null;
};

/**
 * How long someone has been in a bed, as a display grouping.
 *
 * **These four bands were supplied verbatim by the product owner.** They are HIS, and they are
 * the whole reason a number appears in this file at all. They are not a clinical threshold, not
 * derived from any evidence, and above all not a figure from the Mental Health Act — nothing here
 * has any legal meaning whatsoever, and a band boundary must never be read, rendered or reused as
 * though a statute set it.
 *
 * **Why these boundaries and not the previous 1 week / 4 weeks / 3 months** — the owner's own
 * reasoning, recorded because the next implementer to look at a band boundary should find the
 * argument rather than re-derive it. A shade only informs if it splits the population somewhere
 * meaningful. Acute psychiatric stays typically clear within a fortnight, so a one-week boundary
 * sat BEFORE most people had left: the palest band held nearly everyone, and a colour nearly every
 * tile carries tells a coordinator nothing. Moving the first boundary to a fortnight puts it where
 * the population actually divides, and the three bands above it describe the stays that are
 * genuinely unusual for this ward.
 *
 * **This set replaces the previous one everywhere — there is never a second set.** The tile
 * colouring and the ward statistics both read THESE bands, from here. A tile shaded by one set of
 * boundaries while a statistic counts by another is the failure this feature has refused at every
 * decision point, and it is refused by there being exactly one array.
 *
 * **There is deliberately no "target" band, and none may be added.** A band saying a stay is
 * longer than it should be would be a threshold nobody agreed to, applied to a person, on a
 * screen a ward reads every morning. Adding one is a recorded product decision from the owner by
 * name and date — never an implementer's convenience, and never an inference from the four bands
 * below. The same bar applies to changing a boundary: these values came from him and only he
 * replaces them.
 */
export const STAY_BANDS: readonly StayBand[] = [
  { id: "under-2-weeks", label: "Under 2 weeks", upToDays: 14 },
  { id: "2-weeks-1-month", label: "2 weeks – 1 month", upToDays: 30 },
  { id: "1-3-months", label: "1–3 months", upToDays: 90 },
  { id: "over-3-months", label: "Over 3 months", upToDays: null },
];

export type LeavingDestination =
  | "discharged-to-the-community"
  | "transferred-to-another-psychiatric-ward"
  | "transferred-to-a-general-hospital"
  | "moved-to-residential-care"
  | "moved-to-residential-aged-care"
  | "returned-to-residential-aged-care"
  | "transferred-to-other-health-care"
  | "left-against-advice"
  // Added 2026-09-01 by owner ruling. See `LEAVING_DESTINATIONS` for why absconding is NOT here.
  | "died-on-the-ward"
  | "transferred-to-custody"
  | "did-not-return";

/**
 * Where someone went, and — the part that matters — whether the STATE got a bed back.
 *
 * `countsAsStatewideRelease` is `false` for exactly one destination, and that `false` is the
 * reason this list exists as data rather than as a string. **That count is asserted in
 * `tests/ward-leaving-destinations.test.ts` rather than trusted here** — a count written into a
 * comment has no guard and goes stale the moment the list grows. A transfer to another psychiatric ward
 * frees the SENDING ward's bed and gives the network nothing at all: the person still occupies a
 * psychiatric bed, just a different one. Counting it as a release would let the board report beds
 * coming free that were never free, and the error compounds every time a person is moved between
 * wards. Every other destination genuinely returns a bed to the state.
 *
 * The destinations are operational facts about where a bed went, never a judgement about the
 * person: "left against advice" records that the admission ended without the ward's agreement,
 * which is a fact about the departure, and nothing here describes anyone's condition or conduct
 * beyond that.
 */
/**
 * What somebody recorded about follow-up. Two states, because those are the two things a person can
 * actually assert; the third possibility — that nobody asserted anything — is `null` on the field
 * itself rather than a value here. A `"not_recorded"` member would let a caller write down that
 * nothing is known, which is not a fact anybody establishes.
 */
export const FOLLOW_UP_STATES = ["arranged", "not_arranged"] as const;
export type FollowUpState = (typeof FOLLOW_UP_STATES)[number];

/**
 * ⚠️ **WHO AND WHEN ARE NOT DECORATION.** An unattributed "follow-up arranged" is the claim this
 * hub is least able to check and most damaged by being wrong about, so the record carries who said
 * it and when, on the same terms every other decision in this model does: `recordedBy` is a ROLE
 * and never a personal name (see `dischargeConfirmedBy`).
 */
export type FollowUpRecord = {
  state: FollowUpState;
  recordedAt: Instant;
  recordedBy: string;
};

/** Membership check for the follow-up vocabulary — chosen, never typed. */
export function isFollowUpState(value: string): value is FollowUpState {
  return (FOLLOW_UP_STATES as readonly string[]).includes(value);
}

export const LEAVING_DESTINATIONS: readonly {
  id: LeavingDestination;
  label: string;
  countsAsStatewideRelease: boolean;
}[] = [
  { id: "discharged-to-the-community", label: "Discharged to the community", countsAsStatewideRelease: true },
  // The one `false`. See this array's own doc comment — do not "tidy" it to true for consistency.
  {
    id: "transferred-to-another-psychiatric-ward",
    label: "Transferred to another psychiatric ward",
    countsAsStatewideRelease: false,
  },
  {
    id: "transferred-to-a-general-hospital",
    label: "Transferred to a general hospital",
    countsAsStatewideRelease: true,
  },
  { id: "moved-to-residential-care", label: "Moved to residential care", countsAsStatewideRelease: true },
  {
    id: "moved-to-residential-aged-care",
    label: "Moved to residential aged care (new residence)",
    countsAsStatewideRelease: true,
  },
  {
    id: "returned-to-residential-aged-care",
    label: "Returned to residential aged care (usual residence)",
    countsAsStatewideRelease: true,
  },
  {
    id: "transferred-to-other-health-care",
    label: "Transferred to other health care accommodation",
    countsAsStatewideRelease: true,
  },
  { id: "left-against-advice", label: "Left against advice", countsAsStatewideRelease: true },
  /*
   * Added 2026-09-01 by owner ruling. All three are `true`, and that is not a default — the semantic
   * is **does the STATE gain a psychiatric bed**, not "did the person leave the system". None of these
   * three leaves the person in a psychiatric bed, so all three release one.
   */
  { id: "died-on-the-ward", label: "Died on the ward", countsAsStatewideRelease: true },
  { id: "transferred-to-custody", label: "Transferred to police or prison custody", countsAsStatewideRelease: true },
  /*
   * ⚠️ **THIS IS THE END OF AN ABSCONDING, NOT AN ABSCONDING.** When a patient absconds their bed is
   * HELD — they are still admitted, still the ward's responsibility, and may still be detained under
   * the Act. They have not been discharged; they are missing. This is what a ward records when it
   * eventually decides the bed is not coming back to that person.
   *
   * **ABSCONDING ITSELF MUST NEVER BE ADDED TO THIS LIST.** Everything here frees the bed —
   * `RECORD_LEAVING` sets `state: "departed"` and increments `empty` — so recording an abscondence here
   * would release the bed of a patient nobody has found. It was proposed on 2026-09-01 and rejected on
   * exactly that ground, before it was built. `tests/ward-leaving-destinations.test.ts` guards it.
   */
  { id: "did-not-return", label: "Did not return", countsAsStatewideRelease: true },
];

/** Fixed operational vocabulary, shared by commands, pickers and storage recovery. */
export function isLeavingDestination(value: unknown): value is LeavingDestination {
  return typeof value === "string" && LEAVING_DESTINATIONS.some((destination) => destination.id === value);
}

/**
 * Long-stay primary discharge barriers (applicable when stay >= 7 days).
 * Chosen, never typed: fixed runtime array with membership check.
 */
export const DISCHARGE_BARRIERS = [
  "Accommodation / Housing",
  "NDIS",
  "SAT / Public Guardian",
  "RACF / Aged Care",
  "Clinical / Treatment",
  "Social / Family",
  "Several",
] as const;
export type DischargeBarrier = (typeof DISCHARGE_BARRIERS)[number];

export function isDischargeBarrier(value: unknown): value is DischargeBarrier {
  return typeof value === "string" && (DISCHARGE_BARRIERS as readonly string[]).includes(value);
}

/**
 * Why a pull was released — the bed given back before the person ever reached it.
 *
 * Chosen never typed, like every fixed list in `ward-change-reasons.ts`, and about THE NETWORK OR
 * THE JOURNEY rather than a judgement about the person: transport did not come, a bed was found
 * somewhere else, the pull was made in error. "Clinical condition changed" is the one entry that
 * touches clinical ground and it is deliberately blunt — it records that the plan stopped being
 * the right one, and says nothing about what changed, in which direction, or about anybody.
 *
 * "Admission declined" deliberately drops the person-token the brief for this task used
 * ("declined by patient"), following the same discipline `changeReasonLabels` already applies to
 * `patient_no_longer_coming` and `patient_not_ready`: the recorded fact is that the admission was
 * declined, which is complete without naming who declined it.
 *
 * Like `ESCALATION_CONTACTS` and `BED_RELEASE_BLOCKERS`, the values ARE the rendered text — there
 * is no clinical token to keep out of a label here to begin with. Nothing on `Admission` carries
 * one of these yet; the vocabulary is defined here so that the release event, when it is built,
 * has one list to draw from rather than inventing a second.
 */
export const PULL_RELEASE_REASONS = [
  "Clinical condition changed",
  "Transport unavailable",
  // ⚠️ "Placed elsewhere" WAS HERE AND THE OWNER STRUCK IT, 2026-09-03. A pull is released
  // because THIS admission is not happening; where the person went instead is a different
  // fact, on a different record, and offering it here invites a ward to write another unit's
  // business into its own release note. `tests/ward-pull-release-reasons.test.ts` asserts it
  // is gone, because nothing on `Admission` carries one of these yet — so without a pin its
  // removal is invisible and its return would be too.
  "Admission declined",
  "Pulled in error",
] as const;
export type PullReleaseReason = (typeof PULL_RELEASE_REASONS)[number];

/**
 * The permitted values for `dischargeDateSetBy` and `dischargeConfirmedBy` — the ward's own role,
 * one spelling, and the field's entire runtime vocabulary.
 *
 * Owner ruling 5, 2026-09-01
 * (`docs/ward-flow/owner-rulings-2026-09-01-fourteen-decisions.md`): **"Ward manager" wins,
 * everywhere, one spelling.** Before this ruling both fields carried whichever of three spellings
 * a given seed line happened to use — `"Ward manager"`, `"Flow coordinator"` and `"Nurse unit
 * manager"` were all live — because the fields were typed `string | null` with no runtime
 * vocabulary of their own to hold them to one. `"Flow coordinator"` and `"Nurse unit manager"` are
 * NOT this field's second and third roles; they were two other spellings of this ONE role, now
 * reconciled.
 *
 * `readonly` and exported so a seed or a test importing this is checked against the field's own
 * source of truth rather than hand-copying a list that can drift from it — see
 * `ward-admissions-seed.ts` and `tests/ward-admissions-seed.test.ts`.
 */
export const DISCHARGE_ROLE_LABELS = ["Ward manager"] as const;
export type DischargeRoleLabel = (typeof DISCHARGE_ROLE_LABELS)[number];

/**
 * A person inside a bed — or on their way to one, or gone from one.
 *
 * The field set is EXACTLY what is below and nothing else. It is not a patient record and must
 * never grow into one: no name, date of birth, record number, address, narrative history or free
 * text, ever. `tests/ward-admission-model.test.ts` checks that structurally, both against
 * `ADMISSION_FIELDS` at runtime and against a fully-populated literal under `tsc`, so a future
 * `notes` field fails a test rather than being caught by a reviewer's memory. Widening this list
 * is a governance decision, not an implementation one — `tentativeDiagnosis` is the third time
 * that decision has been taken, and it was taken by the owner, on the record, on 2026-08-29.
 *
 * Optionality is expressed as `| null`, never as an optional `?` field: a fact nobody has
 * recorded is present-and-empty rather than absent, so a screen has to look at it and decide what
 * to render instead of silently reading `undefined` as a zero or a "no".
 */
export type Admission = {
  id: string;
  /** The bed's unit. An admission belongs to one unit at a time; a transfer ends this admission
   *  (`state: "departed"`, `leavingDestination: "transferred-to-another-psychiatric-ward"`) and
   *  begins a new one, which is what keeps each ward's own occupancy honest. */
  unitId: string;
  /**
   * WHETHER THIS BED IS BEING HELD FOR SOMEBODY WHO NEEDS ONE-TO-ONE OBSERVATION.
   *
   * ⚠️ **A FACT ABOUT THE WARD'S STAFFING OF THE BED — NOT A CLINICAL FACT ABOUT THE PERSON.**
   * That distinction IS the owner's ruling (2026-09-01, ruling 1 of fourteen), and it is the whole
   * reason this field is permitted onto a record that otherwise widens only by owner, by name and
   * by date. It says the ward has committed a nurse to this bed. It says nothing about why, nothing
   * about risk, nothing about any assessment anybody made, and it must never be read, rendered or
   * counted as though it did. `Unit.speciallingCapacity` is the ward's own figure for how many such
   * commitments it can staff, and this field is what that figure counts.
   *
   * **Why the record had to widen at all.** `Unit.speciallingCapacity` is authored per unit and
   * changed by no reducer path, so the only question anything could ask was whether a ward had ANY
   * capacity — never whether it had any LEFT. A ward that can watch one person one-to-one accepted
   * an unlimited number, and no screen showed a wrong figure because there was no figure: the ward
   * would find out when the second patient arrived. This field is what makes the remaining count
   * derivable — see `remainingSpeciallingCapacity` beside `bedIsOccupied`.
   *
   * **A boolean, and deliberately not a level, a ratio or a reason.** "One-to-one, or not" is the
   * whole of what the capacity figure counts. An observation level, a `2:1`, or a reason for the
   * observation would each be a clinical judgement this prototype has no authority to record and
   * nobody to attribute it to — the bar `tentativeDiagnosis` had to clear with an owner ruling of
   * its own, and this field is deliberately not attempting to clear it.
   *
   * `false` is the ordinary state and means the ward is not staffing this bed one-to-one. It is
   * never inferred from anything — not from legal status, not from security, not from a movement's
   * urgency. `PULL_PATIENT` copies it from `Movement.specialling`, which a person ticks at intake,
   * and that is the only runtime writer.
   */
  specialling: boolean;
  /**
   * Whether this bed is being held as a HIGH-ACUITY place.
   *
   * The same narrow claim `specialling` above makes, about a different ward resource: it says the
   * ward has committed a high-acuity place to this bed. **It says nothing about why, nothing about
   * risk, nothing about any assessment anybody made**, and must never be read, rendered or counted
   * as though it did.
   *
   * `PULL_PATIENT` copies it from `Movement.highAcuity`, which is carried in turn from the
   * referral, where **the referring clinician marked it** (owner ruling, 2026-09-10). That is the
   * only runtime writer. It is never inferred from `specialling` — a ward can staff a one-to-one
   * nurse without that bed being one of its high-acuity places, and the two figures are authored
   * separately on the unit for exactly that reason.
   */
  highAcuity: boolean;
  /**
   * The referral this admission came from - the join back to the front door.
   *
   * `null` from 2026-08-30 (Task 17), and it is a real state rather than missing data: an
   * admission created when a patient ARRIVES from an emergency department came from a `Movement`,
   * not from a `Referral`, and movements carry no referral. Saying so is honest; minting a
   * referral id that points at nothing would not be. Nothing reads this field today - it is
   * written by the seed and consumed nowhere - so widening it costs no consumer a branch.
   *
   * 🔴 CORRECTED 2026-09-11: "Nothing reads this field today ... consumed nowhere" IS FALSE.
   * `admissionBelongsToTeam` and `admissionsWithUnresolvableReferral` (both in
   * `community/community-derivations.ts`) read it to resolve community-team membership.
   * ⚠️ So widening it DOES cost a consumer a branch, and the sentence saying otherwise is the
   * one a maintainer would rely on.
   * ✅ The rest holds: `null` is a real state and not missing data, and minting an id that
   * points at nothing would still be dishonest.
   */
  referralId: string | null;
  /**
   * Join to the live movement so community "bed pulled" rows can scope CANCEL_TRANSPORT.
   *
   * Owner ruling 2026-09-21: cancel UI stayed blocked because Admission had no movementId while
   * CANCEL_TRANSPORT is movement-scoped. PULL_PATIENT writes movement.id here.
   *
   * null = seeded historical occupancy or no live movement — cancel UI must hide / no-op.
   */
  movementId: MovementId | null;
  /**
   * ⚠️ **THE JOIN D-14 ADDS — A POINTER TO THE EXISTING PATIENT RECORD, NEVER A COPY.**
   *
   * Ruling D-14 (`docs/ward-flow/owner-decisions-2026-09-1x.md`, Ward Lead's ruling under
   * delegation, 2026-09-11): *"Admission and Referral carry no `patientId`. Nothing joins a bed's
   * occupant to a person."* Added in the SAME change as the guard that actively refuses reading it
   * outside a permitted path — the two ship together or not at all, because a guard that is
   * satisfied only by the join's absence is not a guard.
   *
   * Same discipline as `Referral.patientId` (`ward-model.ts`), which this field mirrors: an id and
   * nothing else. No name, date of birth, record number, address or diagnosis follows it, and
   * `tests/ward-admission-model.test.ts`'s structural privacy guard still fails on every one of
   * them — this field is let through by name, in that guard's `AUTHORISED_PERSON_FACTS`, not by
   * relaxing it.
   *
   * `| null`, following this record's own convention (see this type's header), never optional `?`:
   * an admission whose occupant is not on file is a real, ordinary state, not a gap to guess at.
   *
   * **DERIVED, NEVER INVENTED.** The only runtime writer, `PULL_PATIENT`
   * (`ward-flow-reducer.ts`), reads it off the movement's own linked referral —
   * `referralForMovement(movement, state.referrals)?.patientId ?? null` — the same resolution
   * `referralForMovement` already performs for `Movement.referralId`, never a value composed from
   * the admission's own id. `Admission.referralId` above is the cautionary precedent for what NOT
   *
   * 🔴 CORRECTED 2026-09-11: EVERY FACTUAL CLAUSE ABOUT `Admission.referralId` ABOVE IS NOW FALSE.
   * Struck in place rather than deleted, because the reading that made it true is what a reader
   * will otherwise re-derive.
   *
   *     seeded Admission.referralId, non-null      10      every one RESOLVES
   *     real Referral ids                          24      dangling: ZERO
   *     admissions carrying literal null          257      an honest absence, not a broken join
   *
   * Repaired 2026-09-10 at a6e5208b85 - "seeded referralId links what is true and nulls the rest,
   * invents nothing". ⚠️ The manufacturing by string substitution is GONE, not reduced.
   *
   * ✅ The paragraph's OWN subject is untouched and still correct: `patientId` is DERIVED at
   * runtime and must never be composed from the admission's own id. Only the example used to
   * illustrate it has stopped being an example.
   * to do here: its seeded values are manufactured from the admission's own suffix and join to
   * nothing real (see `docs/ward-flow/fields-with-no-producer-2026-09-01.md`). A handful of
   * admissions in `ward-admissions-seed.ts` carry a genuine value, reusing the same real
   * referral-and-admission pairs `referralId` already authors — never a hand-picked patient with
   * no referral behind it.
   *
   * ⚠️ **NOTHING MAY READ IT YET, EXCEPT WHAT IS EXPLICITLY LISTED.**
   * `tests/ward-patient-link-default-deny.test.ts` is D-14's enforcement: it default-denies every
   * ward-management source file from referencing `.patientId` on any record, and an allowlisted
   * exception must name the file, the reason, and the ruling that permits it. This field existing
   * on the type is not itself a permission to render it, join through it, or use it to answer any
   * question about where else a person has been.
   */
  patientId: PatientId | null;
  /**
   * A DELIBERATE, OWNER-CONFIRMED WIDENING of what this feature holds about a person, and the
   * only one this record makes.
   *
   * Its purpose is structural: a ward's male/female counts (`Unit.sexMix`) are currently
   * hand-maintained numbers that nothing derives and nothing can check. Holding `sex` on the
   * admission makes those counts DERIVED from the people actually in the beds, so a ward's mix
   * can no longer silently disagree with its own occupancy. That is the whole justification —
   * not display, not filtering, and certainly not a person-fact collected because it was
   * available. `homeRegion` beside it is the same shape for the out-of-area ledger.
   *
   * A copy, not a new fact: both are already on the `Referral` this admission came from. They are
   * carried here so occupancy figures can be computed from beds rather than from referrals.
   * Recorded sex under R7 (25 September 2026) — see `RECORDED_SEXES`.
   */
  sex: RecordedSex;
  /**
   * 🔴 WIDENED ON PURPOSE, 25 September 2026 — owner rulings that a ward's male/female counts follow
   * GENDER, not sex, and R7's gender values. The same justification as `sex` above and nothing
   * more: a copy of the gender recorded on the movement or referral this admission came from, held
   * so the ward's counts (`derivedSexMix`, `departAdmission`) can follow gender from the beds
   * themselves. Absent means not recorded; the count then falls back to recorded sex
   * (`mixSexOf`, `ward-eligibility.ts`).
   */
  gender?: ReferralGender;
  /**
   * The broad area this person is from - a region, never an address; membership-checked, never
   * free text. Carries no distance or ordering by proximity of its own: `ward-distance.ts` is the
   * single entry point for how far a bed is from a home region, and no band is ever stored here.
   *
   * `null` from 2026-08-30 (Task 17), AND IT IS A SEAM RATHER THAN A DESIGN. A patient arriving
   * through the emergency-department pathway carries no home region anywhere in the model: it
   * exists on `Referral` alone, sites hold no region, and deriving one from the origin ED would be
   * inventing it - where somebody was admitted from is not where they live.
   *
   * The owner has an open ruling on which fact is actually recorded. Real catchment in WA is by
   * SUBURB - roughly a thousand of them mapping to approved hospitals and follow-up clinics - and
   * the ten broad `HOME_REGIONS` cannot carry that: every Perth suburb is "Perth Metropolitan"
   * while Armadale and Joondalup sit at opposite ends of the city with different services. If
   * suburb becomes the recorded fact and region is derived from it, this field's authority moves,
   * and writing a region here first would give one fact two homes - the thing the changeable-data
   * rule exists to forbid.
   *
   * So an ED-pathway admission records no region until he rules, and every consumer says so in
   * words rather than guessing or omitting the person. Not a permanent state: when the ruling
   * lands, this becomes non-null again and the seam closes in one place.
   */
  homeRegion: HomeRegion | null;
  /**
   * THE BROAD BLOCK THIS RECORD HOLDS AS A TENTATIVE DIAGNOSIS — and the word tentative is load
   * bearing in the field name, in the vocabulary's name, on every screen that shows it, and here.
   *
   * **A DELIBERATE, OWNER-RULED WIDENING of this record's field set (2026-08-29), the third one it
   * has taken, and the first that is a fact about the PERSON rather than about the ward's own act.**
   * It reverses rule 3 at the top of this file, which until this change said the record held no
   * diagnosis and no placeholder for one. The owner's words: "It can give a tentative diagnosis.
   * This is because most referrals will require a diagnosis." The permission is his and the reason
   * is his; nothing here is an implementer widening a record because a screen looked bare.
   *
   * **What this is NOT.** It is not a diagnosis anybody has confirmed, examined for, or agreed
   * with, and it is not something a referral gave: `Referral` has no diagnosis field of any kind
   * (`ward-model.ts`, pinned by `tests/ward-referral-model.test.ts`), and the only runtime writer
   * of this field sets it to `null` (`ward-flow-reducer.ts`). It is a broad category at the
   * coarsest resolution the Australian coding standard defines — one of eleven blocks covering the
   * whole of ICD-10-AM Chapter V. A board that read it as settled would be reading something this
   * record cannot say, which is why every renderer of it carries the word "tentative" and why
   * `TENTATIVE_DIAGNOSIS_BLOCKS` is named for the tentativeness rather than for the classification.
   *
   * **Chosen, never typed** (rule 2, and this is the field it protects hardest). The value is one
   * of eleven fixed strings with a membership check; there is no free-text path to it and there
   * must never be one. That single rule is what keeps a patient's own words, a clinician's
   * impression, and a narrative history out of this prototype entirely — not a label asking a user
   * to be careful.
   *
   * `null` — an ordinary state, seeded deliberately — means nobody recorded one. It must never
   * read as "no mental illness", as "not yet assessed", or as a slot a ward is expected to fill
   * in: see the ward board, which says the absence in words rather than drawing an empty field.
   */
  tentativeDiagnosis: TentativeDiagnosisBlock | null;
  /**
   * WHICH KIND OF BED THIS ADMISSION ACTUALLY TOOK — item 11, owner answer 11 (17 September 2026):
   * *"voluntary patients take open beds first, and secure patients take locked beds first."*
   * `PULL_PATIENT` is the only runtime writer, and it records exactly the kind it took: an Open
   * request that had to fall back to a locked bed records `"locked"`, a Secure request that had to
   * fall back to an open bed (only with a recorded override reason) records `"open"` — never the
   * kind the REQUEST preferred, always the kind the BED actually was.
   *
   * ⚠️ **OPTIONAL, AND ABSENT IS A REAL, ORDINARY STATE — NOT A GAP.** Every admission in
   * `ward-admissions-seed.ts` was authored before this field existed and carries no bed-kind
   * record. `releasePulledBedAndAdmission`'s own doc comment states the residual this leaves: a
   * seeded admission's bed is refunded to `allocatable` alone, because nothing here can say which
   * kind it was. A required `| null` field (this record's usual convention) would force every seed
   * admission to be rewritten with an invented kind — the exact thing rule 1 at the top of this file
   * exists to forbid.
   */
  bedKind?: "locked" | "open";
  state: AdmissionState;
  /** When the ward gave the bed away. The bed is gone from this instant — but a stay does NOT
   *  start here; see `daysInBed`. `null` while waitlisted. */
  pulledAt: Instant | null;
  /** When the person physically arrived. The stay clock, and the ONLY clock a length of stay is
   *  ever measured from. `null` until they get here — including for a pulled bed. */
  arrivedAt: Instant | null;
  /**
   * When this person left the ward for an emergency department, or `null` while they are on it.
   *
   * **THE BED STAYS OCCUPIED AND THIS FIELD MUST NEVER CHANGE THAT.** A ward sending somebody to
   * an ED for a medical problem is usually holding the bed, because they are coming back. So this
   * is deliberately NOT an `AdmissionState`, NOT a `LeavingDestination`, and nothing in
   * `bedIsOccupied`, `capacityBreakdown` or any availability figure reads it. Every one of those
   * routes would free a bed that is not free, which is the single failure this model exists to
   * prevent — a coordinator offering a bed a ward is still keeping.
   *
   * **It is a fact about the PERSON, which is why it is a field and not a state.** `AdmissionState`
   * is `waitlisted | pulled | occupied | left` and every member is about the BED. Putting "away at
   * an ED" in there is how `"pulled"` comes to look like the nearest fit when it is the mirror
   * image — someone in an ED whose ward bed has already gone.
   *
   * **An instant rather than a boolean, following `pulledAt`.** A ward reading the board wants to
   * know how long, not merely whether: somebody six hours in an ED is a different conversation
   * from somebody thirty minutes in. One field carries both facts and cannot disagree with itself.
   *
   * Owner decision, 2026-08-30: the board marks a patient who is temporarily off the ward. Without
   * it their tile is an ordinary occupant — day count, stay band, tentative diagnosis — and a
   * charge nurse reading the grid believes they are in the bed.
   */
  awayAtEmergencyDepartmentSince: Instant | null;
  /**
   * When the ward currently expects this person to leave. A WARD'S OWN PLAN, revisable at will
   * and carrying no legal or contractual weight of any kind — never a deadline, never a target,
   * never a figure derived from any statute. `null` means nobody has set one, which is a real and
   * ordinary state: see `isPastExpectedDischarge` for why that must never read as "not yet due"
   * OR as "overdue".
   */
  expectedDischargeAt: Instant | null;
  /** How many times the expected date has been moved. A count of revisions to the WARD'S plan,
   *  never a measure of a person — it says the plan kept changing, not that anybody was slow. */
  dischargeDateMoves: number;
  /** When the current expected date was set. `null` when there is none. */
  dischargeDateSetAt: Instant | null;
  /** WHO set it, as a ROLE drawn from `DISCHARGE_ROLE_LABELS` — and NEVER a personal name. Same
   *  discipline as `Referral.decidedBy` and `StatusChange.by`. `null` when no expected date has
   *  been set. */
  dischargeDateSetBy: DischargeRoleLabel | null;
  /**
   * When the ward CONFIRMED this discharge is happening — a decision, not a plan.
   *
   * **A DELIBERATE, OWNER-RULED WIDENING of this record's field set (2026-08-29), the second one
   * it has taken.** It is here because the two facts are genuinely different and the record could
   * previously express only one of them: `expectedDischargeAt` is what the ward EXPECTS, revisable
   * at will; this is the ward saying it has DECIDED. An earlier implementer building
   * `derivedBedReleases` (`ward-discharge-dates.ts`) found the `"confirmed"` stage unreachable for
   * exactly that reason — nothing on this record distinguished a decided departure from a planned
   * one — and declined to invent a proxy for it (a date falling within some window, a revision
   * count of zero, a date set long enough ago). That refusal was correct: every one of those
   * proxies renders a ward decision that nobody made, on a screen a coordinator reads as fact.
   * These two fields are the fix, and they are the ONLY route to `"confirmed"`.
   *
   * This is not a widening of what this record holds about a PERSON. It is a fact about the ward's
   * own act, in exactly the category `dischargeDateSetAt` already occupies. That remains true of
   * these two fields; what has changed since they were written is rule 3 itself, which the owner
   * reversed on 2026-08-29 to permit `tentativeDiagnosis` and nothing else. Still no name, date of
   * birth, record number, address or free text, ever.
   *
   * `null` — the ordinary state — means nobody has confirmed anything, which must never be read as
   * a refusal or as a discharge that will not happen. It means the decision has not been taken.
   */
  dischargeConfirmedAt: Instant | null;
  /** WHO confirmed it, as a ROLE drawn from `DISCHARGE_ROLE_LABELS` and NEVER a personal name —
   *  the same bar `dischargeDateSetBy` above holds to, and for the same reason: this record names
   *  wards and jobs, never people. Kept separate from `dischargeDateSetBy` because setting a date
   *  and deciding a discharge is happening are two different acts, and the ward that did one may
   *  not be who did the other. `null` when nothing has been confirmed. */
  dischargeConfirmedBy: DischargeRoleLabel | null;
  /**
   * What is holding the bed up, drawn from `BED_RELEASE_BLOCKERS` — the owner-approved list of
   * eight, reused rather than restated. A second blocked-reason vocabulary for this one fact is
   * the defect class this repository produces most reliably: two lists for one fact is how a
   * screen ends up giving two answers, and the copy drifts the day an entry is added to one of
   * them. If a blocker is missing it is added THERE.
   */
  blockReason: BedReleaseBlocker | null;
  /** Where this person went, once they have gone. `null` until then. */
  leavingDestination: LeavingDestination | null;
  /** When they went. `null` until then. */
  leftAt: Instant | null;
  /**
   * WHETHER ANYBODY ARRANGED FOLLOW-UP, AND WHETHER ANYBODY SAID.
   *
   * ⚠️ **THREE STATES, NOT TWO, AND THE THIRD IS THE WHOLE REASON THIS FIELD EXISTS.** `null` means
   * NOBODY HAS RECORDED EITHER WAY. It does not mean no follow-up was arranged. A boolean here
   * would collapse "nobody arranged anything" into "nobody wrote it down", and the community hub's
   * first list — the spec's "discharged, NO follow-up arranged" — would then quietly assert
   * something nobody checked about every person it listed.
   *
   * That list has been unbuildable since the hub was designed, for want of exactly this fact, and
   * the screen has been saying so in as many words rather than shipping the plausible version.
   *
   * ⚠️ **NEVER INFERRED, FROM ANYTHING.** Not from the leaving destination, not from elapsed time,
   * not from the presence of a community referral. A person discharged to the community with no
   * follow-up recorded is precisely the person this hub is meant to surface; deriving "arranged"
   * for them from any other field would hide them behind a fact nobody established.
   */
  followUp: FollowUpRecord | null;
  /** Closed workflow facts; absent on legacy saves, never inferred during restoration. */
  careJourney?: CareJourney;
  /**
   * Primary discharge barrier for long-stay patients (length of stay >= 7 days).
   * Chosen from DISCHARGE_BARRIERS fixed vocabulary, never typed or free text.
   */
  dischargeBarrier?: DischargeBarrier | null;
  /**
   * Whether this acute patient is flagged as suitable for step-down care to unlock an acute bed.
   */
  stepDownCandidate?: boolean;
};

/**
 * The permitted field set, at runtime.
 *
 * Derived from a total `Record<keyof Admission, true>`, so the compiler refuses a field added to
 * `Admission` and left out of this record — and once it is in, the structural privacy test in
 * `tests/ward-admission-model.test.ts` fails under plain `vitest run`, with no `tsc` step. That
 * combination is the point: a type-only allowlist is invisible to the focused test an implementer
 * actually runs while working, which is exactly how a field slips in unnoticed.
 */
const ADMISSION_FIELD_PRESENCE: Record<keyof Admission, true> = {
  id: true,
  unitId: true,
  specialling: true,
  highAcuity: true,
  referralId: true,
  patientId: true,
  movementId: true,
  sex: true,
  gender: true,
  homeRegion: true,
  tentativeDiagnosis: true,
  bedKind: true,
  dischargeBarrier: true,
  stepDownCandidate: true,
  state: true,
  pulledAt: true,
  arrivedAt: true,
  awayAtEmergencyDepartmentSince: true,
  expectedDischargeAt: true,
  dischargeDateMoves: true,
  dischargeDateSetAt: true,
  dischargeDateSetBy: true,
  dischargeConfirmedAt: true,
  dischargeConfirmedBy: true,
  blockReason: true,
  leavingDestination: true,
  leftAt: true,
  followUp: true,
  careJourney: true,
};

export const ADMISSION_FIELDS: readonly string[] = Object.keys(ADMISSION_FIELD_PRESENCE);

/** Membership check for the blocker vocabulary — chosen, never typed. */
export function isBedReleaseBlocker(value: string): value is BedReleaseBlocker {
  return (BED_RELEASE_BLOCKERS as readonly string[]).includes(value);
}

/**
 * Whether this admission is consuming a bed right now.
 *
 * **`"pulled"` counts, and this must NEVER be "corrected" to require `arrivedAt`.** The ward gives
 * the bed away at the pull; the person may still be in an emergency department awaiting transport,
 * so `arrivedAt` is null and the bed reads as empty to anyone who checks arrival. It is not empty.
 * It is spoken for, and offering it again is a double-allocation — the ward finds out when two
 * people arrive for one bed.
 *
 * The tightening looks entirely reasonable in review ("nobody is in it yet"), which is why it is
 * pinned by a constructed test rather than left to this comment.
 */
export function bedIsOccupied(admission: Admission): boolean {
  return admission.state === "pulled" || admission.state === "occupied";
}

/**
 * HOW MANY MORE ONE-TO-ONE OBSERVATIONS THIS WARD CAN STILL STAFF.
 *
 * The ward's authored figure (`Unit.speciallingCapacity`) less the beds it is already staffing that
 * way — every admission of this unit that is consuming a bed and carries `specialling`. Owner
 * ruling, 2026-09-01: one-to-one nursing is recorded as the ward's staffing of the bed, so this is
 * arithmetic over beds, not a count of people with some clinical property.
 *
 * ⚠️ **DERIVED, AND IT MUST NEVER BECOME A COUNTER THE REDUCER DECREMENTS.** A ward's typed-in
 * number that events push up and down is a figure nothing derives and nothing can check — exactly
 * what `derivedSexMix` exists to replace, for exactly that reason. A mutated counter also cannot
 * survive a mid-stay change, and it silently disagrees with any occupant the seed authored rather
 * than pulled, because no event ever ran for them. Reading the beds cannot drift from the beds.
 *
 * ⚠️ **IT COUNTS OCCUPIED ADMISSIONS, NOT OPEN MOVEMENTS, AND THAT IS THE LOAD-BEARING CHOICE.**
 * The obvious alternative — count movements with `specialling: true` that are still open — inverts
 * at the worst possible moment: a movement's `closure` is set at `PATIENT_ARRIVED`, so the count
 * would drop to zero at the exact instant the person walks onto the ward and starts consuming the
 * slot. `bedIsOccupied` is the right question because the bed is gone from the pull onward,
 * through the arrival, until the person leaves.
 *
 * **Both ends of the lifecycle give the slot back for free, and neither needs a line of its own.**
 * `RELEASE_PULL` deletes the admission and `RECORD_LEAVING` moves it to `departed`; `bedIsOccupied`
 * stops counting it either way. Free is not the same as proven, so both restores are asserted
 * rather than assumed — see `tests/ward-specialling-capacity.test.ts`.
 *
 * A non-finite or negative authored figure reads as zero, and the result is floored at zero: no
 * answer rather than a guess, the same conservative direction `headlineAvailable` and
 * `acceptingBedCounts` already take. A ward whose beds already exceed what it typed in reports
 * nought remaining, never a negative promise.
 */
export function remainingSpeciallingCapacity(unit: Unit, admissions: readonly Admission[]): number {
  const authored = unit.speciallingCapacity;
  const staffable = Number.isFinite(authored) ? Math.max(0, Math.floor(authored)) : 0;
  const staffed = admissions.filter(
    (admission) => admission.unitId === unit.id && bedIsOccupied(admission) && admission.specialling,
  ).length;
  return Math.max(0, staffable - staffed);
}

/**
 * How many HIGH-ACUITY places this unit has LEFT — its authored total minus the occupied beds
 * currently held as high-acuity places.
 *
 * ⚠️ **THIS, NOT `unit.highAcuityCapacity`, IS THE ONLY THING THAT KNOWS WHAT IS LEFT.** The
 * authored figure is never decremented as places fill, so a ward staffed for 2 with both in use
 * still reads 2 there. Written as the exact twin of `remainingSpeciallingCapacity` above because
 * the defect it prevents is the one that already happened once on the specialling path: a screen
 * printed "N available" from the authored total, and `PULL_PATIENT` then refused the placement —
 * the screen invited the placement the engine rejects.
 *
 * ⚠️ **`remainingHighAcuityCapacity(unit, [])` RETURNS THE FULL AUTHORED CAPACITY**, because no
 * admissions means nothing occupied. That is correct and it is also a trap: a caller with no
 * admissions list to hand gets the most optimistic possible answer rather than an error. Callers
 * that cannot supply admissions must say they do not know, exactly as `speciallingFree` does in
 * `capacity-derivations.ts`, never pass `[]`.
 *
 * Degrades conservatively: a non-finite authored figure yields 0 places, never an unbounded ward.
 */
export function remainingHighAcuityCapacity(unit: Unit, admissions: readonly Admission[]): number {
  const authored = unit.highAcuityCapacity;
  const staffable = Number.isFinite(authored) ? Math.max(0, Math.floor(authored)) : 0;
  const staffed = admissions.filter(
    (admission) => admission.unitId === unit.id && bedIsOccupied(admission) && admission.highAcuity,
  ).length;
  return Math.max(0, staffable - staffed);
}

/**
 * Whole days this person has been in the bed, or `null` if they have not arrived.
 *
 * **Counted from `arrivedAt`, NEVER from `pulledAt`.** These are two different clocks: the bed has
 * been gone since the pull, but the person's stay runs from arrival. Reading `pulledAt` here would
 * overstate every length of stay by the transport delay — silently, in the same direction every
 * time, on every screen at once, which is precisely how such a swap survives review.
 *
 * Degrades conservatively and never throws: a missing or non-finite instant yields `null` (no
 * answer), never a substituted fallback. An arrival later than `now` is incoherent data rather
 * than a negative stay, so the result is floored at zero.
 */
export function daysInBed(admission: Admission, now: Instant): number | null {
  const arrivedAt = admission.arrivedAt;
  if (arrivedAt === null || !Number.isFinite(arrivedAt) || !Number.isFinite(now)) return null;
  return Math.max(0, Math.floor((now - arrivedAt) / MINUTES_PER_DAY));
}

/**
 * Which day of this stay today is, **counting the day of arrival as Day 1**. `null` when there is
 * no stay to number.
 *
 * 🔴 **WHY THIS EXISTS: `daysInBed` IS A DURATION AND "Day N" IS AN ORDINAL, AND THE DAILY SHEET
 * WAS PRINTING ONE AS THE OTHER.** `daysInBed` floors at zero, so everybody admitted in the last
 * twenty-four hours is `0` — correct as a duration, and the board renders it correctly as
 * "0 days", meaning they have been in the bed no whole days yet. The handover sheet reused the same
 * number as `Day ${days}` and printed **"Day 0"**, which is not a day of the admission at all: on
 * every ward the day somebody arrives is Day 1. Same value, right on one screen and wrong on the
 * other, because only the noun changed.
 *
 * ⚠️ Reachable on any ordinary morning, not an edge case — it is every patient admitted since
 * yesterday, and it is the row a handover is most likely to be about. Owner ruled it a defect on
 * 2026-09-05.
 *
 * The `+ 1` is the same conversion `ward-daily-sheet.tsx` already makes with `dayOf(now) + 1` for
 * the demonstration day: `dayOf` is a zero-based index and the printed day is one-based. It lives
 * here, named, rather than at the call site, because a bare `+ 1` beside a rendered figure is the
 * kind of thing the next reader removes as a typo.
 */
export function stayDayNumber(daysInBedValue: number | null): number | null {
  return daysInBedValue === null ? null : daysInBedValue + 1;
}

/**
 * The band this stay falls in, or `null` when there is no stay to band.
 *
 * `null` for someone who has not arrived — a pulled-but-empty bed has no stay yet, and banding it
 * as `under-2-weeks` would present a person as having just arrived somewhere they have not
 * reached. An absent stay is shown as absent, the same discipline `ward-distance.ts` holds for an
 * unrecorded travel band: a gap is a gap, never the first entry in a list.
 *
 * A stay belongs to the first band whose `upToDays` it is strictly below, so exactly 14 days has
 * already left `under-2-weeks`. The final band's `null` ceiling catches everything longer.
 */
export function stayBand(admission: Admission, now: Instant): StayBand | null {
  const days = daysInBed(admission, now);
  if (days === null) return null;
  return STAY_BANDS.find((band) => band.upToDays === null || days < band.upToDays) ?? null;
}

/**
 * Whether the ward's own expected discharge date has passed.
 *
 * **`false` when the date is null.** An absent date must never read as "past due", and equally
 * never as "not yet due" — nobody has said when this person is expected to leave, so nothing here
 * may claim either. The same discipline `LegalForm.dueAt` holds elsewhere in this model: never
 * substitute a fallback for an absent instant, and render its absence explicitly rather than
 * letting a boolean answer a question it has no basis to answer.
 *
 * Non-finite instants take the same conservative route — `false`, never a throw.
 */
export function isPastExpectedDischarge(admission: Admission, now: Instant): boolean {
  const expected = admission.expectedDischargeAt;
  if (expected === null || !Number.isFinite(expected) || !Number.isFinite(now)) return false;
  return now > expected;
}

/**
 * The LIVE admissions on a unit — everything except `"departed"`.
 *
 * Waitlisted and pulled admissions are included even though only the pulled one consumes a bed
 * (`bedIsOccupied` is what decides that, and is deliberately a separate question): a ward board
 * needs to see who is coming as well as who is here. Departed admissions are excluded because a
 * ward that never drops them fills up and stays full forever.
 */
export function admissionsForUnit(admissions: readonly Admission[], unitId: string): Admission[] {
  return admissions.filter((admission) => admission.unitId === unitId && admission.state !== "departed");
}
