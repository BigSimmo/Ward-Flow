import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";

/**
 * 🔴 **D-11 — Ward Lead's delegated ruling D-11, 2026-09-11, not the owner's.** The owner released a
 * blocked queue of twelve questions under his standing instruction: *"Go ahead with all
 * recommendations for 12 blockers."* `docs/ward-flow/owner-decisions-2026-09-1x.md`'s 2026-09-11
 * section introduction states plainly that he "has not stated a clinical position on any of the
 * questions below," that every ruling in that section "is MINE" (Ward Lead's), and that "a later
 * reader must not quote any of them back as 'the owner decided'."
 *
 * **What D-11 itself says**, narrowly: a clinician typing a patient's referral history into the
 * intake form's draft box should be WARNED before navigating away, and that text should never be
 * PERSISTED. It is a ruling about one form's free-text history field, given because holding that
 * draft would write clinical prose about a named person into browser storage on a shared computer,
 * where the next user may be a different clinician or none at all.
 *
 * **What follows below is this session's own design choice, not D-11 restated.** Applying D-11's
 * underlying concern — human-typed text surviving into shared browser storage — to the WHOLE
 * persisted session, and to every field in this event union that can carry such text rather than
 * only the one field D-11 named, is a generalisation made here, on the same reasoning, not a
 * quotation of a wider ruling that does not exist.
 *
 * 🔴 **THIS COMMENT PREVIOUSLY NAMED `Referral.history` AND `Movement.blocker` AS THE ONLY TWO
 * FIELDS COVERED, AND BOTH THE LIST AND THE MECHANISM WERE WRONG** — Opus adversarial review,
 * 2026-09-17 (findings F2/F7). `ADD_PATIENT` writes a typed given name, family name, record number
 * and date of birth (`state.patients`); `Referral.sendingTeamName` is a typed free-text box —
 * being about a team rather than a patient never made it non-text; `RECORD_ESCALATION.contact` is a
 * bare `string` the reducer stores verbatim with no membership check, unlike every genuine
 * fixed-list reason/blocker field elsewhere in this model; and `REFER_TO_COMMUNITY_TEAM.reason` is
 * an optional field the reducer does not screen. Field-by-field blanking of two named fields could
 * never keep pace with a 61-member, still-growing event union — the next typed-text field would land
 * with nobody remembering to add it here, exactly the class of defect
 * `docs/ward-flow/fields-with-no-producer-2026-09-01.md` exists to catch from the other direction.
 *
 * **THE RULE NOW: DEFAULT DENY, LOCKED ON DISPATCH.** Persistence is allowed only while this session
 * has dispatched exclusively events whose type is on `WARD_FLOW_TEXT_SAFE_EVENT_TYPES` below — a
 * closed, explicit allowlist of event types whose payload can never carry human-typed prose (ids,
 * fixed-list codes, instants, numbers and the caller's own role only). The moment ANY event whose
 * type is on `WARD_FLOW_TYPED_TEXT_EVENT_TYPES` is DISPATCHED — whether the reducer goes on to accept
 * or refuse it — the provider clears whatever is already in `sessionStorage` and writes nothing more
 * for the rest of the session, until a genuine reseed re-enables it. See
 * `trackWardFlowTypedTextDispatch` below for the mechanism and for why acceptance is deliberately not
 * the trigger (Opus adversarial review, 2026-09-17, P2 findings 4–6). A new event either has an
 * entry on one of the two lists below or the union-coverage guard in
 * `tests/ward-flow-provider-persistence-privacy.dom.test.tsx` fails the build, so there is no third,
 * unclassified state a new field can fall into silently.
 *
 * ⚠️ **THIS ALSO MEANS SEEDED AND ENGINE-WRITTEN TEXT IS NO LONGER BLANKED — DELIBERATELY, NOT AN
 * OVERSIGHT.** The old blanking applied to EVERY `Referral.history` and EVERY `Movement.blocker`,
 * seeded or typed alike (Opus finding F3): after a restore the console showed every movement as
 * `Blocked — Somebody wrote: ""`, the priority queue lost its obstruction points, and every history
 * read "Not written yet". The fixture's own prose is not a disclosure — it ships inside the
 * application bundle already, known to anyone who can read the source — so once no session can ever
 * reach storage with a HUMAN-typed value in it, there is nothing left to strip, and the restored
 * board should read exactly as it did before the reload.
 */
export const WARD_FLOW_TYPED_TEXT_EVENT_TYPES: ReadonlySet<WardFlowEvent["type"]> = new Set<WardFlowEvent["type"]>([
  // `state.patients` gains a typed given name, family name, record number (`umrn`) and date of
  // birth — the clearest identity disclosure this model can produce (`patients/add-patient.tsx`).
  "ADD_PATIENT",
  // `history` is this event's own "the only free text this event carries" (see its doc comment in
  // `ward-flow-events.ts`), and `sendingTeamName` is the typed free-text box named above.
  "RECEIVE_REFERRAL",
  // `blocker` IS the free prose — "so a human can say what is actually happening, IN THEIR WORDS".
  "RECORD_MOVEMENT_BLOCKER",
  // `reason` is an optional field the reducer stores as supplied, with no membership check against
  // any fixed list — unlike every genuine reason field elsewhere in this model.
  "REFER_TO_COMMUNITY_TEAM",
  // `contact` is a bare `string`, stored verbatim by `case "RECORD_ESCALATION"` with no membership
  // check — the one UI call site (`shortlist-panel.tsx`) offers a closed `<select>` of role/service
  // names, but neither the event's own type nor the reducer enforces that, so a caller off that one
  // screen (a future control, a script, a malformed dispatch) could store anything typed into it.
  "RECORD_ESCALATION",
  // RB7 (build plan item 27, 2026-09-17): `note` is human-typed prose, appended to
  // `Referral.corrections` — exactly the same shape `history` on `RECEIVE_REFERRAL` above already
  // is, and the reason D-11 named this list's rule at all.
  "ADD_REFERRAL_CORRECTION",
  // Owner's third ruling, 2026-09-17: `cadNumber` is the CAD transport number a person types while
  // logging a phone-made booking — typed text, stored verbatim on `TransportJob.cadNumber`, with
  // no membership check against any fixed list. `transportLegalStatus` and `estimatedAt`, the
  // event's other two new fields, are membership-checked/numeric and would have been safe alone,
  // but one typed-text field puts the whole event on this list — the same "one field decides the
  // event" rule `RECEIVE_REFERRAL` and `REFER_TO_COMMUNITY_TEAM` above already hold to.
  "BOOK_TRANSPORT",
  // CAD/tracking number is typed text, just as on BOOK_TRANSPORT.
  "RECORD_REPATRIATION",
  "SET_ARRIVAL_DETAILS",
  "UPLOAD_PATIENT_FORM",
  "DISPATCH_BROADCAST_ALERT",
  // Stream D, 9 Oct 2026: `initials` is typed by a person (one to three letters, normalised and
  // pattern-checked, but still typed about a person), so booking locks persistence like ADD_PATIENT.
  "BOOK_PLANNED_ADMISSION",
  // 9 Oct 2026: `who` (the person told) and `reason` (why it does not apply) are typed text.
  "RECORD_SUPPORT_NOTIFICATION",
]);

/**
 * Every OTHER event type in the union — 57 of 62 (RA1, item 18, added `WITHDRAW_WARD_REQUEST`
 * 2026-09-17). Each one is on this list because its payload,
 * read field by field in `ward-flow-events.ts`, is built only from ids, a value the reducer
 * membership-checks against a named constant, a boolean, an `Instant`/number, or the caller's own
 * `role` — never a `string` typed by a person and stored as typed. Built by reading every field on
 * every union member once, on 2026-09-17.
 *
 * ⚠️ **EIGHT FIELDS ARE THE EXCEPTION TO "MEMBERSHIP-CHECKED", AND SAYING OTHERWISE WAS ITSELF A
 * FINDING** (Opus adversarial review, 2026-09-17, P3 findings 3/6, widened in the second review
 * round): `CHANGE_LEGAL_STATUS.legalStatus`, `FLAG_BED_RELEASE.waitingOn`, `STEP_BACK_STAGE.to`,
 * `SET_SCENARIO.scenario`, `RECORD_EXAMINATION.outcome`, `RECORD_LEAVING.leavingDestination` and
 * `CHANGE_URGENCY.urgency`, plus `RAISE_REFERRAL`'s nested `draft.cohort` / `draft.security` /
 * `draft.sex` / `draft.legalStatus` / `draft.urgency`, are each read and stored with NO runtime check
 * against their named constant — confirmed by reading every one of these cases on 2026-09-17. They
 * are safe anyway because each is **union-typed (compile-time only)**: `LegalStatus`,
 * `BedReleaseWaitingOn`, `MovementStage`, `WardScenario`, `1 | 2 | 3` (urgency),
 * `"inpatient_order" | "community_order" | "revoked" | "further_examination_ordered"` (outcome),
 * `LeavingDestination`, `Cohort`, `Security` and `Sex` are all closed TypeScript unions of a small,
 * code-shaped literal set offered by a form control, never a bare `string` — so `tsc` is the only
 * enforcement, and the compile-time check below (`WardFlowReviewedStringOrUnknownKey` and what
 * follows) would not even see these fields, because none of them is typed as `string` or `unknown` to
 * begin with. `RAISE_REFERRAL.draft.legalFormCode` looks like the same shape but is NOT the same
 * case: it is a genuine `string | null`, and IS resolved against `SELECTABLE_LEGAL_FORMS` at runtime
 * (`case "RAISE_REFERRAL"`) — reviewed and listed below for that reason instead.
 * `RECORD_PATIENT_DISCHARGE.patientId` (`PatientId`, `` `PT-${string}` ``) is a DIFFERENT case again —
 * see `WardFlowReviewedStringOrUnknownKey`'s own comment for why a template-literal id is reviewed
 * and listed rather than exempted by its shape.
 *
 * `SET_CONFIGURATION` is on this list despite an `unknown` payload TYPE, and that is a considered
 * exception, not an oversight: `ward-configuration.ts`'s `validateConfiguration` is the only door
 * into `state.configuration`, and it refuses anything but exactly three in-range, on-step integer
 * fields — a fourth key, a wrong type, or an out-of-bounds value is refused whole, never partially
 * applied, so `state.configuration` itself can never carry typed text. 🔴 **THIS USED TO SAY THAT
 * MADE `SET_CONFIGURATION` SAFE ON ITS OWN, "SO AN ACCEPTED SET_CONFIGURATION CAN NEVER LEAVE TYPED
 * TEXT IN STATE" — THAT REASONING LEANED ON ACCEPTANCE, AND ACCEPTANCE IS NO LONGER WHAT MAKES ANY OF
 * THIS SAFE** (Opus adversarial review, 2026-09-17, P2 finding 1, second round): a REFUSED
 * `SET_CONFIGURATION` — or any other refused event on this list — can itself quote a raw field value
 * into its `Rejection.reason` (see `WardFlowReviewedStringOrUnknownKey`'s own comment just below for
 * the confirmed examples). What actually makes every field on this list safe, refused or not, is
 * that refusal records never reach storage: since Josh's D-18 (25 Sept 2026) the provider saves
 * `rejections: []` and the restore check refuses any stored rejection (until then, saving locked the
 * moment `rejections.length` grew at all). `state.configuration`'s own
 * validation is still real and still worth stating — it is why an ACCEPTED `SET_CONFIGURATION` writes
 * only three bounded integers — but it is no longer the sentence carrying the safety argument for a
 * REFUSED one.
 *
 * `as const satisfies` rather than a plain array: the compile-time check just below reads this
 * tuple's own literal element types one at a time, which a widened `string[]` could not offer.
 */
const WARD_FLOW_TEXT_SAFE_EVENT_TYPE_TUPLE = [
  "ACCEPT_IN_PRINCIPLE",
  "ACCEPT_REFERRAL",
  "ACKNOWLEDGE_INBOX_ITEM",
  "ADVANCE_CLOCK",
  "BLOCK_BED_RELEASE",
  "CANCEL_TRANSPORT",
  "CHANGE_LEGAL_STATUS",
  "CHANGE_URGENCY",
  "CLEAR_BED_RELEASE_BLOCK",
  "CLEAR_MOVEMENT_BLOCKER",
  "CLEAR_MOVEMENT_URGENT_FLAG",
  "COMPLETE_INBOX_ITEM",
  "CONFIRM_BED_RELEASE",
  "CONFIRM_CAPACITY",
  // T4 (2026-09-17): `movementId` is an id (reviewed above) and `reason` is a closed union
  // (`LegalFormReceiptCorrectionReason`) offered by a `<select>`, never a bare `string` — the same
  // shape `WITHDRAW_WARD_REQUEST`'s `reason` already has on this list.
  "CORRECT_LEGAL_FORM_RECEIPT",
  "DECLINE",
  "DECLINE_REFERRAL",
  "END_LEAVE_BED",
  "FLAG_BED_RELEASE",
  "FLAG_MOVEMENT_URGENT",
  "HANDOVER_READY",
  "MARK_NOTICE_READ",
  "OPEN_DISCHARGE_RECORD",
  "PATIENT_ARRIVED",
  "PATIENT_COLLECTED",
  "PULL_PATIENT",
  "RAISE_REFERRAL",
  "RECORD_ARRIVED_IN_DEPARTMENT",
  "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT",
  // RB3, item 19: `movementId` (an id), `outcome` (one of two fixed strings) and the caller's own
  // `role` — no human-typed field.
  "RECORD_ED_OUTCOME",
  // teamId resolves to a registered team; a refused id is quoted only in a refusal record, which is
  // never saved (D-18).
  "RECORD_CLINICAL_CONTACT",
  "RECORD_EXAMINATION",
  "RECORD_HANDOVER_SIGN_OFF",
  "RECORD_LEAVE_BED",
  "RECORD_LEAVING",
  "RECORD_LEFT_DEPARTMENT",
  "RECORD_LEGAL_FORM_EXPIRY",
  "RECORD_LEGAL_FORM_RECEIVED",
  "RECORD_LOCAL_BED_SOUGHT",
  "RECORD_MEDICAL_CLEARANCE",
  // Opus review round 2, 17 September 2026 (P2): `movementId` (an id), `gender` (one of
  // `REFERRAL_GENDERS`, membership-checked by the reducer) and the caller's own `role` — no
  // human-typed field, the same shape `RECORD_LEGAL_FORM_EXPIRY` above carries.
  "RECORD_MOVEMENT_GENDER",
  "RECORD_NO_REFERRAL",
  // Closed preset message vocabulary; never a typed message or a name.
  "SEND_WARD_BUZZ",
  "RECORD_ADMISSION_CARE",
  "RECORD_ADMISSION_FOLLOW_UP",
  "RECORD_PATIENT_DISCHARGE",
  "RECORD_REFERRER_WITHDRAWAL",
  "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT",
  "RECORD_TRANSPORT_NEED",
  // Owner Answer 18 (second round, 2026-09-17): `unitId`/`actingUnitId` are ids (reviewed above),
  // and `codes` is `readonly WardIntakeConstraint[]` — a closed union array, membership-checked by
  // the reducer, never a bare `string[]` — the same "array element types reviewed by hand" shape
  // `REFER_TO_UNITS.unitIds` already has on this list.
  "RECORD_WARD_INTAKE_CONSTRAINTS",
  "REFER_TO_UNITS",
  "RELEASE_BED",
  // Owner answer 8 (second round, 2026-09-17): `movementId`/`actingUnitId` are ids (reviewed
  // above) and the caller's own `role` — no human-typed field, the same shape `RELEASE_PULL`
  // immediately below already has.
  "RELEASE_HELD_BED",
  "RELEASE_DIVERTED_BED",
  "RELEASE_PULL",
  "REOPEN_INBOX_ITEM",
  "REQUEST_CAPACITY_REFRESH",
  "RESET_SCENARIO",
  "REVERT_BED_RELEASE",
  "REVIEW_AUDIT_EVENT",
  "SET_BED_PREPARATION",
  "SET_CONFIGURATION",
  "SET_SCENARIO",
  "STEP_BACK_STAGE",
  "STOP_TRANSPORT",
  "RECORD_DIVERSION",
  "TRANSPORT_ACCEPTED",
  "TRANSPORT_EN_ROUTE",
  "UPDATE_EXPECTED_DISCHARGE",
  "WITHDRAW_ACCEPTANCE",
  "WITHDRAW_REFERRAL",
  // RA1 (item 18, 2026-09-17): `movementId` / `unitId` are ids (reviewed above), and `reason` is a
  // closed union (`WardRequestWithdrawalReason`) offered by a `<select>`, never a bare `string` —
  // the same shape `DECLINE`'s `reason` already has on this same list.
  "WITHDRAW_WARD_REQUEST",
  "SET_STEP_DOWN_CANDIDATE",
  "SET_DISCHARGE_BARRIER",
  // D-34 carries only originating ED/movement ids, role and time; the audit reason is fixed by the reducer.
  "RECORD_ED_MEDICAL_DETERIORATION",
  "RECORD_MOVEMENT_MEDICAL_CLEARANCE",
  "RECORD_LEGAL_FORM_WRITTEN",
  "RECORD_COUNTRY_EXTENSION",
  "RECORD_LEGAL_FORM_CONTINUATION",
  "EVALUATE_ARRIVAL_LATENESS",
  "RELEASE_AND_REOPEN_SEARCH",
  "CLEAR_EXPECT_FLAG",
  "RAISE_EXPECT_FLAG",
  "FLAG_LEGAL_MISMATCH",
  "EVALUATE_LEAVE_BED_WARNINGS",
  "CONFIRM_MORNING_ROLLUP",
  "ACKNOWLEDGE_BROADCAST_ALERT",
  "STAND_DOWN_BROADCAST_ALERT",
  // Stream D, 9 Oct 2026: `plannedAdmissionId`/`unitId`/`actingUnitId` are ids, `reason` and
  // `legalStatus` are closed unions membership-checked by the reducer, and the rest are numbers or
  // instants. No initials or other typed text travels on these three.
  "CHANGE_PLANNED_ADMISSION",
  "CANCEL_PLANNED_ADMISSION",
  "CONVERT_PLANNED_ADMISSION",
] as const satisfies readonly WardFlowEvent["type"][];

/** Runtime form of the tuple above — an O(1)-lookup `Set`, used by the reducer wrapper and by the
 *  coverage-gap helper. Derived from the SAME literal array the compile-time check reads, so the
 *  two can never silently disagree about which 57 types are on it. */
export const WARD_FLOW_TEXT_SAFE_EVENT_TYPES: ReadonlySet<WardFlowEvent["type"]> = new Set<WardFlowEvent["type"]>(
  WARD_FLOW_TEXT_SAFE_EVENT_TYPE_TUPLE,
);

/**
 * 🔴 **THE COMPILE-TIME HALF OF THE GUARD** (Opus adversarial review, 2026-09-17, P2 finding 2). The
 * union-coverage guard test (`tests/ward-flow-provider-persistence-privacy.dom.test.tsx`) proves
 * every event type NAME is classified onto one of the two lists above. It proves nothing about
 * SHAPE: a safe-listed event whose payload gained a new bare `string` field would still compile,
 * still pass that guard (the type NAME did not change), and would then persist whatever a caller put
 * in it. This section closes that gap at `tsc` time instead of at runtime.
 *
 * Field names below are reviewed by hand and confirmed safe to carry a bare `string` (or, `payload`
 * only, `unknown`) on a `WARD_FLOW_TEXT_SAFE` event's payload — INCLUDING `RAISE_REFERRAL`'s nested
 * `draft` — without that being a typed-text risk:
 *
 *   - `movementId` / `unitId` / `admissionId` / `referralId` / `releaseId` / `leaveBedId` /
 *     `actingUnitId` / `inboxItemId` / `eventId` / `edId` / `noticeId` / `actingPlaceId` — ids. The
 *     reducer finds a real record by each of these or refuses.
 *     🔴 **"NONE IS EVER RENDERED BACK AS PROSE" WAS ITSELF WRONG AND IS DELETED, NOT SOFTENED**
 *     (Opus adversarial review, 2026-09-17, P2 finding 1, second round). Confirmed by reading the
 *     reducer: a REFUSAL quotes the raw id straight into `Rejection.reason` —
 *     `` `no movement found for id ${event.movementId}` ``, `` `no unit found for id ${event.unitId}` ``,
 *     `` `ACKNOWLEDGE_INBOX_ITEM inboxItemId ${inboxItemId} does not name a real inbox row…` `` — and
 *     `state.rejections` is persisted exactly like every other field. A caller could pass ANY string
 *     as `movementId` and have it echoed into a saved rejection. What actually protects these ids is
 *     not that they are "never rendered as prose" (they can be) but that refusal records are never
 *     written to storage (the provider saves `rejections: []`, Josh D-18, 25 Sept 2026; before that,
 *     saving locked the moment `rejections.length` grew) — see `trackWardFlowTypedTextDispatch`.
 *     `noticeId` and `actingPlaceId` are `MARK_NOTICE_READ`'s own pair (item 48, Q2, 2026-09-17):
 *     the first names a `Notice.id`, the second is the same claim-not-proof `placeId` discipline
 *     `actingUnitId` already holds elsewhere on this list, generalised because a notice's addressee
 *     may be a ward, an ED or a team.
 *   - `payload` (`SET_CONFIGURATION` only, named explicitly here because its type is `unknown`, the
 *     widest possible) — reviewed and accepted for `state.configuration`'s own reason (two comments
 *     above): `validateConfiguration` refuses anything but three in-range, on-step integers, so an
 *     ACCEPTED dispatch writes no text to STATE. A REFUSED one is covered by the same
 *     never-saved refusal records as the ids above (D-18), not by this bullet.
 *   - `legalFormCode` (`RAISE_REFERRAL`'s nested `draft` only) — `string | null`, genuinely
 *     RUNTIME-checked: `case "RAISE_REFERRAL"` resolves it against `SELECTABLE_LEGAL_FORMS` and
 *     refuses a code the picker could not have offered.
 *   - `patientId` (`RECORD_PATIENT_DISCHARGE` only) — `PatientId`, a TEMPLATE LITERAL TYPE
 *     (`` `PT-${string}` ``), not a bare `string` and not a closed union either. It is an id — the
 *     reducer finds the admission's own patient by it or the field is simply carried through — and is
 *     reviewed on that basis, the same as the plain-`string` ids above. It is listed here rather than
 *     exempted by its shape because `IsClosedUnderAppend` below (added specifically for this finding)
 *     WOULD flag it: a template literal with an open `${string}` segment is exactly the shape a
 *     genuine typed-text field could also have, so this codebase does not get to assume "it's a
 *     template, not a plain string" makes it safe without a human saying so.
 *
 * Every OTHER `string`/`unknown`-typed field anywhere in a safe event's payload — present today or
 * added later — fails the assertions below, which is the whole point: a future field with the shape
 * every genuine typed-text field in this union actually has cannot compile silently onto the
 * allowlist. `cohort`/`security`/`sex`/`legalStatus`/`urgency` on `draft`, and
 * `legalStatus`/`waitingOn`/`to`/`scenario`/`outcome`/`leavingDestination`/`urgency` elsewhere, never
 * appear in the list above at all — each is typed as a closed union (never a bare `string`), so the
 * checks below do not flag them; see the "union-typed (compile-time only)" paragraph on
 * `WARD_FLOW_TEXT_SAFE_EVENT_TYPE_TUPLE`'s own comment for why that is the correct, separately-
 * reviewed outcome for those fields rather than a gap in this one.
 *
 * ⚠️ **WHAT THIS CHECK STILL CANNOT SEE, STATED RATHER THAN LEFT TO BE DISCOVERED** (P3 finding 7):
 *   - **Array element types.** `REFER_TO_UNITS.unitIds: string[]` is outside it — a `string[]` field
 *     is not itself `string` or `unknown`, so it never reaches `IsWideString`/`IsWideUnknown`/the
 *     branded and template-literal checks below at all. Reviewed by hand instead: `unitIds` holds
 *     unit ids, membership-checked structurally elsewhere.
 *   - **Nested objects other than `RAISE_REFERRAL`'s `draft`.** The recursion into `draft` is a named
 *     special case (`UnreviewedRaiseReferralDraftKeys` below), not a general walk — a future safe
 *     event with a DIFFERENT nested object carrying a typed-text field would compile silently onto
 *     the allowlist exactly as the top-level check did before this section existed.
 *   - **`Record<string, X>` / index-signature maps.** A field typed as a map keyed or valued by an
 *     open string (none currently exists among the safe events) has no `keyof` this check can
 *     enumerate, so it would not be flagged either.
 *   Closing these generally would need either a recursive walk with a depth/cycle bound or a second,
 *   hand-maintained reviewed list per nested shape; neither is built, and this paragraph is the record
 *   that the gap is known rather than assumed closed.
 *
 * This check is scoped to `string`/`unknown` KEYS as named above, plus the two narrower shapes
 * `IsBrandedString`/`IsClosedUnderAppend` add (branded and template-literal strings) — see each
 * type's own comment for what it catches and, for the template-literal check, its one confirmed
 * limitation.
 */
type WardFlowReviewedStringOrUnknownKey =
  | "movementId"
  | "teamId"
  | "unitId"
  | "admissionId"
  | "referralId"
  | "releaseId"
  | "leaveBedId"
  // Own-team community scope, resolved against the fixed service directory and referral link.
  | "actingTeamId"
  | "actingUnitId"
  | "inboxItemId"
  | "eventId"
  | "edId"
  | "payload"
  | "legalFormCode"
  | "patientId"
  | "noticeId"
  | "actingPlaceId"
  | "formCode"
  | "alertId"
  // Stream D: names a `PlannedAdmission.id`; the reducer finds the booking or refuses.
  | "plannedAdmissionId";

/** True exactly when `T` is (or includes) the wide `string` type — never for a literal or a union of
 *  literals, which is what lets a closed code-shaped union field pass untouched while a genuine
 *  `string` field is caught. Not distributive: `string`, the checked value, is concrete and sits on
 *  the LEFT of `extends`, so a union `T` on the right is tested as one type, not branch by branch. */
type IsWideString<T> = string extends T ? true : false;

/** Same test for `unknown` — true only for `unknown` (or `any`) itself: nothing narrower has
 *  `unknown` assignable INTO it, which is what `unknown extends T` requires. */
type IsWideUnknown<T> = unknown extends T ? true : false;

/**
 * 🔴 **ADDED** (Opus adversarial review, 2026-09-17, P3 finding 7): `IsWideString` alone misses a
 * BRANDED string — `string & { readonly __brand: "X" }` — because a branded type is NARROWER than
 * `string`, not wider, so `string extends T` is false for it exactly as it is for a genuinely safe
 * closed union. None exists in this event union today; this exists so one landing later cannot
 * compile onto the allowlist unreviewed.
 *
 * Detected by comparing `keyof T` against `keyof string`: a plain string, a string literal, a union
 * of literals, and a template literal all share EXACTLY `keyof string` (the `String.prototype`
 * members) — none of them adds a property. An intersection with an object type (`string & {brand}`)
 * adds the object's own keys on top, so `keyof T` becomes a strict SUPERSET of `keyof string`.
 * Verified empirically against `string & { __brand: "X" }` (true) and every closed union and
 * template literal type this file actually uses (false), 2026-09-17.
 */
type IsBrandedString<T> = T extends string
  ? keyof string extends keyof T
    ? keyof T extends keyof string
      ? false
      : true
    : false
  : false;

/**
 * 🔴 **ADDED** (Opus adversarial review, 2026-09-17, P3 finding 7): catches a TEMPLATE LITERAL type
 * built from an open placeholder — `PatientId` (`` `PT-${string}` ``) is the concrete case this
 * exists for; `IsWideString` does not catch it, because `string extends \`PT-${string}\`` is false
 * (a template literal is NARROWER than `string`, exactly like a genuinely safe closed union is).
 *
 * Detected by testing whether `T` is "closed under appending one character": for a CLOSED literal or
 * union of literals, `` `${T}x` `` (every member with an "x" appended) is a DIFFERENT set of strings
 * and so is NOT assignable back to `T`. For an OPEN template literal, appending a character to
 * something that already matches an unconstrained trailing segment still matches that same segment,
 * so `` `${T}x` `` IS assignable back to `T`. Verified empirically, 2026-09-17, against `PatientId`
 * (true), a two-placeholder template (true), `WardFlowRole` and every reason/status/kind union this
 * file's own sibling types use (false), and plain `string` (true, but `IsWideString` catches that
 * case first, so it never reaches this check in practice).
 *
 * ⚠️ **ONE CONFIRMED LIMITATION, DOCUMENTED RATHER THAN SILENTLY WRONG.** An OPTIONAL branded or
 * template-literal field (`field?: PatientId`, i.e. `T | undefined`) is NOT reliably caught: TypeScript
 * resolves `IsClosedUnderAppend<T | undefined>` to `boolean` rather than a clean `true`/`false` for
 * this specific shape (confirmed empirically, 2026-09-17 — a conditional-type distributivity
 * interaction between the optional union and the template-literal probe inside this check). No such
 * field exists in the safe-event union today: `RECORD_PATIENT_DISCHARGE.patientId` is REQUIRED, not
 * optional. A reviewer adding an OPTIONAL branded or template-literal field to a safe event's payload
 * must verify it by hand rather than trusting this check to flag it.
 */
type IsClosedUnderAppend<T> = T extends string ? (`${T}x` extends T ? true : false) : false;

/** The keys of `Payload` whose value is a bare `string` or `unknown`, a branded string, or an open
 *  template-literal string — the shapes a genuine typed-text field in this union can have — and is
 *  NOT on the reviewed list above. Exported so the compile-time sentinel test can run it against a
 *  synthetic payload and prove it can fail. */
export type UnreviewedStringOrUnknownKeys<Payload> = {
  // `-?` strips the optional modifier from THIS mapped type's own properties (never from
  // `Payload`): without it, an optional source field (most fields on this union are optional)
  // makes the corresponding property here optional too, and indexing an object type with an
  // optional property by `[keyof Payload]` pulls a spurious `undefined` into the result — caught
  // by `tsc` itself (`error TS2344: Type 'undefined' does not satisfy the constraint 'never'`)
  // while building this check, not a defect anyone had to spot by reading.
  [K in keyof Payload]-?: K extends WardFlowReviewedStringOrUnknownKey
    ? never
    : IsWideString<Payload[K]> extends true
      ? K
      : IsWideUnknown<Payload[K]> extends true
        ? K
        : IsBrandedString<Payload[K]> extends true
          ? K
          : IsClosedUnderAppend<Payload[K]> extends true
            ? K
            : never;
}[keyof Payload];

/** Forces `T` to be exactly `never`, or `tsc` refuses to compile the assignment and names the
 *  offending key in its error. Exported for the same reason as `UnreviewedStringOrUnknownKeys`. */
export type AssertNever<T extends never> = T;

type UnreviewedSafeEventPayloadKeys = {
  [T in (typeof WARD_FLOW_TEXT_SAFE_EVENT_TYPE_TUPLE)[number]]: UnreviewedStringOrUnknownKeys<
    Extract<WardFlowEvent, { type: T }>
  >;
}[(typeof WARD_FLOW_TEXT_SAFE_EVENT_TYPE_TUPLE)[number]];

type UnreviewedRaiseReferralDraftKeys = UnreviewedStringOrUnknownKeys<
  Extract<WardFlowEvent, { type: "RAISE_REFERRAL" }>["draft"]
>;

// 🔴 THE CHECK ITSELF. Either assignment fails `tsc` the moment a safe-listed event (or
// `RAISE_REFERRAL`'s own `draft`) gains a `string`/`unknown` field not on the reviewed list above.
// Exported (P3 finding 7, second review round) so
// `tests/ward-flow-provider-safe-payload-shape-guard.test.ts` can import these two aliases BY NAME
// and reference the REAL `WardFlowEvent` union through them — deleting either declaration below (or
// its export) then fails `tsc` with "has no exported member", not merely a silently-weaker guard.
// The synthetic sentinels in that test file prove the CHECK MACHINERY can fail; this pair is what
// proves the machinery is actually WIRED UP against the real union rather than only demonstrated
// against a disconnected synthetic type.
// No eslint-disable needed here: `export` alone satisfies `no-unused-vars` (an exported symbol is
// reachable from outside the module by definition), unlike the module-internal `_AssertNo…` aliases
// this replaced, which needed the directive precisely because they were NOT exported before.
export type _AssertNoUnreviewedSafeEventPayloadFields = AssertNever<UnreviewedSafeEventPayloadKeys>;
export type _AssertNoUnreviewedRaiseReferralDraftFields = AssertNever<UnreviewedRaiseReferralDraftKeys>;

/**
 * Every event type in `types` that is on NEITHER list above — a coverage gap. Takes an explicit list
 * rather than reading `EVENT_ROLE`'s keys itself so a test can hand it a synthetic type and prove the
 * helper actually reports a gap, not merely that it returns empty for the real union (a check that
 * cannot fail is worse than no check — see `docs/agents/*` on that class of defect).
 *
 * The real guard passes `Object.keys(EVENT_ROLE)` — `EVENT_ROLE` is typed
 * `Record<WardFlowEvent["type"], …>`, so `tsc` already refuses to compile it missing a member; this
 * helper turns that static guarantee into a runtime one the test suite can assert on directly, and
 * one that fires the day a new event type is added to the union without a decision recorded here.
 */
export function findWardFlowEventTypeCoverageGaps(types: readonly string[]): string[] {
  return types.filter(
    (type) =>
      !WARD_FLOW_TEXT_SAFE_EVENT_TYPES.has(type as WardFlowEvent["type"]) &&
      !WARD_FLOW_TYPED_TEXT_EVENT_TYPES.has(type as WardFlowEvent["type"]),
  );
}
