// The claims register entries for `statistics-screen.tsx`, split out of
// `statistics-claims-register.ts` (which concatenates them into `MODEL_CLAIMS`) to keep it under the line cap.

import {
  type ModelClaim,
  WARD_MODEL,
  WARD_ADMISSIONS,
  WARD_REDUCER,
  WARD_RECORD_EVENTS,
  WARD_PLACEMENT_EVENTS,
  WARD_BED_EVENTS,
  WARD_REFERRAL_ANSWER_EVENTS,
  WARD_DERIVATIONS,
  WARD_BED_AVAILABILITY,
  WARD_REFERRALS,
  STATISTICS_SCREEN,
  REFERRAL_ADDRESSING_BODY,
  WARD_DESTINATION_ARM,
  WARD_DESTINATION_ARM_GAINS_A_UNIT_ID,
  BED_RELEASE_BODY,
  REFERRAL_ADDRESSING_GAINS_A_SECOND_UNIT_ID,
  ACCEPTANCE_STOPS_RECORDING_THE_UNIT,
  DECLINE_LOSES_ITS_UNIT,
  DECLINE_GAINS_FREE_TEXT,
  MOVEMENT_STOPS_CARRYING_A_DECLINE_LIST,
  MOVEMENT_ORIGIN_ED_BECOMES_OPTIONAL,
  REFERRED_UNIT_IDS_BECOMES_ONE_ID,
  THE_PARALLEL_REFERRAL_CAP_IS_REMOVED,
  REFERRAL_ID_STOPS_BEING_NULLABLE,
  RAISED_AT_STOPS_BEING_REQUIRED,
  PREPARING_STOPS_BEING_A_BOOLEAN,
  DECLINE_BODY,
  UNIT_CAPACITY_COUNTS,
  HELD_IS_DERIVED_FROM_TWO_AGGREGATES,
  DECLINE_REASONS_LIST,
  REFERRAL_DECLINE_REASONS_LIST,
} from "./statistics-claims-shared";

export const STATISTICS_SCREEN_CLAIMS: readonly ModelClaim[] = [
  // ── statistics-screen.tsx — beds being made ready ─────────────────────────────────────────────
  {
    retiredPageProse: {
      date: "2026-10-07",
      reason: "Owner requested removal of explanatory statistics panels; the model evidence remains checked.",
    },

    id: "statistics-screen/bed-readiness/preparing-is-a-boolean",
    renderedIn: STATISTICS_SCREEN,
    rendered: 'data-testid="ward-statistics-readiness-timing-absent"',
    claim: "Bed readiness is held on `BedRelease.preparing`, and it is a boolean.",
    sourceFile: WARD_MODEL,
    evidence: "preparing: boolean;",
    falsifiedBy: PREPARING_STOPS_BEING_A_BOOLEAN,
  },
  {
    retiredPageProse: {
      date: "2026-10-07",
      reason: "Owner requested removal of explanatory statistics panels; the model evidence remains checked.",
    },

    id: "statistics-screen/bed-readiness/preparation-stamps-confirmed-at",
    renderedIn: STATISTICS_SCREEN,
    rendered: "Bed readiness has a yes/no flag and one shared timestamp",
    // Audit 2 E-11 (20 Oct 2026): still true before the patient leaves; after departure
    // `confirmedAt` is the departure time and is kept.
    claim:
      "Setting `preparing` writes an instant — before departure `SET_BED_PREPARATION` stamps `confirmedAt: event.now`.",
    sourceFile: WARD_BED_EVENTS,
    evidence: 'confirmedAt: release.state === "discharged" ? release.confirmedAt : event.now,',
    falsifiedBy: {
      change: "`SET_BED_PREPARATION` stops stamping an instant, so setting `preparing` no longer writes one.",
      find: 'confirmedAt: release.state === "discharged" ? release.confirmedAt : event.now,',
      replaceWith: "confirmedAt: release.confirmedAt,",
    },
  },
  {
    retiredPageProse: {
      date: "2026-10-07",
      reason: "Owner requested removal of explanatory statistics panels; the model evidence remains checked.",
    },

    id: "statistics-screen/bed-readiness/confirmed-at-is-one-shared-field",
    renderedIn: STATISTICS_SCREEN,
    // Locator moved 2026-09-06 with the field-name removal. The page now says "that record's ONE
    // shared provenance field"; the evidence below still names `confirmedAt` exactly, so a second
    // instant appearing on the release record still turns this red.
    // ⚠️ Lengthened immediately after the move: "ONE shared provenance field" matched TWICE —
    // once in the rendered paragraph and once in the source comment above it that I had just
    // written using the same phrase. The register caught it and said so by name. A locator that
    // matches a comment as well as the page cannot say which paragraph makes the claim.
    rendered: "one shared timestamp that later release actions overwrite",
    claim:
      "`BedRelease` carries a single `confirmedAt` that every readiness act overwrites, not one instant per act. " +
      "Only cleared discharge blockers keep their own instants: on the release in `clearedBlockHistory`, or on the " +
      "admission in `stayBlockClearances` when no release is linked.",
    sourceFile: WARD_MODEL,
    evidence: BED_RELEASE_BODY,
    falsifiedBy: {
      change:
        "The release record gains a SECOND instant — `preparedAt` — so `confirmedAt` stops being the one field " +
        "every act on the release overwrites. This is the edit the old two-field citation survived.",
      find: "confirmedAt: Instant; /** A role — a unit or service label. Never a personal name. */ confirmedBy: string;",
      replaceWith:
        "confirmedAt: Instant; preparedAt: Instant | null; /** A role — a unit or service label. Never a personal " +
        "name. */ confirmedBy: string;",
    },
  },
  {
    id: "statistics-screen/bed-readiness/confirming-the-discharge-overwrites-it",
    retiredPageProse: {
      date: "2026-09-13",
      reason:
        "Q004 owner-requested removal of implementation commentary. The concise timestamp limitation no longer names discharge confirmation as a specific overwrite action.",
    },
    renderedIn: STATISTICS_SCREEN,
    rendered: "Confirming the discharge, flagging the bed as stuck",
    claim: "`CONFIRM_BED_RELEASE` overwrites `confirmedAt`.",
    sourceFile: WARD_BED_EVENTS,
    evidence: 'const updated: BedRelease = { ...release, state: "confirmed", waitingOn: null, confirmedAt: event.now,',
    falsifiedBy: {
      change: "`CONFIRM_BED_RELEASE` stops writing `confirmedAt`, so confirming a discharge no longer overwrites it.",
      find: 'const updated: BedRelease = { ...release, state: "confirmed", waitingOn: null, confirmedAt: event.now,',
      replaceWith: 'const updated: BedRelease = { ...release, state: "confirmed", waitingOn: null,',
    },
  },
  {
    id: "statistics-screen/bed-readiness/blocking-the-bed-overwrites-it",
    retiredPageProse: {
      date: "2026-09-13",
      reason:
        "Q004 owner-requested removal of implementation commentary. The concise timestamp limitation no longer names blocking a bed as a specific overwrite action.",
    },
    renderedIn: STATISTICS_SCREEN,
    rendered: "clearing that flag, releasing the bed and turning preparation off again all",
    claim: "`BLOCK_BED_RELEASE` overwrites `confirmedAt`.",
    sourceFile: WARD_BED_EVENTS,
    evidence: "blockedBy: recordedByLabel(event.role, blockedUnit.name), confirmedAt: event.now,",
    falsifiedBy: {
      change: "`BLOCK_BED_RELEASE` stops writing `confirmedAt`, so flagging the bed as stuck no longer overwrites it.",
      find: "blockedBy: recordedByLabel(event.role, blockedUnit.name), confirmedAt: event.now,",
      replaceWith: "blockedBy: recordedByLabel(event.role, blockedUnit.name),",
    },
  },
  {
    id: "statistics-screen/bed-readiness/clearing-the-block-overwrites-it",
    retiredPageProse: {
      date: "2026-09-13",
      reason:
        "Q004 owner-requested removal of implementation commentary. The concise timestamp limitation no longer names clearing a bed block as a specific overwrite action.",
    },
    renderedIn: STATISTICS_SCREEN,
    rendered: "overwrite it. So the record can hold when preparation started or when it ended",
    claim: "`CLEAR_BED_RELEASE_BLOCK` overwrites `confirmedAt`.",
    sourceFile: WARD_BED_EVENTS,
    evidence: "const unblocked: BedRelease = { ...release, blocker: null, blockedBy: null, confirmedAt: event.now,",
    falsifiedBy: {
      change: "`CLEAR_BED_RELEASE_BLOCK` stops writing `confirmedAt`, so clearing the flag no longer overwrites it.",
      find: "const unblocked: BedRelease = { ...release, blocker: null, blockedBy: null, confirmedAt: event.now,",
      replaceWith: "const unblocked: BedRelease = { ...release, blocker: null, blockedBy: null,",
    },
  },
  {
    id: "statistics-screen/bed-readiness/releasing-the-bed-overwrites-it",
    retiredPageProse: {
      date: "2026-09-13",
      reason:
        "Q004 owner-requested removal of implementation commentary. The concise timestamp limitation no longer names releasing a bed as a specific overwrite action.",
    },
    renderedIn: STATISTICS_SCREEN,
    rendered: "There is no pair of instants to subtract",
    claim: "`RELEASE_BED` overwrites `confirmedAt`.",
    sourceFile: WARD_BED_EVENTS,
    evidence:
      'const updatedRelease: BedRelease = { ...release, state: "discharged", waitingOn: null, blocker: null, ' +
      "blockedBy: null, confirmedAt: event.now,",
    falsifiedBy: {
      change: "`RELEASE_BED` stops writing `confirmedAt`, so releasing the bed no longer overwrites it.",
      find:
        'const updatedRelease: BedRelease = { ...release, state: "discharged", waitingOn: null, blocker: null, ' +
        "blockedBy: null, confirmedAt: event.now,",
      replaceWith:
        'const updatedRelease: BedRelease = { ...release, state: "discharged", waitingOn: null, blocker: null, ' +
        "blockedBy: null,",
    },
  },
  {
    id: "statistics-screen/bed-readiness/preparation-begins-only-after-a-release",
    retiredPageProse: {
      date: "2026-09-13",
      reason:
        "Q004 owner-requested removal of implementation commentary. The page no longer describes initial preparation state or the event that enables preparation.",
    },
    renderedIn: STATISTICS_SCREEN,
    rendered: "preparation only\n              ever begins after somebody has left",
    claim: "A newly flagged release starts `preparing: false`; preparation only ever begins after `RELEASE_BED`.",
    sourceFile: WARD_BED_EVENTS,
    evidence:
      "// A bed nobody has yet left is not being made ready. Preparation only ever begins after " +
      "// `RELEASE_BED`, and only through `SET_BED_PREPARATION` — see that case. preparing: false,",
    falsifiedBy: {
      change:
        "A newly flagged release is created ALREADY being made ready, so preparation no longer starts off. (This " +
        "falsifies the half the code carries. That preparation begins ONLY after `RELEASE_BED` is an absence — no " +
        "other reducer case sets it — and no substring can witness that.)",
      find: "see that case. preparing: false,",
      replaceWith: "see that case. preparing: true,",
    },
  },
  // Retired 8 October 2026: only-discharged-releases-offer-the-flag. Its page prose was removed
  // under Q004 on 13 September, and its remaining citation pointed to an unused Ward-screen
  // filter removed by the lint repair. It never proved that a rendered preparation control
  // existed; retain the retirement reason rather than redirecting the claim to unrelated code.
  {
    retiredPageProse: {
      date: "2026-10-07",
      reason: "Owner requested removal of explanatory statistics panels; the model evidence remains checked.",
    },

    id: "statistics-screen/bed-readiness/reducer-writes-the-callers-preparing-value",
    renderedIn: STATISTICS_SCREEN,
    rendered: "This count reads the flag as recorded; the model does not enforce that the occupant has already left.",
    claim:
      "`SET_BED_PREPARATION` stores the caller's `preparing` value as given, deriving nothing from the " +
      "release's own state.",
    sourceFile: WARD_BED_EVENTS,
    evidence: "const prepared: BedRelease = { ...release, preparing: event.preparing,",
    falsifiedBy: {
      change:
        "The reducer starts deriving the stored value from the release's own state instead of storing what the " +
        "caller sent.",
      find: "const prepared: BedRelease = { ...release, preparing: event.preparing,",
      replaceWith:
        'const prepared: BedRelease = { ...release, preparing: event.preparing && release.state === "discharged",',
    },
  },

  // ── statistics-screen.tsx — declines per ward ─────────────────────────────────────────────────
  {
    retiredPageProse: {
      date: "2026-10-07",
      reason: "Owner requested removal of explanatory statistics panels; the model evidence remains checked.",
    },

    id: "statistics-screen/declines/addressing-has-one-unit-field",
    renderedIn: STATISTICS_SCREEN,
    rendered: 'data-testid="ward-statistics-declines-withheld"',
    claim: "The answer records acceptedUnitId; a named ward request may also record its target before acceptance.",
    sourceFile: WARD_MODEL,
    evidence: REFERRAL_ADDRESSING_BODY,
    falsifiedBy: REFERRAL_ADDRESSING_GAINS_A_SECOND_UNIT_ID,
  },
  {
    id: "statistics-screen/declines/ward-destination-records-bed-criteria",
    retiredPageProse: {
      date: "2026-09-13",
      reason:
        "Q004 owner-requested removal of implementation commentary. The page no longer enumerates destination bed criteria.",
    },
    renderedIn: STATISTICS_SCREEN,
    rendered: "the sex it must suit, whether it must be secure, whether it must be able",
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

    id: "statistics-screen/declines/accepted-unit-id-is-written-on-acceptance",
    renderedIn: STATISTICS_SCREEN,
    rendered: "Named ward referrals preserve their recipient before acceptance",
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

    id: "statistics-screen/declines/movement-declines-name-a-unit",
    renderedIn: STATISTICS_SCREEN,
    rendered: "declines name a ward for people already inside an emergency department.",
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

    id: "statistics-screen/declines/movement-carries-a-decline-list",
    renderedIn: STATISTICS_SCREEN,
    rendered: "Movement declines grouped by the ward&apos;s recorded reason.",
    claim: "`Movement` carries a list of declines.",
    sourceFile: WARD_MODEL,
    evidence: "declines: Decline[];",
    falsifiedBy: MOVEMENT_STOPS_CARRYING_A_DECLINE_LIST,
  },
  {
    id: "statistics-screen/declines/movement-declines-use-their-own-reason-list",
    retiredPageProse: {
      date: "2026-09-13",
      reason:
        "Q004 owner-requested removal of implementation commentary. The page no longer describes the two decline reason vocabularies.",
    },
    renderedIn: STATISTICS_SCREEN,
    rendered: "drawn from a different list of reasons",
    claim: "A movement decline's reason comes from `DECLINE_REASONS`, a different list from the referral's.",
    sourceFile: WARD_MODEL,
    evidence: "export type DeclineReason = (typeof DECLINE_REASONS)[number];",
    falsifiedBy: {
      change:
        "Movement declines start drawing on the referral vocabulary instead of their own, so the two stop being " +
        "different lists.",
      find: "export type DeclineReason = (typeof DECLINE_REASONS)[number];",
      replaceWith: "export type DeclineReason = ReferralDeclineReason;",
    },
  },
  {
    id: "statistics-screen/declines/referral-declines-use-the-referral-reason-list",
    retiredPageProse: {
      date: "2026-09-13",
      reason:
        "Q004 owner-requested removal of implementation commentary. The page no longer describes the two decline reason vocabularies.",
    },
    renderedIn: STATISTICS_SCREEN,
    rendered: "A referral decline sits on",
    claim: "A referral decline's reason comes from `REFERRAL_DECLINE_REASONS`, a separate list.",
    sourceFile: WARD_MODEL,
    evidence: "export type ReferralDeclineReason = (typeof REFERRAL_DECLINE_REASONS)[number];",
    falsifiedBy: {
      change: "Referral declines stop having a vocabulary of their own and reuse the movement one.",
      find: "export type ReferralDeclineReason = (typeof REFERRAL_DECLINE_REASONS)[number];",
      replaceWith: "export type ReferralDeclineReason = DeclineReason;",
    },
  },
  {
    retiredPageProse: {
      date: "2026-10-07",
      reason: "Owner requested removal of explanatory statistics panels; the model evidence remains checked.",
    },

    id: "statistics-screen/declines/a-movement-is-inside-an-emergency-department",
    renderedIn: STATISTICS_SCREEN,
    rendered: "people already inside an emergency department.",
    claim: "Every movement names the emergency department the person is physically in.",
    sourceFile: WARD_MODEL,
    evidence: "originEdId: string;",
    falsifiedBy: MOVEMENT_ORIGIN_ED_BECOMES_OPTIONAL,
  },

  // ── statistics-screen.tsx — empty beds that were not offered (the figure that is not built) ───
  {
    retiredPageProse: {
      date: "2026-10-07",
      reason: "Owner requested removal of explanatory statistics panels; the model evidence remains checked.",
    },

    id: "statistics-screen/not-offered/a-unit-holds-two-aggregate-capacity-counts",
    renderedIn: STATISTICS_SCREEN,
    rendered: 'data-testid="ward-statistics-not-offered-absent"',
    claim:
      "A unit record holds `empty` (physically empty beds, per the feed) and `allocatable` (beds the ward says " +
      "it can actually allocate), and both are aggregate counts for the whole ward.",
    sourceFile: WARD_MODEL,
    evidence: UNIT_CAPACITY_COUNTS,
    falsifiedBy: {
      change:
        "A per-bed field arrives between the two counts, so they stop being an adjacent pair of whole-ward " +
        "aggregates and the page's paraphrase of what each means no longer holds.",
      find: "empty: CapacityFigure; /** Beds the ward says it can actually allocate.",
      replaceWith: "empty: CapacityFigure; emptyBedIds: string[]; /** Beds the ward says it can actually allocate.",
    },
  },
  {
    id: "statistics-screen/not-offered/the-readiness-gap-is-derived-from-those-two-counts",
    retiredPageProse: {
      date: "2026-09-13",
      reason:
        "Q004 owner-requested removal of implementation commentary. The page retains the no-offer/no-proxy limitation but no longer explains the readiness-gap derivation.",
    },
    renderedIn: STATISTICS_SCREEN,
    rendered: "What the model derives from the pair is a",
    claim:
      "The ward-side readiness gap is DERIVED from the unit's own aggregate counts alone (`empty`, `allocatable`, " +
      "`beds` and whether the ward is closed) — no per-bed or per-request field enters it, so it can name neither " +
      "a bed nor a request.",
    sourceFile: WARD_BED_AVAILABILITY,
    evidence: HELD_IS_DERIVED_FROM_TWO_AGGREGATES,
    falsifiedBy: {
      change:
        "The readiness gap starts reading a per-bed field, so it is no longer derived from the two aggregate counts " +
        "alone and could name a bed.",
      find: "const held = Math.max(effectiveEmpty - available, 0);",
      replaceWith: "const held = unit.emptyBedIds.filter((id) => !unit.offeredBedIds.includes(id)).length;",
    },
  },

  // ── statistics-screen.tsx — refusals so far ───────────────────────────────────────────────────
  {
    id: "statistics-screen/refused-so-far/referred-unit-ids-holds-the-wards-still-deciding",
    renderedIn: STATISTICS_SCREEN,
    rendered: 'data-testid="ward-statistics-refused-so-far"',
    claim: "`Movement.referredUnitIds` is the list of units currently holding a live referral, not a single id.",
    sourceFile: WARD_MODEL,
    evidence: "referredUnitIds: string[];",
    falsifiedBy: REFERRED_UNIT_IDS_BECOMES_ONE_ID,
  },
  {
    id: "statistics-screen/refused-so-far/the-condition-is-nothing-pending-and-a-refusal-on-record",
    renderedIn: STATISTICS_SCREEN,
    rendered: 'data-testid="ward-statistics-refused-so-far-count"',
    claim:
      "The counted condition is exactly `referredUnitIds` empty, `declines` non-empty and no accepting unit " +
      "(2026-09-17: an accepted movement with an earlier decline is not 'declined by all') — no clock and " +
      "no closure state.",
    sourceFile: WARD_DERIVATIONS,
    evidence:
      "movement.referredUnitIds.length === 0 && movement.declines.length > 0 && movement.acceptedUnitId === undefined,",
    falsifiedBy: {
      change: "The count starts consulting a closure state as well, so 'no clock and no closure state' is false.",
      find: "movement.referredUnitIds.length === 0 && movement.declines.length > 0 && movement.acceptedUnitId === undefined,",
      replaceWith:
        "movement.referredUnitIds.length === 0 && movement.declines.length > 0 && " +
        'movement.acceptedUnitId === undefined && movement.stage !== "closed",',
    },
  },
  {
    id: "statistics-screen/refused-so-far/a-decline-removes-the-ward-and-leaves-the-stage",
    retiredPageProse: {
      date: "2026-09-13",
      reason:
        "Q004 owner-requested removal of implementation commentary. The page no longer describes the decline reducer transition.",
    },
    renderedIn: STATISTICS_SCREEN,
    rendered: "takes that ward off the list of wards deciding and leaves the movement at the stage referrals are made",
    claim:
      '`case "DECLINE"` removes the declining unit from `referredUnitIds`, appends to `declines`, and leaves ' +
      "the movement in `destination_review`.",
    sourceFile: WARD_REFERRAL_ANSWER_EVENTS,
    evidence:
      // Re-read 17 Sept 2026: still true. The filter moved into a named const when the last-decline blocker
      // fix landed; the decline still removes the unit, appends to declines and stays at destination_review.
      "const remainingReferredUnitIds = movement.referredUnitIds.filter((unitId) => unitId !== event.unitId); " +
      "const updated: Movement = { ...movement, referredUnitIds: remainingReferredUnitIds, " +
      "declines: [...movement.declines, { unitId: event.unitId, at: event.now, reason: event.reason }], " +
      'stage: "destination_review",',
    falsifiedBy: {
      change:
        "A decline starts closing the movement instead of leaving it at the stage referrals are made from, so a " +
        "coordinator cannot put it to fresh wards.",
      find:
        "declines: [...movement.declines, { unitId: event.unitId, at: event.now, reason: event.reason }], stage: " +
        '"destination_review",',
      replaceWith:
        "declines: [...movement.declines, { unitId: event.unitId, at: event.now, reason: event.reason }], stage: " +
        '"closed",',
    },
  },
  {
    id: "statistics-screen/refused-so-far/that-stage-can-be-referred-from-again",
    retiredPageProse: {
      date: "2026-09-13",
      reason:
        "Q004 owner-requested removal of implementation commentary. The page no longer describes which stage permits a fresh referral.",
    },
    renderedIn: STATISTICS_SCREEN,
    rendered: "so a coordinator can put it to fresh wards the moment a decline lands",
    claim:
      "`destination_review` — the stage a decline leaves a movement in — is one of the stages a fresh " +
      "`REFER_TO_UNITS` is allowed from.",
    sourceFile: WARD_REDUCER,
    evidence:
      'export const REFERRABLE_MOVEMENT_STAGES: readonly MovementStage[] = ["placement_requested", ' +
      '"destination_review"];',
    falsifiedBy: {
      change:
        "`destination_review` is dropped from the stages a fresh `REFER_TO_UNITS` is allowed from, so the stage a " +
        "decline leaves a movement in stops being referrable.",
      find:
        'export const REFERRABLE_MOVEMENT_STAGES: readonly MovementStage[] = ["placement_requested", ' +
        '"destination_review"];',
      replaceWith: 'export const REFERRABLE_MOVEMENT_STAGES: readonly MovementStage[] = ["placement_requested"];',
    },
  },
  {
    id: "statistics-screen/refused-so-far/the-cap-on-parallel-referrals-exists",
    renderedIn: STATISTICS_SCREEN,
    /* The page RENDERS the cap's value rather than typing it, so the numeral cannot go stale; what
       this pins is that the constant the page reads is still the cap it says it is. */
    rendered: 'data-testid="ward-statistics-refused-so-far-cap"',
    claim: "A cap on how many wards one movement can be live at exists and is named `PARALLEL_REFERRAL_CAP`.",
    sourceFile: WARD_MODEL,
    evidence: "export const PARALLEL_REFERRAL_CAP = 3;",
    falsifiedBy: THE_PARALLEL_REFERRAL_CAP_IS_REMOVED,
  },
  {
    retiredPageProse: {
      date: "2026-10-07",
      reason: "Owner requested removal of remaining explanatory captions; the model evidence remains checked.",
    },
    id: "statistics-screen/refused-so-far/the-shared-derivation-classifies-escalation-first",
    renderedIn: STATISTICS_SCREEN,
    rendered: "Escalations are classified first, so this is a floor.",
    claim:
      "`handoverSnapshot` excludes every movement it has already classed `escalated` from the declined-by-all " +
      "and acceptance-withdrawn candidates, so an escalated movement meeting the same condition is absent from " +
      "the count.",
    sourceFile: WARD_DERIVATIONS,
    evidence:
      "const escalatedIds = new Set(escalated.map((entry) => entry.movement.id)); " +
      "const stranded = open .filter((movement) => !escalatedIds.has(movement.id))",
    falsifiedBy: {
      change:
        "The declined-by-all/acceptance-withdrawn candidates stop excluding movements already classed as " +
        "escalated, so an escalated movement meeting the same condition is counted here after all.",
      find:
        "const escalatedIds = new Set(escalated.map((entry) => entry.movement.id)); const stranded = open " +
        ".filter((movement) => !escalatedIds.has(movement.id))",
      replaceWith: "const stranded = open",
    },
  },
  {
    retiredPageProse: {
      date: "2026-10-07",
      reason: "Owner requested removal of remaining explanatory captions; the model evidence remains checked.",
    },
    id: "statistics-screen/refused-so-far/an-escalation-is-recorded-unvalidated",
    renderedIn: STATISTICS_SCREEN,
    rendered: "An escalation records an opinion, not a derived",
    claim:
      "`RECORD_ESCALATION` stores the caller's own account — the instant, the units they say they tried, and " +
      "the contact — verifying none of it against the movement's referral history.",
    sourceFile: WARD_RECORD_EVENTS,
    evidence: "escalation: { at: event.now, triedUnitIds: [...event.triedUnitIds], contact: event.contact },",
    falsifiedBy: {
      change:
        "The reducer starts checking the caller's account against the movement's own referral history instead of " +
        "storing it as given.",
      find: "escalation: { at: event.now, triedUnitIds: [...event.triedUnitIds], contact: event.contact },",
      replaceWith:
        "escalation: { at: event.now, triedUnitIds: event.triedUnitIds.filter((unitId) => " +
        "movement.declines.some((decline) => decline.unitId === unitId)), contact: event.contact },",
    },
  },

  // ── statistics-screen.tsx — declines by reason ────────────────────────────────────────────────
  {
    id: "statistics-screen/declines-by-reason/the-vocabulary-is-a-closed-list-in-the-model",
    renderedIn: STATISTICS_SCREEN,
    rendered: 'data-testid="ward-statistics-declines-by-reason-list"',
    claim:
      "The movement-decline reasons are a closed list in the model, and these are its members — so the rendered " +
      "row set can be generated from it rather than written out.",
    sourceFile: WARD_MODEL,
    evidence: DECLINE_REASONS_LIST,
    falsifiedBy: {
      change:
        "A member is added to the movement-decline vocabulary, so the rendered row set no longer matches the list " +
        "it is generated from.",
      find: '"out_of_catchment", ] as const;',
      replaceWith: '"out_of_catchment", "transport_unavailable", ] as const;',
    },
  },
  {
    id: "statistics-screen/declines-by-reason/a-decline-carries-one-reason-and-no-free-text",
    retiredPageProse: {
      date: "2026-09-13",
      reason:
        "Q004 owner-requested removal of implementation commentary. The page retains recorded-reason grouping but no longer describes the decline record fields or lack of free text.",
    },
    renderedIn: STATISTICS_SCREEN,
    rendered: "counted against the reason the ward gave",
    claim: "A movement decline records a unit id, an instant and a reason from that list, and carries no free text.",
    sourceFile: WARD_MODEL,
    evidence: DECLINE_BODY,
    falsifiedBy: DECLINE_GAINS_FREE_TEXT,
  },
  {
    id: "statistics-screen/declines-by-reason/the-referral-side-list-is-a-different-list",
    retiredPageProse: {
      date: "2026-09-13",
      reason:
        "Q004 owner-requested removal of implementation commentary. The page retains front-door referral exclusion but no longer describes the separate reason vocabulary.",
    },
    renderedIn: STATISTICS_SCREEN,
    rendered: "not referrals refused at the front door",
    claim:
      "`REFERRAL_DECLINE_REASONS` is a separate vocabulary with different members, about a destination refusing " +
      "a referral rather than a ward refusing a movement.",
    sourceFile: WARD_MODEL,
    evidence: REFERRAL_DECLINE_REASONS_LIST,
    falsifiedBy: {
      change:
        "A member migrates from the movement vocabulary into the referral one, so the two lists stop having " +
        "different members.",
      // ⚠️ RE-ANCHORED, NOT RE-POINTED TO DODGE A FAILURE. This named the LAST member of the
      // referral list, and the owner added a seventh (`"another_reason"`) on 2026-09-02, so the
      // anchor matched nothing and the guard reported the claim as no longer falsifiable. That is
      // the guard WORKING — it fired before anything shipped. The claim itself, that the two
      // decline vocabularies have different members, is still TRUE with an empty intersection: a
      // moved string, not an invalidated claim, which is why the pin moves rather than the claim
      // being rewritten or dropped.
      find: '"another_reason", ] as const;',
      replaceWith: '"another_reason", "out_of_catchment", ] as const;',
    },
  },
  {
    retiredPageProse: {
      date: "2026-10-07",
      reason: "Owner requested removal of explanatory statistics panels; the model evidence remains checked.",
    },

    id: "statistics-screen/declines-by-reason/the-existing-label-map-belongs-to-the-other-list",
    renderedIn: STATISTICS_SCREEN,
    rendered: "`DECLINE_REASON_LABELS` (`ward-referrals.ts`) is keyed by",
    claim:
      "`DECLINE_REASON_LABELS` is keyed by `ReferralDeclineReason`, so it is not a label table for the " +
      "movement-decline vocabulary and cannot be reused as one.",
    sourceFile: WARD_REFERRALS,
    evidence: "export const DECLINE_REASON_LABELS: Record<ReferralDeclineReason, string> = {",
    falsifiedBy: {
      change:
        "The label map is re-keyed to cover both vocabularies, so it becomes reusable as a label table for movement " +
        "declines after all.",
      find: "export const DECLINE_REASON_LABELS: Record<ReferralDeclineReason, string> = {",
      replaceWith: "export const DECLINE_REASON_LABELS: Record<ReferralDeclineReason | DeclineReason, string> = {",
    },
  },

  // ── statistics-screen.tsx — the two patient figures ───────────────────────────────────────────
  {
    id: "statistics-screen/pull-to-arrival/the-bed-was-given-away-instant",
    renderedIn: STATISTICS_SCREEN,
    rendered: 'data-testid="ward-statistics-pull-to-arrival"',
    claim: "The admission record keeps the instant a ward gave the bed away, and it is nullable.",
    sourceFile: WARD_ADMISSIONS,
    evidence: "pulledAt: Instant | null;",
    falsifiedBy: {
      change:
        "The admission record stops keeping the instant the bed was given away, so there is no pull instant to " +
        "measure from.",
      find: "pulledAt: Instant | null;",
      replaceWith: "",
    },
  },
  {
    retiredPageProse: {
      date: "2026-10-07",
      reason: "Owner requested removal of explanatory statistics panels; the model evidence remains checked.",
    },

    id: "statistics-screen/pull-to-arrival/the-arrival-instant",
    renderedIn: STATISTICS_SCREEN,
    rendered: "Time between the recorded bed pull and arrival instants on an admission.",
    claim: "The admission record keeps the instant the person physically arrived, and it is nullable.",
    sourceFile: WARD_ADMISSIONS,
    evidence: "arrivedAt: Instant | null;",
    falsifiedBy: {
      change:
        "The admission record stops keeping the instant the person arrived, so there is no arrival instant to " +
        "measure to.",
      find: "arrivedAt: Instant | null;",
      replaceWith: "",
    },
  },
  {
    id: "statistics-screen/referral-to-bed/referral-id-is-nullable",
    retiredPageProse: {
      date: "2026-09-13",
      reason:
        "Q004 owner-requested removal of implementation commentary. The page retains referral matching and its limits but no longer describes the nullable identifier type.",
    },
    renderedIn: STATISTICS_SCREEN,
    // Locator moved 2026-09-06. The page now says an admission "carries the referral it came from,
    // or nothing at all" — the nullability stated in words rather than as `string | null`. The
    // evidence and falsifier below still pin the type.
    rendered: "carries the referral it came from, or nothing at all",
    claim: "`Admission.referralId` is typed `string | null`, so a null is an ordinary state.",
    sourceFile: WARD_ADMISSIONS,
    evidence: "referralId: string | null;",
    falsifiedBy: REFERRAL_ID_STOPS_BEING_NULLABLE,
  },
  {
    id: "statistics-screen/referral-to-bed/a-null-referral-id-means-a-movement",
    retiredPageProse: {
      date: "2026-09-13",
      reason:
        "Q004 owner-requested removal of implementation commentary. The page no longer explains a null referral identifier as movement-originated admission.",
    },
    renderedIn: STATISTICS_SCREEN,
    // Locator moved 2026-09-06 with the sentence. The page said "nothing at all is an ordinary
    // state HERE" — a claim about the DATA — while this register evidenced only the TYPE. No
    // admission is in that state: 0 of 267 carry a null. The sentence now says "a null WOULD mean",
    // which is exactly what `referralId: string | null` supports and nothing more.
    rendered: "would mean that admission came from a movement rather than from a referral",
    claim: "A null `referralId` records an admission that came from a movement, which carries no referral.",
    /**
     * ⚠️ **RE-POINTED 2026-09-01 FROM A DOC COMMENT TO THE LINE THAT WRITES THE NULL.** It cited
     * `ward-admissions.ts`'s prose — "an admission created when a patient ARRIVES from an emergency
     * department came from a `Movement`, not from a `Referral`" — which is the claim restated, not
     * evidence for it. Mint a referral id for movement-originated admissions tomorrow and that
     * comment sits exactly where it is; the page goes on telling a reader what a null means when it
     * has come to mean something else. It also slipped past `isEntirelyComment`, because the slice
     * began on the SECOND line of the comment and so never opened with a comment marker — which is
     * the reason that guard is no longer load-bearing.
     *
     * ⚠️ **RE-ANCHORED 2026-09-02 AFTER THE FOLD BROKE IT, AND THE CLAIM SURVIVED — but two other
     * things did not.** The master line's one-to-one nursing work inserted
     * `specialling: movement.specialling` between `unitId` and `referralId`, so the old CONTIGUOUS
     * multi-field citation stopped matching. The reducer still writes `referralId: null` when it
     * builds an admission from a movement, so the sentence on the page is untouched.
     *
     * ⚠️ **The old comment here named the wrong event.** It said `PATIENT_ARRIVED`. The admission is
     * built in **`PULL_PATIENT`** — the only `const admission: Admission = {` in the reducer, and the
     * only place one is built from a movement. (`const departed: Admission` later is a spread of an
     * existing admission, not a build.) **That error was found only because the failure message
     * forbids re-pointing without reading; a silent re-anchor would have preserved it.**
     *
     * ⚠️ **The anchor is now ONE line, and deliberately so.** `referralId: null,` occurs exactly once
     * in the reducer, so it is unambiguous — and unlike a multi-field fragment it cannot be broken by
     * inserting an unrelated field beside it. A contiguous citation spanning several fields is a
     * citation that any neighbouring change can falsify without touching the claim.
     *
     * 🔴 **RE-EVIDENCED 2026-09-17, R4 (`docs/ward-flow/plans/2026-09-16-fix-plan-referral-model.md`).**
     * `PULL_PATIENT` no longer writes `referralId: null,` unconditionally — that was the defect the
     * plan names: `admissionBelongsToTeam` (`community/community-derivations.ts`) reads this exact
     * field, so it was `false` for every runtime admission without exception, and a community
     * team's own referred patient vanished from its team page the instant a ward pulled them a bed.
     * `referralId` is now DERIVED from `resolvedReferral`, the movement's own linked referral, the
     * same "resolve, never merely store" discipline `patientId` beside it already held to. The
     * citation moves to the resolving expression itself, which still means exactly what the claim
     * says: a null records an admission whose movement carries no RESOLVED referral, never one
     * whose movement carries one.
     */
    sourceFile: WARD_PLACEMENT_EVENTS,
    evidence:
      "referralId: resolvedReferral?.id ?? null,\n" +
      "        movementId: movement.id,\n" +
      "        patientId: resolvedReferral?." +
      "patientId ?? movement." +
      "patientId ?? event." +
      "patientId ?? null,",
    falsifiedBy: {
      change:
        "Movement-originated admissions stop writing a null referralId when their movement carries no " +
        "resolved referral, minting an id instead, so a null `referralId` stops meaning 'this admission's " +
        "movement carries no referral'. This is the edit the old doc-comment citation survived untouched.",
      find:
        "referralId: resolvedReferral?.id ?? null,\n" +
        "        movementId: movement.id,\n" +
        "        patientId: resolvedReferral?." +
        "patientId ?? movement." +
        "patientId ?? event." +
        "patientId ?? null,",
      replaceWith:
        "referralId: resolvedReferral?.id ?? `RF-${movement.id}`,\n" +
        "        movementId: movement.id,\n" +
        "        patientId: resolvedReferral?." +
        "patientId ?? movement." +
        "patientId ?? event." +
        "patientId ?? null,",
    },
  },
  {
    retiredPageProse: {
      date: "2026-10-07",
      reason: "Owner requested removal of explanatory statistics panels; the model evidence remains checked.",
    },

    id: "statistics-screen/referral-to-bed/referrals-carry-a-raised-instant",
    renderedIn: STATISTICS_SCREEN,
    rendered: "arrived no earlier than the referral was raised.",
    claim: "Every referral carries the instant it was raised, and it is required.",
    sourceFile: WARD_MODEL,
    evidence: "sendingTeamName?: string; raisedAt: Instant;",
    falsifiedBy: RAISED_AT_STOPS_BEING_REQUIRED,
  },
];
