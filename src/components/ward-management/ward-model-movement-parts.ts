// The records a movement is built from: overrides, gender placement, status and urgency changes,
// transport jobs and exceptions, stage changes, unwinds, outcomes and reassessments. Moved out of
// `ward-model.ts` unchanged; that file re-exports all of it and keeps `Movement` itself.
import type { EligibilityGate } from "./ward-eligibility";
import type {
  GenderPlacementReason,
  LegalStatusChangeReason,
  OverrideReason,
  UrgencyChangeReason,
} from "@/components/ward-management/ward-change-reasons";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import type { LegalStatus, MovementStage, UrgencyLevel } from "@/components/ward-management/ward-model-vocabulary";

/**
 * A COORDINATOR OVERRIDE, kept rather than shown and discarded.
 *
 * Owner decision OD-3: the reason was collected in a `<textarea>`, held in the shortlist panel's
 * own `useState`, and thrown away the moment another patient was selected — while the governance
 * page stated that override reasons are recorded. **A page making a false claim about what it
 * keeps.** Replacing the box with a fixed list alone would not have fixed that: it would have
 * swapped free text that goes nowhere for five reasons that go nowhere, and the row would read as
 * done.
 *
 * ⚠️ **THIS RECORD IS AN ACCOUNTABILITY RECORD, NOT AN AUDIT TRAIL, AND THE TWO STORE IDENTICAL
 * DATA.** The owner's requirement is that it is **visible to the party overridden** — the unit
 * referred to despite its own gate failing. That difference is a READ PERMISSION, not a field, so
 * a reviewer reading this type sees nothing missing either way. `overridesAgainstUnit`
 * (`ward-derivations.ts`) is the ward-facing read, and `tests/ward-override-register.test.ts`
 * is the boundary that goes red — because an override log only its author can see is a trail, and
 * the whole point of the decision was that it is not one.
 */
export type Override = {
  /** When the override was made. */
  at: Instant;
  /** A ROLE, never a person — the same discipline as `decidedBy` and `StatusChange.by`. */
  by: string;
  /** From `OVERRIDE_REASONS`, never free text, and never an "other, please specify" (WB-DB-16). */
  reason: OverrideReason;
  /**
   * The units referred to despite a failing gate — THE PARTIES OVERRIDDEN. This is the field the
   * ward-facing read is keyed on, which is why it is a list of ids and not a count: a number could
   * not answer "was I one of them".
   */
  unitIds: string[];
  /**
   * Item 10 (owner answers, 17 September 2026): a high-acuity staffing override needs a reason AND
   * a "Nurse unit manager consulted" tick — two separate facts, never one standing in for the
   * other. `true` when the ward or coordinator ticked it; absent means not applicable (the override
   * did not answer the high-acuity gate) or not ticked. Never `false` — the same "absent, not
   * false" discipline every other boolean-shaped optional field in this file already uses, so a
   * reader cannot mistake "not this kind of override" for "ticked no".
   */
  numConsulted?: true;
  /**
   * Which staffing gate this override answered, when it answered a specific named one rather than
   * an ordinary eligibility mismatch. Includes the precise suitability or resource gate answered at pull; absent identifies older
   * placement overrides recorded before gate-specific facts were available.
   */
  gate?: EligibilityGate | "high_acuity_staffing" | "specialling_staffing" | "locked_bed_capacity";
  /**
   * v10 pass 3 (Josh, 10 Oct 2026): who gave the override's second sign-off, as the role they
   * signed in and the name or initials typed. Optional: absent on overrides recorded before it
   * existed, and on any override recorded without one. Typed text, so a session that records one
   * is never saved to browser storage (`eventCarriesTypedTextPayload`).
   */
  secondSignOff?: OverrideSignOff;
};

/** The second sign-off on an override: the acting role and a typed name or initials (1 to 60 characters). */
export type OverrideSignOff = { role: WardFlowRole; name: string };
export const OVERRIDE_SIGN_OFF_NAME_MAX = 60;

/**
 * T12 (`docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`, item 9, owner answer 9,
 * 17 September 2026): *"Non-binary patient: coordinator places with a recorded reason after
 * checking with the ward, preferring a single room."*
 *
 * ⚠️ **NOT AN `Override`, DELIBERATELY A SEPARATE TYPE.** `Override` records a JUDGEMENT GATE that
 * FAILED and a reason bought past it — `SUITABILITY_GATES`' own shape. A non-binary placement can
 * be genuinely eligible at an Undesignated ward (`gender_designation` passes trivially there), so
 * there is no failing gate here for a reason to buy past. This is a PROCEDURAL requirement —
 * somebody with the authority to speak for the ward confirmed it — independent of whether any
 * gate passed or failed, which is why it is its own accountability record rather than a variant
 * of `Override`.
 *
 * `unitIds`, not one `unitId`: `REFER_TO_UNITS` refers to several wards in one act (FD-21), and one
 * recorded check can cover all of them at once, the same shape `Override.unitIds` already holds to
 * on the same event.
 *
 * `by` is a ROLE, never a person — see `Override.by`'s own doc comment for why. `reason` is chosen
 * from `GENDER_PLACEMENT_REASONS`, never free text — see that list's own placeholder warning.
 *
 * **Coordinator role only, checked at the point this is written** (`REFER_TO_UNITS`,
 * `ACCEPT_REFERRAL`) — a ward or ED role supplying both a reason and the ward-checked tick is
 * refused outright, never merely recorded without effect. `ACCEPT_IN_PRINCIPLE` and `PULL_PATIENT`
 * never write one; they only refuse when no existing record on the movement names the unit they
 * are about to commit to.
 *
 * ⚠️ **`wardChecked: true`, ADDED BY WARD LEAD'S OPUS REVIEW OF T12, 17 September 2026.** The
 * coordinator's "checked with the ward" tick used to live only in the REASON TEXT — a session's
 * placeholder wording leaned on a "Checked with the ward;" prefix to say so, which made the tick a
 * fact smuggled inside a free-choice sentence rather than its own field. This field is the tick
 * itself, stored the way `Override.numConsulted` already stores its own tick: `true` when
 * recorded, and this type can never be constructed without it (never `false` — the same
 * "absent/true, never false" discipline `numConsulted` holds to; there is no absent case here
 * because this type is only ever constructed once the reducer has already confirmed the tick was
 * ticked). `GENDER_PLACEMENT_REASONS`'s six entries no longer need to restate the check at all.
 */
export type GenderPlacement = {
  at: Instant;
  by: WardFlowRole;
  unitIds: string[];
  reason: GenderPlacementReason;
  wardChecked: true;
};

export type StatusChange = {
  at: Instant;
  from: LegalStatus;
  to: LegalStatus;
  by: string;
  reason: LegalStatusChangeReason;
};

/** The urgency-tier counterpart of `StatusChange` — same shape, same discipline: who made the
 *  change, when, and a reason chosen from a fixed list rather than typed (see
 *  `ward-change-reasons.ts`'s own doc comment for why). */
export type UrgencyChange = {
  at: Instant;
  from: 1 | 2 | 3;
  to: 1 | 2 | 3;
  by: string;
  reason: UrgencyChangeReason;
};

/**
 * WHO COLLECTS THE PATIENT — obviously generic placeholders, and the owner's to replace.
 *
 * `TR-D2`. Until 2026-08-30 this field was a bare string with two values and no vocabulary: the
 * reducer hardcoded "State patient transport service" onto every job it created, and the seed used
 * **"St John WA"** — a REAL organisation, named inside a synthetic prototype, rendering straight to
 * screen as "St John WA accepted, awaiting departure".
 *
 * Two faults in one field. The screen stated who was collecting a patient and **nobody chose it**;
 * and a demonstration asserted an operational fact about a real body that has agreed to nothing.
 *
 * These three are PLACEHOLDERS in the `CM-8` sense — findable in one place, never presented as the
 * real set, and replaced wholesale on the day somebody supplies the actual providers. They are the
 * three the transport design names and no more: "and so on" in a spec is an invitation to invent,
 * and inventing a fourth provider is the same act as writing a real one in.
 */
export const TRANSPORT_PROVIDERS = ["Ambulance service", "Patient transport service", "Ward escort"] as const;
export type TransportProvider = (typeof TRANSPORT_PROVIDERS)[number];

/**
 * Owner ruling, third round, 2026-09-17: booking transport in Ward Flow LOGS a booking already made
 * over the phone — the CAD transport number, and whether the transport is voluntary or involuntary.
 * **This states what the BOOKER said about the transport, and does NOT change the movement's own
 * `legalStatus`.** The two can differ (a voluntary patient may still travel on a service the booker
 * states as "involuntary" for the transport's own paperwork), and nothing here reconciles them —
 * see `TransportJob.transportLegalStatus`'s own doc comment.
 */
export const TRANSPORT_LEGAL_STATUSES = ["voluntary", "involuntary"] as const;
export type TransportLegalStatus = (typeof TRANSPORT_LEGAL_STATUSES)[number];

/**
 * Audit fix (13 Oct 2026): a transport step taken while a paperwork or clearance check was not met.
 * The coordinator (and the officer) is warned and never blocked; the step records which checks were
 * open and a coded reason, never free text, so the event stays off the typed-text list.
 */
export const TRANSPORT_EXCEPTION_GAPS = [
  "legal_status_differs",
  "transport_order_missing",
  "fit_to_travel_missing",
] as const;
export type TransportExceptionGap = (typeof TRANSPORT_EXCEPTION_GAPS)[number];
export const TRANSPORT_EXCEPTION_REASONS = ["paper_sighted", "treating_team_confirmed", "urgent_to_follow"] as const;
export type TransportExceptionReason = (typeof TRANSPORT_EXCEPTION_REASONS)[number];
export type TransportException = {
  at: Instant;
  by: WardFlowRole;
  step: "booked" | "collected" | "arrived";
  gaps: TransportExceptionGap[];
  reason: TransportExceptionReason;
};

export type TransportJob = {
  id: string;
  /** From `TRANSPORT_PROVIDERS`. Never free text — see that list's own doc comment. */
  provider: TransportProvider;
  escortRequired: boolean;
  bookedByRole?: WardFlowRole;
  bookedByUnitId?: string;
  /**
   * WHO BOOKED THIS JOB — owner ruling WLQ-11 (2026-09-15): *"whoever booked transport may cancel
   * it; the receiving ward still may not."* Before this the record stored no attribution at all
   * (see the superseded assertion in `tests/ward-book-transport.test.ts`), because nothing needed
   * to tell one booker from another. `CANCEL_TRANSPORT`'s `ward` branch (`ward-flow-reducer.ts`)
   * needs exactly that now, so this field exists to answer it and nothing more.
   *
   * `role` is recorded for every booker (`ed`, `ward` and `community` alike). `unitId` is recorded
   * ONLY for a `ward` booker — the claim-not-proof unit identity already used by `actingUnitId`
   * everywhere else in this model, read from the ward screen's own route parameter and never
   * authenticated.
   *
   * 🔴 **`placeId` ADDED — owner's third ruling, 2026-09-17: "only the community team that booked
   * transport may cancel it" (answer 9).** Recorded ONLY for a `community` booker, from the same
   * `actingPlaceId` claim-not-proof discipline `MARK_NOTICE_READ` already uses for a community
   * team's route-parameter identity. This is what closes the gap this comment used to describe —
   * `ed` still has no equivalent identity anywhere in this model, which is why `CANCEL_TRANSPORT`
   * grants it an unconditional right rather than a checked one.
   *
   * ⚠️ ABSENT ON EVERY PRE-EXISTING (seeded) TRANSPORT JOB, which predates this field and carries
   * no booker. `CANCEL_TRANSPORT`'s `ward`/`community` branches treat that absence as "not the
   * booker" — TR-D6's original coordinator/ED-only rule, unchanged for those jobs.
   */
  bookedBy?: { role: WardFlowRole; unitId?: string; placeId?: string };
  /**
   * THE CAD TRANSPORT NUMBER — owner's third ruling, 2026-09-17: booking this control logs a
   * transport already arranged by phone, named by the CAD (Computer-Aided Dispatch) number the
   * caller was given. Typed text, never derived — see `case "BOOK_TRANSPORT"`'s own comment
   * (`ward-flow-reducer.ts`) for the required-and-never-defaulted discipline every other answer on
   * this event already holds to, and `ward-flow-persistence-classification.ts` for why this field
   * puts the whole event on the typed-text list.
   *
   * ⚠️ OPTIONAL ON THE TYPE, NEVER OPTIONAL ON THE EVENT. `case "BOOK_TRANSPORT"` refuses a booking
   * that omits it, so every job THIS REDUCER CREATES carries one. It is optional here only because
   * every pre-existing (seeded) transport job predates this ruling and carries none — the same
   * "not recorded" reading `bookedBy` above and `formRequired` below already hold to.
   */
  cadNumber?: string;
  /**
   * WHAT THE BOOKER STATED ABOUT THE TRANSPORT — owner's third ruling, 2026-09-17, one of the three
   * answers the booking popup asks for. From `TRANSPORT_LEGAL_STATUSES`, membership-checked by the
   * reducer, same discipline as `provider`. Required and never defaulted, same as `escortRequired`.
   *
   * ⚠️ **NOT `Movement.legalStatus`, AND DOES NOT CHANGE IT.** See `TRANSPORT_LEGAL_STATUSES`'s own
   * doc comment for why the two are independent facts that can genuinely disagree.
   *
   * Optional on the type for the same seed-predates-this reason `cadNumber` above states.
   */
  transportLegalStatus?: TransportLegalStatus;
  /** Audit fix (13 Oct 2026): steps taken with a check open, oldest first. Absent when none. */
  exceptions?: TransportException[];
  /**
   * THE ESTIMATED TIME THE BOOKER WAS GIVEN — owner's third ruling, 2026-09-17, the third of the
   * three booking-popup answers. Typed as HH:MM by the person logging the call and resolved to an
   * `Instant` (today or tomorrow) by the popup itself, the same typed-time parsing the ED screen's
   * legal-form expiry controls already use — never computed from a duration (D5).
   *
   * Optional on the type for the same seed-predates-this reason `cadNumber` above states.
   */
  estimatedAt?: Instant;
  /**
   * The form this transfer requires. **STILL A BARE STRING, and that is a known gap rather than an
   * oversight** — `TR-D2` asks for it to draw from `SELECTABLE_LEGAL_FORMS`, and it should.
   *
   * Not done here because the change is not local. `SELECTABLE_LEGAL_FORMS` is typed
   * `readonly LegalForm[]` with `code: string`, so deriving a union from it needs `as const` on
   * that array — and `ward-legal-forms.ts` is pinned in roughly fifteen places by
   * `tests/ward-legal-figure-guard.test.ts`, the Mental Health Act figure guard the owner has said
   * must never be disturbed. Widening a type there is a deliberate change with that guard in front
   * of it, not a side effect of removing two organisation names from a different field.
   *
   * Nothing writes a bad code today: the only populated `formRequired` comes from the seed.
   */
  formRequired?: string;
  acceptedAt?: Instant;
  enRouteAt?: Instant;
  /**
   * ⚠️ `arrivedAt` AND `cancelledAt` READ AS INDEPENDENT AND ARE NOT — `closure` on `Movement`
   * (below) is the invariant that keeps them apart, and it is NOT stated anywhere in this type.
   *
   * Nothing here stops a hand-built `TransportJob` from carrying both `arrivedAt` and
   * `cancelledAt`, but the reducer can never produce one. In `ward-flow-reducer.ts`,
   * `PATIENT_ARRIVED` sets `arrivedAt` and the movement's own `closure` in the same update, and
   * refuses to run at all once `movement.closure` is already set. `RECORD_EXAMINATION`'s
   * `community_order`/`revoked` branch — the one that closes a movement without an admission —
   * sets `cancelledAt` the same way, guarded by the identical `movement.closure` check.
   * Whichever of the two runs first sets `closure`, and that is what makes the second one
   * impossible; nothing on `TransportJob` itself does the excluding.
   *
   * A fourth terminal transition that sets one of these fields (or a new one) MUST do both halves
   * of that: reject when `movement.closure` is already set, and set `closure` itself in the same
   * update. Do either alone and this type stops matching what the reducer can actually produce.
   *
   * 🔴 **WLQ-38 (owner, 2026-09-15) ADDED THE FOURTH AND FIFTH TERMINAL TRANSITIONS, AND BOTH FOLLOW
   * THE RULE ABOVE EXACTLY.** A post-acceptance `WITHDRAW_REFERRAL` (the referrer or the coordinator
   * revoking an accepted referral before the patient is collected) sets `cancelledAt` on any booked
   * job and `movement.closure` in the same update, guarded by the same `movement.closure` check
   * every other writer here already uses. `STOP_TRANSPORT` (a new event, for AFTER the patient is
   * collected — see `stoppedAt` below) does the same, so a stopped job also carries `cancelledAt`:
   * `orphanedTransport` (`ward-derivations.ts`) already excludes every closed movement from its own
   * sweep on the stated assumption that whichever event closed it also cancelled the job, and a
   * fourth or fifth writer that forgot would be exactly the "third terminal path that forgot" its
   * own comment names.
   *
   * (`collectedAt` is not part of this exclusion — it is an intermediate step either terminal path
   * can follow, not a terminal state of its own. And `CANCEL_TRANSPORT`, despite the name
   * similarity, never sets `cancelledAt` at all: it replaces the whole job with a fresh one for
   * rebooking and records the old one in `movement.unwinds` instead — see `UnwindRecord` below.)
   */
  collectedAt?: Instant;
  arrivedAt?: Instant;
  cancelledAt?: Instant;
  /**
   * WLQ-38 (owner, 2026-09-15): `STOP_TRANSPORT` stops a journey AFTER the patient has been
   * collected, which `CANCEL_TRANSPORT` refuses to do ("the patient has departed"). These fields
   * are that event's own record — who stopped it, when, and why (from `STOP_TRANSPORT_REASONS`,
   * `ward-change-reasons.ts`) — kept apart from `cancelledAt` above because a stopped job and a
   * cancelled-before-collection job are different situations a future screen may need to tell
   * apart, even though both also carry `cancelledAt` (see that field's own comment). All four are
   * set together, by `STOP_TRANSPORT` alone, or none of them at all.
   */
  stoppedAt?: Instant;
  stoppedBy?: WardFlowRole;
  stopReason?: string;
  /**
   * Build plan item 31 (T3, 2026-09-17): where the patient actually is, recorded in the same
   * `STOP_TRANSPORT` write as the three fields above. `string`, not the closed
   * `TransportWhereabouts` union above it, for the same reason `stopReason` is a plain `string`
   * rather than `StopTransportReason`: this type stays decoupled from `ward-change-reasons.ts`,
   * and the reducer's own membership check is what actually enforces the closed list.
   */
  stoppedWhereabouts?: string;
  /**
   * Build plan item 29 (T4a, 2026-09-17) / R2-7: a collected journey diverted to a place other
   * than the accepting ward. Written only by `RECORD_DIVERSION`, all four fields together or
   * none. The movement stays OPEN and the bed stays held until `RELEASE_DIVERTED_BED` — unlike
   * `STOP_TRANSPORT`, which closes the journey in the same write. `place`/`reason` are plain
   * `string` for the same decoupling reason `stoppedWhereabouts`/`stopReason` are; the reducer's
   * membership checks against `TRANSPORT_WHEREABOUTS` / `DIVERSION_REASONS` enforce the lists.
   */
  diversion?: {
    at: Instant;
    by: WardFlowRole;
    place: string;
    reason: string;
  };
  needed?: boolean;
};

/**
 * WHETHER THIS PATIENT NEEDS TRANSPORT AT ALL — the third state, owner ruling R-2026-09-04-C.
 *
 * ⚠️ **THREE STATES, NOT TWO, AND THE ABSENT ONE IS THE DEFAULT.** `Movement.transport` answers
 * "is there a job?", and until this field existed that was the only thing the model held: a
 * movement with no `TransportJob` could mean **no transport is needed** (the ward is across the
 * corridor, the patient is walking) or **no transport has been booked yet**, and a screen could
 * honestly say no more than "no transport recorded". Those are opposite operational situations —
 * one is finished and one is outstanding — and they rendered identically.
 *
 * Deliberately the same shape as `Referral.medicalClearance`, which already models exactly this
 * uncertainty: a stated answer plus the time it was stated, and ABSENCE meaning **nobody has said**
 * rather than "no". Read it through `transportNeedState` (`ward-derivations.ts`), which names all
 * three so a caller cannot accidentally collapse two of them with `?? false`.
 *
 * ⚠️ **DO NOT DEFAULT IT AND DO NOT BACKFILL IT.** The ruling's own words: a migration that guessed
 * one of the other two for legacy movements would manufacture the very certainty this field exists
 * to provide honestly. Every hand-authored movement in `ward-movements.ts` and every generated one
 * therefore carries nothing here, and reads as "not recorded".
 *
 * ⚠️ **IT SAYS NOTHING ABOUT `TransportJob.formRequired`, WHICH IS STILL AN UNVALIDATED BARE
 * STRING** (see that field's own comment). A screen showing `needed` beside a form code must not
 * let the recorded need imply the form was checked; nothing checks it.
 */
export type MovementTransportNeed = {
  /** The answer somebody gave. `false` is a real answer — "this patient needs no transport". */
  needed: boolean;
  at: Instant;
};

/**
 * WHY A MOVEMENT CARRIES NO `referralId`, when somebody has actually said why.
 *
 * Owner ruling R-2026-09-04-D, second half. `Movement.referralId` being absent had three different
 * causes that rendered identically, and **only the first is clinical**:
 *
 *   - `none_raised` — nobody raised a front-door referral for this person. A recorded answer.
 *   - `not_asked` — the journey was raised at runtime and whoever raised it was never asked which
 *     referral it came from. Record-keeping, written by `RAISE_REFERRAL` itself.
 *   - *the field absent entirely* — the movement predates the link (`ward-movements.ts`'s
 *     hand-authored fixture) or nothing has ever recorded anything. Record-keeping, and the
 *     DEFAULT, in the same discipline as `MovementTransportNeed` above.
 *
 * ⚠️ **`none_raised` IS THE ONLY ONE A SCREEN MAY TREAT AS A CLINICAL FACT.** The ruling exists
 * because an earlier one asked for an absent referral to be rendered as the loudest thing on the
 * page; against the data of the day that would have reported that nobody was looking for anybody,
 * anywhere, with every gate green.
 *
 * ⚠️ **AND `none_raised` DOES NOT MEAN "NOBODY IS LOOKING FOR A BED".** It means no FRONT-DOOR
 * referral brought this person in. The bed search is `referredUnitIds`/`declines`, a different
 * absence with its own unresolved version of this problem — see `ed-home-derivations.ts`'s own
 * doc block, which refuses to count it for exactly this reason.
 */
export const MOVEMENT_REFERRAL_ABSENCE_REASONS = ["none_raised", "not_asked"] as const;
export type MovementReferralAbsenceReason = (typeof MOVEMENT_REFERRAL_ABSENCE_REASONS)[number];

export type MovementReferralAbsence = {
  reason: MovementReferralAbsenceReason;
  at: Instant;
};

/**
 * The undo the prototype has never had (Task 3, spec item 10). Before this, the only path that
 * released a pulled bed or cancelled a transport job was closing the movement outright — recording
 * an examination with outcome `community_order` or `revoked` — so a coordinator who pulled the
 * wrong bed had to declare the patient does not need admission in order to correct it.
 * `RELEASE_PULL` and `CANCEL_TRANSPORT` unwind exactly one earlier reservation each, WITHOUT
 * closing the movement, clearing `legalForm`, or touching `referredUnitIds` — the movement
 * survives and keeps its acceptance. Every unwind is recorded here so the fact that a pull or a
 * transport job was undone is never silently lost, the same discipline `StatusChange` and
 * `UrgencyChange` already hold to for their own reversible facts.
 */
export type UnwindRecord = {
  at: Instant;
  /**
   * The third and fourth kind, added for the coordinator step-back / withdraw-acceptance pair
   * (Task 5, ward-flow movement step-track plan, 2026-09-04, owner rulings E and F). Appended to
   * this ONE existing audit trail rather than a second store — ruling 3 of that plan is explicit
   * that inventing a second place to record an unwind is the defect, not a variant to avoid.
   *
   * `"stage_corrected"`: `STEP_BACK_STAGE` — a coordinator record correction, moving `stage`
   * strictly backwards with no other side effect.
   * `"acceptance_withdrawn"`: `WITHDRAW_ACCEPTANCE` — the coordinator undoes a WARD's earlier
   * "yes" (distinct from `WITHDRAW_REFERRAL`, which is the REFERRER taking its own referral back).
   */
  kind: "pull_released" | "transport_cancelled" | "stage_corrected" | "acceptance_withdrawn";
  by: string;
  reason: string;
  /** The cancelled job retained in the audit trail when a replacement becomes active. */
  transportId?: string;
  /** CAD or dispatch tracking number for a cancelled transport job. */
  cadNumber?: string;
  /**
   * Which ward's acceptance was withdrawn — populated only for `"acceptance_withdrawn"`, parallel
   * to `transportId` above. `WITHDRAW_ACCEPTANCE` clears `Movement.acceptedUnitId` in the same
   * update, so nothing else on the record would say who it used to be without this field.
   */
  unitId?: string;
};

/**
 * ONE STAGE TRANSITION — the single record of how a patient moved, replacing a reconstruction of
 * the journey from scattered timestamps (Task 4, ward-flow movement step-track plan, 2026-09-04).
 *
 * ⚠️ **APPEND-ONLY, ALWAYS.** Nothing ever rewrites or removes an entry, including a later
 * coordinator step-back — that appends its OWN backwards entry rather than editing the one it is
 * correcting. The array is the movement's history, not its current state; `movement.stage` alone
 * still answers "where is this patient now".
 *
 * `from` IS OPTIONAL AND ABSENT EXACTLY ONCE — on creation (`RAISE_REFERRAL`), where there is no
 * previous stage to name. An entry is still written there, so step 1 of the track lives inside
 * this array rather than being reachable only through `Movement.openedAt`.
 *
 * `by` IS A ROLE, NEVER A PERSON — the same discipline as `StatusChange.by`, `UrgencyChange.by`
 * and `Override.by`. Every reducer case that writes an entry takes it from the triggering event's
 * own `role`, never from a name a caller could supply.
 *
 * ⚠️ **THIS DOES NOT REPLACE `openedAt`, `referredAt`, `acceptedAt`, `transport.collectedAt` OR
 * `closure.at`.** Each of those has other consumers that read it directly (the ED referral board,
 * `daysInBed`, the outbox), and removing any of them to avoid "two places recording the same
 * fact" would break those callers for no gain. Two sources that AGREE, with something that
 * actually checks they agree, is the honest design; two sources with nobody checking is how this
 * project got a live-drift incident. `tests/ward-movement-stage-changes.test.ts` is that check.
 * A stage restored after a correction is the exception: its entry records the restoration time
 * and reason while the original physical `transport.collectedAt` remains unchanged.
 *
 * ⚠️ **AN EMPTY ARRAY HAS TWO DIFFERENT CAUSES, DECIDABLE FROM `movement.stage` ALONE.** A
 * movement still at `placement_requested` with no entries has made no transitions yet — the
 * ordinary case for a freshly raised movement. A movement at any LATER stage with no entries
 * PREDATES this field — every hand-authored and generated movement in `ward-movements.ts` is in
 * this second class, because none of them was reached by dispatching an event. A renderer must
 * say which; treating both as one "no record" absence is the exact defect this plan exists to
 * close on the fields that came before it.
 *
 * Never backfilled: existing hand-authored and generated movements keep `stageChanges: []`
 * exactly as authored. "No record of how this movement moved" is the honest answer for them, not
 * a gap to be invented shut.
 */
export type StageChange = {
  /** Time the recorded stage changed. A restoration after correction does not replace the
   * original physical transport timestamp; its reason identifies the restoration. */
  at: Instant;
  from?: MovementStage;
  to: MovementStage;
  by: string;
  reason?: string;
};

/**
 * A MOVEMENT's id — one person's journey through the system, never the person.
 *
 * ⚠️ **A TEMPLATE LITERAL TYPE RATHER THAN `string`, AND IT IS A DEFECT FIX RATHER THAN
 * TIDINESS.** The route was `/patients/[patientId]` (now
 * `/ward-flow/movements/[movementId]`) and rendered a MOVEMENT workspace: its parameter
 * was called `patientId` (now `movementId`), its component prop was called `patientId` (now
 * `movementId`), and inside it a variable named `patient` is still typed `Movement`. Every
 * identifier involved was a bare `string`, so nothing stopped a real patient id being passed to it
 * — and the names openly invited exactly that. It worked only because every existing call site
 * happened to pass a movement.
 *
 * With `MovementId` and `PatientId` as distinct types the mistake the name invites now fails to
 * COMPILE instead of rendering a dead-end "no movement matches" page. Every movement id in the
 * fixture is already `WF-###`, so no literal needed changing.
 */
export type MovementId = `WF-${string}`;

/**
 * The result of a psychiatric examination. `"further_examination_ordered"` is item 7 of the
 * owner's 17 September answers: *"a repeat examination is a new record, with a 'further
 * examination ordered' outcome."* It settles nothing — `RECORD_EXAMINATION` records it and
 * changes nothing else about beds or transport — and it is the only outcome after which a second
 * examination is ever accepted; every other outcome keeps the "already examined" refusal that
 * predates this type. `"community_order"` and `"revoked"` are the two outcomes that mean the
 * inpatient order was revoked — `examinationRevokedWhileBedHeld` (`ward-derivations.ts`) reads
 * this field for exactly those two values, never `"inpatient_order"` or
 * `"further_examination_ordered"`, neither of which is a revocation.
 */
export const EXAMINATION_OUTCOMES = [
  "inpatient_order",
  "community_order",
  "revoked",
  "further_examination_ordered",
] as const;
export type ExaminationOutcome = (typeof EXAMINATION_OUTCOMES)[number];

export const ED_OUTCOMES = ["for_discharge", "for_community_follow_up"] as const;
export type EdOutcome = (typeof ED_OUTCOMES)[number];

export type CapacityRefreshRequest = {
  /** Creation identity, retained through trimming and serialization; absent on legacy saves. */
  id?: string;
  unitId: string;
  at: Instant;
  byRole: string;
  message?: string;
  urgent?: boolean;
  /** DEC-L5-04: the ward's confirmation count when the request was made; absent on legacy saves. */
  confirmations?: number;
};

/** Human-recorded turnaround preference only; reserves no bed and books no transport. */
export type TurnaroundPriority = { unitId: string; flaggedAt: Instant; source: "cld" | "departure" };

/**
 * Timestamped clinical reassessment entry recorded when an ED or referring clinician updates
 * a referral or movement's presentation, medical clearance, or acuity while awaiting bed placement.
 */
export type ClinicalReassessmentEntry = {
  readonly at: Instant;
  readonly by: WardFlowRole;
  readonly note?: string;
  readonly clinicalUpdate?: boolean;
  readonly clearanceUpdated?: boolean;
  readonly urgency?: UrgencyLevel;
  readonly highAcuity?: boolean;
};

/** A transition the reducer refused, surfaced on the coordinator screen rather than swallowed. */
export type Rejection = {
  id: string;
  at: Instant;
  movementId: string;
  attempted: string;
  reason: string;
};
