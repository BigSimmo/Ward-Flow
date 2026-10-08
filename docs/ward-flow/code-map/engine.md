# Engine: reducer, events, state and persistence

## Shared coordinator implementation — 7 October 2026

The opt-in shared provider connects `ward-shared-access.tsx` (Microsoft sign-in and access gate)
through `ward-shared-client.ts` (polling, pending commands, conflict and retry state). Shared mode
adopts committed server snapshots without reading/writing demo browser storage; only local view
drafts remain browser-owned. `ward-shared-state-validation.ts` adds an explicit shared repatriation
schema without changing the browser persistence fence. Existing reducer workflow roles describe
the action's operational perspective; the authenticated shared role is coordinator.

`backend/ward-flow/engine.ts` bundles the domain engine for the Azure Function. `postgres.mjs`
executes versioned shared commands, receipts and audit in one transaction. The new migration runner,
Entra managed-identity grants, Azure resource discovery and private PostgreSQL template are described
in [the shared setup guide](../../../backend/ward-flow/SETUP-SHARED-AZURE.md). Shared mode defaults off.
Source and local tests do not establish hosted identity, database or deployment readiness.

Final boundary repairs: protected departures use the approved scoped projection; transfer movements record their own arrival history/closure rather than copying earlier stages. The stage guard uses syntax-tree ancestry and drives the protected transfer. Care clock fields are covered by the re-anchor contract; coding supports a not-applicable receiver and rejects incompatible leave endings. Final offline evidence is in the dated WA audit report.

## WA remediation update — 3 October 2026

The current event union has **98** types. `RECORD_ADMISSION_CARE` uses identity, generation, revision and explicit ward/community scope checks; its closed changes cover planning, documents, appointments, current-appointment contacts, coding, episode type, transport, transfers and recorded legal paperwork. Transfer arrival changes sending and receiving occupancy atomically. The provider now dispatches protected patient-linked departures. Movement workflow controls expose the nine formerly unexposed operational/legal commands. Ward requests use closed synthetic messages. Audit, history, restore validation and persistence classification include the care command.

The detailed map below retains its earlier line numbers and baseline counts; this update supersedes conflicting pathway claims.

## WA pathway audit update — 3 October 2026

`RECORD_ADMISSION_FOLLOW_UP` records a fixed arrangement state for a uniquely linked occupied/departed admission. It uses the protected role/scope/identity/generation/revision boundary, advances the discharge revision, appends typed before/requested/after audit facts and is classified as a text-safe event. Deaths and unoccupied stays are excluded. Both departure commands validate the shared destination vocabulary and arrival time, and resolve the current admission's movement before considering an unlinked open fallback. Stored admissions now validate destination membership. See the [WA comparison and pathway report](../reports/wa-health-pathway-audit-2026-10-03.md).

Read-only map, written 25 September 2026 against tip `ace8e9ee8d` on branch
`ward/extend-ward-flow-code-map` (`D:/Worktrees/Database/ward-code-map`). Covers the thirteen
engine files under `src/components/ward-management/`: `ward-flow-reducer.ts`,
`ward-flow-events.ts`, `ward-model.ts`, `ward-flow-provider.tsx`,
`ward-flow-storage-validation.ts`, `ward-flow-persistence-classification.ts`, `ward-audit.ts`,
`ward-reanchor.ts`, `ward-clock.ts`, `ward-configuration.ts`, `ward-scenarios.ts`,
`ward-rulings-demo.ts`, `ward-flow-roles.ts`. Line counts are `wc -l`. Every reducer case line
number below was read directly from `ward-flow-reducer.ts` (not inferred), grouped across four
read-only extraction passes (Sonnet, extraction) whose output this document assembles and whose
line numbers this document's own author re-checked against the file's `case "TYPE":` labels by
`grep`. The event-type count (97) and the `EVENT_ROLE` table were read from
`ward-flow-events.ts` directly, not carried over from the overview map. Nothing was run except
reads and `grep`/`wc`/`awk`. Back to [the code map index](README.md).

---

## 1. Files

- **`ward-flow-reducer.ts`** (8,741 lines) — the whole engine's write path: `WardFlowState`,
  `wardFlowReducer(state, event)`, `seedWardFlowState`/`seedWardFlowStateAt`, and every event's
  guard-and-effect case. See §1a for its internal structure and §2 for the full event catalogue.
- **`ward-flow-events.ts`** (2,452 lines) — declares the `WardFlowEvent` discriminated union (97
  variants, each carrying `type`, `role`, `now` plus its own fields) and `EVENT_ROLE`, the
  `Record<WardFlowEvent["type"], readonly WardFlowRole[]>` table the reducer's role check reads
  first. Also declares `ReferralDraft` (the intake form's shape) and re-exports `WardFlowRole`/
  `WARD_FLOW_ROLE_LABELS` from `ward-flow-roles.ts`. Heavily commented — most of the file is
  provenance for individual fields and role decisions, not code.
- **`ward-model.ts`** (3,040 lines) — every domain entity type and closed vocabulary: `Movement`,
  `Referral`, `Unit`, `Site`, `Decline`, `Override`, `GenderPlacement`, `TransportJob`,
  `MovementClosure`, `BedRelease`, `LeaveBed`, `ReferralDestination`/`ReferralAddressing`,
  `Notice`, `LegalForm`, plus dozens of `const` closed-list arrays (`DECLINE_REASONS`,
  `MOVEMENT_STAGES`, `TRANSPORT_PROVIDERS`, …) and their derived union types. See §4.
- **`ward-flow-provider.tsx`** (804 lines) — the React context: wraps `wardFlowReducer` in
  `useReducer`, derives `now` from a synthetic clock, restores/saves `sessionStorage`, and
  exposes `useWardFlow()`/`useWardFlowClock()`. Two components: `WardFlowProvider` (defers
  reading the wall clock until after mount, to avoid an SSR/hydration mismatch) and the inner
  `WardFlowWorld` (owns the actual `useReducer`, the 30-second tick, and the persistence effect).
  See §5.
- **`ward-flow-storage-validation.ts`** (495 lines) — `isValidStoredWardFlowState`, a hand-written
  structural validator for a `WardFlowState` read back from `sessionStorage`: checks every array's
  shape, every id reference resolves, every enum field is a member of its closed list, and every
  monotonic sequence is consistent with the ids present. Returns `false` (never repairs) on the
  first violation. Imported only by `ward-flow-provider.tsx`.
- **`ward-flow-persistence-classification.ts`** (481 lines) — classifies every `WardFlowEvent`
  type as `WARD_FLOW_TEXT_SAFE_EVENT_TYPES` (12 fixed field shapes only: ids, closed-union codes,
  instants, booleans, the caller's own role) or `WARD_FLOW_TYPED_TEXT_EVENT_TYPES` (can carry
  human-typed prose). Also carries a compile-time guard
  (`UnreviewedStringOrUnknownKeys`/`IsBrandedString`/`IsClosedUnderAppend`) that fails `tsc` if a
  safe-listed event's payload gains an unreviewed `string`/`unknown` field. See §5.
- **`ward-audit.ts`** (534 lines) — `WardAuditState` (the four audit-related fields folded into
  `WardFlowState`), `AuditEvent`/`AuditReview`, `classifyAuditEvent` (which event types are
  audited at all), and `appendAudit` (called by `wardFlowReducer` on every dispatch to append one
  audit row, accepted or refused). `readAuditEvents`/`readAuditReviews` are coordinator-only
  reads.
- **`ward-reanchor.ts`** (169 lines) — `shiftInstants(value, offsetMinutes)`, a generic deep walk
  that adds `offsetMinutes` to every field named in `INSTANT_FIELDS` (a hand-maintained set of ~40
  field names). Used once, by the provider, to move the whole fixture from its authored anchor
  (`NOW_ANCHOR`, 10:42) onto the real time of page load without touching any duration. A field
  present in `ward-model.ts` or `ward-admissions.ts` but missing from `INSTANT_FIELDS` silently
  stays on the old anchor — `tests/ward-reanchor.test.ts` is the guard (see §7).
- **`ward-clock.ts`** (216 lines) — the synthetic clock. `Instant = number` (minutes since day-0
  midnight, not a time of day). The **only** file allowed to call `new Date()`/read the real wall
  clock (`wallClockNow`, `absoluteWallClockMinutes`, `demoDayZero`). Also holds duration
  formatting (`formatInstant`, `splitDuration`, `formatRemaining`, `clockState`).
- **`ward-configuration.ts`** (135 lines) — `WardConfiguration` (four coordinator-tunable
  numbers: `edAccessTargetMinutes`, `parallelReferralCap`, `pullHoldMinutes`,
  `morningRollupDeadlineMinutes`), `defaultWardConfiguration()`, and `validateConfiguration`,
  which refuses anything but in-range, on-step integers matching exactly the expected key set —
  the only door `SET_CONFIGURATION` can write through.
- **`ward-scenarios.ts`** (44 lines) — `WardScenario = "standard" | "scarce"` and
  `scenarioUnits()`, which clamps allocatable/locked/specialling/high-acuity bed counts down for
  the "scarce" night. Explicitly operational-numbers-only: same units, same patients, same
  identities.
- **`ward-rulings-demo.ts`** (418 lines) — `applyRulingsDemoOverlay`, merged additively onto every
  freshly seeded state (`seedWardFlowState` calls it). Adds a handful of hand-authored example
  records (`RD-01` onward) illustrating specific owner rulings; existing fixture rows are kept,
  and an overlay row whose id already exists in the base seed is skipped. Carries its own
  `SKIPPED` list recording two fields it deliberately does not attempt to exercise.
- **`ward-flow-roles.ts`** (57 lines) — `WardFlowRole` (8 members: `coordinator`, `ed`, `ward`,
  `officer`, `demo`, `community`, `bed_manager`, `executive`) and `WARD_FLOW_ROLE_LABELS`.
  Relocated out of `ward-flow-events.ts` (2026-09-11) so `ward-model.ts` can import the role type
  without pulling the whole event union into its module graph. **There is no signed-in identity
  anywhere in Ward Flow: the role is the route you are on** (enforced at the chrome layer, not
  here).

### 1a. `ward-flow-reducer.ts` internal structure

- **`seedWardFlowState(scenario)`** (`:630`) — builds the fresh `WardFlowState` object literal
  (all the array/counter fields at their zero/seed values) from the imported seed modules
  (`ward-movements.ts`, `ward-patients-seed.ts`, `ward-admissions-seed.ts`), then passes it
  through `applyRulingsDemoOverlay`.
- **`seedWardFlowStateAt(offsetMinutes, scenario)`** (`:695`) — the only door application code
  uses: seeds and shifts (`shiftInstants`) in one call, so there is no argument a caller could
  double-shift.
- **`subjectId(event)`** (`:700`) — a `switch` (not the main one) that says which id a `Rejection`
  is filed against for events with no `movementId` (referral-scoped, admission-scoped,
  release-scoped, inbox-scoped, notice-scoped events each get their own case; everything else
  falls through to `event.movementId` if present, else `"none"`).
- **`makeRejection`** (`:807`), **`reject`** (`:818`) — construct and append one `Rejection` to
  `state.rejections`; the return value of every guard failure in the main switch.
- **`pullOverrides`** (`:955`), **`eligibilityRefusal`** (`:987`), **`heldUnitGenderRefusal`**
  (`:1077`), **`referralAcceptanceRefusal`** (`:1125`) — the shared eligibility/override helper
  functions called from `PULL_PATIENT`, `REFER_TO_UNITS`, `ACCEPT_IN_PRINCIPLE`,
  `ACCEPT_REFERRAL`, and from four transport-leg cases that re-check a gender judgement against an
  already-held unit (`heldUnitGenderRefusal`).
- **`findMovement`/`findUnit`/`findBedRelease`/`findNotice`/`findAdmission`/`findLeaveBed`/
  `findReferral`** (`:1166`–`:1218`) and their **`replace*`** counterparts (`:1183`–`:1233`) —
  the id-lookup and immutable-array-splice helpers every case uses.
- **`releasePulledBedAndAdmission`** (`:1281`) — refunds `unit.allocatable`/`allocatableLocked`
  and deletes the phantom `Admission` a `PULL_PATIENT` created. Shared by `RELEASE_PULL`,
  `RELEASE_HELD_BED`, `RELEASE_DIVERTED_BED`, `RELEASE_AND_REOPEN_SEARCH`, and several
  closure-on-withdrawal paths.
- **`nextReferralId`/`nextLeaveBedId`/`nextFrontDoorReferralId`** (`:1339`–`:1363`) — id
  minting from the monotonic sequence counters, never from array length (see §3's note on why).
- **`makeNotice`/`appendNotices`/`noticeSubject`/`unitName`/`referralReferrer`** (`:1377`–`:1471`)
  — build and append `Notice` rows; `appendNotices` is where a `demo`-addressed notice is refused.
- **`departAdmission`** (`:1478`) — the shared admission-closing helper (`RECORD_LEAVING`,
  `RECORD_PATIENT_DISCHARGE`).
- **`protectedRefusal`** (`:1521`), **`reduceRecordEvent`** (`:1546`) — the separate path for the
  three "protected" events (`OPEN_DISCHARGE_RECORD`, `REVIEW_AUDIT_EVENT`,
  `RECORD_PATIENT_DISCHARGE`): role → payload sanity → generation-staleness → event-specific
  checks, entirely outside the big `reduceClinicalEvent` switch.
- **`advanceResourceRevisions`** (`:1668`) — bumps `unit.allocatable.revision` for any unit whose
  `allocatable` value changed this dispatch, so `CONFIRM_CAPACITY`'s optimistic-concurrency check
  (`expectedRevision`) can detect a stale capacity draft.
- **`wardFlowReducer(state, event)`** (`:1682`, exported) — the public entry point. Routes
  protected events to `reduceRecordEvent`; otherwise refuses on counter exhaustion, then calls
  `reduceClinicalEvent`, then (for `RESET_SCENARIO`/`SET_SCENARIO`) bumps `worldGeneration` only
  if the world actually changed reference (guards against a rejected reset silently incrementing
  generation), then always calls `appendAudit`.
- **`reduceClinicalEvent(state, event, decision)`** (`:1733`) — the guard chain and the 97-case
  `switch (event.type)` documented in full in §2. Guard order: **(1) role** — `EVENT_ROLE[type]`
  checked before any payload field is read (`:1734`–`:1743`); **(2)** each case's own domain
  guards (record exists, not closed, stage/state correct, reason/code is a member of its closed
  list, actor's claimed `actingUnitId`/`actingPlaceId` matches the record) — see §2 for what each
  case actually checks. `wardFlowReducer` itself adds the **generation-staleness** check
  (`expectedGeneration !== worldGeneration`) ahead of the protected-event path only; ordinary
  clinical events do not carry `expectedGeneration` except where individually noted (e.g.
  `CONFIRM_CAPACITY`'s `expectedRevision`).

---

## 2. Event catalogue

**97 event types** (`grep -c '^\s*case "[A-Z_]+":' ` on `reduceClinicalEvent`'s switch, matching
`EVENT_ROLE`'s 97 keys exactly — re-checked, not inferred from the overview map, which cites 148
case labels; that figure counts every `case` in the whole file, including the unrelated
`subjectId` switch at `:700`, which alone accounts for most of the difference). Grouped by domain
below. Each line: **role list** (from `EVENT_ROLE`), **effect** on success, **main guards**, and
the **reducer case's line number**. "Closure" means `movement.closure` is set (stage becomes
terminal); "open" means no closure yet.

### 2.1 Discharge, admission records, audit access (10)

- **`RECORD_PATIENT_DISCHARGE`** — roles: `ward`. Effect: ends the admission via
  `departAdmission` (sets `admission.state` `departed`, `leftAt`/destination, adjusts
  `unit.empty`/`sexMix`). Guards: handled outside the main switch, in `reduceRecordEvent`
  (`:1546`) — admission/unit exist and match, patient identity matches, discharge revision
  matches `expectedRevision`, destination is a member of `LEAVING_DESTINATIONS`, admission is
  `occupied`, involuntary/detained patients cannot discharge to community or "left against
  advice", and a patient still in transit cannot be discharged. Case at `:1746` (no-op stub; real
  logic is in `reduceRecordEvent`).
- **`UPDATE_EXPECTED_DISCHARGE`** — roles: `ward`, `coordinator`. Effect: sets
  `admission.expectedDischargeAt`, bumps `dischargeDateMoves` if the date changed, stamps
  `dischargeDateSetAt`/`By`. Guards: admission exists; not `departed`; `actingUnitId` (if a
  `ward` caller) matches `admission.unitId`; `expectedDischargeAt` is a finite timestamp. Case at
  `:1751`.
- **`OPEN_DISCHARGE_RECORD`** — roles: `coordinator`, `ward`. Effect: records an audit
  "record-access" entry; returns state unchanged otherwise (a read, not a write). Guards: handled
  in `reduceRecordEvent`; the record is resolvable to the caller (`selectDischargeRecord`), and a
  repeated request with the same `requestId` replays the earlier read rather than re-auditing.
  Case at `:1747` (no-op stub in the main switch).
- **`REVIEW_AUDIT_EVENT`** — roles: `coordinator`. Effect: appends an `AuditReview` (decision:
  `reviewed`/`follow-up-required`) to `state.auditReviews`. Guards: handled in `reduceRecordEvent`
  — the audit entry exists, is not itself a review, generation matches, and `expectedReviewCount`
  matches the current review count for that entry (optimistic concurrency). Case at `:1748` (no-op
  stub).
- **`RECORD_LEAVING`** — roles: `ward`. Effect: ends the admission via `departAdmission`. Guards:
  admission exists and belongs to `actingUnitId`; not already `departed`; must currently be
  `occupied`; refused if the patient is actively in transit (stage `moving` or collected-but-not-
  arrived); refused for involuntary/detained patients discharging to community or leaving against
  advice. Case at `:4643`.
- **`RECORD_AWAY_AT_EMERGENCY_DEPARTMENT`** — roles: `ward`. Effect: sets
  `admission.awayAtEmergencyDepartmentSince` to `now`; the bed stays counted occupied. Guards:
  admission exists and belongs to `actingUnitId`; `admission.state` must be `occupied`; refused if
  already recorded as away. Case at `:4931`.
- **`RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT`** — roles: `ward`. Effect: clears
  `admission.awayAtEmergencyDepartmentSince` back to `null`. Guards: admission exists and belongs
  to `actingUnitId`; refused unless currently recorded as away. Case at `:4963`.
- **`SET_STEP_DOWN_CANDIDATE`** — roles: `ward`, `coordinator`. Effect: sets
  `admission.stepDownCandidate`. Guards: admission exists; `ward` caller's `actingUnitId` matches
  `admission.unitId`. Case at `:8070`.
- **`SET_DISCHARGE_BARRIER`** — roles: `ward`, `coordinator`. Effect: sets
  `admission.dischargeBarrier` (`null` for "None", else the barrier value). Guards: admission
  exists; `actingUnitId` (ward caller) matches `admission.unitId`; refused if setting a real
  barrier while length of stay is under 7 days. Case at `:8093`.
- **`RECORD_REPATRIATION`** — roles: `coordinator`. Effect: appends a `RepatriationRecord`
  (phone-log only, never books transport) to `state.repatriations`; if `receivingWardAgreed` is
  true, also synthesises a new return `Movement` (stage `placement_requested`). Guards: admission
  exists; not already recorded; `homeHospital` names a real site; `mode`/`provider`/
  `transportLegalStatus` each members of their closed lists; `cadNumber` non-empty; `estimatedAt`
  finite. Case at `:8544`.

### 2.2 Front-door referrals — before a Movement exists (7)

- **`ADD_PATIENT`** — roles: `ed`, `community`, `coordinator`. Effect: appends a new `Patient`
  (generated id) to `state.patients`; links to no movement/referral/admission. Guards: `gender`
  (if given) must be a member of `GENDERS`; `umrn` must not collide with an existing patient. Case
  at `:1790`.
- **`RECEIVE_REFERRAL`** — roles: `community`, `ed`. Effect: appends a new `Referral` (queued
  destinations, `frontDoorReferralSequence` incremented). Guards: `ageBand`/`sex`/`gender`/
  `source`/`homeRegion`/`urgency`/`tentativeDiagnosis` each membership-checked; 1 to
  `parallelReferralCap` destinations, no duplicate destination kind; an ED destination must
  resolve to a real ED with a valid purpose; `originSiteCode` must resolve to a real site (with an
  ED if `source` is `ed_medical` — role `ed` is refused paired with any other source);
  `suburb`/`patientId` must resolve; `history`/`sendingTeamName` length limits refused, never
  truncated. Case at `:5521`.
- **`ACCEPT_REFERRAL`** — roles: `ward`, `coordinator`, `ed`, `community`. Effect: sets the
  matching destination's `state` to `accepted` (plus `acceptedUnitId`/`decidedAt`/`decidedBy`),
  cancels other queued non-community sibling destinations (unless the accepting arm is
  community), optionally appends a `genderPlacements` record. Guards: referral/destination exist;
  role must own the destination kind (`ward`↔`psychiatric_ward`, `ed`↔ED, `community`↔
  `community_team`, `coordinator` any); refused if the referral already accepted elsewhere
  (except a community follow-up arm) or this destination already answered/withdrawn; the ward
  branch additionally requires no open linked movement, a real `unitId`, gender-designation
  clearance, and passes `referralAcceptanceRefusal`'s eligibility gates. Case at `:5853`.
- **`DECLINE_REFERRAL`** — roles: `ward`, `coordinator`, `ed`, `community`. Effect: sets the
  matching destination's `state` to `declined` with `declineReason`/`decidedAt`/`decidedBy`.
  Guards: referral/destination exist; role owns the destination kind; refused if already accepted
  elsewhere (except community), already answered, or withdrawn; `reason` must come from the
  destination-kind-specific reason list. Case at `:6282`.
- **`RECORD_REFERRER_WITHDRAWAL`** — roles: `coordinator`. Effect: the scoped
  (`destinationKind: "community_team"`) branch stamps just that destination withdrawn; the
  unscoped branch stamps every still-queued destination withdrawn and cascades to close/unwind
  every linked open movement (releases pulled bed, cancels transport). Guards: referral exists;
  scoped branch refuses a missing community destination, already-withdrawn, already-answered, or
  an off-list reason; unscoped branch refuses an already-accepted referral, nothing left waiting,
  or a linked movement whose transport was already collected (must use `STOP_TRANSPORT` instead).
  Case at `:6502`.
- **`ADD_REFERRAL_CORRECTION`** — roles: `community`, `ed`, `coordinator`. Effect: appends
  `{at, by, note}` to `referral.corrections` (never touches `history`). Guards: referral exists;
  trimmed note non-blank; note length ≤ `REFERRAL_CORRECTION_NOTE_MAX_CHARACTERS` (refused, never
  truncated). Case at `:6676`.
- **`RECORD_LOCAL_BED_SOUGHT`** — roles: `coordinator`. Effect: sets `referral.localBedSought` to
  `{at, by}`. Guards: referral exists and still `queued` (undecided); refused if already recorded
  (one-shot). Case at `:6702`.

### 2.3 Movement and bed pipeline (28)

- **`RAISE_REFERRAL`** — roles: `ed`, `community`, `ward`. Effect: appends a new `Movement`
  (stage `placement_requested`). Guards: `edId` (origin) must be known; if `referralId` given, it
  must resolve, be addressed to this origin, not withdrawn/declined there, and not already fund a
  still-live linked movement; `legalFormCode`/`gender`/`tentativeDiagnosis` off-list values
  refused. Case at `:1873`.
- **`RECORD_EXAMINATION`** — roles: `ed`. Effect: sets `movement.examination`, archiving any
  prior exam into `supersededExaminations`; `inpatient_order`/`further_examination_ordered` just
  record; `revoked`/`community_order` either flag the movement (bed held, awaiting manual release)
  or close it and release the pulled bed/transport. Guards: movement exists; not closed; not
  already examined with a conclusive outcome. Case at `:2858`.
- **`RECORD_MEDICAL_CLEARANCE`** — roles: `ed`. Effect: overwrites `referral.medicalClearance`
  and propagates it onto every linked movement. Guards: referral exists (re-recording/overwriting
  is explicitly allowed). Case at `:2168`.
- **`RECORD_ARRIVED_IN_DEPARTMENT`** — roles: `ed`. Effect: sets `referral.inDepartmentAt` to
  `now`. Guards: referral exists; idempotent no-op if already set (first recording wins). Case at
  `:2202`.
- **`RECORD_TRANSPORT_NEED`** — roles: `ed`, `ward`, `community`. Effect: overwrites
  `movement.transportNeed`, syncing an existing transport job's `needed` flag too. Guards:
  movement exists and open. Case at `:2221`.
- **`RECORD_NO_REFERRAL`** — roles: `ed`. Effect: sets `movement.referralAbsence` to
  `none_raised`. Guards: movement exists, open, and does not already carry a `referralId`
  (contradiction refused). Case at `:2246`.
- **`RECORD_ED_OUTCOME`** — roles: `ed`. Effect: closes movement `did_not_proceed`, clears
  `admissionId`/`acceptedUnitId`/`referredUnitIds`, releases any pulled bed, cancels live
  transport, withdraws live ward requests. Guards: movement exists, open, not actively in transit;
  `for_discharge` refused on a legal-form patient lacking a conclusive exam outcome. Case at
  `:2282`.
- **`REFER_TO_UNITS`** — roles: `coordinator`. Effect: unions newly-eligible units into
  `movement.referredUnitIds`, sets stage `destination_review`, records overrides/genderPlacements.
  Guards: movement exists, open; live+new unit count ≤ `parallelReferralCap`; stage must be
  referrable (`placement_requested`/`destination_review`); unit ids known; `overrideReason`
  off-list refused; an uncovered `Non-binary` gender placement without a valid reason and checked
  flag refused; individual units failing eligibility are held back unless _all_ new units fail.
  Case at `:3039`.
- **`ACCEPT_IN_PRINCIPLE`** — roles: `ward`. Effect: sets `movement.acceptedUnitId`/`acceptedAt`,
  moves stage `accepted_awaiting_bed`, clears `referredUnitIds`, records withdrawals for other
  referred units. Guards: movement exists, open, not already accepted elsewhere; stage must be
  `destination_review`; `unitId` must be in `referredUnitIds`; gender-placement uncovered or
  eligibility failing without a valid `overrideReason` refused. Case at `:3265`.
- **`PULL_PATIENT`** — roles: `ward`, `coordinator`. Effect: first pull decrements
  `unit.allocatable` (and `allocatableLocked` if a locked bed is taken), creates a new `Admission`
  (`pulled`) and sets `movement.admissionId`/stage `pulled`; a repeat pull after a step-back
  restores stage without consuming a new bed. Guards: movement exists, open; stage must be
  `accepted_awaiting_bed`; `acceptedUnitId` matches `event.unitId`; gender-designation resolved;
  bed/specialling/high-acuity/locked-bed capacity available (each overridable with a valid reason;
  acuity also needs `numConsulted`); eligibility runs last. Case at `:3585`.
- **`DECLINE`** — roles: `ward`. Effect: removes the ward from `referredUnitIds`, appends a
  `Decline`, sets stage `destination_review` (or, for a waitlist-instead-of-decline reason, moves
  the unit to `waitlistedUnitIds` without changing stage). Guards: movement/no closure; stage
  `destination_review`; unit holds a live referral; a gender-mismatch reason is refused outright;
  `reason` must be in `DECLINE_REASONS` (a waitlist reason is checked against
  `parallelReferralCap` instead). Case at `:4073`.
- **`HANDOVER_READY`** — roles: `ed`. Effect: sets stage `handover_ready`. Guards: movement/no
  closure; stage `pulled`; a transport must already be booked unless `transportNeed` explicitly
  marks `needed: false`; re-runs `heldUnitGenderRefusal`. Case at `:4189`.
- **`PATIENT_ARRIVED`** — roles: `officer`, `ward`. Effect: sets stage `arrived` with a closure
  record, decrements `unit.empty`/increments `sexMix`, marks (or synthesises) the linked admission
  `occupied`/`arrived`. Guards: movement/no closure; refused if transport was diverted; if
  no-transport-needed, stage must be `pulled`/`handover_ready`, else `moving` with
  `transport.collectedAt` set; `acceptedUnitId` present; `ward` caller's `actingUnitId` must match
  it; unit must exist. Case at `:4426`.
- **`RECORD_LEGAL_FORM_EXPIRY` / `RECORD_MOVEMENT_GENDER`** — see §2.4.
- **`RECORD_ESCALATION`** — roles: `coordinator`. Effect: sets `movement.escalation` to
  `{at, triedUnitIds, contact}`. Guards: movement exists; not closed. Case at `:6726`.
- **`RELEASE_PULL`** — roles: `coordinator`, `ward`. Effect: deletes the phantom
  admission/bed via `releasePulledBedAndAdmission`, sets stage back to `accepted_awaiting_bed`,
  clears `pullExpiresAt`/`admissionId`/`transport`. Guards: movement exists, open, not already
  collected (use `STOP_TRANSPORT`), no transport job booked (cancel first), stage `pulled`; `ward`
  caller's `actingUnitId` matches `acceptedUnitId`; `reason` in `RELEASE_PULL_REASONS`. Case at
  `:6811`.
- **`REFER_TO_COMMUNITY_TEAM`** — roles: `ed`. Effect: closes movement `did_not_proceed`, creates
  (or reuses a queued) community `Referral` arm, clears ward acceptance/referrals, releases any
  pulled bed, cancels live transport. Guards: movement exists, open, patient not already collected
  (use `STOP_TRANSPORT`), `team` valid; on-legal-form patient lacking a conclusive exam outcome
  refused. Case at `:2622`.
- **`RECORD_LEFT_DEPARTMENT`** — roles: `ed`. Effect: sets `movement.leftDepartmentAt`. Guards:
  movement exists; not already recorded; no `edOutcome` recorded yet. Case at `:2838`.
- **`STEP_BACK_STAGE`** — roles: `coordinator`. Effect: sets `movement.stage` back to an earlier
  stage, touches nothing else (no bed release, no transport cancel). Guards: movement exists, not
  `arrived`/closed; target stage must be strictly earlier than current; `reason` in
  `STEP_BACK_REASONS`. Case at `:7674`.
- **`WITHDRAW_ACCEPTANCE`** — roles: `coordinator`. Effect: clears `acceptedUnitId`/`acceptedAt`,
  stage back to `destination_review` (never re-adds to `referredUnitIds`). Guards: movement
  exists, open, currently `accepted_awaiting_bed`; `reason` in `STEP_BACK_REASONS`; refused if the
  movement still holds a bed/admission (release the pull first). Case at `:7727`.
- **`WITHDRAW_WARD_REQUEST`** — roles: `coordinator`. Effect: removes one unit from
  `referredUnitIds`, appends a `coordinator_withdrew` entry. Guards: movement exists, open; unit
  in `referredUnitIds`; `reason` in `WARD_REQUEST_WITHDRAWAL_REASONS`. Case at `:3531`.
- **`SET_ARRIVAL_DETAILS`** — roles: `coordinator`, `ed`, `ward`, `community`. Effect: sets
  `movement.arrivalDetails`, clears `pullExpiresAt`; if the new estimate reads late and not yet
  notified, sets `arrivalLateNotifiedAt`. Guards: movement exists (no further ownership check in
  this case). Case at `:8010`.
- **`RECORD_MOVEMENT_MEDICAL_CLEARANCE`** — roles: `ed`, `coordinator`, `ward`, `community`.
  Effect: sets `movement.medicalClearance` and propagates to the linked referral and sibling
  movements. Guards: movement exists. Case at `:8124`.
- **`EVALUATE_ARRIVAL_LATENESS`** — roles: `coordinator`, `ed`, `ward`. Effect: on qualifying
  lateness, sets `arrivalLateNotifiedAt` and appends notices. Guards: movement exists; no-op if
  already notified or not yet late per `isArrivalLate()`. Case at `:8297`.
- **`RELEASE_AND_REOPEN_SEARCH`** — roles: `coordinator`, `ward`. Effect: releases the pulled
  bed/admission, resets stage `placement_requested`, clears
  `acceptedUnitId`/`acceptedAt`/`admissionId`/`pullExpiresAt`/`waitlistedUnitIds`, resets
  `referredUnitIds`. Guards: movement exists, open, no booked transport job (cancel first), stage
  `pulled`/`accepted_awaiting_bed`; `reason` in `RELEASE_PULL_REASONS`; `ward` caller's
  `actingUnitId` matches accepted unit. Case at `:8331`.
- **`WITHDRAW_REFERRAL`** — roles: `ed`, `community`, `ward`, `coordinator`. Effect: closes
  movement `did_not_proceed`; if accepted, releases pulled bed, cancels transport, clears
  `acceptedUnitId`; if only referred, clears `referredUnitIds`. Guards: movement exists, open;
  once accepted, only `coordinator`/`ed` may withdraw and refused if already collected; if not
  accepted, refused when `referredUnitIds` is empty. Case at `:3403`.
- **`RECORD_MOVEMENT_BLOCKER`** — roles: `ed`, `community`, `ward`, `coordinator`, `officer`.
  Effect: sets `movement.blocker` to the given free prose. Guards: movement exists, open; text not
  blank; refused if it is a case-only near-miss of a "nothing is blocking" sentinel (use `CLEAR`
  instead). Case at `:4847`.
- **`CLEAR_MOVEMENT_BLOCKER`** — roles: same five. Effect: sets `movement.blocker` to a fixed
  "None — cleared" sentinel. Guards: movement exists, open; refused as a no-op if already one of
  `BLOCKERS_MEANING_NOTHING_IS_BLOCKING`. Case at `:4915`.

### 2.4 Legal status and forms (11)

- **`CHANGE_LEGAL_STATUS`** — roles: `coordinator`, `ed`. Effect: sets `movement.legalStatus`,
  appends to `statusChanges`; deliberately never reacts to a resulting unlawful placement. Guards:
  movement exists, open; `reason` in `LEGAL_STATUS_CHANGE_REASONS`. Case at `:6773`.
- **`RECORD_LEGAL_FORM_RECEIVED`** — roles: `ed`. Effect: sets `movement.legalFormReceivedAt`.
  Guards: movement exists, open, not already marked received; `legalForm.code` must be a
  receivable/legal-clock code. Case at `:2425`.
- **`CORRECT_LEGAL_FORM_RECEIPT`** — roles: `ed`. Effect: clears
  `movement.legalFormReceivedAt`, appends `{at, by, reason}` to `legalFormReceiptCorrections`.
  Guards: movement exists, open, has a recorded receipt to correct; `reason` in
  `LEGAL_FORM_RECEIPT_CORRECTION_REASONS`. Case at `:2466`.
- **`RECORD_LEGAL_FORM_EXPIRY`** — roles: `ed`, `coordinator`. Effect: sets
  `movement.legalForm.dueAt`, clears the legacy `legalClock`, appends a history entry
  (`written_on_form`/`extension`). Guards: movement exists, open, has a `legalForm`; `dueAt`
  finite; an extension's new `dueAt` must be strictly later than the one already recorded. Case at
  `:2512`.
- **`RECORD_LEGAL_FORM_WRITTEN`** — roles: `ed`, `coordinator`, `ward`, `community`. Effect: sets
  `movement.formedAt`, replaces `movement.legalForm`, clears `legalClock`, conditionally appends
  to `legalFormExpiryHistory`. Guards: movement exists, open; `writtenAt`/`paperExpiresAt` finite;
  `formCode` must be a recognised legal-clock code; refused if `formCode` is `3C` and the person
  arrived on a `3D`. Case at `:8199`.
- **`RECORD_COUNTRY_EXTENSION`** — roles: `ed`, `coordinator`. Effect: **none** — unconditionally
  refused, redirecting the caller to `RECORD_LEGAL_FORM_EXPIRY` with a typed expiry. Case at
  `:8252`.
- **`RECORD_LEGAL_FORM_CONTINUATION`** — roles: `ed`, `coordinator`, `ward`, `community`. Effect:
  sets `formedAt`, replaces `legalForm`, clears `legalClock` and `legalFormReceivedAt`. Guards:
  movement exists; `startedAt`/`paperExpiresAt` finite; `formCode` recognised. Case at `:8264`.
- **`CLEAR_EXPECT_FLAG`** — roles: `ward`, `coordinator`, `ed`, `community`. Effect: sets
  `movement.expectFlag.clearedAt`/`clearedBy`. Guards: movement exists; there must be an open
  expect flag to clear. Case at `:8392`.
- **`RAISE_EXPECT_FLAG`** — roles: same four. Effect: sets `movement.expectFlag` to
  `{raisedAt, kind}`. Guards: movement exists; refused if an open flag already exists; `kind` must
  be exactly `voluntary_48h`/`involuntary_7d`. Case at `:8405`.
- **`FLAG_LEGAL_MISMATCH`** — roles: `ward`, `coordinator`. Effect: sets
  `movement.legalMismatch` to `{at, unitId, kind}` (kind derived from unit/legal-status rules, or
  the event's supplied kind). Guards: movement exists; unit exists. Case at `:8422`.
- **`OVERRIDE_LEGAL_MISMATCH`** — roles: `coordinator`, `ward`. Effect: sets
  `movement.legalMismatch.overridden = true` and records `overrideReason`. Guards: movement
  exists, has an existing `legalMismatch`; `overrideReason` in `OVERRIDE_REASONS`. Case at
  `:8442`.

### 2.5 Capacity and bed release (15)

- **`CONFIRM_CAPACITY`** — roles: `ward`. Effect: sets `unit.allocatable.value`/`source`/
  `confirmedAt`, increments `allocatable.revision`. Guards: `actingUnitId` equals `unitId`; unit
  exists; `value` non-negative integer ≤ `unit.beds` (refuses rather than clamps);
  `expectedRevision` must match current revision. Case at `:4988`.
- **`RECORD_WARD_INTAKE_CONSTRAINTS`** — roles: `ward`. Effect: sets `unit.intakeConstraints`.
  Guards: `actingUnitId` equals `unitId`; every code in `WARD_INTAKE_CONSTRAINTS`. Case at
  `:5061`.
- **`FLAG_BED_RELEASE`** — roles: `ward`. Effect: appends a new `BedRelease` (state `expected`).
  Guards: `actingUnitId` equals `unitId`; unit exists; `blocker` (if given) in
  `BED_RELEASE_BLOCKERS`. Case at `:5088`.
- **`CONFIRM_BED_RELEASE`** — roles: `ward`. Effect: sets `release.state` `confirmed`, clears
  `waitingOn`. Guards: release exists; `actingUnitId` equals `release.unitId`; must currently be
  `expected`. Case at `:5160`.
- **`REVERT_BED_RELEASE`** — roles: `ward`. Effect: sets `release.state` back to `expected`, sets
  `waitingOn`. Guards: release exists; ownership match; must currently be `confirmed`; `waitingOn`
  in `BED_RELEASE_WAITING_ON`. Case at `:5209`.
- **`BLOCK_BED_RELEASE`** — roles: `ward`. Effect: sets `release.blocker`/`blockedBy` (state
  unchanged). Guards: release exists; ownership match; `blocker` required, in
  `BED_RELEASE_BLOCKERS`; refused if already `discharged`. Case at `:5245`.
- **`CLEAR_BED_RELEASE_BLOCK`** — roles: `ward`. Effect: clears `release.blocker`/`blockedBy`.
  Guards: release exists; ownership match; refused if already null. Case at `:5291`.
- **`SET_BED_PREPARATION`** — roles: `ward`. Effect: sets `release.preparing`/`preparationNote`.
  Guards: release exists; ownership match; note (if given) in `BED_PREPARATION_NOTES`. Case at
  `:5318`.
- **`RELEASE_BED`** — roles: `ward`. Effect: sets `release.state` `discharged`; raises
  `unit.allocatable`/`empty` by one (clamped to `unit.beds`) unless already counted via a matching
  departed admission. Guards: release exists; ownership match; refused if already `discharged`.
  Case at `:5361`.
- **`RECORD_LEAVE_BED`** — roles: `ward`. Effect: appends a new `LeaveBed` record. Guards:
  `actingUnitId` equals `unitId`; unit exists. Case at `:5471`.
- **`END_LEAVE_BED`** — roles: `ward`. Effect: removes the matching `LeaveBed` entry. Guards:
  leave bed exists; ownership match. Case at `:5495`.
- **`REQUEST_CAPACITY_REFRESH`** — roles: `coordinator`. Effect: appends
  `{unitId, at, byRole}` to `refreshRequests`; changes no bed figure. Guards: unit exists. Case at
  `:5508`.
- **`EVALUATE_LEAVE_BED_WARNINGS`** — roles: `ward`, `coordinator`. Effect: for each leave bed
  needing an open-warning, sets `openWarningAt` and appends a notice. Guards: none that reject —
  already-warned or not-yet-due entries are simply skipped. Case at `:8462`.
- **`CONFIRM_MORNING_ROLLUP`** — roles: `ward`, `coordinator`. Effect: sets
  `morningRollupConfirmations[unitId]`. Guards: unit exists; `ward` caller's `actingUnitId` must
  match; `expectedDischarges` non-negative safe integer. Case at `:8486`.
- **`SEND_WARD_BUZZ`** — roles: `coordinator`, `bed_manager`, `executive`. Effect: appends
  `{unitId, at, byRole, message, urgent}` to `refreshRequests`. Guards: unit exists. Case at
  `:8517`.

### 2.6 Transport (9)

- **`TRANSPORT_ACCEPTED`** — roles: `officer`. Effect: sets `transport.acceptedAt`. Guards:
  movement/open; refused while an examination revoked/community_order still holds the bed; stage
  `handover_ready` with a `transport` job present; not already accepted; `heldUnitGenderRefusal`
  re-check. Case at `:4241`.
- **`TRANSPORT_EN_ROUTE`** — roles: `officer`. Effect: sets `transport.enRouteAt`. Guards: same
  shape, requires `transport.acceptedAt` set; not already en route. Case at `:4291`.
- **`PATIENT_COLLECTED`** — roles: `officer`. Effect: sets stage `moving`,
  `transport.collectedAt`. Guards: same shape, requires `transport.enRouteAt` set; last of the
  four held-unit gender re-checks. Case at `:4362`.
- **`BOOK_TRANSPORT`** — roles: `ed`, `ward`, `community`. Effect: sets `movement.transport` to a
  new job (`provider`, `escortRequired`, `cadNumber`, `transportLegalStatus`, `estimatedAt`,
  `bookedBy`). Guards: movement exists, open, stage `pulled`/`handover_ready`, no transport
  already booked; `provider`/`transportLegalStatus` valid enum members; `escortRequired`/
  `cadNumber`/`estimatedAt` all answered (no defaults); `ward` caller states a real
  `actingUnitId`; `community` caller states a real `actingPlaceId`; must have an accepted unit or
  admission. Case at `:6964`.
- **`CANCEL_TRANSPORT`** — roles: `coordinator`, `ed`, `ward`, `community`. Effect: clears
  `movement.transport` entirely (no automatic rebooking). Guards: movement exists, open, has a
  transport job not already cancelled/arrived/collected; a `ward` caller may only cancel a job it
  itself booked (`bookedBy.unitId` match); `community` likewise (`bookedBy.placeId`); `reason` in
  `CANCEL_TRANSPORT_REASONS`. Case at `:7116`.
- **`STOP_TRANSPORT`** — roles: `coordinator`, `ed`. Effect: marks the job cancelled/stopped
  (`stoppedAt`/`stoppedBy`/`stopReason`/`stoppedWhereabouts`), closes the movement
  `did_not_proceed`, leaves the bed held (not auto-released). Guards: movement exists, open, has a
  transport job collected but not already arrived/diverted/cancelled; `reason` in
  `STOP_TRANSPORT_REASONS`; `whereabouts` in `TRANSPORT_WHEREABOUTS`. Case at `:7384`.
- **`RELEASE_HELD_BED`** — roles: `coordinator`, `ward`, `ed`. Effect: releases the bed/admission
  a prior `STOP_TRANSPORT` left held, via `releasePulledBedAndAdmission`. Guards: movement was
  stopped via `STOP_TRANSPORT` (`transport.stoppedAt` set); still holds an admission; `ward`
  caller's `actingUnitId` matches `acceptedUnitId`. Case at `:7502`.
- **`RECORD_DIVERSION`** — roles: `officer`, `coordinator`. Effect: sets
  `transport.diversion` to `{at, by, place, reason}`; bed stays held, movement stays open. Guards:
  movement exists, open, has a job collected but not arrived/stopped/cancelled/already diverted;
  `reason` in `DIVERSION_REASONS`; `place` in `TRANSPORT_WHEREABOUTS`. Case at `:7540`.
- **`RELEASE_DIVERTED_BED`** — roles: `coordinator`, `ward`, `ed`. Effect: releases the held
  bed/admission, marks transport cancelled, closes the movement `did_not_proceed`. Guards:
  movement has a recorded diversion; still holds an admission; `ward` caller's `actingUnitId`
  matches. Case at `:7616`.

### 2.7 Urgency and gender flags (4)

- **`CHANGE_URGENCY`** — roles: `coordinator`, `ed`. Effect: sets `movement.urgency`, appends to
  `urgencyChanges`; never re-sorts or re-refers. Guards: movement exists, open; `reason` in
  `URGENCY_CHANGE_REASONS`. Case at `:6739`.
- **`FLAG_MOVEMENT_URGENT`** — roles: `coordinator`, `ed`. Effect: sets `flaggedUrgent: true`,
  writes `urgentFlag`. Guards: movement exists, open, not already flagged; `reason` in
  `URGENT_MARK_REASONS`. Case at `:4791`.
- **`CLEAR_MOVEMENT_URGENT_FLAG`** — roles: `coordinator`, `ed`. Effect: sets `flaggedUrgent:
false`, clears `urgentFlag`, closes the newest `urgentFlagHistory` entry. Guards: movement
  exists; must currently be flagged (no closure check — clearing is always allowed). Case at
  `:4817`.
- **`RECORD_MOVEMENT_GENDER`** — roles: `ed`, `coordinator`. Effect: sets `movement.gender`,
  appends to `genderChanges`; if a bed is already held, notifies the coordinator to recheck
  placement. Guards: movement exists, open; `gender` in `REFERRAL_GENDERS`; refused if unchanged.
  Case at `:2568`.

### 2.8 Inbox, notices, handover, broadcast, uploads (10)

- **`MARK_NOTICE_READ`** — roles: `coordinator`, `ed`, `ward`, `officer`, `community`. Effect:
  sets `notice.readAt`/`readBy`. Guards: notice exists; caller's role/`actingPlaceId` must exactly
  match the notice's addressee; refused if already read (not idempotent). Case at `:7875`.
- **`ACKNOWLEDGE_INBOX_ITEM`** — roles: `coordinator`. Effect: appends `{at, by}` to
  `inboxAcknowledgements[inboxItemId]`; touches only that map. Guards: `inboxItemId` non-blank,
  its prefix matches a real `INBOX_CATEGORIES` entry naming an existing movement. Case at
  `:7903`.
- **`COMPLETE_INBOX_ITEM`** — roles: `coordinator`. Effect: appends `"completed"` to
  `inboxCompletions[inboxItemId]`. Guards: row's classified kind must be `"commitment"` (a `"fact"`
  row or unclassified id is refused — nothing can silence a live legal/clinical fact); not already
  complete. Case at `:7940`.
- **`REOPEN_INBOX_ITEM`** — roles: `coordinator`. Effect: appends `"reopened"` (never deletes the
  prior completion entry). Guards: row must currently be `"complete"`. Case at `:7994`.
- **`UPLOAD_PATIENT_FORM`** — roles: `coordinator`, `ed`, `ward`, `community`, `officer`. Effect:
  appends a form record to `movement.uploadedForms`. Guards: movement exists;
  `formName`/`fileName` non-empty strings; `sizeBytes` a positive safe integer. Case at `:8161`.
- **`RECORD_HANDOVER_SIGN_OFF`** — roles: `coordinator`, `ward`. Effect: appends `{at, by}` to
  `handoverSignOffs`; always accepted, no rejection path — role and time only, never a note or
  name. Case at `:8535`.
- **`RECORD_CLINICAL_CONTACT`** — roles: `community`, `coordinator`, `ed`. Effect: appends
  `{teamId, at, by}` to `clinicalContacts`. Guards: `teamId` must resolve to a real community
  team. Case at `:8651`.
- **`DISPATCH_BROADCAST_ALERT`** — roles: `coordinator`, `bed_manager`, `executive`. Effect:
  creates a new `BroadcastAlert` (`status: "active"`), prepends it to `broadcastAlerts`. Guards:
  `title`/`message` non-blank. Case at `:8663`.
- **`ACKNOWLEDGE_BROADCAST_ALERT`** — roles: `coordinator`, `ward`, `ed`, `officer`, `community`,
  `bed_manager`, `executive`. Effect: adds `event.unitId` to the alert's `acknowledgedUnits`.
  Guards: alert exists; no-op if that unit already acknowledged. Case at `:8696`.
- **`STAND_DOWN_BROADCAST_ALERT`** — roles: `coordinator`, `bed_manager`, `executive`. Effect:
  sets `status: "stood_down"`, records `stoodDownAt`/`By`. Guards: alert exists. Case at `:8716`
  (the last case in the switch; file ends at `:8741`).

### 2.9 World and admin (4)

- **`ADVANCE_CLOCK`** — roles: `demo`. Effect: adds `event.minutes` to
  `state.clockOffsetMinutes`. Guards: none. Case at `:1855`.
- **`RESET_SCENARIO`** — roles: `demo`. Effect: re-seeds the entire `WardFlowState` from the
  fixture, anchored to the current `now`. Guards: none. Case at `:1835`.
- **`SET_SCENARIO`** — roles: `demo`. Effect: re-seeds with a chosen scenario, same anchoring.
  Guards: `scenario` must be a member of `WARD_SCENARIOS`. Case at `:1838`.
- **`SET_CONFIGURATION`** — roles: `coordinator`. Effect: replaces `state.configuration`
  wholesale. Guards: `validateConfiguration(event.payload)` must succeed; invalid payload refused
  whole, never applied field by field. Case at `:1862`.

---

## 3. State shape (`WardFlowState`, `ward-flow-reducer.ts:284`)

Extends `WardAuditState` (`ward-audit.ts:76`: `worldGeneration`, `auditEvents`, `auditReviews`,
`auditSequence`, `auditReviewSequence`, `auditCaptureStartedAt`), plus:

- `dischargeRevisions: Record<string, number>` — optimistic-concurrency counter per admission id.
- `movements: Movement[]`, `units: Unit[]`, `referrals: Referral[]`, `patients: Patient[]`,
  `admissions: Admission[]`, `bedReleases: BedRelease[]`, `leaveBeds: LeaveBed[]`, `notices:
Notice[]` — the main record collections.
- `rejections: Rejection[]` — refused transitions, newest first.
- `clockOffsetMinutes: number` — the demo jump-forward control; `now` is `NOW_ANCHOR + elapsed +`
  this, computed outside the reducer.
- `referralSequence`, `leaveBedSequence`, `frontDoorReferralSequence`, `patientSequence`,
  `admissionSequence: number` — five independent monotonic id counters, each only ever increasing
  and never derived from the corresponding array's length (a length-derived id would repeat once
  an array shrinks, e.g. `END_LEAVE_BED` removing entries — the exact collision `leaveBedSequence`
  exists to prevent).
- `scenario: WardScenario` — which synthetic night is seeded.
- `refreshRequests`, `morningRollupConfirmations` — capacity-refresh and morning-rollup records.
- `configuration: WardConfiguration` — the coordinator-tunable figures.
- `repatriations: RepatriationRecord[]`, `handoverSignOffs: HandoverSignOffRecord[]`,
  `clinicalContacts: ClinicalContactRecord[]` — phone-log style records; role and time only for
  the latter two, never a note or name.
- `broadcastAlerts: BroadcastAlert[]`, `broadcastSequence: number`.
- `inboxAcknowledgements`, `inboxCompletions: Record<string, ...[]>` — append-only histories keyed
  by `InboxItem.id`; completion state is derived from the _last_ entry, never a stored boolean
  (`inboxItemCompletionState`, `:532`).

## 4. Entity types (`ward-model.ts` unless noted)

- **`Movement`** (`:1176`) — the widest type (~50 fields). One patient's journey to a bed.
  Key fields: `id`, `originEdId` (required — every movement is sent from an ED, never a
  community origin, whoever raises it), `stage: MovementStage`, `referralId?`, `acceptedUnitId?`,
  `admissionId?`, `legalStatus`/`legalForm?`, `gender?` (a separate, wider fact than `sex`),
  `flaggedUrgent`/`urgentFlag?`, `transport?: TransportJob`, `blocker: string` (free prose,
  restated by the reducer at defined transition points — `STAGE_TRANSITION_BLOCKERS`,
  `:210`), `closure?: MovementClosure` (terminal), `referredUnitIds`/`declines`/`overrides`/
  `withdrawnReferrals`/`stageChanges`/`unwinds` (append-only history arrays).
- **`Referral`** (`:2476`) — the front-door request, which precedes a `Movement`. Key fields:
  `id`, `destinations: ReferralAddressing[]` (each with its own `state`), `homeRegion`, `suburb`,
  `source: ReferralSource`, `history: string` (the one genuine free-text field — never persisted
  once typed, see §5), `sendingTeamName?`, `corrections?`.
- **`ReferralAddressing`** (`:2244`) — one destination's answer: `destination`, `state`,
  `decidedAt?`/`decidedBy?`, `declineReason?`, `withdrawnAt?`.
- **`ReferralDestination`** (`:2086`) — a discriminated union on `kind`:
  `"psychiatric_ward"` (`sex`, `secureBedNeeded`, `involuntaryBedNeeded`,
  `highAcuityNursingNeeded`), `"emergency_department"` (`edId`, `purpose`), `"community_team"`
  (`teamName`).
- **`Patient`** (`ward-patients.ts`) — a person, independent of any journey; exists before any
  referral and outlives every admission (owner ruling PD-1).
- **`Admission`** (`ward-admissions.ts`) — a person in a bed. Its `referralId` is seed-authored
  and not validated by any reducer path (noted defect class).
- **`Unit`** (`:530`) — a ward. Key fields: `beds`, `lockedBeds`, `empty: CapacityFigure`,
  `allocatable: CapacityFigure` (with `revision` for optimistic concurrency), `sexMix`,
  `speciallingCapacity`/`highAcuityCapacity`, `authorised` (involuntary), `forensic`,
  `intakeConstraints?`. Occupancy is always derived from admissions, never stored directly.
- **`Site`** (`:669`) — a hospital: `code`, `emergencyDepartment?`, `units: Unit[]`.
- **`TransportJob`** (`:841`) — `provider`, `escortRequired`, `bookedBy?: {role, unitId?,
placeId?}`, `cadNumber?`, `estimatedAt?`, `acceptedAt?`/`enRouteAt?`/`collectedAt?`/
  `arrivedAt?`/`cancelledAt?`/`stoppedAt?`, `diversion?: {at, by, place, reason}`.
- **`LegalForm`** (`:384`) — `code`, `kind?` (no longer gates whether `dueAt` can be captured —
  any selected code may carry a clinician-typed expiry as of 2026-09-17), `dueAt?`. Deliberately
  has no `label` (resolved at render time from a separate register) and no derived deadline —
  every `dueAt` on this model is typed by a person, never computed from a statutory duration.
- **`Decline`** (`:694`) — `unitId`, `at`, `reason: DeclineReason`.
- **`Override`** (`:718`) — `at`, `by`, `reason: OverrideReason`, `unitIds`, `numConsulted?`,
  `gate?` (which eligibility gate was overridden).
- **`GenderPlacement`** (`:784`) — `at`, `by`, `unitIds`, `reason`, `wardChecked: true`.
- **`BedRelease`** (`:1719`) — `id`, `unitId`, `state: BedReleaseState`, `expectedAt`,
  `waitingOn`, `blocker`, `preparing`, `confirmedAt`/`By`.
- **`LeaveBed`** (`:1796`) — `id`, `unitId`, `expectedReturn`, `kind?`
  (`"off_ward" | "medical_trip"`), `openWarningAt?`.
- **`Notice`** (`:2998`) — `id`, `raisedAt`, `to: Addressee`, `about: {movementId?, referralId?,
patientId?, unitId?}`, `kind: NoticeKind`, `sentence: string`, `readAt?`/`readBy?` (nothing in
  the codebase currently writes `readAt` — no read affordance was ever built).
- **`MovementClosure`** (`:995`) — `at`, `outcome: "arrived" | "did_not_proceed"`, `reason`.

## 5. Persistence and the clock

- **Storage key**: `sessionStorage["ward-flow-demo-state-v1"]` (`WARD_FLOW_DEMO_STORAGE_KEY`,
  `ward-flow-provider.tsx:170`) — session, not local, storage.
- **Payload version 4** (`WARD_FLOW_DEMO_STORAGE_VERSION`, `:188`) — travels _inside_ the payload
  (not only the key's `-v1` suffix, which nothing reads back), so a shape change discards an
  old-shaped save rather than trusting it. v4 (2026-09-17) dropped `anchorOffsetMinutes` entirely
  and started validating `state.configuration` on restore.
- **Discard rules** (`tryReadDemoState`, `:306`) — a saved payload is discarded (never repaired,
  never partially trusted) on: failed JSON parse; failed `isValidStoredWardFlowState` (structural
  validator, `ward-flow-storage-validation.ts`); version mismatch; `dayZero` mismatch (a
  different calendar day); `worldGeneration` mismatch between the payload's own field and
  `state.worldGeneration`; `savedAtAbsolute` after the current mount (a save from the future);
  `now` before `NOW_ANCHOR + clockOffsetMinutes`; or any audit event timestamped after the saved
  `now`.
- **Update, 25 Sept 2026 (Josh, D-18; commit c6c8590c92):** a refused action no longer locks saving.
  Refusals keep saving; only a typed-text event stops it. The rejection clauses below predate D-18.
- **Privacy lock** (`trackWardFlowTypedTextDispatch`, `:285`) — default-deny, locked on
  _dispatch_, not acceptance: the moment this session dispatches any event whose type is **not**
  on `WARD_FLOW_TEXT_SAFE_EVENT_TYPES` (`ward-flow-persistence-classification.ts`), or any
  dispatch grows `state.rejections` at all (a refusal can echo a caller-supplied string, e.g. an
  invalid id, straight into `Rejection.reason`), `sessionStorage` is cleared and never written to
  again for the rest of that world. Only a genuine reseed (`RESET_SCENARIO`/`SET_SCENARIO`, the
  only two writers of `worldGeneration`) clears the lock. 12 event types carry genuine typed
  prose and are on the typed-text list (`ADD_PATIENT`, `RECEIVE_REFERRAL`,
  `RECORD_MOVEMENT_BLOCKER`, `REFER_TO_COMMUNITY_TEAM`, `RECORD_ESCALATION`,
  `ADD_REFERRAL_CORRECTION`, `BOOK_TRANSPORT`, `RECORD_REPATRIATION`, `SET_ARRIVAL_DETAILS`,
  `UPLOAD_PATIENT_FORM`, `SEND_WARD_BUZZ`, `DISPATCH_BROADCAST_ALERT`); the other 85 are on the
  reviewed safe list.
- **The clock** (`ward-clock.ts`, `ward-flow-provider.tsx`) — `Instant` is minutes since day-0
  midnight, never a time of day. The seed is authored against `NOW_ANCHOR` (10:42) so all ~53 test
  files stay deterministic; the live provider re-anchors the whole seeded world onto real
  wall-clock time exactly once at mount (`seedWardFlowStateAt`, via `shiftInstants` in
  `ward-reanchor.ts`), then only moves forward through a 30-second tick plus
  `state.clockOffsetMinutes`, which only `ADVANCE_CLOCK` (role `demo`) can change. Tests that pin
  `initialNow` never touch the wall clock at all.

## 6. How to add a new event safely

Observed by cross-referencing how every existing event is wired across the four files plus the
tests that fail if a step is skipped:

1. **Add the variant to `WardFlowEvent`** in `ward-flow-events.ts` (`type`, `role: WardFlowRole`,
   `now: Instant`, plus its own fields — prefer closed-union fields over bare `string` wherever
   the value comes from a fixed list).
2. **Add an `EVENT_ROLE` entry** in the same file — `Record<WardFlowEvent["type"], readonly
WardFlowRole[]>` is exhaustive by type, so `tsc` refuses to compile a missing entry.
   `tests/ward-event-permissions.test.ts` separately pins the _exact_ role list by hand
   (comparing against a hard-coded expectation, not against `EVENT_ROLE` itself) — a widened role
   list must be a deliberate edit to that test, not a side effect nobody reviewed.
3. **Add the `case "TYPE":`** in `reduceClinicalEvent`'s switch (`ward-flow-reducer.ts:1745`
   onward) — the role check has already run by the time the case body executes; write only the
   domain guards and the state update. Use the existing `find*`/`replace*` helpers rather than
   indexing arrays directly.
4. **Classify it for persistence** in `ward-flow-persistence-classification.ts` — add the type
   name to exactly one of `WARD_FLOW_TEXT_SAFE_EVENT_TYPE_TUPLE` or
   `WARD_FLOW_TYPED_TEXT_EVENT_TYPES`. `tests/ward-flow-provider-persistence-privacy.dom.test.tsx`
   fails the build if a type lands on neither list (or both). If it is safe-listed but carries any
   `string`/`unknown`-typed field, add that field name to the reviewed
   `WardFlowReviewedStringOrUnknownKey` union or `tsc` itself refuses to compile
   (`_AssertNoUnreviewedSafeEventPayloadFields`); `tests/ward-flow-provider-safe-payload-shape-
guard.test.ts` is what proves that check can actually fail.
5. **If the event introduces a new `Instant`-typed field** anywhere in `ward-model.ts` or
   `ward-admissions.ts`, add its name to `INSTANT_FIELDS` in `ward-reanchor.ts` —
   `tests/ward-reanchor.test.ts` scans both source files and fails the build on an unlisted
   `Instant` field (this guard used to scan only `ward-model.ts` and silently missed six of
   `Admission`'s seven instant fields for months — see §7).
6. **If the event closes a movement, releases a bed, or affects persisted state shape**, extend
   `isValidStoredWardFlowState` (`ward-flow-storage-validation.ts`) if a genuinely new record
   shape is introduced; existing field additions to `Movement`/`Referral`/etc. are usually covered
   by the generic `nested()` walk already.
7. **Write the reducer test** — `tests/ward-flow-reducer.test.ts` and/or a dedicated
   `tests/ward-<feature>.test.ts` exercising accept/refuse paths; `docs/ward-flow/RULES.md` /
   `tests/ward-expected-reds.json` are unrelated to this and should not need touching for a new
   event on its own.

## Pitfalls in this area

- **The reducer's guard order is load-bearing, not stylistic.** `eligibilityRefusal`'s early
  `return null` on a supplied `overrideReason` skips the SUITABILITY_GATES verdict entirely; it is
  only safe because `PULL_PATIENT` checks the physical facts (bed/specialling/high-acuity
  capacity) itself, _before_ calling it. Refactoring those two checks into the eligibility verdict
  "for tidiness" would silently let a typed override reason create a bed out of nothing
  (`ward-flow-reducer.ts:1016`–`1041`, guarded by
  `tests/ward-physical-facts-are-not-overridable.test.ts`).
- **`INSTANT_FIELDS` must be kept in step with two files, not one.** `tests/ward-reanchor.test.ts`
  historically scanned only `ward-model.ts`; `Admission` lives in `ward-admissions.ts`, which
  `ward-model.ts` does not import, so six of seven `Instant` fields on `Admission` sat unshifted
  for months while the guard stayed green (`ward-reanchor.ts:37`–`54`).
- **The privacy lock fires on _dispatch_, not acceptance.** A refused `SET_CONFIGURATION` (or any
  other event) can still echo a raw supplied value into `Rejection.reason`
  (`` `no movement found for id ${event.movementId}` ``), and `state.rejections` persists like
  everything else. The lock therefore also fires whenever `rejections.length` grows at all,
  regardless of which list the event type is on (`ward-flow-provider.tsx:239`–`295`).
  Confirmed against the reducer, not assumed from the safe-list comment (which used to claim
  otherwise and was wrong).
- **`Movement.blocker` and `BedRelease.blocker` are two different fields with the same name** —
  one is free prose the reducer restates at fixed transitions
  (`STAGE_TRANSITION_BLOCKERS`, `ward-flow-reducer.ts:210`), the other is a closed enum
  (`BedReleaseBlocker`) written only by `BLOCK_BED_RELEASE`/`CLEAR_BED_RELEASE_BLOCK`. Do not
  conflate them when reading or writing either.
- **`STEP_BACK_STAGE` does not release a held bed.** It only rewinds `movement.stage`; a movement
  stepped back from `pulled` still holds the phantom admission and consumes ward capacity until a
  separate release event runs. The same asymmetry applies to `WITHDRAW_ACCEPTANCE`, which refuses
  outright if a bed is still held rather than releasing it implicitly.
- **`Referral.history` is the one genuine free-text field on a `Referral`**, and it (along with 11
  other event types' typed fields) never reaches `sessionStorage` once typed in a session — do
  not assume a restored session's referral history is the same object identity, or that a typed
  correction/escalation/broadcast survives a reload.
- **`ward-teams.ts` has no code importers** (per the overview map, re-checked there, not
  re-verified in this pass) — superseded by the site/team join; do not delete without the owner
  (protected path).
- **`RECORD_COUNTRY_EXTENSION` is a dead-looking but _intentional_ no-op event** — its case
  unconditionally refuses, existing only to redirect callers to `RECORD_LEGAL_FORM_EXPIRY`. Do not
  "fix" it by implementing the extension logic without checking
  `docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md` first — the owner's ruling was
  that this prototype computes no legal time limits of its own.
- **Three engine files are the only ones with outside imports** at all
  (`@/lib/client-store-factory`, `@/lib/form-register`, `@/components/ui/sheet-focus`) — per the
  overview map. The engine otherwise only imports from itself, so a change here has an unusually
  contained blast radius compared to the screens.

## Not checked

No test, build, lint, or browser run. Field-by-field correctness of every guard in every one of
the 97 cases was not independently re-verified against the underlying test suite (`tests/ward-*`)
— the guard descriptions above are read directly from the reducer's own code, not from test
expectations, and a guard's _presence_ in code is not proof it is currently reachable or correct
per the outstanding-defects list in the overview map (§9.2 there: locked-bed count drift, invented
admissions on arrival, mismatched secure-bed rules between referral and movement, and others).
`ward-movements.ts` (seed fixtures), `ward-derivations.ts` (the 53 pure selectors), and the
smaller domain-rule files (`ward-eligibility.ts`, `ward-referrals.ts`, `ward-legal-clock.ts`, etc.)
are out of scope for this document and are covered elsewhere in the code map.

Shared data-mode update, 8 October 2026: the PostgreSQL migration runner now applies version 2, recording immutable workspace provenance and matching command/audit modes. `ward-shared-client.ts` rejects snapshots without prototype provenance; `ward-shared-access.tsx` and its CSS module show the persistent mode and an unavailable-live explanation without changing the connection or discarding drafts. A separately commissioned live adapter remains required; the current server and setup reject live configuration.
