// Communication addressees and notices (owner ruling D-2). Moved out of `ward-model.ts` unchanged;
// that file re-exports all of it.
import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import type { MovementId } from "@/components/ward-management/ward-model-movement-parts";
import type { PatientId } from "@/components/ward-management/ward-patients";

/**
 * COMMUNICATION — ADDENDUM TO THE THIRD-EDITION MASTER BUILD PLAN
 * (`docs/ward-flow/plans/2026-09-1x-communication-addendum.md`, §0–§1), owner ruling **D-2**,
 * 2026-09-10. Read that file's §0 before touching anything below: the system already has a
 * substantial work list (`buildActionInbox`, `ward-derivations.ts`) and this is deliberately NOT a
 * second one. `buildActionInbox` is a pure DERIVATION from `movements`/`units` with no addressee and
 * no way to put anything into it (its own doc comment: "nothing is authored"). What follows is the
 * other half the owner's finding named: a second, AUTHORED list of facts about who was told what, at
 * a moment, because "the referrer was told" is not a fact any amount of re-reading `movements` can
 * produce. The two lists are never summed into one tally (addendum §1.4) and this type never feeds
 * `buildActionInbox`'s computation in either direction.
 *
 * ⚠️ **THIS PHASE DOES NOT CREATE AN IDENTITY MODEL, AND THAT IS A RULING, NOT A GAP.** Addendum
 * §1.2: the master plan's §7.1 item 2 — *"nobody is anybody"* — was never answered by the owner, and
 * inventing one here would answer a use-gate question with privacy consequences nobody asked. A
 * notice addresses a ROLE AT A PLACE (`Addressee` below), never a user, an account or a person who
 * logs in. A future change that needs a user record to make this work has left this addendum's scope
 * and must be put to the owner rather than guessed.
 */

/**
 * WHO A NOTICE IS FOR — a role at an optional place, never a person. Addendum §1.2.
 *
 * `role` is reused from `WardFlowRole` rather than redeclared (see this file's own import comment
 * for why that is safe) precisely because it is already exhaustive by design: every screen this
 * prototype has is already gated by one of its six members, so "which screens can see this notice"
 * is answered by the same union that already answers "which screen is this".
 *
 * `placeId` narrows a role to ONE ward, ONE emergency department or ONE team — a ward sees its own
 * notices and not every ward's, exactly the scoping `FD-23` already holds a referral's OWN fields to.
 * Optional because `officer` has no place in this model (`ward-role-switcher.tsx` never scopes it to
 * one): an officer notice is addressed to the whole role, on purpose, not to a place nobody
 * currently splits.
 *
 * 🔴 **`demo` IS A MEMBER OF `WardFlowRole` AND MUST NEVER APPEAR HERE.** The demonstration harness
 * that jumps the clock forward is not a person and cannot be "told" anything — see
 * `ward-flow-reducer.ts`'s `appendNotices`, the one gate every notice passes through before it
 * reaches live state, which refuses a `demo`-addressed notice structurally rather than trusting every
 * future call site to remember not to construct one.
 */
export type Addressee = {
  role: WardFlowRole;
  placeId?: string;
};

/**
 * EVERY KIND OF NOTICE THIS PHASE CAN RAISE — a closed union, exhaustive like `WardFlowRole` itself,
 * so a `switch` over it must be total rather than defaulted. Addendum §1.3's original table named
 * exactly five DECISIONS across seven members, because two of those decisions each address two
 * different parties (`ACCEPT_REFERRAL`: the referrer and the receiving ward; `CANCEL_TRANSPORT`: the
 * officer and the receiving ward) and each party gets its own member. Two notices raised by one
 * event would otherwise share a `(subject, kind)` pair and collide under the id rule below — see
 * `ward-flow-reducer.ts`'s `makeNotice` doc comment.
 *
 * ⚠️ **NO SIXTH DECISION, AND NO EIGHTH MEMBER" WAS THE ORIGINAL RULE, AND WLQ-38 IS A DELIBERATE,
 * DOCUMENTED SIXTH — NOT A SILENT DRIFT.** Owner ruling, 2026-09-15: the referrer or the coordinator
 * may revoke an accepted referral (`WITHDRAW_REFERRAL`) or stop a collected transport
 * (`STOP_TRANSPORT`), and the receiving ward must be told either way — the same "a party who was
 * expecting a patient learns they are not coming" shape `CANCEL_TRANSPORT`'s ward half already
 * carries. Two members added, one per event, both addressed to the ward alone (neither act needs a
 * referrer-facing half: the referrer or the coordinator IS the one acting, so there is nobody on
 * that side left to tell). **The corresponding row in the addendum table itself
 * (`docs/ward-flow/plans/2026-09-1x-communication-addendum.md` §1.3) is OWED, not written** — this
 * build's own constraints forbid editing anything under `docs/`, so the row that keeps this comment
 * and that table in agreement is recorded here as a debt for whoever next has `docs/` access, rather
 * than silently left undone. The rule the union enforces — table and members agree, or the drift is
 * caught — still held: this comment IS the corresponding entry until the addendum itself is updated.
 */
export type NoticeKind =
  // RELEASE_PULL — told to the referrer (`ward-flow-reducer.ts`, `movement.originEdId`).
  | "bed_pull_released"
  // DECLINE (a movement) or DECLINE_REFERRAL (a front-door referral) — told to the referrer. One
  // shared kind: both are the same decision — "a destination said no" — reaching the referrer
  // through two different records, and each event raises at most one notice, so the two can never
  // collide under the id rule.
  | "referral_declined"
  // WITHDRAW_REFERRAL after acceptance has been undone by the coordinator or referrer.
  | "acceptance_withdrawn_referrer"
  // ACCEPT_IN_PRINCIPLE — told to the referrer.
  | "accepted_in_principle"
  // ACCEPT_REFERRAL, the referrer's half — "the answer to the question they asked".
  | "referral_accepted_referrer"
  // ACCEPT_REFERRAL, the receiving ward's half — raised only when the accepting destination is a
  // psychiatric ward, the only kind that names a unit.
  | "referral_accepted_ward"
  // RA1 (item 18, owner answer 18, 2026-09-17) — WITHDRAW_WARD_REQUEST, told to the one ward whose
  // live request was withdrawn. Distinct from `referral_revoked_ward` (an ACCEPTED referral pulled
  // back after WLQ-38) and from `acceptance_withdrawn_ward` (a ward's own "yes" undone): this ward
  // never said yes and never held a bed — only a live request, now taken back.
  | "ward_request_withdrawn"
  // CANCEL_TRANSPORT, the officer's half.
  | "transport_cancelled_officer"
  // CANCEL_TRANSPORT, the receiving ward's half.
  | "transport_cancelled_ward"
  // WLQ-38 (owner, 2026-09-15) — a post-acceptance WITHDRAW_REFERRAL, told to the accepting ward.
  | "referral_revoked_ward"
  // Item 48, Q3 (owner, 2026-09-17) — WITHDRAW_ACCEPTANCE, told to the ward whose acceptance was
  // withdrawn.
  | "acceptance_withdrawn_ward"
  // Item 48, Q3 (owner, 2026-09-17) — RECORD_EXAMINATION with outcome `"revoked"`, told to the
  // accepting ward. Never raised for `"community_order"` (the owner named "revoked" only), and
  // never raised when the movement holds no `acceptedUnitId` — there is nobody to tell.
  | "examination_revoked_ward"
  // WLQ-38 (owner, 2026-09-15) — STOP_TRANSPORT, told to the receiving ward.
  | "transport_stopped_ward"
  // Build plan item 31 (T3, 2026-09-17) — STOP_TRANSPORT, the officer's half: where the patient
  // actually is, the same "officer carries no placeId" shape `transport_cancelled_officer`
  // already holds (`CANCEL_TRANSPORT`, WLQ-38's own sibling).
  | "transport_stopped_officer"
  // Build plan item 29 (T4a, 2026-09-17) — RECORD_DIVERSION, told to the accepting ward.
  | "diversion_recorded_ward"
  // Build plan item 29 (T4a, 2026-09-17) — RECORD_DIVERSION, told to the referring ED.
  | "diversion_recorded_ed"
  // Build plan item 29 (T4a, 2026-09-17) — RELEASE_DIVERTED_BED, told to the accepting ward unless
  // the ward itself released it.
  | "diversion_bed_released_ward"
  // Item 48 (owner, 2026-09-17) — REFER_TO_COMMUNITY_TEAM, told to the destination community team.
  | "community_referral_received"
  // P1-3 (Ward Lead ruling, 17 September 2026) — RECORD_MOVEMENT_GENDER, told to the coordinator,
  // and ONLY when the movement's stage is `accepted_awaiting_bed` through `moving` at the moment
  // the correction lands: an acceptance or a bed is already held for a unit chosen under the OLD
  // gender, so the coordinator — never the ward or ED, who cannot see the correction either way —
  // needs telling to go and check it. No notice is raised for a correction at an earlier stage
  // (nothing is held yet) or at `arrived` (the movement is closed to further placement decisions).
  | "movement_gender_recorded_after_placement"
  // Owner ruling 11 (2026-09-17) — RECORD_REFERRER_WITHDRAWAL's `destinationKind: "community_team"`
  // variant, told to the one community team whose still-queued arm was taken back. The whole-
  // referral withdrawal above raises no notice at all (nobody in this model currently holds a
  // resolvable identity for most referrers to be told anything back — see `referralReferrer`'s own
  // doc comment, `ward-flow-reducer.ts`); this scoped act names a real, resolvable addressee (the
  // community team itself), so it is the one variant of this event that can tell anybody at all.
  | "community_referral_withdrawn"
  // SET_ARRIVAL_DETAILS / EVALUATE_ARRIVAL_LATENESS — estimated arrival more than 60 minutes past
  // and the person has not arrived. Told to the referrer role AND the destination ward (two notices).
  | "arrival_late_referrer"
  | "arrival_late_ward"
  // DECLINE redirected to waitlist (no_bed / bed_pulled_for_earlier_referral) — told to the referrer.
  | "referral_waitlisted"
  // Leave bed past 24 hours — consider opening. Told to the ward that recorded the leave.
  | "leave_bed_open_warning";

/**
 * A NOTICE — AN AUTHORED, ADDRESSED FACT, addendum §1.1. The second list beside
 * `buildActionInbox`'s derived one (see this section's own header comment above for why a second
 * list is correct here and not the duplicated-effort failure this whole addendum warns against).
 *
 * ⚠️ **`sentence` IS STORED, NEVER RE-DERIVED AT RENDER, AND THAT IS THE WHOLE POINT OF THIS TYPE.**
 * A notice is a record of what somebody was told AT A TIME. The movement or referral it is `about`
 * keeps changing after the notice is raised — that is what generated the notice in the first place —
 * so a screen that re-computed the words from current state would silently rewrite history: a
 * referrer who was told "your pull was released" could later read a DIFFERENT sentence for the exact
 * same past event, produced by whatever the record says now rather than what was true when they were
 * told. `tests/ward-notices.test.ts` proves this by reading a notice's `sentence` again after the
 * state it was raised from has moved on, and requires the ORIGINAL words back.
 *
 * `id` is derived from `(subject, kind, count)`, never from a module-level counter — the same
 * discipline `makeRejection` (`ward-flow-reducer.ts:558`) already holds `Rejection.id` to, for the
 * same reason: a counter that lives outside the reducer's own state would make two calls with an
 * identical `(state, event)` mint two different ids, which breaks the reducer's purity (`same
 * (state, event) twice ⇒ identical output`). See `makeNotice` (`ward-flow-reducer.ts`) for exactly
 * how the triple is built.
 */
export type Notice = {
  id: string;
  /** When this notice was raised. From the triggering event's own `now`, never `Date.now()` —
   *  the same clock discipline every other timestamp in this model already holds to. */
  raisedAt: Instant;
  to: Addressee;
  /**
   * What this notice is about — every `NoticeKind` this phase raises names exactly one movement or
   * one referral, never both and never neither (see each kind's own comment on `NoticeKind` above).
   * `unitId` is not part of that either/or: it rides ALONGSIDE a movement or referral id to say WHICH
   * unit a ward-addressed notice concerns, and is never set alone.
   *
   * Fix round 1 (review finding, Minor): this comment previously opened "never more than one of
   * these is set", which `unitId` riding alongside a movement or referral id directly contradicts —
   * the code was always right; the sentence was not.
   */
  about: {
    movementId?: MovementId;
    referralId?: string;
    patientId?: PatientId;
    unitId?: string;
  };
  kind: NoticeKind;
  /** The words a person reads — TRUE READ ALONE, and never re-derived; see this type's own header
   *  comment above. */
  sentence: string;
  /**
   * `undefined` until the addressed viewer reads it. This phase raises notices and stores them;
   *  nothing in this phase ever sets this field — a later phase's read affordance writes it.
   *
   *  🔴 **THAT LATER PHASE IS ITEM 48, Q2 (owner answer 48, 2026-09-17): a notice counts as read
   *  ONLY when `MARK_NOTICE_READ` (`ward-flow-events.ts`) sets it.** Nothing else — not opening
   *  the Activity drawer, not `noticeIsForWardChrome` scoping a notice into view — ever writes
   *  this field. See `case "MARK_NOTICE_READ"` in `ward-flow-reducer.ts` for the addressee check
   *  that gates the write.
   */
  readAt?: Instant;
  /** Who marked it read — the ROLE, never a person, the same discipline every other `by`/actor
   *  field in this model already holds to (`StageChange.by`, `UnwindRecord.by`,
   *  `InboxAcknowledgement.by`). Set together with `readAt`, by `MARK_NOTICE_READ` alone, and by
   *  nothing else. */
  readBy?: WardFlowRole;
};
