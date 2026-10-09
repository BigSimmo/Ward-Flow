import { describe, expect, it } from "vitest";

import { EVENT_ROLE, WARD_FLOW_ROLE_LABELS } from "../src/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/**
 * WHO MAY DO WHAT, written out by hand and compared for exact equality.
 *
 * WHY THIS EXISTS, and it is not a hypothetical. On 2026-08-30 three permissions were widened —
 * `RAISE_REFERRAL` from `["ed"]`, and `ACCEPT_REFERRAL`/`DECLINE_REFERRAL` from `["coordinator"]` —
 * and the entire ward suite stayed green. Nothing pinned the table. Every test that touches roles
 * reads `EVENT_ROLE[type][0]` FROM THE SOURCE, so both sides of every such assertion came from the
 * same place and no change to a permission could ever fail one.
 *
 * That is a permissions table with no guard, which is worse than an unguarded ordinary constant:
 * widening one is invisible in a diff review that is looking at the feature, and the widening
 * carried a real defect with it — the reducer went on recording every referral decision as the
 * coordinator's after a ward could make one.
 *
 * SO THIS LIST IS HAND-WRITTEN AND MUST STAY HAND-WRITTEN. Deriving it from `EVENT_ROLE` would
 * reproduce exactly the hole it closes. Updating it is the deliberate act; if a permission change
 * is right, change both and say which ruling permitted it.
 */
describe("who may raise which event", () => {
  const PERMISSIONS: Record<string, string[]> = {
    ACCEPT_IN_PRINCIPLE: ["ward"],
    // `ed` added 2026-08-30 under FD-3 AS SUPERSEDED BY THE OWNER: "every referral is
    // declinable, and NO CODE PATH MAY RENDER A REFERRAL WITH NO DECLINE AFFORDANCE". The ED
    // hub acts as `ed`, so without it an emergency department could not answer a referral
    // addressed to it — and the available workaround was to dispatch as `ward`, which writes
    // a FALSE `decidedBy` saying a ward refused what an ED refused.
    //
    // What the reducer writes for the newly-permitted role, as this guard demands:
    // `WARD_FLOW_ROLE_LABELS.ed`, a ROLE and never a person, so the record is truthful.
    // ⚠️ And the widening is SCOPED in the reducer rather than by this list: a role answers
    // its own destination kind and nothing else, so `ed` cannot decide on a ward bed and
    // `ward` can no longer decide on an emergency department's referral — which it could.
    // Pinned in `tests/ward-referral-decision-scope.test.ts`.
    //
    // 🔴 `community` ADDED 2026-09-17 under RB5 (item 16), SUPERSEDING the 2026-09-06
    // "decline only" ruling recorded on `DECLINE_REFERRAL` below. The owner's 2026-09-17 answer:
    // "a community team may accept, for follow-up only". What the reducer writes for the newly-
    // permitted role: `WARD_FLOW_ROLE_LABELS.community` in `decidedBy`, a ROLE and never a
    // person. ⚠️ Accepting still commits a service to taking the patient, but a COMMUNITY
    // acceptance commits it to FOLLOW-UP, never to a bed: `referralState` (`ward-referrals.ts`)
    // is the one place that distinction is kept, so a community acceptance alone never flips a
    // referral to `"accepted"` while a ward or ED destination is still queued, never cancels a
    // queued ward or ED arm, and never blocks a later ward/ED accept, decline or referrer
    // withdrawal. The role half alone was already scoped: `answerableBy` in the reducer carried
    // `community: "community_team"` (never `"any"`) in both handlers before this widening.
    // Pinned in `tests/ward-referral-reducer.test.ts` ("RB5 — a community team's own
    // acceptance...").
    ACCEPT_REFERRAL: ["ward", "coordinator", "ed", "community"],
    ADD_PATIENT: ["ed", "community", "coordinator"],
    // RB7, build plan item 27 (2026-09-17): the referrer's own team and the coordinator, never a
    // ward — see EVENT_ROLE's own comment on this entry.
    ADD_REFERRAL_CORRECTION: ["community", "ed", "coordinator"],
    ADVANCE_CLOCK: ["demo"],
    BLOCK_BED_RELEASE: ["ward"],
    // CHANGED 2026-08-30 under TR-D6 (owner), and this row is a NARROWING plus a widening, not
    // a tidy-up. Was ["coordinator", "ward"]. The ruling: the team that BOOKED it and the
    // coordinator may cancel; the RECEIVING ward may not, because a booking cancelled by the
    // destination is indistinguishable on the sending board from one that failed. Every
    // movement originates at an emergency department (`Movement.originEdId` is required), so
    // the booking team is `ed`.
    //
    // What the reducer writes for the newly-permitted role, as this guard demands: `ed` lands
    // in the `transport_cancelled` unwind record as `by`, which is a ROLE and never a person —
    // so no false attribution is introduced. Asserted directly in
    // `tests/ward-transport-cancel-permission.test.ts`.
    // `TR-D1` (OWNER, 2026-08-30): the sending ward or ED arranges transport, because the sending
    // team knows the facts the booking needs — whether an escort is required, whether the patient
    // is settled enough to travel. ⚠️ The bed COORDINATOR was rejected by name: it owns the bed
    // search and does not know the patient's state. `TR-D5` generalises it past bed placement,
    // which is why `ward` is here too.
    //
    // ⚠️ The asymmetry with CANCEL_TRANSPORT below is deliberate and is the interesting part: the
    // coordinator may CANCEL but may not BOOK. Booking needs knowledge of the patient; noticing a
    // booking that has become wrong needs knowledge of the whole network, which `CO-D2` says only
    // the coordinator has.
    //
    // What the reducer writes for these roles: `provider` from `TRANSPORT_PROVIDERS` and the
    // `escortRequired` answer the caller gave.
    //
    // `community` ADDED 2026-09-01 (OWNER): the booking belongs to whoever is SENDING the patient,
    // and a community team is one of those senders.
    //
    // ⚠️ And the widening is NOT scoped, because the model cannot scope it yet:
    // `Movement.originEdId` is required and `RAISE_REFERRAL` refuses an id that is not a real
    // emergency department, so there is no community-origin movement for it to be scoped to. A
    // community caller may book for ANY pulled movement. Recorded, not silently accepted.
    //
    // 🔴 CORRECTED 2026-09-15 under WLQ-11 (owner): the two paragraphs above used to end "so a
    // community booking is byte-identical to the ED's, and no false attribution can enter with the
    // widening" — TRUE THEN, FALSE NOW. `BOOK_TRANSPORT` now writes `transport.bookedBy: { role,
    // unitId?, placeId? }` for every booker, because `CANCEL_TRANSPORT` needs to tell the booker
    // from anyone else. `role` is recorded for `ed` and `community` too, so the byte-identical
    // claim is gone — see the superseded assertion in `tests/ward-book-transport.test.ts`.
    // `unitId` is recorded ONLY for a `ward` booker (its `actingUnitId` claim); `placeId` ONLY for
    // a `community` booker (its `actingPlaceId` claim, added under the owner's third ruling,
    // 2026-09-17, answer 9) — `ed` has no equivalent identity in this model, so `CANCEL_TRANSPORT`
    // still cannot check IT against who booked, and does not try to — see that row's own comment
    // below.
    BOOK_TRANSPORT: ["ed", "ward", "community"],
    // CHANGED AGAIN 2026-09-15 under WLQ-11 (owner): "whoever booked transport may cancel it; the
    // receiving ward still may not." `ward` returns to this list — see the long comment at
    // `tests/ward-transport-cancel-permission.test.ts` for why its 2026-08-30 removal was the right
    // fix for the wrong reason (TR-D6 excluded the receiving ward by excluding EVERY ward, because
    // the model could not yet tell them apart). The identity check now lives in the reducer:
    // `CANCEL_TRANSPORT`'s `ward` branch compares the caller's `actingUnitId` claim against
    // `transport.bookedBy`, and refuses when they differ OR when the job predates `bookedBy`
    // entirely (every pre-WLQ-11 seeded job).
    //
    // What the reducer writes for the newly-permitted role, as this guard demands: `ward` lands in
    // the `transport_cancelled` unwind record as `by`, exactly as `ed` and `coordinator` already do
    // — a ROLE, never a person. Asserted in `tests/ward-transport-cancel-permission.test.ts`.
    //
    // 🔴 `community` ADDED — owner's third ruling, 2026-09-17 (answer 9): "only the community team
    // that booked transport may cancel it." This row used to say `community` was handed back for
    // want of an identity claim; `actingPlaceId` (the same claim-not-proof discipline as
    // `actingUnitId`, plumbed through `BOOK_TRANSPORT` too) is what closed that gap. Same shape as
    // the `ward` branch: `CANCEL_TRANSPORT`'s `community` branch compares the caller's
    // `actingPlaceId` claim against `transport.bookedBy.placeId`, and refuses when they differ or
    // when the job carries no `community` booker at all. Asserted in
    // `tests/ward-transport-cancel-permission.test.ts`.
    CANCEL_TRANSPORT: ["coordinator", "ed", "ward", "community"],
    CHANGE_LEGAL_STATUS: ["coordinator", "ed"],
    CHANGE_URGENCY: ["coordinator", "ed"],
    CLEAR_BED_RELEASE_BLOCK: ["ward"],
    CONFIRM_BED_RELEASE: ["ward"],
    CONFIRM_CAPACITY: ["ward"],
    // T4 (`docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`), `ed` alone, on
    // `RECORD_LEGAL_FORM_RECEIVED`'s own reasoning: the department physically holding the form is
    // who can say a receipt was recorded in error.
    CORRECT_LEGAL_FORM_RECEIPT: ["ed"],
    DECLINE: ["ward"],
    // `ed` added 2026-08-30 under FD-3 AS SUPERSEDED BY THE OWNER: "every referral is
    // declinable, and NO CODE PATH MAY RENDER A REFERRAL WITH NO DECLINE AFFORDANCE". The ED
    // hub acts as `ed`, so without it an emergency department could not answer a referral
    // addressed to it — and the available workaround was to dispatch as `ward`, which writes
    // a FALSE `decidedBy` saying a ward refused what an ED refused.
    //
    // What the reducer writes for the newly-permitted role, as this guard demands:
    // `WARD_FLOW_ROLE_LABELS.ed`, a ROLE and never a person, so the record is truthful.
    // ⚠️ And the widening is SCOPED in the reducer rather than by this list: a role answers
    // its own destination kind and nothing else, so `ed` cannot decide on a ward bed and
    // `ward` can no longer decide on an emergency department's referral — which it could.
    // Pinned in `tests/ward-referral-decision-scope.test.ts`.
    // `community` ADDED 2026-09-06 — owner ruling. A community team may decline a referral
    // addressed to it. (RB5, 2026-09-17, has since added `community` to `ACCEPT_REFERRAL` above
    // too — see that row's own comment — so the two lists no longer differ on this role.)
    // ⚠️ And the role half alone was the dangerous half: `answerableBy` carried
    // `community: "any"`, which skips the ownership check, so this list gaining `community`
    // without that map changing would have let a community team decline a PSYCHIATRIC WARD bed.
    // Both shipped together; scoped in the reducer and pinned in
    // `tests/ward-referral-decision-scope.test.ts`.
    DECLINE_REFERRAL: ["ward", "coordinator", "ed", "community"],
    END_LEAVE_BED: ["ward"],
    FLAG_BED_RELEASE: ["ward"],
    HANDOVER_READY: ["ed"],
    /* Widened from ["ward"] on 2026-09-01 by owner ruling: a pull is a person's act, from the ward
     * menu OR the coordinator. Named here deliberately rather than widened by accident, per this
     * file's own instruction. */
    PULL_PATIENT: ["ward", "coordinator"],
    /* Widened to ["officer", "ward"] by Ruling 6 / Invariant I-05: ward staff can confirm physical arrival. */
    PATIENT_ARRIVED: ["officer", "ward"],
    PATIENT_COLLECTED: ["officer"],
    RAISE_REFERRAL: ["ed", "community", "ward"],
    /* Widened to ["community", "ed"] by R9 (owner item 23, 2026-09-17): only `ed_medical` is
     * raised as `ed`, and the reducer's own `RECEIVE_REFERRAL` case refuses role `ed` paired with
     * any other source — a pairing this table cannot itself express. */
    RECEIVE_REFERRAL: ["community", "ed"],
    RECORD_ESCALATION: ["coordinator"],
    RECORD_EXAMINATION: ["ed"],
    /* Ruling 1: ED marks Form 1A as received. CORRECTED 2026-09-17, T2r fix round, finding 10:
     * "starting the 24h statutory clock" is now false — that computed clock was deleted by T2 on
     * owner answer 1, and this event still records only the receipt instant. */
    RECORD_LEGAL_FORM_RECEIVED: ["ed"],
    // T2 (2026-09-17 build plan), owner answer 1 and item 5 (regional extensions). `ed` on
    // `RECORD_LEGAL_FORM_RECEIVED`'s own reasoning: the department holding the form reads the
    // expiry off it. `coordinator` joins it here for extensions specifically — item 5 names "the
    // clinician" generally rather than the department alone, unlike Ruling 1's `ed`-only receipt.
    RECORD_LEGAL_FORM_EXPIRY: ["ed", "coordinator"],
    // Opus review round 2, 17 September 2026 (P2). `ed` and `coordinator` — the two roles that
    // actually see a `gender_designation` refusal on screen (the ED intake and the coordinator's
    // movement drawer), on the same reasoning `RECORD_LEGAL_FORM_EXPIRY` above already carries for
    // `coordinator` joining `ed`.
    RECORD_MOVEMENT_GENDER: ["ed", "coordinator"],
    RECORD_MEDICAL_CLEARANCE: ["ed"],
    /* ADDED 2026-09-04, owner rulings R-2026-09-04-C and -D.
     *
     * `RECORD_TRANSPORT_NEED` mirrors `BOOK_TRANSPORT`'s three senders INCLUDING its exclusion:
     * `TR-D1` rejects the coordinator from booking by name, because it owns the bed search and
     * does not know whether this patient can travel. Whether transport is needed at all is that
     * same knowledge one step earlier, so the same role is refused it.
     *
     * `RECORD_NO_REFERRAL` is `ed`-only on `RECORD_MEDICAL_CLEARANCE`'s reasoning: the department
     * physically holding the patient is the only party that can say nobody referred them. A
     * coordinator would be inferring it from its own empty search, which is the inference the
     * ruling exists to replace. */
    RECORD_TRANSPORT_NEED: ["ed", "ward", "community"],
    // Owner Answer 18 (second round, 2026-09-17): the ward's own answer to what is currently
    // limiting its intake, same role as CONFIRM_CAPACITY above.
    RECORD_WARD_INTAKE_CONSTRAINTS: ["ward"],
    RECORD_NO_REFERRAL: ["ed"],
    RECORD_LEAVE_BED: ["ward"],
    RECORD_LOCAL_BED_SOUGHT: ["coordinator"],
    /* Ruling 16: Direct ED-to-CMHT referral pathway. */
    REFER_TO_COMMUNITY_TEAM: ["ed"],
    REFER_TO_UNITS: ["coordinator"],
    /* A ward records that one of its own patients has left. Ward-only because it is a statement
     * about that ward's own beds - see `RECORD_LEAVING` in the reducer, which refuses any acting
     * unit other than the one holding the admission. */
    RECORD_LEAVING: ["ward"],
    /* ADDED 2026-09-01. Two new events, one fact: a ward records that one of its own occupants has
     * gone out to an emergency department, and that they are back. Ward-only for the reason
     * `RECORD_LEAVING` directly above is — it is a statement about that ward's own bed, and the
     * reducer refuses any acting unit other than the one holding the admission. The coordinator
     * cannot see somebody walk out of a building; an emergency department, which is where the
     * patient physically IS, holds no ward bed to act as.
     *
     * What the reducer writes for these roles, as this guard demands: an instant on the admission,
     * and `null` back again. No role name, no team, no person — so no false attribution can enter
     * with either, and no capacity figure moves in either direction. Asserted directly in
     * `tests/ward-away-at-emergency-department.test.ts`. */
    /* ADDED 2026-09-01. `Movement.blocker` — the free-prose one, NOT the `BedReleaseBlocker` enum
     * that shares the name — had one writer, at creation, and no transition ever touched it again.
     * This is the human half of the repair; `STAGE_TRANSITION_BLOCKERS` in the reducer is the other.
     *
     * The list mirrors `WITHDRAW_REFERRAL` below: whoever may raise a movement may say what is
     * holding it up, plus the coordinator. They are not interchangeable — a ward knows its bed
     * is not clean, an emergency department knows a family has not been reached, and only the
     * coordinator can say no bed exists anywhere in the network.
     *
     * ⚠️ WIDENED 2026-09-01 to add `officer`, and this row is where the change is deliberate rather
     * than incidental. The exclusion read "the transport legs already restate this field through
     * the events an officer raises", which was FALSE when written: an officer raises exactly four
     * events, and `TRANSPORT_ACCEPTED` and `TRANSPORT_EN_ROUTE` restated nothing, so the two legs
     * that made the standing sentence false were the two that left it stale. Both restate now — and
     * the premise still does not carry the exclusion, because every other permitted role also
     * raises restating events (`REFER_TO_UNITS`, `ACCEPT_IN_PRINCIPLE`, `BOOK_TRANSPORT`), so the
     * argument applied evenly would empty this list. What earns a seat here is being the only
     * observer of something: between `TRANSPORT_EN_ROUTE` and `PATIENT_COLLECTED` a diverted
     * ambulance or a stood-down crew has no event at all, and the officer is the only party who
     * sees it.
     *
     * What the reducer writes for these roles, as this guard demands: THE CALLER'S OWN PROSE AND
     * NOTHING ELSE — no role name, no team, no person — so none of the five can introduce a false
     * attribution, and the record never claims who said it. That is what makes the widening safe as
     * well as right. Asserted directly in `tests/ward-movement-blocker.test.ts`. */
    /* ADDED 2026-09-01, and this pair is the mechanism the owner asked for on 2026-08-30 that
     * nobody could reach: `Movement.flaggedUrgent` had a ranking rule above it and a badge below
     * it, and its only writer was the literal `false` at creation.
     *
     * ⚠️ The list MIRRORS `CHANGE_URGENCY` above deliberately. `queueOrder` puts this flag ABOVE
     * all three tiers, so it must not be easier to raise than the tier it outranks — a wider list
     * would let somebody who may not move a patient from tier 3 to tier 1 put them above every
     * tier 1 instead. `ward` is excluded by name: a receiving ward that could flag would be able
     * to promote the patient it is about to accept above every other ward's.
     *
     * What the reducer writes for these roles, as this guard demands: `flaggedUrgent: true` or
     * `false` and NOTHING else — no role, no reason, no timestamp — so neither role can introduce
     * a false attribution, because the record makes none. That absence is a known limit, recorded
     * on the events themselves. Asserted directly in `tests/ward-urgent-flag.test.ts`. */
    FLAG_MOVEMENT_URGENT: ["coordinator", "ed"],
    CLEAR_MOVEMENT_URGENT_FLAG: ["coordinator", "ed"],
    RECORD_MOVEMENT_BLOCKER: ["ed", "community", "ward", "coordinator", "officer"],
    /* ADDED 2026-09-01, repairing a hole `RECORD_MOVEMENT_BLOCKER` opened the same day: the field
     * accepted any prose while `hasActiveBlocker` recognised "nothing is blocking" case-sensitively,
     * so a person clearing a blocker with "none — resolved" left the movement scoring ten points as
     * obstructed. Clearing now has its own representation instead of a magic word.
     *
     * IDENTICAL to `RECORD_MOVEMENT_BLOCKER` above and deliberately never narrower: whoever may say
     * what is holding a patient up may say it has stopped. A clearing permission narrower than the
     * recording one is how a queue fills with obstructions nobody present can remove.
     *
     * `officer` added here with its partner on 2026-09-01: an officer who may record "ambulance
     * diverted" and may not then say it is resolved leaves a sentence only somebody who cannot see
     * the vehicle can retract, which is the narrower-clearing hole this row exists to refuse.
     *
     * What the reducer writes for these roles, as this guard demands: one fixed sentinel from
     * `BLOCKERS_MEANING_NOTHING_IS_BLOCKING` and NOTHING else — no role, team or person — so none of
     * the five can introduce a false attribution. Asserted in `tests/ward-movement-blocker.test.ts`. */
    CLEAR_MOVEMENT_BLOCKER: ["ed", "community", "ward", "coordinator", "officer"],
    RECORD_AWAY_AT_EMERGENCY_DEPARTMENT: ["ward"],
    RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT: ["ward"],
    RELEASE_BED: ["ward"],
    // Owner answer 8 (second round, 2026-09-17): the coordinator, the ward, or the referrer.
    RELEASE_HELD_BED: ["coordinator", "ward", "ed"],
    // Build plan item 29 (T4a) / OA-29: the coordinator, the accepting ward, or the original referrer.
    RELEASE_DIVERTED_BED: ["coordinator", "ward", "ed"],
    RELEASE_PULL: ["coordinator", "ward"],
    REQUEST_CAPACITY_REFRESH: ["coordinator"],
    RESET_SCENARIO: ["demo"],
    REVERT_BED_RELEASE: ["ward"],
    SET_BED_PREPARATION: ["ward"],
    SET_SCENARIO: ["demo"],
    TRANSPORT_ACCEPTED: ["officer"],
    TRANSPORT_EN_ROUTE: ["officer"],
    /* Every role that can RAISE a referral can take it back, plus the coordinator. Deliberately
     * wider than `RAISE_REFERRAL`: withdrawal is refused by the reducer unless the referral is
     * still live and unaccepted — OR (WLQ-38, owner, 2026-09-15) unless the caller is `ed` or
     * `coordinator` and the referral has been accepted but the patient has not yet been collected —
     * so the narrowing is done by state and by role together rather than by this list alone. See
     * `tests/ward-withdraw-referral.test.ts` for the accepted-referral cases this list cannot show
     * on its own. */
    WITHDRAW_REFERRAL: ["ed", "community", "ward", "coordinator"],
    /* WLQ-38 (owner, 2026-09-15): the referrer or the coordinator may stop a journey once the
     * patient has been collected, which `CANCEL_TRANSPORT` refuses to do. `ward` is deliberately
     * absent — the ruling names the referrer and the coordinator, not the receiving ward, and this
     * event has no booker-identity field a `ward` claim could be checked against the way
     * `CANCEL_TRANSPORT`'s does.
     *
     * What the reducer writes for these roles, as this guard demands: `event.role` into
     * `TransportJob.stoppedBy` — a ROLE, never a person, the same discipline every other `by`/actor
     * field in this model already holds to. Asserted in `tests/ward-stop-transport.test.ts`. */
    STOP_TRANSPORT: ["coordinator", "ed"],
    // Build plan item 29 (T4a) / R2-7: the transport officer or the coordinator.
    RECORD_DIVERSION: ["officer", "coordinator"],
    /* ADDED 2026-09-04, Task 5 (ward-flow movement step-track plan), owner ruling F1: only the
     * coordinator may raise either event. F1's ENTIRE enforcement is this one-role table entry —
     * the reducer's generic role check rejects any other role before either event's payload is
     * even inspected, exactly as it does for every other role-gated event above.
     *
     * `STEP_BACK_STAGE` is the coordinator's own record correction (moves `stage` backwards,
     * touches nothing else). `WITHDRAW_ACCEPTANCE` is the coordinator undoing a WARD's earlier
     * "yes" — a different act on a different actor's decision from `WITHDRAW_REFERRAL` above
     * (the REFERRER taking its own referral back), despite sharing the English verb "withdraw".
     *
     * What the reducer writes for this role, as this guard demands: `event.role` ("coordinator")
     * into both a `stageChanges` entry's `by` and an `unwinds` entry's `by` — a ROLE, never a
     * person, the same discipline every other `by` field in this model already has. Asserted
     * directly in `tests/ward-movement-step-back-reducer.test.ts`. */
    STEP_BACK_STAGE: ["coordinator"],
    WITHDRAW_ACCEPTANCE: ["coordinator"],
    // RA1 (item 18, owner answer 18, 2026-09-17): the shortlist is the coordinator's own tool, and
    // nobody else holds a live request on a movement to take back — see the event's own doc comment
    // in `ward-flow-events.ts`. What the reducer writes for this role: `reason: "coordinator_withdrew"`
    // on the `withdrawnReferrals` entry — a ROLE-derived code, never a person, the same discipline
    // `another_unit_accepted`/`referrer_withdrew` already hold to. Asserted directly in
    // `tests/ward-re-referral-adds.test.ts`.
    WITHDRAW_WARD_REQUEST: ["coordinator"],
    // Item 48, Q2 (owner answer 48, 2026-09-17): every role a notice can be addressed to may mark
    // its OWN notice read. `community` is included though no community screen dispatches this yet
    // (`ward-chrome-role.ts`'s `WardChromeRole` has no community member — RB4's gap, not Q2's) —
    // the reducer's addressee check is the real gate, not this list.
    //
    // What the reducer writes for the newly-permitted roles, as this guard demands: `event.role`
    // into `Notice.readBy` — a ROLE, never a person, the same discipline every other `by`/actor
    // field in this model already has. Asserted directly in `tests/ward-notice-read.test.ts`.
    MARK_NOTICE_READ: ["coordinator", "ed", "ward", "officer", "community"],

    /*
     * THE THREE INBOX WORK-STATE EVENTS, added 2026-09-06 with the coordinator's to-do panel.
     *
     * `["coordinator"]` because `coordinator/exception-drawer.tsx` is the only thing in `src/` that
     * renders an `InboxItem` — this codebase's own principle is that unique observation earns the
     * seat, so a role with no way to SEE a row does not get a way to act on it. ⚠️ Recorded as a
     * FLOOR, not a ceiling: the day the inbox is surfaced to a ward or an ED screen, this list is
     * what should widen, and the reducer's shape is not.
     *
     * 🔴 What the reducer writes for this role, which is what this guard exists to make somebody
     * check: `event.role` into an acknowledgement's or a completion's `by` — a ROLE, never a
     * person, the same discipline as every other `by` in this model. And ACKNOWLEDGE is the one
     * that matters: it records who is on a live clinical or legal fact WITHOUT removing the row,
     * because a breached statutory form must not be dismissible by anybody at any permission.
     */
    ACKNOWLEDGE_INBOX_ITEM: ["coordinator"],
    COMPLETE_INBOX_ITEM: ["coordinator"],
    REOPEN_INBOX_ITEM: ["coordinator"],
    // 2026-09-07. The ED psychiatry team records that a referred person is physically in the
    // department — the only door from the Expects list to the Referrals list. `ed` alone, and
    // narrowly: the owner named the party ("the ED psychiatry doctors notice the patient has
    // arrived in ED"), and no other role can see who is standing in that department. The
    // coordinator is not in the building.
    RECORD_ARRIVED_IN_DEPARTMENT: ["ed"],
    /**
     * FD-5 (O-17.11, 2026-09-12). The referrer rings to take a referral back and somebody writes it
     * down. `coordinator` alone, and this is a PLAN JUDGEMENT flagged rather than a ruling: who
     * takes that call is a product question nobody has answered — plausibly the coordinator holding
     * the referral, plausibly the ward or emergency department it was addressed to.
     *
     * ⚠️ **Narrow is the reversible direction here, and the asymmetry is why.** A role added later
     * is one line. A role wrongly permitted writes `withdrawalRecordedBy` entries misattributing who
     * took the call, and a recorded attribution cannot be un-recorded.
     *
     * 🔴 What the reducer writes for this role, which is what this guard exists to make somebody
     * check: `WARD_FLOW_ROLE_LABELS[event.role]` into `withdrawalRecordedBy` — **a ROLE, and
     * deliberately never the withdrawing party**, who is a referrer outside this system and must not
     * be named by it.
     */
    // Owner, 4 October 2026: the referrer's own side may record it too, scoped in the reducer.
    RECORD_REFERRER_WITHDRAWAL: ["coordinator", "community", "ed"],
    // Q004 Task 3: ward-owned patient discharge; bounded record access; coordinator audit review.
    // Keep this independent of EVENT_ROLE so widening any domain role still fails here.
    RECORD_ADMISSION_CARE: ["ward", "coordinator", "community"],
    RECORD_ADMISSION_FOLLOW_UP: ["ward", "coordinator"],
    RECORD_PATIENT_DISCHARGE: ["ward"],
    OPEN_DISCHARGE_RECORD: ["coordinator", "ward", "community"],
    REVIEW_AUDIT_EVENT: ["coordinator"],
    // Settings wiring (2026-09-16, the owner's "wire some up for real"): the ED access target, the
    // parallel referral cap and the pulled-bed hold are coordinator settings. The reducer refuses
    // every other role (`tests/ward-configuration-reducer.test.ts`).
    SET_CONFIGURATION: ["coordinator"],
    // Item 19 (owner, 2026-09-17): ED staff records that a patient has physically left the department.
    RECORD_LEFT_DEPARTMENT: ["ed"],
    // RB3, item 19: the department holding the patient records the outcome — same reasoning as
    // RECORD_LEFT_DEPARTMENT above.
    RECORD_ED_OUTCOME: ["ed"],
    SET_ARRIVAL_DETAILS: ["coordinator", "ed", "ward", "community"],
    SET_STEP_DOWN_CANDIDATE: ["ward", "coordinator"],
    SET_DISCHARGE_BARRIER: ["ward", "coordinator"],
    RECORD_ED_MEDICAL_DETERIORATION: ["ed"],
    RECORD_MOVEMENT_MEDICAL_CLEARANCE: ["ed", "coordinator", "ward", "community"],
    UPLOAD_PATIENT_FORM: ["coordinator", "ed", "ward", "community", "officer"],
    RECORD_LEGAL_FORM_WRITTEN: ["ed", "coordinator", "ward", "community"],
    RECORD_COUNTRY_EXTENSION: ["ed", "coordinator"],
    RECORD_LEGAL_FORM_CONTINUATION: ["ed", "coordinator", "ward", "community"],
    EVALUATE_ARRIVAL_LATENESS: ["coordinator", "ed", "ward"],
    RELEASE_AND_REOPEN_SEARCH: ["coordinator", "ward"],
    CLEAR_EXPECT_FLAG: ["ward", "coordinator", "ed", "community"],
    RAISE_EXPECT_FLAG: ["ward", "coordinator", "ed", "community"],
    FLAG_LEGAL_MISMATCH: ["ward", "coordinator"],
    EVALUATE_LEAVE_BED_WARNINGS: ["ward", "coordinator"],
    CONFIRM_MORNING_ROLLUP: ["ward", "coordinator"],
    SEND_WARD_BUZZ: ["coordinator", "bed_manager", "executive"],
    // Recorded 2026-09-25 (test fixer) at the roles the engine already enforces. Added by unreviewed
    // 23-25 Sept commits (6eec76bd85, 65090c4db6, 5d7f438126) with no written ruling; pinned here so
    // any later widening still fails, which is this table's job.
    RECORD_REPATRIATION: ["coordinator"],
    RECORD_HANDOVER_SIGN_OFF: ["coordinator", "ward"],
    RECORD_CLINICAL_CONTACT: ["community", "coordinator", "ed"],
    DISPATCH_BROADCAST_ALERT: ["coordinator", "bed_manager", "executive"],
    ACKNOWLEDGE_BROADCAST_ALERT: ["coordinator", "ward", "ed", "officer", "community", "bed_manager", "executive"],
    STAND_DOWN_BROADCAST_ALERT: ["coordinator", "bed_manager", "executive"],
    UPDATE_EXPECTED_DISCHARGE: ["ward", "coordinator"],
    // Stream D planned admissions, 9 Oct 2026: booked and managed by the coordinator, bed manager
    // or the receiving ward; arrival recorded by the ward or coordinator.
    BOOK_PLANNED_ADMISSION: ["coordinator", "bed_manager", "ward"],
    CHANGE_PLANNED_ADMISSION: ["coordinator", "bed_manager", "ward"],
    CANCEL_PLANNED_ADMISSION: ["coordinator", "bed_manager", "ward"],
    CONVERT_PLANNED_ADMISSION: ["ward", "coordinator"],
    // Advisory carer/PSP/MHAS checklist, 9 Oct 2026 (stream B): recorded where the move completes.
    RECORD_SUPPORT_NOTIFICATION: ["ward", "coordinator"],
  };

  it("covers every event that exists, so a new event cannot arrive unpermissioned", () => {
    expect(Object.keys(EVENT_ROLE).sort()).toEqual(Object.keys(PERMISSIONS).sort());
  });

  it("grants exactly these roles and no others", () => {
    for (const [event, roles] of Object.entries(PERMISSIONS)) {
      expect(
        [...EVENT_ROLE[event as keyof typeof EVENT_ROLE]],
        `${event}'s permitted roles changed. A permission is never widened by accident: name the ` +
          "ruling that permitted it, check what the reducer writes for the newly-permitted role, " +
          "and update this list deliberately.",
      ).toEqual(roles);
    }
  });

  it("gives every role a decision label, so a decision can never be recorded against a blank", () => {
    const roles = new Set(Object.values(PERMISSIONS).flat());
    expect(roles.size).toBeGreaterThan(1);
    for (const role of roles) {
      expect(WARD_FLOW_ROLE_LABELS[role as keyof typeof WARD_FLOW_ROLE_LABELS], `${role} has no label`).toBeTruthy();
    }
  });

  it("keeps the table discriminating — not every event permits every role", () => {
    // A table that granted everything to everyone would satisfy the assertions above just as well.
    const allRoles = new Set(Object.values(PERMISSIONS).flat());
    const singleRoleEvents = Object.values(PERMISSIONS).filter((roles) => roles.length === 1);
    expect(singleRoleEvents.length).toBeGreaterThan(0);
    expect(allRoles.size).toBeGreaterThan(2);
  });
});

describe("PATIENT_ARRIVED destination ward permissions", () => {
  it("allows destination ward staff with actingUnitId matching acceptedUnitId to confirm arrival", () => {
    const state = seedWardFlowState();
    const movement = state.movements.find((m) => m.id === "WF-014")!;
    expect(movement.stage).toBe("moving");
    expect(movement.acceptedUnitId).toBe("rph-adult-secure");
    expect(movement.transport?.collectedAt).toBeDefined();

    const next = wardFlowReducer(state, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      now: NOW_ANCHOR,
      movementId: "WF-014",
      actingUnitId: "rph-adult-secure",
    });

    expect(next.rejections).toHaveLength(state.rejections.length);
    const updatedMovement = next.movements.find((m) => m.id === "WF-014")!;
    expect(updatedMovement.stage).toBe("arrived");
    expect(updatedMovement.closure?.outcome).toBe("arrived");
  });

  it("rejects arrival confirmation when dispatched with a different ward's actingUnitId", () => {
    const state = seedWardFlowState();
    const next = wardFlowReducer(state, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      now: NOW_ANCHOR,
      movementId: "WF-014",
      actingUnitId: "scgh-adult-open",
    });

    expect(next.rejections.length).toBeGreaterThan(state.rejections.length);
    const latestRejection = next.rejections[next.rejections.length - 1];
    expect(latestRejection.attempted).toBe("PATIENT_ARRIVED");
    expect(latestRejection.reason).toContain(
      "ward scgh-adult-open cannot confirm arrival for a patient accepted at rph-adult-secure",
    );

    const unchangedMovement = next.movements.find((m) => m.id === "WF-014")!;
    expect(unchangedMovement.stage).toBe("moving");
  });
});
