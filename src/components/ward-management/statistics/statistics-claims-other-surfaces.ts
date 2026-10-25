// The claims register entries for every registered surface after `statistics-screen.tsx`, split out
// of `statistics-claims-register.ts` (which concatenates them into `MODEL_CLAIMS`) to keep it under the line cap.

import {
  type ModelClaim,
  WARD_MODEL,
  WARD_MODEL_MOVEMENT_PARTS,
  WARD_ADMISSIONS,
  WARD_BED_EVENTS,
  WARD_REFERRAL_ANSWER_EVENTS,
  WARD_STATISTICS,
  WARD_SITES,
  WARD_TEAMS,
  OVERVIEW_SCREEN,
  COMPARE_SCREEN,
  WARD_STATS_SCREEN,
  ED_SCREEN,
  DERIVATIONS,
  COMMUNITY_INDEX,
  WARD_NAV,
  COMMUNITY_DERIVATIONS,
  COMMUNITY_SCREEN,
  COMMUNITY_SCREEN_HERO,
  WARD_FACADE,
  DESTINATION_OPTIONS,
  REFERRAL_ADDRESSING_BODY,
  WARD_DESTINATION_ARM,
  WARD_DESTINATION_ARM_GAINS_A_UNIT_ID,
  SITE_BY_CODE_LOOKUP,
  SITE_BY_CODE_GAINS_A_FALLBACK,
  REFERRAL_ADDRESSING_GAINS_A_SECOND_UNIT_ID,
  ACCEPTANCE_STOPS_RECORDING_THE_UNIT,
  DECLINE_LOSES_ITS_UNIT,
  MOVEMENT_STOPS_CARRYING_A_DECLINE_LIST,
  MOVEMENT_ORIGIN_ED_BECOMES_REQUIRED,
  REFERRED_UNIT_IDS_BECOMES_ONE_ID,
  THE_PARALLEL_REFERRAL_CAP_IS_REMOVED,
  REFERRAL_ID_STOPS_BEING_NULLABLE,
  RAISED_AT_STOPS_BEING_REQUIRED,
  PREPARING_STOPS_BEING_A_BOOLEAN,
  EMERGENCY_DEPARTMENT_BODY,
  DECLINE_BODY,
  COMMUNITY_TEAM_PAGE_DERIVATION,
  COMMUNITY_TEAM_VOCABULARY_DERIVATION,
  COMMUNITY_TEAM_BODY,
} from "./statistics-claims-shared";

export const OTHER_SURFACE_CLAIMS: readonly ModelClaim[] = [
  // ── statistics-overview-screen.tsx ────────────────────────────────────────────────────────────

  {
    retiredPageProse: {
      date: "2026-10-07",
      reason: "Owner requested removal of explanatory statistics panels; the model evidence remains checked.",
    },

    id: "statistics-overview-screen/precedent/addressing-has-one-unit-field",
    renderedIn: OVERVIEW_SCREEN,
    // Locator moved 2026-09-06 with the field-name removal. The claim is unchanged and the page
    // still makes it — in words rather than identifiers. Evidence and falsifier below still name
    // `acceptedUnitId` exactly, which is what keeps this checkable.
    rendered: "Named ward referrals preserve their recipient before acceptance",
    claim: "The answer records acceptedUnitId; a named ward request may also record its target before acceptance.",
    sourceFile: WARD_MODEL,
    evidence: REFERRAL_ADDRESSING_BODY,
    falsifiedBy: REFERRAL_ADDRESSING_GAINS_A_SECOND_UNIT_ID,
  },
  {
    retiredPageProse: {
      date: "2026-10-07",
      reason: "Owner requested removal of explanatory statistics panels; the model evidence remains checked.",
    },

    id: "statistics-overview-screen/precedent/movement-declines-name-a-unit",
    renderedIn: OVERVIEW_SCREEN,
    rendered: "movement declines name a ward for somebody already inside a department.",
    claim: "A movement decline records a unit id, an instant and a reason.",
    sourceFile: WARD_MODEL,
    evidence: DECLINE_BODY,
    falsifiedBy: DECLINE_LOSES_ITS_UNIT,
  },
  {
    retiredPageProse: {
      date: "2026-10-07",
      reason: "Owner requested removal of explanatory statistics panels; the model evidence remains checked.",
    },

    id: "statistics-overview-screen/precedent/a-movement-is-inside-an-emergency-department",
    renderedIn: OVERVIEW_SCREEN,
    rendered: "already inside a department",
    claim:
      "A movement names the emergency department it started from, except a journey from an accepted community referral (D-76), which names the referring community team instead.",
    sourceFile: WARD_MODEL_MOVEMENT_PARTS,
    evidence: "originEdId?: string;",
    falsifiedBy: MOVEMENT_ORIGIN_ED_BECOMES_REQUIRED,
  },

  // ── statistics-compare-screen.tsx ─────────────────────────────────────────────────────────────
  {
    retiredPageProse: {
      date: "2026-10-07",
      reason: "Owner requested removal of explanatory statistics panels; the model evidence remains checked.",
    },

    id: "statistics-compare-screen/attributability/admissions-always-carry-a-unit",
    renderedIn: COMPARE_SCREEN,
    rendered: 'data-testid="ward-statistics-compare-attributability-rule"',
    claim: "`Admission.unitId` is a required string, so anything derived from admissions attributes to a ward.",
    sourceFile: WARD_ADMISSIONS,
    evidence: "begins a new one, which is what keeps each ward's own occupancy honest. */ unitId: string;",
    falsifiedBy: {
      change:
        "`Admission.unitId` stops being required, so a figure derived from admissions can no longer always be " +
        "attributed to a ward.",
      find: "begins a new one, which is what keeps each ward's own occupancy honest. */ unitId: string;",
      replaceWith: "begins a new one, which is what keeps each ward's own occupancy honest. */ unitId: string | null;",
    },
  },
  {
    retiredPageProse: {
      date: "2026-10-07",
      reason: "Owner requested removal of explanatory statistics panels; the model evidence remains checked.",
    },

    id: "statistics-compare-screen/declines/ward-destination-records-bed-criteria",
    renderedIn: COMPARE_SCREEN,
    rendered: 'data-testid="ward-statistics-compare-declines-example"',
    claim:
      "The ward destination arm records the bed's criteria — sex, secure, able to hold somebody " +
      "involuntarily, high-acuity nursing — and may identify its selected ward recipient.",
    sourceFile: WARD_MODEL,
    evidence: WARD_DESTINATION_ARM,
    falsifiedBy: WARD_DESTINATION_ARM_GAINS_A_UNIT_ID,
  },
  {
    retiredPageProse: {
      date: "2026-10-07",
      reason: "Owner requested removal of explanatory statistics panels; the model evidence remains checked.",
    },

    id: "statistics-compare-screen/declines/addressing-has-one-unit-field",
    renderedIn: COMPARE_SCREEN,
    rendered: "Named ward referrals preserve their recipient before acceptance.",
    claim: "The answer records acceptedUnitId; a named ward request may also record its target before acceptance.",
    sourceFile: WARD_MODEL,
    evidence: REFERRAL_ADDRESSING_BODY,
    falsifiedBy: REFERRAL_ADDRESSING_GAINS_A_SECOND_UNIT_ID,
  },
  {
    retiredPageProse: {
      date: "2026-10-07",
      reason: "Owner requested removal of explanatory statistics panels; the model evidence remains checked.",
    },

    id: "statistics-compare-screen/declines/accepted-unit-id-is-written-on-acceptance",
    renderedIn: COMPARE_SCREEN,
    // Locator moved 2026-09-06 with the field-name removal. Both this claim and the one above are
    // now carried by the SAME sentence on the page, which is why they share a locator: the reword
    // merged two clauses that had been separate. The claims stay distinct here, with distinct
    // evidence and distinct falsifiers, so they still fail independently.
    rendered: "Named ward referrals preserve their recipient before acceptance.",
    claim: "The reducer sets an addressing's `acceptedUnitId` on the acceptance path and nowhere else.",
    sourceFile: WARD_REFERRAL_ANSWER_EVENTS,
    evidence: 'accepted = { ...addressing, state: "accepted", acceptedUnitId: unit.id,',
    falsifiedBy: ACCEPTANCE_STOPS_RECORDING_THE_UNIT,
  },
  {
    retiredPageProse: {
      date: "2026-10-07",
      reason: "Owner requested removal of explanatory statistics panels; the model evidence remains checked.",
    },

    id: "statistics-compare-screen/double-count/referred-unit-ids-is-a-list",
    renderedIn: COMPARE_SCREEN,
    rendered: 'data-testid="ward-statistics-compare-double-count-example"',
    claim: "`Movement.referredUnitIds` is a list of unit ids, not a single id.",
    sourceFile: WARD_MODEL,
    evidence: "referredUnitIds: string[];",
    falsifiedBy: REFERRED_UNIT_IDS_BECOMES_ONE_ID,
  },
  {
    id: "statistics-compare-screen/double-count/the-parallel-referral-cap-exists",
    retiredPageProse: {
      date: "2026-09-13",
      reason:
        "Q004 owner-requested removal of implementation commentary. The page still explains parallel referrals but no longer claims a fixed cap.",
    },
    renderedIn: COMPARE_SCREEN,
    // Historical locator from 2026-09-06; the retirement above records its later removal.
    // Model evidence and falsifier remain active even though the page no longer names the cap.
    rendered: "at several wards at once, up to a fixed cap",
    claim: "A cap on how many wards one referral can be live at exists and is named `PARALLEL_REFERRAL_CAP`.",
    sourceFile: WARD_MODEL,
    evidence: "export const PARALLEL_REFERRAL_CAP = 3;",
    falsifiedBy: THE_PARALLEL_REFERRAL_CAP_IS_REMOVED,
  },
  {
    id: "statistics-compare-screen/chooser/one-dynamic-route-serves-every-ward",
    retiredPageProse: {
      date: "2026-10-02",
      reason: "User authorised routing prose removal from the comparison page.",
    },
    renderedIn: COMPARE_SCREEN,
    rendered: "Ward and department detail use one route per unit",
    claim: "Per-ward detail is one dynamic route, built by a single href helper.",
    /* REPOINTED 2026-09-10: `wardStatisticsHref` moved to the shell facade whole, and the claim is
     * unchanged because what it asserts is unchanged - still one dynamic route, still one helper,
     * still built from the unit id. Read before repointing, as this file's own failure message
     * demands: the helper in its new home is byte-identical apart from its doc comment. */
    sourceFile: WARD_FACADE,
    evidence: "return `/ward-flow/statistics/ward/${encodeURIComponent(unitId)}`;",
    falsifiedBy: {
      change:
        "Per-ward detail stops being one dynamic route built from the unit id and becomes a per-ward lookup table. " +
        "(The 'a SINGLE href helper' half is an absence — a second helper added beside this one would leave this " +
        "line untouched.)",
      find: "return `/ward-flow/statistics/ward/${encodeURIComponent(unitId)}`;",
      replaceWith: "return WARD_STATISTICS_HREFS[unitId];",
    },
  },
  {
    id: "statistics-compare-screen/chooser/another-serves-every-department",
    retiredPageProse: {
      date: "2026-10-02",
      reason: "User authorised routing prose removal from the comparison page.",
    },
    renderedIn: COMPARE_SCREEN,
    rendered: "Ward and department detail use one route per unit",
    claim: "Per-department detail is a second dynamic route, built by its own href helper.",
    /* REPOINTED 2026-09-10 with its ward sibling above, and for the same reason. */
    sourceFile: WARD_FACADE,
    evidence: "return `/ward-flow/statistics/ed/${encodeURIComponent(edId)}`;",
    falsifiedBy: {
      change:
        "Per-department detail stops being one dynamic route built from the department id and becomes a " +
        "per-department lookup table. (Same absence caveat as the ward helper above.)",
      find: "return `/ward-flow/statistics/ed/${encodeURIComponent(edId)}`;",
      replaceWith: "return ED_STATISTICS_HREFS[edId];",
    },
  },
  {
    id: "statistics-compare-screen/chooser/a-site-code-may-resolve-to-nothing",
    renderedIn: COMPARE_SCREEN,
    rendered: 'data-testid="ward-statistics-compare-ward-list"',
    claim: "Site lookup returns nothing rather than a fallback site when a code matches none.",
    /** Re-pointed 2026-09-01 from the signature to the signature AND the body: `?? siteDirectory[0]` is
     *  still assignable to the declared `SiteIdentity | undefined`, so the signature alone could not fail. */
    sourceFile: WARD_SITES,
    evidence: SITE_BY_CODE_LOOKUP,
    falsifiedBy: SITE_BY_CODE_GAINS_A_FALLBACK,
  },

  /*
   * ⚠️ SIX `statistics-ward-screen` CLAIMS WERE REMOVED ON 2026-09-05, AND THE REASON IS THE
   * REGISTER'S OWN INSTRUCTION RATHER THAN A JUDGEMENT: "if the paragraph was removed, remove the
   * register entry with it".
   *
   * Five of them recorded that `wardStatistics()` DERIVES a figure while the page carried a
   * paragraph explaining that the derivations existed and were not surfaced anywhere. The page now
   * SHOWS those five figures, so the paragraph is gone and with it the sentences those claims cited.
   * A figure on the screen is not the same kind of thing as a sentence about a figure, and pointing
   * the old locators at the new values would have recorded a claim the page no longer makes in
   * words.
   *
   * The sixth said `ward-statistics.ts` has no consumer in the app. It now has one — this page —
   * so the claim is FALSE rather than relocated. Its own guard in
   * `tests/ward-statistics-sections.test.ts` was written to "go red the day one appears", and it
   * did exactly that on the commit that added the consumer. That test is inverted in the same
   * change, because an absence guard outliving its absence is a guard that can only ever be wrong.
   *
   * The three `blocked/` claims beside them were NOT removed: their paragraph survives verbatim on
   * the built page as the `Average wait after being accepted` measure.
   */
  // ── statistics-ward-screen.tsx ────────────────────────────────────────────────────────────────
  {
    retiredPageProse: {
      date: "2026-10-07",
      reason: "Owner requested hiding empty statistics panels; no waitlist average is recorded.",
    },
    id: "statistics-ward-screen/blocked/waitlist-wait-is-always-null",
    renderedIn: WARD_STATS_SCREEN,
    // Moved 2026-09-05: the paragraph survives verbatim as the built `Average wait after being
    // accepted` measure. The register's own instruction for a reworded claim — move the locator and
    // re-read the sentence — and the sentence was re-read: it still says the figure is always null
    // and still states the property of the record's instants without enumerating them.
    rendered: 'data-testid="ward-stat-waitlist-wait"',
    claim: "`WardStatistics.averageWaitlistWaitMinutes` is returned as a literal null on every path.",
    sourceFile: WARD_STATISTICS,
    evidence: "averageWaitlistWaitMinutes: null,",
    falsifiedBy: {
      change: "The waitlist wait starts being computed, so it is no longer a literal null on every path.",
      find: "averageWaitlistWaitMinutes: null,",
      replaceWith: "averageWaitlistWaitMinutes: average(waitlistMinutes),",
    },
  },
  {
    retiredPageProse: {
      date: "2026-10-07",
      reason: "Owner requested removal of explanatory statistics panels; the model evidence remains checked.",
    },

    id: "statistics-ward-screen/blocked/the-derivation-takes-admissions-only",
    renderedIn: WARD_STATS_SCREEN,
    // Locator moved 2026-09-06: the paragraph was reworded when the owner ruled the field names
    // off the prototype. The CLAIM is unchanged — the derivation is still given admissions only —
    // and the sentence was re-read at the move, as this register's failure message instructs.
    rendered: "because it is given admissions only, by design",
    claim: "`wardStatistics()` is given admissions and a clock, and no referrals.",
    sourceFile: WARD_STATISTICS,
    evidence: "export function wardStatistics(unitId: string, admissions: Admission[], now: Instant): WardStatistics {",
    falsifiedBy: {
      change: "The derivation is handed referrals as well, so it is no longer admissions and a clock only.",
      find: "export function wardStatistics(unitId: string, admissions: Admission[], now: Instant): WardStatistics {",
      replaceWith:
        "export function wardStatistics(unitId: string, admissions: Admission[], referrals: Referral[], now: " +
        "Instant): WardStatistics {",
    },
  },
  {
    retiredPageProse: {
      date: "2026-10-07",
      reason: "Owner requested removal of explanatory statistics panels; the model evidence remains checked.",
    },

    id: "statistics-ward-screen/blocked/the-nearest-equivalent-measures-from-referral-raised-at",
    renderedIn: WARD_STATS_SCREEN,
    /*
     * ⚠️ LOCATOR MOVED 2026-09-06, AND THIS ONE CHANGED WHAT THE PAGE ASSERTS, SO IT IS WORTH THE
     * NOTE. It used to point at the rendered identifier `Referral.raisedAt`. The screen now says
     * "the moment a referral was raised" — the same claim about the referral record, made in
     * words a coordinator reads instead of a field name. **The claim below is therefore now
     * asserted less precisely ON THE PAGE and just as precisely HERE**, which is the whole point
     * of a register: the evidence and the falsifier still name the exact field, so this entry
     * goes red if `raisedAt` stops being required whatever the page happens to call it.
     */
    rendered: "measures from the moment a referral was raised",
    claim: "`Referral.raisedAt` exists on the referral record and is required.",
    sourceFile: WARD_MODEL,
    evidence: "sendingTeamName?: string; raisedAt: Instant;",
    falsifiedBy: RAISED_AT_STOPS_BEING_REQUIRED,
  },
  {
    id: "statistics-ward-screen/identity/a-site-code-may-resolve-to-nothing",
    renderedIn: WARD_STATS_SCREEN,
    rendered: 'data-testid="ward-statistics-ward-site"',
    claim: "Site lookup returns nothing rather than a fallback site when a code matches none.",
    /** Re-pointed 2026-09-01 from the signature to the signature AND the body: `?? siteDirectory[0]` is
     *  still assignable to the declared `SiteIdentity | undefined`, so the signature alone could not fail. */
    sourceFile: WARD_SITES,
    evidence: SITE_BY_CODE_LOOKUP,
    falsifiedBy: SITE_BY_CODE_GAINS_A_FALLBACK,
  },

  // ── statistics-ed-screen.tsx ──────────────────────────────────────────────────────────────────
  {
    retiredPageProse: {
      date: "2026-10-07",
      reason: "Owner requested removal of explanatory statistics panels; the model evidence remains checked.",
    },

    id: "statistics-ed-screen/attributable/department-record-holds-three-fields",
    renderedIn: ED_SCREEN,
    rendered: 'data-testid="ward-statistics-ed-attributable"',
    claim:
      "`EmergencyDepartment` holds an id, a site code, a name and a register pointer — and nothing a figure could sit on.",
    sourceFile: WARD_MODEL,
    evidence: EMERGENCY_DEPARTMENT_BODY,
    falsifiedBy: {
      /* ⚠️ WIDENED 2026-09-18, AFTER THIS CLAIM CAUGHT ME. `referenceEdId` was added so a measured
       * road distance could be looked up for a department, and it made "these three and nothing
       * else" literally false — this register went red for exactly the right reason. The claim the
       * SCREEN rests on survived, because a register pointer is a name, not a figure; so it is
       * reworded rather than retired, and the falsifier now names the thing that would really break
       * it: a NUMBER arriving on the record. */
      change: "A figure arrives on the department record, so 'nothing a figure could sit on' is false.",
      find: "export type EmergencyDepartment = { id: string; siteCode: string; referenceEdId?: string; name: string; };",
      replaceWith:
        "export type EmergencyDepartment = { id: string; siteCode: string; referenceEdId?: string; name: string; waitingNow: number; };",
    },
  },
  {
    retiredPageProse: {
      date: "2026-10-07",
      reason: "Owner requested removal of explanatory statistics panels; the model evidence remains checked.",
    },

    id: "statistics-ed-screen/attributable/origin-ed-id-is-missing-only-on-a-community-journey",
    renderedIn: ED_SCREEN,
    /*
     * ⚠️ **NARROWED 2026-09-05 BECAUSE THE BARE `<code>` STOPPED BEING UNIQUE.** A second sentence
     * added to this screen the same day names the same field, so the register found the locator
     * twice and could no longer say WHICH sentence carries the claim. It now runs on to the claim's
     * own words — "a required field, never missing" — so the locator and the claim say the same
     * thing and a rewrite that drops the guarantee takes the locator with it.
     */
    // Locator moved 2026-09-06 with the field-name removal. The GUARANTEE the note above insists
    // must stay inside the locator — "always, never missing" — is still inside it, so a rewrite
    // that drops the requiredness still takes the locator with it. That was the whole point of
    // spanning the clause rather than the identifier, and it survives the reword intact.
    rendered: "A movement says which department a person is physically in — always, never missing",
    claim:
      "`Movement.originEdId` is missing only on a journey from an accepted community referral (D-76), which " +
      "records `originCommunity` instead.",
    sourceFile: WARD_MODEL_MOVEMENT_PARTS,
    evidence: "originEdId?: string;",
    falsifiedBy: MOVEMENT_ORIGIN_ED_BECOMES_REQUIRED,
  },
  {
    retiredPageProse: {
      date: "2026-10-07",
      reason: "Owner requested removal of explanatory statistics panels; the model evidence remains checked.",
    },

    id: "statistics-ed-screen/attributable/a-movement-records-when-it-opened",
    renderedIn: ED_SCREEN,
    rendered: "alongside when their movement opened",
    claim: "A movement records the instant it opened.",
    sourceFile: WARD_MODEL,
    evidence: "patientId?: PatientId; openedAt: Instant;",
    falsifiedBy: {
      change: "A movement stops recording the instant it opened.",
      find: "patientId?: PatientId; openedAt: Instant;",
      replaceWith: "patientId?: PatientId;",
    },
  },
  {
    retiredPageProse: {
      date: "2026-10-07",
      reason: "Owner requested removal of explanatory statistics panels; the model evidence remains checked.",
    },

    id: "statistics-ed-screen/attributable/a-movement-records-its-stage",
    renderedIn: ED_SCREEN,
    rendered: "what stage it has reached",
    claim: "A movement records the stage it has reached.",
    sourceFile: WARD_MODEL,
    evidence: "stage: MovementStage;",
    falsifiedBy: {
      change: "A movement stops recording the stage it has reached.",
      find: "stage: MovementStage;",
      replaceWith: "",
    },
  },
  {
    retiredPageProse: {
      date: "2026-10-07",
      reason: "Owner requested removal of explanatory statistics panels; the model evidence remains checked.",
    },

    id: "statistics-ed-screen/attributable/a-movement-records-every-ward-decline",
    renderedIn: ED_SCREEN,
    rendered: "every ward decline against it",
    claim: "`Movement` carries a list of declines.",
    sourceFile: WARD_MODEL,
    evidence: "declines: Decline[];",
    falsifiedBy: MOVEMENT_STOPS_CARRYING_A_DECLINE_LIST,
  },
  {
    retiredPageProse: {
      date: "2026-10-07",
      reason: "Owner requested removal of explanatory statistics panels; the model evidence remains checked.",
    },

    id: "statistics-ed-screen/attributable/an-ed-destination-carries-an-ed-id",
    renderedIn: ED_SCREEN,
    rendered: "names the department on its destination",
    claim: "The emergency-department destination arm carries an `edId`.",
    sourceFile: WARD_MODEL,
    evidence: "edId: string; /** WHY. See `REFERRAL_PURPOSES` — a separate axis from `kind`, on purpose. */",
    falsifiedBy: {
      change: "The ED destination arm stops requiring a department id, so an ED referral need not name one.",
      find: "edId: string; /** WHY. See `REFERRAL_PURPOSES` — a separate axis from `kind`, on purpose. */",
      replaceWith: "edId?: string; /** WHY. See `REFERRAL_PURPOSES` — a separate axis from `kind`, on purpose. */",
    },
  },
  {
    retiredPageProse: {
      date: "2026-10-07",
      reason: "Owner requested removal of explanatory statistics panels; the model evidence remains checked.",
    },

    id: "statistics-ed-screen/attributable/raised-at-is-required",
    renderedIn: ED_SCREEN,
    rendered: "the moment it was raised is always recorded",
    claim: "`Referral.raisedAt` is required.",
    sourceFile: WARD_MODEL,
    evidence: "sendingTeamName?: string; raisedAt: Instant;",
    falsifiedBy: RAISED_AT_STOPS_BEING_REQUIRED,
  },
  {
    retiredPageProse: {
      date: "2026-10-07",
      reason: "Owner requested removal of explanatory statistics panels; the model evidence remains checked.",
    },

    id: "statistics-ed-screen/attributable/triaged-at-is-optional",
    renderedIn: ED_SCREEN,
    rendered: "the moment it was triaged is optional",
    claim: "`Referral.triagedAt` is optional, so a referral may carry none.",
    sourceFile: WARD_MODEL,
    evidence: "triagedAt?: Instant;",
    falsifiedBy: {
      change: "The triage instant becomes required, so a referral can no longer carry none.",
      find: "triagedAt?: Instant;",
      replaceWith: "triagedAt: Instant;",
    },
  },
  {
    retiredPageProse: {
      date: "2026-10-07",
      reason: "Owner requested removal of explanatory statistics panels; the model evidence remains checked.",
    },

    id: "statistics-ed-screen/near-miss/a-movement-can-close-as-did-not-proceed",
    renderedIn: ED_SCREEN,
    // Locator moved 2026-09-06 with the field-name removal. The page now describes the outcome
    // rather than naming its enum member; the evidence and falsifier below still pin the member,
    // so a rename in the model still turns this red.
    rendered: "an outcome meaning it did not",
    claim: "A movement closure records an outcome, one of which is `did_not_proceed`.",
    sourceFile: WARD_MODEL,
    evidence: 'outcome: "arrived" | "did_not_proceed";',
    falsifiedBy: {
      change: "`did_not_proceed` is removed from the closure outcomes, so a movement can no longer close that way.",
      find: 'outcome: "arrived" | "did_not_proceed";',
      replaceWith: 'outcome: "arrived";',
    },
  },

  // ── statistics-derivations.ts doc comments ────────────────────────────────────────────────────
  {
    id: "statistics-derivations/beds-being-prepared/preparing-is-a-boolean",
    renderedIn: DERIVATIONS,
    rendered: "`BedRelease.preparing` is a boolean",
    claim: "Bed readiness is held on `BedRelease.preparing`, and it is a boolean.",
    sourceFile: WARD_MODEL,
    evidence: "preparing: boolean;",
    falsifiedBy: PREPARING_STOPS_BEING_A_BOOLEAN,
  },
  {
    id: "statistics-derivations/beds-being-prepared/expected-is-a-bed-release-state",
    renderedIn: DERIVATIONS,
    rendered: "`expected` is a member of `BED_RELEASE_STATES`",
    claim: "`expected` is one of the bed-release states, and means the discharge has not happened yet.",
    sourceFile: WARD_MODEL,
    evidence: 'export const BED_RELEASE_STATES = ["expected", "confirmed", "discharged"] as const;',
    falsifiedBy: {
      change: "`expected` is dropped from the bed-release states, so it stops being a member of that vocabulary.",
      find: 'export const BED_RELEASE_STATES = ["expected", "confirmed", "discharged"] as const;',
      replaceWith: 'export const BED_RELEASE_STATES = ["confirmed", "discharged"] as const;',
    },
  },
  {
    id: "statistics-derivations/beds-being-prepared/set-bed-preparation-has-a-unit-guard",
    renderedIn: DERIVATIONS,
    rendered: "carries a unit guard and a note-membership check",
    claim: "`SET_BED_PREPARATION` refuses an event whose acting unit is not the release's unit.",
    sourceFile: WARD_BED_EVENTS,
    /**
     * ⚠️ **RE-POINTED 2026-09-01: THIS CITED THE REJECTION MESSAGE, NOT THE GUARD.** The claim is that the
     * reducer REFUSES a mismatched acting unit, and the thing that refuses is the `if`. A message is a string
     * a neutered guard keeps: delete the comparison, leave the `reject(...)` call and its text exactly where
     * they are, and every byte the old citation named survived while the guard stopped guarding. That is the
     * `evidence-survives` shape this register's own header names, arrived at from the other direction — the
     * old falsifying edit deleted the message, which is not the change that makes the claim false.
     */
    evidence:
      "if (event.actingUnitId !== release.unitId) { return reject( state, event, " +
      "`SET_BED_PREPARATION was raised acting as unit ${event.actingUnitId} but release ${release.id} " +
      "belongs to unit ${release.unitId}`, ); }",
    falsifiedBy: {
      change:
        "The acting-unit comparison is neutered so the guard can refuse nothing, while its rejection message is " +
        "left exactly where it is — an event raised by another unit is accepted.",
      find:
        "if (event.actingUnitId !== release.unitId) { return reject( state, event, " +
        "`SET_BED_PREPARATION was raised acting as unit ${event.actingUnitId} but release ${release.id} " +
        "belongs to unit ${release.unitId}`, ); }",
      replaceWith:
        "if (false) { return reject( state, event, " +
        "`SET_BED_PREPARATION was raised acting as unit ${event.actingUnitId} but release ${release.id} " +
        "belongs to unit ${release.unitId}`, ); }",
    },
  },
  {
    id: "statistics-derivations/beds-being-prepared/set-bed-preparation-has-a-note-guard",
    renderedIn: DERIVATIONS,
    rendered: "note-membership check and **no state guard**",
    claim: "`SET_BED_PREPARATION` refuses a note that is not in `BED_PREPARATION_NOTES`.",
    sourceFile: WARD_BED_EVENTS,
    /**
     * ⚠️ **RE-POINTED 2026-09-01, THE SAME REPAIR AS ITS SIBLING ABOVE.** The old citation was the rejection
     * message alone, so a membership check emptied of its condition — `if (false)` above an untouched
     * `reject(...)` — kept every cited byte and refused nothing. The citation now opens with the condition
     * that does the refusing, and the falsifying edit neuters that condition rather than deleting the text.
     */
    evidence:
      "if (requestedNote !== undefined && !(BED_PREPARATION_NOTES as readonly string[]).includes(requestedNote)) " +
      "{ return reject(state, event, `SET_BED_PREPARATION note must be chosen from BED_PREPARATION_NOTES`); }",
    falsifiedBy: {
      change:
        "The membership condition is neutered so the guard can refuse nothing, while its rejection message is " +
        "left exactly where it is — a note outside `BED_PREPARATION_NOTES` is accepted.",
      find:
        "if (requestedNote !== undefined && !(BED_PREPARATION_NOTES as readonly string[]).includes(requestedNote)) " +
        "{ return reject(state, event, `SET_BED_PREPARATION note must be chosen from BED_PREPARATION_NOTES`); }",
      replaceWith:
        "if (false) { return reject(state, event, " +
        "`SET_BED_PREPARATION note must be chosen from BED_PREPARATION_NOTES`); }",
    },
  },
  {
    // CORRECTED 2026-09-01, and the claim was WRONG rather than merely re-pointed. The fourth
    // admission state was renamed `"left"` -> `"departed"` in `ward-admissions.ts`, so the sentence
    // "the states are waitlisted, pulled, occupied and left" had become false; `admissionStagePosition`
    // in statistics-derivations.ts cases `"departed"` and would not compile otherwise. Re-pointing the
    // citation at the new line without changing the words would have left a false claim standing on
    // fresh evidence, which is the one move this register's header names as forbidden.
    id: "statistics-derivations/admission-stage/the-admission-states-are-the-four-cased-here",
    renderedIn: DERIVATIONS,
    rendered: "export function admissionStagePosition(admission: Admission): AdmissionStagePosition {",
    /**
     * ⚠️ RE-POINTED 2026-09-01, AFTER READING THE FILE RATHER THAN AFTER READING THE RED. The
     * `"left"` -> `"departed"` rename this switch's own doc comment had been anticipating landed
     * in the merge, so this citation went red naming the claim — and the claim was the half that
     * had to change, not only the fragment. The switch already cased `"departed"`, so the code was
     * correct throughout and only the sentence about it was stale, which is precisely the shape
     * the register exists to make loud.
     */
    claim: "The admission states this switch is exhaustive over are waitlisted, pulled, occupied and departed.",
    sourceFile: WARD_ADMISSIONS,
    evidence: 'export const ADMISSION_STATES = ["waitlisted", "pulled", "occupied", "departed"] as const;',
    falsifiedBy: {
      change: "A fifth admission state arrives, so the switch is no longer exhaustive over exactly those four.",
      find: 'export const ADMISSION_STATES = ["waitlisted", "pulled", "occupied", "departed"] as const;',
      replaceWith:
        'export const ADMISSION_STATES = ["waitlisted", "pulled", "occupied", "departed", "transferred"] as const;',
    },
  },
  {
    /**
     * ⚠️ THE CLAIM WAS INVERTED, NOT MERELY RE-POINTED (2026-09-01). It read "`averageEmptyBedMinutes`'s
     * per-admission helper CLAMPS a negative pull-to-arrival gap to nought", cited
     * `return Math.max(0, arrivedAt - pulledAt);`, and was true when it was written. The owner's
     * ruling against clamping has since been applied to `ward-statistics.ts` itself, which now
     * returns `null` for a negative gap — so the divergence this module's prose described no
     * longer exists and the sentence describing it had become false. Nothing about the arithmetic
     * on this side moved; the false statement was one page's remark about another file, and the
     * register is the only thing that noticed.
     *
     * The citation is the ternary rather than the guard around it, because it is the expression
     * whose bytes change if the clamp ever comes back.
     *
     * ⚠️ **THE ID IS WARD LEAD'S, THE LOCATOR AND THE FALSIFYING EDIT ARE THIS BRANCH'S.** Both
     * sides corrected this claim independently and the merge of 2026-09-01 conflicted on it. Ward
     * Lead argued the id must describe the truth rather than negate the old falsehood — an id
     * carrying the word `clamps` is the failure message a future reader is handed, and a locator
     * asserting the opposite of the truth is a small copy of the defect this register exists to
     * catch. That argument is right and its id is taken. Their `rendered` locator is NOT taken:
     * it pointed at "measures the same two instants and clamps a negative gap to nought" and left
     * it pointing there deliberately, on the stated grounds that the sentence was still false and
     * belonged to a file they did not own. **That sentence has since been corrected** —
     * `statistics-derivations.ts` now reads "has since had the clamp removed under the same ruling
     * and now returns `null`", verified by reading the merged file, not by reading either comment.
     * So the contradiction Ward Lead wrote down no longer exists, and the locator points at the
     * corrected sentence. Their entry also carried no `falsifiedBy`, which this register now
     * requires of every claim.
     */
    id: "statistics-derivations/pull-to-arrival/ward-statistics-excludes-a-negative-gap",
    renderedIn: DERIVATIONS,
    rendered: "has since had the clamp removed under the same ruling and now",
    claim:
      "`averageEmptyBedMinutes`'s per-admission helper reports a negative pull-to-arrival gap as an incoherent " +
      "record — it excludes the record from the average rather than clamping it to nought.",
    sourceFile: WARD_STATISTICS,
    // ⚠️ RE-ANCHORED 2026-09-07. The old anchor was `return gap < 0 ? null : gap;`, which stopped
    // existing when the helper began returning a verdict so the ward page could COUNT the exclusion
    // rather than drop it silently. The claim SURVIVED the move — the record is still excluded, and
    // is now visible too — which is the question this register makes you ask before re-anchoring,
    // rather than the re-anchoring itself.
    evidence: 'return gap < 0 ? { kind: "incoherent" } : { kind: "measured", minutes: gap };',
    falsifiedBy: {
      change:
        "The clamp comes back — a negative pull-to-arrival gap is folded in as nought instead of excluding the " +
        "record — so the divergence this page's prose denies exists again.",
      find: 'return gap < 0 ? { kind: "incoherent" } : { kind: "measured", minutes: gap };',
      replaceWith: 'return { kind: "measured", minutes: Math.max(0, gap) };',
    },
  },
  {
    id: "statistics-derivations/referral-to-bed/referral-id-is-nullable",
    renderedIn: DERIVATIONS,
    rendered: "`referralId` is nullable and a real `null` means",
    claim: "`Admission.referralId` is typed `string | null`, so a null is an ordinary state.",
    sourceFile: WARD_ADMISSIONS,
    evidence: "referralId: string | null;",
    falsifiedBy: REFERRAL_ID_STOPS_BEING_NULLABLE,
  },
  {
    id: "statistics-derivations/referral-to-bed/referrals-carry-a-raised-instant",
    renderedIn: DERIVATIONS,
    rendered: "if (arrivedAt >= referral.raisedAt) chronologicallyCoherentCount += 1;",
    claim: "Every referral carries the instant it was raised, and it is required.",
    sourceFile: WARD_MODEL,
    evidence: "sendingTeamName?: string; raisedAt: Instant;",
    falsifiedBy: RAISED_AT_STOPS_BEING_REQUIRED,
  },

  // ── community-index.tsx ───────────────────────────────────────────────────────────────────────
  {
    /**
     * ⚠️ **THIS ENTRY ABSORBED A SECOND ONE ON 2026-09-01, AND THE SECOND ONE WAS DELETED RATHER
     * THAN MOVED.** `community-index/grouping/the-missing-region-field-is-enforcement` claimed that
     * `community-derivations.ts` "records the absent `region` field as enforcement, in those words",
     * and cited that comment. Phrased about the PROSE, it could only ever fail by somebody deleting
     * or rewording the comment — never by a `region` field arriving, which is the change anybody
     * cares about. It read as a second guard where there was one: `COMMUNITY_TEAM_BODY` here is the
     * guard, because it pins the whole record and breaks the moment a `region` field is added.
     * Deleted rather than recorded in `UNEVIDENCED_CLAIMS`, because it is not an unguarded claim —
     * it is a duplicate of a guarded one.
     */
    id: "community-index/grouping/team-record-is-id-and-name",
    renderedIn: COMMUNITY_INDEX,
    rendered: 'data-testid="community-index-provenance"',
    claim: "`CommunityTeam` is `{ id, name }` and carries nothing else to group by.",
    sourceFile: COMMUNITY_DERIVATIONS,
    evidence: COMMUNITY_TEAM_BODY,
    falsifiedBy: {
      change:
        "A `region` field arrives on the team record, so it stops being `{ id, name }` with nothing else to group " +
        "by — which is also the only edit the deleted 'missing region field is enforcement' entry was ever supposed " +
        "to catch.",
      find: "Never composed or prettified here. */ name: string; };",
      replaceWith: "Never composed or prettified here. */ name: string; region: HomeRegion; };",
    },
  },
  {
    id: "community-index/grouping/the-region-keyed-table-exists-elsewhere",
    renderedIn: COMMUNITY_INDEX,
    rendered: "The region-keyed `COMMUNITY_TEAMS` table in `ward-teams.ts`",
    claim: "A region-keyed community-team table exists in `ward-teams.ts` and is keyed by home region.",
    sourceFile: WARD_TEAMS,
    evidence: "export const COMMUNITY_TEAMS: Record<HomeRegion, string> = {",
    falsifiedBy: {
      change: "The table stops being keyed by home region, so the contrast the page draws no longer holds.",
      find: "export const COMMUNITY_TEAMS: Record<HomeRegion, string> = {",
      replaceWith: "export const COMMUNITY_TEAMS: Record<string, string> = {",
    },
  },
  {
    id: "community-index/grouping/the-id-is-a-slug-of-the-name",
    renderedIn: COMMUNITY_INDEX,
    rendered: "`id` is a slug derived from `name`",
    claim: "A team's id is computed from its name rather than authored beside it.",
    sourceFile: COMMUNITY_DERIVATIONS,
    evidence: "id: communityTeamSlug(name),",
    falsifiedBy: {
      change: "The id stops being computed from the name and is authored beside it instead.",
      find: "id: communityTeamSlug(name),",
      replaceWith: "id: AUTHORED_TEAM_IDS[name],",
    },
  },
  {
    id: "community-index/enumeration/pages-derive-from-the-referral-vocabulary",
    renderedIn: COMMUNITY_INDEX,
    rendered: "The teams come from `COMMUNITY_TEAM_PAGES`",
    claim: "`COMMUNITY_TEAM_PAGES` is derived from the referral picker's team vocabulary, not hand-written.",
    sourceFile: COMMUNITY_DERIVATIONS,
    evidence: "export const COMMUNITY_TEAM_PAGES: readonly CommunityTeam[] = communityTeamOptions().map((name) => ({",
    falsifiedBy: {
      change: "The page list stops being derived from the referral picker's vocabulary and is hand-written.",
      find: "export const COMMUNITY_TEAM_PAGES: readonly CommunityTeam[] = communityTeamOptions().map((name) => ({",
      replaceWith:
        "export const COMMUNITY_TEAM_PAGES: readonly CommunityTeam[] = HAND_WRITTEN_TEAM_NAMES.map((name) => ({",
    },
  },
  {
    id: "community-index/enumeration/the-vocabulary-comes-from-one-source-document",
    renderedIn: COMMUNITY_INDEX,
    rendered: "Every team listed here comes from one extracted source",
    claim: "The team vocabulary is read out of the extracted catchment rows of one source document.",
    /** Widened 2026-09-01 from the function head and its first loop to the whole function: a "one
     *  document" claim can only fail when a SECOND document is read, and a second loop appended
     *  underneath the first left every previously cited byte in place. */
    sourceFile: DESTINATION_OPTIONS,
    evidence: COMMUNITY_TEAM_VOCABULARY_DERIVATION,
    falsifiedBy: {
      change:
        "A second extracted document's rows are read into the same vocabulary, so it stops coming from one source " +
        "document. The file already models several documents, so this is a live edit rather than a theoretical one.",
      find: "spellings.set(key, counts); } }",
      replaceWith:
        "spellings.set(key, counts); } } for (const row of S2020_CATCHMENT_ROWS) { for (const clinic of " +
        "parseFollowUpClinicSet(row.followUpClinicVerbatim)) { spellings.set(communityTeamKey(clinic), new " +
        "Map([[clinic, 1]])); } }",
    },
  },
  {
    id: "community-index/enumeration/a-team-name-is-what-a-referral-stores",
    renderedIn: COMMUNITY_INDEX,
    rendered: "Every community team a referral can name in this prototype",
    claim: "A team's name is exactly the string a referral stores, never composed or prettified.",
    sourceFile: COMMUNITY_DERIVATIONS,
    evidence: COMMUNITY_TEAM_PAGE_DERIVATION,
    falsifiedBy: {
      change:
        "A team's name starts being prettified on the way to its page, so it stops being exactly the string a " +
        "referral stores.",
      find: "id: communityTeamSlug(name), name, }));",
      replaceWith: "id: communityTeamSlug(name), name: titleCase(name), }));",
    },
  },
  {
    /**
     * REPOINTED 2026-09-10, AND THE MOVE IT ANTICIPATED IS THE ONE THAT HAPPENED. This entry's own
     * `falsifiedBy.change` read "the href builder moves out of `community-screen.tsx`" - which is
     * exactly what the shell facade did to it. The claim was not deleted and was not weakened: it
     * still says there is ONE builder and still names the file that holds it, and the mechanism
     * still goes red the day that stops being true. What moved is which file it points at.
     */
    id: "community-index/link/the-href-builder-lives-in-the-shell-facade",
    renderedIn: COMMUNITY_INDEX,
    rendered: "`communityTeamHref` now\n * lives in\n * `shell/ward-facade.ts`",
    claim: "The one href builder for a team page is exported from `shell/ward-facade.ts`.",
    sourceFile: WARD_FACADE,
    evidence: "export function communityTeamHref(team: CommunityTeam): string {",
    falsifiedBy: {
      change: "The href builder moves out of `shell/ward-facade.ts`, so that file stops exporting it.",
      find: "export function communityTeamHref(team: CommunityTeam): string {",
      replaceWith: "",
    },
  },
  {
    id: "community-index/link/the-team-screen-is-a-client-module",
    renderedIn: COMMUNITY_INDEX,
    rendered: 'which is `"use client"`',
    claim: "`community-screen.tsx` is a client module, so its exports reach a server component as references.",
    sourceFile: COMMUNITY_SCREEN,
    evidence: '"use client";',
    falsifiedBy: {
      change:
        "The client directive is removed, so `community-screen.tsx` becomes a server module. (A directive MOVED " +
        "below the imports would falsify the claim while leaving these bytes in place — a residual this mechanism " +
        "does not close, because the directive's effect depends on being the file's FIRST statement and a substring " +
        "cannot witness position.)",
      find: '"use client";',
      replaceWith: "",
    },
  },
  {
    id: "community-index/restraint/the-team-screen-carries-the-other-teams-switcher",
    renderedIn: COMMUNITY_INDEX,
    rendered: 'renders an "Other community teams" switcher',
    claim: "The team screen does render an 'Other community teams' switcher, as this page says it does.",
    // ⚠️ RE-POINTED 15 Oct 2026 AFTER READING THE CODE: the screen was split into sections as a pure
    // refactor, and the switcher's markup moved unchanged into the hero section the screen renders.
    sourceFile: COMMUNITY_SCREEN_HERO,
    /*
     * ⚠️ **RE-POINTED 2026-09-05 AFTER READING THE CODE, WHICH IS THE STEP THIS GATE EXISTS TO FORCE
     * — not to turn a red test green.** The third-edition port moved the switcher into a native
     * `details`, whose `teamSwitcherHeader` summary now carries a `teamSwitcherTitle` span reading
     * "Change team" and the number of other teams. **The claim itself is unchanged and still true:**
     * the `<nav>` still carries `aria-label="Other community teams"`, and its disclosed list still
     * maps every other team to a link.
     *
     * ⚠️ **THE FRAGMENT DELIBERATELY RUNS ON TO `teamList`, AND TWO OF US INDEPENDENTLY RE-POINTED
     * THIS LINE TONIGHT — one stopping at the `</h2>`.** The claim on the index page is that the
     * switcher LINKS every other team; a fragment ending at the heading evidences a heading and
     * nothing else, so it would keep passing the day the list itself disappeared. The longer
     * fragment is the one that carries the claim.
     *
     * Verified against `community-screen.tsx` by reading the `teamSwitcher` nav itself. **No line
     * number recorded on purpose:** the earlier version of this comment cited `:626` and the block
     * had already moved to `:972` by the time it was folded, which is what a line number in a
     * comment always does.
     */
    evidence:
      '<nav className={styles.teamSwitcher} aria-label="Other community teams"> ' +
      "<details className={`${styles.teamDisclosure} source-print`}> " +
      "<summary className={styles.teamSwitcherHeader}> " +
      "<span className={styles.teamSwitcherTitle}>Change team</span> " +
      "<span className={styles.switchCount}>{COMMUNITY_TEAM_PAGES.length - 1} other teams</span> " +
      "</summary> " +
      "<div className={styles.teamPopover}> " +
      "<div className={styles.teamPopoverHeader}> " +
      "<span>Select team</span> " +
      "<span className={styles.teamPopoverMeta}>{COMMUNITY_TEAM_PAGES.length - 1} other catchments</span> " +
      "</div> " +
      "<ul className={styles.teamList}> " +
      "{COMMUNITY_TEAM_PAGES.filter((other) => other.id !== team.id).map((other) => {",
    falsifiedBy: {
      change:
        "The switcher is removed from the team screen. (A block wrapped in a false condition would leave these " +
        "bytes in place — a substring witnesses presence in the file, not that it renders.)",
      find: '<nav className={styles.teamSwitcher} aria-label="Other community teams">',
      replaceWith: "",
    },
  },
  {
    /**
     * ⚠️ **THIS CLAIM USED TO LIVE IN `UNEVIDENCED_CLAIMS`, AS AN ABSENCE, AND THE ABSENCE STOPPED
     * BEING TRUE.** Its id was `community-index/reachability/nothing-links-to-this-index-yet` and its
     * claim was that nothing in the navigation linked to this index. `ward-nav.ts` registers a
     * `community` entry under `WARD_NAV`, and `tests/ward-community-index.dom.test.tsx` proves the
     * root rail renders it — a passing assertion, not the `it.fails` tripwire it started life as.
     * A claim that the route IS reachable is a presence, not an absence, so it can carry real
     * evidence and moved here rather than being edited in place.
     */
    id: "community-index/reachability/the-root-rail-links-this-index",
    renderedIn: COMMUNITY_INDEX,
    rendered: "the root rail renders that entry",
    claim:
      "The community index route is registered in `ward-nav.ts`'s `WARD_NAV` list and linked from the root rail, " +
      "so the team pages it lists are reachable rather than reachable only by typing an address.",
    sourceFile: WARD_NAV,
    evidence: 'id: "community", href: "/ward-flow/community",',
    falsifiedBy: {
      change:
        "The `community` entry is removed from `WARD_NAV` (or its href changes), so the root rail no longer " +
        "links this index and the claim becomes false again.",
      find: 'id: "community", href: "/ward-flow/community",',
      replaceWith: "",
    },
  },
];
