// `EVENT_ROLE`: which roles may raise each Ward Flow event, read by the reducer's role check.
// Moved out of `ward-flow-events.ts` unchanged; that file re-exports it.
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";

/**
 * One table, read by the reducer's role check, rather than a `switch` repeated at every call
 * site. Adding an event here without an entry is a compile error, which is the point.
 *
 * Widened from one role per event to a non-empty list of permitted roles (this task, spec D2).
 * `CHANGE_URGENCY` and `CHANGE_LEGAL_STATUS` are the first events with more than one — both a
 * coordinator and the referring ED clinician may record either change — and Task 3's events need
 * the same shape, so the table is widened here rather than special-cased per event.
 *
 * The coordinator may take every action except the demonstration controls (Josh, 10 Oct 2026), so
 * every non-demo entry lists `coordinator`. `tests/ward-role-permissions.test.ts` pins that. Older
 * notes on single entries below that keep the coordinator out (TR-D1 and others) are superseded.
 */
export const EVENT_ROLE: Record<WardFlowEvent["type"], readonly WardFlowRole[]> = {
  RECORD_ADMISSION_CARE: ["ward", "coordinator", "community"],
  RECORD_ADMISSION_FOLLOW_UP: ["ward", "coordinator"],
  RECORD_PATIENT_DISCHARGE: ["ward", "coordinator"],
  UPDATE_EXPECTED_DISCHARGE: ["ward", "coordinator"],
  OPEN_DISCHARGE_RECORD: ["coordinator", "ward", "community"],
  REVIEW_AUDIT_EVENT: ["coordinator"],
  /**
   * Owner ruling FD-25, 2026-08-30: a referral is raised by whoever is with the patient, and that
   * is not only an ED. A ward refers to a medical ward or to a community team; a community service
   * refers in. Widened from `["ed"]` accordingly.
   *
   * `edId` on this event is now an ORIGIN of any kind, not an emergency department — the name is
   * left alone in this pass because renaming it touches every raise path, and a half-renamed field
   * is worse than an accurate comment. Recorded here so the next reader does not take the name as
   * a constraint.
   */
  RAISE_REFERRAL: ["ed", "community", "ward", "coordinator"],
  RECORD_EXAMINATION: ["ed", "coordinator"],
  RECORD_MEDICAL_CLEARANCE: ["ed", "coordinator"],
  /* The ED psychiatry team is the only party that can see whether somebody is standing in their
     department, and the owner named them specifically (2026-09-07): "the ED psychiatry doctors
     notice the patient has arrived in ED". Not the coordinator, who is not in the building. */
  RECORD_ARRIVED_IN_DEPARTMENT: ["ed", "coordinator"],
  /*
   * MIRRORS `BOOK_TRANSPORT` BELOW, INCLUDING ITS EXCLUSION — the sending team, and not the
   * coordinator. `TR-D1` rejects the coordinator from booking BY NAME because "it owns the bed
   * search and does not know whether this patient needs an escort or is settled enough to travel".
   * Whether transport is needed at all is the same knowledge one step earlier, so the same three
   * senders may answer it and the same role may not. A coordinator who could record "no transport
   * needed" would be answering a question about a patient it has never seen.
   */
  RECORD_TRANSPORT_NEED: ["ed", "ward", "community", "coordinator"],
  /*
   * `ed` ALONE: the department physically holding the form is who can mark it received. Widened
   * codes (1A, 3A, 3C, 3D, 6A, 6B, 6C, 5A, 5B) do not widen the role.
   */
  RECORD_LEGAL_FORM_RECEIVED: ["ed", "coordinator"],
  /*
   * T4 (`docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`). `ed` alone, on
   * `RECORD_LEGAL_FORM_RECEIVED`'s own reasoning immediately above: the department physically
   * holding the form is who can say a receipt was recorded in error.
   */
  CORRECT_LEGAL_FORM_RECEIPT: ["ed", "coordinator"],
  /*
   * T2 (`docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`). `ed`, on
   * `RECORD_LEGAL_FORM_RECEIVED`'s own reasoning: the department physically holding the form is
   * who reads the expiry off it. `coordinator` joins it here — unlike that event, this one is also
   * how a regional EXTENSION gets recorded, and item 5's own wording ("the clinician records the
   * extension") does not name the department alone the way Ruling 1 named `ed` for receipt.
   */
  RECORD_LEGAL_FORM_EXPIRY: ["ed", "coordinator"],
  // Opus review round 2, 17 September 2026 (P2). `ed` and `coordinator`, named explicitly in the
  // brief this event answers — both are places a gender_designation refusal is actually seen (the
  // ED intake screen and the coordinator's movement drawer), and both are roles that already
  // record gender elsewhere on this file (`RAISE_REFERRAL`'s `draft.gender`).
  RECORD_MOVEMENT_GENDER: ["ed", "coordinator"],
  RECORD_NO_REFERRAL: ["ed", "coordinator"],
  // RB3, item 19: the department that holds the patient records the outcome — the same "who
  // physically holds the patient" reasoning RECORD_LEFT_DEPARTMENT's own entry uses below.
  RECORD_ED_OUTCOME: ["ed", "coordinator"],
  REFER_TO_UNITS: ["coordinator"],
  ACCEPT_IN_PRINCIPLE: ["ward", "coordinator"],
  /* Owner ruling 2026-09-01: a pull is always a person's act — *"only a person can do this who is
   * interacting from the ward menu or the coordinator"*. Widened from ward-only deliberately, and the
   * reducer refuses it against a bed that is not ready whichever role raises it. */
  PULL_PATIENT: ["ward", "coordinator"],
  DECLINE: ["ward", "coordinator"],
  HANDOVER_READY: ["ed", "coordinator"],
  TRANSPORT_ACCEPTED: ["officer", "coordinator"],
  TRANSPORT_EN_ROUTE: ["officer", "coordinator"],
  PATIENT_COLLECTED: ["officer", "coordinator"],
  PATIENT_ARRIVED: ["officer", "ward", "coordinator"],
  CONFIRM_CAPACITY: ["ward", "coordinator"],
  // Owner Answer 18, second round, 2026-09-17: the ward's own answer to what is currently
  // limiting its intake, same role as CONFIRM_CAPACITY above.
  RECORD_WARD_INTAKE_CONSTRAINTS: ["ward", "coordinator"],
  RECORD_ESCALATION: ["coordinator"],
  ADVANCE_CLOCK: ["demo"],
  RESET_SCENARIO: ["demo"],
  SET_SCENARIO: ["demo"],
  // Task 3 of the audit-wiring plan: only a coordinator may save the settings-screen draft.
  SET_CONFIGURATION: ["coordinator"],
  CHANGE_URGENCY: ["coordinator", "ed"],
  CHANGE_LEGAL_STATUS: ["coordinator", "ed"],
  RELEASE_PULL: ["coordinator", "ward"],
  // TR-D6 (owner, 2026-08-30): the team that BOOKED it, and the coordinator. The sending team
  // owns the job (TR-D5) and every movement originates at an emergency department
  // (`Movement.originEdId` is required), so the booking team is `ed`. ⚠️ `ward` is the
  // RECEIVING side and is excluded BY NAME: it did not book the job, and a booking cancelled
  // by the destination is indistinguishable on the sending board from one that failed — so
  // the sending team cannot tell "they changed their mind" from "it never went through".
  // This list read ["coordinator", "ward"] until 2026-08-30, which was TR-D6 inverted.
  // `TR-D1`: the sending ward or ED, and the coordinator REJECTED BY NAME — it owns the bed search
  // and does not know whether this patient needs an escort or is settled enough to travel. Note the
  // asymmetry with `CANCEL_TRANSPORT` below, which the coordinator MAY do (`TR-D6`): it is the only
  // role that sees the whole picture and so the only one positioned to notice a booking that has
  // become wrong. Booking needs knowledge of the patient; cancelling needs knowledge of the network.
  //
  // `community` ADDED 2026-09-01 (OWNER): transport booking belongs to whoever is SENDING the
  // patient, and a community team is one of those senders.
  //
  // ⚠️ **THE MODEL CANNOT YET REPRESENT THE SENDER THAT RULING NAMES, AND THIS ROW DOES NOT
  // PRETEND OTHERWISE.** `Movement.originEdId` is REQUIRED (`ward-model.ts` — "where the patient
  // physically is"), and `RAISE_REFERRAL`, the ONLY event that creates a movement, refuses an
  // `edId` that is not in `allEmergencyDepartments()`. So every movement is sent FROM an emergency
  // department whoever raised it: **there is no community-origin movement, at `pulled` or at any
  // other stage.** The two lines directly above still hold as a statement of fact and are left
  // standing for that reason.
  //
  // What the widening actually grants is a `community` caller booking transport for a patient
  // sitting in an ED. That is a LIVE permission and not a dead one — `case "BOOK_TRANSPORT"` gates
  // on `movement.stage` alone and never compares the caller against `originEdId` — but it is
  // UNSCOPED for exactly the same reason: a community team may book for any pulled movement in the
  // state, not only for one it sent. Scoping it needs a community origin on `Movement` first, which
  // is the owner's decision and not an implementer's. Pinned in `tests/ward-book-transport.test.ts`.
  // 🔴 CORRECTED 2026-09-15 under WLQ-11 (owner): `case "BOOK_TRANSPORT"` used to store `provider`
  // and `escortRequired` and nothing about the caller. It now also stores `transport.bookedBy: {
  // role, unitId? }` for every booker — `role` always, `unitId` only for a `ward` booker (from its
  // own `actingUnitId` claim) — because `CANCEL_TRANSPORT` below needs to tell the booker from
  // anyone else. `ed` and `community` bookings are no longer byte-identical to each other; see the
  // superseded assertion in `tests/ward-book-transport.test.ts`.
  BOOK_TRANSPORT: ["ed", "ward", "community", "coordinator"],
  // 🔴 CHANGED AGAIN 2026-09-15 under WLQ-11 (owner): *"whoever booked transport may cancel it;
  // the receiving ward still may not."* `ward` is back in this list. The comment block above (the
  // one still headed "THIS CHECK USED TO BE TR-D6 INVERTED") explained why `ward` was removed
  // outright rather than merely re-scoped: the role gate alone could not tell the RECEIVING ward
  // from the BOOKING one, so excluding every ward was the only safe fix available at the time.
  //
  // WLQ-11 makes the finer distinction possible: `BOOK_TRANSPORT` now records `transport.bookedBy`
  // (see its own comment just above), so `case "CANCEL_TRANSPORT"` can compare a `ward` caller's
  // `actingUnitId` claim against the recorded booker and refuse only when they differ — including
  // when they differ because there is no recorded booker at all (every job booked before this
  // ruling). The receiving ward is therefore STILL refused whenever it did not book, which is every
  // case TR-D6 originally worried about; it is a narrower rule, not a reversed one.
  //
  // 🔴 **`community` ADDED — owner's third ruling, 2026-09-17 (answer 9): "only the community team
  // that booked transport may cancel it."** This used to say `community` was handed back for want
  // of an identity claim (`actingPlaceId` had never been plumbed into `BOOK_TRANSPORT` or
  // `CANCEL_TRANSPORT`). It now has one — the same claim-not-proof discipline `actingUnitId` gives
  // a `ward` caller — so `case "CANCEL_TRANSPORT"` can compare a `community` caller's
  // `actingPlaceId` claim against `transport.bookedBy.placeId`, exactly the way the `ward` branch
  // already compares `actingUnitId` against `bookedBy.unitId`. Pinned in
  // `tests/ward-transport-cancel-permission.test.ts`.
  CANCEL_TRANSPORT: ["coordinator", "ed", "ward", "community"],
  /*
   * WLQ-38 (owner, 2026-09-15): the referrer or the coordinator may stop a journey already under
   * way, once the patient has been collected — see this event's own doc comment above for the full
   * ruling and for why `ed` is permitted by role alone rather than checked against
   * `movement.originEdId`. `ward` is deliberately NOT here: the receiving ward is the one party the
   * ruling names as unable to act (the same shape `CANCEL_TRANSPORT`'s own `ward` scoping exists to
   * get right, but this event has no booker-identity field to check a ward claim against, and the
   * ruling did not ask for the receiving ward to have this power at all).
   */
  STOP_TRANSPORT: ["coordinator", "ed"],
  // Owner answer 8 (second round, 2026-09-17): the coordinator, the ward, or the referrer.
  RELEASE_HELD_BED: ["coordinator", "ward", "ed"],
  // Build plan item 29 (T4a) / R2-7: the transport officer or the coordinator.
  RECORD_DIVERSION: ["officer", "coordinator"],
  // Build plan item 29 (T4a) / OA-29: the coordinator, the accepting ward, or the original referrer.
  RELEASE_DIVERTED_BED: ["coordinator", "ward", "ed"],
  REFER_TO_COMMUNITY_TEAM: ["ed", "coordinator"],
  RECORD_LEFT_DEPARTMENT: ["ed", "coordinator"],
  FLAG_BED_RELEASE: ["ward", "coordinator"],
  CONFIRM_BED_RELEASE: ["ward", "coordinator"],
  // Bed-model rework (2026-08-28). All three are `ward`-only for the same reason the four above
  // are: only the ward moves a bed between stages, flags it stuck or unstuck, or says it is being
  // made ready. A coordinator sees every one of them and changes none of them.
  REVERT_BED_RELEASE: ["ward", "coordinator"],
  BLOCK_BED_RELEASE: ["ward", "coordinator"],
  CLEAR_BED_RELEASE_BLOCK: ["ward", "coordinator"],
  SET_BED_PREPARATION: ["ward", "coordinator"],
  RELEASE_BED: ["ward", "coordinator"],
  RECORD_LEAVE_BED: ["ward", "coordinator"],
  END_LEAVE_BED: ["ward", "coordinator"],
  // Owner approval 9 Oct 2026 (Patient page gate board). An absence is the ward's to record, like
  // leave. A community treatment order is the community team's, and the coordinator may record it
  // from the Patient page (10 Oct 2026), logged under the coordinator's own role.
  RECORD_ABSENT_WITHOUT_LEAVE: ["ward", "coordinator"],
  RECORD_ABSENCE_STEP: ["ward", "coordinator"],
  RECORD_COMMUNITY_TREATMENT_ORDER: ["community", "coordinator"],
  END_COMMUNITY_TREATMENT_ORDER: ["community", "coordinator"],
  // The ward the patient is leaving records it. Not the coordinator: a statewide view does not
  // know that somebody walked out of a building, and a coordinator recording a discharge it
  // cannot observe is the shape this project refuses everywhere else.
  RECORD_LEAVING: ["ward", "coordinator"],
  // The ward that holds the bed, and nobody else. A ward is the only party that observes one of
  // its own occupants leaving the building for an emergency department and coming back, and it is
  // the party still holding the bed while they are gone. The coordinator is excluded on exactly
  // the reasoning `RECORD_LEAVING` above already uses: a statewide view does not know that
  // somebody walked out of a ward, and it would be recording something it cannot see. `ed` is
  // excluded too, and that one is worth stating because it looks like the obvious candidate — the
  // patient is physically IN an emergency department while this is true. But the fact being
  // recorded is about the WARD'S OWN BED ("the bed is still theirs"), the reducer refuses any
  // acting unit other than the one holding the admission, and an emergency department holds no
  // ward bed to act as. Neither event writes a role name onto any record, so no false attribution
  // can enter with either.
  RECORD_AWAY_AT_EMERGENCY_DEPARTMENT: ["ward", "coordinator"],
  RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT: ["ward", "coordinator"],
  // A stay-level discharge blocker is the ward's to record, exactly like the release-level one.
  RECORD_STAY_DISCHARGE_BLOCKER: ["ward", "coordinator"],
  CLEAR_STAY_DISCHARGE_BLOCKER: ["ward", "coordinator"],
  /*
   * Mirrors `WITHDRAW_REFERRAL` below exactly, and for the same reason: whoever may raise a
   * movement may say what is holding it up, plus the coordinator. The four are not
   * interchangeable observers — a ward knows its bed is not clean, an emergency department knows a
   * family has not been reached, a community team knows what it is waiting on, and the
   * coordinator is the only one who can say no bed exists anywhere in the network. Narrowing this
   * to one of them would make the other three's observation unrecordable, and the field's whole
   * purpose is to hold a fact the model cannot compute.
   *
   * ⚠️ **`officer` ADDED 2026-09-01, AND THE REASON IT HAD BEEN EXCLUDED WAS FALSE WHEN WRITTEN.**
   * This comment said the transport legs "already restate this field on their own", so an
   * officer's view was written by the events they raise. An officer raises exactly four events —
   * `TRANSPORT_ACCEPTED`, `TRANSPORT_EN_ROUTE`, `PATIENT_COLLECTED`, `PATIENT_ARRIVED` — and until
   * the same day only the last two restated anything. The two legs that made the standing sentence
   * false were the two that left it alone, and the only party who observes them could not correct
   * it. Both legs restate now, so the premise is finally true — and it still does not carry the
   * exclusion, for two reasons:
   *
   *   - **Applied consistently it excludes everybody.** Every permitted role also raises events
   *     that restate this field: the coordinator `REFER_TO_UNITS`, the ward `ACCEPT_IN_PRINCIPLE`,
   *     the emergency department `BOOK_TRANSPORT` and `RECORD_EXAMINATION`. "Your events already
   *     write it" is true of all five, so it discriminates between none of them.
   *   - **It answers the stage-level case and not the one this field exists for.** Between
   *     `TRANSPORT_EN_ROUTE` and `PATIENT_COLLECTED` the vehicle is the only thing moving and the
   *     officer is the only party watching it. An ambulance diverted to a higher-priority job, or a
   *     crew stood down, has NO event in this model — the movement sits reading "Awaiting
   *     collection — transport is en route" while the vehicle turned around. That is the same
   *     staleness one layer down, and the test above ("narrowing this would make an observation
   *     unrecordable") admits the officer on exactly the reasoning it admits the other four.
   *
   * The second half of the old reason — "an officer does not own the placement" — is not the test
   * this table uses either. The ward does not own the placement (the coordinator does) and is here
   * anyway, because it can see its own bed. Unique observation earns the seat, not ownership.
   *
   * What the reducer writes for these roles, as this guard demands: THE CALLER'S OWN PROSE AND
   * NOTHING ELSE. No role name, no team, no person is recorded alongside it, so no false
   * attribution can enter with any of the five — the record does not claim who said it, and the
   * screen does not either. That is what makes the widening safe as well as right.
   */
  RECORD_MOVEMENT_BLOCKER: ["ed", "community", "ward", "coordinator", "officer"],
  // Identical to `RECORD_MOVEMENT_BLOCKER` above and never narrower: whoever may say what is
  // holding a patient up may say it has stopped. Writes one reducer-owned sentinel and no role,
  // team or person — so, like its partner, it can introduce no false attribution. `officer` added
  // with its partner on 2026-09-01 for that reason: an officer who may record "ambulance diverted"
  // and may not then say it is resolved leaves a sentence only somebody who cannot see the vehicle
  // can retract.
  CLEAR_MOVEMENT_BLOCKER: ["ed", "community", "ward", "coordinator", "officer"],
  /*
   * ⚠️ MIRRORS `CHANGE_URGENCY` EXACTLY, AND THAT IS THE ARGUMENT RATHER THAN A CONVENIENCE.
   * `queueOrder` puts this flag ABOVE all three urgency tiers, so it MUST NOT be easier to raise
   * than the tier it outranks: a control available to more roles than `CHANGE_URGENCY` would let
   * somebody who may not move a patient from tier 3 to tier 1 put them above every tier 1 instead.
   * The coordinator sees the whole network and the referring emergency department is with the
   * patient; those are the two who may already move a tier, and they are the two here.
   *
   * `ward` is excluded BY NAME, and it is the one that looks like it belongs: a receiving ward
   * has an obvious view on how urgent an admission is. But a ward that may flag can promote the
   * patient it is about to accept above every other ward's, and the flag carries no reason and no
   * author for anybody to review that against. Widening this is an owner decision.
   *
   * What the reducer writes for these roles, as this guard demands: `flaggedUrgent: true` or
   * `false` and NOTHING else — no role, no reason, no timestamp. So neither role can introduce a
   * false attribution, because the record makes no attribution at all. That absence is itself a
   * known limit, recorded on the events' own doc comments.
   */
  FLAG_MOVEMENT_TURNAROUND_PRIORITY: ["coordinator"],
  FLAG_REFERRAL_TURNAROUND_PRIORITY: ["coordinator"],
  // Smart features ideas 3 and 4 (19 Oct 2026). Only the ward itself opens its copy; asking for
  // information is the ward's (or the coordinator's for it); the referrer side ticks items off.
  MARK_REFERRAL_OPENED: ["ward", "coordinator"],
  REQUEST_REFERRAL_INFORMATION: ["ward", "coordinator"],
  MARK_REFERRAL_INFORMATION_MET: ["ed", "community", "coordinator"],
  // Fix plan item 4 (21 Oct 2026): the coordinator assigns a referral to any listed desk, and an
  // ED or community desk takes one for itself (the reducer checks which). The same desks log calls.
  ASSIGN_REFERRAL: ["coordinator", "ed", "community"],
  LOG_REFERRAL_CONTACT: ["coordinator", "ed", "community"],
  ASK_MORE_WARDS: ["coordinator"],
  // Smart features idea 7: the ward for itself (reducer checks the acting unit), or the coordinator.
  CLOSE_WARD_TO_ADMISSIONS: ["ward", "coordinator"],
  REOPEN_WARD_TO_ADMISSIONS: ["ward", "coordinator"],
  // Smart features idea 5: the chair records; the owner (a ward for its own action) or the chair completes.
  RECORD_BED_MEETING_ACTION: ["coordinator"],
  COMPLETE_BED_MEETING_ACTION: ["coordinator", "ward", "ed", "community"],
  // D-72: the ward for itself (reducer checks the acting unit), its site's bed manager, or the coordinator.
  RECORD_RESTRICTIVE_PRACTICE_START: ["ward", "bed_manager", "coordinator"],
  RECORD_RESTRICTIVE_PRACTICE_END: ["ward", "bed_manager", "coordinator"],
  RECORD_WARD_INCIDENT: ["ward", "bed_manager", "coordinator"],
  SET_SECLUSION_ROOM_STATUS: ["ward", "bed_manager", "coordinator"],
  FLAG_MOVEMENT_URGENT: ["coordinator", "ed"],
  CLEAR_MOVEMENT_URGENT_FLAG: ["coordinator", "ed"],
  /*
   * Whoever referred may un-refer, so this mirrors RAISE_REFERRAL's own role list rather than
   * narrowing it — a referral raised by a community team that only an ED could withdraw would be a
   * request nobody present can take back. The coordinator is included on the same reasoning as
   * FD-25: it overrides, and an override nobody can exercise is not an override.
   *
   * ⚠️ **THIS TABLE ENTRY STOPPED BEING THE WHOLE STORY ON 2026-09-15, WLQ-38.** Before it, the
   * reducer refused every one of these four roles once `movement.acceptedUnitId` was set — "a
   * withdrawal cannot undo an acceptance" — so the four-role list above was accurate for every
   * reachable case. His ruling: *"This should also be the referring doctors responsibility as well
   * to be able to revoke the transport as well as referral in addition to the coordinator."* The
   * reducer now permits `coordinator` and `ed` to withdraw an ACCEPTED referral too (refusing
   * `community` and `ward` at that point, and refusing everyone once the patient has been
   * collected — see `STOP_TRANSPORT` for that case instead), so this list is still the full set of
   * roles that may ever raise the event, but which of them succeed now depends on
   * `movement.acceptedUnitId` as well as on the pre-existing referredUnitIds/closure checks. See
   * the reducer's own `WITHDRAW_REFERRAL` case for the state-scoped narrowing this list cannot
   * express.
   */
  WITHDRAW_REFERRAL: ["ed", "community", "ward", "coordinator"],
  // The one thing a coordinator may do to a ward's bed data. It changes no number: it marks that
  // somebody asked. Spec D12.
  REQUEST_CAPACITY_REFRESH: ["coordinator"],
  // Task 3 (Phase 7, "The front door"): the community role raises a referral; only the
  // coordinator decides whether the service takes it. Two different decisions, kept apart from
  // `DECLINE` (a ward declining a specific movement, downstream) — see this file's own top-level
  // comment on `WardFlowRole`.
  //
  // R9 (owner item 23, 2026-09-17): "Police, ambulance and crisis stay 'community'. … only
  // `ed_medical` is raised as `ed`, and `ed` with any other source is refused. Everything else,
  // including GP, stays `community`." `ed` widens the table here; the reducer's own
  // `case "RECEIVE_REFERRAL"` couples it back to `source` — this list alone cannot express "only
  // when the source is ed_medical".
  //
  // Role access plan (Josh, 15 Oct 2026): a ward raises a ward-to-ward referral in its own name.
  // The reducer couples `ward` to source `psychiatric_ward` with a real sending ward, as it couples
  // `ed` to `ed_medical`, so a ward cannot file a referral under another source.
  RECEIVE_REFERRAL: ["community", "ed", "ward", "coordinator"],
  // Anyone at the front door may add a patient who is not yet known - that IS the front door.
  ADD_PATIENT: ["ed", "community", "coordinator"],
  /**
   * Owner ruling FD-25: a WARD answers a referral addressed to it. The coordinator keeps the role
   * too — it overrides, and an override nobody can exercise is not an override.
   */
  // `ed` added 2026-08-30 under FD-3 as SUPERSEDED by the owner: "every referral is declinable,
  // and NO CODE PATH MAY RENDER A REFERRAL WITH NO DECLINE AFFORDANCE". The ED hub acts as
  // `ed`, so without it an emergency department could not answer a referral addressed to it,
  // and the available workaround was to dispatch as `ward` — which writes a false `decidedBy`.
  // ⚠️ The widening is scoped in the reducer: a role answers its OWN destination kind and
  // nothing else, so this list alone does not let an ED decide on a ward bed.
  /*
   * 🔴 `community` MAY NOW ACCEPT, FOR FOLLOW-UP ONLY — RB5 (item 16), superseding the
   * 2026-09-06 ruling recorded below, which held for a time that a community team could
   * decline but never accept.
   *
   * The owner's 2026-09-17 answer ("a community team may accept, for follow-up only") is
   * exactly the mirror-image ruling that comment once said "nobody made". Accepting still
   * commits a service to taking the patient, but a COMMUNITY acceptance commits it to
   * FOLLOW-UP, never to a bed: `referralState` (`ward-referrals.ts`) is the one place that
   * distinction is kept, deciding from the non-community destinations whenever any exist, so a
   * community acceptance alone never flips a referral to `"accepted"`, never cancels a queued
   * ward or ED arm (see the reducer's own comment on that, unchanged), and never blocks a later
   * ward/ED accept, decline or referrer withdrawal.
   *
   * The role half is still not the dangerous half on its own: `answerableBy` in the reducer
   * already carried `community: "community_team"` (not `"any"`) in BOTH the accept and decline
   * handlers before this change, exactly so widening this list alone could not let a community
   * team decide a psychiatric ward bed.
   */
  ACCEPT_REFERRAL: ["ward", "coordinator", "ed", "community"],
  /*
   * `community` MAY ALSO DECLINE — owner ruling 2026-09-06. The two lists are one line apart on
   * purpose: `answerableBy` in the reducer carries `community: "community_team"` for BOTH events
   * (never `"any"`), which skips the destination-ownership check entirely for a role that has
   * one — so `community` on either line without that map holding is what would let a community
   * team decide a PSYCHIATRIC WARD bed, recorded as a legitimate decision on a ward it has
   * nothing to do with. The reducer's own comment called this shot when `ed` was added:
   * "`community_team` has no acting role yet; when one arrives it joins this map rather than
   * widening the lists."
   */
  DECLINE_REFERRAL: ["ward", "coordinator", "ed", "community"],
  // `coordinator` only, and this one is a PLAN JUDGEMENT rather than a spec ruling — the spec
  // says only "role-gated like every other referral event", and the control sits on the
  // coordinator's own match view. The owner may want `community` here as well (a community team
  // is plausibly who actually rang round for a local bed); adding it is a product decision, not
  // an implementer's, so it is flagged rather than taken.
  RECORD_LOCAL_BED_SOUGHT: ["coordinator"],
  /*
   * 🔴 `coordinator` ONLY, AND THIS IS A PLAN JUDGEMENT FLAGGED RATHER THAN TAKEN — the same shape
   * as `RECORD_LOCAL_BED_SOUGHT` directly above, and flagged for the same reason.
   *
   * ⚠️ A referrer withdrawing rings SOMEBODY, and who that is is a product question nobody has
   * answered: plausibly the coordinator who holds the referral, plausibly the ward or the emergency
   * department the referral was addressed to. **Starting narrow is the reversible direction** — a
   * role added later changes one line, while a role wrongly permitted writes
   * `withdrawalRecordedBy` entries that misattribute who took the call, and those cannot be
   * un-recorded.
   *
   * ⚠️ **NO `answerableBy` ENTRY IS NEEDED and its absence is deliberate**, unlike the trap recorded
   * above `DECLINE_REFERRAL`: that map exists so a role may only answer ITS OWN destination kind,
   * and this event answers no destination at all. It marks every destination still waiting, because
   * the referrer takes back the whole referral rather than one service's copy of it.
   *
   * ⚠️ **UNCHANGED BY OWNER RULING 11's `destinationKind: "community_team"` VARIANT.** Every
   * destination-level referral act this app can raise (`ACCEPT_REFERRAL`, `DECLINE_REFERRAL`,
   * `RECORD_LOCAL_BED_SOUGHT`, `ADD_REFERRAL_CORRECTION`) dispatches from exactly one place —
   * `ReferralMatchView` (`referral-match.tsx`), the coordinator's own referral register — hardcoded
   * to `role: "coordinator"` at every call site because that view carries no other viewer-role to
   * select (see `ReferralHistoryAndCorrections`'s own comment on that same shape). The scoped
   * withdrawal control lives there too, so it needs no wider role than this list already grants.
   */
  /*
   * ✅ ANSWERED 4 October 2026 — the owner: "Let the community team and the ED record it as well,
   * if they are cancelling their referral." So `community` and `ed` join, and the reducer scopes
   * each to referrals its own side sent (`referralSenderRole`, `ward-referrals.ts`): a community
   * team cannot withdraw an ED's referral, nor an ED a community one. The coordinator keeps the
   * role for any referral.
   */
  RECORD_REFERRER_WITHDRAWAL: ["coordinator", "community", "ed", "ward"],
  /**
   * RB7, build plan item 27 (2026-09-17): the three parties who could plausibly need to correct a
   * referral after the fact — the referrer's own team (`community` or `ed`, whichever raised it),
   * and the coordinator who may be handling it. `ward` is excluded: a ward answers a referral, it
   * does not author or amend the referrer's own account of it.
   */
  ADD_REFERRAL_CORRECTION: ["community", "ed", "coordinator"],
  /**
   * F1 (Task 5, 2026-09-04): only the coordinator may raise either event. This table entry is the
   * ENTIRE enforcement — the generic role check in `wardFlowReducer`'s switch preamble rejects any
   * other role before either event's payload is inspected at all, exactly as it does for every
   * other role-gated event above.
   */
  STEP_BACK_STAGE: ["coordinator"],
  WITHDRAW_ACCEPTANCE: ["coordinator"],
  // RA1 (item 18): the shortlist is the coordinator's own tool, and nobody else holds a live
  // request on this movement to take back — see the event's own doc comment above.
  WITHDRAW_WARD_REQUEST: ["coordinator"],
  /*
   * Item 48, Q2 (owner answer 48, 2026-09-17): every role a notice can be addressed to may mark
   * ITS OWN notice read — `community` is included even though no community screen dispatches
   * anything through this bar yet (`ward-chrome-role.ts`'s `WardChromeRole` has no community
   * member, RB4's gap, not this task's), because the reducer's addressee check below is the real
   * gate: a `community` caller can still only mark a notice whose `to.role` is `community` AND
   * whose `to.placeId` matches its own claim. Widening this list costs nothing a role could not
   * already be refused for by that check.
   */
  MARK_NOTICE_READ: ["coordinator", "ed", "ward", "officer", "community"],
  /*
   * COORDINATOR-ONLY, ALL THREE — read from where the row is OBSERVED, not assumed. `buildActionInbox`
   * (`ward-derivations.ts`) is rendered by exactly one screen in this codebase today:
   * `coordinator/exception-drawer.tsx`, mounted from `coordinator/coordinator-screen.tsx`. No ward
   * screen and no emergency-department screen renders a single `InboxItem` anywhere. The same
   * "unique observation earns the seat" test `RECORD_MOVEMENT_BLOCKER`'s own comment states above
   * would grant a ward or an ED a seat here IF either could see the row — neither can today, so
   * granting write access to a role that cannot see the state of the thing it would be acting on is
   * exactly the failure mode this file's own role comments warn against elsewhere.
   *
   * ⚠️ THIS IS A STARTING POINT, NOT A CEILING, AND IS STATED HERE RATHER THAN LEFT IMPLICIT.
   * Nothing about acknowledging or completing an inbox row is coordinator-specific in the way
   * `REQUEST_CAPACITY_REFRESH` genuinely is (see that entry's own comment, "the one thing a
   * coordinator may do to a ward's bed data") — a ward asked to ring transport for a stalled leg is
   * squarely the kind of commitment `COMPLETE_INBOX_ITEM` exists to tick off. The day the action
   * inbox is surfaced on a ward or ED screen, THIS LIST is what should widen, not the reducer's
   * shape or the events themselves. Left narrow now rather than guessed wide, because deciding who
   * may tick off a clinical to-do item without that item ever having been shown to them is exactly
   * the kind of call this task's brief says to hand back rather than take.
   */
  ACKNOWLEDGE_INBOX_ITEM: ["coordinator"],
  COMPLETE_INBOX_ITEM: ["coordinator"],
  REOPEN_INBOX_ITEM: ["coordinator"],
  // Stream A, 9 Oct 2026: the same coordinator floor as acknowledging a row.
  TAKE_INBOX_ITEM_OWNERSHIP: ["coordinator"],
  SNOOZE_INBOX_ITEM: ["coordinator"],
  UNSNOOZE_INBOX_ITEM: ["coordinator"],
  SET_ARRIVAL_DETAILS: ["coordinator", "ed", "ward", "community"],
  SET_STEP_DOWN_CANDIDATE: ["ward", "coordinator"],
  // FD-10: the ward's own assessment. The coordinator may act for a ward (Josh, 10 Oct 2026).
  RECORD_WARD_DIAGNOSIS: ["ward", "coordinator"],
  SET_DISCHARGE_BARRIER: ["ward", "coordinator"],
  SET_DISCHARGE_CRITERIA: ["ward", "coordinator"],
  RECORD_ED_MEDICAL_DETERIORATION: ["ed", "coordinator"],
  RECORD_MOVEMENT_MEDICAL_CLEARANCE: ["ed", "coordinator"],
  UPLOAD_PATIENT_FORM: ["coordinator", "ed", "ward", "community", "officer"],
  RECORD_LEGAL_FORM_WRITTEN: ["ed", "coordinator"],
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
  // Out-of-area board is the coordinator's tool. This is a phone-log, not a booking.
  RECORD_REPATRIATION: ["coordinator"],
  // The handover sheet is signed by whoever is handing over — coordinator or the ward.
  RECORD_HANDOVER_SIGN_OFF: ["coordinator", "ward"],
  // Contacting a team is this record. The team that made the call, or the coordinator logging it.
  RECORD_CLINICAL_CONTACT: ["community", "coordinator", "ed"],
  // Statewide broadcast directives — coordinators, bed managers, and executives dispatch; all roles may acknowledge for their unit.
  DISPATCH_BROADCAST_ALERT: ["coordinator", "bed_manager", "executive"],
  ACKNOWLEDGE_BROADCAST_ALERT: ["coordinator", "ward", "ed", "officer", "community", "bed_manager", "executive"],
  STAND_DOWN_BROADCAST_ALERT: ["coordinator", "bed_manager", "executive"],
  EXTEND_BROADCAST_ALERT: ["coordinator", "bed_manager", "executive"],
  // Global alerts (10 Oct 2026): only the coordinator raises Pull now (D-30 keeps cross-hospital
  // calls with the central coordinator). Wards answer for their own desk, and the coordinator may
  // record a ward's answer taken by phone. ED acknowledges directives but answers neither kind.
  RAISE_PULL_NOW: ["coordinator"],
  REPLY_BROADCAST_ALERT: ["ward", "coordinator"],
  // Planned admissions (stream D): booked and managed by the coordinator, bed manager or the
  // receiving ward; the ward or coordinator records the arrival.
  BOOK_PLANNED_ADMISSION: ["coordinator", "bed_manager", "ward"],
  CHANGE_PLANNED_ADMISSION: ["coordinator", "bed_manager", "ward"],
  CANCEL_PLANNED_ADMISSION: ["coordinator", "bed_manager", "ward"],
  CONVERT_PLANNED_ADMISSION: ["ward", "coordinator"],
  // Advisory carer/PSP/MHAS checklist (9 Oct 2026): recorded where the move is completed — the
  // ward (arrivals, discharges board) or the coordinator (movements).
  RECORD_SUPPORT_NOTIFICATION: ["ward", "coordinator"],
  SEND_RELEASE_SUPPORT_NOTICE: ["ward", "coordinator"],
  RECORD_ARRIVAL_CHECK: ["ed", "coordinator"],
  // v10 pass 2 (Josh, 10 Oct 2026): Undo. Every role that may answer a referral may take back its
  // OWN answer; the reducer refuses another role's decision (with a reason) unless the caller is the
  // coordinator, who may undo anyone's.
  UNDO_REFERRAL_DECISION: ["ward", "coordinator", "ed", "community"],
  // Reviews are the coordinator's alone (`REVIEW_AUDIT_EVENT`), so taking one back is too.
  UNDO_AUDIT_REVIEW: ["coordinator"],
  // The ward Bed board: a ward moves stays between its own beds; the coordinator may do it anywhere.
  PLACE_IN_BED: ["ward", "coordinator"],
  UNDO_PLACE_IN_BED: ["ward", "coordinator"],
  // v10 pass 3 (Josh, 10 Oct 2026): each step's undo carries the roles of the step it takes back.
  // The reducer narrows it to the role that acted (a ward to its own unit), or the coordinator.
  UNDO_REFER_TO_UNITS: ["coordinator"],
  UNDO_ACCEPT_IN_PRINCIPLE: ["ward", "coordinator"],
  UNDO_LEGAL_FORM_RECORD: ["ed", "coordinator", "ward", "community"],
  UNDO_SUPPORT_NOTIFICATION: ["ward", "coordinator"],
  UNDO_REPATRIATION: ["coordinator"],
  UNDO_HANDOVER_SIGN_OFF: ["coordinator", "ward"],
  UNDO_ED_STEP: ["ed", "ward", "community", "coordinator"],
  UNDO_TRANSPORT_STEP: ["officer", "ward", "coordinator"],
  UNDO_DEPARTURE: ["ward", "coordinator"],
  UNDO_ABSENT_WITHOUT_LEAVE: ["ward", "coordinator"],
};
