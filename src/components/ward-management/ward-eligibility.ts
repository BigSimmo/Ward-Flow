import type { Instant } from "@/components/ward-management/ward-clock";
import {
  designationSummary,
  lockedBedsFree,
  openBedsFree,
  unitHasLockedBeds,
} from "@/components/ward-management/ward-bed-designation";
import type {
  LegalStatus,
  Movement,
  Referral,
  RecordedSex,
  ReferralGender,
  Sex,
  SexDesignation,
  Unit,
  WardAddressing,
  WardReferralDestination,
} from "@/components/ward-management/ward-model";
import type { OverrideReason } from "@/components/ward-management/ward-change-reasons";
import type { Patient } from "@/components/ward-management/ward-patients";
import type { GenderPlacement } from "@/components/ward-management/ward-model";

/**
 * ⚠️ **EVERY GATE NAME EITHER ELIGIBILITY FUNCTION CAN EMIT — the single source of truth, and it
 * exists because there wasn't one.**
 *
 * `GateResult.gate` was a bare `string` until 2026-09-02. Two things followed from that, and they
 * looked unrelated until they were traced:
 *
 *  - `GATE_LABELS` in `coordinator/shortlist-panel.tsx` was `Record<string, string>` with a
 *    `?? gate.gate` fallback, so it COULD NOT be exhaustive — there was no union to be exhaustive
 *    over. When `sex_designation` was added to the movement path, the coordinator's shortlist
 *    rendered the raw identifier `sex_designation` where every other row carries a sentence.
 *  - `tests/ui-ward-coordinator.spec.ts` hand-counted the gate rows in five places, because there
 *    was no list to take a length from.
 *
 * **A hand-listed label map with a silent fallback and a hand-written count beside a growing list
 * are the same defect**, and both are now derived from this array. Add a gate here and the label
 * map fails to compile until it is labelled; the spec's counts follow automatically.
 *
 * ⚠️ **Not every gate is emitted by both functions**, and that is deliberate rather than an
 * oversight to tidy: `age` and `legal_status` are referral-path questions, and the movement path
 * answers them earlier. **This array is the union of what CAN be emitted, never an assertion that
 * both paths emit all of it.** The two paths diverging is exactly how the `sex_designation` defect
 * happened, and that divergence is measured in `tests/ward-eligibility.test.ts`, not asserted here.
 */
export const ELIGIBILITY_GATES = [
  "acuity",
  "age",
  "allocatable_bed",
  "authorisation",
  "capacity_freshness",
  "cohort",
  "forensic",
  "legal_status",
  "prior_decline",
  "security",
  // 🔴 RENAMED FROM `sex_designation`, T10 (item 8, owner answer 17 September 2026, "gender at
  // referral decides the incoming bed check"). Still the ward's own designation constraint, and
  // still shared by both paths below — only the FACT it is checked against changed, from
  // `movement.sex`/`ward.sex` to the gender recorded AT REFERRAL. Never overridable — see
  // `SUITABILITY_GATES` in `ward-flow-reducer.ts`, which is typed so this gate cannot be a member.
  "gender_designation",
  "sex_mix",
  "specialling",
] as const;

/** One gate's name. Derived from `ELIGIBILITY_GATES` so the two can never disagree. */
export type EligibilityGate = (typeof ELIGIBILITY_GATES)[number];

export type GateResult = { gate: EligibilityGate; pass: boolean; detail: string };
export type EligibilityVerdict = { eligible: boolean; gates: GateResult[] };

/**
 * The ward addressings of a referral, narrowed so their bed criteria are reachable.
 *
 * A TYPE PREDICATE inside the filter rather than a cast at each call site: `as WardAddressing`
 * would compile just as well and would go on compiling the day a referral is addressed only to a
 * community team, at which point the bed gates would answer a question nobody asked.
 */
export function wardAddressings(referral: Referral): WardAddressing[] {
  return referral.destinations.filter(
    (addressing): addressing is WardAddressing => addressing.destination.kind === "psychiatric_ward",
  );
}

/** The single ward addressing, or `undefined`. A referral may hold at most one — `RECEIVE_REFERRAL`
 *  refuses two destinations of the same kind, since asking one kind twice is asking twice. */
export function wardAddressing(referral: Referral): WardAddressing | undefined {
  return wardAddressings(referral)[0];
}

/**
 * Every status other than Voluntary carries a detention authority, so the receiving unit must
 * be authorised. This governs the DESTINATION only — detaining a referred patient in an
 * unauthorised emergency department is lawful and is the normal state while they wait.
 */
export function requiresAuthorisedDestination(status: LegalStatus | undefined) {
  return status !== "Voluntary";
}

function capacityIsFresh(unit: Unit, now: Instant) {
  return now - unit.allocatable.confirmedAt <= unit.allocatable.staleAfterMinutes;
}

/** "a unit" vs "an older adult unit" — the only two cohort/security values start with a
 * vowel or a consonant, so this is a plain vowel check rather than a lookup table. */
/**
 * Which `sexMix` bucket a person counts in (owner rulings 2026-09-25, and R7): their gender when it
 * is Female or Male; otherwise their recorded sex when that is Female or Male; otherwise NEITHER
 * bucket (`undefined`) - a person recorded as "Another term" or "Not recorded" with no female or
 * male gender is never guessed into one. The one rule for the bay-mix gate, the ward's occupant
 * counts on arrival and departure, and the counts derived from the beds.
 */
export function mixSexOf(gender: ReferralGender | undefined, sex: RecordedSex): Sex | undefined {
  if (gender === "Female" || gender === "Male") return gender;
  return sex === "Female" || sex === "Male" ? sex : undefined;
}

/** `mix` with one occupant added to or removed from `sex`'s bucket; unchanged for a person in
 *  neither bucket (`mixSexOf` returned `undefined`). Never below nought. */
export function adjustSexMix(mix: Record<Sex, number>, sex: Sex | undefined, delta: 1 | -1): Record<Sex, number> {
  if (sex === undefined) return mix;
  return { ...mix, [sex]: Math.max(0, (mix[sex] ?? 0) + delta) };
}

/**
 * The sex-mix gate's flag when the check could not follow a female or male gender (owner rulings
 * 2026-09-25, R7): non-binary, a different term, or no gender identity recorded. Empty otherwise.
 * The coordinator's review itself is enforced by the placement record (`genderReviewNeeded`,
 * `ward-model.ts`); this only says how the count was read.
 */
export function mixSexFlag(gender: ReferralGender | undefined, sex: RecordedSex): string {
  if (gender === "Female" || gender === "Male") return "";
  const why =
    gender === undefined
      ? "gender identity not recorded"
      : gender === "Non-binary"
        ? "non-binary"
        : "gender recorded as a different term";
  if (sex === "Female" || sex === "Male") {
    return ` (${why}: checked against recorded sex, ${sex.toLowerCase()}; coordinator to review)`;
  }
  return ` (${why}; sex ${sex.toLowerCase()}: no female or male count applies; coordinator to review)`;
}

function article(word: string) {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

/**
 * Ready (ruling R-B-09): the beds a coordinator can place someone in right now, `min(allocatable,
 * empty)`. ONE home in this file for both matching paths, so `eligibility()`'s `sex_mix` gate and
 * everything `referralEligibility()` reads can never compute it differently. See the D15 comment in
 * `referralEligibility` for why it is computed from the unit's own two figures and never via
 * `capacityBreakdown`.
 */
function readyBedsNow(unit: Unit): number {
  const availableNow = Math.min(unit.allocatable.value, unit.empty.value);
  return availableNow;
}

export function eligibility(movement: Movement, unit: Unit, now: Instant): EligibilityVerdict {
  const authorisationNeeded = requiresAuthorisedDestination(movement.legalStatus);
  const declined = movement.declines.some((decline) => decline.unitId === unit.id);
  const fresh = capacityIsFresh(unit, now);
  // Owner rulings 2026-09-25: the bay-mix count follows gender. A non-binary patient, or one with
  // no gender identity recorded, is checked against recorded sex and flagged for the coordinator.
  const mixSex = mixSexOf(movement.gender, movement.sex);
  const sameSexOccupants = mixSex === undefined ? 0 : (unit.sexMix[mixSex] ?? 0);
  const mixFlag = mixSexFlag(movement.gender, movement.sex);
  const genderDesignation = genderDesignationResult(movement.gender, unit, movement.genderPlacements);
  // The free-bed measure the `sex_mix` gate below reads, the same `readyBedsNow` the referral path
  // reads. Only `sex_mix` reads it: `allocatable_bed` on this path still passes on raw
  // `allocatable`, deliberately (see the `security` gate's comment).
  const availableNow = readyBedsNow(unit);

  const gates: GateResult[] = [
    {
      gate: "authorisation",
      pass: !authorisationNeeded || unit.authorised,
      detail: authorisationNeeded
        ? unit.authorised
          ? "Marked able to receive an involuntary admission (demo)"
          : `${unit.name} is not set up for involuntary admissions (demo capability)`
        : "Voluntary admission needs no authorisation",
    },
    {
      gate: "cohort",
      pass: unit.cohort === movement.cohort,
      detail:
        unit.cohort === movement.cohort
          ? `${unit.cohort} unit matches ${article(movement.cohort)} ${movement.cohort.toLowerCase()} movement`
          : `${unit.cohort} unit does not match ${article(movement.cohort)} ${movement.cohort.toLowerCase()} movement`,
    },
    {
      gate: "security",
      /*
       * ⚠️ WAS `movement.security === "Open" || unit.security === "Secure"` UNTIL 2026-09-04.
       * That asked "is this ward of the right TYPE", and a mixed locked/open ward has no single
       * type — so a mixed ward recorded as Open hid every one of its locked beds from every
       * patient who needed one. `unitHasLockedBeds` replaces the whole-ward flag and fixes exactly
       * that, changing nothing else about the shape of the test.
       *
       * 🔴 THIS GATE ASKS ABOUT KIND, NEVER ABOUT CAPACITY, AND THE FIRST VERSION GOT THAT WRONG.
       * It read `movement.security === "Open" ? unit.allocatable.value > 0 : lockedBedsFree(unit) > 0`
       * — a freeness test inside a suitability gate. That duplicated `allocatable_bed` and broke
       * the leniency it deliberately carries: the movement path passes on raw `allocatable`, the
       * referral path on `min(allocatable, empty)`, and the guard that makes either safe is
       * `PATIENT_ARRIVED` refusing when `empty.value <= 0`, three events downstream in a different
       * case block. The symptom was the last-bed reducer test: a second acceptance failed HERE, on
       * capacity, instead of reaching the pull guard that answers `bed_pulled_for_earlier_referral`.
       * Two other sessions warned about precisely this before it was written.
       *
       * An Open movement passes wherever the ward has beds at all — a voluntary patient may be
       * nursed in a locked bed, so no kind of ward is unsuitable on this axis.
       *
       * ⚠️ KNOWN RESIDUAL, deliberately not closed here: a Secure movement passes a mixed ward
       * whose locked beds are all occupied while its open beds are free. The old code could not
       * have this problem because a wholly-Secure ward's free beds were necessarily locked ones.
       * Closing it means teaching the CAPACITY gates about bed kind, which is a change to a
       * protected surface and belongs to the matcher, not to this one. The detail sentence below
       * states the real locked-bed figures so the gap is visible to a coordinator rather than
       * silent. (Plan author's reasoning, 2026-09-04 — not an owner ruling.)
       */
      pass: movement.security === "Open" || unitHasLockedBeds(unit),
      detail: securityGateDetail(movement, unit),
    },
    {
      // 🔴 RENAMED FROM `sex_designation`, T10 (item 8): the ward's own designation, checked
      // against the GENDER RECORDED AT REFERRAL (`movement.gender`) rather than `movement.sex` —
      // see `genderDesignationResult`'s own doc comment below for the full rule, including the
      // "not yet recorded" branch (WLQ-35 shape) and why this never reads `sex` as a fallback.
      //
      // `sex_mix` below is NOT this rule: it asks whether mixing is acceptable given who is ALREADY
      // on the ward. Since the owner rulings of 25 September 2026 (and R7) it counts by gender, then
      // recorded sex, then neither (`mixSexOf`); it no longer reads raw `sex`. Designation is a
      // property of the BED; mix is a property of its occupants. Both must hold, so both are gates.
      //
      // Shares `genderDesignationResult` with the referral path rather than restating the rule —
      // a second implementation is how the two paths would drift apart again.
      gate: "gender_designation",
      pass: genderDesignation.pass,
      detail: genderDesignation.detail,
    },
    {
      // D7, mirrored from `referralEligibility` below: a forensic bed is never offered as a
      // destination, unconditionally, regardless of which door the request came through. This
      // gate was previously absent from this function even though `unit.forensic` is the same
      // property on the same `Unit` both paths receive — nothing about a movement withholds this
      // fact, so there was no reason it could not be checked here too. Its absence let the
      // network's forensic bed (`brm-adult-secure`) show `eligible: true` on the movement path
      // for 18 of the 35 seeded Adult movements, while the referral path refused that same bed
      // outright for the same unit at the same instant.
      //
      // Placed immediately after `sex_designation`, mirroring `referralEligibility`'s order:
      // both gates test a fixed property of the BED itself, decided before the gates below that
      // test whether this particular movement's needs (security, sex mix, specialling) fit this
      // particular bed right now. Detail wording is identical to the referral gate's — this is
      // not a variant, it is the same rule read by both screens.
      gate: "forensic",
      pass: !unit.forensic,
      detail: unit.forensic
        ? `${unit.name} is a forensic ward and is never offered as a destination`
        : `${unit.name} is not a forensic ward`,
    },
    {
      // Fix 2 (26 September 2026): `availableNow`, not `unit.allocatable.value` alone, so the
      // movement path asks the referral path's question. A ward that confirmed 3 allocatable beds
      // and then took two arrivals has `allocatable: 3, empty: 1`; reading `allocatable` passed
      // this gate with one free bed, the lone-patient case the gate exists to prevent.
      gate: "sex_mix",
      pass: sameSexOccupants > 0 || availableNow > 1,
      detail:
        (mixSex !== undefined && sameSexOccupants > 0
          ? `${sameSexOccupants} ${mixSex.toLowerCase()} occupants already`
          : "No same-sex occupants; needs more than one free bed") + mixFlag,
    },
    {
      /*
       * **Owner ruling, 2026-09-10: build acuity as drawn — a STAFFING-CAPACITY check, never a
       * ranking.** It does not order one patient ahead of another and it does not score anybody.
       * It asks one question: is this ward staffed for a high-acuity place at all.
       *
       * ⚠️ **AND IT DELIBERATELY DOES NOT SAY HOW MANY ARE LEFT, THOUGH THE DRAWING DOES.**
       * `command-third-edition.html` prints "N of M high-acuity places in use" beside this gate,
       * and reproducing that here would re-commit the closed specialling defect one file below:
       * `unit.highAcuityCapacity` is the AUTHORED total and is never decremented, `eligibility()`
       * is given no admissions, so any subtraction written here would claim headroom that may not
       * exist — the direction that sends a patient to a ward which must then refuse them.
       * `remainingHighAcuityCapacity(unit, admissions)` knows the answer and `PULL_PATIENT` asks
       * it. **Two checks that can disagree is worse than one honest sentence.**
       */
      gate: "acuity",
      pass: true,
      detail: !movement.highAcuity
        ? "No high-acuity nursing requested for this movement"
        : unit.highAcuityCapacity > 0
          ? `High-acuity nursing requested; ward is staffed for ${unit.highAcuityCapacity} high-acuity ${unit.highAcuityCapacity === 1 ? "place" : "places"}. Whether one can take this patient is checked when the bed is pulled.`
          : "High-acuity nursing requested; ward high-acuity capacity currently reached — additional shift staffing required upon admission",
    },
    {
      gate: "specialling",
      pass: true,
      /*
       * ⚠️ **THIS SAID "N specialling slots available" AND IT COULD NOT KNOW THAT.**
       * `unit.speciallingCapacity` is the ward's AUTHORED total — how many one-to-one patients it
       * is staffed to hold at once — and it is never decremented; `remainingSpeciallingCapacity`
       * derives what is LEFT, from the beds. A ward authored for 2 with both in use therefore
       * passed this gate and told a coordinator two slots were available, and `PULL_PATIENT` then
       * refused the placement outright (see that refusal's own comment: the gate "could say whether
       * a ward had ANY capacity and never whether it had any LEFT").
       *
       * **The screen invited the placement the engine rejects** — the same direction
       * `capacity-screen.tsx` names and deliberately avoids one file away, where `speciallingFree`
       * prints words rather than a fabricated number because the invented value "would claim
       * headroom that does not exist, which is the direction that sends a patient to a ward that
       * must refuse them".
       *
       * ⚠️ **THE FIX IS THE SENTENCE, NOT THE SIGNATURE.** `eligibility()` takes no
       * admissions list, which is exactly why it could not know — and widening it to make the old
       * wording true would move a real clinical check into a screen helper while the reducer still
       * holds the one that actually refuses. **Two checks that can disagree is worse than one honest
       * sentence.** So this says what the function can see: the staffed total, and where the free
       * count is decided.
       *
       * ⚠️ **AND THE GUARD LOOKED WHERE THE DEFECT WAS NOT.**
       * `ward-screen-eligibility-warning.dom.test.tsx` pinned the ZERO case, where "0 slots
       * available" is harmless because the gate fails anyway. Nothing pinned an authored ward with
       * every slot in use. `tests/ward-specialling-detail-claims-no-headroom.test.ts` now does, and
       * pins the absence of an availability claim rather than one exact phrase — a reword that
       * re-introduces the promise has to defeat the word, not just differ from the string.
       */
      detail: !movement.specialling
        ? "No specialling required"
        : unit.speciallingCapacity > 0
          ? `Staffed for ${unit.speciallingCapacity} one-to-one — current use is checked at placement`
          : "Specialling (one-to-one nursing) requested; ward specialling capacity currently reached — additional shift staffing required upon admission",
    },
    {
      gate: "prior_decline",
      pass: !declined,
      detail: declined ? "Already declined this movement" : "No prior decline",
    },
    {
      gate: "capacity_freshness",
      pass: fresh,
      detail: fresh
        ? `Confirmed ${now - unit.allocatable.confirmedAt} min ago`
        : `Last confirmed ${now - unit.allocatable.confirmedAt} min ago — stale`,
    },
    {
      /*
       * ⚠️ **THE LENIENT FIGURE, AND WHAT MAKES THAT SAFE IS NOT IN THIS FILE.** This passes on
       * `allocatable` alone, so a ward with three allocatable and no empty bed is eligible here —
       * and `PULL_PATIENT` bounds the same lenient figure, so the pull succeeds too. **Neither is
       * the guard.** The guard is `PATIENT_ARRIVED` in `ward-flow-reducer.ts`, which refuses on
       * `unit.empty.value <= 0` with `(no_bed)`, pinned by *"refuses an arrival once the unit's
       * physically empty beds are exhausted"* in `tests/ward-flow-reducer.test.ts`.
       *
       * **A pull is a reservation; an arrival is the physical act.** The leniency is what lets a
       * ward accept in principle today and receive tomorrow, which is the whole of the
       * `accepted_awaiting_bed` stage.
       *
       * ⚠️ **THE EDIT THAT BREAKS IT LOOKS LIKE A STRENGTHENING.** Hoisting the empty check here
       * "for symmetry" with `referralEligibility`'s gate of the same name would read as tightening
       * a loose rule and would delete accept-in-principle. If that looks right to you, go and read
       * the guard named above first — it is the reason this line is allowed to be lenient.
       */
      gate: "allocatable_bed",
      pass: unit.allocatable.value > 0,
      detail: `${unit.allocatable.value} allocatable`,
    },
  ];

  return { eligible: gates.every((gate) => gate.pass), gates };
}

/**
 * The sentence beside the `security` gate's verdict, on either path — shared by `eligibility()`'s
 * `securityGateDetail` wrapper below and `referralEligibility()`'s own gate further down, because
 * DECIDED (plan Global Constraints): the bed-kind rule is IDENTICAL on both paths, and a second
 * hand-written copy of this wording is exactly how the two would drift apart again.
 *
 * Always names the real figures, because a coordinator reading "does not meet the requirement"
 * needs to know whether the ward has no locked beds at all or simply none free right now — they
 * are different problems with different next actions (look elsewhere, versus wait or ask).
 */
function bedKindGateDetail(needsSecureBed: boolean, unit: Unit): string {
  const free = lockedBedsFree(unit);
  if (needsSecureBed) {
    if (free > 0) {
      return `${unit.name} has ${free} locked bed${free === 1 ? "" : "s"} free (${designationSummary(unit)})`;
    }
    return unitHasLockedBeds(unit)
      ? `${unit.name} has locked beds but no locked bed is free (${designationSummary(unit)})`
      : `${unit.name} has no locked beds (${designationSummary(unit)})`;
  }
  if (unit.allocatable.value <= 0) return `${unit.name} has no free bed`;
  return openBedsFree(unit) > 0
    ? `${unit.name} has ${openBedsFree(unit)} open bed${openBedsFree(unit) === 1 ? "" : "s"} free`
    : `${unit.name} has only locked beds free — open admission is possible but not usual`;
}

/** `eligibility()`'s `security` gate detail — see `bedKindGateDetail` above for the shared rule. */
function securityGateDetail(movement: Movement, unit: Unit): string {
  return bedKindGateDetail(movement.security === "Secure", unit);
}

/**
 * Whether `designation` may hold a person of `sex` — a CONSTRAINT on the bed, never an equality
 * check against the referral's sex (see `SexDesignation`'s own doc comment on `ward-model.ts`).
 * `"Undesignated"` — the seeded majority — accepts either sex; `"Female only"`/`"Male only"`
 * narrow acceptance to the one sex they name. Isolated as its own function (rather than inlined
 * into the gates that use it) so the accepts-shape is visible on its own, independent of any
 * gate's pass/detail plumbing.
 *
 * 🔴 **CORRECTED 2026-09-17, T10 — "READ BY BOTH PATHS' `sex_designation` GATE" IS NOW FALSE.**
 * Struck in place rather than deleted, because the reading that made it true is what a reader
 * will otherwise re-derive. Until this date `eligibility()` and `referralEligibility()` both read
 * this function for their designation gate; item 8 (owner answer, 17 September 2026) moved that
 * gate onto the gender recorded AT REFERRAL, and `genderDesignationResult` below now answers it
 * for both paths instead. This function's two remaining callers are `genderEligibility` further
 * down (the still-unwired, `Patient.gender`-based gate, which is a genuinely two-value SEX-shaped
 * question) and `bedAcceptsSex` (`ward-board-derivations.ts`), exported for exactly that caller —
 * a pure "how many beds accept a man" board figure that is deliberately still about sex, per
 * build plan §1 item 8's target: "The bay-mix check (sex_mix) waits and still reads sex — stated,
 * not hidden."
 */
export function sexDesignationAccepts(designation: SexDesignation, sex: Sex): boolean {
  if (designation === "Undesignated") return true;
  return designation === "Female only" ? sex === "Female" : sex === "Male";
}

/**
 * 🔴 **THE `gender_designation` GATE'S SHARED RULE — T10 (item 8, owner answer, 17 September
 * 2026), replacing the `sex_designation` gate both paths used to share via `sexDesignationAccepts`
 * immediately above.**
 *
 * Declared once and used by both `eligibility()` and `referralEligibility()`, the same discipline
 * `bedKindGateDetail` already holds to for the `security` gate — a second hand-written copy is
 * exactly how the two paths would drift apart again.
 *
 * Reads the gender RECORDED AT REFERRAL (`Movement.gender` / `WardReferralDestination.gender`) —
 * **never `sex`, and never `Patient.gender`.** See `ReferralGender`'s own doc comment
 * (`ward-model.ts`) for why a `gender ?? (sex as ReferralGender)` fallback must never be
 * reintroduced here.
 *
 * "Not yet recorded" (`gender` absent) follows the identical WLQ-35 shape `genderEligibility`
 * below already follows for the separate, still-unwired patient-profile gate: an Undesignated
 * ward has nobody to be gendered against, so an unrecorded gender is offered there; a
 * single-gender ward cannot answer and is refused, with a detail that says the gate cannot
 * answer rather than implying a judgement was made and failed.
 *
 * **NO OVERRIDE PATH**, structurally rather than by convention — `SUITABILITY_GATES`
 * (`ward-flow-reducer.ts`) is typed so `"gender_designation"` cannot be a member, and
 * `eligibilityRefusal` checks this gate before it even reads an event's `overrideReason`. Never
 * simplify that back into the ordinary suitability flow.
 */
function genderDesignationResult(
  gender: ReferralGender | undefined,
  unit: Unit,
  genderPlacements?: GenderPlacement[],
): { pass: boolean; detail: string } {
  if (unit.sexDesignation === "Undesignated") {
    return { pass: true, detail: `${unit.name} takes any gender` };
  }
  /*
   * 🔴 R7 (owner ruling, 25 September 2026) REPLACES the old "not yet recorded" refusal ("Record
   * gender first", WLQ-35): a gender that is not female or male - including not recorded - is no
   * longer a dead end at a single-sex ward. It is handled exactly as `"Non-binary"` already was
   * below: the ward passes only once a coordinator's recorded, ward-checked review names it.
   */
  const binaryGender = gender === "Female" || gender === "Male" ? gender : undefined;
  const accepts =
    binaryGender !== undefined &&
    (unit.sexDesignation === "Female only" ? binaryGender === "Female" : binaryGender === "Male");
  if (accepts) {
    return {
      pass: true,
      detail: `${unit.name} is ${unit.sexDesignation.toLowerCase()} and suits this patient`,
    };
  }
  /*
   * 🔴 OWNER REVERSAL, item 2, 17 September 2026: *"No. they actually can. make smallest possible
   * fix to enable this."* A `Non-binary` patient CAN be placed on a single-gender ward once a
   * coordinator has recorded a `GenderPlacement` for THIS unit (`GENDER_PLACEMENT_REASONS`,
   * `wardChecked: true`) — the same procedural record `GENDER_PLACEMENT_REFUSAL` already requires
   * at an Undesignated ward, now also read here as what unlocks a designated one.
   *
   * ⚠️ SCOPED TO A GENDER THAT IS NOT FEMALE OR MALE (R7 above): non-binary, a different term, or
   * not recorded — `binaryGender === undefined`. A binary gender that mismatches the ward (a
   * `"Male"` movement at a Female-only ward) still refuses above with no way past — `binaryGender`
   * is set, so this branch never runs for it.
   */
  const genderPlacementCoversUnit =
    binaryGender === undefined && (genderPlacements ?? []).some((record) => record.unitIds.includes(unit.id));
  if (genderPlacementCoversUnit) {
    return {
      pass: true,
      detail: `${unit.name} is ${unit.sexDesignation.toLowerCase()}; placed after a coordinator's recorded, ward-checked reason`,
    };
  }
  if (binaryGender === undefined) {
    return {
      pass: false,
      detail: `Gender is not recorded as female or male, so ${unit.name} (${unit.sexDesignation.toLowerCase()}) needs a coordinator's recorded review before it can be offered.`,
    };
  }
  return {
    pass: false,
    detail: `${unit.name} is ${unit.sexDesignation.toLowerCase()} and does not suit this patient`,
  };
}

/**
 * Opus review round 2, 17 September 2026 (P2), privacy: plan §2's exact sentence for the
 * `gender_designation` gate's FAILING case on a ward or ED screen — never
 * `genderDesignationResult`'s own `detail` immediately above, which names "female only"/"male
 * only" or says "Record gender first", either of which invites the reader to compare against a
 * displayed `sex` and notice they differ. The coordinator's own console keeps the real `detail`;
 * this constant and `wardFacingGateDetail` below are for the two screens the plan actually names.
 */
export const GENDER_DESIGNATION_PRIVACY_SENTENCE = "This ward's bed designation does not suit this patient.";

/**
 * The PASSING half of the same substitution, alongside the failing sentence above. `"takes any
 * gender"` (the Undesignated-ward pass wording immediately above) says the very word this
 * screen must never show, so a passing `gender_designation` gate needs a substitute exactly as
 * much as a failing one — never left as `gate.detail` on the reasoning that a pass has nothing to
 * hide.
 */
const GENDER_DESIGNATION_PASS_SENTENCE = "This ward's bed designation suits this patient.";

/**
 * The single place a ward or ED screen turns a `GateResult` into displayable text — used by
 * `eligibilityWarning` (`ward-derivations.ts`) and by `ward-screen.tsx`'s own "This ward's own
 * gates" section, so the substitution rule lives in exactly one function rather than being
 * re-implemented at each call site and drifting. Every gate but `gender_designation` passes its
 * own `detail` through unchanged; that one gate never reaches the screen in its own words at all,
 * pass or fail.
 */
export function wardFacingGateDetail(gate: GateResult): string {
  if (gate.gate !== "gender_designation") return gate.detail;
  return gate.pass ? GENDER_DESIGNATION_PASS_SENTENCE : GENDER_DESIGNATION_PRIVACY_SENTENCE;
}

/**
 * Phase 7 (spec "The front door", D9): the referral-side counterpart of `eligibility()`, for a
 * `Referral` (Task 1, `ward-model.ts`) rather than a `Movement`. Returns the exact same
 * `EligibilityVerdict`/`GateResult[]` shape, so the "why not here?" artefact — every unit, and
 * for each gate a human-readable reason — comes out for free rather than being built twice.
 *
 * Every gate below is an ACCEPTS-rule — "does this bed accept this referral" — never "does this
 * bed's value equal the referral's". `age` happens to be a plain equality and is still written
 * in the same accepts-shape as the other three, so a future change (an adult unit that will also
 * take a 17-year-old) lands in one place rather than needing a special case.
 *
 * `security`, `sex_mix` and `specialling` reuse `eligibility()`'s logic unchanged, mapped onto the
 * referral fields that carry the same fact (`mixSexOf(ward.gender, ward.sex)` for `sex_mix`, which
 * both paths gate on `availableNow`; `ward.secureBedNeeded` for `security`). `capacity_freshness` also reuses `eligibility()`'s logic unchanged. `allocatable_bed`
 * DIFFERS from `eligibility()`'s gate of the same name: it gates on `availableNow` —
 * `Math.min(unit.allocatable.value, unit.empty.value)` — never `unit.allocatable.value` alone,
 * because the two are only documented to agree "in practice" and are not enforced to (see
 * `availableNow`'s own comment below). `capacity_freshness` and `allocatable_bed` still read only
 * `unit.allocatable` and `unit.empty` — the ward's own confirmed figures — and nothing in this
 * function ever reads a `BedRelease`, a release state, a band or a confidence level; that is what
 * keeps referral matching independent of the bed-release model, which no ward clinician
 * has yet validated (spec D15).
 *
 * **Takes a `WardReferral`, not a `Referral`, and that is the point of the destination union.**
 * Every gate here reads a property of a BED -- capacity, sex mix, security, authorisation -- so the
 * question this function answers has no meaning for an ED, a medical ward or a community team. It
 * is not that calling it with one of those would give a wrong answer; it is that the criteria do
 * not exist on those arms, so the call cannot be written. A caller holding a plain `Referral` must
 * narrow on `destination.kind` first, which is exactly the check that used to be a screen's job to
 * remember.
 */
export function referralEligibility(
  referral: Referral,
  ward: WardReferralDestination,
  unit: Unit,
  now: Instant,
): EligibilityVerdict {
  const fresh = capacityIsFresh(unit, now);
  // Owner ruling 2026-09-25, as in `eligibility()` above.
  const mixSex = mixSexOf(ward.gender, ward.sex);
  const sameSexOccupants = mixSex === undefined ? 0 : (unit.sexMix[mixSex] ?? 0);
  const mixFlag = mixSexFlag(ward.gender, ward.sex);
  const genderDesignation = genderDesignationResult(ward.gender, unit, referral.genderPlacements);
  // Same bed-kind rule as `eligibility()`'s `security` gate above, via the shared
  // `bedKindGateDetail`/this identical arithmetic — DECIDED (plan Global Constraints): bed kind
  // is a suitability question and does not change between "can this ward take them in principle"
  // and "can this person come now", so both paths ask it identically. `ward.secureBedNeeded` is
  // this path's counterpart of `movement.security === "Secure"`.
  const securityMet = ward.secureBedNeeded ? lockedBedsFree(unit) > 0 : unit.allocatable.value > 0;
  // See the `legal_status` gate's own comment below for why this is an accepts-rule, never an
  // equality: a referral that does not need an involuntary bed is accepted by ANY bed, including
  // an authorised one — `unit.authorised` is a capability a bed has, not a value to match against.
  const legalStatusMet = !ward.involuntaryBedNeeded || unit.authorised;
  // Spec D15 / plan Global Constraints: the bed the coordinator can actually place someone in
  // right now is `availableNow`, never `unit.allocatable.value` alone. The two are documented to
  // agree "in practice" on `Unit.allocatable`, but that is not enforced — `CONFIRM_CAPACITY` can
  // raise `allocatable.value` back above `empty.value` after arrivals have already consumed the
  // physically empty beds, and `PATIENT_ARRIVED` decrements `empty.value` while leaving
  // `allocatable.value` untouched. Computed by `readyBedsNow` from the unit's own two figures — never via
  // `capacityBreakdown` (`ward-bed-availability.ts`), which takes `BedRelease[]` and would couple
  // referral matching to the bed-release model no ward clinician has validated (see
  // this function's own doc comment above and the D15 contract test in
  // `ward-referral-matching.test.ts`).
  const availableNow = readyBedsNow(unit);

  const gates: GateResult[] = [
    {
      gate: "age",
      pass: unit.cohort === referral.ageBand,
      detail:
        unit.cohort === referral.ageBand
          ? `${unit.cohort} unit matches ${article(referral.ageBand)} ${referral.ageBand.toLowerCase()} referral`
          : `${unit.cohort} unit does not match ${article(referral.ageBand)} ${referral.ageBand.toLowerCase()} referral`,
    },
    {
      // D3 rule 2 / D5's fourth field: a referral that does NOT need an involuntary bed is
      // accepted by ANY bed; a referral that DOES need one is accepted only by a bed that can
      // hold someone involuntarily (`unit.authorised`). Written as an accepts-rule, never an
      // equality, for the same reason as `gender_designation` below — `unit.authorised ===
      // ward.involuntaryBedNeeded` would refuse an involuntary-bed referral from an
      // authorised unit whenever the referral itself happened not to need one, which is backwards:
      // an authorised unit's extra capability never disqualifies it. The detail describes the bed
      // or the requirement, never the person: it is not a legal determination about who was
      // referred, only whether this bed can hold someone involuntarily if the request calls for it.
      gate: "legal_status",
      pass: legalStatusMet,
      detail: ward.involuntaryBedNeeded
        ? legalStatusMet
          ? `${unit.name} is marked able to take involuntary admissions (demo capability)`
          : `${unit.name} is not set up for involuntary admissions (demo capability)`
        : "No authorised destination required",
    },
    {
      // 🔴 RENAMED FROM `sex_designation`, T10 (item 8): see `eligibility()`'s own gate of this
      // name above and `genderDesignationResult`'s doc comment below for the full rule.
      gate: "gender_designation",
      pass: genderDesignation.pass,
      detail: genderDesignation.detail,
    },
    {
      // D7: a forensic bed is described so the board can be honest about the network, and is
      // never offered — the gate fails for every referral, unconditionally, with a detail that
      // says so plainly rather than implying the person was assessed and found unsuitable.
      //
      // Task 8 finding C: this detail used to end "…is never offered through Phase 7 front-door
      // matching". "Phase 7" and "front-door matching" are this project's own build vocabulary
      // and mean nothing to a ward coordinator, who is the one reading it. A gate detail may say
      // only what is true of the BED, in words the reader already has.
      //
      // "as a destination", not "for a referral": this file's own `legal_status` gate already
      // uses "destination" for a bed being placed into, and the word "referral" here would put
      // the sentence's object back on the request — which the guard in
      // `tests/ward-referral-matching.test.ts` ("the forensic gate's detail names the bed and
      // never judges the person") refuses, correctly. That guard was left exactly as it was.
      gate: "forensic",
      pass: !unit.forensic,
      detail: unit.forensic
        ? `${unit.name} is a forensic ward and is never offered as a destination`
        : `${unit.name} is not a forensic ward`,
    },
    {
      gate: "security",
      pass: securityMet,
      detail: bedKindGateDetail(ward.secureBedNeeded, unit),
    },
    {
      // `availableNow`, not `unit.allocatable.value` alone — the same C2 correction fix round B
      // made to `allocatable_bed`, applied here where it was left behind (fix round C, F3 /
      // review finding I4). This gate's own detail already SAYS "needs more than one free bed",
      // and a free bed is `availableNow`: a ward that confirmed 3 allocatable beds and then took
      // two arrivals has `allocatable: 3, empty: 1`, so reading `allocatable` alone passed this
      // gate on a ward with exactly one free bed — placing a lone woman on a ward with no other
      // free bed, the precise outcome this gate exists to prevent, while the capacity board read
      // `availableNow` and correctly said 1. No new rule: this makes the code do what its own
      // user-visible sentence already promised.
      gate: "sex_mix",
      pass: sameSexOccupants > 0 || availableNow > 1,
      detail:
        (mixSex !== undefined && sameSexOccupants > 0
          ? `${sameSexOccupants} ${mixSex.toLowerCase()} occupants already`
          : "No same-sex occupants; needs more than one free bed") + mixFlag,
    },
    {
      // A referral carries no specialling-need fact — unlike `Movement.specialling`, Task 1
      // fixed the referral's permitted-field list at three facts about the person and none of
      // them expresses this. Kept as its own gate (rather than dropped) so a coordinator reading
      // every gate on the referral's match view learns what the system does and does not know
      // about a referral, the same reason every gate is listed rather than only the failing ones.
      // The detail must describe the RECORD, never assert a fact about the person: "No
      // specialling required" would tell a coordinator something was checked and found absent,
      // when nothing was checked — nobody entered this fact and the record does not hold it. If a
      // future referral field ever carries this need, only this gate changes.
      gate: "specialling",
      pass: true,
      detail: "Specialling need is not recorded on a referral",
    },
    {
      /*
       * ⚠️ **THE SPECIALLING GATE DIRECTLY ABOVE CANNOT ANSWER AND SAYS SO. THIS ONE CAN.**
       * That comment ends "if a future referral field ever carries this need, only this gate
       * changes" — and for ACUITY the owner created exactly that field on 2026-09-10: the
       * REFERRING CLINICIAN marks high-acuity need at referral. So this gate makes a real check on
       * the referral path where its neighbour can only describe the absence of a record.
       *
       * **They are not inconsistent and neither should be made to match the other.** One reports
       * that nothing was recorded; this one reports what was.
       */
      gate: "acuity",
      pass: true,
      detail: !ward.highAcuityNursingNeeded
        ? "No high-acuity nursing requested on this referral"
        : unit.highAcuityCapacity > 0
          ? `High-acuity nursing requested; ward is staffed for ${unit.highAcuityCapacity} high-acuity ${unit.highAcuityCapacity === 1 ? "place" : "places"}. Whether one can take this patient is checked when the bed is pulled.`
          : "High-acuity nursing requested; ward high-acuity capacity currently reached — additional shift staffing required upon admission",
    },
    {
      gate: "capacity_freshness",
      pass: fresh,
      detail: fresh
        ? `Confirmed ${now - unit.allocatable.confirmedAt} min ago`
        : `Last confirmed ${now - unit.allocatable.confirmedAt} min ago — stale`,
    },
    {
      // `availableNow`, not `unit.allocatable.value` alone — see the comment on `availableNow`'s
      // declaration above. The detail names both source figures so a coordinator (or a future
      // reader of this code) can see why they can diverge, without reading anything but the
      // unit's own two confirmed numbers.
      //
      // ⚠️ **THE MOVEMENT PATH'S GATE OF THIS NAME IS DELIBERATELY LOOSER, AND IT IS NOT A DRIFT.**
      // `eligibility()` above passes on `allocatable` alone because a movement is asking whether
      // the ward can accept in principle; a referral is asking whether this person can come now.
      // The safety of that looser gate rests on `PATIENT_ARRIVED` in `ward-flow-reducer.ts` — read
      // the comment at its site before assuming either gate is wrong.
      //
      // **One name, two pass conditions, on purpose.** Nobody had noticed until a 2026-09-04
      // census; the risk is the shared NAME inviting the assumption that they are one test.
      gate: "allocatable_bed",
      pass: availableNow > 0,
      // "ready" for the min, per the owner's 2026-09-04 one-word ruling. The two figures in
      // parentheses keep their own field names — they are DIFFERENT quantities and relabelling
      // either would put one number's name on another.
      detail: `${availableNow} ready (${unit.allocatable.value} allocatable, ${unit.empty.value} empty)`,
    },
  ];

  return { eligible: gates.every((gate) => gate.pass), gates };
}

/**
 * A binary, non-ordinal description of a verdict: eligible, or the specific gate that failed.
 * Eligibility gates are not commensurable (failing `authorisation` is a legal hard stop;
 * failing `capacity_freshness` is a staleness warning), so this deliberately never collapses
 * them into a "N of M passed" fraction — that shape reads as a score, and higher/lower
 * comparisons across two verdicts are not meaningful.
 *
 * Fix round C (F1, review finding C1): this lives HERE rather than in `ward-derivations.ts`,
 * where it was originally written, and `ward-derivations.ts` re-exports it so its six existing
 * call sites are untouched. It depends on nothing but `EligibilityVerdict`, which is declared in
 * this file. `ward-referrals.ts` reads it from here, and that is the whole point: taking it from
 * `ward-derivations.ts` instead pulled `ward-flow-reducer.ts`, `ward-flow-events.ts` and
 * `ward-movements.ts` into referral matching's transitive module graph, and all three name the
 * bed-release model at the top of the file — which turned the D15 contract test in
 * `tests/ward-referral-matching.test.ts` red (5 files and 0 offenders became 17 files and 4).
 * D15 is deliberately structural: no code path reachable from matching may read that model AT
 * ALL, not even one that happens to agree with `unit.allocatable` today.
 *
 * The prose above deliberately does not spell the release model's type name, and deliberately
 * does not put the word "import" beside it. That contract test splits a file on a crude
 * `/import\s+[\s\S]*?;/` before checking, so an explanatory comment CAN produce a false
 * positive — this one did, on its first draft. The guard is not the thing to relax.
 */
export function candidateReason(verdict: EligibilityVerdict) {
  if (verdict.eligible) return "Eligible now";
  const failed = verdict.gates.find((gate) => !gate.pass);
  return failed ? failed.detail : "Not eligible";
}

/**
 * 🔴 **THE GENDER GATE — owner ruling 2026-09-09/2026-09-10, closing P1 `#BAY1TY`.**
 *
 * His words: *"Have sex please and for gender use that as what bed. I.e. male bed for female bed
 * etc."* Then, asked the three points that were still open: *"Only two genders as it is for beds…
 * No... treat trans woman as a woman for gender… Clinician fills in gender if not already saved on
 * patient profile."*
 *
 * Reads `patient.gender` — never `patient.sex`, never a `Movement`'s or `Referral`'s `sex` — because
 * the whole defect this ruling closes is that correcting a DISPLAYED sex/gender value used to change
 * nothing about where a person was placed. `gender` is a separate, dedicated fact for exactly this
 * question.
 *
 * Result type is `{ gate: "gender"; … }`, structurally its OWN shape and deliberately NOT a member
 * of `EligibilityGate`/`ELIGIBILITY_GATES` — see "WHY THIS IS NOT WIRED INTO `eligibility()` /
 * `referralEligibility()`" below.
 *
 * THREE RULES, each pinned by `tests/ward-gender-gate.test.ts` and each a named refusal in the
 * brief that built this function — do not "simplify" any of them back together:
 *
 *  1. **Gender recorded → a real accepts/refuses check**, sharing `sexDesignationAccepts` with the
 *     two existing sex-based gates (the accepts-shape is identical; only the fact being matched
 *     differs), with a detail sentence that names GENDER, never sex.
 *  2. **Gender NOT recorded → depends on the ward, per owner ruling `WLQ-35`** (2026-09-15,
 *     `docs/ward-flow/owner-decisions-2026-09-15.md`): *"a person with no recorded gender may be
 *     placed on a ward that takes either gender, and is refused on a single-gender ward until
 *     gender is recorded."* At an Undesignated ward this now returns `pass: true` — nobody there
 *     is gendered against, so an unrecorded gender is not a reason to refuse it. At a Female-only
 *     or Male-only ward it still returns `pass: false`, and the detail still says the gate cannot
 *     answer — never "refused". A refusal implies a judgement was made and failed; here no
 *     judgement was possible. **This must never read `patient.sex` as a fallback.** Reintroducing
 *     `patient.gender ?? (patient.sex as Gender)` — or anything with the same effect — silently
 *     re-merges the two fields this ruling exists to keep apart, in the one case where the
 *     difference matters most, and nothing else would go red.
 *  3. **NO OVERRIDE PATH, structurally, not by convention.** `SUITABILITY_GATES` in
 *     `ward-flow-reducer.ts` is the list of nine gate names an `OVERRIDE_REASONS` entry can buy
 *     past — `sex_designation` and `sex_mix` are both members of it today. Folding gender-matching
 *     into either of those gates would silently inherit that bypass, which is exactly what the
 *     owner's ruling forbids: *"There is no override path on the gender gate."* This function is
 *     not a member of `EligibilityGate` at all, so it cannot be added to `SUITABILITY_GATES` by
 *     name and cannot be reached by `eligibilityRefusal`'s membership check — the strongest
 *     available guarantee, rather than a promise to remember not to add one. The optional third
 *     parameter below exists only so a caller reaching for the same override vocabulary used
 *     elsewhere gets the same refusal back, never a different one.
 *
 * ⚠️ **WHY THIS IS NOT WIRED INTO `eligibility()` / `referralEligibility()`, AND WHY THAT IS A
 * STOP-AND-HAND-BACK RATHER THAN A CHOICE.** Both functions take a `Movement` or a `Referral`, and
 * neither reliably resolves to a `Patient`: `Movement.referralId` is optional and absent on most of
 * the hand-authored fixture (`ward-movements.ts`), `Referral.patientId` is separately optional, and
 * where a movement or referral DOES carry a `sex`/`gender`-shaped value today it is an independent,
 * caller-supplied fact on that record (`RAISE_REFERRAL`/`RECEIVE_REFERRAL` write `sex` straight from
 * the event's own draft — never looked up from a linked patient). Wiring this gate into the live
 * verdict pipeline now would force one of two invented answers: fabricate a `gender` for every
 * existing movement/referral nobody actually recorded one for, or accept that most of the seeded
 * fixture newly fails to be placed anywhere — a sweeping behaviour change with no seed update
 * authorised for it. Deciding between those is a real decision with real consequences and is not
 * covered by the brief this function was built under. **Built here, correct and fully tested,
 * ready for whoever resolves the Movement/Referral → Patient link (the "use" gate the 2026-09-10
 * plan defers, distinct from this "model" gate) to call.**
 *
 * 🔴 **AND THIS FUNCTION IS STILL THAT UNWIRED "MODEL" GATE, EVEN AFTER T10.** T10 (item 8, owner
 * answer 17 September 2026, "gender at referral decides the incoming bed check") did NOT resolve
 * the Movement/Referral → Patient link this comment describes — it sidesteps it entirely, by
 * recording gender directly on the referral/movement (`Movement.gender` /
 * `WardReferralDestination.gender`, never looked up from `Patient.gender`) and gating on THAT via
 * `genderDesignationResult` above, now wired into both `eligibility()` and `referralEligibility()`
 * as the `gender_designation` gate. This function, reading `Patient.gender`, remains exactly as
 * unwired and exactly as correct as it was — a second, distinct gate for whoever eventually
 * resolves the patient link, not superseded by T10's work.
 */
export type GenderGateResult = { gate: "gender"; pass: boolean; detail: string };

export function genderEligibility(
  patient: Pick<Patient, "gender">,
  unit: Unit,
  /**
   * Deliberately inert — see rule 3 above. Accepted only so a caller who reaches for the same
   * `OVERRIDE_REASONS` vocabulary the nine `SUITABILITY_GATES` accept gets the same shape of
   * refusal back rather than a type error inviting a different workaround. Its value never appears
   * in `pass` or `detail`, and `tests/ward-gender-gate.test.ts` proves that over every member of
   * `OVERRIDE_REASONS`, not one of them.
   */
  _attemptedOverrideReason?: OverrideReason,
): GenderGateResult {
  // Read and discarded — the whole point. See the parameter's own doc comment: nothing below this
  // line may ever consult it, and `void` here is what lets the parameter exist without an
  // unused-variable warning inviting somebody to "clean up" the inert third argument into use.
  void _attemptedOverrideReason;
  if (patient.gender === undefined) {
    // WLQ-35 (owner ruling, 2026-09-15, docs/ward-flow/owner-decisions-2026-09-15.md): "a person
    // with no recorded gender may be placed on a ward that takes either gender, and is refused on
    // a single-gender ward until gender is recorded." An Undesignated ward has nobody to be
    // gendered against, so an unrecorded gender is not a reason to refuse it — this is a placement
    // the ward's own designation already permits, not a judgement about the patient's gender,
    // which the gate still has not determined.
    if (unit.sexDesignation === "Undesignated") {
      return {
        gate: "gender",
        pass: true,
        detail: `Gender is not yet recorded, but ${unit.name} is undesignated and takes either gender`,
      };
    }
    return {
      gate: "gender",
      pass: false,
      detail: `Gender is not yet recorded — this gate cannot determine whether ${unit.name} accepts this patient`,
    };
  }
  if (patient.gender !== "Female" && patient.gender !== "Male") {
    // R7 (25 September 2026): Non-binary or Different term. Same shape as "not yet recorded"
    // above: an undesignated ward takes either gender; a single-sex ward needs a coordinator.
    return unit.sexDesignation === "Undesignated"
      ? {
          gate: "gender",
          pass: true,
          detail: `Gender is not female or male, but ${unit.name} is undesignated and takes either gender`,
        }
      : {
          gate: "gender",
          pass: false,
          detail: `Gender is not female or male - this gate cannot determine whether ${unit.name} accepts this patient`,
        };
  }
  const accepts = sexDesignationAccepts(unit.sexDesignation, patient.gender);
  return {
    gate: "gender",
    pass: accepts,
    detail: accepts
      ? unit.sexDesignation === "Undesignated"
        ? `${unit.name} is undesignated and accepts either gender`
        : `${unit.name} is ${unit.sexDesignation.toLowerCase()} and accepts this patient's gender`
      : `${unit.name} is ${unit.sexDesignation.toLowerCase()} and does not accept this patient's gender`,
  };
}
