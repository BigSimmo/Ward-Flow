# Data, seeds and domain rules

Final boundary repairs: protected departures use the approved scoped projection; transfer movements record their own arrival history/closure rather than copying earlier stages. The stage guard uses syntax-tree ancestry and drives the protected transfer. Care clock fields are covered by the re-anchor contract; coding supports a not-applicable receiver and rejects incompatible leave endings. Final offline evidence is in the dated WA audit report.

## WA remediation update — 3 October 2026

`ward-care-journey.ts` owns the closed care vocabulary, strict restore validation, planning/document status, synthetic contacts, appointment-version attribution, separation-code crosswalk, transport checks and recorded community-transition rules. Code 50 is an episode change without a physical discharge. Code 70 requires an explicit ending-from-leave fact. `ward-discharge-records.ts` grants community reads only through an explicitly linked team; no catchment guess grants access. Transfer completion checks receiver eligibility, beds and staffing before a single occupancy transaction.

The detailed map below retains its earlier line numbers and baseline counts; this update supersedes conflicting pathway claims.

## WA pathway audit update — 3 October 2026

`LEAVING_DESTINATIONS` now contains eleven operational choices, including new/usual residential aged-care residence and other health care. Legacy residential care remains distinct; statistical type change is excluded from physical departure. The shared `isLeavingDestination` guard validates commands and storage. `DischargeRecord` projects attributed `followUp` without exposing additional patient fields. The [WA report](../reports/wa-health-pathway-audit-2026-10-03.md) separates these choices from the ten official separation codes.

This part covers Ward Flow's synthetic seed fixtures, the read-only reference-data lookups, and
every root-level `src/components/ward-management/*.ts` domain/selector file that the other parts
of this map do not own (engine, roles, nav, clock, configuration, scenarios, audit and persistence
files are covered by [Engine](engine.md)). Written against tip `ace8e9ee8d`, dated 25 September 2026. Line counts are `wc -l` on each file. Importer counts are `grep -rl` across `src/` and
`tests/` for an import statement naming the file, run from the repo root; each count is files that
import it, not import lines (a file importing both a type and a value from the same module counts
once). Fixture entry counts (patients, units, movements, and similar) are counted by grep over
literal id/object patterns in the file, noted per figure. All patient, referral, movement and
admission data in this document is synthetic and invented for this prototype — never real
patients.

Back to [the code map index](README.md).

## Seeds and fixtures

All figures below are invented for this prototype. Where a file also carries real Western
Australian place or service names, that is called out explicitly — no bed count, wait time or
capacity figure anywhere in this group is real.

- **`src/components/ward-management/ward-sites.ts`** (909 lines, 484 importers) — The hospital
  network: 19 `Site` records (metro and WACHS), 23 inpatient `Unit`s and 10 `EmergencyDepartment`s,
  built from `wardSites`. `NOW_ANCHOR = 642` (10:42, the synthetic "now" every seed's
  `confirmedAt` is authored against) and `DEMONSTRATION_DAY_LABEL = "15 Aug 2026"` live here — the
  one authored place for the demonstration date, per `docs/ward-flow-changeable-data-rule.md`.
  `WARD_LOCKED_BED_SPLITS` is the one place to edit a unit's locked/open bed split; five units
  (`rph-adult-secure`, `scgh-adult-open`, `bty-youth`, `alb-adult-open`, `brm-adult-secure`) carry a
  `referenceUnitId` and were deliberately reshaped to sit ONE OFF their reference-pack published bed
  count (never equal to it — equal would be a claim about a real ward). The file's own header warns
  that `Unit.held` is authored 23 times but read nowhere: every "Held" figure on screen comes from
  `unitCapacity`, which never looks at `held`. Key exports: `wardSites`, `WARD_LOCKED_BED_SPLITS`,
  `allUnits`, `allEmergencyDepartments`, `unitById`, `edById`, `siteByCode`. The single most
  heavily imported file in this group by a wide margin.
- **`src/components/ward-management/ward-movements.ts`** (3,123 lines, 120 importers) — Despite the
  name, this is the hand-authored **seed fixture** for four different arrays, not movement logic:
  30 `wardMovements` (`WF-…`), 9 `bedReleases` (`WR-…`), 2 `leaveBeds` (`WL-…`), 9
  `MIDLAND_DEMONSTRATION_ROWS` (a Midland-specific admission/referral timing demonstration block),
  and 21 `referrals` (`RF-…`) — the seed referrals the reducer's initial state loads, distinct from
  the pure logic in `ward-referrals.ts`. Owner ruling R-2026-09-04-D governs which movements carry
  a `referralId`: 3 movements assert `referralAbsence: "none_raised"`, the rest are either linked to
  a real preceding referral or left `not_recorded`. `tests/ward-movement-referral-link.test.ts`
  enforces the three conditions a seeded link must satisfy. Key exports: `wardMovements`,
  `movementById`, `movementsByStage`, `bedReleases`, `leaveBeds`, `MIDLAND_DEMONSTRATION_ROWS`,
  `referrals`, `SEEDED_TRANSPORT_FORM_REQUIRED`.
- **`src/components/ward-management/ward-admissions-seed.ts`** (920 lines, 32 importers) — The
  people occupying beds: `wardAdmissions = [...occupiedBeds, ...departures, ...waitlist]`, built via
  a `unitOccupants(...)` helper called 24 times (one per occupied unit) generating roughly 258
  occupant tuples, plus 5 hand-built `departed(...)` departure records (`AD-LEFT-01`…`05`) and 3
  waitlist records (`AD-WAIT-01`…`03`) — around 266 admissions total. The load-bearing constraint:
  for every unit, occupants must agree EXACTLY with that unit's `sexMix` in `ward-sites.ts`, checked
  by `tests/ward-admissions-seed.test.ts`. No figure here is a Mental Health Act duration; every
  sex, region, blocker, destination and tentative-diagnosis value is drawn from an existing fixed
  vocabulary (no free text). Key exports: `wardAdmissions`, `WARD_ADMISSIONS_ANCHOR`.
- **`src/components/ward-management/ward-patients-seed.ts`** (777 lines, 12 importers) — 43
  synthetic `Patient` records (`PT-001`…), `wardPatients`. Names are deliberately name-shaped but
  fictional (invented surnames with near-miss pairs like `Halloway`/`Hallowin`, so related-name
  search has something real to find) rather than obviously-fake placeholders, because a screen full
  of "Test Patient Alpha" defeats the near-miss search requirement it exists to demonstrate. Dates
  of birth are fixed, not computed, so age never drifts with the demo clock. Suburb/community-team
  pairings are real, verified pairs taken from `ward-catchment.ts`; house numbers, GP/clinic names,
  legal-status detail and interpreter/Aboriginal-or-Torres-Strait-Islander-status fields are all
  invented. PT-041 is deliberately given `sex: "Male"` / `gender: "Female"` to exercise the trans
  gender-placement ruling; PT-007 and PT-016 deliberately carry no `gender` at all. Key export:
  `wardPatients`.
- **`src/components/ward-management/reference/ward-reference-registry.ts`** (930 lines, 3
  importers) — GENERATED, do not hand-edit. Built by
  `scripts/ward-flow/build-reference-registry.mjs` from
  `docs/ward-flow/reference-data/entities.json` (the WA reference pack, generated
  2026-09-17T16:54+08:00). 98 `ReferenceEntity` rows (`WARD_REFERENCE_ENTITIES`) naming real WA
  facilities, EDs, named wards/units and community services. Deliberately carries **no numeric
  field of any kind** — every pack row is `operational_use_approved: false`, so no bed count or
  capacity figure can leak into Ward Flow's own invented figures through this file, by
  construction rather than by convention. Key exports: `WARD_REFERENCE_ENTITIES`,
  `referenceEntity`, `referenceEntitiesOfKind`. `npm run check:ward-reference` fails on drift
  against the pack.
- **`src/components/ward-management/reference/ward-reference-distances.ts`** (519 lines, 2
  importers) — GENERATED, do not hand-edit. Built by
  `scripts/ward-flow/build-reference-distances.mjs` from
  `docs/ward-flow/reference-data/distances.json`. 468 directed metropolitan site/ED pairs with
  indicative road distance and time, measured via public OSRM/OpenStreetMap routing — no traffic,
  no peak, no ambulance behaviour. Metropolitan only: cannot fill `ward-travel-bands.ts`'s regional
  bands. Key exports: `referenceDistance`, `REFERENCE_DISTANCE_CAVEAT`,
  `REFERENCE_DISTANCE_PAIR_COUNT`.
- **`src/components/ward-management/reference/ward-reference-teams.ts`** (398 lines, 4 importers)
  — GENERATED, do not hand-edit. Built by `scripts/ward-flow/build-reference-teams.mjs` from
  `docs/ward-flow/reference-data/entities.json`. Published contact detail (phone, hours, email,
  address) for real WA community mental-health services, matched by **exact name only** (never
  suburb/postcode/proximity — a wrong-clinic phone number is worse than none). Every record is
  `operationally_ratified: false`; the pack itself warns the 2023 PDF-footer contacts may be
  obsolete. Carries no numeric capacity field, the same guarantee as the registry. Key exports:
  `referenceTeamDetail`, `REFERENCE_TEAM_NAMES`, `REFERENCE_TEAM_CAVEAT`.

**Generator inputs named by the files above, under `docs/ward-flow/reference-data/`:**

- `entities.json` (5,789 lines) — the WA reference pack's facility/ED/ward/unit/community-service
  register; feeds `ward-reference-registry.ts` and `ward-reference-teams.ts`.
- `distances.json` (7,919 lines) — the OSRM-derived directed metropolitan distance/time pairs;
  feeds `ward-reference-distances.ts`.

## Placement and eligibility

- **`src/components/ward-management/ward-eligibility.ts`** (833 lines, 43 importers) — The gate
  logic deciding whether a movement or referral may go to a given unit. `ELIGIBILITY_GATES` is the
  single source of every gate name either eligibility function can emit. Key exports: `eligibility`
  (movement path), `referralEligibility` (referral path — kept in sync with `eligibility` after a
  2026-09-02 fix that added a missing `sex_designation` gate found only on the movement path),
  `genderEligibility`, `sexDesignationAccepts`, `requiresAuthorisedDestination`,
  `candidateReason`, `wardFacingGateDetail`, `wardAddressings`/`wardAddressing`. Both eligibility
  functions clamp and report through the same `EligibilityVerdict`/`GateResult` shape so a
  candidate list can never silently diverge between the two entry paths again.
- **`src/components/ward-management/ward-bed-designation.ts`** (77 lines, 27 importers) — All
  locked/open bed arithmetic in one place, replacing the old `Unit.security` flag that eight files
  used to subtract by hand. Every function clamps at zero. Key exports: `openBeds`,
  `lockedBedsFree`, `openBedsFree`, `unitHasLockedBeds`, `unitHasOpenBeds`, `designationSummary`,
  `wardCategory` ("Open" | "Locked" | "Mixed").
- **`src/components/ward-management/ward-bed-availability.ts`** (220 lines, 41 importers) — Every
  figure the capacity board shows (Phase 5, specs D5/D6), derived once so no screen computes its
  own version. Two binding rules: nothing expected/confirmed-but-unreleased/on-leave is ever added
  into `availableNow`, and nothing is ever subtracted from it for a preparation note (a bed being
  cleaned is still offered). Key exports: `capacityBreakdown`, `releaseBand`, `openBedsNow`,
  `bedsPendingPreparation`, `RELEASE_BANDS`, `EVENING_SHIFT_END_MINUTES`.
- **`src/components/ward-management/ward-place.ts`** (113 lines, 5 importers) — Resolves a route
  pathname to the ward/ED/community-team it is "about", or `undefined` (the common case — 7 of 10
  approved prototypes have no single place-subject). Takes `units` as a parameter rather than
  reading the frozen `unitById` fixture, so it stays correct under an active scenario's renamed
  units. Key exports: `wardPlaceFor`, `wardPlaceIdFor`, `WardPlace`.
- **`src/components/ward-management/ward-patient-resolver.ts`** (81 lines, 14 importers) —
  Resolves a patient and display information (name, UMRN, initials, sex/gender) from any clinical
  subject — a `Movement`, `Referral`, `Admission`, or a raw id — against live state, in one place
  rather than each screen re-deriving it. Key exports: `resolveSubjectPatient`, `movementUmrn` and
  `withUmrnInPlaceOfMovementIds` (D-39: a patient is shown by UMRN, never by the `WF-...` journey
  id, which stays internal). `ward-patient-name.ts` wraps these as the `usePatientOf` and
  `useUmrnText` hooks.

## Referrals and catchment

- **`src/components/ward-management/ward-referrals.ts`** (1,460 lines, 70 importers) — The largest
  pure-logic file in this group: referral state, candidate matching, clocks, wait labels, decline
  reasons and out-of-area reporting for a `Referral`. Around 50 exported functions/consts,
  including `referralState`, `referralCandidates`, `referralQueueOrder`, `recentlyDecidedReferrals`,
  `referralClocks`, `hasConfirmedCapacity`, `noBedBreakdown`, `matchReason`,
  `DECLINE_REASON_LABELS`, `COMMUNITY_DECLINE_REASON_LABELS`, `groupCandidatesByTravelBand`,
  `outOfAreaLedger`, `canReassessReferral`, `isBedHoldExpired`, `BED_HOLD_EXPIRY_MINUTES`. Holds no
  seed data of its own — the referral fixtures it operates on live in `ward-movements.ts`.
- **`src/components/ward-management/ward-referral-visibility.ts`** (1,076 lines, 6 importers) —
  Scopes a `Referral` to what each role may see: `wardScopedReferral(s)`,
  `communityScopedReferral(s)`, `edScopedReferral(s)`, `coordinatorScopedReferral(s)`,
  `coordinatorWorksReferral`, `coordinatorWorklistReferrals`, plus the
  `WardScopedReferral`/`CommunityScopedReferral`/`EdScopedReferral`/`CoordinatorScopedReferral`
  shape types and `ReferralDirection` ("arriving" | "leaving").
- **`src/components/ward-management/ward-catchment.ts`** (1,291 lines, 13 importers) — The suburb
  → community mental-health team lookup, sourced from `docs/ward-flow-catchment-data.md` (the
  owner's five catchment documents) and the referral-destination spec. Keyed on suburb only (not
  postcode — missing for ~42 suburbs). `S2015_STATED_ROW_COUNT = 537` records the 2015 source
  document's own stated row count (a fact about the source, not a live count). Variant suburb names
  resolve through a recorded `SUBURB_ALIASES` table, never fuzzy matching; `contested` suburbs must
  never auto-route (`catchmentCanRouteAutomatically`). Key exports: `lookupCatchment`,
  `resolveSuburbAlias`, `normaliseSuburbKey`, `CATCHMENT_DOCUMENTS`, `S2015_CATCHMENT_ROWS`,
  `SUBURB_ALIASES`, `CONTESTED_SUBURBS`, `INTERNALLY_INCONSISTENT_SUBURBS`,
  `catchmentRoutingDestinations`.
- **`src/components/ward-management/ward-service-scope.ts`** (288 lines, 16 importers) — The one
  join deciding "does this movement/referral belong to health service S", shared by every service
  chooser (previously duplicated inside the handover page). Three rules only: a unit/ED belongs to
  its site's service; a movement belongs to each service among its origin ED, accepted ward and
  every referred-to ward; a referral belongs to each service among its origin site, accepted wards
  and ED destinations. Never uses `homeRegion` (owner ruling Q-2). Key exports:
  `movementBelongsToService`, `referralBelongsToService`, `unitHealthService`, `edHealthService`,
  `urgentMovementsOutsideService`, `SERVICE_SCOPED_SCREENS`.
- **`src/components/ward-management/ward-travel-bands.ts`** (98 lines, 6 importers) — The four
  invented travel bands (`under_an_hour` … `air_transport_only`) and the synthetic home-region →
  site band table, `SYNTHETIC_TRAVEL_BANDS`. `TRAVEL_BANDS_ARE_INVENTED = true` is an exported
  flag, not just a comment. A band is a fact about a pair (region, site) and is never stored on any
  record — only ever looked up. Key exports: `TRAVEL_BANDS`, `SYNTHETIC_TRAVEL_BANDS`,
  `TRAVEL_BANDS_ARE_INVENTED`.
- **`src/components/ward-management/ward-distance.ts`** (83 lines, 11 importers) — The single entry
  point for "how far is this bed from where this person lives", built on top of
  `ward-travel-bands.ts` (re-exports `TRAVEL_BANDS`/`TravelBand`). Never writes a band onto a
  record. Key exports: `travelBand`, `unitTravelBand`, `TRAVEL_BAND_LABELS`,
  `OUT_OF_AREA_BANDS`, `SYNTHETIC_TRAVEL_TIMES_NOTICE`.

## Legal (Mental Health Act forms and clocks)

- **`src/components/ward-management/ward-legal-clock.ts`** (286 lines, 8 importers) — Every Mental
  Health Act 2014 form clock: durations, expiry computation from an entered start (written /
  received / made / continuation), reminder offsets, and country-region extensions (which are
  recorded acts via `RECORD_COUNTRY_EXTENSION`, never automatic). Key exports: `computeLegalClock`,
  `maximumDurationMinutes`, `extendLegalClockForCountry`, `reminderInstants`, `isArrivalLate`,
  `leaveBedNeedsOpenWarning`, `LEGAL_CLOCK_FORM_CODES`, `HANDOVER_COMPLETION_WINDOWS`,
  `EXPECT_FLAG_VOLUNTARY_MINUTES` (48h), `EXPECT_FLAG_INVOLUNTARY_MINUTES` (7 days). No section
  numbers or computed legal thresholds appear in any UI string sourced from elsewhere — this file
  is the one place a duration is allowed to exist.
- **`src/components/ward-management/ward-legal-forms.ts`** (73 lines, 30 importers) — The picker
  list of selectable legal forms and how a form names itself on screen. Deliberately its own module
  rather than part of `ward-model.ts`, so a guard (`tests/ward-flow-single-source.test.ts`) can
  keep legal-form literals quarantined from `ED_ACCESS_TARGET_MINUTES` (a performance target once
  mistaken for a legal deadline). The clinician chooses the form; nothing derives one from
  `legalStatus` any more (owner correction, 2026-08-24). Key exports: `SELECTABLE_LEGAL_FORMS`,
  `legalFormName`, `legalFormNameLabelFirst`.

## Capacity, beds and discharge

- **`src/components/ward-management/ward-board-derivations.ts`** (435 lines, 3 importers) — The
  headline figures at the top of one ward's board: accepting-bed counts, since-yesterday deltas,
  7-day arrow targets (`ARROW_HORIZON_DAYS`), and derived sex mix. Key exports:
  `headlineAvailable`, `acceptingBedCounts`, `constraintSentence`, `sinceYesterday`,
  `arrowTargets`, `derivedSexMix`.
- **`src/components/ward-management/ward-board-time-features.ts`** (89 lines, 6 importers) — Board
  time labels built only from times a record already holds (pull-hold expiry, transport ETA, the
  handover open-work list against the 15:00 day-shift end). Invents no Mental Health Act limit or
  curfew. Key exports: `pullHoldRemainingLabel`, `transportEtaRemainingLabel`,
  `openWorkBeforeShiftEnd`, `openWorkBeforeShiftEndLabel`, `DAY_SHIFT_END_MINUTE` (15:00).
- **`src/components/ward-management/ward-discharge-dates.ts`** (255 lines, 6 importers) — Derives
  forward-looking `BedRelease[]` from each admission's single `expectedDischargeAt`. Pure; does no
  bed-count arithmetic itself (that stays in `ward-bed-availability.ts`, which buckets this
  output). Key exports: `derivedBedReleases`, `statewideReleaseCount`, `blockedReleaseCount`,
  `dischargeDateAccuracy`.
- **`src/components/ward-management/ward-discharge-records.ts`** (170 lines, 10 importers) —
  Access-controlled read of discharge records: who (`WardRecordActor`) may read which
  `DischargeRecord`/`DischargeIdentity`, and safe lookups that fail closed (`RecordRead<T>` is
  `{status: "allowed"}` or `{status: "denied"}`, never a thrown error). Key exports:
  `dischargeIdentity`, `selectDischargeRecord`, `selectDischargeRecords`,
  `readOpenedDischargeRecord`, `uniqueRecord`, `validRecordActor`.
- **`src/components/ward-management/ward-contention.ts`** (287 lines, 1 importer — its own test
  only) — Reports, but does not resolve, when more than one live claim (referral, acceptance, or
  parallel referral) is counting on the same unit's bed. Its own doc comment states this is
  deliberately unwired: "No existing caller is wired up here" pending an owner decision on how
  contention should be resolved (`docs/ward-flow/brief-contention-model-2026-09-04.md`). See
  [Pitfalls](#pitfalls-in-this-area). Key exports: `contention`, `contentionPairs`.
- **`src/components/ward-management/ward-pressure.ts`** (65 lines, 7 importers) — Ranks EDs by
  pressure: a passed legal deadline outranks a long wait, which outranks volume. `movements` is a
  required parameter — an earlier version defaulted it to the seed array, silently hiding a caller
  that forgot to pass live state; the default was removed. Key export: `edPressure`.
- **`src/components/ward-management/ward-morning-rollup.ts`** (306 lines, 10 importers) — Rolls
  per-unit `capacityBreakdown` figures up to site and service level for the coordinator's morning
  page. Computes only sums of existing figures plus a freshness derivation — no new bed arithmetic.
  Key exports: `serviceRollup`, `morningHandoverInstant`, `peopleWaitingCount`,
  `wardsConfirmedLabel`, `MORNING_HANDOVER_MINUTES` (08:00), `CAPACITY_FIGURE_LABELS`.
- **`src/components/ward-management/ward-statistics.ts`** (347 lines, 12 importers) — Six pure
  ward/system-level flow figures (never about a person, never a ranking or target).
  `null` means "nothing to average" and must never be reported as `0` (a ward with no discharges
  has no average length of stay). Key exports: `wardStatistics`, `allWardStatistics`,
  `DischargeDateOutcomes`, `WardStatistics`.

## Selectors and derivations

- **`src/components/ward-management/ward-derivations.ts`** (2,034 lines, 178 importers) — The
  central shared-selector module for the three main Ward Flow view files (console, modes,
  network); has no React dependency and carries no `"use client"` directive. Every exported
  function, one phrase each:
  - `stageSummaries` — counts movements per lifecycle stage.
  - `queueStageSummaries` — stage counts scoped to the queue view.
  - `movementHealthService` — which health service a movement belongs to.
  - `elapsedLabel` — human "time in this stage" label for a movement.
  - `isOpen` — whether a movement is still active (not resolved or cancelled).
  - `examinationRevokedWhileBedHeld` — flags a revoked examination while its bed is still held.
  - `destinationNoLongerLawful` — finds a destination unit that no longer passes eligibility.
  - `referralBlockedReason` — why a movement's referral progress is currently blocked.
  - `destinationUnit` — resolves the unit a movement is accepted into or targeting.
  - `referralForMovement` — the seeded referral that originated a movement, if any.
  - `movementReferralLink` — classifies why a movement has, or lacks, a linked referral.
  - `orphanedTransport` — detects a transport job whose movement no longer needs it.
  - `transportNeedState` — whether transport is needed, not needed, or unrecorded.
  - `unitSiteCode` — the site code a unit belongs to.
  - `transportStatusLabel` — display label for a transport job's current state.
  - `transportLeg` — which leg (Requested/Accepted/En route/Collected/Arrived/Cancelled) a
    transport job is on.
  - `unitCapacity` — the capacity figures shown for one unit, folding in bed releases.
  - `edMedicalTripBedRetention` — decides whether a bed is retained during an ED medical trip.
  - `isMoreRestrictiveThanRequired` — flags a locked-ward placement for a voluntary-status person.
  - `restrictionNotice` — the notice text for an over-restrictive or voluntary-on-locked placement.
  - `eligibilityWarning` — the warning shown for a candidate unit that fails an eligibility gate.
  - `needsNoRecordedReason` — whether a shortlist availability state needs an explicit reason.
  - `isCatchmentUnit` — whether a unit sits in the movement's home catchment.
  - `shortlistCandidates` — the ranked candidate-unit shortlist for a movement.
  - `blockingGate` — the first failing gate in an eligibility verdict.
  - `eligibleCandidatesAmong` — the top N eligible candidate units for a movement.
  - `buildActionInbox` — builds the coordinator's prioritised action inbox.
  - `allOverrides` — every recorded override across a movement list.
  - `overridesAgainstUnit` — overrides recorded against one specific unit.
  - `allDeclines` — every recorded decline across a movement list.
  - `handoverSnapshot` — the shift-handover summary for a set of movements.
  - `escalationBoard` — patients with nowhere currently eligible to go.
  - `searchMovements` — filters movements by a free-text/structured search query.
  - `searchPatients` — searches movements and referrals by patient-identifying terms.
  - `movementTimeline` — the ordered event timeline for one movement.
  - `changeAudit` — the audit trail of changes across a movement list.
  - `effectivenessNumbers` — aggregate effectiveness/outcome sample counts.
  - `isArrivalLate`, `medicalClearanceWarning`, `leaveBedNeedsOpenWarning`, `expectFlagKindFor`,
    `legalMismatchKind`, `unitBedOfferBlocked` — thin re-exported/local warning helpers built on
    `ward-legal-clock.ts` and `ward-eligibility.ts` (arrival lateness, medical-clearance and
    leave-bed warnings, the 48h/7-day expect flag, person/ward legal mismatch, and single-room/
    closed-bay offer blocking).
  - `candidateReason` — re-exported from `ward-eligibility.ts`, not defined here.
  - `stageCopy` — re-exported from `ward-stage-copy.ts` (see that file's own entry for why).
  - `WAITLIST_INSTEAD_OF_DECLINE_REASONS`, `GENDER_MISMATCH_DECLINE_REASON` — re-exported from
    `ward-legal-clock.ts`.

  Also exports `wardServiceOrder`, `roleLabels`, `roleTaskLabel`, `bedReleaseStateLabels`,
  `BED_RELEASE_BLOCKED_LABEL`, `BED_RELEASE_BLOCKED_FIGURE_LABEL`, `INFORMATIONAL_GATES`, and
  several result/shape types (`InboxItem`, `HandoverSnapshot`, `EscalationBoard`,
  `ShortlistCandidate`, `ContentionMap`-adjacent types, `ChangeAuditEntry`,
  `EffectivenessMeasure`).

- **`src/components/ward-management/ward-admissions.ts`** (859 lines, 85 importers) — The
  `Admission` record type (a person inside a bed) and its pure derivations: stay bands, discharge
  barriers, pull-release reasons, remaining specialling/high-acuity capacity, days-in-bed. Not seed
  data — `ward-admissions-seed.ts` is the fixture that uses this file's types and constants. Key
  exports: `Admission`, `ADMISSION_STATES`, `STAY_BANDS`, `LEAVING_DESTINATIONS`,
  `DISCHARGE_BARRIERS`, `PULL_RELEASE_REASONS`, `admissionsForUnit`, `stayBand`, `daysInBed`,
  `remainingSpeciallingCapacity`, `remainingHighAcuityCapacity`, `bedIsOccupied`,
  `isPastExpectedDischarge`.
- **`src/components/ward-management/ward-patients.ts`** (577 lines, 48 importers) — The `Patient`
  record type — a person distinct from any particular admission or referral, born the moment
  somebody is added via "search, and if nobody comes up, add them". Key exports: `Patient`,
  `PatientId`, `GENDERS`, `findPatients`, `nearPatients` (near-miss name search),
  `duplicateCandidates`, `patientDisplayName`, `patientAgeYears`, `patientCohort`,
  `matchDateOfBirth`.
- **`src/components/ward-management/ward-priority.ts`** (273 lines, 21 importers) — The movement
  operational-priority score and queue order. `FORM_TIMING_FACTOR_LABEL` is exported so
  `priority-queue.tsx` matches the legal-form-due-time factor by constant rather than by a second
  copy of the label string. Key exports: `operationalScore`, `queueOrder`, `urgencyTierLabel`,
  `isFlaggedUrgent`, `ScoreFactor`.
- **`src/components/ward-management/ward-diagnosis.ts`** (99 lines, 12 importers) — The tentative
  ICD-10-AM Chapter V diagnosis-block vocabulary (11 blocks or none), added after the owner's
  2026-08-29 reversal of the previous no-diagnosis rule. Deliberately holds no knowledge of what
  carries a diagnosis. Key exports: `TENTATIVE_DIAGNOSIS_BLOCKS`, `isTentativeDiagnosisBlock`,
  `tentativeDiagnosisPhrase`.
- **`src/components/ward-management/ward-change-reasons.ts`** (713 lines, 102 importers) — Every
  fixed, chosen-never-typed reason vocabulary used across Ward Flow's change/decline/override
  flows: urgency-change reasons, legal-status-change reasons, transport cancel/stop reasons, bed
  release blockers (`BED_RELEASE_BLOCKERS`), withdrawal reasons, gender-placement reasons and
  refusal strings, discharge-delay reasons and metadata, ward-intake constraints. Deliberately
  content-free — no reason describes a patient, a diagnosis or a clinical judgement. Widest single
  set of runtime-array vocabularies in this group; second most-imported file after `ward-sites.ts`
  and `ward-derivations.ts`.

## Display helpers

- **`src/components/ward-management/ward-absence-labels.ts`** (74 lines, 17 importers) — One
  shared phrase for an id this application cannot resolve to a name (an origin ED, ward or site),
  so every screen states absence the same way while keeping its own sentence grammar. Its own
  header records that this consistency claim was false on first write (Delays and the Officer
  screen each carried their own inline copy) until a 2026-09-11 ruling fixed it — a caution about
  trusting a module's doc comment over a grep. Key exports: `departmentLabel`, `wardLabel`,
  `siteLabel`.
- **`src/components/ward-management/ward-stage-copy.ts`** (33 lines, 2 importers) — The coordinator
  -facing label and short label for each `MovementStage`. Deliberately its own tiny module rather
  than living in `ward-derivations.ts`, purely so the reducer (`ward-flow-reducer.ts`) can use it
  for refusal messages without an import cycle or dragging `lucide-react` into the reducer (owner
  ruling O-16.8). `ward-derivations.ts` re-exports it, so most callers reach it indirectly. Key
  export: `stageCopy`.
- **`src/components/ward-management/ward-chrome-role.ts`** (113 lines, 11 importers) — Derives
  which role's chrome a route gets from the pathname alone — Ward Flow has no signed-in identity,
  so "the role IS the route". A chrome hint only, never a permission (permissions stay in the
  reducer's `EVENT_ROLE` table). Key exports: `wardChromeRole`, `noticeIsForWardChrome`,
  `noticeIsMarkableByChrome`, `wardTasksAreActionableForRole`, `canSeeReadmissionFlag` (the 28 day
  readmission flag is the coordinator's only, Josh, 9 Oct 2026), `CHROME_ROLE_LABELS`.
- **`src/components/ward-management/ward-service-colors.ts`** (326 lines, 2 importers — one
  production, one test) — A full WA Health Services colour key (EMHS green `#00825E`, NMHS red
  `#990057`, SMHS purple `#5A2476`, WACHS/CAHS blue, statewide, private), sourced from the real
  DOHWA corporate-identity stylesheets, with WCAG AA/AAA text-ink pairings and badge/dot style
  helpers. Only used by `ward-catchment-resolver.tsx` in production. Key exports:
  `WA_HEALTH_SERVICES_COLOR_KEY`, `getHealthServiceColorDefinition`, `getHealthServiceBadgeStyle`,
  `getHealthServiceDotStyle`.
- **`src/components/ward-management/ward-modal-focus.ts`** (51 lines, 2 importers) — `"use client"`
  hook wiring Ward dialog open/close lifecycle into the shared overlay-stack focus-restore
  machinery (`sheet-focus`). Key export: `useWardModalFocus`.
- **`src/components/ward-management/use-printable-disclosures.ts`** (49 lines, 12 importers) —
  `"use client"` hook that expands every `<details class="source-print">` disclosure before print
  and restores each one's exact prior open/closed state afterwards. Key export:
  `usePrintableDisclosures`.

## Unused or superseded

- **`src/components/ward-management/ward-teams.ts`** (51 lines, 3 importers, all tests) —
  **Superseded and deliberately unread by every production screen.** Exports `COMMUNITY_TEAMS`, a
  region-keyed table of ten `"<Region> Community Mental Health Team (placeholder)"` synthetic
  names, built before `ward-catchment.ts`'s suburb-level catchment lookup existed. Four production
  files (`community-derivations.ts`, `community-index.tsx`, `community-screen.tsx`,
  `hub-derivations.ts`) carry comments explicitly explaining why they do NOT read it, and
  `tests/ward-community-team-single-source.test.ts` guards that no new file starts importing it —
  its own test file, "RIVAL", asserts the guard would catch a reintroduction. Keep this file for
  its own tests and as the historical/placeholder table; do not treat it as live data, and do not
  delete it without checking `docs/agents/dead-code-deletion.md` and the owner (its removal is a
  protected-work question, not an obvious cleanup).
- **`src/components/ward-management/ward-contention.ts`** (287 lines, 1 importer — its own test
  only) — Built, tested, and explicitly **not wired into any screen or the reducer**, by design.
  Its header states the function reports contention (two live claims resting on the same bed) but
  never ranks, resolves or decides who wins one, because that decision has not been made by the
  product owner (`docs/ward-flow/brief-contention-model-2026-09-04.md`). Read before either wiring
  it up or deleting it — it is neither dead code nor a shipped feature, it is a deliberately
  unreached primitive.

## Pitfalls in this area

1. **Two things named "referrals".** `ward-movements.ts` exports a seed array `referrals` (21
   records, `RF-0xx`); `ward-referrals.ts` is pure logic over `Referral` objects and holds no seed
   data of its own. Reading the wrong one for "where do I add a referral fixture" or "where is
   `referralState`" is an easy mix-up — `ward-movements.ts`, `ward-referrals.ts`.
2. **Two things named "teams".** `ward-teams.ts` is a retired region-keyed placeholder table that
   production code deliberately does not read; `reference/ward-reference-teams.ts` is the real,
   generated, published-contact-detail lookup, keyed by exact team name. Importing the wrong one
   silently reintroduces the pattern `ward-community-team-single-source.test.ts` exists to block —
   `ward-teams.ts`, `reference/ward-reference-teams.ts`.
3. **`held` on a `Unit` is authored but never read.** Every seeded `held` value in `ward-sites.ts`
   is inert; changing it changes nothing on any screen, and produces no symptom to notice by —
   `ward-sites.ts` (see its own header warning), `ward-derivations.ts`'s `unitCapacity`.
4. **Five bed counts are deliberately one off their published reference figure, not equal to it.**
   Treating any of the five `referenceUnitId`-carrying units' bed counts as accurate, or "fixing"
   them to match the reference pack exactly, reverses a deliberate design decision — `ward-sites.ts`
   (`WARD_LOCKED_BED_SPLITS` doc comment).
5. **The reference pack (`entities.json`, `distances.json`, `catchment_assertions.json` and
   friends) is not one thing consumed uniformly.** Only `entities.json` and `distances.json` feed
   generated `src/` files; the pack's much larger `catchment_assertions.json` and
   `capacity_assertions.json` are not wired into any of the three `reference/*.ts` files this part
   covers — do not assume every pack file has a generated counterpart.
6. **`ward-service-colors.ts` holds real hex brand colours as plain string values**, not Tailwind
   utility classes, so `eslint-rules/no-hardcoded-hex.mjs` (which only matches
   `bg-[#…]`/`text-[#…]`/`border-[#…]` literals) does not and cannot flag them. Do not assume the
   design-token guard covers every hex string in the codebase.
7. **`ward-contention.ts` compiles, is tested, and does nothing at runtime.** A future editor who
   finds it via search may assume it is either dead code to delete or a live feature to extend;
   it is neither — it is an additive primitive awaiting an owner decision, per its own header.
8. **`referralEligibility` and `eligibility` are two separate gate implementations that must be
   kept in sync by hand.** A 2026-09-02 fix found a `sex_designation` gate present on one path and
   missing on the other for months, with no failing test — `ward-eligibility.ts`.
9. **`ward-derivations.ts` re-exports symbols it does not define** (`candidateReason` from
   `ward-eligibility.ts`, `stageCopy` from `ward-stage-copy.ts`, two constants from
   `ward-legal-clock.ts`). Grepping only this file's own function bodies for one of those names
   will not find its definition.
10. **`ward-pressure.ts`'s `movements` parameter has no default on purpose.** An earlier version
    defaulted it to the seed array; a caller that forgot to pass live state got seed data instead of
    a loud failure. Do not reintroduce a default here.

## Not checked

Runtime behaviour was not exercised — no dev server, test run, or build was run for this part
(read-only mapping task). Fixture entry counts (units, admissions, patients, movements) were
measured by grep pattern-matching over literal id/tuple shapes in each file, not by evaluating the
TypeScript; a count could be off by a handful where a helper function generates entries in a shape
grep does not cleanly match (flagged inline above where this applies, e.g. the ~258/~266 admission
counts). Whether every exported symbol in `ward-derivations.ts` is still reachable from a live
screen was not verified beyond the importer-count grep — some entries there may only be reached
through `ward-flow-reducer.ts` or tests. The full contents of `docs/ward-flow/reference-data/`'s
larger JSON packs (`catchment_assertions.json`, `capacity_assertions.json`, `sources.json`,
`open_questions.json`) were not read; only the two files the in-scope generated `.ts` files
actually cite were opened.
