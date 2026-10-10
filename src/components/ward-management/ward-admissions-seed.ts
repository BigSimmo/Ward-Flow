import { DISCHARGE_ROLE_LABELS } from "@/components/ward-management/ward-admissions";
import type {
  Admission,
  FollowUpRecord,
  LeavingDestination,
  PlannedAdmission,
} from "@/components/ward-management/ward-admissions";
import type { TentativeDiagnosisBlock } from "@/components/ward-management/ward-diagnosis";
import type { BedReleaseBlocker } from "@/components/ward-management/ward-change-reasons";
import { MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import type { HomeRegion, MovementId, ReferralGender, Sex } from "@/components/ward-management/ward-model";
import type { Patient, PatientId } from "@/components/ward-management/ward-patients";
import { generateSeedPatient, type GeneratedSeedPatientCohort } from "@/components/ward-management/ward-patients-seed";

/**
 * The synthetic people occupying beds across the network.
 *
 * Until this fixture existed the prototype knew a ward had 20 beds and 3 empty and NOTHING about
 * anybody in one, so every occupancy figure was a number a ward hand-maintained. Two features are
 * derived from what is here — the ward board and the out-of-area ledger — and both are only as
 * honest as this file.
 *
 * **The one constraint everything else is shaped around:** for every unit, the people in the beds
 * must agree EXACTLY with that unit's own recorded `sexMix` in `ward-sites.ts`, for both sexes.
 * That is what lets the hand-maintained count be replaced by the derived one without a single
 * ward's figures moving, and `tests/ward-admissions-seed.test.ts` is what holds it true. Every
 * occupant below is therefore written out explicitly, one line each: nothing in this file reads a
 * unit's `sexMix` back and tops itself up to match, because a fixture that derived itself from the
 * number it is checked against could never disagree with it, and the check would be a check that
 * cannot fail.
 *
 * The same standing rules as `ward-admissions.ts` govern every value here, and this file adds no
 * vocabulary of its own:
 *
 *   1. **No figure from the Mental Health Act.** Not a duration, not a timeframe, not a threshold.
 *      The stay lengths, expected dates and transport delays below are invented operational
 *      numbers exactly like every bed count in `ward-sites.ts`; none of them is a legal clock and
 *      none may ever be read as one.
 *   2. **Chosen, never typed.** Every sex, home region, blocker, destination and tentative
 *      diagnosis below comes from an existing fixed runtime array (`SEXES`, `HOME_REGIONS`,
 *      `BED_RELEASE_BLOCKERS`, `LEAVING_DESTINATIONS`, `TENTATIVE_DIAGNOSIS_BLOCKS`). There is no
 *      free text anywhere in this file.
 *   3. **A TENTATIVE diagnosis block and nothing finer; no name, no date of birth, no record
 *      number, no address.** The owner reversed the previous no-diagnosis rule on 2026-08-29 —
 *      see `Admission.tentativeDiagnosis`. What is seeded is one of eleven broad ICD-10-AM
 *      Chapter V blocks, or nothing. An `Admission` cannot express anything finer, and nothing
 *      here works around that.
 *
 * **This fixture carries no travel band and no distance.** Where somebody is from is recorded as a
 * region; how far that is from their bed is looked up through `ward-distance.ts` by whoever needs
 * it, never stored here. The seed deliberately contains occupants whose region/site pair that
 * table does not record at all, so the ledger's separate "not recorded" group has real content.
 */

/**
 * The synthetic "now" every instant in this file is authored against — the same operating-day
 * anchor `ward-sites.ts` and `ward-movements.ts` are authored against, and it must stay equal to
 * it.
 *
 * **Written out here rather than imported, deliberately and reluctantly.** The single-source guard
 * in `tests/ward-flow-single-source.test.ts` restricts every read of that constant anywhere under
 * `src` to three named files, and this one is not among them; adding it would mean editing that
 * test. So this is a second copy, and a second copy is exactly the shape this codebase distrusts —
 * the two can drift. It is flagged rather than hidden: if the shared anchor ever moves, this value
 * moves with it in the same change.
 */
export const WARD_ADMISSIONS_ANCHOR: Instant = 10 * 60 + 42;

/**
 * How long before somebody arrives the bed was given away, in minutes.
 *
 * An INVENTED operational figure, like every bed number in this prototype. It exists so that a
 * seeded occupant's `pulledAt` and `arrivedAt` are two genuinely different instants — the bed is
 * gone from the pull, the stay runs from the arrival — rather than the same number twice, which is
 * how a reader (or a later refactor) comes to believe the two clocks are interchangeable. Nothing
 * legal, nothing clinical, nothing measured.
 */
const PULL_TO_ARRIVAL_MINUTES = 5 * 60;

/**
 * A part-day offset added to every arrival so a stay of `n` days lands squarely inside day `n`
 * rather than on the boundary. Exactly-on-the-boundary arrivals would make the band a seeded stay
 * falls into depend on rounding, and `STAY_BANDS`'s ceilings are exclusive.
 */
const ARRIVAL_PART_DAY_MINUTES = 90;

/**
 * Who set the expected discharge date, as a ROLE and never a personal name.
 *
 * Owner ruling 5, 2026-09-01: reconciled to the single spelling `DISCHARGE_ROLE_LABELS` now
 * carries. This used to be a locally-authored two-value array (`"Flow coordinator"` and `"Nurse
 * unit manager"`, both quoted from `Admission.dischargeDateSetBy`'s own doc comment) because the
 * field had no fixed runtime vocabulary of its own to import instead. It now imports the field's
 * real vocabulary rather than restating it, so this alias exists only so the two seed call sites
 * below read as "pick a setter" rather than reaching for the type-level constant directly.
 */
const DISCHARGE_DATE_SETTERS = DISCHARGE_ROLE_LABELS;

/**
 * THE TENTATIVE-DIAGNOSIS POOLS, one per kind of ward, and why they are pools rather than a value
 * written beside every person.
 *
 * Each pool is AUTHORED for the cohort its wards serve — an older-adult ward leans on the organic
 * block, a youth ward on the childhood-onset and developmental blocks, a secure adult ward on
 * psychosis and substance use — and `unitOccupants` walks it by index, so every ward gets a spread
 * rather than one repeated value. Writing a block beside each of the 250-odd occupants below would
 * bury the sex and home-region values the whole fixture is checked against, and those two are the
 * ones a reader must be able to scan.
 *
 * **This is not the derivation the file header refuses.** That refusal is about `sexMix`: a fixture
 * that read a ward's recorded count back and topped itself up to match would make the consistency
 * test a check that cannot fail. Nothing checks a ward against these pools, so nothing here is
 * derived from the thing it is compared with — the pools are ordinary authored content, just
 * authored once per ward kind instead of once per person.
 *
 * **Every pool contains a `null`, on purpose.** A person nobody recorded a tentative diagnosis for
 * is an ordinary state and the screens have a separate thing to say about it; a fixture where every
 * occupant carried a value would leave that path with no seeded case and every "not recorded"
 * rendering untested.
 *
 * Between them the four pools use all eleven blocks in `TENTATIVE_DIAGNOSIS_BLOCKS`, so no block is
 * declared and never seen.
 */
type DiagnosisPool = readonly (TentativeDiagnosisBlock | null)[];

/** Open adult acute wards — mood and psychotic presentations first, with substance use and
 *  personality-related admissions alongside, and the unspecified block for a referral that named
 *  no category at all. */
const ADULT_OPEN_DIAGNOSES: DiagnosisPool = [
  "F30–F39",
  "F20–F29",
  "F40–F48",
  "F10–F19",
  null,
  "F30–F39",
  "F60–F69",
  "F20–F29",
  "F99",
];

/** Secure adult wards — weighted towards psychosis, which is what these beds mostly hold, with
 *  intellectual disability represented because it is a real reason somebody is placed here. */
const ADULT_SECURE_DIAGNOSES: DiagnosisPool = [
  "F20–F29",
  "F30–F39",
  "F10–F19",
  "F20–F29",
  "F60–F69",
  null,
  "F70–F79",
  "F20–F29",
];

/** Older-adult wards — the organic block is what distinguishes this cohort, and it recurs rather
 *  than appearing once. */
const OLDER_ADULT_DIAGNOSES: DiagnosisPool = ["F00–F09", "F30–F39", "F00–F09", "F20–F29", null, "F00–F09", "F10–F19"];

/** The youth ward — childhood-onset behavioural and emotional disorders, developmental disorders,
 *  and the eating-disorder block, none of which appear on an adult ward's pool. */
const YOUTH_DIAGNOSES: DiagnosisPool = ["F90–F98", "F30–F39", "F40–F48", "F50–F59", null, "F80–F89", "F90–F98"];

/**
 * One seeded occupant of a bed, written as a tuple so a whole ward reads as a list of people
 * rather than as pages of object literals.
 *
 *   - `stayDays` — whole days this person has been in the bed, or `null` for a bed that has been
 *     GIVEN AWAY to somebody who has not arrived yet. That bed is occupied (`bedIsOccupied` counts
 *     `"pulled"`), it counts in the ward's sex mix, and it has no stay at all.
 *   - `dischargeInDays` — whole days from the anchor to the ward's own expected discharge date.
 *     Negative means the date has already passed and the person is still here. `null` means nobody
 *     has set one, which is an ordinary state and never a stand-in for "not yet due".
 */
type Occupant = readonly [
  sex: Sex,
  homeRegion: HomeRegion,
  stayDays: number | null,
  dischargeInDays: number | null,
  extras?: OccupantExtras,
];

type OccupantExtras = {
  /** R7 (25 September 2026): this occupant's gender identity when it differs from the tuple's sex.
   *  Absent means the authored gender equals the sex. */
  readonly gender?: ReferralGender;
  /** What is holding this bed up, drawn from `BED_RELEASE_BLOCKERS`. */
  readonly blockReason?: BedReleaseBlocker;
  /**
   * Hours before the anchor at which this person left the ward for an emergency department.
   * Absent means they are on the ward, which is every occupant but the two that carry it.
   *
   * **Only meaningful on an occupied bed, and it does not change the bed.** The ward is holding
   * the bed because they are coming back — see `Admission.awayAtEmergencyDepartmentSince`. Two
   * people carry it so the board has something to draw and a test has a real record to find; a
   * marker no seeded person triggers is a marker nobody has ever seen rendered.
   */
  readonly awayAtEdHoursAgo?: number;
  /**
   * Hours before the anchor at which the ward CONFIRMED this discharge is happening — the ward's
   * own decision, as distinct from the plan `dischargeInDays` records. Absent means nobody has
   * confirmed anything, which is the ordinary state and is what most occupants below carry.
   *
   * Only meaningful alongside a `dischargeInDays`: a decision to discharge with no date to
   * discharge ON has nothing for a bed release to be dated by, so the builder refuses to record
   * one rather than inventing an instant for it.
   */
  readonly confirmedHoursAgo?: number;
  /**
   * The referral this occupant actually came from — a real id from `referrals` in
   * `ward-movements.ts`, and its `raisedAt` MUST be strictly before this occupant's `arrivedAt`.
   * Absent means no real referral is authored for this occupant, which is the ordinary case and
   * `unitOccupants` records it as `null` rather than a value composed from the occupant's own id.
   *
   * Set on exactly the nine occupants `MIDLAND_DEMONSTRATION_ROWS` (`ward-movements.ts`) already
   * names by admission id — the only real, chronologically-correct referrals this seed carries
   * outside `AD-LEFT-01`. Do not set this for a chronologically-eligible referral that was never
   * actually authored for this person: that reuses another admission's referral and states a false
   * team membership, which is a different shape of the same fabrication this field replaces.
   */
  readonly referralId?: string;
  readonly movementId?: MovementId | null;
  /**
   * D-14. The real patient this occupant is — a pointer, never invented, and never set without
   * `referralId` beside it: `Admission.patientId`'s own doc comment says the only honest way to
   * populate this seed is to reuse a pair `referralId` already authors, never a hand-picked patient
   * with no referral behind it. Set on exactly ONE occupant (`RF-RPHS-14`, `wardPatients[2]` —
   * `PT-003`, sex Female, matching this occupant's own recorded sex) — enough for the default-deny
   * guard's own anti-vacuity floor to have something real to find, deliberately not more: `PT-002`
   * (`wardPatients[1]`) must stay unlinked, because `tests/ward-search-preview.dom.test.tsx` pins
   * "no seeded referral names this patient" against that exact index.
   */
  readonly patientId?: PatientId;
};

/**
 * Builds one ward's occupants from the list above.
 *
 * Ids follow `ward-movements.ts`'s house scheme — a short stable prefix and a sequence, stable
 * across edits to other wards. `Admission.referralId` is nullable and this builder honours that:
 * an occupant's referral is `extras.referralId` where one is authored, and `null` everywhere else
 * — never a value composed from the occupant's own id.
 *
 * ⚠️ **THIS USED TO MANUFACTURE A REFERRAL ID FROM THE ADMISSION'S OWN SUFFIX, AND THAT WAS THE
 * DEFECT, NOT THE FIX.** A manufactured id joined to nothing — no referral in `ward-movements.ts`
 * ever carried a value of that shape — so `referralToBedJoin` and `admissionBelongsToTeam` both
 * returned nought for every admission against every referral and every one of the 65 community
 * teams, while looking exactly like a real link. **`null` is the honest replacement, not a
 * regression:** it says "not attributable to a team" and is true, where the manufactured id said
 * "attributable to team X" and was false. Ten admissions carry a real, authored referral instead —
 * `AD-LEFT-01` (in `departures` below) and the nine occupants whose `extras.referralId` names one
 * of `MIDLAND_DEMONSTRATION_ROWS` (`ward-movements.ts`). **Do not close the remaining gap by
 * pointing an occupant at a chronologically-eligible referral that was never authored for them:**
 * that restates the `52ad01dda` mistake in a new shape — a real id that names the wrong person's
 * referral is still a false claim of team membership, not a fix.
 *
 * Lifecycle coherence is enforced HERE, at construction, so no hand-edited line can produce a
 * pulled admission that has somehow already arrived. The whole-set coherence assertion in the test
 * file is the guard for anything later added as a literal rather than through this builder.
 */
function unitOccupants(
  unitId: string,
  tag: string,
  /** This ward's cohort pool, walked by index — see the pools' own doc comment for why the value
   *  is not written beside each person. */
  diagnoses: DiagnosisPool,
  occupants: readonly Occupant[],
): Admission[] {
  return occupants.map(([sex, homeRegion, stayDays, dischargeInDays, extras], index) => {
    const suffix = `${tag}-${String(index + 1).padStart(2, "0")}`;
    const blockReason = extras?.blockReason ?? null;
    const tentativeDiagnosis = diagnoses[index % diagnoses.length];

    if (stayDays === null) {
      // The bed is gone; the person is not here. No stay, no plan, no blocker.
      return {
        id: `AD-${suffix}`,
        unitId,
        specialling: false,
        highAcuity: false,
        referralId: extras?.referralId ?? null,
        movementId: extras?.movementId ?? null,
        patientId: extras?.patientId ?? null,
        sex,
        gender: extras?.gender ?? sex, // R7 (25 Sept 2026): authored demo data, not derived at runtime
        homeRegion,
        tentativeDiagnosis,
        state: "pulled",
        pulledAt: WARD_ADMISSIONS_ANCHOR - PULL_TO_ARRIVAL_MINUTES - index * 30,
        arrivedAt: null,
        awayAtEmergencyDepartmentSince: null,
        expectedDischargeAt: null,
        dischargeDateMoves: 0,
        dischargeDateSetAt: null,
        dischargeDateSetBy: null,
        dischargeConfirmedAt: null,
        dischargeConfirmedBy: null,
        blockReason: null,
        leavingDestination: null,
        leftAt: null,
        followUp: null,
      };
    }

    const arrivedAt = WARD_ADMISSIONS_ANCHOR - stayDays * MINUTES_PER_DAY - ARRIVAL_PART_DAY_MINUTES;
    const hasDate = dischargeInDays !== null;
    // A confirmation is only recorded where there is a date to confirm — see `confirmedHoursAgo`.
    // The pair moves together: an instant with no role, or a role with no instant, is a decision
    // that cannot be acted on or one attributed to a ward that never made it.
    const confirmedHoursAgo = hasDate ? extras?.confirmedHoursAgo : undefined;
    const isConfirmed = confirmedHoursAgo !== undefined;

    return {
      id: `AD-${suffix}`,
      unitId,
      specialling: false,
      highAcuity: false,
      referralId: extras?.referralId ?? null,
      movementId: extras?.movementId ?? null,
      patientId: extras?.patientId ?? null,
      sex,
      gender: extras?.gender ?? sex, // R7 (25 Sept 2026): authored demo data, not derived at runtime
      homeRegion,
      tentativeDiagnosis,
      state: "occupied",
      pulledAt: arrivedAt - PULL_TO_ARRIVAL_MINUTES,
      arrivedAt,
      awayAtEmergencyDepartmentSince:
        extras?.awayAtEdHoursAgo === undefined ? null : WARD_ADMISSIONS_ANCHOR - extras.awayAtEdHoursAgo * 60,
      expectedDischargeAt: hasDate ? WARD_ADMISSIONS_ANCHOR + dischargeInDays * MINUTES_PER_DAY : null,
      dischargeDateMoves: hasDate ? index % 3 : 0,
      dischargeDateSetAt: hasDate ? WARD_ADMISSIONS_ANCHOR - (6 + (index % 5) * 5) * 60 : null,
      dischargeDateSetBy: hasDate ? DISCHARGE_DATE_SETTERS[index % DISCHARGE_DATE_SETTERS.length] : null,
      dischargeConfirmedAt: isConfirmed ? WARD_ADMISSIONS_ANCHOR - confirmedHoursAgo * 60 : null,
      // Owner ruling 5 (2026-09-01) leaves this field family with exactly one role spelling, so
      // the setter and the confirmer are now the same string on every admission that has both —
      // that is correct: it is the ward acting twice, not a second role appearing. Indexing
      // through `DISCHARGE_DATE_SETTERS` (rather than writing the literal here) is kept so a
      // second role, if the owner ever authors one, only needs adding to that one array.
      dischargeConfirmedBy: isConfirmed ? DISCHARGE_DATE_SETTERS[(index + 1) % DISCHARGE_DATE_SETTERS.length] : null,
      blockReason,
      leavingDestination: null,
      leftAt: null,
      followUp: null,
    };
  });
}

/** A completed admission — the bed is back. See `departures` below for why each one is here. */
type Departure = {
  readonly id: string;
  readonly unitId: string;
  readonly sex: Sex;
  readonly homeRegion: HomeRegion;
  /** The broad category recorded as this departure's tentative diagnosis, or `null` where none was
   *  recorded — never something a referral could carry; see `Admission.tentativeDiagnosis` in
   *  `ward-admissions.ts`. Written out per departure rather than pooled: there are five of them and
   *  each is here to carry a different `LeavingDestination`, so the list reads as five
   *  hand-authored cases. */
  readonly tentativeDiagnosis: TentativeDiagnosisBlock | null;
  /** Whole days the completed stay lasted. */
  readonly stayDays: number;
  /** Minutes before the anchor that this person left. */
  readonly leftMinutesAgo: number;
  readonly destination: LeavingDestination;
  /**
   * What was recorded about follow-up, or `null` where nobody recorded anything — which is the
   * ordinary case and must stay representable. Synthetic, like every other value in this file.
   */
  readonly followUp: FollowUpRecord | null;
  /**
   * The referral this admission actually came from, where one exists — a real id from
   * `referrals` in `ward-movements.ts`, never a value composed from this admission's own id.
   *
   * Omitted on every departure but one, and the omission is recorded as `null` — `Admission.
   * referralId` is nullable, and `null` is the honest statement that no real referral is authored
   * for this departure, not a value that matches nothing while looking like a real link. **A
   * supplied entry here must be a referral raised BEFORE the admission arrived**, or the pair
   * carries no duration and means nothing — see `referralToBedJoin`'s own comment, and
   * `COMMUNITY_FOLLOW_UP_REFERRAL_DAYS_AGO` in `ward-movements.ts`.
   */
  readonly referralId?: string;
  readonly movementId?: MovementId | null;
  /** D-14. See `Occupant`'s own `patientId` field for the discipline this follows — set only
   *  alongside a real `referralId`, and only on `AD-LEFT-01` (`RF-010` → `PT-001`, `wardPatients[0]`,
   *  sex Female, matching this departure's own recorded sex). */
  readonly patientId?: PatientId;
};

function departed(departure: Departure): Admission {
  const leftAt = WARD_ADMISSIONS_ANCHOR - departure.leftMinutesAgo;
  const arrivedAt = leftAt - departure.stayDays * MINUTES_PER_DAY;
  return {
    id: departure.id,
    unitId: departure.unitId,
    specialling: false,
    highAcuity: false,
    referralId: departure.referralId ?? null,
    movementId: departure.movementId ?? null,
    patientId: departure.patientId ?? null,
    sex: departure.sex,
    homeRegion: departure.homeRegion,
    tentativeDiagnosis: departure.tentativeDiagnosis,
    state: "departed",
    pulledAt: arrivedAt - PULL_TO_ARRIVAL_MINUTES,
    arrivedAt,
    awayAtEmergencyDepartmentSince: null,
    expectedDischargeAt: leftAt,
    dischargeDateMoves: 1,
    dischargeDateSetAt: leftAt - 2 * MINUTES_PER_DAY,
    dischargeDateSetBy: DISCHARGE_DATE_SETTERS[0],
    // A completed admission records the departure that HAPPENED (`leftAt`, `leavingDestination`).
    // A confirmation is a decision about a discharge still to come, so back-filling one here would
    // be a fact invented after the event, and `derivedBedReleases` reads a departed admission as
    // `"discharged"` regardless.
    dischargeConfirmedAt: null,
    dischargeConfirmedBy: null,
    blockReason: null,
    leavingDestination: departure.destination,
    leftAt,
    followUp: departure.followUp,
  };
}

/**
 * Somebody accepted in principle with no bed given. Consumes nothing and counts in no mix.
 *
 * `referralId` is always `null` here, never a value composed from `id`: a waitlisted admission
 * has neither a `pulledAt` nor an `arrivedAt`, so there is no instant of this admission's own a
 * referral's `raisedAt` could ever be checked against, and no real referral in `ward-movements.ts`
 * is authored for any of these three.
 */
function waiting(
  id: string,
  unitId: string,
  sex: Sex,
  homeRegion: HomeRegion,
  tentativeDiagnosis: TentativeDiagnosisBlock | null,
  patientId: PatientId | null = null,
): Admission {
  return {
    id,
    unitId,
    specialling: false,
    highAcuity: false,
    referralId: null,
    movementId: null,
    patientId,
    sex,
    gender: sex, // R7 (25 Sept 2026): authored demo data, not derived at runtime
    homeRegion,
    tentativeDiagnosis,
    state: "waitlisted",
    pulledAt: null,
    arrivedAt: null,
    awayAtEmergencyDepartmentSince: null,
    expectedDischargeAt: null,
    dischargeDateMoves: 0,
    dischargeDateSetAt: null,
    dischargeDateSetBy: null,
    dischargeConfirmedAt: null,
    dischargeConfirmedBy: null,
    blockReason: null,
    leavingDestination: null,
    leftAt: null,
    followUp: null,
  };
}

/**
 * Everyone currently holding a bed, ward by ward, in the order `ward-sites.ts` declares them.
 *
 * Each ward's list is exactly as long as that ward's own occupied-bed count (`beds` less `empty`
 * less `blocked`), and its sexes are exactly that ward's recorded `sexMix`. Both are hand-written
 * here, so changing one person's sex makes the seed disagree with the network and the consistency
 * test goes red — which is the point.
 *
 * Stay lengths are spread so all four `STAY_BANDS` appear many times over rather than once each: a
 * band with a single instance makes a banding test pass on a coincidence.
 */
const occupiedBeds: Admission[] = [
  ...unitOccupants("rph-adult-secure", "RPHS", ADULT_SECURE_DIAGNOSES, [
    // CONFIRMED **AND** BLOCKED — the seed's most load-bearing single occupant. A stuck confirmed
    // discharge is the case the three-stage bed model exists for: it must still count as
    // confirmed, with blocked counted alongside it rather than subtracted from it. Without this
    // one line that rule has no seeded case and a derivation that quietly dropped blocked releases
    // out of the confirmed count would pass every test in this repository.
    [
      "Female",
      "South West",
      34,
      -2,
      { blockReason: "Awaiting accommodation", confirmedHoursAgo: 26, patientId: "PT-G-AD-RPHS-01" },
    ],
    // Confirmed and NOT blocked, so the blocked cross-cut above is compared against something.
    ["Male", "Mid West", 5, 3, { confirmedHoursAgo: 4, patientId: "PT-028" }],
    ["Male", "Peel", null, null, { patientId: "PT-G-AD-RPHS-03" }],
    // AWAY AT AN EMERGENCY DEPARTMENT, and the bed is still theirs. Two people in the whole
    // network carry this — one long enough to be a conversation, one recent — because the board
    // marker is a claim about a person's whereabouts, and a marker no seeded person triggers has
    // never been seen rendered by anybody. Nothing about capacity moves: the bed stays occupied
    // because the ward is holding it.
    ["Female", "Perth Metropolitan", 3, null, { awayAtEdHoursAgo: 6, patientId: "PT-G-AD-RPHS-04" }],
    ["Male", "Great Southern", 12, 4, { awayAtEdHoursAgo: 1, patientId: "PT-029" }],
    ["Female", "Perth Metropolitan", 45, 6, { patientId: "PT-032" }],
    ["Male", "Perth Metropolitan", 130, -2, { patientId: "PT-033" }],
    ["Female", "Perth Metropolitan", 5, 9, { patientId: "PT-035" }],
    ["Male", "Perth Metropolitan", 20, 2, { patientId: "PT-034" }],
    ["Female", "Pilbara", 60, 8, { patientId: "PT-G-AD-RPHS-10" }],
    ["Male", "Perth Metropolitan", 2, null, { patientId: "PT-036" }],
    ["Female", "Wheatbelt", 95, 3, { patientId: "PT-G-AD-RPHS-12" }],
    ["Male", "Gascoyne", 33, 5, { patientId: "PT-G-AD-RPHS-13" }],
    ["Female", "Perth Metropolitan", 6, -3, { referralId: "RF-RPHS-14", movementId: null, patientId: "PT-003" }],
    ["Male", "Great Southern", 210, 10, { blockReason: "Awaiting clean", patientId: "PT-G-AD-RPHS-15" }],
    ["Female", "Mid West", null, 4, { patientId: "PT-G-AD-RPHS-16" }],
    ["Male", "Kimberley", 75, 2, { patientId: "PT-G-AD-RPHS-17" }],
    ["Female", "South West", 4, 5, { patientId: "PT-G-AD-RPHS-18" }],
  ]),
  ...unitOccupants("rph-older-adult", "RPHO", OLDER_ADULT_DIAGNOSES, [
    ["Female", "Peel", 9, null, { patientId: "PT-030" }],
    ["Male", "Pilbara", 115, 1, { patientId: "PT-G-AD-RPHO-02" }],
    ["Female", "Peel", 40, -1, { patientId: "PT-G-AD-RPHO-03" }],
    ["Male", "Wheatbelt", 1, 7, { patientId: "PT-G-AD-RPHO-04" }],
    ["Female", "Gascoyne", 26, 3, { patientId: "PT-G-AD-RPHO-05" }],
    ["Male", "Perth Metropolitan", 3, null, { patientId: "PT-G-AD-RPHO-06" }],
    ["Female", "Great Southern", 12, 4, { patientId: "PT-G-AD-RPHO-07" }],
    ["Male", "Mid West", null, 6, { patientId: "PT-G-AD-RPHO-08" }],
    ["Female", "Kimberley", 130, -2, { patientId: "PT-G-AD-RPHO-09" }],
    ["Male", "South West", 5, 9, { patientId: "PT-G-AD-RPHO-10" }],
    ["Female", "Goldfields-Esperance", 20, 2, { patientId: "PT-G-AD-RPHO-11" }],
    ["Male", "Pilbara", 60, 8, { patientId: "PT-G-AD-RPHO-12" }],
  ]),
  ...unitOccupants("scgh-adult-open", "SCGA", ADULT_OPEN_DIAGNOSES, [
    ["Female", "Pilbara", null, null, { patientId: "PT-G-AD-SCGA-01" }],
    ["Male", "Peel", 210, null, { patientId: "PT-G-AD-SCGA-02" }],
    ["Female", "South West", 61, -1, { blockReason: "Awaiting transport", patientId: "PT-G-AD-SCGA-03" }],
    ["Female", "Perth Metropolitan", 2, null, { patientId: "PT-038" }],
    ["Male", "Perth Metropolitan", 95, 3, { patientId: "PT-039" }],
    // R7 (25 Sept 2026): PT-041's recorded sex is Male and gender Female (ward-patients-seed.ts). The
    // admission now carries both; the ward counts her as female, as before.
    ["Male", "Gascoyne", 33, 5, { patientId: "PT-041", gender: "Female" }],
    ["Male", "Perth Metropolitan", 6, -3, { referralId: "RF-SCGA-07", patientId: "PT-091" }],
    ["Female", "Great Southern", 210, 10, { patientId: "PT-G-AD-SCGA-08" }],
    ["Male", "Mid West", 17, 4, { patientId: "PT-G-AD-SCGA-09" }],
    ["Female", "Kimberley", 75, 2, { patientId: "PT-G-AD-SCGA-10" }],
    ["Male", "South West", 4, 5, { patientId: "PT-G-AD-SCGA-11" }],
    ["Female", "Goldfields-Esperance", 9, null, { patientId: "PT-G-AD-SCGA-12" }],
    ["Male", "Pilbara", 115, 1, { patientId: "PT-G-AD-SCGA-13" }],
    ["Female", "Peel", 40, -1, { patientId: "PT-G-AD-SCGA-14" }],
    ["Male", "Wheatbelt", 1, 7, { patientId: "PT-G-AD-SCGA-15" }],
    ["Female", "Gascoyne", 26, 3, { patientId: "PT-G-AD-SCGA-16" }],
    ["Male", "Perth Metropolitan", 3, null, { blockReason: "Awaiting pharmacy", patientId: "PT-G-AD-SCGA-17" }],
    ["Female", "Great Southern", 12, 4, { patientId: "PT-G-AD-SCGA-18" }],
    ["Male", "Mid West", null, 6, { patientId: "PT-G-AD-SCGA-19" }],
  ]),
  ...unitOccupants("scgh-older-adult", "SCGO", OLDER_ADULT_DIAGNOSES, [
    ["Female", "Perth Metropolitan", 130, -2, { patientId: "PT-040" }],
    ["Male", "South West", 5, 9, { patientId: "PT-G-AD-SCGO-02" }],
    ["Female", "Goldfields-Esperance", 20, 2, { patientId: "PT-G-AD-SCGO-03" }],
    ["Male", "Pilbara", 60, 8, { patientId: "PT-G-AD-SCGO-04" }],
    ["Female", "Peel", 2, null, { patientId: "PT-G-AD-SCGO-05" }],
    ["Male", "Wheatbelt", 95, 3, { patientId: "PT-G-AD-SCGO-06" }],
    ["Female", "Gascoyne", 33, 5, { patientId: "PT-G-AD-SCGO-07" }],
    ["Male", "Perth Metropolitan", 6, -3, { patientId: "PT-G-AD-SCGO-08" }],
    ["Female", "Great Southern", 210, 10, { patientId: "PT-G-AD-SCGO-09" }],
    ["Male", "Mid West", 17, 4, { patientId: "PT-G-AD-SCGO-10" }],
    ["Female", "Kimberley", 75, 2, { patientId: "PT-G-AD-SCGO-11" }],
    ["Male", "South West", 4, 5, { patientId: "PT-G-AD-SCGO-12" }],
    ["Female", "Goldfields-Esperance", 9, null, { patientId: "PT-G-AD-SCGO-13" }],
    ["Male", "Pilbara", 115, 1, { patientId: "PT-G-AD-SCGO-14" }],
    ["Female", "Peel", 40, -1, { patientId: "PT-G-AD-SCGO-15" }],
  ]),
  ...unitOccupants("fsh-adult-secure", "FSHS", ADULT_SECURE_DIAGNOSES, [
    ["Male", "Perth Metropolitan", 122, 6, { referralId: "RF-FSHS-01", patientId: "PT-097" }],
    ["Male", "Wheatbelt", 1, 7, { patientId: "PT-G-AD-FSHS-02" }],
    ["Male", "Gascoyne", 26, 3, { patientId: "PT-G-AD-FSHS-03" }],
    ["Male", "Perth Metropolitan", 3, null, { patientId: "PT-G-AD-FSHS-04" }],
    ["Male", "Great Southern", 12, 4, { patientId: "PT-G-AD-FSHS-05" }],
    ["Male", "Mid West", null, 6, { patientId: "PT-G-AD-FSHS-06" }],
    ["Male", "Kimberley", 130, -2, { patientId: "PT-G-AD-FSHS-07" }],
    ["Male", "South West", 5, 9, { patientId: "PT-G-AD-FSHS-08" }],
    ["Male", "Goldfields-Esperance", 20, 2, { patientId: "PT-G-AD-FSHS-09" }],
    ["Male", "Pilbara", 60, 8, { patientId: "PT-G-AD-FSHS-10" }],
    ["Male", "Peel", 2, null, { patientId: "PT-G-AD-FSHS-11" }],
    ["Male", "Wheatbelt", 95, 3, { patientId: "PT-G-AD-FSHS-12" }],
    ["Male", "Gascoyne", 33, 5, { blockReason: "Awaiting placement confirmation", patientId: "PT-G-AD-FSHS-13" }],
    ["Male", "Perth Metropolitan", 6, -3, { patientId: "PT-G-AD-FSHS-14" }],
  ]),
  ...unitOccupants("fsh-older-adult", "FSHO", OLDER_ADULT_DIAGNOSES, [
    ["Female", "Great Southern", 210, 10, { patientId: "PT-G-AD-FSHO-01" }],
    ["Male", "Mid West", 17, 4, { patientId: "PT-G-AD-FSHO-02" }],
    ["Female", "Kimberley", 75, 2, { patientId: "PT-G-AD-FSHO-03" }],
    ["Male", "South West", 4, 5, { patientId: "PT-G-AD-FSHO-04" }],
    ["Female", "Goldfields-Esperance", 9, null, { patientId: "PT-G-AD-FSHO-05" }],
    ["Male", "Pilbara", 115, 1, { patientId: "PT-G-AD-FSHO-06" }],
    ["Female", "Peel", 40, -1, { patientId: "PT-G-AD-FSHO-07" }],
    ["Male", "Wheatbelt", 1, 7, { patientId: "PT-G-AD-FSHO-08" }],
    ["Female", "Gascoyne", 26, 3, { patientId: "PT-G-AD-FSHO-09" }],
    ["Male", "Perth Metropolitan", 3, null, { patientId: "PT-G-AD-FSHO-10" }],
    ["Female", "Great Southern", 12, 4, { patientId: "PT-G-AD-FSHO-11" }],
  ]),
  ...unitOccupants("arm-adult-open", "ARMA", ADULT_OPEN_DIAGNOSES, [
    ["Female", "Perth Metropolitan", 12, null, { referralId: "RF-ARMA-01", patientId: "PT-095" }],
    [
      "Male",
      "Perth Metropolitan",
      48,
      -4,
      { blockReason: "Awaiting receiving-service acceptance", referralId: "RF-ARMA-02", patientId: "PT-096" },
    ],
    ["Female", "Mid West", 45, 6, { patientId: "PT-G-AD-ARMA-03" }],
    ["Male", "Kimberley", 130, -2, { patientId: "PT-G-AD-ARMA-04" }],
    ["Female", "South West", 5, 9, { patientId: "PT-G-AD-ARMA-05" }],
    ["Male", "Goldfields-Esperance", 20, 2, { patientId: "PT-G-AD-ARMA-06" }],
    ["Female", "Pilbara", 60, 8, { patientId: "PT-G-AD-ARMA-07" }],
    ["Male", "Peel", 2, null, { patientId: "PT-G-AD-ARMA-08" }],
    ["Female", "Wheatbelt", 95, 3, { patientId: "PT-G-AD-ARMA-09" }],
    ["Male", "Gascoyne", 33, 5, { patientId: "PT-G-AD-ARMA-10" }],
    ["Female", "Perth Metropolitan", 6, -3, { patientId: "PT-G-AD-ARMA-11" }],
    ["Male", "Great Southern", 210, 10, { patientId: "PT-G-AD-ARMA-12" }],
    ["Female", "Mid West", 17, 4, { patientId: "PT-G-AD-ARMA-13" }],
    ["Male", "Kimberley", 75, 2, { patientId: "PT-G-AD-ARMA-14" }],
    ["Female", "South West", 4, 5, { patientId: "PT-G-AD-ARMA-15" }],
    ["Male", "Goldfields-Esperance", null, null, { patientId: "PT-G-AD-ARMA-16" }],
  ]),
  ...unitOccupants("sjgm-adult-open", "SJGA", ADULT_OPEN_DIAGNOSES, [
    // Due home this afternoon (dischargeInDays 0.25 = 16:42 today), so the demo has a bed freeing
    // later today (DEFERRED from Test bed-matching, 26 Sept 2026). Was 1 (tomorrow).
    ["Female", "Pilbara", 115, 0.25, { patientId: "PT-G-AD-SJGA-01" }],
    ["Male", "Peel", null, 6, { patientId: "PT-G-WF-311" }],
    ["Female", "Wheatbelt", 1, 7, { blockReason: "Awaiting service coordination", patientId: "PT-G-AD-SJGA-03" }],
    ["Male", "Gascoyne", 26, 3, { patientId: "PT-G-AD-SJGA-04" }],
    ["Female", "Perth Metropolitan", 20, 2, { referralId: "RF-SJGA-05", patientId: "PT-093" }],
    ["Male", "Great Southern", 12, 4, { patientId: "PT-G-AD-SJGA-06" }],
    ["Female", "Perth Metropolitan", null, 6, { patientId: "PT-014" }],
    ["Male", "Kimberley", 130, -2, { patientId: "PT-G-AD-SJGA-08" }],
    ["Female", "South West", 5, 9, { patientId: "PT-G-AD-SJGA-09" }],
    ["Male", "Goldfields-Esperance", 20, 2, { patientId: "PT-G-AD-SJGA-10" }],
    ["Female", "Pilbara", 60, 8, { patientId: "PT-G-AD-SJGA-11" }],
    ["Male", "Peel", 2, null, { patientId: "PT-G-AD-SJGA-12" }],
    ["Female", "Wheatbelt", 95, 3, { patientId: "PT-G-AD-SJGA-13" }],
    ["Male", "Gascoyne", 33, 5, { patientId: "PT-G-AD-SJGA-14" }],
  ]),
  ...unitOccupants("rgh-adult-secure", "RGHS", ADULT_SECURE_DIAGNOSES, [
    ["Female", "Perth Metropolitan", 6, -3, { referralId: "RF-RGHS-01", patientId: "PT-090" }],
    ["Male", "Great Southern", 210, 10, { patientId: "PT-G-AD-RGHS-02" }],
    ["Female", "Mid West", 17, 4, { patientId: "PT-G-AD-RGHS-03" }],
    ["Male", "Kimberley", 75, 2, { patientId: "PT-G-AD-RGHS-04" }],
    ["Female", "South West", 4, 5, { patientId: "PT-G-AD-RGHS-05" }],
    ["Male", "Goldfields-Esperance", null, null, { patientId: "PT-G-AD-RGHS-06" }],
    // Due home this afternoon (dischargeInDays 0.2 = 15:30 today), so the demo has a bed freeing
    // later today (DEFERRED from Test bed-matching, 26 Sept 2026). Was 1 (tomorrow).
    ["Female", "Pilbara", 115, 0.2, { patientId: "PT-G-AD-RGHS-07" }],
    ["Male", "Peel", 40, -1, { patientId: "PT-G-AD-RGHS-08" }],
    ["Female", "Wheatbelt", 1, 7, { patientId: "PT-G-AD-RGHS-09" }],
    ["Male", "Gascoyne", 26, 3, { patientId: "PT-G-AD-RGHS-10" }],
    ["Female", "Perth Metropolitan", 3, null, { patientId: "PT-G-AD-RGHS-11" }],
    ["Male", "Great Southern", 12, 4, { patientId: "PT-G-AD-RGHS-12" }],
    ["Female", "Mid West", 45, 6, { patientId: "PT-G-AD-RGHS-13" }],
  ]),
  ...unitOccupants("fre-adult-open", "FREA", ADULT_OPEN_DIAGNOSES, [
    ["Female", "Kimberley", 130, -2, { patientId: "PT-G-AD-FREA-01" }],
    ["Male", "South West", 5, 9, { patientId: "PT-G-AD-FREA-02" }],
    ["Female", "Goldfields-Esperance", 20, 2, { patientId: "PT-G-AD-FREA-03" }],
    ["Male", "Pilbara", 60, 8, { patientId: "PT-G-AD-FREA-04" }],
    ["Female", "Peel", 2, null, { blockReason: "Awaiting accommodation", patientId: "PT-G-AD-FREA-05" }],
    ["Male", "Wheatbelt", 95, 3, { patientId: "PT-G-AD-FREA-06" }],
    ["Female", "Gascoyne", 33, 5, { patientId: "PT-G-AD-FREA-07" }],
    ["Male", "Perth Metropolitan", 6, -3, { patientId: "PT-G-AD-FREA-08" }],
    ["Female", "Great Southern", 210, 10, { patientId: "PT-G-AD-FREA-09" }],
    ["Male", "Mid West", 17, 4, { patientId: "PT-G-AD-FREA-10" }],
    ["Female", "Kimberley", 75, 2, { patientId: "PT-G-AD-FREA-11" }],
    ["Male", "South West", 4, 5, { patientId: "PT-G-AD-FREA-12" }],
    ["Female", "Goldfields-Esperance", 9, null, { patientId: "PT-G-AD-FREA-13" }],
    ["Male", "Pilbara", 115, 1, { patientId: "PT-G-AD-FREA-14" }],
    ["Female", "Peel", 40, -1, { patientId: "PT-G-AD-FREA-15" }],
    ["Male", "Wheatbelt", 1, 7, { patientId: "PT-G-AD-FREA-16" }],
    ["Female", "Gascoyne", 26, 3, { patientId: "PT-G-AD-FREA-17" }],
    ["Male", "Perth Metropolitan", 3, null, { patientId: "PT-G-AD-FREA-18" }],
  ]),
  ...unitOccupants("fre-older-adult", "FREO", OLDER_ADULT_DIAGNOSES, [
    ["Female", "Great Southern", 12, 4, { patientId: "PT-G-AD-FREO-01" }],
    ["Male", "Mid West", null, 6, { patientId: "PT-052" }],
    ["Female", "Kimberley", 130, -2, { patientId: "PT-G-AD-FREO-03" }],
    ["Male", "South West", 5, 9, { patientId: "PT-G-AD-FREO-04" }],
    ["Female", "Goldfields-Esperance", 20, 2, { patientId: "PT-G-AD-FREO-05" }],
    ["Male", "Pilbara", 60, 8, { patientId: "PT-G-AD-FREO-06" }],
    ["Female", "Peel", 2, null, { patientId: "PT-G-AD-FREO-07" }],
    ["Male", "Wheatbelt", 95, 3, { patientId: "PT-G-AD-FREO-08" }],
    ["Female", "Gascoyne", 33, 5, { patientId: "PT-G-AD-FREO-09" }],
    ["Male", "Perth Metropolitan", 6, -3, { patientId: "PT-G-AD-FREO-10" }],
    ["Female", "Great Southern", 210, 10, { patientId: "PT-G-AD-FREO-11" }],
  ]),
  ...unitOccupants("bty-adult-secure", "BTYS", ADULT_SECURE_DIAGNOSES, [
    ["Female", "Mid West", 17, 4, { patientId: "PT-G-AD-BTYS-01" }],
    ["Male", "Kimberley", 75, 2, { patientId: "PT-G-AD-BTYS-02" }],
    ["Female", "South West", 4, 5, { patientId: "PT-G-AD-BTYS-03" }],
    ["Male", "Goldfields-Esperance", null, 6, { patientId: "PT-046" }],
    ["Female", "Pilbara", 115, 1, { blockReason: "Awaiting transport", patientId: "PT-G-AD-BTYS-05" }],
    ["Male", "Peel", 40, -1, { patientId: "PT-G-AD-BTYS-06" }],
    ["Female", "Wheatbelt", 1, 7, { patientId: "PT-G-AD-BTYS-07" }],
    ["Male", "Gascoyne", 26, 3, { patientId: "PT-G-AD-BTYS-08" }],
    ["Female", "Perth Metropolitan", 3, null, { patientId: "PT-G-AD-BTYS-09" }],
    ["Male", "Great Southern", 12, 4, { patientId: "PT-G-AD-BTYS-10" }],
    ["Female", "Mid West", 45, 6, { patientId: "PT-G-AD-BTYS-11" }],
    ["Male", "Kimberley", 130, -2, { patientId: "PT-G-AD-BTYS-12" }],
    ["Female", "South West", 5, 9, { patientId: "PT-G-AD-BTYS-13" }],
    ["Male", "Goldfields-Esperance", 20, 2, { patientId: "PT-G-AD-BTYS-14" }],
  ]),
  ...unitOccupants("bty-older-adult", "BTYO", OLDER_ADULT_DIAGNOSES, [
    ["Female", "Pilbara", null, 6, { patientId: "PT-G-WF-304" }],
    ["Male", "Peel", 2, null, { patientId: "PT-G-AD-BTYO-02" }],
    ["Female", "Wheatbelt", 95, 3, { patientId: "PT-G-AD-BTYO-03" }],
    ["Male", "Gascoyne", 33, 5, { patientId: "PT-G-AD-BTYO-04" }],
    ["Female", "Perth Metropolitan", 6, -3, { referralId: "RF-BTYO-05", patientId: "PT-094" }],
    ["Male", "Great Southern", 210, 10, { patientId: "PT-G-AD-BTYO-06" }],
    ["Female", "Mid West", 17, 4, { patientId: "PT-G-AD-BTYO-07" }],
    ["Male", "Kimberley", 75, 2, { patientId: "PT-G-AD-BTYO-08" }],
    ["Female", "South West", 4, 5, { patientId: "PT-G-AD-BTYO-09" }],
    ["Male", "Goldfields-Esperance", 9, null, { patientId: "PT-G-AD-BTYO-10" }],
  ]),
  ...unitOccupants("bty-youth", "BTYY", YOUTH_DIAGNOSES, [
    ["Male", "Wheatbelt", null, null, { patientId: "PT-G-AD-BTYY-01" }],
    ["Female", "Perth Metropolitan", 115, 1, { patientId: "PT-031" }],
    ["Male", "Perth Metropolitan", 40, -1, { patientId: "PT-037" }],
    ["Female", "Wheatbelt", 1, 7, { patientId: "PT-G-AD-BTYY-04" }],
    ["Male", "South West", 26, 3, { patientId: "PT-027" }],
    ["Female", "Perth Metropolitan", 3, null, { patientId: "PT-G-AD-BTYY-06" }],
    ["Male", "Great Southern", 12, 4, { patientId: "PT-G-AD-BTYY-07" }],
  ]),
  ...unitOccupants("gry-adult-secure", "GRYS", ADULT_SECURE_DIAGNOSES, [
    ["Female", "Mid West", 45, 6, { patientId: "PT-G-AD-GRYS-01" }],
    ["Male", "Kimberley", 130, -2, { patientId: "PT-G-AD-GRYS-02" }],
    ["Female", "South West", 5, 9, { patientId: "PT-G-AD-GRYS-03" }],
    [
      "Male",
      "Goldfields-Esperance",
      20,
      2,
      { blockReason: "Awaiting receiving-service acceptance", patientId: "PT-G-AD-GRYS-04" },
    ],
    ["Female", "Pilbara", 60, 8, { patientId: "PT-G-AD-GRYS-05" }],
    ["Male", "Peel", 2, null, { patientId: "PT-G-AD-GRYS-06" }],
    ["Female", "Wheatbelt", 95, 3, { patientId: "PT-G-AD-GRYS-07" }],
    ["Male", "Gascoyne", 33, 5, { patientId: "PT-G-AD-GRYS-08" }],
    ["Female", "Perth Metropolitan", 6, -3, { referralId: "RF-GRYS-09", patientId: "PT-092" }],
    ["Male", "Great Southern", 210, 10, { patientId: "PT-G-AD-GRYS-10" }],
    ["Female", "Mid West", 17, 4, { patientId: "PT-G-AD-GRYS-11" }],
    ["Male", "Kimberley", 75, 2, { patientId: "PT-G-AD-GRYS-12" }],
    ["Female", "South West", 4, 5, { patientId: "PT-G-AD-GRYS-13" }],
  ]),
  ...unitOccupants("gry-older-adult", "GRYO", OLDER_ADULT_DIAGNOSES, [
    ["Female", "Goldfields-Esperance", 9, null, { patientId: "PT-G-AD-GRYO-01" }],
    ["Male", "Pilbara", 115, 1, { patientId: "PT-G-AD-GRYO-02" }],
    ["Female", "Peel", 40, -1, { patientId: "PT-G-AD-GRYO-03" }],
    ["Male", "Wheatbelt", 1, 7, { patientId: "PT-G-AD-GRYO-04" }],
    ["Female", "Gascoyne", 26, 3, { patientId: "PT-G-AD-GRYO-05" }],
    ["Male", "Perth Metropolitan", 3, null, { patientId: "PT-G-AD-GRYO-06" }],
    ["Female", "Great Southern", 12, 4, { patientId: "PT-G-AD-GRYO-07" }],
    ["Male", "Mid West", 45, 6, { patientId: "PT-G-AD-GRYO-08" }],
    ["Female", "Kimberley", 130, -2, { patientId: "PT-G-AD-GRYO-09" }],
  ]),
  ...unitOccupants("alb-adult-open", "ALBA", ADULT_OPEN_DIAGNOSES, [
    ["Female", "Great Southern", 150, 2, { patientId: "PT-G-AD-ALBA-01" }],
    ["Female", "South West", 5, 9, { patientId: "PT-G-AD-ALBA-02" }],
    ["Male", "Goldfields-Esperance", null, 6, { patientId: "PT-G-WF-325" }],
    ["Female", "Pilbara", 60, 8, { patientId: "PT-G-AD-ALBA-04" }],
    ["Male", "Peel", 2, null, { patientId: "PT-G-AD-ALBA-05" }],
    ["Female", "Wheatbelt", 95, 3, { patientId: "PT-G-AD-ALBA-06" }],
    ["Male", "Gascoyne", 33, 5, { patientId: "PT-G-AD-ALBA-07" }],
  ]),
  ...unitOccupants("bun-adult-open", "BUNA", ADULT_OPEN_DIAGNOSES, [
    ["Female", "Perth Metropolitan", 6, -3, { patientId: "PT-G-AD-BUNA-01" }],
    ["Male", "Great Southern", 210, 10, { patientId: "PT-G-AD-BUNA-02" }],
    ["Female", "Mid West", 17, 4, { patientId: "PT-G-AD-BUNA-03" }],
    ["Male", "Kimberley", 75, 2, { patientId: "PT-G-AD-BUNA-04" }],
    [
      "Female",
      "South West",
      4,
      5,
      { blockReason: "Awaiting family or carer arrangement", patientId: "PT-G-AD-BUNA-05" },
    ],
    ["Male", "Goldfields-Esperance", 9, null, { patientId: "PT-G-AD-BUNA-06" }],
    ["Female", "Pilbara", 115, 1, { patientId: "PT-G-AD-BUNA-07" }],
  ]),
  ...unitOccupants("brm-adult-secure", "BRMS", ADULT_SECURE_DIAGNOSES, [
    ["Male", "Kimberley", 7, -1, { patientId: "PT-G-AD-BRMS-01" }],
    ["Male", "Peel", 40, -1, { patientId: "PT-G-AD-BRMS-02" }],
    ["Male", "Wheatbelt", 1, 7, { patientId: "PT-G-AD-BRMS-03" }],
    ["Male", "Gascoyne", 26, 3, { patientId: "PT-G-AD-BRMS-04" }],
    ["Male", "Perth Metropolitan", 3, null, { patientId: "PT-G-AD-BRMS-05" }],
  ]),
  ...unitOccupants("ger-adult-open", "GERA", ADULT_OPEN_DIAGNOSES, [
    [
      "Female",
      "Mid West",
      91,
      5,
      { blockReason: "Awaiting family or carer arrangement", patientId: "PT-G-AD-GERA-01" },
    ],
    ["Female", "Great Southern", 12, 4, { patientId: "PT-G-AD-GERA-02" }],
    ["Female", "Mid West", null, 6, { patientId: "PT-G-WF-318" }],
    ["Female", "Kimberley", 130, -2, { patientId: "PT-G-AD-GERA-04" }],
    ["Female", "South West", 5, 9, { patientId: "PT-G-AD-GERA-05" }],
    ["Female", "Goldfields-Esperance", 20, 2, { patientId: "PT-G-AD-GERA-06" }],
  ]),
  // Kununurra has no mental health ward (Josh, 26 Sept 2026), so these five Kimberley-area people
  // are in Broome's Mabu Liyan unit. The "KUNA" record ids and the diagnosis pool are kept so no
  // generated patient name or date of birth moves.
  ...unitOccupants("brm-adult-secure", "KUNA", ADULT_OPEN_DIAGNOSES, [
    ["Female", "Kimberley", 4, 1, { patientId: "PT-G-AD-KUNA-01" }],
    ["Female", "Pilbara", 60, 8, { patientId: "PT-G-AD-KUNA-02" }],
    ["Male", "Peel", 2, null, { patientId: "PT-G-AD-KUNA-03" }],
    ["Female", "Wheatbelt", 95, 3, { patientId: "PT-G-AD-KUNA-04" }],
    ["Male", "Gascoyne", 33, 5, { patientId: "PT-G-AD-KUNA-05" }],
  ]),
  ...unitOccupants("sjgs-adult-open", "SJSA", ADULT_OPEN_DIAGNOSES, [
    // A confirmed discharge on a second site, so no board test can pass by looking at one ward.
    ["Female", "Perth Metropolitan", 6, -3, { confirmedHoursAgo: 8, patientId: "PT-G-AD-SJSA-01" }],
    ["Male", "Great Southern", 210, 10, { patientId: "PT-G-AD-SJSA-02" }],
    ["Female", "Mid West", null, 4, { patientId: "PT-055" }],
    ["Male", "Kimberley", 75, 2, { patientId: "PT-G-AD-SJSA-04" }],
    ["Female", "South West", 4, 5, { patientId: "PT-G-AD-SJSA-05" }],
    ["Male", "Goldfields-Esperance", 9, null, { patientId: "PT-G-AD-SJSA-06" }],
    ["Female", "Pilbara", 115, 1, { patientId: "PT-G-AD-SJSA-07" }],
    ["Male", "Peel", 40, -1, { patientId: "PT-G-AD-SJSA-08" }],
  ]),
  ...unitOccupants("sjgs-adult-secure", "SJSS", ADULT_SECURE_DIAGNOSES, [
    ["Female", "Wheatbelt", 1, 7, { patientId: "PT-G-AD-SJSS-01" }],
    ["Male", "Gascoyne", 26, 3, { patientId: "PT-G-AD-SJSS-02" }],
    ["Female", "Perth Metropolitan", 3, null, { patientId: "PT-G-AD-SJSS-03" }],
    ["Male", "Great Southern", 12, 4, { patientId: "PT-G-AD-SJSS-04" }],
    ["Female", "Mid West", 45, 6, { patientId: "PT-G-AD-SJSS-05" }],
    ["Male", "Kimberley", 130, -2, { blockReason: "Awaiting clean", patientId: "PT-G-AD-SJSS-06" }],
    ["Female", "South West", 5, 9, { patientId: "PT-G-AD-SJSS-07" }],
  ]),
];

/**
 * Admissions that have ENDED. None of them holds a bed, so none counts in any ward's sex mix.
 *
 * Five, each carrying a different destination, because `LEAVING_DESTINATIONS` is the one list in
 * this feature where an entry's meaning differs from its neighbours': exactly one destination does
 * NOT return a bed to the state.
 *
 * **`AD-LEFT-02` is the only transfer to another psychiatric ward in the whole seed, and that is
 * deliberate.** It is the single seeded case of a departure that frees the SENDING ward's bed and
 * gives the network nothing — the person still occupies a psychiatric bed, just a different one.
 * Any statewide release figure that quietly counted it would otherwise pass every test in this
 * repository, because there would be no seeded case to catch it. Changing this one destination is
 * the mutation that proves the coverage test can fail; do not add a second transfer without
 * knowing you have weakened that proof.
 *
 * `AD-LEFT-01` (Perth Metropolitan, at Armadale) and `AD-LEFT-04` (Great Southern, at Albany) are
 * both departures from beds that `ward-distance.ts` bands as out of area, so the ledger's exit path
 * has seeded content and does not depend on that single transfer record either.
 */
const departures: Admission[] = [
  departed({
    id: "AD-LEFT-01",
    unitId: "arm-adult-open",
    sex: "Female",
    homeRegion: "Perth Metropolitan",
    tentativeDiagnosis: "F30–F39",
    stayDays: 23,
    leftMinutesAgo: 300,
    destination: "discharged-to-the-community",
    // THE CASE THE COMMUNITY HUB EXISTS FOR: went home, and somebody recorded that no follow-up
    // was arranged. Not an oversight in the fixture - the one row that makes the hub list 1 able
    // to show anybody at all, and the only place this prototype states that fact about a person.
    followUp: { state: "not_arranged", recordedAt: WARD_ADMISSIONS_ANCHOR - 300, recordedBy: "Ward manager" },
    /*
     * ⚠️ **THE ONE REAL JOIN BACK TO THE FRONT DOOR IN THE WHOLE SEED.**
     *
     * `RF-010` (`ward-movements.ts`) is a community-only referral naming "Inner City Clinic". It
     * is a REAL id, not one composed from `AD-LEFT-01` — that composition is what every other
     * admission in this file does, and it is why `admissionBelongsToTeam` returned false for every
     * admission against all 65 community teams and why `referralToBedJoin` measured nought.
     *
     * ⚠️ **CHRONOLOGY IS THE POINT, AND THE MARGIN IS HOURS RATHER THAN DAYS.** RF-010 is raised
     * 24 days before the anchor; this stay is 23 days and ended 300 minutes ago, so the pull sits
     * 14 hours after the referral and the arrival 19 hours after it, and the pair can carry a
     * duration. **`stayDays: 24` would put the arrival 5 hours BEFORE the referral** — that is the
     * next value, not a distant one — and it breaks the pair silently on the screens and loudly in
     * `tests/ward-statistics-derivations.test.ts`, which asserts `chronologicallyCoherentCount`.
     * `52ad01dda` populated nine team pages without that property and every pair it made was
     * meaningless; a defect reintroduced as a repair is the hardest kind to find later.
     *
     * This is also what finally gives `followUp` above a READER: the hub reaches this admission
     * only through this id.
     */
    referralId: "RF-010",
    movementId: null,
    patientId: "PT-010",
  }),
  departed({
    id: "AD-LEFT-02",
    unitId: "rph-adult-secure",
    sex: "Male",
    homeRegion: "Kimberley",
    tentativeDiagnosis: "F20–F29",
    stayDays: 41,
    leftMinutesAgo: 180,
    destination: "transferred-to-another-psychiatric-ward",
    // Still an inpatient somewhere else, so nobody was asked about community follow-up. null is
    // the honest answer, not a gap to fill.
    followUp: null,
    patientId: "PT-098",
  }),
  departed({
    id: "AD-LEFT-03",
    unitId: "fre-adult-open",
    sex: "Female",
    homeRegion: "Wheatbelt",
    tentativeDiagnosis: null,
    stayDays: 9,
    leftMinutesAgo: 900,
    destination: "transferred-to-a-general-hospital",
    followUp: null,
    patientId: "PT-099",
  }),
  departed({
    id: "AD-LEFT-04",
    unitId: "alb-adult-open",
    sex: "Male",
    homeRegion: "Great Southern",
    tentativeDiagnosis: "F00–F09",
    stayDays: 112,
    leftMinutesAgo: 1200,
    destination: "moved-to-residential-care",
    // Care continues and somebody wrote that down. The contrast with AD-LEFT-01 is the point: two
    // recorded answers and three unrecorded ones, so no test can pass by treating null as either.
    followUp: { state: "arranged", recordedAt: WARD_ADMISSIONS_ANCHOR - 1200, recordedBy: "Ward manager" },
    patientId: "PT-100",
  }),
  departed({
    id: "AD-LEFT-05",
    unitId: "scgh-adult-open",
    sex: "Male",
    homeRegion: "Goldfields-Esperance",
    tentativeDiagnosis: "F10–F19",
    stayDays: 6,
    leftMinutesAgo: 2600,
    destination: "left-against-advice",
    // The commonest real shape: the admission ended and nobody recorded anything about follow-up.
    followUp: null,
    patientId: "PT-101",
  }),
];

/**
 * Accepted in principle, no bed given. They hold nothing, so they change no occupancy figure —
 * they are here because a ward board shows who is coming as well as who is here, and because
 * `admissionsForUnit` returning them is a behaviour with no seeded case otherwise.
 */
const waitlist: Admission[] = [
  waiting("AD-WAIT-01", "scgh-adult-open", "Female", "Peel", "F40–F48", "PT-102"),
  waiting("AD-WAIT-02", "fsh-older-adult", "Male", "Perth Metropolitan", "F00–F09", "PT-103"),
  waiting("AD-WAIT-03", "bty-youth", "Female", "Goldfields-Esperance", null, "PT-104"),
];

/**
 * The seed, in lifecycle order: people in beds, then people gone, then people waiting.
 *
 * Consumed by the ward board and by the out-of-area ledger. Neither may add a field to `Admission`
 * to make something here expressible — that is a governance decision, not an implementation one.
 */

/** Pulled beds held by routineMovements-generated WF-304/311/318/325 (stageFields admissionId). */

export const wardAdmissions: Admission[] = [...occupiedBeds, ...departures, ...waitlist];

/**
 * Three synthetic planned admissions for the calendar (stream D, 9 October 2026), authored against
 * `WARD_ADMISSIONS_ANCHOR` like every instant above. One links an existing synthetic patient with
 * no live stay; two carry initials only. The respite booking's expected arrival is earlier today,
 * so the seeded day already shows one planned arrival overdue in the action inbox.
 *
 * Every figure is invented: the stay lengths are a ward's own plan, not a legal period.
 */
export const wardPlannedAdmissions: PlannedAdmission[] = [
  {
    id: "PA-SEED-01",
    patientId: null,
    initials: "JM",
    sex: "Male",
    gender: "Male",
    reason: "court_ordered",
    unitId: "rph-adult-secure",
    expectedArrivalAt: MINUTES_PER_DAY + 10 * 60,
    expectedStayDays: 28,
    legalStatus: "Involuntary inpatient",
    ageBand: "Adult",
    state: "booked",
    bookedAt: WARD_ADMISSIONS_ANCHOR - 2 * MINUTES_PER_DAY,
    bookedBy: "Flow coordinator",
    changedAt: null,
    changeCount: 0,
    cancelledAt: null,
    cancelReason: null,
    convertedAt: null,
    admissionId: null,
  },
  {
    id: "PA-SEED-02",
    patientId: "PT-007",
    initials: null,
    sex: "Female",
    reason: "planned_ect",
    unitId: "scgh-adult-open",
    expectedArrivalAt: 3 * MINUTES_PER_DAY + 8 * 60 + 30,
    expectedStayDays: 21,
    legalStatus: "Voluntary",
    ageBand: "Adult",
    state: "booked",
    bookedAt: WARD_ADMISSIONS_ANCHOR - 5 * MINUTES_PER_DAY,
    bookedBy: "Ward manager",
    changedAt: null,
    changeCount: 0,
    cancelledAt: null,
    cancelReason: null,
    convertedAt: null,
    admissionId: null,
  },
  {
    id: "PA-SEED-03",
    patientId: null,
    initials: "RK",
    sex: "Female",
    gender: "Female",
    reason: "respite",
    unitId: "fre-adult-open",
    expectedArrivalAt: 9 * 60 + 30,
    expectedStayDays: 7,
    legalStatus: "Voluntary",
    ageBand: "Adult",
    state: "booked",
    bookedAt: WARD_ADMISSIONS_ANCHOR - MINUTES_PER_DAY,
    bookedBy: "Flow coordinator",
    changedAt: null,
    changeCount: 0,
    cancelledAt: null,
    cancelReason: null,
    convertedAt: null,
    admissionId: null,
  },
];

/**
 * The cohort of the ward an occupant is in, read from the standard ward id's own suffix: every
 * standard ward id ends in `-youth`, `-older-adult` or an adult suffix. Used only to give a
 * generated occupant a date of birth in the right age band.
 */
function occupantCohort(unitId: string): GeneratedSeedPatientCohort {
  if (unitId.endsWith("-youth")) return "Youth";
  if (unitId.endsWith("-older-adult")) return "Older adult";
  return "Adult";
}

/**
 * The generated people in these beds (seed-link plan task T1 names them `PT-G-<admission id>`),
 * built here, next to the records they describe, as `ward-patients-seed.ts` asks. Owner rule,
 * 25 Sept 2026: every seeded record belongs to a patient who exists.
 */
export const generatedOccupantPatients: Patient[] = wardAdmissions
  .filter((admission) => admission.patientId?.startsWith("PT-G-"))
  .map((admission, index) =>
    generateSeedPatient({
      recordId: (admission.patientId as string).slice("PT-G-".length),
      sex: admission.sex,
      gender: admission.gender,
      cohort: occupantCohort(admission.unitId),
      index,
    }),
  );
