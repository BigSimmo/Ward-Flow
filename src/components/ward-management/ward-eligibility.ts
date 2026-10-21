import { boundedBedAvailability } from "@/components/ward-management/ward-ready-beds";
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
import { genderReviewNeeded, type GenderPlacement } from "@/components/ward-management/ward-model";

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

/**
 * `info` marks a gate that checks nothing and only records a staffing fact for the coordinator
 * (acuity and specialling). It always passes so it never stops a placement, and screens must show
 * it as information, never as a check that was met (review 18 Oct 2026, item 3). The real staffing
 * check is `PULL_PATIENT`'s, which can see the admissions.
 */
export type GateResult = { gate: EligibilityGate; pass: boolean; detail: string; info?: true };
export type EligibilityVerdict = { eligible: boolean; gates: GateResult[] };

/** How a screen marks one gate: met, not met, or information only (`GateResult.info`). */
export type GateMark = "met" | "not_met" | "info";

export function gateMark(gate: GateResult): GateMark {
  if (gate.info) return "info";
  return gate.pass ? "met" : "not_met";
}

/** The gates that actually check something. "N of M met" counts these and only these. */
export function checkedGates(gates: readonly GateResult[]): GateResult[] {
  return gates.filter((gate) => !gate.info);
}

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

/** First live ward request, or first recorded ward request when all have been answered.
 * Named ward recipients may coexist; recipient-specific decisions must select the exact unit. */
export function wardAddressing(referral: Referral): WardAddressing | undefined {
  return (
    wardAddressings(referral).find(
      (addressing) => addressing.state === "queued" && addressing.withdrawnAt === undefined,
    ) ?? wardAddressings(referral)[0]
  );
}

/**
 * THE ONE RULE for whether a person needs a bed that can hold someone involuntarily, from a
 * recorded legal status. Owner ruling D-69 (Josh, 20 Oct 2026, 2:02 PM AWST): "Needs an
 * involuntary-capable bed until status is set." Only a recorded "Voluntary" clears it; a blank,
 * "Not recorded" or any other status needs an involuntary-capable bed. Never default to Voluntary.
 * The referral drawer (`referrals/ward-referral-drawer-model.ts`) re-exports this function.
 */
export function involuntaryBedNeededForLegalStatus(legalStatus: string | null | undefined): boolean {
  return legalStatus?.trim() !== "Voluntary";
}

/**
 * Every status other than Voluntary carries a detention authority, so the receiving unit must
 * be authorised. This governs the DESTINATION only — detaining a referred patient in an
 * unauthorised emergency department is lawful and is the normal state while they wait.
 */
export function requiresAuthorisedDestination(status: LegalStatus | undefined) {
  return involuntaryBedNeededForLegalStatus(status);
}

/**
 * Whether accepting this ward request needs an involuntary-capable bed (audit F-03, follow-up to
 * PR #475). Re-derived from the referral's CURRENT recorded legal status through the one rule
 * above, so acceptance never trusts a stored `involuntaryBedNeeded: false` that the legal status
 * does not support. The stored answer can only add the need, never clear it.
 *
 * Audit 2 E-04 (Josh, 20 Oct 2026): a referral with no intake (seeded or older records) has no
 * recorded legal status, and an unknown status fails safe the same way `involuntaryBedNeededForLegalStatus`
 * does: it needs an authorised bed. A person can still accept elsewhere with a recorded reason.
 */
export function wardRequestNeedsInvoluntaryBed(
  referral: Pick<Referral, "intake">,
  ward: Pick<WardReferralDestination, "involuntaryBedNeeded">,
): boolean {
  return ward.involuntaryBedNeeded || involuntaryBedNeededForLegalStatus(referral.intake?.legalStatus);
}

/**
 * Owner ruling (Josh, 20 Oct 2026): when an accepted ward's recorded involuntary-bed need does
 * not match the legal status chosen at Start placement, warn the clinician but let the send go
 * through. Both values stay on the record (the referral's arm and the movement's legal status).
 */
export function legalStatusMismatchWarning(involuntaryBedNeeded: boolean, legalStatus: LegalStatus): string | null {
  if (requiresAuthorisedDestination(legalStatus) === involuntaryBedNeeded) return null;
  const accepted = involuntaryBedNeeded ? "an involuntary bed" : "a voluntary bed";
  return `Check legal status: the ward accepted this referral for ${accepted}, but the legal status chosen is ${legalStatus}.`;
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
function mixSexFlag(gender: ReferralGender | undefined, sex: RecordedSex): string {
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
  // Owner ruling 13 Oct 2026 (R-B-09): the same shared helper as the PULL_PATIENT gate
  // (`openBedsNow`) and the bed grid, so a ward is never offered a bed it could not be pulled to,
  // closed wards included.
  return boundedBedAvailability(unit).available;
}

/*
 * THE GATES BOTH PATHS SHARE (review 18 Oct 2026, item 2). `eligibility()` (a movement being
 * accepted onto a ward) and `referralEligibility()` (a referral being placed now) restated these
 * rules by hand, and they drifted twice: the forensic gate was missing from one path, and the
 * sex-mix gate counted free beds differently. Each shared rule is now built once, here, and both
 * paths call the same builder. `tests/ward-eligibility-paths-agree.test.ts` checks that both paths
 * give the same answer on every shared gate for every seeded unit.
 *
 * The two DELIBERATE differences stay in each path and are the only gates the agreement test
 * leaves out: `allocatable_bed` and `security` ask "could this ward accept in principle" on the
 * movement path and "is there a bed to place into right now" on the referral path. See each gate's
 * own comment for why the movement path is allowed to be lenient.
 */

/** Whether a ward is authorised for an involuntary admission, when the person needs one. */
function authorisationGate(gate: "authorisation" | "legal_status", needed: boolean, unit: Unit): GateResult {
  return {
    gate,
    pass: !needed || unit.authorised,
    detail: needed
      ? unit.authorised
        ? `${unit.name} is marked able to take involuntary admissions (demo capability)`
        : `${unit.name} is not set up for involuntary admissions (demo capability)`
      : "No authorised destination required",
  };
}

/** Whether the ward's cohort matches the person's age band. */
function cohortGate(gate: "cohort" | "age", cohort: Movement["cohort"], unit: Unit, noun: string): GateResult {
  const matches = unit.cohort === cohort;
  return {
    gate,
    pass: matches,
    detail: `${unit.cohort} unit ${matches ? "matches" : "does not match"} ${article(cohort)} ${cohort.toLowerCase()} ${noun}`,
  };
}

/** D7: a forensic bed is never offered as a destination, whichever door the request came through. */
function forensicGate(unit: Unit): GateResult {
  return {
    gate: "forensic",
    pass: !unit.forensic,
    detail: unit.forensic
      ? `${unit.name} is a forensic ward and is never offered as a destination`
      : `${unit.name} is not a forensic ward`,
  };
}

/**
 * The bay-mix gate: someone of the same sex is already on the ward, or more than one bed is ready
 * so no one is placed alone. Fix 2 (26 September 2026): both paths read `readyBedsNow`, never raw
 * `allocatable`, because a ward with three allocatable and one empty bed has one free bed.
 */
function sexMixGate(gender: ReferralGender | undefined, sex: RecordedSex, unit: Unit): GateResult {
  const mixSex = mixSexOf(gender, sex);
  const sameSexOccupants = mixSex === undefined ? 0 : (unit.sexMix[mixSex] ?? 0);
  return {
    gate: "sex_mix",
    pass: sameSexOccupants > 0 || readyBedsNow(unit) > 1,
    detail:
      (mixSex !== undefined && sameSexOccupants > 0
        ? `${sameSexOccupants} ${mixSex.toLowerCase()} occupants already`
        : "No same-sex occupants; needs more than one free bed") + mixSexFlag(gender, sex),
  };
}

/** Whether the ward confirmed its capacity recently enough to trust. */
function freshnessGate(unit: Unit, now: Instant): GateResult {
  const fresh = capacityIsFresh(unit, now);
  const age = now - unit.allocatable.confirmedAt;
  return {
    gate: "capacity_freshness",
    pass: fresh,
    detail: fresh ? `Confirmed ${age} min ago` : `Last confirmed ${age} min ago — stale`,
  };
}

/**
 * **Owner ruling, 2026-09-10: acuity is a STAFFING fact, never a ranking.** It does not order one
 * patient ahead of another and does not score anybody. `unit.highAcuityCapacity` is the AUTHORED
 * total and is never decremented, and neither path is given the admissions, so this cannot say how
 * many places are left: `remainingHighAcuityCapacity(unit, admissions)` knows that and
 * `PULL_PATIENT` asks it. **Two checks that can disagree is worse than one honest sentence.**
 *
 * Information only (`info`), so no screen shows it as a check that was met. A ward with no
 * high-acuity places is described as not staffed for them, never as "capacity reached", which read
 * as "full right now" (review 18 Oct 2026, item 3).
 */
function acuityGate(requested: boolean, unit: Unit, noun: string): GateResult {
  const places = unit.highAcuityCapacity;
  return {
    gate: "acuity",
    pass: true,
    info: true,
    detail: !requested
      ? `No high-acuity nursing requested ${noun === "referral" ? "on this referral" : "for this movement"}`
      : places > 0
        ? `High-acuity nursing requested; ward is staffed for ${places} high-acuity ${places === 1 ? "place" : "places"}. Whether one can take this patient is checked when the bed is pulled.`
        : "High-acuity nursing requested; ward is not staffed for high-acuity places. Information only: additional shift staffing required upon admission.",
  };
}

/**
 * Specialling (one-to-one nursing), the same kind of staffing fact as acuity, and information only
 * for the same reason. `unit.speciallingCapacity` is the authored total, never decremented, so this
 * says what is staffed and where current use is decided, never how many slots are free (see
 * `tests/ward-specialling-detail-claims-no-headroom.test.ts`). A referral records no specialling
 * need, so the referral path says so.
 */
function speciallingGate(requested: boolean | undefined, unit: Unit): GateResult {
  const places = unit.speciallingCapacity;
  return {
    gate: "specialling",
    pass: true,
    info: true,
    detail:
      requested === undefined
        ? "Specialling need is not recorded on a referral"
        : !requested
          ? "No specialling required"
          : places > 0
            ? `Staffed for ${places} one-to-one — current use is checked at placement`
            : "Specialling (one-to-one nursing) requested; ward is not staffed for one-to-one nursing. Information only: additional shift staffing required upon admission.",
  };
}

/**
 * The movement facts `eligibility()` reads, and nothing else. Every `Movement` is one; a stay that
 * is not on a movement (a step-down candidate, `ward-step-down.ts`) builds one from its admission so
 * it is matched by these same gates rather than a second set (Top 25 item 8).
 */
export type EligibilitySubject = Pick<
  Movement,
  "declines" | "gender" | "sex" | "genderPlacements" | "cohort" | "security" | "highAcuity" | "specialling"
> & {
  /** Not recorded is `undefined`, which the authorisation gate treats as needing an authorised ward. */
  legalStatus: Movement["legalStatus"] | undefined;
};

export function eligibility(movement: EligibilitySubject, unit: Unit, now: Instant): EligibilityVerdict {
  const authorisationNeeded = requiresAuthorisedDestination(movement.legalStatus);
  const declined = movement.declines.some((decline) => decline.unitId === unit.id);
  const genderDesignation = genderDesignationResult(movement.gender, unit, movement.genderPlacements);

  const gates: GateResult[] = [
    authorisationGate("authorisation", authorisationNeeded, unit),
    cohortGate("cohort", movement.cohort, unit, "movement"),
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
       * `PULL_PATIENT` refusing when Ready (`min(allocatable, empty)`) is 0 (Audit 2 E-08, Josh
       * 20 Oct 2026), in a different case block. The symptom was the last-bed reducer test: a second acceptance failed HERE, on
       * capacity, instead of reaching the pull guard that answers `bed_pulled_for_earlier_referral`.
       * Two other sessions warned about precisely this before it was written.
       *
       * An Open movement passes wherever the ward has beds at all — a voluntary patient may be
       * nursed in a locked bed, so no kind of ward is unsuitable on this axis.
       *
       * Two-stage contract across movement acceptance, bed pull, and referral matching (S2-9):
       * - Here in `eligibility()`, a Secure movement passes when `unitHasLockedBeds(unit)` is true
       *   even if all locked beds are currently occupied (`lockedBedsFree(unit) === 0`), so
       *   `ACCEPT_IN_PRINCIPLE` can accept the patient onto the ward's waitlist while `detail`
       *   reports that locked beds exist but none is free to the coordinator. Physical bed
       *   allocation at `PULL_PATIENT` (`ward-flow-reducer.ts`) checks `lockedBedsFree(unit)` for a new
       *   pull: a Secure movement with no free locked bed requires a valid override, then uses an
       *   open bed and records `locked_bed_capacity`. A movement that already holds a bed follows
       *   the restore path and does not run this bed-kind check.
       * - By contrast, `referralEligibility()` below checks immediate placement readiness and
       *   requires both `unitHasLockedBeds(unit) && lockedBedsFree(unit) > 0` (mirroring how
       *   `allocatable_bed` checks `unit.allocatable.value > 0` here vs `availableNow > 0` there).
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
    forensicGate(unit),
    sexMixGate(movement.gender, movement.sex, unit),
    acuityGate(movement.highAcuity, unit, "movement"),
    speciallingGate(movement.specialling, unit),
    {
      gate: "prior_decline",
      pass: !declined,
      detail: declined ? "Already declined this movement" : "No prior decline",
    },
    freshnessGate(unit, now),
    {
      /*
       * ⚠️ **THE LENIENT FIGURE, AND WHAT MAKES THAT SAFE IS NOT IN THIS FILE.** This passes on
       * `allocatable` alone, so a ward with three allocatable and no empty bed is eligible here.
       * **The guard is `PULL_PATIENT`** (`ward-flow-placement-events.ts`), which refuses when Ready,
       * `min(allocatable, empty)`, is 0 (Audit 2 E-08, Josh 20 Oct 2026). `PATIENT_ARRIVED` is NOT a
       * guard: an arrival is always recorded, and one into a ward with no empty bed is kept as an
       * arrival capacity conflict ("Arrived — Bed Turnaround").
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
function securityGateDetail(movement: Pick<Movement, "security">, unit: Unit): string {
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
  const genderDesignation = genderDesignationResult(ward.gender, unit, referral.genderPlacements);
  // S2-9: unlike `eligibility()` above, which checks ward capability (`unitHasLockedBeds(unit)`) so
  // `ACCEPT_IN_PRINCIPLE` can waitlist a Secure movement until `PULL_PATIENT` checks
  // `lockedBedsFree(unit)`, referral matching asks whether a suitable bed is free now, so it needs
  // both. Both paths share `bedKindGateDetail` so the coordinator sees the same locked-bed counts.
  const securityMet = !ward.secureBedNeeded || (unitHasLockedBeds(unit) && lockedBedsFree(unit) > 0);
  // Spec D15: the bed a coordinator can place someone in right now is `readyBedsNow`, never
  // `unit.allocatable.value` alone. `CONFIRM_CAPACITY` can raise allocatable above empty after
  // arrivals used the empty beds, so the two figures are not enforced to agree (see the D15 contract
  // test in `ward-referral-matching.test.ts`).
  const availableNow = readyBedsNow(unit);

  const gates: GateResult[] = [
    cohortGate("age", referral.ageBand, unit, "referral"),
    authorisationGate("legal_status", wardRequestNeedsInvoluntaryBed(referral, ward), unit),
    {
      // 🔴 RENAMED FROM `sex_designation`, T10 (item 8): see `eligibility()`'s own gate of this
      // name above and `genderDesignationResult`'s doc comment below for the full rule.
      gate: "gender_designation",
      pass: genderDesignation.pass,
      detail: genderDesignation.detail,
    },
    forensicGate(unit),
    {
      gate: "security",
      pass: securityMet,
      detail: bedKindGateDetail(ward.secureBedNeeded, unit),
    },
    sexMixGate(ward.gender, ward.sex, unit),
    speciallingGate(undefined, unit),
    acuityGate(ward.highAcuityNursingNeeded, unit, "referral"),
    freshnessGate(unit, now),
    {
      // `availableNow`, not `unit.allocatable.value` alone — see the comment on `availableNow`'s
      // declaration above. The detail names both source figures so a coordinator (or a future
      // reader of this code) can see why they can diverge, without reading anything but the
      // unit's own two confirmed numbers.
      //
      // ⚠️ **THE MOVEMENT PATH'S GATE OF THIS NAME IS DELIBERATELY LOOSER, AND IT IS NOT A DRIFT.**
      // `eligibility()` above passes on `allocatable` alone because a movement is asking whether
      // the ward can accept in principle; a referral is asking whether this person can come now.
      // The safety of that looser gate rests on the `PULL_PATIENT` Ready-bed refusal — read the
      // comment on `eligibility()`'s gate before assuming either gate is wrong.
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
 * Eligibility gates are not commensurable (failing `authorisation` is a legal gate that can be
 * overridden only with a recorded reason; failing `capacity_freshness` is a staleness warning),
 * so this deliberately never collapses them into a "N of M passed" fraction — that shape reads
 * as a score, and higher/lower comparisons across two verdicts are not meaningful.
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
  unit: Pick<Unit, "id" | "name" | "sexDesignation">,
  /**
   * Deliberately inert — see rule 3 above. Accepted only so a caller who reaches for the same
   * `OVERRIDE_REASONS` vocabulary the nine `SUITABILITY_GATES` accept gets the same shape of
   * refusal back rather than a type error inviting a different workaround. Its value never appears
   * in `pass` or `detail`, and `tests/ward-gender-gate.test.ts` proves that over every member of
   * `OVERRIDE_REASONS`, not one of them.
   */
  _attemptedOverrideReason?: OverrideReason,
  genderPlacements?: ReadonlyArray<GenderPlacement>,
): GenderGateResult {
  // Read and discarded — the whole point. See the parameter's own doc comment: nothing below this
  // line may ever consult it, and `void` here is what lets the parameter exist without an
  // unused-variable warning inviting somebody to "clean up" the inert third argument into use.
  void _attemptedOverrideReason;
  const coveredByCoordinatorPlacement =
    Array.isArray(genderPlacements) && genderPlacements.some((record) => record.unitIds.includes(unit.id));
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
    // R7: an unrecorded gender is handled exactly like a gender that is not female or male, so a
    // coordinator's recorded placement for this unit clears it here as it does in the referral gate.
    if (coveredByCoordinatorPlacement) {
      return {
        gate: "gender",
        pass: true,
        detail: `Coordinator gender placement recorded for ${unit.name}`,
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
    if (unit.sexDesignation === "Undesignated") {
      return {
        gate: "gender",
        pass: true,
        detail: `Gender is not female or male, but ${unit.name} is undesignated and takes either gender`,
      };
    }
    if (coveredByCoordinatorPlacement) {
      return {
        gate: "gender",
        pass: true,
        detail: `Coordinator gender placement recorded for ${unit.name}`,
      };
    }
    return {
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

export type GenderPlacementValidation = {
  readonly eligible: boolean;
  readonly conflictWarning: string | undefined;
  readonly requiresCoordinatorReview: boolean;
  readonly detail: string;
};

/**
 * Validates gender placement for a patient against a target unit's sex designation,
 * explicitly handling Non-binary and Different-term patients on single-sex vs undesignated wards
 * and surfacing single-sex ward conflict warnings when coordinator review has not yet occurred.
 */
export function validateGenderPlacement(
  request: {
    readonly gender?: Patient["gender"];
    /** The recorded sex; when given, the same review rule the reducer applies on acceptance. */
    readonly sex?: RecordedSex;
    readonly genderPlacements?: ReadonlyArray<GenderPlacement>;
  },
  unit: Pick<Unit, "id" | "name" | "sexDesignation">,
): GenderPlacementValidation {
  const result = genderEligibility({ gender: request.gender }, unit, undefined, request.genderPlacements);
  // ACCEPT_REFERRAL asks for a coordinator's placement on ANY ward when the recorded sex and gender
  // are not both female or male (`genderReviewNeeded`), so a ward that "takes either gender" does
  // not make the placement eligible on its own.
  const placementRecorded = (request.genderPlacements ?? []).some((record) => record.unitIds.includes(unit.id));
  if (
    result.pass &&
    request.sex !== undefined &&
    genderReviewNeeded(request.gender, request.sex) &&
    !placementRecorded
  ) {
    return {
      eligible: false,
      conflictWarning: `${unit.name} needs a recorded coordinator gender placement: the recorded sex and gender are not both female or male.`,
      requiresCoordinatorReview: true,
      detail: result.detail,
    };
  }
  if (result.pass) {
    return {
      eligible: true,
      conflictWarning: undefined,
      requiresCoordinatorReview: false,
      detail: result.detail,
    };
  }
  const isNonBinaryOrUnrecorded =
    request.gender === "Non-binary" || request.gender === "Different term" || request.gender === undefined;
  const isSingleSexWard = unit.sexDesignation !== "Undesignated";
  const requiresCoordinatorReview = isNonBinaryOrUnrecorded && isSingleSexWard;
  return {
    eligible: false,
    conflictWarning: isSingleSexWard
      ? requiresCoordinatorReview
        ? `${unit.name} is a single-sex (${unit.sexDesignation.toLowerCase()}) ward; placing a ${request.gender?.toLowerCase() ?? "patient without recorded gender"} patient requires a recorded coordinator gender placement.`
        : `${unit.name} is a single-sex (${unit.sexDesignation.toLowerCase()}) ward and conflicts with recorded gender (${request.gender}).`
      : result.detail,
    requiresCoordinatorReview,
    detail: result.detail,
  };
}
