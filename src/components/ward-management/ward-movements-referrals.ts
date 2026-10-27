/**
 * The seeded referrals: the hand-authored front door referrals and the Midland demonstration rows.
 * Moved unchanged out of `ward-movements.ts` (F-17 file split, 26 Oct 2026), which re-exports
 * `referrals` and `MIDLAND_DEMONSTRATION_ROWS`, so importers are unchanged. Read it through
 * `ward-movements.ts`, like the rest of the frozen fixture (`tests/ward-flow-single-source.test.ts`).
 */
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import type { Cohort, Referral, UrgencyLevel } from "@/components/ward-management/ward-model";
import type { PatientId } from "@/components/ward-management/ward-patients";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { completeSyntheticReferralIntakes } from "./ward-referral-intake-seed";

/**
 * How long before the anchor `RF-010`, the seed's community-only referral, was raised — in whole
 * days, because the admission it is joined to is measured in days.
 *
 * ⚠️ **IT IS A CONSTRAINT, NOT A PREFERENCE, AND THE MARGIN IS HOURS RATHER THAN A DAY.**
 * `AD-LEFT-01` (`ward-admissions-seed.ts`) is a 23-day stay that ended 300 minutes before the
 * anchor, so it was pulled 23 days 10 hours ago and arrived 23 days 5 hours ago. A referral that
 * brought somebody in must precede their arrival, and `referralToBedJoin` counts exactly that.
 * At 24, this referral is raised **14 hours before the pull and 19 hours before the arrival** —
 * clear, but not a whole day, so do not read the round number as a day of slack. At 23 the
 * arrival would fall 5 hours BEFORE the referral, which is the defect `52ad01dda` shipped and
 * `fa616d1c9` removed. If the seed ever needs more room, raise this figure rather than shortening
 * the stay.
 *
 * The two files cannot import from one another — `tests/ward-flow-single-source.test.ts` allows
 * only four files to read this fixture, and the admission seed is not among them — so the coupling
 * is held by the assertion on `chronologicallyCoherentCount` in
 * `tests/ward-statistics-derivations.test.ts` rather than by a shared constant.
 *
 * ⚠️ **THE NAME AVOIDS "REFERRAL" DELIBERATELY, AND A RENAME MUST KEEP AVOIDING IT.**
 * `tests/ward-legal-figure-guard.test.ts` fails any SCREAMING_SNAKE_CASE identifier under this
 * directory that carries a legal token (`REFERRAL` is one) beside a duration token (`DAYS` is
 * one) — the shape all three deleted Mental Health Act fabrications took. This constant is a
 * fixture offset and nothing statutory, so the guard is a false positive here; the answer is to
 * name it out of the way rather than to widen the net that caught it.
 */
const RF_010_RAISED_DAYS_BEFORE_ANCHOR = 24;

/**
 * Phase 7 (spec "The front door"): referrals arriving from anywhere in the network, before any
 * of them is ever a `Movement` inside a department. Hand-authored, and deliberately opens on the
 * awkward cases rather than the easy ones — see `tests/ward-referral-model.test.ts` for exactly
 * what each one proves:
 *   - RF-001: queued, `ageBand: "Youth"` + `secureBedNeeded: true` — structurally unmatchable
 *     everywhere in this network, because the one Youth unit (`bty-youth`, EMyU) is `"Open"`, and
 *     no other unit anywhere carries `cohort: "Youth"`.
 *   - RF-002: accepted at `ger-adult-open`, the network's one `"Female only"` designated bed —
 *     a designated bed correctly accepting the sex it names.
 *   - RF-003: `sex: "Male"`, accepted at `scgh-adult-open`, an `"Undesignated"` bed — while
 *     `ger-adult-open` ("Female only") would correctly exclude this same referral. This is the
 *     seed rule-4(d) case: an equality-shaped matching bug (`bed.sexDesignation === referral.sex`)
 *     would wrongly refuse this referral everywhere, because `"Undesignated" !== "Male"` reads as
 *     a mismatch even though an undesignated bed accepts every sex. RF-003 also carries
 *     `involuntaryBedNeeded: true`, seeding the `legal_status` accepts-rule: `scgh-adult-open` is
 *     authorised and correctly accepts it, while `sjgs-adult-open` (Adult/Open/Undesignated, but
 *     NOT authorised) is a real bed elsewhere in the network that correctly refuses it — the
 *     dimension is testable rather than decorative.
 *   - RF-004: declined, `declineReason: "belongs_to_another_service"` — an administrative fact
 *     about the referral's origin, not a judgement on the person. Phase 8 Task 6 renamed this
 *     reason from `"out_of_catchment"`: nothing in this model holds a catchment for anybody, so
 *     the old spelling implied a check the system never performed.
 *   - RF-006: `secureBedNeeded: true`, `sex: "Male"`, accepted at `fsh-adult-secure` — the
 *     network's `"Male only"` designated Secure bed (fix round B, review finding M1 — moved here
 *     from `brm-adult-secure`, whose own comment explains why a forensic unit can never be the
 *     bed a referral is recorded as accepted into). `fsh-adult-secure` correctly accepting the
 *     sex it names mirrors RF-002's `ger-adult-open` case for the other sex. RF-006 also seeds
 *     the out-of-area case `homeRegion` exists to measure. Stated as the field values only:
 *     `homeRegion` is `"Kimberley"`, `originSiteCode` is `"BRM"` (Broome Hospital, `service:
 *     "WACHS"`), and the accepted unit `fsh-adult-secure` sits at site `FSH` under `service:
 *     "South Metro"` — so home region and accepting service differ, and that difference is the
 *     whole of what this seed holds for the equity ledger Phase 8 builds to read.
 *
 *     NO DISTANCE is stated or implied, and no claim is made here about how WA's rural mental
 *     health system actually behaves. This prototype holds no distances, travel times or
 *     ordering by proximity — see `Referral.homeRegion`'s own doc comment, which says computing
 *     one is Phase 8's work and deliberately not built. (Fix round C, F8: this comment used to
 *     assert both. A comment asserting an unchecked real-world fact is exactly how the deleted
 *     Form 1A figure entered this codebase — an agent read it, believed it, wrote it into the
 *     model. Nothing renders a comment, and that is not the reason it matters.)
 *   - RF-007: `ageBand: "Youth"`, accepted at `bty-youth` (EMyU) — the successful youth match
 *     RF-001 deliberately is not (review finding M1's related note): the age dimension is only
 *     honourable if at least one seed path shows it actually working, not only failing. Also
 *     out-of-area, from Geraldton (Mid West). WARD-ONLY since 2026-09-01; see its own comment for
 *     why the community arm it used to carry was split out to RF-010 rather than trimmed away.
 *   - RF-010: addressed to a COMMUNITY TEAM and to nothing else — the shape that gives the
 *     coordinator-visibility rule its `{community_team}` case — and the referral a seeded
 *     admission points at (`AD-LEFT-01`, `ward-admissions-seed.ts`). ⚠️ **Deliberately not
 *     described as "the only" of either kind:** the comment on its own community arm records
 *     what a count written here costs, and it is the same file that has already paid it twice.
 *     Two more lines below carried a count and are left alone only because they name a
 *     PROPERTY that is checked elsewhere rather than a tally nothing guards.
 *     See its
 *     own comment: it carries RF-007's community fixture forward, gives the coordinator-visibility
 *     rule its `{community_team}` case, and is timed so the join it forms can carry a duration.
 *   - RF-008: Phase 8 Task 2. The only accepted referral whose travel band — looked up from its
 *     home region to the site of the unit it was accepted into — is one of `OUT_OF_AREA_BANDS`.
 *     It records no arrival (Task 2R removed arrivals from this type entirely); it is kept
 *     because it is the one seeded referral an out-of-area admission can honestly be joined to.
 *     See its own comment below for why what it shows on screen will read oddly on purpose.
 *   - RF-011: addressed to a psychiatric ward AND an emergency department AT ONCE (owner ruling,
 *     2026-09-01: FD-23 forbids `{psychiatric_ward, community_team}` only — a bed request and a
 *     self-addressed ED psychiatric review are a permitted pair, named as such in
 *     `ward-referral-visibility.ts`'s own doc comment). Added because `FD-23` — a ward may not see
 *     where else a patient has been referred; the coordinator may — had no seeded referral to show
 *     it working on: every other seeded referral carries exactly one destination, so the rule was
 *     real and untestable against the shipped fixture. `tests/ward-referral-visibility.test.ts`
 *     reads this referral to prove the ward-scoped projection of a real seeded record hides the ED
 *     arm while the coordinator's projection carries both. Both arms are left `queued` deliberately
 *     — this fixture exists to demonstrate the privacy boundary, not to exercise FD-22's
 *     cancel-on-acceptance behaviour, which the reducer-built fixture in that test file already
 *     covers.
 *   - RF-012 and RF-013: the origins of `WF-002` and `WF-009` (owner ruling R-2026-09-04-D). They
 *     are the only referrals any seeded MOVEMENT points at, and their own comment below explains
 *     why they had to be authored rather than picked from the nine above.
 *
 * Phase 8 Task 2R REMOVED the arrivals this fixture briefly carried. A referral no longer records
 * arriving anywhere: `Admission` (`ward-admissions.ts`) is the one record of a person occupying a
 * bed, it carries both a pull time and an arrival time, and — unlike an accepted referral, which
 * is accepted forever — it also carries `state: "departed"` and `leftAt`, so somebody discharged
 * weeks ago leaves the out-of-area ledger instead of accumulating time on it indefinitely. That
 * missing exit was a real defect in the referral-based version, not a preference.
 *
 * NOTHING IS SEEDED FOR THAT LEDGER YET. No `Admission` fixture exists in this file or anywhere
 * else, so the ledger has no seeded content in any shape; it is exercised only by test-local
 * admissions. The seed fixture is owned by the workstream that built `Admission` and is in flight
 * on its own branch — see `tests/ward-travel-grouping.test.ts` for the shapes it must cover. Do
 * not close that gap by seeding one here: two authors seeding the same fixture is a merge
 * collision in which one set is thrown away.
 *
 * No referral stores a band, and neither does an admission: a band is a fact about a (home
 * region, site) pair and is only ever looked up, through `ward-distance.ts`.
 * No referral carries anything beyond `ageBand`/`sex`/`secureBedNeeded`/`involuntaryBedNeeded`/
 * `homeRegion` about the person, no free text anywhere, `originSiteCode` is always one of
 * `wardSites`' own synthetic codes (never an address), and `homeRegion` is always one of
 * `HOME_REGIONS` (never an address), chosen to be plausible for the referral's origin site.
 */
/**
 * ⚠️ **DEMONSTRATION DATA. ONE TEAM. ADDED 2026-09-05 AT THE OWNER'S EXPLICIT REQUEST, AND NOT A
 * MODELLED CASE SERIES.** The owner asked for the community hub to be judgeable on a screen with
 * people on it, and chose ONE team — `"Midland"` — so that a single page is obviously populated and
 * the other 64 stay honestly empty. **Nothing here is evidence about how often somebody is admitted
 * while already with a community team.** Nine is a number picked to fill a page.
 *
 * ⚠️ **IT IS PURELY ADDITIVE, AND THAT IS THE SAFETY PROPERTY.** Not one admission changed. Every
 *
 * 🔴 CORRECTED 2026-09-11: "a value `ward-admissions-seed.ts` ALREADY manufactures from its
 * own admission's id" IS FALSE. The seed manufactures nothing. The nine Midland occupants now
 * carry an explicit `OccupantExtras.referralId` override, not a derived string (a6e5208b85).
 * ✅ THE SAFETY CLAIM ITSELF IS UNTOUCHED AND STILL CHECKED: adding these Referral fixture
 * rows is purely additive - no admission changed, no bed count, occupancy figure or discharge
 * list moves. That property is pinned against `tests/ward-statistics-derivations.test.ts` and
 * is independent of how the matching id was produced.
 * `id` below is a value `ward-admissions-seed.ts` ALREADY manufactures from its own admission's id
 * (`AD-XXXX-NN` -> `RF-XXXX-NN`), so these referrals resolve links that were previously dangling
 * rather than creating new people, new beds or new departures. No bed count, occupancy figure or
 * discharge list moves.
 *
 * ⚠️ **AND IT IS THE SHAPE `52ad01dda` GOT WRONG, DONE THE WAY `RF-010` DOES IT.** That commit
 * populated nine team pages the same way and was backed out at `fa616d1c9` for TWO reasons, both of
 * which are avoided here deliberately rather than by luck:
 *
 *   1. **Its referrals were `"queued"`, so nine requests for no bed at all sat at the top of the
 *      coordinator's bed-matching queue** — `referralQueueOrder` scopes to queued and nothing else.
 *      **Every referral below is `"accepted"`**, which is also the clinically true state: a team
 *      that has taken somebody on has answered. `RF-010` is the precedent — an accepted
 *      community-only addressing with no `acceptedUnitId`, because a team is not a bed.
 *   2. **Every pair it produced put the person in the bed BEFORE the referral existed**, so not one
 *      could carry a duration. **Each row below is raised, and answered, before its admission's bed
 *      was even pulled** — the `bedPulledDaysBeforeAnchor` column is the admission's own pull, copied
 *      here ONLY so the two columns after it can be read against something. It is not a second home
 *      for that fact: `tests/ward-community-demonstration-data.test.ts` reads BOTH fixtures and fails
 *      if this column, or the ordering it exists to make visible, ever stops matching the admissions
 *      seed. The two files cannot import one another — `tests/ward-flow-single-source.test.ts` allows
 *      only four readers of the admissions fixture and this is not one of them — so a test is the
 *      only place that coupling can live.
 *
 * ⚠️ **`joinedCount` IN `tests/ward-statistics-derivations.test.ts` MOVES FROM 1 TO 10 BECAUSE OF
 * THIS BLOCK, AND `chronologicallyCoherentCount` MOVES WITH IT.** Moving together is the property
 * that test actually guards: a match that cannot date a bed is the defect, never the count changing.
 * If you are reading this because that test went red at some other number, a demonstration row has
 * lost its lead over its admission — fix the row, do not adjust the figure.
 *
 * ⚠️ **EVERY ACCEPTANCE HERE IS OLDER THAN `RF-010`'s, AND THAT IS A HARD CONSTRAINT RATHER THAN A
 * PREFERENCE — IT IS THE `fa616d1c9` LESSON ARRIVING IN THE NEXT LIST ALONG.** The coordinator's
 * decided board is `recentlyDecidedReferrals`, which sorts by `decidedAt` descending and keeps only
 * `RECENTLY_DECIDED_DISPLAY_LIMIT` rows. The seed holds nine genuinely decided referrals, so three
 * demonstration rows accepted more recently than `RF-010` PUSHED `RF-010` OFF THAT BOARD — real
 * clinical data evicted by fixture data added for a different screen. It was caught by
 * `tests/ward-referral-screens.dom.test.tsx` naming the missing id, not by anybody looking.
 *
 * **So every row's `acceptedDaysBeforeAnchor` exceeds 24, `RF-010`'s own age**, and the nine sort
 * below all nine real ones. Exactly one demonstration row reaches that board, at the bottom. Raising
 * a row's acceptance above 24 days will silently evict a real referral again — the count still looks
 * right, and a different id quietly disappears.
 *
 * The suburbs are Midland's own, from `ward-catchment.ts`; the origin site is St John of God
 * Midland, the area's hospital, and every person is admitted somewhere else, which is the ordinary
 * case in this network rather than an oddity. `ageBand` matches the cohort of the unit each person
 * is actually in.
 */
export type MidlandDemonstrationRow = {
  readonly id: string;
  /** The admission this id already pointed at. Named so a reader can check the pair by hand. */
  readonly admissionId: string;
  /** The admission's own `pulledAt`, in days before the anchor. Context for the two columns below;
   *  the test, not this file, is what keeps it true. */
  readonly bedPulledDaysBeforeAnchor: number;
  readonly raisedDaysBeforeAnchor: number;
  /** When Midland said yes. Must exceed the pull column: the team accepted before the bed. */
  readonly acceptedDaysBeforeAnchor: number;
  readonly ageBand: Cohort;
  readonly suburb: string;
  readonly urgency: UrgencyLevel;
  readonly history: string;
  /**
   * D-14 (2026-09-11) set this on exactly one row, `RF-RPHS-14`, reusing the SAME real
   * referral-and-admission pair `admissionId` above already authors — `ward-admissions-seed.ts`
   * carries the matching `patientId` on `AD-RPHS-14` itself.
   *
   * Ward seed-audit follow-up, task T2 (2026-09-25): the other eight rows now carry one too, each
   * a new hand-authored patient (PT-090 to PT-097, `ward-patients-seed.ts` task T0) sharing this
   * row's `admissionId` the same way `RF-RPHS-14`/`PT-003` already did — never a hand-picked
   * patient with no referral behind it. `tests/ward-search-preview.dom.test.tsx` pins that
   * `wardPatients[1]` (`PT-002`) specifically must stay unlinked; none of these nine rows touches
   * PT-002.
   */
  readonly patientId?: PatientId;
};

export const MIDLAND_DEMONSTRATION_ROWS: readonly MidlandDemonstrationRow[] = [
  {
    id: "RF-RGHS-01",
    admissionId: "AD-RGHS-01",
    patientId: "PT-090",
    bedPulledDaysBeforeAnchor: 6.27,
    raisedDaysBeforeAnchor: 40,
    acceptedDaysBeforeAnchor: 30,
    ageBand: "Adult",
    suburb: "Bassendean",
    urgency: 2,
    history:
      "Known to the team for some years and had been disengaging from appointments. Taken back on for community follow-up shortly before this admission.",
  },
  {
    id: "RF-SCGA-07",
    admissionId: "AD-SCGA-07",
    patientId: "PT-091",
    bedPulledDaysBeforeAnchor: 6.27,
    raisedDaysBeforeAnchor: 45,
    acceptedDaysBeforeAnchor: 32,
    ageBand: "Adult",
    suburb: "Bellevue",
    urgency: 2,
    history:
      "Referred by their general practitioner after a period of worsening sleep and withdrawal. Accepted for community assessment, and admitted before the first appointment.",
  },
  {
    id: "RF-GRYS-09",
    admissionId: "AD-GRYS-09",
    patientId: "PT-092",
    bedPulledDaysBeforeAnchor: 6.27,
    raisedDaysBeforeAnchor: 50,
    acceptedDaysBeforeAnchor: 36,
    ageBand: "Adult",
    suburb: "Caversham",
    urgency: 2,
    history:
      "Referred from an emergency department after a brief presentation, for community follow-up rather than a bed. The team accepted and had begun visiting.",
  },
  {
    id: "RF-RPHS-14",
    admissionId: "AD-RPHS-14",
    patientId: "PT-003",
    bedPulledDaysBeforeAnchor: 6.27,
    raisedDaysBeforeAnchor: 55,
    acceptedDaysBeforeAnchor: 41,
    ageBand: "Adult",
    suburb: "Aveley",
    urgency: 3,
    history:
      "Long-standing contact with the service, referred back after moving into the area. Community follow-up was in place at the time of this admission.",
  },
  {
    id: "RF-SJGA-05",
    admissionId: "AD-SJGA-05",
    patientId: "PT-093",
    bedPulledDaysBeforeAnchor: 20.27,
    raisedDaysBeforeAnchor: 40,
    acceptedDaysBeforeAnchor: 33,
    ageBand: "Adult",
    suburb: "Beechboro",
    urgency: 3,
    history:
      "Referred for ongoing community treatment after a previous admission elsewhere. Seen at home twice before this presentation.",
  },
  {
    id: "RF-BTYO-05",
    admissionId: "AD-BTYO-05",
    patientId: "PT-094",
    bedPulledDaysBeforeAnchor: 6.27,
    raisedDaysBeforeAnchor: 60,
    acceptedDaysBeforeAnchor: 51,
    ageBand: "Older adult",
    suburb: "Ashfield",
    urgency: 3,
    history:
      "Older adult referred for community review of memory and mood, accepted by the team and reviewed at home. Admitted some weeks later.",
  },
  {
    id: "RF-ARMA-01",
    admissionId: "AD-ARMA-01",
    patientId: "PT-095",
    bedPulledDaysBeforeAnchor: 12.27,
    raisedDaysBeforeAnchor: 75,
    acceptedDaysBeforeAnchor: 66,
    ageBand: "Adult",
    suburb: "Bullsbrook",
    urgency: 3,
    history:
      "Referred by the crisis service after a home visit, for continuing community care. Under the team throughout the weeks before this admission.",
  },
  {
    id: "RF-ARMA-02",
    admissionId: "AD-ARMA-02",
    patientId: "PT-096",
    bedPulledDaysBeforeAnchor: 48.27,
    raisedDaysBeforeAnchor: 95,
    acceptedDaysBeforeAnchor: 88,
    ageBand: "Adult",
    suburb: "Boya",
    urgency: 3,
    history:
      "Transferred to the team after moving from another catchment. Community treatment was established well before this admission began.",
  },
  {
    id: "RF-FSHS-01",
    admissionId: "AD-FSHS-01",
    patientId: "PT-097",
    bedPulledDaysBeforeAnchor: 122.27,
    raisedDaysBeforeAnchor: 180,
    acceptedDaysBeforeAnchor: 170,
    ageBand: "Adult",
    suburb: "Brigadoon",
    urgency: 3,
    history:
      "Long-term community patient of the team, followed up for several months before this admission. The referral predates the current episode by some margin.",
  },
];

/**
 * The rows above as referrals. Built rather than written out nine times, so the property that makes
 * them safe — accepted, community-only, and answered before the bed — is stated once and cannot
 * hold on eight rows and quietly fail on the ninth.
 */
const midlandDemonstrationReferrals: Referral[] = MIDLAND_DEMONSTRATION_ROWS.map((row) => ({
  id: row.id,
  // D-14. Spread-with-condition, never `patientId: row.patientId`, so a row with no patient (none
  // currently — T2, seed-audit follow-up, linked the last eight) would produce a referral with NO
  // key at all rather than one holding `undefined` — the same discipline `wardScopedReferral`'s
  // own conditional spreads follow, and the shape `Referral.patientId`'s own doc comment requires
  // ("OPTIONAL ON PURPOSE").
  ...(row.patientId !== undefined ? { patientId: row.patientId } : {}),
  ageBand: row.ageBand,
  destinations: [
    {
      destination: { kind: "community_team", teamName: "Midland" },
      // Accepted, never queued — reason 1 in this block's own comment. `acceptedUnitId` is absent
      // for the same reason it is absent on `RF-010`: a team is not a bed.
      state: "accepted",
      decidedAt: NOW_ANCHOR - row.acceptedDaysBeforeAnchor * MINUTES_PER_DAY,
      decidedBy: "Community service",
    },
  ],
  homeRegion: "Perth Metropolitan",
  suburb: { kind: "named", name: row.suburb },
  source: "community",
  raisedAt: NOW_ANCHOR - row.raisedDaysBeforeAnchor * MINUTES_PER_DAY,
  urgency: row.urgency,
  originSiteCode: "SJGM",
  transportNeeded: false,
  history: row.history,
}));

export const referrals: Referral[] = completeSyntheticReferralIntakes([
  {
    id: "RF-001",
    // T2 (seed-audit follow-up, section 3): PT-079 (Tilly Mossgrave), hand-authored to agree —
    // Youth Female, Armadale/Armadale Community Team.
    patientId: "PT-079",
    ageBand: "Youth",
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          sex: "Female",
          gender: "Female", // R7 (25 Sept 2026): authored demo data, not derived at runtime
          secureBedNeeded: true,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
        state: "queued",
        // Closing-the-loop package A (24 Oct 2026), synthetic: the coordinator asked the youth unit
        // for a response, the ward acknowledged and promised an answer that is now overdue, and a
        // callback is booked. Shows the commitment line, "Promise overdue" and the call sheet.
        commitments: [
          { unitId: "bty-youth", step: "response_requested", at: NOW_ANCHOR - 35, by: "Bed coordinator" },
          { unitId: "bty-youth", step: "acknowledged", at: NOW_ANCHOR - 30, by: "Ward manager" },
          {
            unitId: "bty-youth",
            step: "promised",
            promisedFor: NOW_ANCHOR - 5,
            at: NOW_ANCHOR - 25,
            by: "Ward manager",
          },
          { unitId: "bty-youth", nextCallbackAt: NOW_ANCHOR + 20, at: NOW_ANCHOR - 24, by: "Bed coordinator" },
        ],
      },
    ],
    // Closing-the-loop package A, synthetic: two calls to the youth unit, so the chase count reads 3.
    contactLog: [
      {
        contact: { kind: "psychiatric_ward", unitId: "bty-youth" },
        outcome: "no_answer",
        at: NOW_ANCHOR - 36,
        by: "Bed coordinator",
      },
      {
        contact: { kind: "psychiatric_ward", unitId: "bty-youth" },
        outcome: "call_back",
        at: NOW_ANCHOR - 26,
        by: "Bed coordinator",
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    source: "community",
    raisedAt: NOW_ANCHOR - 40,
    urgency: 2,
    originSiteCode: "ARM",
    transportNeeded: true,
    history:
      "Referred by the community team after three weeks of worsening withdrawal and two missed depot appointments. Mother reports they have not left their room since the weekend. Known to the youth service for two years. Was on aripiprazole, stopped around a month ago.",
  },
  {
    id: "RF-002",
    // T2: PT-080 (Carys Nightbourne), hand-authored — Adult Female, Kununurra (no verified
    // catchment-team pairing in this fixture for that suburb, so the team stays unset).
    patientId: "PT-080",
    ageBand: "Adult",
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          unitId: "ger-adult-open",
          sex: "Female",
          // T10 (item 8): recorded so this referral, seeded as accepted at the network's one
          // Female-only ward, keeps passing `gender_designation` — never copied from `sex` in
          // bulk elsewhere in this fixture, only on the handful of referrals the gate's own
          // accepted-unit fact depends on.
          gender: "Female",
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
        state: "accepted",
        acceptedUnitId: "ger-adult-open",
        decidedAt: NOW_ANCHOR - 10,
        // Fix round B (review finding M2/M3): was "Bed management", a decider ACCEPT_REFERRAL
        // (ward-flow-reducer.ts) can never actually produce — the reducer writes the ACTING role's
        // label, and this seed records a coordinator's acceptance. (Until FD-25, 2026-08-30, the
        // event was coordinator-only and could write nothing else; a ward may now accept too, so
        // the label here is a choice about this seed rather than the only possible value.)
        decidedBy: "Bed coordinator",
      },
    ],
    homeRegion: "Kimberley",
    suburb: { kind: "named", name: "Kununurra" },
    source: "inter_hospital",
    raisedAt: NOW_ANCHOR - 90,
    triagedAt: NOW_ANCHOR - 215,
    urgency: 2,
    // Kununurra has no mental health ward (Josh, 26 Sept 2026), so this Kimberley referral comes
    // from Broome, where Kimberley patients go. Was "KUN".
    originSiteCode: "BRM",
    transportNeeded: true,
    history:
      "Transferred from the regional hospital medical ward. Settled on the ward but no local psychiatric bed available in town, and the medical reason for admission has resolved. Third presentation this year. Long trip home, so discharge planning needs the family involved early.",
  },
  {
    id: "RF-003",
    // T2: PT-081 (Emrys Oldacre), hand-authored — Adult Male, Nedlands/Inner City Community Team.
    patientId: "PT-081",
    ageBand: "Adult",
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          unitId: "scgh-adult-open",
          sex: "Male",
          gender: "Male", // R7 (25 Sept 2026): authored demo data, not derived at runtime
          secureBedNeeded: false,
          // Seeds the `legal_status` accepts-rule (D3 rule 2): needs a bed that can hold someone
          // involuntarily. Accepted at `scgh-adult-open`, which is authorised — and SJGS Adult Open
          // (`sjgs-adult-open`, Adult/Open/Undesignated but NOT authorised) is a real bed elsewhere in
          // the network that this same referral would correctly be refused by on `legal_status` alone,
          // proving the rule actually excludes something rather than passing for every bed.
          involuntaryBedNeeded: true,
          highAcuityNursingNeeded: false,
        },
        state: "accepted",
        acceptedUnitId: "scgh-adult-open",
        decidedAt: NOW_ANCHOR - 15,
        decidedBy: "Bed coordinator",
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Nedlands" },
    source: "crisis_service",
    raisedAt: NOW_ANCHOR - 55,
    // ⚠️ THE ONLY SEEDED REFERRAL WHOSE REFERRAL CLOCK HAS STOPPED, and it was missing: every
    // other triaged referral was triaged BEFORE anyone referred (the ED presentation), so
    // `sinceReferralRunning` was `true` across the whole fixture and the stopped branch rendered
    // nowhere. Measured across all nine before this was added, not assumed.
    //
    // This is the community-expect story `P9-D7` is about: a crisis service refers, and the
    // patient arrives 25 minutes LATER. The referral clock ends at 25 and stops; the department
    // clock starts then and runs. Found by Ward Referrals, whose screens are the ones that would
    // otherwise have shown one of the two wordings and never the other.
    triagedAt: NOW_ANCHOR - 30,
    urgency: 1,
    originSiteCode: "SCGH",
    transportNeeded: false,
    history:
      "Crisis team called overnight. Acute distress, not sleeping, and saying they cannot keep themselves safe at home tonight. Agreed to come in. Partner is with them and can stay until transport.",
  },
  {
    id: "RF-004",
    // T2 (seed-audit follow-up, section 2 item 3): was PT-004 (a 52-year-old man from Beckenham),
    // who contradicted this referral (Older adult, Mandurah, Peel). Re-pointed to PT-059
    // (Reginald Wickerby), hand-authored to agree. PT-004 is freed and re-linked to WF-RD11 (T3).
    patientId: "PT-059",
    ageBand: "Older adult",
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          unitId: "fsh-older-adult",
          sex: "Male",
          gender: "Male", // R7 (25 Sept 2026): authored demo data, not derived at runtime
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
        state: "declined",
        declineReason: "belongs_to_another_service",
        decidedAt: NOW_ANCHOR - 25,
        // Fix round B (review finding M2/M3): was "Duty psychiatrist". DECLINE_REFERRAL writes the
        // acting role's label; this seed records a coordinator's decline — see RF-002's comment above.
        decidedBy: "Bed coordinator",
      },
    ],
    homeRegion: "Peel",
    // Deliberately one of `CM-2`'s five contested suburbs: the owner's two catchment
    // documents disagree about it, `lookupCatchment` reports both readings and picks no
    // winner, and the front door still accepts the referral. Seeded so a screen has to
    // face that case rather than only the tidy one.
    suburb: { kind: "named", name: "Mandurah" },
    // Police found him; the crisis service referred him on (10 Oct 2026, police removed as a
    // source). Not ed_medical: a declined ed_medical referral needs a referral_declined notice to
    // the ED, which this reducer-free seed does not raise.
    source: "crisis_service",
    raisedAt: NOW_ANCHOR - 70,
    triagedAt: NOW_ANCHOR - 100,
    urgency: 3,
    originSiteCode: "PEEL",
    transportNeeded: true,
    history:
      "Brought to attention by police after being found disoriented near the foreshore in the early hours. Not known to local services. No treating team identified. Nothing in the record before today. Was found near water and could not say how he got there.",
  },
  {
    id: "RF-005",
    // T2 (section 2 item 4): was PT-005 (a 23-year-old), contradicting this referral (an older man
    // in residential care). Re-pointed to PT-060 (Cyril Coldharbour).
    patientId: "PT-060",
    ageBand: "Older adult",
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          sex: "Male",
          gender: "Male", // R7 (25 Sept 2026): authored demo data, not derived at runtime
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
        state: "queued",
        // Closing-the-loop package A, synthetic: a response requested of FSH Older Adult with a
        // callback booked inside the next shift, so the handover carries it over.
        commitments: [
          {
            unitId: "fsh-older-adult",
            step: "response_requested",
            nextCallbackAt: NOW_ANCHOR + 45,
            at: NOW_ANCHOR - 15,
            by: "Bed coordinator",
          },
        ],
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Murdoch" },
    source: "ambulance",
    raisedAt: NOW_ANCHOR - 20,
    // The widest gap in the seed and the reason `P9-D2` asks for two numbers: 165 minutes
    // in the department BEFORE anyone referred to mental health. One clock hides all of it.
    triagedAt: NOW_ANCHOR - 185,
    urgency: 2,
    originSiteCode: "FSH",
    transportNeeded: true,
    history:
      "Ambulance called by the residential home after two days of increasing confusion and refusing food and fluids. Staff say this is a marked change from his usual self. Lives in supported residential care. Physical health review may be needed alongside the psychiatric one.",
  },
  {
    id: "RF-006",
    // T2 (section 2 item 5): was PT-006 (a 73-year-old woman), contradicting this referral (an
    // adult man, no fixed address, bound for the male-only ward). Re-pointed to PT-061 (Darcy
    // Dunmorrow). PT-006 is freed and re-linked to WF-308, the routine generator's only fit for
    // her (Older adult Female, Midland team, East Metro) — see `routineMovements` in `ward-movements.ts`.
    patientId: "PT-061",
    ageBand: "Adult",
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          unitId: "fsh-adult-secure",
          sex: "Male",
          // T10 (item 8): recorded so this referral keeps passing `gender_designation` at
          // `fsh-adult-secure`, the network's one Male-only ward — see RF-002's own comment above.
          gender: "Male",
          secureBedNeeded: true,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
        state: "accepted",
        // Fix round B (review finding C1): was `acceptedUnitId: "brm-adult-secure"` — that unit is
        // `forensic: true`, and `referralEligibility` (ward-eligibility.ts) refuses every forensic
        // unit unconditionally (D7: "never offered"), on top of the unit's own `allocatable: 0` at
        // the time. `ACCEPT_REFERRAL` calls that same function, so the reducer would have refused
        // this exact acceptance — the seed recorded an acceptance the live system could not produce.
        // `fsh-adult-secure` is the network's real Male-only Secure bed (see the doc comment above)
        // and genuinely passes every gate; `referralEligibility(referral, unitById("fsh-adult-secure"),
        // NOW_ANCHOR).eligible` is asserted `true` for every accepted referral in
        // `tests/ward-referral-model.test.ts`, which is the four-line test that would have caught the
        // original seed at Task 1.
        acceptedUnitId: "fsh-adult-secure",
        decidedAt: NOW_ANCHOR - 5,
        // Fix round B (review finding M2/M3): was "Bed management" — see RF-002's own comment above.
        decidedBy: "Bed coordinator",
      },
    ],
    // Out of area on purpose — see this fixture's own doc comment above.
    homeRegion: "Kimberley",
    /*
     * 🔴 THE ONLY SEEDED REFERRAL WITH NO SUBURB, and it was missing for two hours after the union
     * that allows it landed. `Referral.suburb` gained an `unknown` arm specifically so a patient of
     * no fixed abode could be referred at all — and then every one of the nine seeded referrals
     * named a place, so `suburbUnknownLabels` rendered on no screen anywhere. Caught by the branch
     * guard rather than by a person; the fix and its own missing fixture are the same defect one
     * layer apart.
     *
     * Police-brought is the archetype, which is why it sits here: somebody brought in at 3am with
     * no address on record. ⚠️ `homeRegion` stays `Kimberley` and that is not a contradiction —
     * a service can know the broad area somebody is from without knowing where they live, which is
     * exactly why the two facts are stored separately and neither is derived from the other.
     */
    suburb: { kind: "unknown", reason: "not_known" },
    source: "crisis_service",
    raisedAt: NOW_ANCHOR - 65,
    triagedAt: NOW_ANCHOR - 80,
    urgency: 1,
    originSiteCode: "BRM",
    transportNeeded: false,
    history:
      "Police attendance in the city. Acutely unwell, no fixed address, and unable to give a suburb — which is why the suburb field is recorded as not known rather than guessed. Unable to give a contact or a next of kin at the time of referral.",
  },
  {
    id: "RF-007",
    // T2 (section 2 item 6): was PT-007 (56, non-binary, Como), contradicting this referral (a
    // young woman from Geraldton). Re-pointed to PT-062 (Ellery Esterhall).
    patientId: "PT-062",
    // Fix round B (review finding M1's related note): the seed's only other youth referral,
    // RF-001, is deliberately unmatchable everywhere — so nothing in the seed demonstrated a
    // successful youth match against EMyU, the whole point of the age dimension being honourable
    // rather than decorative. This referral is that missing case: Youth, no secure bed needed (so
    // the Open EMyU can actually accept it), accepted at `bty-youth`.
    //
    /*
     * ⚠️ **WARD-ONLY SINCE 2026-09-01. THE COMMUNITY ARM WAS SPLIT OUT INTO `RF-010`, NOT DELETED.**
     *
     * This referral carried a `community_team` arm (`"Inner City Clinic"`, `queued`) beside the
     * ward arm below, and the pair was the exact shape owner rulings 13 and 14 forbid
     * (`docs/ward-flow/owner-rulings-2026-09-01-bed-states-and-community.md`): *"a community
     * referral would never be requested if a patient is needing a bed as community referral is for
     * discharge."* `{psychiatric_ward, community_team}` is refused at the intake form from now on,
     * so no referral of that shape can be created again.
     *
     * ⚠️ **DELETING THE WARD ARM INSTEAD WOULD HAVE SATISFIED THE SAME RULING AND FAILED NOTHING.**
     * The ward arm below is the seed's ONLY successful youth match, and the age dimension is only
     * honourable if one seed path shows it working rather than only failing. Nothing in this
     * repository goes red when it disappears — which is precisely why the ruling says SPLIT.
     *
     * The community fixture this referral used to carry is `RF-010` below, with the same team name
     * and the same reason for existing.
     */
    ageBand: "Youth",
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          unitId: "bty-youth",
          sex: "Female",
          gender: "Female", // R7 (25 Sept 2026): authored demo data, not derived at runtime
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
        state: "accepted",
        acceptedUnitId: "bty-youth",
        decidedAt: NOW_ANCHOR - 8,
        decidedBy: "Bed coordinator",
      },
    ],
    // Out of area on purpose, same reason as RF-006 above — a second real example for the
    // out-of-area ledger `homeRegion` exists to make possible.
    homeRegion: "Mid West",
    suburb: { kind: "named", name: "Geraldton" },
    source: "inter_hospital",
    raisedAt: NOW_ANCHOR - 30,
    // Longest of all — a country transfer sitting in another hospital for nearly five hours.
    triagedAt: NOW_ANCHOR - 320,
    urgency: 2,
    originSiteCode: "GER",
    transportNeeded: true,
    history:
      "Transfer request from the regional hospital. Presented to their emergency department twice in four days and there is no youth bed in the region. Under the care of the regional youth team. Long distance from family if admitted to the metropolitan area.",
  },
  {
    // Phase 8 Task 2. Added — not edited into an existing referral — because the equity ledger
    // (spec D8-3) needs at least one accepted referral whose travel band is one of
    // `OUT_OF_AREA_BANDS`, and NONE of RF-002/RF-003/RF-006/RF-007 is: their pairs read out of
    // `SYNTHETIC_TRAVEL_BANDS` as unrecorded, unrecorded, in-area and unrecorded. The band table
    // is owner-ruled placeholder data and was not touched to close that gap; this referral
    // instead uses a pair the table ALREADY records as out of area, and the pair was read out of
    // the fixture rather than chosen for how it reads.
    //
    // Task 2R: this referral no longer records an arrival, because no referral does. The ledger
    // reads `Admission` instead, and this is the referral an out-of-area admission can be joined
    // to when that fixture lands.
    //
    // READ THIS BEFORE "FIXING" IT. Every band in `SYNTHETIC_TRAVEL_BANDS` is invented and
    // assigned mechanically by list position, so this seed is very likely a metropolitan person
    // recorded as placed far from home at a metropolitan hospital. On screen that will read
    // oddly. That is the placeholder table behaving exactly as the owner instructed (confirmed
    // 2026-08-29) and is NOT a defect: do not correct the band, do not move this referral to a
    // hospital that reads more remotely, and do not add a note explaining it away. The whole
    // arrangement is that replacing the values in `ward-travel-bands.ts` is the entire change on
    // the day somebody measures real ones.
    //
    // Shaped after RF-006 so the acceptance is coherent rather than plausible-looking:
    // `fsh-adult-secure` is Adult, Secure, non-forensic and `"Male only"`, and
    // `tests/ward-referral-model.test.ts` runs `referralEligibility` over every accepted referral
    // in this fixture, so an incoherent acceptance fails by name rather than being rendered as
    // fact by a later screen.
    id: "RF-008",
    patientId: "PT-008",
    ageBand: "Adult",
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          unitId: "fsh-adult-secure",
          sex: "Male",
          // T10 (item 8): recorded for the same reason as RF-002/RF-006 above.
          gender: "Male",
          secureBedNeeded: true,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
        state: "accepted",
        acceptedUnitId: "fsh-adult-secure",
        decidedAt: NOW_ANCHOR - 45,
        decidedBy: "Bed coordinator",
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Morley" },
    source: "ambulance",
    raisedAt: NOW_ANCHOR - 75,
    triagedAt: NOW_ANCHOR - 95,
    urgency: 2,
    originSiteCode: "RPH",
    transportNeeded: true,
    history:
      "Ambulance called by a neighbour. Agitated and distressed at home, calmer on arrival of the crew, and agreed to come in voluntarily.",
  },
  {
    /*
     * 🔴 THE ONLY REFERRAL ADDRESSED TO AN EMERGENCY DEPARTMENT, AND UNTIL IT EXISTED THE ED
     * PSYCHIATRY HUB WAS EMPTY FOR EVERY DEPARTMENT.
     *
     * The other eight all address a psychiatric ward, so the hub's inbox had nothing to hold and
     * every row it COULD hold would have rendered the "not in department yet" branch. ⚠️ A screen
     * showing that for every patient looks like correct handling of a legitimate case rather than
     * like a feature with no data — `R46`: a thing built before its input exists cannot be built
     * wrong, only empty, and empty is indistinguishable from working.
     *
     * Found by Ward Referrals, who had told the owner `RF-005`'s 165-minute gap would be visible on
     * the hub, measured that it could not be, and corrected that to him.
     *
     * `triagedAt` 210 minutes before `raisedAt`: somebody who had been in the department three and
     * a half hours before anyone called psychiatry. That is the gap `P9-D2` exists to show, on the
     * one screen built to show it.
     */
    id: "RF-009",
    patientId: "PT-009",
    ageBand: "Adult",
    destinations: [
      {
        destination: { kind: "emergency_department", edId: "rph-ed", purpose: "psychiatric_review" },
        state: "queued",
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Cannington" },
    source: "ambulance",
    raisedAt: NOW_ANCHOR - 35,
    triagedAt: NOW_ANCHOR - 245,
    urgency: 2,
    originSiteCode: "RPH",
    transportNeeded: false,
    history:
      "Brought in by ambulance and needs a psychiatric opinion in the department before any decision about admission is made.",
  },
  {
    /*
     * 🔴 THE SEED'S ONLY COMMUNITY-ONLY REFERRAL, AND THE ONLY REFERRAL ANY SEEDED ADMISSION
     *
     * 🔴 CORRECTED 2026-09-11: THIS HEADING IS FALSE. TEN seeded admissions point at a real
     * referral, not one. Repaired 2026-09-10 at a6e5208b85: 24 real Referral ids, ZERO dangling,
     * 257 admissions carrying an honest null.
     * ⚠️ "This is the one real join" further down this block is false for the same reason and is
     * corrected there.
     * ✅ WHAT SURVIVES AND IS WORTH READING: the section headed "AND ONE THING THIS FIXTURE DOES
     * NOT SETTLE" states a modelling conflict that is STILL OPEN and still unruled - a community
     * referral cannot, by owner ruling 3, describe someone being admitted, yet
     * `admissionBelongsToTeam` requires exactly that read of the field.
     * ACTUALLY POINTS AT.
     *
     * It does two jobs that were previously done by nothing at all.
     *
     * **1. It carries forward `RF-007`'s community arm.** That arm was the community hub's only
     * fixture and it sat beside a ward arm, which owner rulings 13 and 14 forbid. Splitting rather
     * than trimming keeps both purposes: `RF-007` above stays the seed's only successful youth
     * match, and the community vocabulary lives on here. `"Inner City Clinic"` is unchanged — a
     * clinic the S2015 catchment table actually names, so this exercises the vocabulary the intake
     * picker offers rather than inventing a service. It is also the first seeded fixture for the
     * coordinator-visibility rule's `{community_team}` row, which had none.
     *
     * **2. `AD-LEFT-01` (`ward-admissions-seed.ts`) names this id in its `referralId`.** Until now
     * every seeded `referralId` was MANUFACTURED from the admission's own id by string
     * substitution, so `admissionBelongsToTeam` (`community/community-derivations.ts`) could not
     * succeed for any admission against any of the 65 teams, and `referralToBedJoin`
     * (`statistics/statistics-derivations.ts`) measured a true nought. This is the one real join.
     *
     * 🔴 CORRECTED 2026-09-11: "the one real join" is FALSE - there are ten, all resolving.
     * ✅ The "Until now every seeded referralId WAS manufactured" clause above is phrased as
     * history and was accurate as history. This closing sentence was present tense, and the present
     * moved (a6e5208b85).
     *
     * ⚠️ **THE PAIR IS CHRONOLOGICALLY COHERENT, AND THAT IS THE WHOLE POINT OF THE TIMING BELOW.**
     * `52ad01dda` populated nine team pages by naming referrals after the ids the admissions
     * already manufactured. Every pair it produced had the person in the bed BEFORE the referral
     * existed, so not one could carry a duration — a defect shipped as a repair. This referral is
     * raised `RF_010_RAISED_DAYS_BEFORE_ANCHOR` days before the anchor; `AD-LEFT-01` was pulled 23
     * days 10 hours ago and arrived 23 days 5 hours ago, so the referral precedes both — by 14 and
     * 19 hours respectively, which is the whole margin and it is not a day. Lengthening that
     * admission's stay to 24 days, or shortening this figure, puts the person in the bed before
     * the referral existed; `tests/ward-statistics-derivations.test.ts` then goes red on
     * `chronologicallyCoherentCount` rather than the fixture drifting quietly.
     *
     * ⚠️ **AND ONE THING THIS FIXTURE DOES NOT SETTLE, RECORDED RATHER THAN PAPERED OVER.**
     * `Admission.referralId` is documented as *"the referral this admission came from — the join
     * back to the front door"*, and owner ruling 3 says a community referral is only ever for a
     * patient about to be discharged. Those two sentences cannot both describe this join: a
     * community referral does not bring anybody in. The hub's association rule
     * (`admissionBelongsToTeam`, owner-ruled 2026-08-31) nonetheless reads exactly this field, so
     * a populated team page REQUIRES an admission whose referral names a team. **The conflict is
     * in the model, not in this fixture** — it is Ward Lead's to rule on, and nothing here should
     * be read as having settled it.
     *
     * `source` is `inter_hospital` and `originSiteCode` is `ARM` because they must agree, and
     * `REFERRAL_SOURCES` holds no "ward" or "inpatient" channel: the only member describing a
     * request that came from a hospital is this one, and `ARM` is Armadale, `AD-LEFT-01`'s own
     * site. `suburb` is Noranda, which `ward-catchment.ts` records against this clinic, so the
     * team named here is one the table would actually have proposed. `triagedAt` is deliberately
     * absent: nobody was triaged into a department for this, and a proxy instant here would invent
     * the second clock `P9-D2` exists to keep honest.
     */
    id: "RF-010",
    // D-14 (2026-09-11): the join back to `AD-LEFT-01` (`ward-admissions-seed.ts`).
    patientId: "PT-010",
    ageBand: "Adult",
    destinations: [
      {
        /*
         * ⚠️ **DO NOT WRITE A COUNT HERE — THE COMMENT THIS ONE REPLACES DECAYED TWICE, IN
         * OPPOSITE DIRECTIONS, INSIDE ONE DAY.** It lived on `RF-007`'s community arm until that
         * arm was split out into this referral on 2026-09-01. It said "the only" while nine more
         * community-addressed referrals sat above it (`52ad01dda`), and then said "for a while the
         * only one" after those nine were backed out again (`fa616d1c9`, because they requested no
         * bed and so sat at the top of the coordinator's BED-matching queue). ⚠️ **Both readings were
         * TRUE WHEN WRITTEN and false soon after** — which is the point, not a softening of it: a
         * claim that was never true is a mistake somebody may catch, and a claim that was true and
         * rotted is the one nothing catches. Verified from history rather than from this file, which
         * cannot answer a question about its own past: the nine landed at `52ad01dda` 12:54, "for a
         * while the only one" was written at `3bdf9860f` 13:32 while they existed, and they were
         * backed out at `fa616d1c9` 14:17. Nothing failed either time: **a count written into a comment has
         * no guard, so it decays the moment the code beside it moves — and it decays just as
         * silently when the code moves BACK.** Say WHY a thing is here, which stays true; not HOW
         * MANY there are, which does not.
         *
         * ⚠️ **AND IT ALMOST DIED A THIRD DEATH BEING CARRIED HERE.** The split removed the arm
         * this comment lived on, in the same hour another chat was repairing its wording. The
         * merge conflicted rather than resolving quietly, which is the only reason the repair was
         * noticed at all — a clean auto-resolve would have taken the correct text away and
         * reported success. **A conflict is the cheap outcome; the silent one is the expensive
         * one.**
         *
         * Why this arm exists at all: `teamName` names WHICH team, because the owner ruled on
         * 2026-08-31 that association comes from the team named on the referral rather than from
         * the patient's home region. The value is a clinic the S2015 catchment table actually
         * names, so the seed exercises the vocabulary the intake picker offers rather than
         * inventing a service.
         */
        destination: { kind: "community_team", teamName: "Inner City Clinic" },
        // ACCEPTED rather than queued: the person this referral concerns has since been discharged
        // to the community, and a destination still shown as waiting for an answer 24 days later
        // would put a live wait on the intake form's `waitFigure` for somebody who is already home.
        // `acceptedUnitId` is absent because a team is not a bed — see `ReferralAddressing`.
        state: "accepted",
        decidedAt: NOW_ANCHOR - RF_010_RAISED_DAYS_BEFORE_ANCHOR * MINUTES_PER_DAY + 180,
        decidedBy: "Community service",
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Noranda" },
    source: "inter_hospital",
    raisedAt: NOW_ANCHOR - RF_010_RAISED_DAYS_BEFORE_ANCHOR * MINUTES_PER_DAY,
    urgency: 3,
    originSiteCode: "ARM",
    transportNeeded: false,
    history:
      "Ready for discharge from the medical ward and needs community follow-up rather than a bed. Asking the team to pick her up rather than admitting. Was under the inner city clinic previously and is willing to re-engage.",
  },
  {
    /*
     * ⚠️ THE ONE SEEDED REFERRAL WITH MORE THAN ONE DESTINATION, and until it existed `FD-23` — "a
     * ward may not see where else a patient has been referred; the coordinator may" — had no
     * seeded referral to demonstrate it against. Every referral above carries exactly one
     * destination, so the rule was real (see `ward-referral-visibility.ts`) but untestable on the
     * shipped fixture rather than on a reducer-built one built solely to exercise it.
     *
     * `{psychiatric_ward, emergency_department}` is a PERMITTED pair — `ward-referral-visibility.ts`
     * names it explicitly as one of the two combinations FD-23's own ruling leaves open, alongside
     * `{emergency_department, community_team}`. The forbidden pair is `{psychiatric_ward,
     * community_team}` (owner rulings 13/14: a community referral is for discharge, so it can never
     * accompany a bed request) — that is the shape `RF-007` was split away from on 2026-09-01, and
     * this fixture must never be edited toward it.
     *
     * Clinically coherent as authored: somebody sitting in Fiona Stanley's emergency department,
     * referred there for their own psychiatric review AND, in the same act, referred to a
     * psychiatric ward for the bed the review may lead to. Both arms are left `queued` — this
     * fixture's job is to prove the PRIVACY boundary between two live destinations, not to exercise
     * FD-22's cancel-on-acceptance behaviour, which `tests/ward-referral-visibility.test.ts`'s own
     * reducer-built fixture already covers with a decided pair.
     */
    id: "RF-011",
    // T2 (section 2 item 7): was PT-011 (an 18-year-old man), contradicting this referral's female
    // ward arm. Re-pointed to PT-063 (Lorna Gorsebrook).
    patientId: "PT-063",
    ageBand: "Adult",
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          sex: "Female",
          gender: "Female", // R7 (25 Sept 2026): authored demo data, not derived at runtime
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
        state: "queued",
      },
      {
        destination: { kind: "emergency_department", edId: "fsh-ed", purpose: "psychiatric_review" },
        state: "queued",
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Fremantle" },
    source: "ambulance",
    raisedAt: NOW_ANCHOR - 50,
    triagedAt: NOW_ANCHOR - 60,
    // Tier 3, the lowest-priority tier. Since Decision D-32 `referralQueueOrder` sorts by waiting
    // time, longest first, so this tier no longer decides where the referral sits in the queue;
    // urgency only breaks a tie between referrals raised at the same moment.
    urgency: 3,
    originSiteCode: "FSH",
    transportNeeded: true,
    history:
      "Ambulance attendance after a call from a family member. Needs review in the department first, and a bed is being asked for in parallel because the picture may not settle. Family have said they cannot manage at home tonight.",
  },
  /*
   * 🔴 RF-012 AND RF-013 — THE TWO REFERRALS A SEEDED MOVEMENT WAS ACTUALLY RAISED FROM. Owner
   * ruling R-2026-09-04-D, added 2026-09-04.
   *
   * ⚠️ **THEY WERE AUTHORED RATHER THAN CHOSEN, AND THE REASON IS A MEASUREMENT.** Before them the
   * seed held two ED-addressed referrals: `RF-009` (`rph-ed`, raised 35 minutes before the anchor)
   * and `RF-011`'s ED arm (`fsh-ed`, 50 minutes). A journey cannot precede the referral that
   * produced it, and the youngest movement at either department was opened 180 minutes before the
   * anchor — so linking any existing pair would have recorded a patient arriving hours before
   * anybody referred them. That is the shape `52ad01dda` shipped for admissions and `fa616d1c9`
   * removed; it reads as a repair and is a fabrication.
   *
   * Each of these is therefore timed as the ORIGIN of one specific movement: referral raised,
   * patient triaged into that same department some time later, department opens the journey later
   * still. `decidedAt` on each ED arm is the moment its movement opened, because taking the patient
   * on IS the department's answer.
   *
   * ⚠️ **BOTH ED ARMS ARE `accepted`, NOT `queued`, AND THAT IS A FACT ABOUT THEM RATHER THAN A
   * CONVENIENCE.** A queued arm says the department has not answered yet; each of these has a
   * movement in the fixture proving it did. (It also keeps both off the ED psychiatry hub's
   * waiting inbox, which is `RF-009`'s fixture and not theirs to change — a happy consequence, not
   * the reason.) `acceptedUnitId` is absent because a department is not a bed, exactly as for
   * `RF-010`'s community arm.
   *
   * ⚠️ **NEITHER CARRIES A WARD ARM, DELIBERATELY.** These are referrals INTO an emergency
   * department; the bed search that follows belongs to the movement, and giving them a ward arm as
   * well would put a second, parallel bed request beside a movement already doing exactly that.
   */
  {
    // The origin of `WF-002` — Older adult, Male, at `fsh-ed`, arrived by ambulance, journey opened
    // 180 minutes before the anchor. Raised 240 before, triaged into the department at 200: a
    // 40-minute referral clock that stopped when the patient arrived, then 20 minutes in the
    // department before psychiatry opened the journey. Suburb `Murdoch` is the one `RF-005`
    // already uses for this site, so the catchment table resolves it exactly as it does there.
    id: "RF-012",
    // T2 (section 2 item 1): was PT-012 (an 18-year-old woman from Rockingham), contradicting both
    // this referral and WF-002 (the older-adult man it originates — see the origin comment above).
    // Re-pointed to PT-058 (Edmund Sallowfield); WF-002 follows through this referral link, since
    // it carries no direct `patientId` of its own.
    patientId: "PT-058",
    ageBand: "Older adult",
    destinations: [
      {
        destination: { kind: "emergency_department", edId: "fsh-ed", purpose: "psychiatric_review" },
        state: "accepted",
        decidedAt: NOW_ANCHOR - 180,
        decidedBy: "ED clinician",
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Murdoch" },
    source: "ambulance",
    raisedAt: NOW_ANCHOR - 240,
    triagedAt: NOW_ANCHOR - 200,
    urgency: 2,
    originSiteCode: "FSH",
    transportNeeded: true,
    history:
      "Ambulance called from home after a fall and a period of confusion. Needs a medical look as well as a psychiatric one, so the department is the right first stop. Lives alone with daily support. Increasingly forgetful over recent months, per the daughter.",
  },
  {
    // The origin of `WF-009` — Adult, Male, at `peel-ed`, `arrivalMode: "police"`, journey opened
    // 420 minutes before the anchor. Police is not a referral source (Josh, 10 Oct 2026), so the
    // referral comes from the crisis service that met the police, and `Mandurah` is the Peel
    // suburb `RF-004` already uses.
    //
    // ⚠️ Urgency 1 here and urgency 1 on `WF-009` are two separate records of the same judgement,
    // not one derived from the other: nothing in this model copies a referral's tier onto the
    // journey raised from it, and `RAISE_REFERRAL` takes the tier from its own draft.
    id: "RF-013",
    // T2 (section 2 item 2): was PT-009, who was also live on RF-009 (queued at `rph-ed`) at the
    // same moment as sitting in Peel ED here — one person cannot honestly be in two places. Also,
    // PT-009 lives in Dianella, not Mandurah/Peel as this referral and WF-009 (raised from it) say.
    // Re-pointed to PT-023 (Tobias Wren, "Toby", Greenfields in Peel, involuntary) — a true match,
    // and the patient-now story at /people/PT-023 already calls him "Toby". WF-009 carries no
    // direct `patientId` of its own, so it follows through this referral link automatically
    // (`resolveSubjectPatient`); no separate edit to WF-009 is needed. PT-009 keeps RF-009 only.
    patientId: "PT-023",
    ageBand: "Adult",
    destinations: [
      {
        destination: { kind: "emergency_department", edId: "peel-ed", purpose: "psychiatric_review" },
        state: "accepted",
        decidedAt: NOW_ANCHOR - 420,
        decidedBy: "ED clinician",
      },
    ],
    homeRegion: "Peel",
    suburb: { kind: "named", name: "Mandurah" },
    source: "crisis_service",
    raisedAt: NOW_ANCHOR - 470,
    triagedAt: NOW_ANCHOR - 440,
    urgency: 1,
    originSiteCode: "PEEL",
    transportNeeded: true,
    history:
      "Police attendance overnight, acutely distressed in a public place, and taken to the department as the nearest place able to assess him. Was distressed in a public place and could not be left alone.",
  },
  /*
   * 🔴 TWO EXPECTS — INVENTED, AND ADDED ON THE PRODUCT OWNER'S EXPLICIT AUTHORISATION, 2026-09-07.
   *
   * Asked whether to seed any — "Should I add sample expects so the screen isn't blank?" — his
   * answer was "Yes to your recommendation… add a couple", the recommendation being that I add
   * one or two clearly marked as invented for him to replace with realistic ones later.
   *
   * ⚠️ **WHAT MAKES THEM EXPECTS IS AN ABSENCE, WHICH IS THE EASIEST THING IN THIS FILE TO
   * "FIX" BY ACCIDENT.** Neither carries a `triagedAt` and neither carries an `inDepartmentAt`.
   * That is not an omission: `hasArrivedInDepartment` reads exactly those two fields, so adding
   * either one to tidy the record moves the patient into Referrals and empties the Expects list —
   * and an empty Expects list looks precisely like a feature working correctly on a quiet day.
   * **Every other seeded ED referral is triaged; these two are the only ones that are not, and
   * they are the only reason the Expects list can be seen at all.**
   *
   * The figures are invented and none of them is a measurement: the times are chosen to show one
   * ordinary wait and one that has crossed the owner's 72-hour reconsider threshold, so both
   * states of the row are visible without anybody editing data.
   */
  {
    id: "RF-014",
    // T2 (seed-audit follow-up, section 3): PT-082 (Reagan Pinewhistle), hand-authored — this
    // referral carries no sex of its own, so the patient's sex is left honestly unset too.
    patientId: "PT-082",
    ageBand: "Adult",
    destinations: [
      {
        destination: { kind: "emergency_department", edId: "rph-ed", purpose: "psychiatric_review" },
        state: "queued",
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    source: "community",
    raisedAt: NOW_ANCHOR - 150,
    // Urgency 3 — the LOWEST tier — following `RF-011`'s precedent in this file. Since Decision
    // D-32 `referralQueueOrder` sorts by waiting time, longest first, so the tier only breaks a
    // tie; this row's queue position comes from its `raisedAt`.
    urgency: 3,
    originSiteCode: "RPH",
    transportNeeded: true,
    history:
      "Community team asked the department to see them today; they are travelling in with a family member and had not arrived when this was written. INVENTED DEMONSTRATION TEXT.",
  },
  {
    // Past the owner's 72-hour threshold, so the reconsider line on the row is reachable without
    // anybody editing a time. 4,500 minutes is 75 hours.
    id: "RF-015",
    // T2: PT-083 (Sasha Ridgewell), hand-authored — same reasoning as RF-014 above (no sex of its
    // own, so the patient's sex stays unset).
    patientId: "PT-083",
    ageBand: "Adult",
    destinations: [
      {
        // ⚠️ QUEUED, NOT ACCEPTED, AND THE REASON IS A SCREEN RATHER THAN A RULE. An accepted
        // referral is still an expect — the owner ruled that on 2026-09-07 and
        // `tests/ward-ed-expects-derivation.test.ts` pins it. But an ACCEPTED one also belongs in
        // this department's "recently answered" list, so seeding it that way would put one patient
        // in two places on one screen and weaken a scoping assertion that exists to catch exactly
        // that. The rule is proved by a test; the fixture does not have to demonstrate it too.
        destination: { kind: "emergency_department", edId: "rph-ed", purpose: "psychiatric_review" },
        state: "queued",
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    source: "crisis_service",
    raisedAt: NOW_ANCHOR - 4500,
    urgency: 3,
    originSiteCode: "RPH",
    transportNeeded: false,
    history:
      "Accepted by the department three days ago and has not presented. Kept on the list deliberately rather than removed — the row asks somebody to reconsider it, and nothing has been decided. INVENTED DEMONSTRATION TEXT.",
  },
  /**
   * ⚠️ **K3, ADDED 2026-09-17 AT THE OWNER'S REQUEST FOR MORE SAMPLE DATA** — six already-decided
   * referrals, NONE queued (`docs/ward-flow/plans/2026-09-17-build-plan-screens.md` §4, task 2; the
   * plan's own Q2, "new example referrals", is the earlier open question this closes: yes).
   * `tests/ward-seed-referral-census.test.ts` (K1) is updated in the same commit as this block, with
   * the figure diff in the commit message.
   *
   * Every accepted one names a unit `referralEligibility()` genuinely accepts — checked against the
   * real function, the same discipline `RF-006`'s own fix-round comment holds every OTHER accepted
   * referral in this file to, never merely plausible-looking. `RF-018` is the one decline, addressed
   * to the local Geraldton ward. Five services get one of these each: WACHS gets two (`RF-016`, `RF-017`),
   * North Metro one (`RF-019`), South Metro one (`RF-020`), Private one (`RF-021`). `RF-016` is
   * also this fixture's first `"gp"`-sourced referral — a source the owner's 17 September answer 25
   * added to the model but nothing here had yet used.
   */
  {
    id: "RF-016",
    // T2: PT-084 (Nadia Summerholt), hand-authored — Adult Female, Albany/Albany Community Team.
    patientId: "PT-084",
    ageBand: "Adult",
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          unitId: "alb-adult-open",
          sex: "Female",
          gender: "Female", // R7 (25 Sept 2026): authored demo data, not derived at runtime
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
        state: "accepted",
        acceptedUnitId: "alb-adult-open",
        decidedAt: NOW_ANCHOR - 60,
        decidedBy: "Bed coordinator",
      },
    ],
    homeRegion: "Great Southern",
    suburb: { kind: "named", name: "Albany" },
    source: "gp",
    raisedAt: NOW_ANCHOR - 500,
    urgency: 3,
    originSiteCode: "ALB",
    transportNeeded: false,
    history:
      "Referred by their general practitioner after several weeks of low mood and poor sleep that had not responded to treatment in the community. Agreeable to a voluntary admission close to home.",
  },
  {
    id: "RF-017",
    // T2: PT-085 (Warrick Underbridge), hand-authored — Adult Male, Bunbury/Bunbury Community Team.
    patientId: "PT-085",
    ageBand: "Adult",
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          unitId: "bun-adult-open",
          sex: "Male",
          gender: "Male", // R7 (25 Sept 2026): authored demo data, not derived at runtime
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
        state: "accepted",
        acceptedUnitId: "bun-adult-open",
        decidedAt: NOW_ANCHOR - 45,
        decidedBy: "Bed coordinator",
      },
    ],
    homeRegion: "South West",
    suburb: { kind: "named", name: "Bunbury" },
    source: "community",
    // WS-03 (26 Oct 2026): the referring team, as every community referral sent today records it.
    // Without it the accepted journey could not be started from Home or the ward (D-76).
    sendingTeamName: "Bunbury Community Team",
    raisedAt: NOW_ANCHOR - 600,
    urgency: 2,
    originSiteCode: "BUN",
    transportNeeded: false,
    history:
      "Known to the community team for ongoing support and referred after a gradual decline in their ability to manage day to day. Family agree admission close to home is the right next step.",
  },
  {
    id: "RF-018",
    // T2: PT-086 (Imani Vellamoor), hand-authored — Adult Female, Geraldton/Geraldton Community
    // Team.
    patientId: "PT-086",
    ageBand: "Adult",
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          unitId: "ger-adult-open",
          sex: "Female",
          gender: "Female", // R7 (25 Sept 2026): authored demo data, not derived at runtime
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
        state: "declined",
        declineReason: "no_suitable_bed",
        decidedAt: NOW_ANCHOR - 30,
        decidedBy: "Bed coordinator",
      },
    ],
    homeRegion: "Mid West",
    suburb: { kind: "named", name: "Geraldton" },
    source: "crisis_service",
    raisedAt: NOW_ANCHOR - 300,
    urgency: 2,
    originSiteCode: "GER",
    transportNeeded: true,
    history:
      "Brought to attention by police after a disturbance at a family member's home overnight. No bed was available locally at the time, and the search continues elsewhere in the network.",
  },
  {
    id: "RF-019",
    // T2: PT-087 (Lior Waterstone), hand-authored — Adult Female, Joondalup/Joondalup Community
    // Team.
    patientId: "PT-087",
    ageBand: "Adult",
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          unitId: "scgh-adult-open",
          sex: "Female",
          gender: "Female", // R7 (25 Sept 2026): authored demo data, not derived at runtime
          secureBedNeeded: false,
          involuntaryBedNeeded: true,
          highAcuityNursingNeeded: false,
        },
        state: "accepted",
        acceptedUnitId: "scgh-adult-open",
        decidedAt: NOW_ANCHOR - 20,
        decidedBy: "Bed coordinator",
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Joondalup" },
    source: "ambulance",
    raisedAt: NOW_ANCHOR - 400,
    urgency: 1,
    originSiteCode: "JHC",
    transportNeeded: true,
    history:
      "Ambulance called after they were found highly distressed and unable to guarantee their own safety. Assessed as needing a period of involuntary treatment and accepted for admission.",
  },
  {
    id: "RF-020",
    // T2: PT-088 (Godfrey Xanderfield), hand-authored — Older adult Male, Fremantle/Alma Street
    // (Fremantle) Community Team.
    patientId: "PT-088",
    ageBand: "Older adult",
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          unitId: "fre-older-adult",
          sex: "Male",
          gender: "Male", // R7 (25 Sept 2026): authored demo data, not derived at runtime
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
        state: "accepted",
        acceptedUnitId: "fre-older-adult",
        decidedAt: NOW_ANCHOR - 25,
        decidedBy: "Bed coordinator",
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Fremantle" },
    source: "crisis_service",
    raisedAt: NOW_ANCHOR - 350,
    urgency: 2,
    originSiteCode: "FRE",
    transportNeeded: false,
    history:
      "Crisis team called by a neighbour after several days of confusion and not eating. Agreed to come in voluntarily once their family were involved in the conversation.",
  },
  {
    id: "RF-021",
    // T2: PT-089 (Bianca Yewbridge), hand-authored — Adult Female, Subiaco/Inner City Community
    // Team.
    patientId: "PT-089",
    ageBand: "Adult",
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          // Audit 2 E-04 (20 Oct 2026): with no legal status recorded this referral needs an
          // authorised bed, so it is accepted at Graylands rather than the voluntary-only SJGS unit.
          unitId: "gry-adult-secure",
          sex: "Female",
          gender: "Female", // R7 (25 Sept 2026): authored demo data, not derived at runtime
          secureBedNeeded: true,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
        state: "accepted",
        acceptedUnitId: "gry-adult-secure",
        decidedAt: NOW_ANCHOR - 35,
        decidedBy: "Bed coordinator",
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Subiaco" },
    source: "inter_hospital",
    raisedAt: NOW_ANCHOR - 450,
    urgency: 3,
    originSiteCode: "SJGS",
    transportNeeded: false,
    history:
      "Transferred from a private hospital bed that was needed for a surgical admission, for continuing psychiatric care. Family requested the transfer.",
  },
  // ⚠️ DEMONSTRATION DATA, LAST AND SPREAD RATHER THAN WRITTEN OUT, so the boundary between the
  // hand-authored referrals above and the nine added to populate one team's page is visible in the
  // array itself. See `MIDLAND_DEMONSTRATION_ROWS` for what they are and why they are safe.
  ...midlandDemonstrationReferrals,
]);
