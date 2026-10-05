# Screens A: coordinator, ED, ward, referrals, community, search, statistics

## WA remediation update — 3 October 2026

The discharge Dossier mounts `DischargeCareJourney` beside `DischargeFollowUp`. Its forms record attributed planning/document milestones, named synthetic responsibility and appointments, contact outcomes, coding handoff, episode changes, transport assessment, transfer handshake and checked legal-paper facts. Community uses `CommunityFollowUp` with its own scoped actor and explicit referral link; filters distinguish missing arrangements from missing current-appointment contact. `MovementWorkflowActions` exposes expectation, lateness/leave reviews, mismatch, ward request, release/reopen and typed legal expiry controls. The officer footer now receives its existing print-hide CSS class.

The detailed map below retains its earlier line numbers and baseline counts; this update supersedes conflicting pathway claims.

## WA pathway audit update — 3 October 2026

The ward route accepts only `tab=departure-planning` to open the existing Decisions tab; other query values retain the normal starting tab. The coordinator discharge board's planning link uses this route. Community departure lists remain independent of follow-up arrangement state and do not imply contact completion; their comments now acknowledge the board's arrangement writer. See the [WA report](../reports/wa-health-pathway-audit-2026-10-03.md).

Read-only map, written 25 September 2026 against tip `ace8e9ee8d` on branch
`ward/extend-ward-flow-code-map` (`D:/Worktrees/Database/ward-code-map`). Covers every tracked file
in `src/components/ward-management/{coordinator,ed,ward,referrals,community,search,statistics}/`.
Line counts are `wc -l` on each file, run 25 September 2026. Route and importer facts are from
`grep`/`git ls-files` on the same tree; test-file counts are files under `tests/` whose text
contains the folder's import path, so a test importing two folders in this part is counted in both.
Nothing was run — no test, build, lint, dev server or provider call. This file only describes
`.ts`/`.tsx`/`.module.css` files that exist on disk; it does not judge whether the screens are
correct (see `docs/ward-flow/STATUS.md` and the audits it points to for that).

Back to [the code map index](README.md).

---

## `coordinator/` — 9 files, 9,518 lines

- **Route:** `/` (`src/app/mockups/ward-flow/page.tsx` imports `CoordinatorScreen`).
- **Mockup:** `command-third-edition.html` (SCREEN-MAP.md row for `coordinator/`).
- **Reducer events dispatched:** `CANCEL_TRANSPORT`, `CHANGE_LEGAL_STATUS`, `CHANGE_URGENCY`,
  `RECORD_ESCALATION`, `REFER_TO_UNITS`, `RELEASE_PULL`, `WITHDRAW_WARD_REQUEST` (7 types, 9
  `dispatch(` call sites, all in `shortlist-panel.tsx`).
- **Main derivations/selectors read:** `ward-derivations.ts` (`allDeclines`, `allOverrides`,
  `buildActionInbox`, `isOpen`, `elapsedLabel`), `ward-priority.ts` (`queueOrder`,
  `operationalScore`), `ward-referrals.ts` (`referralQueueOrder`), `ward-bed-availability.ts`,
  `ward-pressure.ts` (`edPressure`), `ward-eligibility.ts`. Also reaches into `delays/` (see
  pitfalls) and `ed/ed-home-derivations.ts` (`edOpenSummaries`, for the pressure strip).
- **Tests:** 31 files under `tests/` reference this folder, including
  `ward-coordinator-screen.dom.test.tsx`, `ward-shortlist.dom.test.tsx` and four more
  shortlist-specific specs, `pressure-strip.dom.test.tsx`, `ward-flow-diagram-scroll-notice.dom.test.tsx`,
  `ward-flow-diagram-status-truthfulness.test.ts`, `ward-override-register-render.dom.test.tsx`,
  `ward-registers-drawer.dom.test.tsx`, `ward-nav.test.ts`, `ward-no-dead-ends.dom.test.tsx`.

### Files

- **`coordinator-screen.tsx`** (591 lines) — `CoordinatorScreen`, the `/` route component. Lays out
  the pressure strip, priority queue, flow diagram and exception drawer, and imports
  `answerSilenceReminder` from the `delays/` folder (screens B) to decide when to show a "why is
  nothing moving" notice.
- **`coordinator.module.css`** (3,933 lines) — the shared stylesheet for the whole folder; every
  other component here imports it alongside its own smaller module.
- **`exception-drawer.tsx`** (457 lines) — `ExceptionDrawer`, the coordinator's declines/overrides
  side panel. Wraps the root-level `DeclineRegister` and `OverrideRegister` components.
- **`flow-diagram.module.css`** (336 lines) — styles for `FlowDiagram` only.
- **`flow-diagram.tsx`** (741 lines) — exports `hubStatusText` (a pure label function, line 114) and
  `FlowDiagram` (line 207), the live bed-pipeline diagram (referred → accepted → placed) with hub
  status text per unit.
- **`pressure-strip.tsx`** (247 lines) — `PressureStrip`, the horizontal ED-pressure scroller at the
  top of the coordinator screen; reads `ed/ed-home-derivations.ts` directly rather than through a
  coordinator-local selector.
- **`priority-queue.tsx`** (436 lines) — `PriorityQueue`, the ranked movement list using
  `ward-priority.ts`'s `operationalScore`.
- **`shortlist-panel.module.css`** (684 lines) — styles for `shortlist-panel.tsx` and reused by
  three sibling files (`coordinator-screen.tsx`, `exception-drawer.tsx`, `priority-queue.tsx`).
- **`shortlist-panel.tsx`** (2,093 lines) — the largest file in the folder and the folder's only
  dispatch source. Exports `ReferralPlacementPanel` (line 283) and `ShortlistPanel` (line 357, runs
  to end of file). Internal helpers: `capacityLine` (215), `legalFormLine` (252), `Fact` (327).
  `ShortlistPanel`'s own event handlers: `toggleReferTarget` (682), `handleRefer` (698),
  `submitGenderPlacement` (712), `submitWithdrawWardRequest` (740), `handleOverrideSubmit` (755),
  `submitEscalation` (796), `submitUrgencyChange` (817), `submitLegalStatusChange` (837),
  `submitReleasePull` (859), `submitCancelTransport` (873). Every dispatch in the folder originates
  here.

## `ed/` — 7 files, 10,366 lines

**ED psychiatry implementation update — 5 October 2026:** The routed `EdScreen` now composes
`ed-overview.tsx` (department header, source-derived figures and horizontal ED browser) and
`ed-board-controls.tsx` (plan labels, presentation editor and grouped clinical action menu), each
with its own CSS module. Referral intake opens from the header; existing clinical handlers and
refusal gates remain in `ed-screen.tsx`. The patient board has nine columns, patient/UMRN search
and sorting, compact form/clearance drafts and a native modal record. Presentation, plan, review,
form and clearance table edits are screen-only drafts: they do not persist or alter recorded
clinical worklists, figures or engine records. The ED bay retains the existing synthetic display
derivation; it is not a newly recorded bed assignment. `ward-ed-polished.dom.test.tsx` covers plan
selection and draft isolation. The historical file totals and outline below retain their dated
baseline.

- **Route:** `/ed/[edId]` (`src/app/mockups/ward-flow/ed/[edId]/page.tsx` imports `EdScreen`).
- **Mockup:** `emergency-department-third-edition.html` (SCREEN-MAP.md row for `ed/`).
- **Reducer events dispatched:** `BOOK_TRANSPORT`, `CHANGE_LEGAL_STATUS`, `CHANGE_URGENCY`,
  `CORRECT_LEGAL_FORM_RECEIPT`, `DECLINE_REFERRAL`, `HANDOVER_READY`, `RAISE_REFERRAL`,
  `RECORD_ARRIVED_IN_DEPARTMENT`, `RECORD_ED_OUTCOME`, `RECORD_EXAMINATION`,
  `RECORD_LEFT_DEPARTMENT`, `RECORD_LEGAL_FORM_EXPIRY`, `RECORD_LEGAL_FORM_RECEIVED`,
  `RECORD_MEDICAL_CLEARANCE`, `RECORD_MOVEMENT_GENDER`, `RECORD_NO_REFERRAL`,
  `RECORD_TRANSPORT_NEED`, `REFER_TO_COMMUNITY_TEAM`, `RELEASE_DIVERTED_BED`,
  `WITHDRAW_REFERRAL` (20 types, 23 `dispatch(` call sites, all in `ed-screen.tsx`).
- **Main derivations/selectors read:** `ward-derivations.ts`, `ward-referrals.ts`,
  `ward-priority.ts`, `ward-bed-availability.ts` (`bedsPendingPreparation`),
  `ward-bed-designation.ts` (`designationSummary`), `ward-legal-forms.ts`,
  `ward-patient-resolver.ts`, `ward-diagnosis.ts`, `ward-change-reasons.ts`.
- **Tests:** 38 files, including `ward-ed-screen.dom.test.tsx` and about 20 further
  `ward-ed-*.dom.test.tsx` files each covering one control (due-at field/parsing, form expiry,
  legal clock, outcome controls, transport booking, withdraw referral, no-referral-raised,
  no-transport-needed, answered cap, access target configuration, CSS class existence), plus
  `ward-ed-home-derivations.test.ts`, `ward-ed-home.dom.test.tsx`, `ward-ed-service-bands.dom.test.tsx`,
  `ward-catchment.test.ts`, `ward-component-reachability.test.ts`, `ward-nav.test.ts`,
  `ward-no-dead-ends.dom.test.tsx`, `ward-retired-suite-integrity.test.ts`.

### Files

- **`ed-home-derivations.ts`** (248 lines) — pure ED-summary functions: `isDetainedUnderTheAct`,
  `elapsedOpenMinutes`, `edOpenSummaries`, `edHomeSummaries`, `edHomeTotals`, `worstEdSummary`,
  `groupByHealthService`, `ofPopulation`. **Not itself unreachable** — `coordinator/pressure-strip.tsx`
  imports `edOpenSummaries` directly, so this file stays live even though its sibling component
  (`ed-home.tsx`) is not.
- **`ed-home.module.css`** (122 lines) — styles only `ed-home.tsx`; dead weight while that component
  is unreachable.
- **`ed-home.tsx`** (220 lines) — `EdHome`. 🔴 **Unreachable on purpose.** Its own header comment
  states `/ed/[edId]` renders `EdScreen` instead (owner ruling 2026-09-06); its retired test
  (`ward-ed-home.dom.test.tsx`) is `describe.skip`. Guarded by
  `tests/ward-component-reachability.test.ts` and `tests/ward-retired-suite-integrity.test.ts`. Do
  not delete without the owner (protected path).
- **`ed-screen.tsx`** (5,810 lines) — **the largest file in Ward Flow.** `EdScreen` (from line 1,139
  to end of file) is the entire routed ED board: referral intake, legal forms, medical clearance,
  transport booking, outcomes. See outline below.
- **`ed-service-bands.module.css`** (85 lines) — styles only `ed-service-bands.tsx`.
- **`ed-service-bands.tsx`** (131 lines) — `EdServiceBands`. 🔴 **Unreachable**, and doubly so: its
  own comment says it is "reached only from ed-home, itself unreachable."
- **`ed.module.css`** (3,750 lines) — the stylesheet for `ed-screen.tsx`.

**`ed-screen.tsx` outline** (5,810 lines; `EdScreen` alone is ~4,670 lines):

- Module-level pure helpers (139–1,111): `asLineHeading`, `urgencyGlyph`, `edReferralClockLines`
  (exported, 171), `declineReasonBlockedReason`, `answeredAddressingLabel`,
  `minutesFromTimeInput`/`instantFromDateAndTimeInputs`/`instantFromEstimatedTimeInputs`,
  `referralDraftBlockedReason`, `examinationBlockedReason`, `communityReferralBlockedReason`,
  `isEdInitiatedWithdrawal`, `edOutcomeBlockedReason`, `dischargeChoiceBlockedReason`,
  `handoverBlockedReason`, `bookTransportBlockedReason`, `transportLegalFormNotice`,
  `withdrawReferralBlockedReason`, `transportAnswersBlockedReason`, `outstandingItem` (exported,
  967), `formExpiryLine`/`formExpiryWarning`, `patientBay`, `accessTargetLine`,
  `movementMedicalClearance`, `referralWardGender`.
- `EdScreen` (1,139–5,810): dialog/keyboard handlers `closeTransportDialog` (1,241),
  `handleTransportDialogKeyDown` (1,251), `onDepartmentListKeyDown` (1,384); form submit handlers
  from 2,017 on — `submitReferral`, `toggleExamination`/`submitExamination`,
  `toggleUrgencyChange`/`submitUrgencyChange`, `toggleLegalStatusChange`/`submitLegalStatusChange`,
  `toggleWithdrawReferral`/`confirmWithdrawReferral`, `toggleLegalFormExpiry`/`submitLegalFormExpiry`,
  `toggleReceiptCorrection`/`submitReceiptCorrection`, `toggleBookTransport`,
  `toggleDecline`/`submitDecline`, `submitBookTransport` (2,239). The remaining ~3,500 lines
  (2,300–5,810) are the render body: department list, per-movement cards, and every dialog's JSX.

## `ward/` — 8 files, 13,751 lines

- **Routes:** `/ward/[unitId]` and `/ward/[unitId]/answer` (both import `WardScreen` from
  `ward-screen.tsx`; the `presentation` prop, not a different component, picks the two
  presentations — `ward-answer-view.tsx` is a separate component used elsewhere, see below).
- **Mockups:** `ward-third-edition.html` and `ward-answer-third-edition.html` (SCREEN-MAP.md rows
  for `ward/`).
- **Reducer events dispatched:** `ACCEPT_IN_PRINCIPLE`, `BLOCK_BED_RELEASE`,
  `CLEAR_BED_RELEASE_BLOCK`, `CONFIRM_BED_RELEASE`, `CONFIRM_CAPACITY`, `CONFIRM_MORNING_ROLLUP`,
  `DECLINE`, `END_LEAVE_BED`, `FLAG_BED_RELEASE`, `MARK_NOTICE_READ`, `PATIENT_ARRIVED`,
  `PULL_PATIENT`, `RECEIVE_REFERRAL`, `RECORD_LEAVE_BED`, `RECORD_WARD_INTAKE_CONSTRAINTS`,
  `RELEASE_BED`, `RELEASE_DIVERTED_BED`, `RELEASE_PULL`, `REVERT_BED_RELEASE`,
  `SET_BED_PREPARATION` (20 types, 29 `dispatch(` sites — the most of any screen folder, matching
  the overview map's count), all in `ward-screen.tsx`.
- **Main derivations/selectors read:** `ward-eligibility.ts`, `ward-derivations.ts`,
  `ward-bed-availability.ts`, `ward-change-reasons.ts`, `ward-catchment.ts` (via
  `suburb-team-panel.tsx`), `ward-admissions.ts`, `ward-patient-resolver.ts`, `ward-freshness.ts`,
  `ward-flow-reducer.ts` (imported directly — see pitfalls).
- **Tests:** 36 files, including `ward-screen.dom.test.tsx` and about 15 further
  `ward-screen-*.dom.test.tsx` files (capacity wording, eligibility warning, fd23-leaks, gender
  designation privacy, handover link, landmark names, morning rollup, overview-and-entry, refusal
  surface, third-edition headings, service sentence, cancel-unavailable), `ward-bed-release.dom.test.tsx`,
  `ward-release-day.test.ts` / `ward-release-day-chooser.dom.test.tsx`,
  `ward-notification-center.dom.test.tsx`, `ward-suburb-team-panel.dom.test.tsx`,
  `ward-override-control.dom.test.tsx`, `ward-answer-current-facts.dom.test.tsx`,
  `ward-drawing-match-r2-12.test.ts`.

### Files

- **`release-day.ts`** (64 lines) — `ReleaseDay` ("today"/"tomorrow"), `parseReleaseDayInstant`,
  `releaseTimeAlreadyPassed`. Encodes owner answer 32: "tomorrow" means the next calendar day, not
  a rolling 24 hours.
- **`suburb-team-panel.tsx`** (329 lines) — `SuburbTeamPanel`, a catchment-lookup widget
  (`lookupCatchment`) mounted inside `ward-screen.tsx`; has no other importer.
- **`ward-answer-view.module.css`** (1,127 lines) — styles only `ward-answer-view.tsx`.
- **`ward-answer-view.tsx`** (1,090 lines) — `WardAnswerView`, a distinct component from
  `WardScreen`'s "answer" presentation; also has no importer outside this folder (self-contained,
  not wired to a route directly — the `/ward/[unitId]/answer` route uses `WardScreen`'s
  `presentation` prop, not this file; confirm before assuming this component is reachable).
- **`ward-notification-center.module.css`** (467 lines) — styles only `ward-notification-center.tsx`.
- **`ward-notification-center.tsx`** (407 lines) — `WardNotificationCenter` (default-exported too,
  line 407), the notice/buzz panel mounted inside `ward-screen.tsx`.
- **`ward-screen.tsx`** (5,034 lines) — the folder's dispatch source and the routed component for
  both ward URLs. See outline below.
- **`ward.module.css`** (5,233 lines) — the largest stylesheet in Ward Flow; shared by
  `ward-screen.tsx` and `suburb-team-panel.tsx`.

**`ward-screen.tsx` outline** (5,034 lines):

- Module-level helpers (118–271): `referralAnswerBlocked`, `pullBlockedReason`,
  `originPlaceLabel`, `arrivalIsLate`, `wardSafeRejectionReason`.
- `WardScreen` (273) — thin wrapper choosing `presentation`.
- `WardOverviewScreen` (288–5,034) — the real body. Handlers from 413 on: `handleRaiseWardReferral`,
  `handleBedDrawerKeyDown`, `handleCapacityModalKeyDown`, `handleConfirmMorningRollup`,
  `handleAcknowledgeNotice`, `handleDismissBuzz`, `toggleDecline`/`submitDecline`,
  `submitOverride`/`overrideReasonForm`, `submitCapacity`, `confirmEmptyToday`/
  `confirmAllocatableToday`/`confirmBothBedCounts`, `saveConstraints`/`toggleConstraintOption`,
  `submitBedRelease`/`confirmBedRelease`/`revertBedRelease`, `submitBedPreparation`/
  `finishBedPreparation`/`toggleBedPreparation`, `clearBedReleaseBlock`, `releaseBedRelease`,
  `toggleBlockRelease`/`toggleRevertRelease`/`submitBlockRelease`, `submitLeaveBed`/`endLeaveBed`,
  `toggleRelease`/`submitRelease`. The remainder is the render body: bed grid, drawers and forms
  for every one of the 20 dispatched event types.

## `referrals/` — 15 files, 19,776 lines

- **Routes:** `/referrals` (`referral-board.tsx` → `ReferralBoard`) and `/referrals/new`
  (`referral-intake.tsx` → `ReferralIntakeForm`).
- **Mockups:** `referrals-third-edition.html` (`/referrals`) and
  `raise-a-referral-third-edition.html` (`/referrals/new`).
- **Reducer events dispatched:** `ACCEPT_REFERRAL`, `ADD_PATIENT`, `ADD_REFERRAL_CORRECTION`,
  `DECLINE_REFERRAL`, `RECEIVE_REFERRAL`, `RECORD_LOCAL_BED_SOUGHT`,
  `RECORD_MOVEMENT_MEDICAL_CLEARANCE`, `RECORD_REFERRER_WITHDRAWAL`, `SET_ARRIVAL_DETAILS`,
  `UPLOAD_PATIENT_FORM` (10 types, 13 `dispatch(` sites, spread across `referral-intake.tsx`,
  `referral-match.tsx`, `ward-referral-drawer.tsx` and `arrival-time-modal.tsx`).
- **Main derivations/selectors read:** `ward-model.ts` (9 files import it — the heaviest engine
  dependency of any screen folder), `ward-referrals.ts`, `ward-catchment.ts` (via
  `referral-destination-options.ts`), `ward-priority.ts`, `ward-eligibility.ts`,
  `ward-bed-availability.ts`, `ward-patients.ts`.
- **Tests:** 50 files, including about 25 `ward-referral-*` specs (intake sections, sending team,
  match gender placement × 2, match suburb, match hooks-order, match non-ward-decline, destinations,
  duplicate, wait-line, receipt integrity, unsaved-history warning, control labels, decided
  heading, kind-pair-gap, query-prefill, screens), plus `ward-community-*` specs that exercise
  `referral-destination-options.ts` and `referral-duplicate.ts` (community catchment routing shares
  this module), `ward-ed-to-community-referral.test.ts`, `ward-parallel-referral-cap-ui.dom.test.tsx`,
  `ward-device-claim-reason.dom.test.tsx`, `ward-document-metadata.dom.test.tsx`,
  `ward-governance-enumerations.dom.test.tsx`, `ward-facade-agrees-with-screens.test.ts`,
  `ward-owner-decisions-2026-09-16.test.ts`, `ward-referrals-print.test.ts`.

### Files

- **`arrival-time-modal.module.css`** (188 lines) — styles only `arrival-time-modal.tsx`.
- **`arrival-time-modal.tsx`** (226 lines) — `ArrivalTimeModal`, plus pure helpers
  `isArrivalLate`, `arrivalModeLabel`, `arrivalEtaLabel`, `canSetArrivalPlan`. Used from three
  places: `ed-screen.tsx`, `patients/patient-now-screen.tsx` and `ward-referral-drawer.tsx`.
- **`referral-board.tsx`** (1,498 lines) — `ReferralBoard`, the `/referrals` route component;
  exports `getReferralPriority`, `referralPriorityLabel`, `PriorityGlyph` as reusable pieces.
  Mounts `ReferralMatchView` from `referral-match.tsx`.
- **`referral-destination-options.ts`** (504 lines) — `destinationOptions`, `suburbOptions`,
  `communityTeamOptions`, `communityTeamOptionsForSuburb`; the shared catchment-to-destination
  logic used by both intake and community screens.
- **`referral-duplicate.ts`** (140 lines) — `duplicateSentence`: states what referral is already
  open for a patient before a second one is raised (Lane C task 15).
- **`referral-intake-third-edition.module.css`** (2,859 lines) — the third-edition page stylesheet
  for `referral-intake.tsx`, layered on top of the shared `referrals.module.css`.
- **`referral-intake.tsx`** (4,440 lines) — **the largest file in this folder.**
  `ReferralIntakeForm` (from line 1,328) is the `/referrals/new` route component. See outline below.
- **`referral-match.tsx`** (1,532 lines) — `ReferralMatchView`, the per-referral matching panel
  mounted by `referral-board.tsx`. Internal handlers: `handleAddCorrection` (220), `handleAccept`
  (636), `handleLocalBedSought` (664), `handleDecline` (678), `handleCommunityDecline` (704),
  `handleCommunityAccept` (733), `handleEdAccept` (745), `handleCommunityWithdraw` (765).
- **`referral-referrer.ts`** (42 lines) — `referralReferrerName`, `REFERRER_NOT_RECORDED` ("Not
  recorded" — D-12 ruling: never a personal name, never a source type standing in for one).
- **`referral-sending-team.ts`** (60 lines) — `sendingTeamFragment`, `withSendingTeam`. One-place
  rendering rule for a referral's sending team, used at three call sites per its own header note.
- **`referral-wait.ts`** (42 lines) — `referralWaitLine`. Its header warns that a related function,
  `referralWaitLabel` (in `ward-referrals.ts`), keeps counting after triage and should not be used
  for the same purpose — read this file's comment before reusing either.
- **`referrals.module.css`** (4,802 lines) — the shared stylesheet across `referral-board.tsx`,
  `referral-intake.tsx` and `referral-match.tsx`.
- **`upload-forms-modal.tsx`** (281 lines) — `UploadFormsModal`; only imported by
  `patients/patient-now-screen.tsx`, not by anything in this folder.
- **`ward-referral-drawer.module.css`** (1,572 lines) — styles only `ward-referral-drawer.tsx`.
- **`ward-referral-drawer.tsx`** (1,590 lines) — `WardReferralDrawer`, plus `useWardCapacity` and
  the `CAPACITY_RECORDS` fixture. Mounted from `shell/ward-bar.tsx` (the global top-bar search
  drawer), not from a referrals route — this is the referrals folder's one file reached from the
  shell rather than from a page. Internal handlers: `handleToggleMedicalClearance` (494),
  `handleTriageAction` (529), `handleSelectPatient` (583), `toggleRisk` (624), `handleDispatch`
  (748).

**`referral-intake.tsx` outline** (4,440 lines):

- Module-level constants/helpers (183–1,328): `UNANSWERED_VALUE`, `UNANSWERED_OPTION_LABEL`,
  `UNSAVED_HISTORY_WARNING`, `REQUIRED_FIELD_NAMES`, `answeredProgress`, `referralSummaryRows`,
  `HISTORY_FIELDS`, `overLimitFreeTextFields`, `writtenHistoryCount`, `wardAndCommunityBothChosen`.
- `ReferralIntakeForm` (1,328–4,440): `handleSelectPatient` (1,426), `handleUnlinkPatient` (1,438),
  `handleSwitchToLinked` (1,449), `handleSearchKeyDown` (1,457), `performAddPatient` (1,484),
  `handleAddPatientSubmit` (1,504), `handleCopyHandover` (1,597), `toggleDestination` (1,974),
  `handleSubmit` (1,995), `ignoreUnavailableActivation` (2,064). The remaining ~2,300 lines are the
  multi-section form's JSX (patient search/link, destinations, history, review).

## `community/` — 16 files, 12,060 lines

- **Routes:** `/community` (`community-index.tsx` → `CommunityIndex`) and `/community/[teamId]`
  (`community-screen.tsx` → `CommunityScreen`, plus `community-derivations.ts`'s
  `communityTeamById` used directly by the page for the route param).
- **Mockup:** `community-team-third-edition.html` covers `/community/[teamId]`. ⚠️ `/community`
  itself has **no mockup entry** — SCREEN-MAP.md lists it under "ROUTE WITH NO MOCKUP".
- **Reducer events dispatched:** `ACCEPT_REFERRAL`, `BOOK_TRANSPORT`, `CANCEL_TRANSPORT`,
  `DECLINE_REFERRAL`, `MARK_NOTICE_READ`, `RECEIVE_REFERRAL`, `RECORD_CLINICAL_CONTACT` (7 types, 7
  `dispatch(` sites, all in `community-screen.tsx`).
- **Main derivations/selectors read:** `ward-referrals.ts`, `ward-referral-visibility.ts` (role-
  scoped field visibility), `ward-catchment.ts`, `ward-admissions.ts`, `ward-figure.ts`,
  `ward-panel.ts`, `community-derivations.ts` (this folder's own selector module, read by
  `statistics/statistics-community-*` too — see [Screens B](screens-b.md)'s statistics coverage of
  cross-folder use).
- **Tests:** 63 files — the largest test count of any folder in this part — including about 30
  `ward-community-*` specs (index, hub, teams-table, figures, notices, transport, membership
  resolution, collision coverage, ratified aliases × 3, vocabulary, gateway, scope, third-edition
  headings, durations-not-dates, governance claims, near-duplicate warning), plus
  `ward-component-reachability.test.ts`, `ward-seed-referral-census.test.ts`,
  `ward-reference-teams.test.ts`, `ward-place.test.ts`, `ward-handover-filters.test.ts`,
  `ward-legal-figure-guard.test.ts`, `ward-pull-keeps-referral-link.test.ts`,
  `ward-transport-cancel-permission.test.ts`, five `ward-statistics-community-*` specs, and
  `ui-ward-chrome-header.spec.ts` (the one browser spec touching this folder).

### Files

- **`community-derivations.ts`** (437 lines) — `CommunityTeam`, `communityTeamSlug`,
  `COMMUNITY_TEAM_PAGES`, `communityTeamById`, `admissionBelongsToTeam`, `leavingDestinationLabel`,
  `CommunityHubLists`/`communityHubLists`, `admissionsWithNoCommunityTeam`,
  `CommunityMembershipResolution`/`admissionsWithUnresolvableReferral`/
  `communityMembershipResolution`, `isAwaitingTeamAnswer`. The central selector module for this
  folder; also imported by the statistics screens for community folder for team lookups.
- **`community-elapsed.ts`** (39 lines) — `elapsedDaysPhrase`. Owner-approved rule: state elapsed
  time ("left 5 weeks ago"), never a calendar date, so the fixture stays correct as the demo clock
  moves.
- **`community-figures.tsx`** (71 lines) — `CommunityFigures`. 🔴 **Unreachable** — "reached only
  from community-home, itself unreachable" (owner ruling 2026-09-06). Retired test is
  `describe.skip`.
- **`community-home.module.css`** (86 lines) — styles only the unreachable `community-home.tsx`.
- **`community-home.tsx`** (261 lines) — `CommunityHome`. 🔴 **Unreachable** — `/community` renders
  `CommunityIndex` instead (owner ruling 2026-09-06). Guarded by
  `tests/ward-component-reachability.test.ts`.
- **`community-index.module.css`** (1,548 lines) — styles `community-index.tsx`.
- **`community-index.tsx`** (1,037 lines) — `CommunityIndex`, the `/community` route component: the
  team directory.
- **`community-ratified-aliases.ts`** (251 lines) — `RatifiedServiceAlias`,
  `RATIFIED_SERVICE_ALIASES`, `ratifiedAliasesAwaitingOwnerReview`, `ratifiedAliasesFor`,
  `ratifiedSameServiceNames`, `ratifiedAliasesWithNoSuchTeam`, `ratifiedDecisionsOnMovedFigures`.
  Human-ruled "these two names are one service" list, deliberately separate from the similarity
  detector in `community-vocabulary.ts` (its header explains why: similarity is a checkable string
  property, sameness is a clinical claim).
- **`community-screen.tsx`** (4,129 lines) — **the largest file in this folder** and its only
  dispatch source. `CommunityScreen` (444–4,078). See outline below. Also exports
  `AcceptedBeforeAdmission` (type, line 4,078) after the component.
- **`community-team-contact-mapping.ts`** (226 lines) — `CommunityTeamContactMapping`,
  `COMMUNITY_TEAM_CONTACT_MAPPINGS`, `mappedTeamNames`, `contactForTeam`, `contactDecisionFor`,
  `RATIFIED_GROUP_COUNT`. Only imported by `community-screen.tsx`.
- **`community-team-hub.module.css`** (42 lines) — styles only the unreachable
  `community-team-hub.tsx`.
- **`community-team-hub.tsx`** (173 lines) — `CommunityTeamHub`. 🔴 **Unreachable** —
  `/community/[teamId]` renders `CommunityScreen` instead (owner ruling 2026-09-06).
- **`community-teams-table.module.css`** (65 lines) — styles only the unreachable
  `community-teams-table.tsx`.
- **`community-teams-table.tsx`** (140 lines) — `CommunityTeamsTable`, `suburbCountsByTeam`,
  `suburbCountForTeam`, `CommunityTeamRow`. 🔴 **Unreachable** — "reached only from community-home,
  itself unreachable."
- **`community-vocabulary.ts`** (329 lines) — `communityTeamSuburbCounts`, `namesAreNearDuplicates`,
  `CommunityNameCollision`/`communityNameCollisions`, `communityNamesInCollisions`,
  `nearDuplicateSpellingsOf`. Detects near-duplicate team-name spellings (e.g. "Midalnd" vs
  "Midland"); read by `community-index.tsx`, `community-ratified-aliases.ts`,
  `community-screen.tsx` and `statistics/statistics-screen.tsx`.
- **`community.module.css`** (3,226 lines) — the stylesheet for `community-screen.tsx`.

**`community-screen.tsx` outline** (4,129 lines):

- Module-level helpers before the component (150–435): `minutesFromTimeInput`,
  `instantFromEstimatedTimeInputs`, `transportAnswersBlockedReason`, `clinicalContactCanSave`,
  `recordClinicalContact`, `serviceFilterLabel`.
- `CommunityScreen` (444–3,763): handlers `handleToggleTheme`/`handleSetThemeExplicit` (498, 506),
  `handleActionClick` (511), `handleToggleDecline`/`handleConfirmDecline` (546, 558),
  `handleConfirmAccept` (582), `intakeBlockedReason` (592), `submitCommunityFollowUp` (609),
  `handleSaveClinicalContact` (635), `openTransportBook`/`closeTransportBook` (642, 649),
  `openTransportCancel`/`closeTransportCancel` (654, 661), `submitBookTransport` (666),
  `submitCancelTransport` (693), `markTeamNoticeRead` (795).
- Module-level helpers after the component (3,763–4,129): `unitName`, `bedStateLabel`, `stayLabel`,
  `expectedBackLabel`, `departureLabel`, `otherDepartureDestinations`, `referralOriginLabel`,
  `communityAddressingFor`, `caseloadStatutoryFormCode`/`caseloadRecordedExpiryAt`/
  `caseloadRecordedExpiryLabel`, `caseloadRowsForTeam`, `referralsWaitingOnTeam`,
  `categoriseTeamAdmission`, `elapsedSinceOrUnderADay`. ⚠️ Line 3,846 has a comment flagging one
  branch of a conditional as "UNREACHABLE TODAY" because only one caller currently maps into it —
  a live dead-branch note, not a component-reachability marker; worth re-checking if a second
  caller is ever added.

## `search/` — 11 files, 9,679 lines

- **Route:** `/search` (`patient-search.tsx` → `PatientSearchPage`).
- **Mockup:** `patient-search-third-edition.html` (SCREEN-MAP.md row for `search/`). Two further
  drawings (`patient-search-console.html`, `patient-search-working.html`) are reference-only, not
  build sources.
- **Reducer events dispatched:** none — this folder is read-only (0 `dispatch(` sites).
- **Main derivations/selectors read:** `ward-derivations.ts`, `ward-patients.ts` (`findPatients`,
  `nearPatients`, `patientDisplayName`), `ward-referrals.ts`, `ward-legal-forms.ts`,
  `ward-sites.ts`. `search-filters.ts` and `search-refusals.ts` are this folder's own selector
  layer, read by `patient-search.tsx`, `patient-typeahead.tsx` and `record-preview.tsx`.
- **Cross-cutting use:** `patient-typeahead.tsx` and `ward-smart-search.ts` are also imported by
  root-level `ward-chrome-search.tsx` and `ward-global-search.tsx` — the top-bar search available
  from every screen, not just `/search`. `access-record.ts` (session-only search history) is also
  imported by `governance-registers.tsx`.
- **Tests:** 17 files: `ward-patient-search.dom.test.tsx`, `ward-patient-typeahead.dom.test.tsx`,
  `ward-search-preview.dom.test.tsx`, `ward-search-access-record.test.ts`,
  `ward-search-refusals.test.ts`, `ward-patient-typed-text-not-in-url.dom.test.tsx`,
  `ward-print-ink-specificity.test.ts`, `ward-add-patient.dom.test.tsx`,
  `ward-referral-sending-team-display.test.ts`, plus shared `ward-nav.test.ts`,
  `ward-no-dead-ends.dom.test.tsx`, `ward-landmarks.test.ts`, `ward-primitives-shared.test.ts`,
  `ward-management-print-coverage.test.ts`, `ward-governance-enumerations.dom.test.tsx`, and two
  non-ward guard tests (`guard-push.test.ts`, `pre-commit-ward-flow-main-guard.test.ts`) that
  happen to reference a path string in this folder rather than its behaviour.
- **Reachability note:** `record-preview.tsx` is imported by `patient-search.tsx` but confirm
  before assuming it renders on every path — a plain `grep` for the string `"record-preview"`
  under-counts because some importers use relative `./record-preview` specifiers (see how this
  count was produced, in "Not checked" below).

### Files

- **`access-record.ts`** (71 lines) — `AccessEntry`, `recordSearch`, `ACCESS_RECORD_NOTE`. Session-
  only search history; its header states plainly that nothing under `src/` writes a search anywhere
  durable, and that this is deliberate (a false "every search is logged" claim would be a privacy
  problem in the other direction).
- **`patient-query-handoff.ts`** (106 lines) — `PatientQueryAssignment`, `PatientQueryHandoff`,
  `handOffTypedPatientQuery`, `takeHandedOffPatientQuery`, `isNewTabClick`. An in-memory, read-once
  channel carrying a typed name/record number from search to `patients/add-patient.tsx`'s prefill,
  chosen specifically to avoid putting typed text in the URL (privacy).
- **`patient-search.tsx`** (2,219 lines) — the `/search` route component. `PatientSearchPage`
  (158–1,838, the largest single function), plus exported `PeopleSection` (1,857) and
  `ResultsSection` (1,951); internal `ResultRow` (2,140) and `AccessRecordPanel` (2,191). Module
  helpers: `waitedHours` (76), `originDepartmentText` (123), `getPatientPresence` (1,838).
- **`patient-typeahead.module.css`** (422 lines) — styles only `patient-typeahead.tsx`.
- **`patient-typeahead.tsx`** (593 lines) — `PatientTypeahead`. Used by `patient-search.tsx` and by
  the global top-bar search (`ward-global-search.tsx`), so a change here can affect every screen's
  header, not only `/search`.
- **`record-preview.module.css`** (703 lines) — styles only `record-preview.tsx`.
- **`record-preview.tsx`** (1,209 lines) — `RecordPreview`, plus exported `buildMovementSummary`,
  `buildReferralSummary` and internal `deriveClinicalHistory`, `legalStatutoryInfo`,
  `linkedReferralFor`, `linkedOpenMovementFor`, `referralStateSentence`. The detail panel shown
  when a search result is selected.
- **`search-filters.ts`** (254 lines) — `ServiceFilter`/`SettingFilter`/`WaitFilter`/
  `PresenceFilter`/`LegalFilter` types, `QUICK_CHIPS`, and the `matches*` predicate family
  (`matchesService`, `matchesSetting`, `matchesPresence`, `matchesLegal`, `matchesWait`,
  `matchesQuickChip`) plus `waitedHours`, `isQuickChipQuery`.
- **`search-refusals.ts`** (37 lines) — `SearchRefusal`, `refusalFor`, `NOTHING_FOUND`,
  `RESULTS_FOOTER`. Fixed refusal wording ("no risk score, no acuity score, no best match") pinned
  verbatim by `tests/ward-search-refusals.test.ts` per its own comment — a reworded refusal is a
  different promise and nothing else would fail.
- **`search.module.css`** (3,630 lines) — the stylesheet for `patient-search.tsx`, also imported by
  `record-preview.tsx` for shared classes.
- **`ward-smart-search.ts`** (435 lines) — `searchWards`, `searchEmergencyDepartments`,
  `searchCommunityTeams`, `searchLegalForms`, `searchCoreViews`, `searchTasks`, and the combined
  `searchWardFlow`. The engine behind the top-bar "search everything" box
  (`ward-chrome-search.tsx`, `ward-global-search.tsx`, `ward-nav.ts`) — reaches across patients,
  movements, wards, EDs and community teams in one pass; not used by `/search` itself.

## `statistics/` — 36 files, 23,701 lines

- **Routes:** `/statistics` (`statistics-screen.tsx`), `/statistics/overview`
  (`statistics-overview-screen.tsx`), `/statistics/compare` (`statistics-compare-screen.tsx`),
  `/statistics/ward/[unitId]` (`statistics-ward-screen.tsx`), `/statistics/ed/[edId]`
  (`statistics-ed-screen.tsx`), `/statistics/service/[serviceId]` (`statistics-service-screen.tsx`),
  `/statistics/community/[teamId]` (`statistics-community-screen.tsx`) — 7 routes into one folder,
  the most of any screen folder.
- **Mockups:** `statistics-third-edition.html` (`/statistics`),
  `statistics-overview-third-edition.html`, `statistics-compare-third-edition.html`,
  `statistics-ward-third-edition.html`, `statistics-emergency-department-third-edition.html`,
  `statistics-service-third-edition.html`, `statistics-community-third-edition.html` — one drawing
  per route, all present (SCREEN-MAP.md).
- **Reducer events dispatched:** none — statistics is entirely read-only (0 `dispatch(` sites; no
  screen in this folder writes state).
- **Main derivations/selectors read:** `ward-derivations.ts`, `ward-admissions.ts`,
  `ward-bed-availability.ts`, `ward-referrals.ts`, `ward-statistics.ts`, plus this folder's own
  large selector layer: `statistics-derivations.ts` (shared pull/discharge/decline figures),
  `statistics-absence.ts` (the seven-state "what kind of missing number is this" type),
  `statistics-claims-register.ts` (the evidence register for every figure statistics claims to
  show), `statistics-demonstration.ts` (the one place a trend number may be invented, walled off
  from everything else), `statistics-ed-waits.ts`, `statistics-ward-ready.ts`,
  `statistics-ward-discharge-dates.ts`, `statistics-ward-referrals.ts`,
  `statistics-community-figures.ts`, `statistics-community-people.ts`, `statistics-decline-reporting.ts`.
- **Tests:** 57 files — the second-largest test count in this part — including some 35
  `ward-statistics-*` specs by area (community × 7, ed × 6, ward × 6, service × 3, sections × 4,
  claims/derivations/absence/demonstration, discharge-date coverage/populations, null-referral-id,
  empty-bed spread/exclusion, grid-tracks-fit, number-agreement, today-counts, ready-not-yet-gone),
  `statistics-v4-primitives-tokens.test.ts`, `ward-composes-targets.test.ts`,
  `ward-declined-by-all-precedence.test.ts`, `ward-pending-preparation-populations.test.ts`,
  `ward-screen-verification-lib.test.ts`, `ward-length-of-stay-population.dom.test.tsx`, plus
  shared `ward-nav.test.ts`, `ward-no-dead-ends.dom.test.tsx`, `ward-landmarks.test.ts`,
  `ward-primitives-shared.test.ts`, `ward-browser-build-css.test.ts`.

### Files

- **`statistics-absence.ts`** (93 lines) — `StatisticsFigure` union and constructors `measured`,
  `empty`, `cannotBeFormed`, `neverRecorded`, `destroyed`, `unlinkable`, `belowMinimum`, plus
  `isUnmeasured`, `figureText`. Its header states this folder found three different sentences
  sharing three words but meaning different things, which is why every figure must carry its own
  state rather than a shared "not a measurement" string.
- **`statistics-claims-register.ts`** (2,298 lines) — **the largest non-screen file in the folder.**
  `REGISTERED_SURFACES`, `FalsifyingEdit`/`ModelClaim` types, `MODEL_CLAIMS` (a large array pairing
  every claim a statistics screen makes with the source line that makes it true), `UnevidencedClaim`
  type and `UNEVIDENCED_CLAIMS` (claims with no citable line, and why). Its own header warns it is
  "a sweep of `REGISTERED_SURFACES`, not a guarantee that nothing on them is unrecorded" — an
  earlier, stronger claim in its opening line was corrected 2026-09-01. Imported by
  `statistics-screen.tsx`, `statistics-ed-screen.tsx`, `ward-model.ts` and six tests.
- **`statistics-community-figures.ts`** (86 lines) — `CommunityFigures` type, `communityFigures()`.
  Warns that when the community-team join cannot run, its four figures are not zeros — they are an
  unmeasured state, and must render as such.
- **`statistics-community-people.ts`** (74 lines) — `PersonInBed`, `PeopleInBeds`,
  `MINIMUM_PUBLISHABLE_SAMPLE` (5), `peopleInBeds`. Suppresses a per-person list below a caseload
  threshold (D-38 ruling) rather than merely shortening it, to avoid re-identifying a small caseload.
- **`statistics-community-screen.tsx`** (1,159 lines) — `StatisticsCommunityScreen`, the
  `/statistics/community/[teamId]` route component.
- **`statistics-community-third-edition.module.css`** (314 lines) — page-specific styles layered
  over `statistics-sections.module.css` for the community statistics screen.
- **`statistics-compare-screen.tsx`** (1,100 lines) — `StatisticsCompareScreen`, the
  `/statistics/compare` route component; uses `statisticsSectionById` from `statistics-sections.ts`.
- **`statistics-decline-reporting.ts`** (69 lines) — `DeclineReadout`, `readDeclinesByReason`. Reads
  a possibly malformed decline reason without losing the screen — reports it in place rather than
  crashing.
- **`statistics-demonstration-chart.tsx`** (353 lines) — `DemonstrationChart`, the **only**
  function in the codebase allowed to render a `DemonstrationSeries` per its own header comment.
  Named `-chart.tsx` deliberately (not `statistics-demonstration.tsx`) to avoid a bare-specifier
  collision with the sibling `.ts` file.
- **`statistics-demonstration.ts`** (315 lines) — `DemonstrationPoint`/`DemonstrationSeries` types,
  `DEFAULT_TREND_LENGTH` (30), `generateDemonstrationSeries`. The one place a 30-day trend number is
  invented, because `WardFlowState` keeps no history; walled off so invented numbers cannot leak
  into any other figure.
- **`statistics-derivations.ts`** (689 lines) — `admissionStagePosition`, `pullToArrival`,
  `referralToBedJoin`, `bedsBeingPrepared`, `refusedAndNothingPending`, `declinesByReason`,
  `blockedDischargesByReason`. The shared pull/discharge/decline selector layer read by several
  screens in this folder.
- **`statistics-disclaimers.tsx`** (92 lines) — `SyntheticFiguresDisclaimer`,
  `CoordinatorAccessDisclaimer`. The two sentences every statistics page states before anything
  else: figures are invented, and the coordinator-only framing is an intention, not an access
  control.
- **`statistics-ed-screen.tsx`** (1,806 lines) — `StatisticsEdScreen`, the `/statistics/ed/[edId]`
  route component. Module helpers: `waitDotColor` (40), `makeSplinePath` (106) for the inline SVG
  wait-time chart.
- **`statistics-ed-third-edition.module.css`** (595 lines) — page-specific styles for the ED
  statistics screen.
- **`statistics-ed-waits.ts`** (154 lines) — `EdWaitingEntry`/`EdWaitFigures`/`edWaitFigures`,
  `ED_WAIT_BANDS`/`edWaitBands`. Its header explains it exists because every headline figure on the
  ED statistics screen used to be computed inline inside the render — extracted so the figures are
  testable in isolation.
- **`statistics-landing-third-edition.module.css`** (1,432 lines) — page-specific styles for
  `statistics-screen.tsx` (`/statistics`), layered over `statistics.module.css` and
  `statistics-sections.module.css`.
- **`statistics-nav.module.css`** (92 lines) — styles only `statistics-nav.tsx`.
- **`statistics-nav.tsx`** (179 lines) — `StatisticsNavSection` type, `StatisticsNav`. The section-
  switcher used by `statistics-screen.tsx` and `statistics-section-frame.tsx`.
- **`statistics-overview-screen.tsx`** (820 lines) — `StatisticsOverviewScreen`, the
  `/statistics/overview` route component.
- **`statistics-primitives.tsx`** (103 lines) — `StatFootnoteGroup` type, `StatFootnote`. 🔴
  **Unreachable** — its own header states "referenced by nothing in `src/` at all" (owner ruling
  2026-09-06), the strongest form of this family's unreachable marker (the others are still reached
  by one other unreachable component; this one has zero importers anywhere).
- **`statistics-screen.tsx`** (2,650 lines) — the `/statistics` route component and the folder's
  largest screen file. `StatisticsScreen` (137–end) is a five-tab single-page report; the tabs are
  marked by JSX comment banners: Executive Overview (~621), Ward & Bed Flow (~1,326), Emergency
  Pressure (~1,471), Community Teams (~1,620), Referrals & Placement (~1,723). Includes an inline
  SVG occupancy gauge and a 14-day flow chart built from raw SVG paths, not a charting library.
- **`statistics-section-frame-third-edition.module.css`** (228 lines) — page-specific styles for
  `statistics-section-frame.tsx`.
- **`statistics-section-frame.tsx`** (215 lines) — `StatisticsSectionFrame`, the shared page chrome
  (disclaimers + nav) wrapping every per-place statistics screen.
- **`statistics-sections.module.css`** (682 lines) — shared styles across the community, ED,
  service, ward and section-frame screens.
- **`statistics-sections.ts`** (178 lines) — `STATISTICS_HOME_HREF` and every other statistics URL
  constant, `StatisticsSectionId`/`StatisticsSection` types, `STATISTICS_SECTIONS`,
  `statisticsSectionById`. Its header states this exists so the section list is written down
  exactly once, read by the hub, each section's own header and the tests that check they agree.
- **`statistics-service-screen.module.css`** (157 lines) — styles specific to
  `statistics-service-screen.tsx`.
- **`statistics-service-screen.tsx`** (1,199 lines) — `StatisticsServiceScreen`, the
  `/statistics/service/[serviceId]` route component.
- **`statistics-service-third-edition.module.css`** (509 lines) — page-specific styles for the
  service statistics screen.
- **`statistics-third-edition.module.css`** (733 lines) — shared third-edition styles used by both
  `statistics-compare-screen.tsx` and `statistics-overview-screen.tsx`.
- **`statistics-v4.module.css`** (904 lines) — a fourth styling layer, imported only by
  `statistics-ed-screen.tsx` alongside `statistics.module.css` and
  `statistics-ed-third-edition.module.css` — three CSS modules stacked on one screen (see
  pitfalls).
- **`statistics-ward-discharge-dates.ts`** (78 lines) — `DischargeDateCoverage`,
  `dischargeDateCoverage`. States how many patients on a ward have a written discharge date; its
  header explicitly says the drawing's other half (a distribution of dates) is a hand-back, not a
  gap in this file.
- **`statistics-ward-ready.ts`** (92 lines) — `ReadyNotYetGone`, `readyNotYetGone`. "Clinically
  ready, not yet gone" — one pass producing three related figures together so they cannot drift
  apart.
- **`statistics-ward-referrals.ts`** (57 lines) — `WardReferralTally`, `wardReferralTally`. Its
  header states the drawing's implied total (received = accepted + declined + still-open) is wrong
  for two reasons, only one of which is the prototype's no-history limit — so this file deliberately
  reports three figures with **no** total.
- **`statistics-ward-screen.tsx`** (2,504 lines) — `StatisticsWardScreen`, the
  `/statistics/ward/[unitId]` route component and the folder's second-largest file. One helper,
  `getCatmullRomSpline` (19), builds the spline paths for several inline SVG charts: a length-of-
  stay histogram, a net-occupancy area chart and a 14-day trend, all hand-drawn SVG rather than a
  library.
- **`statistics-ward-third-edition.module.css`** (781 lines) — page-specific styles for the ward
  statistics screen.
- **`statistics.module.css`** (911 lines) — the base statistics stylesheet, imported by
  `statistics-demonstration-chart.tsx`, `statistics-ed-screen.tsx`, `statistics-primitives.tsx` and
  `statistics-screen.tsx`.

---

## Pitfalls in this area

1. **`coordinator-screen.tsx` imports from `delays/` (Screens B), and `pressure-strip.tsx` imports
   from `ed/ed-home-derivations.ts`.** Neither folder is self-contained the way the overview map's
   "engine files" are; changing `delays-derivations.ts`'s `answerSilenceReminder` or
   `ed-home-derivations.ts`'s exports can silently break the coordinator screen with no import
   error inside `coordinator/` itself.
2. **Four "family" unreachable components per retired screen, not one.** The 2026-09-06 retirement
   left an unreachable page component (`ed-home.tsx`, `community-home.tsx`), an unreachable child
   (`ed-service-bands.tsx`, `community-team-hub.tsx`, `community-teams-table.tsx`,
   `community-figures.tsx`) and its paired `.module.css`, all still on disk and all still compiling.
   `grep`-ing for a component name without checking `tests/ward-component-reachability.test.ts`
   first will over-count what is live.
3. **`ward-screen.tsx`'s two presentations are one component, not two.** `WardScreen` (273) is a
   thin switch into `WardOverviewScreen` (288); the `/ward/[unitId]/answer` route does not render
   `ward-answer-view.tsx` despite the similar name — that file has no importer this map found
   outside its own folder, and is worth re-confirming before assuming it is reachable at all.
4. **`ed-screen.tsx` and `ward-screen.tsx` are both ~5,000-line single components with no internal
   decomposition.** Nearly every handler and every dialog's JSX lives in one function scope; a
   change to one dialog's state can affect variable capture for a sibling dialog with no compiler
   warning across the boundary.
5. **`referral-wait.ts` vs `ward-referrals.ts`'s `referralWaitLabel`.** Both compute a "how long has
   this referral waited" string, but `referralWaitLabel` keeps counting after triage while
   `referralWaitLine` (this folder) does not. Picking the wrong one by name similarity produces a
   wrong-but-plausible number, not an error.
6. **`community-vocabulary.ts` reports similarity; `community-ratified-aliases.ts` reports
   sameness.** These are deliberately different files for a clinical-safety reason (see the latter's
   header) — never fold a "these are near-duplicate spellings" finding into the ratified-alias list
   without an owner ruling.
7. **Three or four stacked CSS modules on one statistics screen.** `statistics-ed-screen.tsx` alone
   imports `statistics.module.css`, `statistics-sections.module.css`, `statistics-v4.module.css`
   and `statistics-ed-third-edition.module.css`. A class defined in more than one of these can
   collide by CSS-module hashing order rather than by an explicit override, and the ward/community/
   service screens each stack a different subset.
8. **`statistics-claims-register.ts`'s own header retracted its opening claim once already**
   (2026-09-01: "EVERY statement" narrowed to "a sweep of `REGISTERED_SURFACES`"). Treat any
   absolute claim in this file's prose as scoped to what it actually swept, not to the whole screen.
9. **`/community` has a route and a screen but no mockup entry.** Unlike every other route in this
   part, there is nothing in `docs/ward-flow/mockups/` a reviewer can check `community-index.tsx`
   against; SCREEN-MAP.md flags this explicitly rather than silently.
10. **`community-screen.tsx:3846`'s "UNREACHABLE TODAY" comment is a live dead-branch note, not a
    component-reachability marker** — do not confuse it with the family of components carrying the
    2026-09-06 unreachable-screen banner; it means one conditional arm inside a reachable component
    currently has no caller that reaches it.

## Not checked

No test, lint, typecheck, build or browser run. This map did not verify that any screen renders
correctly, matches its mockup, or that the "unreachable" and "not yet wired" claims quoted from file
headers are still true today — only that the grep-based importer counts support them at this tip.
Import-counting used literal string search (`grep -rl`) for bare specifiers
(`"@/components/ward-management/<folder>/<file>"`) and separately for relative specifiers
(`"./<file>"` / `"../<file>"`); a file imported only through a path alias this map did not think to
search (e.g. a barrel re-export) could be under-counted as an importer, which is why `record-preview.tsx`
and `patient-typeahead.tsx` needed a second, broader pass before their real importers turned up. Test
counts are "a test file's text contains this folder's import path," not "the test actually exercises
the behaviour" or "the test currently passes" — `docs/ward-flow/STATUS.md` and the two 25 September
audits the overview map cites disagree about how many ward tests are currently red. CSS was counted
by line but not read for content beyond the token-alias/raw-colour rule already documented in the
overview map. The `EVENT_ROLE` permission table (who may send each dispatched event) was not
cross-checked file by file against these six folders' dispatch call sites — see
[Engine](engine.md) for that table.
