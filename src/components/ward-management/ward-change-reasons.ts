/**
 * Fixed reason lists. Chosen, never typed — the same treatment `DECLINE_REASONS` already has,
 * and for the same reason: the synthetic-data promise must be true by construction rather than
 * by a user reading a label and complying.
 *
 * These are deliberately operational and content-free. NONE of them describes a patient, a
 * diagnosis, a clinical judgement or a legal requirement. A reason reading "patient
 * deteriorated" would be narrative clinical content; one reading "order made" would be a claim
 * about the Mental Health Act. Both are forbidden. If richer reasons are wanted they come from
 * the product owner; no agent adds one.
 */
export const URGENCY_CHANGE_REASONS = ["reassessed", "new_information", "correcting_an_error"] as const;
export type UrgencyChangeReason = (typeof URGENCY_CHANGE_REASONS)[number];

export const LEGAL_STATUS_CHANGE_REASONS = ["recorded_by_treating_team", "correcting_an_error"] as const;
export type LegalStatusChangeReason = (typeof LEGAL_STATUS_CHANGE_REASONS)[number];

/**
 * T4 (`docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`): the fixed reason a
 * clinician gives when correcting a Form 1A receipt marked in error — the undo
 * `RECORD_LEGAL_FORM_RECEIVED` has never had. Chosen, never typed, same discipline as every list
 * in this file. Kept in its own label map (`legalFormReceiptCorrectionReasonLabels` below) rather
 * than folded into `changeReasonLabels`, matching `withdrawalReasonLabels`/
 * `wardRequestWithdrawalReasonLabels` further down this file: `tests/ward-change-reasons.test.ts`
 * pins `changeReasonLabels`'s keys to an exact list, and merging in would turn that pin red for a
 * reason unrelated to what it is guarding.
 */
export const LEGAL_FORM_RECEIPT_CORRECTION_REASONS = [
  "recorded_in_error",
  "recorded_against_wrong_movement",
  "form_had_not_physically_arrived",
] as const;
export type LegalFormReceiptCorrectionReason = (typeof LEGAL_FORM_RECEIPT_CORRECTION_REASONS)[number];

export const legalFormReceiptCorrectionReasonLabels: Record<LegalFormReceiptCorrectionReason, string> = {
  recorded_in_error: "Recorded in error",
  recorded_against_wrong_movement: "Recorded against the wrong movement",
  form_had_not_physically_arrived: "Form had not physically arrived",
};

/**
 * Task 3: the undo the prototype has never had. Same discipline as the two lists above — chosen,
 * never typed, operational and content-free. Neither describes a patient, a diagnosis, a clinical
 * judgement or a legal requirement.
 */
export const RELEASE_PULL_REASONS = [
  "patient_no_longer_coming",
  "bed_needed_for_another_patient",
  "ward_withdrew_the_bed",
  "pull_made_in_error",
] as const;
export type ReleasePullReason = (typeof RELEASE_PULL_REASONS)[number];

export const CANCEL_TRANSPORT_REASONS = [
  "provider_unavailable",
  "patient_not_ready",
  "destination_changed",
  "job_created_in_error",
] as const;
export type CancelTransportReason = (typeof CANCEL_TRANSPORT_REASONS)[number];

/**
 * WLQ-38 (owner, 2026-09-15), verbatim: *"This should also be the referring doctors responsibility
 * as well to be able to revoke the transport as well as referral in addition to the coordinator."*
 * `STOP_TRANSPORT` (`ward-flow-reducer.ts`) is the event this reason list belongs to — the referrer
 * or the coordinator stopping a journey AFTER the patient has been collected, when `CANCEL_TRANSPORT`
 * itself refuses ("the patient has departed").
 *
 * ⚠️ **SENTENCES, NOT CODES — Ward Lead's exact wording, and this list is the one exception to
 * "chosen never typed" meaning a separate label map.** `OVERRIDE_REASONS`, `ESCALATION_CONTACTS`
 * and `BED_RELEASE_BLOCKERS` above already hold this shape: the value IS the rendered text, because
 * there is no clinical token in any of the three to keep out of a label. Do not reword them —
 * quoted verbatim in the build brief and not this session's language to change.
 */
export const STOP_TRANSPORT_REASONS = [
  "The examination was revoked",
  "The referral was withdrawn",
  "The receiving ward can no longer take the patient",
] as const;
export type StopTransportReason = (typeof STOP_TRANSPORT_REASONS)[number];

/**
 * Build plan item 31 (T3, 2026-09-17): once `STOP_TRANSPORT` stops a journey already under way,
 * SOMEBODY still needs to know where the patient actually is — the officer stopped a job, not a
 * person, and a stopped job with nothing recorded leaves whoever reads it to guess. Owner
 * recommendations accepted; exact wording from the build plan's on-screen wording table (§4, T3).
 *
 * ⚠️ **SENTENCES, NOT CODES — the same one exception `STOP_TRANSPORT_REASONS` above already is.**
 * The value IS the rendered text: there is no clinical token in any of the five to keep out of a
 * label, so a separate label map would be one more place these words could drift from what a
 * screen shows. Do not reword them — quoted verbatim from the build plan.
 *
 * Deliberately does NOT decide whether stopping transport keeps the bed held — that question is
 * still open (see the build brief) and this list carries no opinion on it, only on where the
 * patient physically is.
 */
export const TRANSPORT_WHEREABOUTS = [
  "Back at the sending emergency department",
  "At another emergency department",
  "At a general hospital",
  "With the transport crew",
  "Another place — needs follow-up",
] as const;
export type TransportWhereabouts = (typeof TRANSPORT_WHEREABOUTS)[number];

/**
 * Build plan item 29 (T4a, 2026-09-17) / R2-7: why a collected journey was diverted to a place
 * other than the accepting ward. Owner accepted the four listed reasons verbatim — sentences, not
 * codes, the same one exception `STOP_TRANSPORT_REASONS` and `TRANSPORT_WHEREABOUTS` already are.
 * Do not reword them.
 */
export const DIVERSION_REASONS = [
  "Needs urgent medical care on the way",
  "The vehicle or crew was sent to an emergency",
  "The receiving ward can no longer take the patient",
  "Another reason — needs follow-up",
] as const;
export type DiversionReason = (typeof DIVERSION_REASONS)[number];

/**
 * Task 6 (spec item 11): the escalation contact, chosen never typed — the last free-text input in
 * the escalation form becomes a fixed list, for the same reason as the four lists above. Five
 * entries are drawn from language this model already uses; "Other service" is the one deliberate
 * general entry — never a free-text field of its own, which would reinstate exactly what this
 * removes. Unlike the four reason lists above, there is no separate snake_case value / label pair:
 * the values themselves are the rendered display text, because there is no clinical token to keep
 * out of a label here to begin with.
 */
export const ESCALATION_CONTACTS = [
  "State bed coordination desk",
  "Duty psychiatrist",
  "Bed management",
  "Nurse unit manager (destination ward)",
  "Escort or transport provider",
  "Other service",
] as const;
export type EscalationContact = (typeof ESCALATION_CONTACTS)[number];

/**
 * Task 11 (spec item 9): the blocker on a bed release, chosen never typed — same discipline as
 * every fixed list above. This is the operational fact holding the bed up, and the privacy rule
 * from the binding spec §4 is unconditional: never a blocker that describes a person, only the
 * BED. Drawn from the wording `ward-movements.ts`'s existing `bedReleases` fixture already uses,
 * generalised to fixed categories rather than copied as free-text sentences:
 *   - "Awaiting clean" generalises the fixture's "Bed clean pending".
 *   - "Awaiting pharmacy" matches the fixture's "Awaiting pharmacy" exactly.
 *   - "Awaiting placement confirmation" generalises "Awaiting bed-management confirmation" and
 *     "Awaiting external placement confirmation".
 *   - "Awaiting service coordination" generalises "Awaiting external service coordination".
 * The fixture's sixth entry, "Pending case review outcome", is deliberately NOT a source here —
 * "case review" reads as being about the patient's own case, not the bed, so it is excluded
 * rather than generalised. Like `ESCALATION_CONTACTS`, there is no separate label map: the
 * values ARE the rendered text, because there is no clinical token to keep out of a label here
 * to begin with.
 */
export const BED_RELEASE_BLOCKERS = [
  "Awaiting clean",
  "Awaiting pharmacy",
  "Awaiting placement confirmation",
  "Awaiting service coordination",
  // Phase 5 (spec D3). Operational facts about the bed, chosen for the "ready but cannot leave"
  // case. Deliberately NOT added: guardianship, financial arrangements, family availability — each
  // describes the person rather than the bed, and so follows "Pending case review outcome" out of
  // this list. Adding one is a recorded product decision, never an implementer's convenience.
  "Awaiting accommodation",
  "Awaiting transport",
  "Awaiting receiving-service acceptance",
  // OWNER-APPROVED addition, 2026-08-28 ("The three lists", List 1). This entry deliberately
  // OVERTURNS the Phase 5 exclusion recorded in the comment above ("family availability"), and
  // the reasoning is recorded here so the next reader does not re-argue it: the "describes the person, not the bed" rule is sound in
  // general and is kept everywhere else, but it fails on its own terms here. A discharge held up
  // because nobody can collect someone, or because the family need a day's notice, IS a real
  // reason the bed is not coming free. Excluding it does not stop it happening — it makes a ward
  // record "Awaiting service coordination" instead, and the recorded reason becomes WRONG. A
  // wrong reason is worse than a blunt one.
  //
  // Guardianship and financial arrangements stay excluded; the Phase 5 reasoning still holds for
  // those two. Adding any further entry remains a recorded product decision, never an
  // implementer's convenience.
  //
  // ⚠️ AMENDED 2026-09-12 BY O-16.7, AND THE SENTENCE DIRECTLY ABOVE IS NOW HALF FALSE — amended in
  // place rather than left to be read as current, because the next entry overturns one of its two
  // halves and a reader meeting them in order would take the older sentence as the rule.
  // FINANCIAL ARRANGEMENTS ARE NO LONGER EXCLUDED: "Funding or plan decision pending" is exactly
  // that case, and the owner has ruled it in. GUARDIANSHIP REMAINS EXCLUDED and the Phase 5
  // reasoning still holds for it alone.
  //
  // Provenance, stated because it matters: these words were proposed by an agent session and
  // APPROVED by the product owner. No charge nurse has seen them. If a clinician offers different
  // words, theirs replace these verbatim.
  "Awaiting family or carer arrangement",
  // 🔴 OWNER-APPROVED addition, 2026-09-12 (O-16.7). His ruling, recorded because the exclusion it
  // reverses is recorded three lines up and the pair must be read together: "A real reason a
  // discharge stalls, with nowhere to record it today. Ruled in."
  //
  // It was refused before this, correctly, and by this list's own standing rule — it describes the
  // PERSON's funding or care plan rather than the bed. The rule is kept everywhere else and fails
  // on its own terms here for the same reason the family-or-carer entry does: excluding it does not
  // stop the discharge stalling, it makes a ward record something else instead, and the recorded
  // reason becomes WRONG. A wrong reason is worse than a blunt one.
  //
  // ⚠️ This entry is why "Clinically ready, not yet gone" needed no screen edit to gain its row.
  // That section generates one row per member of this list, so an owner decision reached every ward
  // page by being added HERE. Type a row out on a screen and the next ruling will not.
  "Funding or plan decision pending",
] as const;
export type BedReleaseBlocker = (typeof BED_RELEASE_BLOCKERS)[number];

/**
 * The bed-model rework of 2026-08-28 (`docs/ward-flow-phase-6-7-decisions.md`, Q4). Once a bed is
 * released it may carry a short indication that it is being MADE READY — the owner's example was
 * cleaning. His own clinical reasoning is why this is a note and not a fifth lifecycle stage:
 *
 * > "Once a bed is available, a patient will be pulled. Pulled patient takes hours to transport
 * > and move, so it is fine to allocate this bed. Just have a note for preparing bed maybe until
 * > it is ready."
 *
 * So the note is **informational and must NEVER gate allocation**. A bed being made ready is
 * still offered, still counts in `availableNow`, and still appears in every figure. Anything
 * else reintroduces the delay that answer says does not exist. Structurally this is enforced
 * three ways and none of them is a comment: the note lives on a `BedRelease`, `capacityBreakdown`
 * derives `availableNow` from the UNIT's own fields and never reads a release at all, and
 * matching never reads a `BedRelease` in the first place (`tests/ward-referral-matching.test.ts`).
 *
 * **The owner supplied the list on 2026-08-28** ("The three lists", List 3), so this array is no
 * longer empty and the note is expressible. Cleaning is his own example. Maintenance is the other
 * thing expected to take a bed out of use briefly without anything clinical changing. Both
 * describe the BED and nothing else, which is the same bar every list above holds to.
 *
 * Provenance, stated because it matters: these words were proposed by an agent session and
 * APPROVED by the product owner. No charge nurse has seen them. If a clinician offers different
 * words, theirs replace these verbatim. Adding an entry is a recorded product decision, never an
 * implementer's convenience.
 */
/**
 * WHY A COORDINATOR REFERRED DESPITE A FAILING GATE. Owner-approved verbatim, 2026-08-29 — the
 * canonical record is `WB-DB-15` (as superseded to five) and `WB-DB-16` on the ward board
 * specification.
 *
 * FIVE, not four. `WB-DB-15` shipped as four and carries its own superseded-to-five block; anyone
 * working from the four-reason version is reading the superseded entry.
 *
 * Stored as the sentences themselves rather than as keys with a separate label map, matching
 * `BED_RELEASE_BLOCKERS` and `BED_PREPARATION_NOTES` above: these are the owner's own words, and a
 * key plus a label is two places for one fact and one of them free to drift.
 *
 * ⚠️ **THERE IS NEVER AN "OTHER, PLEASE SPECIFY"** (`WB-DB-16`). That entry is the whole constraint:
 * it is how free text returns through the back door after being removed from the front. Adding one
 * would undo the decision this list exists to implement.
 *
 * **"Nowhere eligible" is deliberately excluded.** It is already its own recorded act — an
 * escalation (`RECORD_ESCALATION`) — and a second vocabulary for one fact is how two screens come
 * to describe the same event differently.
 */
/**
 * 🔴 WHY A WARD'S REFERRAL ENDED — and it may NEVER say where the patient went (`FD-23`).
 *
 * Until 2026-08-30 `withdrawnReferrals[].reason` was a bare `string`, and both the reducer and the
 * seed filled it with the winner's name:
 *
 *     reason: `withdrawn — placed at ${acceptedUnit.name}`
 *     reason: "Referral withdrawn once RGH Adult Secure confirmed the bed"
 *
 * The ward page renders that verbatim, so a LOSING ward read the ACCEPTING ward's name out of the
 * very field that exists to record its own loss. Confirmed on screen by two sessions independently.
 *
 * ⚠️ **NO SHAPE GUARD COULD SEE IT.** `ward-referral-visibility.ts` holds a mutation-tested
 * field-set allowlist at every level and this passed all of them: `reason` was a permitted field of
 * a permitted type carrying a forbidden VALUE. A guard over shapes cannot see a fact smuggled in
 * prose.
 *
 * ⚠️ **WHICH IS WHY THE FIX IS A TYPE AND NOT A BETTER SENTENCE.** Sanitising the string leaves a
 * free-form `string` any future edit can refill, with nothing red to say so. As a union the leak is
 * UNREPRESENTABLE rather than merely absent.
 *
 * The list is short because the model has exactly one way this happens today. Adding a member is a
 * governance decision, not an implementation one — and no member may name a place.
 *
 * **Nothing is lost to the coordinator:** it may read `movement.acceptedUnitId` directly, because it
 * is allowed to. The destination stops travelling inside a ward-readable string.
 */
/**
 * ⚠️ **A SECOND MEMBER, 2026-09-01, AND THE COMMENT ABOVE PREDICTED EXACTLY THIS.** It warned that
 * "another unit accepted" is true of every entry only because `ACCEPT_IN_PRINCIPLE` was the sole
 * writer, and that a second withdrawal path with a different cause makes that label quietly wrong
 * on a ward screen. `WITHDRAW_REFERRAL` is that second path, so the code carries its own cause
 * rather than inheriting one that would now be false.
 *
 * `referrer_withdrew` says the referrer withdrew it and nothing else. It names no place, no
 * clinical fact and nobody — the same discipline `Admission declined` already applies by dropping
 * the person-token: the recorded fact is that the referral was withdrawn, which is complete without
 * saying why.
 *
 * ⚠️ **WHY THERE IS NO REASON LIST BEHIND IT.** A referrer withdraws because the patient improved,
 * went home, went elsewhere, or died. Those are clinical facts about a person, and this comment's
 * own rule is that adding a member here is a governance decision and not an implementation one. So
 * the flow is built and the vocabulary is left to the owner. If he wants reasons, they are his list.
 */
/**
 * ⚠️ **A THIRD MEMBER, RA1 (item 18, owner answer 18, 2026-09-17), AND THE SAME WARNING APPLIES
 * AGAIN.** Re-referring now ADDS wards rather than silently replacing the live list, so the
 * coordinator needs a way to take back ONE ward's request without ending the whole referral —
 * `WITHDRAW_REFERRAL` above withdraws every live referral at once and closes the movement, which is
 * a different, bigger act. `coordinator_withdrew` is the top-level cause for this narrower one, on
 * the same "who ended it, nothing else" discipline as its two siblings. The GRANULAR reason the
 * coordinator actually picked (one of `WARD_REQUEST_WITHDRAWAL_REASONS` below) travels separately, in
 * `withdrawnReferrals[].detail` — never folded into this field, which stays a closed three-member
 * union exactly like before.
 *
 * ⚠️ **A FOURTH MEMBER, 2026-09-17.** `RECORD_ED_OUTCOME` and `REFER_TO_COMMUNITY_TEAM` both end a
 * bed search by withdrawing any live ward requests, and both reused `referrer_withdrew` — which is
 * FALSE here: the referrer (the department) has not withdrawn anything, it has recorded that the
 * patient no longer needs one. `ed_outcome_recorded` names that cause truthfully, on the same "who
 * ended it, nothing else" discipline as its three siblings.
 */
export const WITHDRAWAL_REASONS = [
  "another_unit_accepted",
  "referrer_withdrew",
  "coordinator_withdrew",
  "ed_outcome_recorded",
] as const;
export type WithdrawalReason = (typeof WITHDRAWAL_REASONS)[number];

/**
 * What a ward is shown. Says the referral ended and why, and names no place.
 *
 * ⚠️ **"ACCEPTED", NOT "PLACED" — AND THAT IS A SECOND DEFECT, NOT A WORDING PREFERENCE.**
 * The first code here was `placed_elsewhere`, labelled *"the patient was placed elsewhere"*.
 * It closed the leak and kept a falsehood: `ACCEPT_IN_PRINCIPLE` leaves the movement at
 * `accepted_awaiting_bed`, so **the patient is accepted, not moved**, and the sentence asserted
 * a transfer that had not happened. Two sessions drafted "placed" independently and one caught
 * it. The lesson is the one worth keeping: **each of us checked the string for the thing we
 * were hunting, and not for whether it was true.**
 *
 * The wording matches the ward page verbatim, so the record and the screen cannot drift apart.
 *
 * ⚠️ **AND IT IS TRUE ONLY CONDITIONALLY.** "Another unit accepted" is true of every entry that
 * can exist today because `ACCEPT_IN_PRINCIPLE` is the only writer of `withdrawnReferrals` —
 * measured, one site, and pinned by `tests/ward-withdrawal-reason-privacy.test.ts`. A second
 * withdrawal path with a different cause makes this label quietly wrong; the pin is what makes
 * that a red test rather than a silent falsehood on a ward screen.
 */
export const withdrawalReasonLabels: Record<WithdrawalReason, string> = {
  another_unit_accepted: "Withdrawn — another unit accepted this patient.",
  // Says the referral ended and that the referrer ended it. Asserts nothing about the person, and
  // names no destination — a ward reading this learns that it may stop holding the request, which
  // is the whole of what it needs.
  referrer_withdrew: "Withdrawn by the referrer.",
  // RA1 (item 18): says who ended THIS ward's request and nothing else — the granular reason (one
  // of `WARD_REQUEST_WITHDRAWAL_REASONS` below) travels separately, in `withdrawnReferrals[].detail`.
  coordinator_withdrew: "Withdrawn by the coordinator.",
  // 2026-09-17: says the department ended the bed search, and nothing about where the patient went
  // or whether they were discharged — `RECORD_ED_OUTCOME`'s own outcome field (for discharge / for
  // community follow-up) is a separate, clinical fact this ward-facing label does not carry.
  ed_outcome_recorded: "Withdrawn — the department recorded an outcome for this patient.",
};

/**
 * RA1 (item 18, owner answer 18, 2026-09-17): the fixed list a coordinator picks from when
 * withdrawing ONE ward's live referral request with `WITHDRAW_WARD_REQUEST`, rather than replacing
 * the whole shortlist or withdrawing every live referral at once (`WITHDRAW_REFERRAL`). The plan's
 * own §2 wording, unchanged — none names a place (`FD-23`), because the ward that lost the request
 * reads this list back.
 */
export const WARD_REQUEST_WITHDRAWAL_REASONS = [
  "no_answer_from_the_ward",
  "bed_no_longer_available",
  "needs_changed_ward_no_longer_suits",
  "closer_to_home_or_family_elsewhere",
  "making_room_within_the_referral_limit",
  "referred_in_error",
  "another_reason",
] as const;
export type WardRequestWithdrawalReason = (typeof WARD_REQUEST_WITHDRAWAL_REASONS)[number];

export const wardRequestWithdrawalReasonLabels: Record<WardRequestWithdrawalReason, string> = {
  no_answer_from_the_ward: "No answer from the ward yet",
  bed_no_longer_available: "The bed is no longer available",
  needs_changed_ward_no_longer_suits: "Needs have changed; this ward no longer suits",
  closer_to_home_or_family_elsewhere: "Closer to home or family elsewhere",
  making_room_within_the_referral_limit: "Making room within the referral limit",
  referred_in_error: "Referred in error",
  another_reason: "Another reason — needs follow-up",
};

export const OVERRIDE_REASONS = [
  "The receiving team has agreed despite the mismatch",
  "Clinical urgency outweighs the mismatch",
  "The bed information is known to be out of date",
  "Continuity with a previous admission at this unit",
  "Closer to the person's home or family",
] as const;
export type OverrideReason = (typeof OVERRIDE_REASONS)[number];

export const BED_PREPARATION_NOTES = ["Being cleaned", "Awaiting maintenance or repair"] as const;
export type BedPreparationNote = (typeof BED_PREPARATION_NOTES)[number];

/**
 * ⚠️ PLACEHOLDER VALUES, T12 (`docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`,
 * item 9, owner answer 9, 17 September 2026): *"Non-binary patient: coordinator places with a
 * recorded reason after checking with the ward, preferring a single room."* His words fix the
 * SHAPE — a coordinator, a recorded reason, having checked with the ward — never the wording of
 * any one reason. The same discipline `OVERRIDE_REASONS` above and `URGENT_MARK_REASONS` below
 * each carry their own placeholder warning for: NOT chosen or seen by the owner.
 *
 * Written as complete sentences the coordinator reads back, exactly like `OVERRIDE_REASONS` —
 * never a snake_case code needing its own label map — because this is the same shape of record:
 * one person's own accountable reason for one placement decision.
 *
 * ⚠️ **WIDENED TO SIX, WARD LEAD'S OPUS REVIEW OF T12, 17 September 2026.** The "checked with the
 * ward" fact moved off these sentences entirely — see `GenderPlacement.wardChecked` on
 * `ward-model.ts` — so a reason no longer needs to restate it, which is why none of the six below
 * carries a "Checked with the ward;" prefix the earlier three implicitly leaned on. The tick is
 * now a stored fact; the reason is only ever about WHICH ward and WHY.
 */
export const GENDER_PLACEMENT_REASONS = [
  "A single room is available on this ward",
  "The patient's stated preference, agreed with the ward",
  "No single room is free; the ward agreed a bed and a plan for privacy",
  "The only suitable Ready bed, agreed with the ward",
  "The patient knows this ward from an earlier stay",
  "Closer to the patient's home or supports",
] as const;
export type GenderPlacementReason = (typeof GENDER_PLACEMENT_REASONS)[number];

/**
 * Build plan §2, "Non-binary placement (coordinator)" — the exact refusal sentence, so the
 * reducer and the two coordinator screens that show it back cannot drift into two wordings for
 * one fact. Shown whenever a `Non-binary` placement is attempted with no coordinator record
 * naming the unit, regardless of which event or role attempted it — the fact is the same one
 * either way: nobody has yet recorded the required check.
 */
export const GENDER_PLACEMENT_REFUSAL =
  // R7 (owner ruling, 25 September 2026): any gender or recorded sex other than female or male,
  // including not recorded - not only non-binary - needs this review on every ward.
  "This patient's gender or sex is not recorded as female or male. A coordinator must record a reason after checking with the ward before this placement.";

/**
 * P1-3 (Ward Lead ruling, 17 September 2026): a gender recorded AFTER a ward already holds an
 * acceptance or a bed is re-checked the next time the movement tries to move forward
 * (`ward-flow-reducer.ts`'s `heldUnitGenderRefusal`, called from `PULL_PATIENT`, `HANDOVER_READY`,
 * `TRANSPORT_ACCEPTED` and `PATIENT_COLLECTED`). Before this, a correction that made the held or
 * accepted unit unsuitable was never re-asked — the movement carried on to `handover_ready`,
 * `moving`, and arrival with nobody warned.
 *
 * Names the ACTUAL route out — withdraw the acceptance, then refer again — rather than repeating
 * `eligibilityRefusal`'s front-door wording ("… is not eligible for movement … failed gate
 * gender_designation …"), which is true at the front door but misleading here: nothing about
 * accepting THIS unit again fixes it, because the unit no longer suits at all. This is also the
 * generic, privacy-safe sentence a ward or ED screen shows for either cause — see
 * `wardSafeRejectionReason` (`ward-screen.tsx`), which collapses both this and
 * `GENDER_NO_LONGER_SUITS_NON_BINARY_REFUSAL` below down to this one sentence, the same collapsing
 * discipline it already holds for the word "non-binary".
 */
export const GENDER_NO_LONGER_SUITS_REFUSAL =
  "This ward's bed designation no longer suits this patient. Withdraw the acceptance, then refer again.";

/**
 * The non-binary-placement half of `GENDER_NO_LONGER_SUITS_REFUSAL` immediately above — same cause
 * (a correction after the unit was already held), different required next step: a plain re-referral
 * is not enough for a `Non-binary` movement, which also needs a fresh `GenderPlacement` record
 * (`GENDER_PLACEMENT_REASONS`, `wardChecked: true`). **Never shown on a ward or ED screen** — both
 * collapse to the plain sentence above via `wardSafeRejectionReason`, the same discipline that
 * already keeps the word "non-binary" itself off those two screens.
 */
export const GENDER_NO_LONGER_SUITS_NON_BINARY_REFUSAL =
  "This ward's bed designation no longer suits this patient. Withdraw the acceptance, then refer again with a recorded reason and ward check.";

/**
 * ⚠️ PLACEHOLDER VALUES. THE OWNER HAS NOT CHOSEN THESE. HE ASKED FOR TEN TO BUILD AGAINST.
 *
 * Owner, 2026-08-30: "patients must met a certain high threshold to be marked as urgent", then
 * "Just have 10 placeholder urgent reasons for now." So the SHAPE is his decision and the CONTENT
 * is a stand-in written by a session, and those two facts must not be allowed to merge. A chosen
 * value and a provisional value look identical in code; the difference is whether anybody can find
 * it again (`docs/ward-flow-provisional-values.md`). This block is that finding.
 *
 * WHY THIS LIST EXISTS AT ALL. Urgency is the primary sort and outranks every wait, so a tier that
 * is easy to apply inflates until it means nothing — and the wait ordering underneath it stops
 * mattering too. The threshold is the safeguard. It is expressed as a fixed list a HUMAN PICKS
 * FROM, never a number the software evaluates: a computed threshold would breach "nothing predicts,
 * scores, ranks or recommends a person", and a sourced clinical one would breach "no figure,
 * timeframe or threshold from the Mental Health Act" without a named accountable owner.
 *
 * ⚠️ AND THESE STRAIN THIS FILE'S OWN RULE, which is why it is said out loud rather than left for a
 * reviewer to notice. The block at the top of this file says its reasons are "operational and
 * content-free" and that "if richer reasons are wanted they come from the product owner; no agent
 * adds one". A reason for urgency CANNOT be entirely content-free — saying why somebody must be
 * moved first is closer to the person than saying why a pull was released. These are written in the
 * most operational register available (what the current setting cannot do, rather than what is
 * wrong with the person), they carry no diagnosis, no narrative, no figure and no timeframe, and
 * they duplicate nothing the model already holds — cohort, security need and legal status are
 * separate fields and must not be restated here. The owner asked for them, which is the condition
 * the rule names.
 *
 * ⚠️ TWO OF THESE WERE REWORDED ON 2026-08-30, AND THEY ARE STILL PLACEHOLDERS. The originals were
 * `currently_secluded_or_restrained` and `repeated_attempts_to_leave`. Both described the PERSON;
 * the other eight describe what the CURRENT SETTING cannot do. They now match that shape.
 *
 * The reason is not tidiness. A receiving ward has one question — can we safely take this person? —
 * and the setting-shaped form answers it directly, while the person-shaped form made the ward infer
 * it AND broadcast a fact about someone's care to every service that can see the referral. So the
 * reword DISSOLVES the open question of who may see a reason rather than answering it: if every
 * reason is about a ward's own capability, nothing sensitive travels with the referral, and the
 * coordinator and the wards can hold the same list with nothing hidden and nothing filtered. One
 * decision instead of two, and no new rule for anyone to enforce.
 *
 * ⚠️ THE OWNER APPROVED THIS SHAPE, RELAYED THROUGH ANOTHER SESSION. HE DID NOT WRITE THESE WORDS.
 * The distinction that must survive every future edit of this block is the one it opened with: the
 * SHAPE is his decision and the CONTENT is a session's stand-in. Nothing here may start reading as
 * his language.
 *
 * ⚠️ THIS BLOCK ALSO SAID "AND HAS NOT SEEN THEM", AND THAT HALF IS NOW FALSE — corrected rather
 * than deleted, because the correction is the record. On 2026-08-31 he SAW the ten, delegated the
 * cut, and pre-accepted the result sight-unseen: *"You just choose the top 6 you think based on your
 * understanding of flow and I accept that for now to be changed later."* Relayed to this session,
 * not heard first-hand.
 *
 * So the true state is three things and they are not the same thing:
 *   - the SHAPE is his,
 *   - the SELECTION of six from ten is a session's, made under his delegation,
 *   - the ACCEPTANCE is PROVISIONAL AND TIME-LIMITED BY HIS OWN WORDS — "for now to be changed
 *     later" is his phrase and it stays.
 *
 * ⚠️ WHICH FOUR WENT, AND WHY, so the selection is reviewable rather than asserted:
 *   - `one_to_one_observation_needed` — overlapped `cannot_be_observed_safely_here` and was the more
 *     PERSON-SHAPED of the pair.
 *   - `restrictive_measures_this_setting_cannot_sustain` — overlapped that one AND
 *     `escort_in_place_and_unsustainable`.
 *   - `earlier_placement_broke_down` — a HISTORY fact, not a current-state driver. It says what
 *     happened, not what this setting cannot do.
 *   - `this_setting_cannot_continue_current_care` — a CATCH-ALL, and a catch-all gets chosen instead
 *     of the specific reason, which degrades the data it exists to produce.
 *
 * ⚠️ THE TRADE-OFF WAS STATED HERE AS REVERSIBLE, AND THE OWNER REVERSED IT ON 2026-09-03.
 * The catch-all is BACK, so the list is SEVEN. His ruling: a coordinator sometimes has a reason
 * that is none of the six, and forcing them to pick the nearest wrong one is worse than the data
 * cost of a catch-all — the argument this comment made for dropping it, decided the other way by
 * the person whose data it is.
 *
 * ⚠️ THE PARAGRAPH ABOVE IS KEPT BECAUSE IT WAS THE REASONING, NOT BECAUSE IT IS THE CURRENT
 * STATE. A reader who finds it and stops would otherwise carry away a list of six. The key and
 * label restored are VERBATIM from `e6b7afb91`, the commit that removed them.
 *
 * ⚠️ AND THE SETTING-SHAPED RULE SURVIVED THE CUT ON PURPOSE. Every one of the six still describes
 * what a SETTING cannot do rather than a fact about the person — the property that dissolved the
 * who-may-see-a-reason question above. A future edit that adds a person-shaped reason back does not
 * merely add a word; it reopens that question and reintroduces the filtering rule the reword
 * removed. `tests/ward-change-reasons.test.ts` pins the (now TEN — see the doc comment
 * immediately below) and their labels.
 *
 * REPLACING THEM IS ONE EDIT HERE plus the labels below. Nothing else authors this list.
 */
/**
 * ⚠️ **NINE AND TEN, ADDED 2026-09-17 — ITEM 37, DELEGATED BY THE OWNER TO WARD LEAD ("You
 * decide") AND CHOSEN AS THE PLAN'S OWN PROPOSAL, VERBATIM.** Placed here, between the six
 * original settings-shaped reasons and the two catch-alls, so `another_reason_not_listed` stays
 * last — the same placement rule the eight already obey.
 *
 * Both keep the SETTING-SHAPED rule every reason above them holds to: each names what the
 * SETTING cannot do, never a fact about the person, a diagnosis, a cohort or a legal status.
 *   - `cannot_protect_from_others_here` mirrors `safety_of_others_in_this_setting` from the other
 *     direction — that one is a risk TO other people; this one is a risk FROM them, to this
 *     patient, in a crowded or mixed ED or ward. Sexual safety is included without being named,
 *     on the same discipline the rest of this list already holds to.
 *   - `setting_unsuitable_for_age_group` covers a young person in an adult area or a frail older
 *     adult in a general adult area — a standing reason youth and older-adult coordinators move
 *     someone first. The age band itself is a separate field elsewhere and is not repeated here.
 *
 * ⚠️ **THE SECOND LABEL WAS REWORDED 2026-09-17, REVIEW FIX-FORWARD ITEM 7 — WARD LEAD'S OWN
 * DECISION, ON THE OWNER'S DELEGATION.** The key stays `setting_unsuitable_for_age_group`; only
 * the label changed, from "This setting is unsuitable for their age group" to "No
 * age-appropriate area here". The plan's original wording read as a fact about the PERSON'S age
 * rather than what the SETTING lacks — the one distinction this whole list is built around (see
 * the setting-shaped rule above) — and the reword names the absence instead: there is no
 * age-appropriate area here, which is a fact about the ward, not the patient.
 */
export const URGENT_MARK_REASONS = [
  "cannot_safely_prevent_leaving",
  "cannot_be_observed_safely_here",
  "safety_of_others_in_this_setting",
  "no_psychiatric_cover_at_this_site",
  "needs_medical_care_unavailable_here",
  "escort_in_place_and_unsustainable",
  "cannot_protect_from_others_here",
  "setting_unsuitable_for_age_group",
  // ⚠️ THE CATCH-ALL, RESTORED ON THE OWNER'S RULING OF 2026-09-03. It was dropped when the
  // ten placeholders were cut to six (`e6b7afb91`), which left a coordinator whose reason is
  // none of the six with nothing to choose. Key and label are VERBATIM from the commit that
  // removed them, not re-invented — he approved restoring the dropped wording, so the dropped
  // wording is what goes back.
  "this_setting_cannot_continue_current_care",
  // ⚠️ PLACEHOLDER COPY — OWNER DECISION OUTSTANDING. He ruled on 2026-09-03 that the entry above,
  // though the broadest of the four that were dropped, is NOT a true "none of these apply", and
  // approved adding one. The SHAPE is his; these exact words are a session's stand-in and he has
  // not confirmed them.
  //
  // ⚠️ IT IS DELIBERATELY VAGUE, on his stated reasoning: A WRONG REASON IN A CLINICAL RECORD IS
  // WORSE THAN A VAGUE ONE. A coordinator whose situation fits none of the seven previously had to
  // pick the nearest wrong one, and that wrong reason is what a receiving ward then reads.
  //
  // ⚠️ NEVER GIVE THIS ONE A FREE-TEXT BOX (WB-DB-16). "Other, please specify" is how clinical
  // free text re-enters a system that removed it on purpose. It stays a bare option.
  //
  // It also breaks this list's setting-shaped rule by construction — it describes nothing about
  // the setting OR the person, which is precisely why it cannot be mistaken for a clinical claim.
  "another_reason_not_listed",
] as const;
export type UrgentMarkReason = (typeof URGENT_MARK_REASONS)[number];

export const changeReasonLabels: Record<
  UrgencyChangeReason | LegalStatusChangeReason | ReleasePullReason | CancelTransportReason | UrgentMarkReason,
  string
> = {
  // Placeholder labels for the placeholder list above — replaced together, never separately.
  cannot_be_observed_safely_here: "Cannot be observed safely here",
  no_psychiatric_cover_at_this_site: "No psychiatric cover at this site",
  cannot_safely_prevent_leaving: "Cannot safely prevent leaving",
  needs_medical_care_unavailable_here: "Needs medical care unavailable here",
  safety_of_others_in_this_setting: "Safety of others in this setting",
  escort_in_place_and_unsustainable: "Escort in place and unsustainable",
  cannot_protect_from_others_here: "Cannot protect from harm by others here",
  setting_unsuitable_for_age_group: "No age-appropriate area here",
  this_setting_cannot_continue_current_care: "This setting cannot continue current care",
  another_reason_not_listed: "Another reason, not listed here",
  reassessed: "Reassessed",
  new_information: "New information",
  correcting_an_error: "Correcting an error",
  recorded_by_treating_team: "Recorded by treating team",
  // These three labels deliberately avoid the word "patient" even though the underlying reason
  // VALUE (fixed by the product brief, never renamed) carries it — `tests/ward-change-reasons.test.ts`
  // bans that token from any reason value or label it can rewrite, and the label text is the part
  // this file controls.
  patient_no_longer_coming: "No longer coming",
  bed_needed_for_another_patient: "Bed needed elsewhere",
  ward_withdrew_the_bed: "Ward withdrew the bed",
  pull_made_in_error: "Pull made in error",
  provider_unavailable: "Provider unavailable",
  patient_not_ready: "Not yet ready",
  destination_changed: "Destination changed",
  job_created_in_error: "Job created in error",
};

/**
 * Owner Answer 18 (second round, 2026-09-17): "Replace the free-text 'Anything limiting who can
 * come in right now' box with a fixed list." The ward screen's old input took typed prose, which
 * `docs/ward-flow/plans/2026-09-17-build-plan-screens.md` (item 49) flagged as exactly the shape
 * the persistence default-deny treats as typed text — chosen, never typed, is the same discipline
 * every list above holds to. Order is the owner's own, verbatim; a ward may choose several codes,
 * or none at all when nothing is limiting intake. No "Other" free-text box: "Other — call the
 * ward" directs a real conversation instead of inventing a second typed field this list exists to
 * remove.
 */
export const WARD_INTAKE_CONSTRAINTS = [
  "staffing_shortage",
  "infection_control",
  "bay_or_room_closed",
  "high_acuity_on_ward",
  "waiting_for_bed_clean",
  "other_call_the_ward",
] as const;
export type WardIntakeConstraint = (typeof WARD_INTAKE_CONSTRAINTS)[number];

export const wardIntakeConstraintLabels: Record<WardIntakeConstraint, string> = {
  staffing_shortage: "Staffing shortage",
  infection_control: "Infection control",
  bay_or_room_closed: "Bay or room closed",
  high_acuity_on_ward: "High acuity on the ward",
  waiting_for_bed_clean: "Waiting for a bed to be cleaned",
  other_call_the_ward: "Other — call the ward",
};

/**
 * Statutory and systemic discharge barrier reasons for SAT hearings and Public Guardian delays.
 * Maintained in an isolated taxonomy to preserve strict test pins on BED_RELEASE_BLOCKERS (length 9)
 * and changeReasonLabels (18 entries).
 */
export const DISCHARGE_DELAY_REASONS = [
  "sat_hearing",
  "public_guardian",
] as const;

export type DischargeDelayReason = (typeof DISCHARGE_DELAY_REASONS)[number];

export const dischargeDelayReasonLabels: Record<DischargeDelayReason, string> = {
  sat_hearing: "State Administrative Tribunal (SAT) hearing pending",
  public_guardian: "Public Guardian / Public Advocate determination pending",
};

export interface DischargeDelayMetadata {
  readonly code: DischargeDelayReason;
  readonly category: "legal_statutory" | "guardianship";
  readonly categoryLabel: string;
  readonly label: string;
  readonly clinicalDescription: string;
}

export const dischargeDelayMetadata: Record<DischargeDelayReason, DischargeDelayMetadata> = {
  sat_hearing: {
    code: "sat_hearing",
    category: "legal_statutory",
    categoryLabel: "Legal & Statutory",
    label: "SAT Hearing",
    clinicalDescription:
      "State Administrative Tribunal hearing pending for involuntary treatment review, community treatment order, or guardianship determination.",
  },
  public_guardian: {
    code: "public_guardian",
    category: "guardianship",
    categoryLabel: "Guardianship & Advocacy",
    label: "Public Guardian",
    clinicalDescription:
      "Office of the Public Advocate / Public Guardian application, appointment, or accommodation determination pending.",
  },
};
