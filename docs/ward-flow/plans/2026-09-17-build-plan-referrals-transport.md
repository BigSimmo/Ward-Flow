# Build plan — referrals, journeys, transport, queue order and notices (owner answers 14–48) — read-only Opus planner, 17 Sept 2026

> **FOLDED on 17–21 September 2026 into `codex/task-ward-flow-live-state-20260831` (commit `a7c7288668` / `6c33169b03`).**
> Kept for historical reference. For deferred items and active status, see `docs/ward-flow/STATUS.md`.

**Pinned tree.** Every `file:line` below was read at `73e617fbdc` (`ward/audit-fixes-20260916`, y2 and y3 folded).
This line moved five times while the plan was being written, so re-grep before editing.

**Sources.** Owner words, which bind: [`owner-answers-2026-09-17.md`](../archive/dated-notes/owner-answers-2026-09-17.md). · R-numbers:
[`2026-09-16-fix-plan-referral-model.md`](2026-09-16-fix-plan-referral-model.md). · Shared tokens:
[`2026-09-17-build-plan-legal-clinical.md`](2026-09-17-build-plan-legal-clinical.md) §4.

**Already on the line — don't rebuild:** R1 and WF-13. · A no-bed CANCEL_TRANSPORT removes the job, and rebook ids are
unique. · The "Awaiting a bed at the accepting ward" blocker. · Settings wiring. · y2 (fold `73e617fbdc`) and y3's
R3–R5 (fold `13594e4181`). **So no task waits for y2 or y3**; RB5 builds on y2's decline wiring and RB6 on y3's R5.

**Not folded: y4** (tip `5eb16c4d24`). Its union-coverage guard fails the build if an event type is missing from the
two lists in `ward-flow-provider.tsx`, so **every task that adds an event starts after y4 folds.**

**Not planned here:** items 1–12 (legal plan), 38–56 apart from 48 (screens plan), and 17 and 28 (§6).

## 1. Items: verified facts → target

### B. Referrals

**14 · ED to community team — build now.** Facts: The ED's "Refer to community (CMHT)" button (`ed-screen.tsx:2750`)
is not gated by a form or an examination. · Teams come from `communityTeamOptions()`, alphabetical only
(`referral-destination-options.ts:197-212`). Its body is pinned at `statistics-claims-register.ts:597`. ·
`REFER_TO_COMMUNITY_TEAM` (`reducer:1802`) closes the journey `did_not_proceed`. It has optional free-text `reason`
(`ward-flow-events.ts:543`), and makes no referral and no notice. · `RECEIVE_REFERRAL` allows `["community"]` only
(`:1591`), and intake always sends `community` (`referral-intake.tsx:1435`). Target: Offer every team, with the
patient's home-suburb team first. · On a form with no examination outcome, don't offer it; legal T7's "further
examination ordered" doesn't unlock it. Once there is an outcome, offer it and show legal status. · Sending creates a
real community referral (source "ED medical staff", role `ed`), records "For community follow-up" (19), ends the bed
search and tells the team (48). · The patient stays on the ED board until they leave.

**15 · Accepting starts nothing; starting the bed journey is a separate step.** Facts: R3 is folded: the notice reads
"…accepted referral {id}. No bed is pulled and no movement is created." (`reducer:4346`), and no movement is made
(`:4295`). · Nothing starts a journey from a referral: the ED raise form sends no `referralId` (`ed-screen.tsx:1086`).
Target: For an ED-addressed referral, the step is item 21's control. · A ward-accepted referral with no ED arm shows
"Start the bed journey" unavailable: "Not wired in this prototype." (Community-direct is item 59.)

**16 · A community team may accept, for follow-up only.** Facts: `ACCEPT_REFERRAL` allows
`["ward","coordinator","ed"]` (`:1604`). `answerableBy.community` already exists (`reducer:4105`, `:4416`). ·
`referralState` counts any arm as an acceptance (`ward-referrals.ts:59`). So once any arm accepts, further accepts
(`:4128`), declines (`:4436`) and referrer withdrawal (`:4562`) are all refused. · An acceptance cancels queued
non-community arms (`:4292`). Owner ruling 2 of 2026-09-01, "a leaving acceptance cancels nothing", is not built. ·
The warning at `reducer:4206-4272` is stale: `CANCELLED_ELSEWHERE_MARKERS`
(`tests/ward-referral-visibility.test.ts:283`) already defused its trap. Target: A team accepts its own arm. That
acceptance cancels nothing and never counts as a bed acceptance. · Ward and ED arms stay answerable, and the community
arm stays answerable after they say yes.

**18 · Re-referring adds wards; replacing one is a withdrawal with a fixed reason.** Facts: `REFER_TO_UNITS` replaces
the live list (`reducer:2067`), so dropped wards get no entry. · It rewrites `referredAt` (`:2071`) and checks the cap
against the new list only (`:2004`). · `WITHDRAWAL_REASONS` has two codes (`ward-change-reasons.ts:238`), and there is
no way to withdraw one ward. · The shortlist sends only its selection (`shortlist-panel.tsx:642`). ·
`tests/ward-movement-stage-changes.test.ts:446` pins the `referredAt` rewrite. Target: Adding keeps the first
`referredAt`, and the cap counts live plus new wards. · Live wards show pre-selected and locked. · The coordinator
withdraws one ward with a §2 reason, and that ward is told.

**19 · "For discharge" and "For community follow-up" are recorded outcomes.** Facts: The chip counts `closure?.outcome
=== "did_not_proceed"` (`ed-screen.tsx:1047`) within `patients`. But `patients` already excludes closed journeys
(`:963-965`), so the chip always reads "none". · "For community follow up" exists only in the drawing
(`emergency-department-third-edition.html:6823`). · Closure outcomes are `arrived | did_not_proceed`
(`ward-model.ts:725`), and `RECORD_NO_REFERRAL` (`reducer:1736`) closes nothing. Target: the outcome ends the bed
search. The patient stays on the ED board under that chip until "Left the department".

**20 · A referral whose only acceptance was withdrawn is not "declined by all".** Facts: R1 requires `acceptedUnitId
=== undefined` (`ward-derivations.ts:1255-1263`). · `WITHDRAW_ACCEPTANCE` clears that field and leaves nothing live
(`reducer:5317-5425`). So earlier declines plus a withdrawn acceptance read as `declined_by_all` in the handover
(`handover-page.tsx:882`) and in statistics (`statistics-derivations.ts:445`). · The "Multiple destinations declined"
inbox row ignores acceptance (`ward-derivations.ts:1072-1084`). · This code is pinned at
`statistics-claims-register.ts:1051-1059`. · Front-door referrals have no withdraw-acceptance event. Target:
"Acceptance withdrawn — no ward is being asked", unless a decline came after the withdrawal. No inbox row for an
accepted movement.

**21 · Bed referrals show on that ED's lists; "Request a bed from this referral" (drawing first).** Facts: ED lists
read `"psychiatric_review"` only (`ed-screen.tsx:1001-1002`). Intake addresses an ED with `"bed"`
(`referral-intake.tsx:345`, `:383`), so bed referrals show nowhere. · R5 (`reducer:1586`) already refuses a second
open journey and a withdrawn or declined addressing. Target: as the owner said, with the journey pre-filled from the
referral.

**22 · A new journey after an earlier one closed.** R5 (folded) covers this
(`tests/ward-raise-referral-uniqueness.test.ts:109`). Nothing to build.

**23 · Police, ambulance and crisis stay "community".** No source-to-role mapping exists. Target (R9): only
`ed_medical` is raised as `ed`, and `ed` with any other source is refused. Everything else, including GP, stays
`community`.

**24 · Community teams can cancel transport (a reversal).** Facts: `CANCEL_TRANSPORT` allows
`["coordinator","ed","ward"]` (`ward-flow-events.ts:1456`). Community was left out because no event names the acting
team (`:1449-1455`). · `BOOK_TRANSPORT` already allows community (`:1435`) but records only the role
(`ward-model.ts:656`). · No community screen has a transport control. Target: a team may cancel transport it booked,
the same rule wards got in WLQ-11 (question 3).

**25 · GP referrals.** Facts: `REFERRAL_SOURCES` has six values and no GP (`ward-model.ts:1360-1367`). · Labels live
at `referral-intake.tsx:85` and `community-screen.tsx:1485`, pinned by `tests/ward-referral-model.test.ts:220`. ·
`referralReferrer` (`reducer:1179`) addresses `ed_medical` only. Target: add "General practitioner (GP)". Send no
notice, and say the GP is told by phone or letter.

**27 · A sent referral's history is not editable; corrections are new notes.** Facts: only `RECEIVE_REFERRAL` writes
`history`. No edit or note event exists, the limit is 2,000 (`ward-model.ts:1909`), and **no screen shows history
after sending.** Target: a guard, plus an append-only note shown beside the history.

### C. Journeys, beds and transport

**29 · Diversion on the way. The owner added that the coordinator, the ward or the original referrer may release.**
Facts: There is no diversion event. The only record is free text via `RECORD_MOVEMENT_BLOCKER` (comment at
`ward-flow-events.ts:1521`). · `RELEASE_PULL` is `["coordinator","ward"]` (`:1398`) and works only at `pulled`
(`reducer:4756`). · After collection, nothing releases a bed without ending the journey, and `STOP_TRANSPORT` releases
it automatically (`reducer:5177`). Target: A person records the place and a reason. The bed stays held and the ward is
told. · The coordinator, the accepting ward or the referring ED releases the bed, which ends the journey.

**30 · No automatic rebooking.** Facts: With a bed held, `CANCEL_TRANSPORT` writes a `-replacement-N` job
(`reducer:5070` onward) and says "a replacement is being arranged." (`:5141`). A test pins this
(`tests/ward-cancel-transport-no-bed-held.test.ts:239`). · `BOOK_TRANSPORT` refuses every stage except `pulled`
(`:4889`). · A cancel at `handover_ready` keeps the stage (`tests/ward-cancel-transport-stage.test.ts:150`). Target:
the job is removed and nothing is booked. A person books again, including from "handover ready".

**31 · "Arrived" becomes "Delivered"; a stop records where the patient is and tells the officer.** Facts: The
officer's "Arrived" is the button (`officer-screen.tsx:635`), the rejection label (`:46`) and the guard copy (`:366`).
· The drawing uses it at `transport-officer-third-edition.html:535`, `:583` and `:624`, and
`ui-ward-roles.spec.ts:968` clicks by that label. · `STOP_TRANSPORT` has no place field (`ward-flow-events.ts:574`)
and tells only the ward (`reducer:5251`). No screen dispatches it. Target: The officer sees "Delivered". The ward,
tracker and movements screens keep "Arrived". · A stop records a place from a list and tells the officer.

### E. Queue order and notices

**37 · Queue order, who flagged and when, and the urgent reasons.** Facts: `queueOrder` sorts by flag, then tier, then
`operationalScore` (`ward-priority.ts:230-239`). The score mixes wait (capped at 10 hours), form due time, declines,
blocker and transport delay. It never reads legal status. · `FLAG_MOVEMENT_URGENT` records no reason, person or time
(`ward-flow-events.ts:433-442`). `flaggedUrgent` is a bare boolean (`ward-model.ts:992`). · `URGENT_MARK_REASONS` has
**eight** members, two of them catch-alls (`ward-change-reasons.ts:364-391`). No screen offers them. · The front-door
referral queue already sorts by tier, then oldest (`ward-referrals.ts:549`), with no flag. Target: Sort by flag, then
tier, then longest wait with no cap. Form timing stops ordering anyone, which answers the legal plan's §5 question. ·
A flag needs a reason and records who and when. · Legal status never ranks.

**48 · Notices count as read only when marked; three new notices.** Facts: `Notice.readAt` exists
(`ward-model.ts:2368`), but it is only ever written as `undefined` (`reducer:1126`). · Activity counts every notice
(`shell/ward-bar.tsx:740`). · `WITHDRAW_ACCEPTANCE`, `RECORD_EXAMINATION` and `REFER_TO_COMMUNITY_TEAM` raise no
notice (`ward-model.ts:2295-2317`). · `WardChromeRole` has no community member (`ward-chrome-role.ts:20`). Team page
ids are `communityTeamSlug(name)` (`community-derivations.ts:89-92`). Target: Only the addressee's "Mark as read"
writes `readAt`, and counts show unread only. · New notices go out for a withdrawn acceptance (to that ward), a
revoked examination (to the accepting ward), and an ED-to-community referral (to the team, on its page).

## 2. PROPOSED — for the owner to veto

**Item 18: reasons for withdrawing one ward's request.** These sit in `ward-change-reasons.ts` beside
`WITHDRAWAL_REASONS`, with labels beside them. They pass the content-free test
(`tests/ward-change-reasons.test.ts:95`), and none names a place (FD-23), because the ward reads them.

1. `no_answer_from_the_ward` — "No answer from the ward yet"
2. `bed_no_longer_available` — "The bed is no longer available"
3. `needs_changed_ward_no_longer_suits` — "Needs have changed; this ward no longer suits"
4. `closer_to_home_or_family_elsewhere` — "Closer to home or family elsewhere"
5. `making_room_within_the_referral_limit` — "Making room within the referral limit"
6. `referred_in_error` — "Referred in error"
7. `another_reason` — "Another reason — needs follow-up"

**Item 37: more urgent reasons.** The owner's "four further" assumed six placeholders. There are really eight, two of
them catch-alls, and he originally asked for ten.

**Proposed: add two, making ten.** Both go after `escort_in_place_and_unsustainable` (`:370`), so "Another reason, not
listed here" stays last. Each describes what the setting cannot do. Neither is legal status, cohort or security need,
and neither repeats an existing reason.

1. `cannot_protect_from_others_here` — "Cannot protect from harm by others here". The mirror of "Safety of others in
   this setting": a person at risk from others in a crowded, mixed ED or ward (sexual safety included) is moved
   first.
2. `setting_unsuitable_for_age_group` — "This setting is unsuitable for their age group". A young person in an adult
   area, or a frail older adult in a general adult area, is a standing reason youth and older-adult coordinators
   move someone first. The age band itself stays its own field.

If he wants all four, the next two are `booked_transfer_will_be_lost` — "A booked transfer or flight will be lost"
(regional seats are scarce), and `no_health_staff_where_they_are` — "No health staff where they are now" (for example
police custody, which is rare while every journey starts in an ED).

## 3. Tasks

**Rules for every task:** Write the failing test first and watch it go red. · Give every guard a mutation proof with
`node scripts/ward-flow/mutation-run.mjs`. Each mutation must turn a named test red. · Commit as you go, and never use
`git add -A`. · Record every rewritten test in `diff-integrity.json`. · End every Sonnet brief with: "if you reach a
decision this brief does not cover, stop and hand it back." · Classify every new event in `ward-flow-provider.tsx`
after y4 folds. · Legal T14 owns `releasePulledBedAndAdmission`: call it, never edit it.

**Tokens** (one holder at a time, across all three plans): `ed-screen.tsx`; the reducer cases `RAISE_REFERRAL`,
`RECEIVE_REFERRAL` and `RECORD_EXAMINATION`; and a new **console token** covering `ward-management-console.tsx` and
`movements/movement-drawer.tsx`.

### Lane T — transport

**T1 · Community cancels its own bookings; no automatic rebooking (M). Starts now.** Items 24, 30. Owns: Reducer
`BOOK_TRANSPORT` (`:4883`) and `CANCEL_TRANSPORT` (`:4957`), with both variants gaining `actingTeamName?`. ·
EVENT_ROLE `CANCEL_TRANSPORT` (`:1456`): add `community`, and rewrite the comment at `:1449-1455`. ·
`TransportJob.bookedBy.teamName?`, and a new `STAGE_TRANSITION_BLOCKERS.transportCancelled` (`reducer:177`). ·
`bookTransportBlockedReason` in `ed-screen.tsx` (`:499-512`), holding the ED token only briefly. · Tests:
`ward-transport-cancel-permission.test.ts:186`, `ward-cancel-transport-no-bed-held.test.ts:239`,
`ward-event-permissions.test.ts:107`, and a new `ward-transport-cancel-community-and-rebook.test.ts`. Failing tests: A
community booking needs a listed team. Team A books and cancels: allowed. Team B cancels: refused. A team cancels an
ED booking: refused. · With a bed held at `pulled` or `handover_ready`, cancelling leaves no job, keeps the stage and
sets the new blocker, and no notice promises a replacement. · `BOOK_TRANSPORT` then works at both stages with a new
id, and the ED screen offers booking at "handover ready". Mutations: drop the team comparison; restore the replacement
job; restore the `pulled`-only guard. Tier: Sonnet. Catchers: reducer tests and the permission table.

**T2 · The officer's "Delivered" (S). Starts now.** Item 31, wording. Drawing first:
`transport-officer-third-edition.html:535`, `:583` and `:624`. Line 534 belongs to legal item 3. · Regenerate the
manifest and the screen verification. · Then `officer-screen.tsx:46`, `:366` and `:635`, `ui-ward-roles.spec.ts:968`,
and the officer DOM tests. Failing test: the officer sees "Delivered", not "Arrived", and it still dispatches `PATIENT_ARRIVED`. Tier: Sonnet.
Catchers: the DOM test and `mockup-manifest.mjs --check`.

**T3 · A stop records where the patient is and tells the officer (S–M). After T1.** Item 31, engine. Owns reducer
`STOP_TRANSPORT` (`:5177`) and its variant (a required `whereabouts`), a new `TRANSPORT_WHEREABOUTS` list after
`ward-change-reasons.ts:52-57`, `TransportJob.stoppedWhereabouts`, the notice kind `transport_stopped_officer` (after
`ward-model.ts:2317`), `ward-stop-transport.test.ts`, and the table in `ward-notices.test.ts`. No control is added,
because no screen dispatches a stop. Failing tests: a missing or unlisted place is refused; the place is stored; the
officer is told the place; the ward notice is unchanged. Mutation: drop the membership check. Tier: Sonnet.

**T4a · Diversion with the bed held (L). After T3 and y4.** Item 29. Owns two new reducer cases after
`STOP_TRANSPORT`, their variants, EVENT_ROLE entries (after `:1466`), the permission table and the y4 classification
(text-safe). It also owns refusals for a diverted journey in `PATIENT_ARRIVED` (`:2946`) and `STOP_TRANSPORT`.
**`RECORD_DIVERSION`** — officer or coordinator (question 1). Allowed only after collection, and not after arrival or
a stop. The place comes from `TRANSPORT_WHEREABOUTS` and the reason from `DIVERSION_REASONS`. It writes
`transport.diversion` and the blocker, and tells the accepting ward and the referring ED. · **`RELEASE_DIVERTED_BED`**
— coordinator, the accepting ward, or `ed`. `ed` is trusted by role alone, a gap already recorded at `reducer:2251`.
Allowed only after a diversion. It calls the release helper, closes the journey `did_not_proceed`, and tells the ward
unless the ward did it. Failing tests: A diversion keeps the bed and admission and sends both notices. · A diversion
is refused before collection, after arrival, when repeated, with unlisted values, and from a ward. · The coordinator,
the ward and the ED can each release, restoring the bed exactly once. · Refused: another ward releasing, a release
with no diversion, and delivery after a diversion. Mutations: release the bed inside `RECORD_DIVERSION`; drop the
acting-unit check. Tier: Sonnet.

**T4b · Diversion controls (M). After T4a and Q1; holds the console and ED tokens.** Adds "Record a diversion" to the
officer screen and "Release the held bed" to the console, ward page and ED page. Check the legal plan's
`ward/ward-screen.tsx` edits first. DOM tests: each control shows only on a diverted journey, stays `aria-disabled`
until a choice is made, and dispatches with the right role. Tier: Sonnet.

### Lane Q — queue order and notices

**Q1 · Queue order and the urgent flag (M). Starts now; holds the console token.** Item 37. It only adds a fixed-list
code, so it does not wait for y4. Owns: `ward-priority.ts:230-239`. · Reducer `FLAG_MOVEMENT_URGENT` and
`CLEAR_MOVEMENT_URGENT_FLAG` (`:3166-3192`), plus the flag variant (`reason`). · `Movement.urgentFlag?: { at; by;
reason }` (`ward-model.ts:992`). · `URGENT_MARK_REASONS` and its labels (`ward-change-reasons.ts:364-407`). · Controls
at `ward-management-console.tsx:2138` and `movement-drawer.tsx:309`, and the copy at `priority-queue.tsx:57`. · Tests:
`ward-priority.test.ts:273`, `:289`, `:402` and `:422`, `ward-urgent-flag.test.ts`, `ward-urgent-flag.dom.test.tsx`,
and `ward-change-reasons.test.ts:159`. Failing tests: A flagged tier 3 waiting five minutes ranks above an unflagged
tier 1. · Within a tier, the longer wait leads, even against a breached form due time and three declines. Waits beyond
10 hours still separate. · Swapping legal status and form between equal patients changes nothing. · A flag with no
reason, or an unlisted one, is refused. A flag stores who and when, and clearing removes it. · WF-018 reads "Who
flagged this and when was not recorded." · There are ten reasons, with the catch-alls last. Mutations: put
`operationalScore` back as the third key; add a legal-status key; skip the reason membership check. Tier: Sonnet.

**Q2 · Notices read only when marked (M). After y4.** Item 48. Owns: A new case `MARK_NOTICE_READ`, before
`ACKNOWLEDGE_INBOX_ITEM` (`:5436`). Role and `actingPlaceId` must equal `notice.to`, and a second mark is refused. ·
An EVENT_ROLE entry after `:1676`: `["coordinator","ed","ward","officer","community"]`. · `ward-chrome-role.ts`, and
`shell/ward-bar.tsx:353-359` plus the notices list at `:736-753` only (the screens plan owns `:625-682`). · The y4
classification, a new `tests/ward-notice-read.test.ts`, and a ward-bar DOM test. Failing tests: opening Activity sets
no `readAt`; the addressee's mark sets it; others are refused; the heading counts unread only; read notices stay in
the list. Mutations: set `readAt` when the popover opens; drop the addressee check. Tier: Sonnet.

**Q3 · Two new notices (S).** The withdrawal half starts now. The examination half waits for legal T7 to fold, then
takes the `RECORD_EXAMINATION` token (T7 folded at `4c78cd6183` as this plan closed; build the notice from T7's
record, and re-read the case first). Item 48. Owns the `WITHDRAW_ACCEPTANCE` return (`:5425`), the notice lines in
`RECORD_EXAMINATION`, two notice kinds after `referral_revoked_ward`, and rows in `tests/ward-notices.test.ts`.
Failing tests: A withdrawal tells exactly that ward. · A revoked examination tells the accepting ward, with the
sentence for its branch. · No accepting ward means no notice. · `community_order` sends nothing (the owner said
"revoked"). · No step-back label appears, because the 2026-09-04 ruling keeps those coordinator-facing. Mutation:
address the notice to the ED. Tier: Sonnet.

### Lane RA — movement referrals

**RA2 · A withdrawn acceptance is not "declined by all" (S). Starts now.** Items 20 and R2. Owns
`ward-derivations.ts:1233-1271` and `:1072-1084`, `handover-page.tsx:882`, and
`statistics-claims-register.ts:1051-1059` (re-evidence it). Tests: `ward-declined-by-all-precedence.test.ts`,
`ward-handover.test.ts` and `ward-inbox-classification.test.ts`. Failing tests: A declines, B accepts, then the
acceptance is withdrawn: `acceptance_withdrawn`, with the §4 label, and not counted. · C is then referred and
declines: `declined_by_all` again. · An accepted movement with three declines raises no inbox row. The control at
`:109` stays. Mutation: drop the "decline after withdrawal" comparison. Tier: Sonnet.

**RA1 · Re-referring adds; withdrawing one ward (M). After y4.** Item 18. Owns: Reducer `REFER_TO_UNITS`
(`:1998-2111`). · A new coordinator case `WITHDRAW_WARD_REQUEST` after `WITHDRAW_REFERRAL`, with its EVENT_ROLE entry
after `:1377`. · `WITHDRAWAL_REASONS` and its labels (`ward-change-reasons.ts:238-266`): add `coordinator_withdrew`
and the §2 list. · `withdrawnReferrals[].detail?` (`ward-model.ts:1133`), and a notice kind `ward_request_withdrawn`
after `referral_accepted_ward`. · `shortlist-panel.tsx`, and the y4 classification. · Tests: rewrite
`ward-movement-stage-changes.test.ts:446` to the first entry (re-referral adds no stage change); update
`ward-withdrawal-reason-privacy.test.ts` and the permission table; add `ward-re-referral-adds.test.ts`. Failing tests:
With A and B live, adding C gives A, B and C, and `referredAt` is unchanged. · With A, B and C live, adding D is
refused, naming the cap. · Withdrawing B with a reason removes only B, records the reason, and tells B. · An unlisted
reason, or a ward that isn't live, is refused. · Withdrawing the last ward sets the §4 blocker. · Live wards show
checked and locked. Mutations: restore `[...permitted]`; check the cap against the new list only. Tier: Sonnet.

### Lane RB — front-door referrals and the ED page

**RB1 · GP source (S). Starts now.** Item 25. Owns `ward-model.ts:1360`, `referral-intake.tsx:85`,
`community-screen.tsx:1485`, `tests/ward-referral-model.test.ts:220`, and one sentence in `referral-match.tsx`.
Failing tests: "gp" is accepted with its label; accept and decline raise no notice; the §4 sentence shows. Mutation:
give `gp` an addressee in `referralReferrer`. Tier: Sonnet.

**RB2 · Intake role follows source (S–M). After RB1; holds the `RECEIVE_REFERRAL` token.** Item 23, R9. Owns
EVENT_ROLE `:1591` (becomes `["community","ed"]`), the role check in `RECEIVE_REFERRAL` (`:3760`),
`referral-intake.tsx:1435`, and the comment at `ward-flow-roles.ts:26`. Failing tests: `ed_medical` sends as `ed`;
`ed` with police is refused; police, ambulance, crisis and GP send as `community`; existing community + `ed_medical`
tests still pass. Mutation: remove the refusal. Tier: Sonnet.

**RB3 · ED outcomes (M). After y4 and T1; holds the ED token.** Item 19. Owns: New cases `RECORD_ED_OUTCOME`
(`for_discharge` | `for_community_follow_up`) and `RECORD_LEFT_DEPARTMENT`, after `RECORD_NO_REFERRAL` (`:1736`), both
`["ed"]`. · `Movement.edOutcome?` and `leftDepartmentAt?`. · The ED board filter and counts (`ed-screen.tsx:963-1060`)
and chips (`:2270-2330`). · The y4 classification, a new `tests/ward-ed-outcomes.test.ts`, and an ED DOM test.
Recording an outcome unwinds like `WITHDRAW_REFERRAL`. It withdraws live requests, releases a held bed once, and
cancels an uncollected job. After collection it is refused, naming STOP_TRANSPORT. It then closes `did_not_proceed`,
with the outcome as the reason. Failing tests: After an outcome, the patient is on the ED board and in the chip, but
off the coordinator queue and the handover. · After "left", the patient is off the board. · A held bed is restored
exactly once. · Recording after collection is refused, and so is "left" without an outcome. Mutation: filter the board
by `!closure` again. Tier: Sonnet.

**RB4 · ED to community referral (L). After RB2, RB3 and Q2; holds the ED and `RECEIVE_REFERRAL` tokens.** Items 14
and 48. Owns: The ED panel (`ed-screen.tsx:2740-2900`): unmount the `REFER_TO_COMMUNITY_TEAM` control but keep the
event. · The intake pre-fill: `fromMovementId`, team, source, and role `ed`. · A `fromMovementId` branch in
`RECEIVE_REFERRAL`. The journey must be open, at this ED, and uncollected. The branch creates the referral, applies
RB3's outcome and raises the notice. · A new area-first helper in `referral-destination-options.ts`. Leave
`communityTeamOptions` untouched. · The notice kind `community_referral_received`, after `ward-model.ts:2302`,
addressed `{ role: "community", placeId: <team slug> }` and listed with "Mark as read" on the team page. · A new
`tests/ward-ed-community-referral.test.ts` that checks through the team hub's waiting list, plus an ED DOM test.
Failing tests: On Form 1A with no examination, the referral isn't offered, and "further examination ordered" still
doesn't offer it. After an outcome, it is offered with legal status. · A linked suburb lists that team first. Without
one, the list is alphabetical and shows the §4 sentence. · Sending lists it on the team hub, keeps the patient on the
ED board under "For community follow-up", restores the bed once and raises the notice. Mutations: remove the form
gate; skip the notice. Tier: Sonnet, plus the lane review.

**RB5 · Community acceptance for follow-up (M). After RB1.** Item 16, R7, R17. Owns: EVENT_ROLE `:1604`: add
`community`. · The guards at `reducer:4128`, `:4436` and `:4562`, and the cancellation map at `:4292`. · The stale
warning at `:4206-4272`: correct it, don't obey it. · `referralState` (`ward-referrals.ts:59`): decide from
non-community arms whenever there are any. · The accept controls in `community-screen.tsx` and `referral-match.tsx`.
Failing tests: A community acceptance leaves the ward and ED arms queued and answerable, and the ED lists and
coordinator worklist unchanged. · After a ward accepts, the community team can still accept or decline. · A
community-only referral, once accepted, reads "accepted". · A community team still cannot answer a ward arm.
Mutations: restore the any-arm guard; cancel queued arms when a community team accepts. Tier: Sonnet.

**RB6 · Bed referrals on the ED page (M). Drawing first; after RB4 releases the ED token.** Items 21 and 15. Owns:
`emergency-department-third-edition.html`: a new section and button, then regenerate the manifest and screen
verification. · `ed-screen.tsx`: the list, and a pre-filled raise form dispatching `RAISE_REFERRAL` with `referralId`
(no reducer change). · `referral-board.tsx`: an unavailable "Start the bed journey". Failing DOM tests: A bed referral
addressed to this ED is listed. · The button pre-fills the form, and submitting links the journey. · While that
journey is open, the button is `aria-disabled` with the engine's refusal. · A withdrawn referral isn't listed. Tier:
Sonnet. Catchers: the DOM tests and `check-drawing-rules.mjs`.

**RB7 · Correction notes (M). After y4.** Item 27. Owns: A new case `ADD_REFERRAL_CORRECTION` after
`RECORD_REFERRER_WITHDRAWAL`, for `["community","ed","coordinator"]`. · `Referral.corrections?`, and the typed-text
list in `ward-flow-provider.tsx`. · A read-only history and corrections view in `referral-match.tsx`. · A new
`tests/ward-referral-history-immutable.test.ts`: a static scan that only `RECEIVE_REFERRAL` writes `history:`. Failing
tests: a note is appended with role and time; history is unchanged; a note over 2,000 characters, or blank, is
refused; persistence stops after a note. Mutation: write `history:` in the new case. Tier: Sonnet.

### Order, overlap and review

**Order:** **T:** T1 and T2 now → T3 → T4a after y4 → T4b after Q1. · **Q:** Q1 now → Q2 after y4. Q3's withdrawal
half now; its examination half after legal T7. · **RA:** RA2 now; RA1 after y4. · **RB:** RB1 → RB2 → RB5. RB3 after
y4 and T1 → RB4 after Q2 → RB6. RB7 after y4.

**Shared across lanes, by region only:** The reducer, by case. · `ward-flow-events.ts`, by variant and EVENT_ROLE
line. · `ward-model.ts`, by type block, with notice kinds at distinct anchors. · `ward-change-reasons.ts`, by list: T3
`:52-57`, Q1 `:364-407`, RA1 `:238-266`. · `ward-event-permissions.test.ts`, `ward-notices.test.ts` and
`ward-flow-provider.tsx`, by entry. Every other file has one lane. Fold order: T → Q → RA → RB.

**Review:** one Opus adversarial review per lane before its fold. Veto invoked: this is the last check before a fold
that nobody reads line by line.

## 4. Exact on-screen wording

No Mental Health Act section numbers.

- **T1** "Transport cancelled; not booked again yet" · Officer: "Transport for {id} was cancelled ({reason}); the bed is
  still held and nothing has been rebooked." · Ward: "The transport bringing your patient for {id} was cancelled
  ({reason}); the bed is still held and nothing has been rebooked."
- **T2** "Delivered" · "Cannot confirm Delivered unless the receiving ward's recorded empty-bed count is above zero." ·
  Drawing: "4. Delivered"
- **T3** Places (proposed): "Back at the sending emergency department" · "At another emergency department" · "At a
  general hospital" · "With the transport crew" · "Another place — needs follow-up" · "Where is the patient now?" ·
  Officer: "Transport for {id} was stopped ({reason}). Where the patient is now: {place}."
- **T4** "Diverted on the way; the bed is still held until someone releases it" · Ward: "The transport bringing your
  patient for {id} was diverted ({reason}). The bed stays held until the coordinator, this ward or the referrer releases
  it." · ED: "{id} was diverted on the way ({reason}). The bed at {unit} stays held until someone releases it." ·
  "Record a diversion" · "Where is the patient being taken?" · "Release the held bed" · "Diverted; the held bed was
  released"
- **Q1** "Why is this urgent?" · "Choose a reason…" · "Flagged urgent by {role} at {time}." · "Who flagged this and when
  was not recorded." · "The factors below explain a wait; they do not order the queue."
- **Q2** "Mark as read" · "Read" · "Notices · {n} unread"
- **Q3** "The coordinator withdrew this ward's acceptance of {id}. The patient is not coming unless this ward is asked
  again." · "The examination for {id} was revoked after transport was booked. The bed stays held until a person decides
  whether to release it." · "The examination for {id} was revoked. The patient is not coming and the bed has been
  released."
- **RA1** "Withdraw this request" · "Why is this request being withdrawn?" · "Withdrawn by the coordinator." · "The
  request for {id} was withdrawn: {reason}." · "No ward is being asked"
- **RA2** "Acceptance withdrawn — no ward is being asked"
- **RB1** "General practitioner (GP)" · "This system does not contact the GP. Tell them by phone or letter."
- **RB3** "Record outcome" · "For discharge" · "For community follow-up" · "Left the department"
- **RB4** "Refer to a community team" · "Not offered until the examination outcome is recorded." · "Legal status:
  {status}" · "Team for the recorded home suburb" · "No home suburb is recorded, so no team is listed first." ·
  "Continue to the referral form" · "{ED} referred a patient for community follow-up: referral {id}."
- **RB6** "Bed requests from referrals" · "Request a bed from this referral" · "Start the bed journey" (shown
  unavailable with "Not wired in this prototype.")
- **RB7** "Add a correction" · "Corrections are added as new notes. The history sent with the referral is never
  changed."

## 5. Risks

**Tests that pin old behaviour (change them deliberately):** `ward-cancel-transport-no-bed-held.test.ts:239` and
`ward-transport-cancel-permission.test.ts:186` · `ward-priority.test.ts:273`, `:289`, `:402` and `:422` (the last pins
the 10-hour cap as a known gap) · `ward-movement-stage-changes.test.ts:446`, `ward-referral-model.test.ts:220` and
`ui-ward-roles.spec.ts:968` · `ward-change-reasons.test.ts:159`, `ward-declined-by-all-precedence.test.ts` and
`ward-notices.test.ts:324`. These stay green, because their event is kept: `ward-owner-decisions-2026-09-16.test.ts:64`
and `ward-audit-engine-fixes-2026-09-16.test.ts:173`.

**Permission table.** `tests/ward-event-permissions.test.ts:348` is hand-written and order-sensitive. Change it line
by line on purpose, and never derive it from `EVENT_ROLE`. Roles: add community to `CANCEL_TRANSPORT`, ed to
`RECEIVE_REFERRAL`, and community to `ACCEPT_REFERRAL`. · New events: `RECORD_DIVERSION`, `RELEASE_DIVERTED_BED`,
`MARK_NOTICE_READ`, `WITHDRAW_WARD_REQUEST`, `RECORD_ED_OUTCOME`, `RECORD_LEFT_DEPARTMENT` and
`ADD_REFERRAL_CORRECTION`.

**Fixture and figure changes:** Urgent reasons go from 8 to 10. · "For discharge" stops always reading zero. · RB3
raises `did_not_proceed` counts. · RB5 moves community hub and statistics counts, so re-run the claims register. ·
WF-018 (`ward-urgent-flag.test.ts:38`) keeps a flag with no who or when. · The handover fixture
(`ward-handover.test.ts:103`) holds no withdrawn acceptance. Check it.

**Identity is claimed, not proven.** A community team is identified by its team name, and `ed` by role alone
(`reducer:2251`). **Stopping transport still releases the bed automatically,** which sits badly with answers 6 and 29
(question 2). **Team notices have no viewer yet:** no chrome role exists for community teams, so RB4 lists their
notices on the team page; check that the slug matches `teamId`.

**Collisions with other plans:** Legal item 3 owns drawing line 534. · Legal T7 owns `RECORD_EXAMINATION`. · Legal T14
owns the release helper. · Legal T1, T3, T4, T8, T11 and T15 share the ED token. · The screens plan owns
`ward-bar.tsx:625-682`, and also touches the community, officer and ED screens.

## 6. Items 17 and 28: what I would need to know

**17 · The referrer withdraws only the community part after a ward accepts.** One referral can ask a ward for a bed
and a community team for follow-up at the same time. If the ward says yes, may the sender cancel only the follow-up
and keep the bed? I would need to know:

1. Does this happen in practice?
2. Who may do it: the referrer only, or the coordinator too?
3. Is the team told, and is a reason chosen from a list?

Today, once anything is accepted, this is refused (`reducer:4562`).

**28 · A journey with no transport.** Some patients reach the ward without a booked vehicle, such as a walk across the
same site with staff, or a lift from family. Today "Handover ready" needs a booked job (from `reducer:2780`). I would
need to know:

1. Does this happen?
2. Who records the arrival: the ward or the sending ED?
3. Is the way they travelled chosen from a fixed list?
4. Is this allowed for patients on a transport form?

## 7. Owner questions

1. **Diversions: who records them, and which reasons?** Recommendation: the transport officer or the coordinator,
   choosing from "Needs urgent medical care on the way", "The vehicle or crew was sent to an emergency", "The
   receiving ward can no longer take the patient" or "Another reason — needs follow-up". Places use the T3 list.
   This blocks T4a only.
2. **Stopping transport after collection releases the bed automatically.** Recommendation: treat a stop like a
   diversion, so the bed stays held until the coordinator, the ward or the referrer releases it. This matches
   answers 6 and 29. T3 keeps today's release unless he says yes.
3. **Which community team may cancel transport?** Recommendation: only the team that booked it, the same rule as
   wards. T1 builds on this reading.
4. **Urgent reasons: add two (making ten) or four (making twelve)?** Recommendation: two (§2).
