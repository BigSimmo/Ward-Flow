/**
 * Pure derivations shared by the three Ward Flow view files (console, modes, network). Nothing
 * here depends on React — no hooks, no browser APIs — so this module carries no "use client"
 * directive and cannot itself become a client/server boundary problem. It is the single place
 * these three files can drift out of sync if a formula changes, so a change here changes every
 * consumer at once rather than needing three coordinated edits.
 */
import {
  INBOX_CATEGORIES,
  type InboxItemKind,
  SUITABILITY_GATES,
} from "@/components/ward-management/ward-flow-reducer";
import { isAwaitingAnswer, referralState } from "@/components/ward-management/ward-referrals";
import type { LucideIcon } from "lucide-react";
import { CircleAlert, Truck } from "lucide-react";

import { lockedBedsFree, unitHasLockedBeds, unitHasOpenBeds } from "@/components/ward-management/ward-bed-designation";
import {
  clockState,
  formatElapsed,
  formatInstant,
  formatRemaining,
  minutesUntil,
  type Instant,
} from "@/components/ward-management/ward-clock";
import {
  eligibility,
  requiresAuthorisedDestination,
  wardFacingGateDetail,
  type EligibilityGate,
  type GateResult,
} from "@/components/ward-management/ward-eligibility";
import {
  changeReasonLabels,
  type CancelTransportReason,
  type ReleasePullReason,
} from "@/components/ward-management/ward-change-reasons";
import {
  ED_MEDICAL_BED_RELEASE_THRESHOLD_HOURS,
  MOVEMENT_STAGES,
  PARALLEL_REFERRAL_CAP,
  type BedRelease,
  type BedReleaseState,
  type Decline,
  type HealthService,
  type LeaveBed,
  type Movement,
  type MovementStage,
  type Override,
  type Referral,
  type TransportJob,
  type Unit,
  stepBackReasonLabels,
  type StepBackReason,
} from "@/components/ward-management/ward-model";
import { allEmergencyDepartments, edById, siteByCode } from "@/components/ward-management/ward-sites";
import {
  EXPECT_FLAG_INVOLUNTARY_MINUTES,
  EXPECT_FLAG_VOLUNTARY_MINUTES,
  GENDER_MISMATCH_DECLINE_REASON,
  WAITLIST_INSTEAD_OF_DECLINE_REASONS,
  isArrivalLate as isArrivalLateClock,
  leaveBedNeedsOpenWarning as leaveBedNeedsOpenWarningClock,
} from "@/components/ward-management/ward-legal-clock";
import { REFERRABLE_MOVEMENT_STAGES } from "@/components/ward-management/ward-flow-reducer";

/** UI-only role concept; not part of the domain model. */
export type WardRole = "flow" | "ed" | "ward";

import { stageCopy } from "@/components/ward-management/ward-stage-copy";
import { supportNotificationInboxItems } from "@/components/ward-management/ward-support-notifications";
export { stageCopy };

/** Same reason `stageCopy` exists: `BedReleaseState`'s own values (`BED_RELEASE_STATES` in
 *  ward-model.ts) are raw lowercase lifecycle identifiers, never sentence-case display text.
 *  A screen renders this label, never `release.state` directly (defect fix, visual pass). */
export const bedReleaseStateLabels: Record<BedReleaseState, string> = {
  expected: "Expected",
  confirmed: "Confirmed",
  discharged: "Discharged",
};

/** The blocked FLAG's label on one release row (bed-model rework, 2026-08-28). Deliberately NOT
 *  a member of `bedReleaseStateLabels` above: being stuck is not one of the three stages, it sits
 *  on top of one, and a screen renders both — "Confirmed" and "Blocked" together are the whole
 *  point of the change. Named once here so no screen types the word itself. */
export const BED_RELEASE_BLOCKED_LABEL = "Blocked";

/**
 * The same fact as a COUNT, and deliberately worded differently from the flag above.
 * `unitCapacity()` already has a `blocked` figure meaning physically blocked BEDS, and the ward
 * screen renders both chips side by side; two chips reading "Blocked" and meaning different
 * things would be a defect, not a tidy-up. This is the one the morning page, the capacity board
 * and the ward screen all render (`CAPACITY_FIGURE_LABELS.blockedToday` reads it), so the
 * vocabulary spec D3/D14 requires to be identical at every level is identical by construction.
 *
 * 🔴 **THE WORDING CHANGED 2026-09-06, OWNER-APPROVED: `"Blocked releases"` -> `"Discharges held
 * up"`.** The first proposal put to him was `"Unavailable"`, agreed against a label described as
 * `Blocked` — but the string is about **discharges being held up**, not beds being unavailable, so
 * the replacement was wrong for the thing it replaced. Ward Lead put the corrected wording back to
 * him and this is what he approved.
 *
 * ⚠️ **THE IDENTIFIER STILL SAYS `BLOCKED` AND THAT IS DELIBERATE, NOT AN OVERSIGHT.** `blocked` and
 * `blocker` are the MODEL's own words — 42 occurrences across `ward-model.ts` and this file —
 * and `capacityBreakdown().blockedToday` is the field this labels. **The ruling changed what a
 * coordinator reads, not what the model calls it**, so renaming the constant would carry a display
 * decision into the domain vocabulary and leave the field name disagreeing with its own label
 * instead.
 *
 * ⚠️ **AND THE NEW WORDING RESOLVES THE COLLISION THE PARAGRAPH ABOVE WAS WRITTEN ABOUT.** Two chips
 * reading "Blocked" and meaning different things was the defect it guarded against; "Discharges held
 * up" beside "Blocked" for physically blocked beds can no longer be confused for one another.
 */
export const BED_RELEASE_BLOCKED_FIGURE_LABEL = "Discharges held up";

/** Counts are derived from whatever `movements` list the caller passes — every screen now
 * passes the live provider state (Task 6), so the pipeline strip can never advertise a count
 * a different surface would compute differently from the same instant. */
export function stageSummaries(movements: Movement[]) {
  return MOVEMENT_STAGES.map((id) => ({
    id,
    ...stageCopy[id],
    count: movements.filter((movement) => movement.stage === id).length,
  }));
}

/**
 * THE SAME STRIP, RECONCILED WITH THE QUEUE STANDING NEXT TO IT.
 *
 * `stageSummaries` above answers "how many movements are AT this stage" and is correct for the
 * screens that ask that. The network page asks a different question and rendered the same answer:
 * its strip sits directly above a panel headed "Priority queue", so its seven cells read as the
 * queue broken down by stage. They summed to 50 while the queue said 43.
 *
 * ⚠️ **THE OBVIOUS FIX IS WRONG BY ONE, AND IT IS THE VERSION TWO REVIEWERS INDEPENDENTLY ASKED
 * FOR.** Both said: put stage 7 "Arrived" outside the total. That gives 44. `isOpen` is TWO
 * conditions — `!closure && stage !== "arrived"` — and a movement that does not proceed closes at
 * whatever stage it had reached, so the closed records are NOT all sitting in stage 7. The seed
 * holds exactly one of them today.
 *
 * ⚠️ **AND 44 BESIDE 43 IS WORSE THAN 50 BESIDE 43.** Fifty is visibly unreconciled: a coordinator
 * sees two numbers that obviously do not match and asks. Forty-four invites the arithmetic and then
 * fails it by one, with nothing on screen indicating which cell is lying. A wrong number that looks
 * right outranks a wrong number that looks wrong, in the direction of harm.
 *
 * So this returns the whole reconciliation rather than a rearranged strip: waiting cells that count
 * PEOPLE STILL WAITING, and one cell holding everyone who has left the pathway by either route.
 * `waiting` sums to the queue count, `waiting + left.total` is every movement, and
 * `left.arrived + left.didNotProceed` equals `left.total` by construction rather than by
 * coincidence — `arrived` is the remainder, so no third outcome can fall between them unnoticed.
 *
 * Pinned by `tests/ward-network-stage-strip.dom.test.tsx`, whose canary asserts the fixture still
 * contains a movement that closed before arriving — because without one, the arrived-only fix
 * passes every other assertion in that file.
 */
export function queueStageSummaries(movements: Movement[]) {
  const left = movements.filter((movement) => !isOpen(movement));
  const didNotProceed = left.filter((movement) => movement.closure?.outcome === "did_not_proceed").length;

  return {
    waiting: MOVEMENT_STAGES.filter((id) => id !== "arrived").map((id) => ({
      id,
      ...stageCopy[id],
      count: movements.filter((movement) => movement.stage === id && isOpen(movement)).length,
    })),
    left: {
      total: left.length,
      // The remainder, deliberately. Counting `stage === "arrived"` directly would leave a
      // did-not-proceed closure recorded at the arrived stage in neither bucket, and the two
      // sub-figures would quietly stop summing to the total they are printed beneath.
      arrived: left.length - didNotProceed,
      didNotProceed,
    },
  };
}

/**
 * The one canonical order of the health services, and the list every screen that groups by service
 * iterates — the ED ward table, the coordinator flow diagram, the network map's two columns and the
 * ward index.
 *
 * `readonly`, so a duplicate entry is a compile error rather than a runtime possibility. Every
 * consumer groups by mapping over this list, so a service appearing in it twice renders its wards
 * twice — and the ordering test reads `headings.indexOf(service)`, first occurrence, so it would
 * not see the second. Nothing needs to mutate the array: every consumer only maps, flat-maps,
 * filters or iterates it.
 */
export const wardServiceOrder: readonly HealthService[] = [
  "North Metro",
  "East Metro",
  "South Metro",
  "WACHS",
  "CAHS",
  "Private",
];

export const roleLabels: Record<WardRole, string> = {
  flow: "Flow coordinator",
  ed: "ED mental health",
  ward: "Ward manager",
};

export const roleTaskLabel: Record<WardRole, string> = {
  flow: "Review & confirm",
  ed: "Confirm ED readiness",
  ward: "Accept and pull bed",
};

/**
 * The health service that owns the ED a movement originated in. This is the origin service,
 * not the patient's catchment — catchment is determined by where a patient lives, not where
 * they presented (see the glossary and Accepted ADR 3). `Movement` has no catchment field;
 * adding one is Phase 2 model work, not a derivation this module can safely invent.
 */
export function movementHealthService(movement: Movement): HealthService | undefined {
  const ed = allEmergencyDepartments().find((candidate) => candidate.id === movement.originEdId);
  return ed ? siteByCode(ed.siteCode)?.service : undefined;
}

/**
 * Duration since the movement opened. This is elapsed wait time, not a countdown to a
 * deadline — `formatElapsed` (never `formatRemaining`) is what keeps it from reading as a
 * breach on every row of every queue.
 */
export function elapsedLabel(movement: Movement, now: Instant) {
  return formatElapsed(minutesUntil(now, movement.openedAt));
}

/**
 * A movement is open while it is still travelling through the pathway. Per spec §7, arrival
 * closes the record and the patient leaves the system — so a movement is closed once it
 * carries a `closure` (whatever the outcome) or has reached the `arrived` stage, and open
 * counts/tables must never include it. `closure` is checked independently of `stage` because
 * a movement can close before ever reaching `arrived` (e.g. self-discharge from ED).
 */
export function isOpen(movement: Movement): boolean {
  return !movement.closure && movement.stage !== "arrived";
}

/**
 * WLQ-4's "the examination was revoked after transport already committed" situation (owner
 * ruling, 2026-09-15), read from the RECORD rather than from `movement.blocker` — owner item 6,
 * 2026-09-17: *"keep the bed flagged; a person decides whether to release it."* `RECORD_EXAMINATION`
 * (`ward-flow-reducer.ts`) writes the prose blocker `STAGE_TRANSITION_BLOCKERS
 * .examinationRevokedAwaitingRelease` at the same instant it produces this state, but
 * `RECORD_MOVEMENT_BLOCKER` and every later transport transition (`TRANSPORT_ACCEPTED`,
 * `TRANSPORT_EN_ROUTE`, …) unconditionally overwrite `movement.blocker` with their own sentence —
 * so a flag living only in that free-text field could vanish while the bed stayed held. This
 * derives the same fact from records nothing else overwrites for this reason: a
 * `"community_order"`/`"revoked"` examination outcome (never `"inpatient_order"` or
 * `"further_examination_ordered"` — neither is a revocation) beside a bed the movement still
 * holds.
 *
 * `movement.admissionId !== undefined` is that "still holds a bed" signal.
 * `RECORD_EXAMINATION`'s own `handover_ready`/`moving` branch leaves it untouched;
 * `STEP_BACK_STAGE` touches only `stage` (its own doc comment: "touches NOTHING else — no bed is
 * released"); only `RELEASE_PULL` and the other bed-release paths (via the shared
 * `releasePulledBedAndAdmission`) ever clear it. So this flag survives `RECORD_MOVEMENT_BLOCKER`
 * and `TRANSPORT_ACCEPTED` overwriting the prose, and clears only once `STEP_BACK_STAGE` (to
 * `pulled`) then `RELEASE_PULL` actually give the bed back.
 */
export function examinationRevokedWhileBedHeld(movement: Movement): boolean {
  const outcome = movement.examination?.outcome;
  if (outcome !== "community_order" && outcome !== "revoked") return false;
  return movement.admissionId !== undefined;
}

/**
 * T8 (`docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`): the fixed sentence both the
 * ED screen and the movement console render when `examinationRevokedWhileBedHeld` is true. One
 * shared constant rather than two hand-typed strings, so the two screens cannot drift apart —
 * deliberately DIFFERENT wording from `STAGE_TRANSITION_BLOCKERS.examinationRevokedAwaitingRelease`
 * (`ward-flow-reducer.ts`), which lives in the OVERWRITABLE `movement.blocker` field this
 * derivation's own doc comment explains it exists to survive.
 */
export const EXAMINATION_REVOKED_WHILE_BED_HELD_NOTICE =
  "The examination was revoked and this movement still holds a bed.";

/**
 * A movement whose CURRENT legal status requires an authorised destination, but whose already
 * accepted unit is not authorised. This is a real situation created by a mid-flight status
 * change, and it is surfaced as an exception for a human to resolve. It NEVER re-sorts,
 * re-suggests or un-accepts the patient: nothing in this prototype auto-allocates, and that
 * rule does not bend because the trigger was a status change.
 */
export function destinationNoLongerLawful(movement: Movement, units: Unit[]): Unit | undefined {
  if (!isOpen(movement)) return undefined;
  if (!requiresAuthorisedDestination(movement.legalStatus)) return undefined;
  // Redundant by behaviour, kept for readability: the `find` below would return `undefined` for an
  // undefined id anyway, so removing this line is behaviour-preserving and no test can observe it.
  // Recorded rather than deleted so a future reader does not mistake it for load-bearing — and
  // recorded rather than left silent because mutating it is the one mutation in this function that
  // does not kill its test, which is a property of the line, not a gap in the test.
  if (movement.acceptedUnitId === undefined) return undefined;
  const unit = units.find((candidate) => candidate.id === movement.acceptedUnitId);
  if (unit === undefined) return undefined;
  return unit.authorised ? undefined : unit;
}

/**
 * Whether `wardFlowReducer`'s `REFER_TO_UNITS` case would actually accept a referral for this
 * movement right now, and if not, why — named from the movement's own real stage via `stageCopy`,
 * never a generic string. Built on the reducer's own exported `REFERRABLE_MOVEMENT_STAGES`
 * (not a second, hand-copied stage list) so a UI surface's pre-check and the reducer's own guard
 * can never silently drift apart.
 *
 * Task 5 fix round 1: `ShortlistPanel` used to dispatch `REFER_TO_UNITS` and unconditionally
 * render "Referred by a human coordinator" regardless of what the reducer actually did with it.
 * Nine of the eighteen hand-authored fixture movements sit in a non-referable stage (e.g.
 * `pulled`) while still open and still offering eligible candidates — for every one of them the
 * old code showed a successful referral that never happened. This lets the Refer control state
 * the real reason up front instead of advertising an action it cannot perform.
 */
export function referralBlockedReason(movement: Movement): string | undefined {
  if (REFERRABLE_MOVEMENT_STAGES.includes(movement.stage)) return undefined;
  return `${movement.id} cannot be referred while it is ${stageCopy[movement.stage].label.toLowerCase()} — referral is only available while placement is requested or a destination is under review.`;
}

/**
 * The unit a movement is *actually* recorded against — accepted, or else the first live
 * referral. Never falls back to a different unit, and never returns a merely-suggested
 * candidate: callers that want a suggestion when this is `undefined` must ask for one
 * explicitly (see `eligibleCandidatesAmong`) and label it as a suggestion, not a destination.
 *
 * Whole-branch review Critical 1: takes the caller's own `units` rather than resolving via
 * `unitById` (the frozen `ward-sites.ts` fixture). Every live surface must pass the provider's
 * live `units` here — a ward that has just dropped its own allocatable beds to zero, or received
 * a patient, must be reflected the instant this is called next, not only at first paint.
 */
export function destinationUnit(movement: Movement, units: Unit[]): Unit | undefined {
  const id = movement.acceptedUnitId ?? movement.referredUnitIds[0];
  return id ? units.find((unit) => unit.id === id) : undefined;
}

/**
 * THE FRONT-DOOR REFERRAL A JOURNEY WAS RAISED FROM, or `undefined` when there is none.
 *
 * The read half of `Movement.referralId` (owner ruling 8, 2026-09-01): a community team refers a
 * patient to an emergency department, the patient attends it, and that department raises the
 * journey. This resolves the second record back to the first.
 *
 * ⚠️ **`undefined` IS THE ANSWER FOR A MOVEMENT WITH NO REFERRAL, AND IT IS AN ANSWER RATHER THAN
 * A FAILURE.** Most movements have none — somebody walked into a department and nobody referred
 * them — so this neither throws nor falls back to a plausible-looking referral. There is nothing
 * to guess from: a movement carries no other field that could identify one, and picking "the
 * referral at the same department" or "the most recent one" would manufacture the join that
 * `Admission.referralId` already manufactures and that
 *
 * 🔴 CORRECTED 2026-09-11: "already manufactures" IS FALSE in the present tense. The seed
 * manufactures nothing; 10 non-null values, all resolving, 257 honest nulls (a6e5208b85).
 * ✅ The surrounding point is untouched and is the reason for this function's shape:
 * `referralForMovement` REFUSES to guess a referral for a movement that carries none, rather
 * than picking "the referral at the same department" or "the most recent one".
 * `docs/ward-flow/fields-with-no-producer-2026-09-01.md` exists to record.
 *
 * ⚠️ **A DANGLING ID ALSO READS AS `undefined` HERE, AND THE GUARD IS UPSTREAM.** `RAISE_REFERRAL`
 * is the only writer and refuses an id that does not resolve, so a movement built by the reducer
 * cannot carry one. A hand-authored movement could; it would read as "no referral", which is the
 * conservative answer, not a silent success. Callers wanting to distinguish "no referral" from
 * "a referral this state does not hold" must compare `movement.referralId` themselves.
 */
export function referralForMovement(movement: Movement, referrals: Referral[]): Referral | undefined {
  if (movement.referralId === undefined) return undefined;
  return referrals.find((candidate) => candidate.id === movement.referralId);
}

/**
 * WHAT THIS JOURNEY'S FRONT-DOOR REFERRAL IS, **OR WHY IT HAS NONE** — owner ruling
 * R-2026-09-04-D, second half, and the half the ruling says is the one that matters.
 *
 * `referralForMovement` above answers with a referral or with `undefined`, and `undefined` was
 * doing the work of three different situations at once:
 *
 *   - **`none_raised`** — somebody recorded that nobody referred this person. **The only CLINICAL
 *     one**, and the only arm a screen may treat as an assertion rather than as a gap.
 *   - **`not_asked`** — the journey was raised at runtime and nothing asked which referral it came
 *     from (`RAISE_REFERRAL` writes this itself). Record-keeping.
 *   - **`not_recorded`** — nothing has been recorded either way; in today's fixture that means the
 *     movement predates the link. Record-keeping, and the DEFAULT for all existing data.
 *
 * Two further arms keep the reader honest rather than tidy: `unresolved` for an id naming a
 * referral this state does not hold (unreachable through `RAISE_REFERRAL`, which refuses one, but
 * reachable by hand), and `referral` for the resolved join.
 *
 * ⚠️ **A SET `referralId` WINS OVER ANY ABSENCE RECORD, AND THAT PRECEDENCE IS DELIBERATE.** The
 * reducer refuses to create the contradiction — `RECORD_NO_REFERRAL` rejects a movement that names
 * a referral — so a movement carrying both is hand-authored data. Reporting "nobody referred this
 * person" while a real referral resolves beside it is the fabrication this ruling exists to
 * prevent; reporting the referral is the conservative reading.
 *
 * ⚠️ **`none_raised` DOES NOT MEAN "NOBODY IS LOOKING FOR A BED FOR THIS PATIENT".** It means no
 * referral brought them in. Whether anyone is searching for a bed is `referredUnitIds`/`declines`,
 * which has its own unresolved version of this same three-causes problem — see the doc block in
 * `ed/ed-home-derivations.ts`, which refuses to count it for exactly that reason. Do not read one
 * as the other.
 */
export type MovementReferralLink =
  | { kind: "referral"; referral: Referral }
  | { kind: "unresolved"; referralId: string }
  | { kind: "none_raised"; at: Instant }
  | { kind: "not_asked"; at: Instant }
  | { kind: "not_recorded" };

export function movementReferralLink(movement: Movement, referrals: Referral[]): MovementReferralLink {
  if (movement.referralId !== undefined) {
    const referral = referralForMovement(movement, referrals);
    return referral ? { kind: "referral", referral } : { kind: "unresolved", referralId: movement.referralId };
  }
  const absence = movement.referralAbsence;
  if (absence === undefined) return { kind: "not_recorded" };
  return absence.reason === "none_raised"
    ? { kind: "none_raised", at: absence.at }
    : { kind: "not_asked", at: absence.at };
}

/**
 * WHETHER THIS PATIENT NEEDS TRANSPORT — three states, owner ruling R-2026-09-04-C.
 *
 * `"not_recorded"` is the DEFAULT and is not a soft `"not_needed"`: nobody has answered. The three
 * names exist so a caller cannot write `movement.transportNeed?.needed ?? false` and silently turn
 * an unanswered question into a stated "no" — the exact collapse the ED referral form's
 * `specialling` checkbox was ordered fixed for, and the reason `Referral.medicalClearance` is
 * shaped this way too.
 *
 * ⚠️ **IT IS NOT DERIVED FROM `Movement.transport`, AND MUST NOT BE.** A booked job proves need;
 * the absence of one proves nothing at all, which is the whole gap this state closes. A movement
 * carrying a transport job and no recorded need still reads `"not_recorded"` here — honest, and
 * visibly so — rather than being upgraded to `"needed"` by an inference nobody made.
 */
export type TransportNeedState = "needed" | "not_needed" | "not_recorded";

/**
 * A TRANSPORT JOB THAT OUTLIVED THE BED IT WAS BOOKED AGAINST — the state a real vehicle can be
 * dispatched into, measured through the reducer on 2026-09-06 and ruled on by Ward Lead the same
 * day (option 3: let the release proceed, make the orphaned job loud).
 *
 * 🔴 **WHAT WAS MEASURED, IN ONE RUN, FROM `seedWardFlowState()`.** A ward pulls a bed; the
 * sending team books transport; the ward releases the pull. The movement returns to
 * `accepted_awaiting_bed`, the bed goes back to the ward's allocatable count — **and the transport
 * job survives untouched.** The record still names a provider coming to collect a patient who has
 * nowhere to go. Then the stale job BLOCKS the correct one: after a re-pull, `BOOK_TRANSPORT`
 * refuses with *"transport for movement WF-003 is already booked"*, so the failure compounds in the
 * direction of the patient not moving at all.
 *
 * `RELEASE_PULL` does this deliberately — its own comment binds it to *"the EXACT inverse of
 * `PULL_PATIENT`'s own writes (ruling P4-1) … nothing else touched"*, a good rule written before
 * booking could follow a pull. **So the fix is not to widen that event.** It is to say so on screen.
 *
 * ⚠️ **THE PREDICATE IS THE STAGE RECORD, AND `pullExpiresAt` WAS TRIED FIRST AND IS WRONG.**
 * "A job exists and no pull is held" reads perfectly and flags **all fourteen** seeded movements
 * that carry transport — every one of them, because `pullExpiresAt` is written only by the
 * reducer and no hand-authored fixture sets it. Measured before this was written rather than after
 * it shipped. `stage` is on every movement, and `BOOK_TRANSPORT` refuses unless the stage is
 * exactly `pulled` — so **a job existing at a stage EARLIER than `pulled` is impossible to reach
 * forwards** and can only mean the record moved back underneath it.
 *
 * ⚠️ **TWO CAUSES, AND THEY ARE NOT THE SAME SITUATION.** `RELEASE_PULL` means the bed is
 * genuinely gone. `STEP_BACK_STAGE` corrects the RECORD and never touches the bed, so the ward may
 * still be holding one. Reporting both as "no bed is being held" would state something more
 * definite than the record supports, which is the defect class this page keeps paying for. The
 * `kind` below is decided by the LATEST of the two unwinds, because a movement can have had both.
 */
export type OrphanedTransport = {
  /** `pull_released`: the bed was given back. `record_stepped_back`: only the stage record moved. */
  kind: "pull_released" | "record_stepped_back";
  /** The provider named on the job — who would actually turn up. */
  provider: string;
};

export function orphanedTransport(movement: Movement): OrphanedTransport | undefined {
  /*
   * A closed movement is excluded, following this page's standing rule that nothing is raised as
   * attention on a movement nobody can act on. NOTE, recorded rather than fixed: a job left live on
   * a closed movement would be its own problem, and the two terminal paths (`PATIENT_ARRIVED`, and
   * `RECORD_EXAMINATION`'s community-order branch) each set `cancelledAt` themselves. That is why
   * this does not need to cover it, and it is a fact about those two events rather than about this
   * function — a third terminal path that forgot would slip past here.
   */
  if (movement.closure !== undefined) return undefined;
  if (movement.transport === undefined) return undefined;
  const stageIndex = MOVEMENT_STAGES.indexOf(movement.stage);
  const pulledIndex = MOVEMENT_STAGES.indexOf("pulled");
  // An unknown stage yields -1, which would compare as "before pulled" and raise a false alarm on
  // data this function cannot read. Refuse rather than guess.
  if (stageIndex < 0 || stageIndex >= pulledIndex) return undefined;

  let kind: OrphanedTransport["kind"] = "record_stepped_back";
  let decidedAt = -Infinity;
  for (const unwind of movement.unwinds) {
    if (unwind.kind !== "pull_released" && unwind.kind !== "stage_corrected") continue;
    if (unwind.at < decidedAt) continue;
    decidedAt = unwind.at;
    kind = unwind.kind === "pull_released" ? "pull_released" : "record_stepped_back";
  }
  return { kind, provider: movement.transport.provider };
}

export function transportNeedState(movement: Pick<Movement, "transportNeed">): TransportNeedState {
  if (movement.transportNeed === undefined) return "not_recorded";
  return movement.transportNeed.needed ? "needed" : "not_needed";
}

export function unitSiteCode(unit: Unit) {
  return siteByCode(unit.siteCode)?.code ?? unit.siteCode;
}

export function transportStatusLabel(transport: TransportJob | undefined) {
  if (!transport) return "Not yet requested";
  /*
   * ⚠️ CHECKED BEFORE `cancelledAt`, AND THAT ORDER IS THE FIX. `STOP_TRANSPORT` (WLQ-38, owner
   * 2026-09-15) stops a journey AFTER the patient has already been collected, and writes BOTH
   * `stoppedAt` and `cancelledAt` on the same job — see `TransportJob.stoppedAt`'s own doc
   * comment in `ward-model.ts`. A job stopped mid-journey is a materially different situation
   * from one cancelled before it ever left (a real vehicle collected this patient and the
   * journey was interrupted, rather than never happening at all), so this label must not read
   * the two the same way. `transportLeg` below is deliberately left alone: unlike this label,
   * its "Cancelled" return value is a discriminated type other modules switch and compare on
   * (`tracker-derivations.ts`'s `trackerRowState` switch, `movements-screen.tsx`'s tone logic,
   * and the `MovementLegState`/`TrackerLeg` type unions) — changing it for a stopped job would
   * change behaviour in files this fix does not touch, so that stays a separate, out-of-scope
   * decision rather than a silent side effect of this one.
   */
  if (transport.stoppedAt !== undefined) return "Stopped after collection";
  if (transport.cancelledAt !== undefined) return "Cancelled";
  if (transport.arrivedAt !== undefined) return "Arrived";
  if (transport.collectedAt !== undefined) return "Collected";
  if (transport.enRouteAt !== undefined) return "En route";
  if (transport.acceptedAt !== undefined) return `${transport.provider} accepted, awaiting departure`;
  return `${transport.provider} requested`;
}

/** The five discrete stages a transport job progresses through, in order. */
export type TransportLeg = "Requested" | "Accepted" | "En route" | "Collected" | "Arrived";

/**
 * The discrete transport leg, separated from `transportStatusLabel`'s provider narrative.
 *
 * `transportStatusLabel` mixes two different things into one string: the leg the job has
 * reached, and prose naming the provider once it has accepted. That is deliberate for the
 * views that read it today, but it means the field can never be matched against a fixed leg
 * pattern — two of its seven possible outputs contain provider prose (`"<provider> accepted,
 * awaiting departure"`, `"<provider> requested"`) rather than one of the five capitalised leg
 * names. This function returns only the leg, using the exact same precedence order as
 * `transportStatusLabel` (cancelled beats every stamp; the furthest-progressed stamp wins
 * otherwise) so the two never disagree about what stage a job is in.
 *
 * `undefined` means "no transport job at all" — a movement with no transport has not reached
 * `"Requested"`, it has no leg, so absence is never collapsed into one of the five leg names.
 */
export function transportLeg(transport: TransportJob | undefined): TransportLeg | "Cancelled" | undefined {
  if (!transport) return undefined;
  if (transport.cancelledAt !== undefined) return "Cancelled";
  if (transport.arrivedAt !== undefined) return "Arrived";
  if (transport.collectedAt !== undefined) return "Collected";
  if (transport.enRouteAt !== undefined) return "En route";
  if (transport.acceptedAt !== undefined) return "Accepted";
  return "Requested";
}

/**
 * The five-state bed grid, built entirely from real unit and bed-release fields.
 *
 * The glossary requires every bed to carry exactly one of the five states, so this must
 * partition `unit.beds` exactly: `available + held + blocked + occupied === unit.beds`.
 * `available` and `held` are both drawn from within the physically-empty pool (`unit.empty`)
 * — `available` is the ward-confirmed allocatable subset, and whatever empty capacity is not
 * yet confirmed allocatable is `held` rather than silently uncounted. `blocked` is drawn from
 * within the non-empty remainder, with whatever is left over being `occupied`. Both splits
 * are clamped so authored data that already over- or under-counts (e.g. a stale `unit.held`
 * literal that no longer fits once `available` is subtracted) can never push the total past
 * `unit.beds` or leave a bed unaccounted for.
 *
 * `bedReleases` is now a parameter rather than a module-level import (Task 11, spec item 9):
 * releases live in `WardFlowState.bedReleases` so a ward's own `FLAG_BED_RELEASE` actually moves
 * `potential`, and every caller passes whichever collection it currently holds — the live
 * reducer state where one is available, or the raw fixture for a check that has no reducer state
 * at all (`tests/ward-capacity-reconciliation.test.ts`, `tests/ward-model.test.ts`).
 */
export function unitCapacity(unit: Unit, bedReleases: BedRelease[]) {
  const available = Math.min(unit.allocatable.value, unit.empty.value);
  const held = Math.max(unit.empty.value - available, 0);
  const notEmpty = Math.max(unit.beds - unit.empty.value, 0);
  // Owner ruling 2026-09-25: out-of-service beds are not recorded anywhere in the model
  // (`Unit.blocked` is a typed count, not a record), so none is ever subtracted here and screens
  // say "Not recorded" where they used to print this count. Kept as a field so every consumer's
  // arithmetic and bar layout stay as they were.
  const blocked = 0;
  const occupied = Math.max(notEmpty - blocked, 0);
  // Physical overflow beds are not recorded. A gender-count disagreement cannot prove surge.
  // Actual arrivals with a conflicting empty observation are separately disclosed below.
  const surge = Math.max(0, occupied - unit.beds);

  return {
    available,
    held,
    /**
     * Task 7 (Phase 5, spec D6); review Finding 4: this is a raw count of every bed release for
     * the unit regardless of state or timing — it does not distinguish confirmed from expected
     * from blocked, and it does not exclude a release that falls beyond tonight. Nothing renders
     * this field any more: `ward-management-modes.tsx`, `ward/ward-screen.tsx`,
     * `ward-management-network.tsx` and `coordinator/flow-diagram.tsx` all render
     * `capacityBreakdown()`'s Confirmed/Expected figures instead. This field's arithmetic is
     * deliberately left unchanged — it is protected — but it is dead beyond its remaining
     * offline test callers (`tests/ward-capacity-reconciliation.test.ts`,
     * `tests/ward-flow-reducer.test.ts`, `tests/ward-model.test.ts`); do not repurpose it as a
     * live figure.
     */
    potential: bedReleases.filter((release) => release.unitId === unit.id).length,
    blocked,
    occupied,
    surge,
  };
}

/** Why a general-hospital trip did or did not give up the psychiatric bed. */
export type BedRetentionBasis = "above-threshold" | "at-or-below-threshold" | "override" | "expectation-unknown";

export type BedRetentionDecision = {
  /** Whether the psychiatric bed is given up. */
  readonly freesBed: boolean;
  /** What decided it — so a screen can say WHY, not only what. */
  readonly basis: BedRetentionBasis;
  /** The bed stays theirs, so the person reads as on overnight leave rather than as departed. */
  readonly readsAsOvernightLeave: boolean;
  /** Expected stay exceeds threshold, flagging for review without automatic bed release. */
  readonly requiresReview?: boolean;
};

/**
 * Ruling `FD-19` (owner, 2026-08-30): **a ward→ED-medical trip frees the bed ONLY IF the stay is
 * expected to exceed `ED_MEDICAL_BED_RELEASE_THRESHOLD_HOURS`, and that is OVERRIDABLE.** Below
 * it, the bed stays theirs and the person reads as on overnight leave.
 *
 * The threshold is the owner's own operational figure and is **not a statutory period** — see the
 * constant's own doc comment, and `tests/ward-bed-release-threshold-provenance.test.ts`, which
 * fails if it is ever sited beside legal material.
 *
 * ⚠️ **"EXCEED" IS READ STRICTLY: a stay expected to last exactly the threshold does NOT free the
 * bed.** The ruling says *exceed*. Pinned in both directions by the boundary cases in the guard,
 * because a later reader softening `>` to `>=` would change a clinical outcome silently.
 *
 * 🔴 **AND THIS BOUNDARY IS EXACTLY BACKWARDS FROM THE USUAL ONE, WHICH IS WHY IT MUST NOT BE
 * "TIDIED".** A boundary case is normally the rare input you reason about last. Here it is the
 * COMMONEST input anybody will give: asked how long a general-hospital stay will be, a clinician
 * says *"about two days"*. **So `>` versus `>=` differs on the most likely value entered, not on
 * an edge** — the disagreement is the ordinary case, and it decides whether a real patient keeps
 * a bed. Confirmed by Ward Lead, 2026-09-06.
 *
 * 🔴 **THE UNKNOWN CASE IS A JUDGEMENT THE RULING DOES NOT MAKE, AND IT IS RECORDED AS ONE.**
 * `FD-19` says nothing about a trip whose expected length nobody has stated. This returns
 * `freesBed: false` — **the bed is KEPT** — on the conservative-degradation principle: giving up a
 * bed that should have been held means somebody else is placed in it and the patient has nowhere
 * to come back to, whereas holding one that could have been released costs a bed that is visibly
 * held and can be released the moment anyone says so. **The failure is recoverable in one
 * direction and not the other.** `basis` is `"expectation-unknown"` rather than
 * `"at-or-below-threshold"` so a screen never states an expectation nobody gave — and so this
 * default is visible to whoever rules on it rather than hidden inside a boolean.
 *
 * An override wins over everything, including the unknown case, in both directions (`FD-19`).
 */
export function edMedicalTripBedRetention(input: {
  readonly expectedStayHours: number | null;
  readonly override?: { readonly freesBed: boolean } | null;
}): BedRetentionDecision {
  const decide = (freesBed: boolean, basis: BedRetentionBasis, requiresReview?: boolean): BedRetentionDecision => ({
    freesBed,
    basis,
    readsAsOvernightLeave: !freesBed,
    ...(requiresReview !== undefined ? { requiresReview } : {}),
  });

  if (input.override != null) return decide(input.override.freesBed, "override");
  if (input.expectedStayHours == null || !Number.isFinite(input.expectedStayHours)) {
    return decide(false, "expectation-unknown");
  }
  const isAbove = input.expectedStayHours > ED_MEDICAL_BED_RELEASE_THRESHOLD_HOURS;
  return isAbove ? decide(false, "above-threshold", true) : decide(false, "at-or-below-threshold");
}

/**
 * Whole-branch review Important 5: the security gate passes a Secure ward for an Open movement
 * on purpose — a locked ward can physically hold an open-status patient, so it is not a
 * *failure*. But it is also not a neutral match: placing a voluntary or open-status patient on
 * a locked ward is a real clinical decision, and the gate row reads "Met" with the affirmative
 * detail "Secure ward meets an open requirement", which hides that decision behind a tick.
 *
 * `ward-eligibility.ts` is a protected surface, so the gate's pass/fail semantics are deliberately
 * untouched. This is the separate, surfaced fact the shortlist and the diagram render alongside
 * the passing gate so a coordinator sees it before confirming.
 *
 * ⚠️ `!unitHasOpenBeds(unit)` — WHOLLY locked, not merely "has some locked beds" — deliberately,
 * since the 2026-09-04 locked/open split added mixed wards. `MORE_RESTRICTIVE_NOTE` below says "a
 * locked ward"; a mixed ward with open beds free is not one, and this function does not know which
 * specific bed a mixed-ward placement would land on. Flagging every mixed ward here would call a
 * ward "locked" that is mostly open — the exact ward-level/bed-level conflation the owner's
 * locked/open ruling warns against — so a mixed ward raises no notice from this function; only a
 * wholly locked one does, matching what `unit.security === "Secure"` meant before this split.
 * (Plan author's — the implementer who ran Tasks 3 and 4 — reasoning, 2026-09-04. Not an owner
 * ruling.)
 */
export function isMoreRestrictiveThanRequired(movement: Movement, unit: Unit): boolean {
  return movement.security === "Open" && !unitHasOpenBeds(unit);
}

/** The wording used wherever `isMoreRestrictiveThanRequired` is surfaced, so it reads identically
 * on the shortlist row, the gate note, the suggestion badge and the diagram node. */
export const MORE_RESTRICTIVE_NOTE = "More restrictive than required — a locked ward for an open-status movement";

export type RestrictionNotice = { level: "voluntary_on_locked" | "more_restrictive"; text: string };

/**
 * A ward tighter than the patient needs raises one of two warnings, and they are different things.
 * A voluntary person who cannot leave a locked ward is detained in fact without an order, which is
 * sharper than merely over-restrictive and gets its own flag. Neither blocks a placement and
 * neither touches an eligibility gate — `ward-eligibility.ts` is a protected surface.
 */
export function restrictionNotice(movement: Movement, unit: Unit): RestrictionNotice | undefined {
  /*
   * 🔴 **ONE GUARD WAS SERVING TWO DIFFERENT CLINICAL QUESTIONS, AND SPLITTING THEM RESTORES A
   * WARNING THE 2026-09-04 LOCKED/OPEN CHANGE SILENTLY REMOVED.**
   *
   * Until now both notices sat behind a single `if (unitHasOpenBeds(unit)) return undefined` —
   * wholly-locked wards only. The reasoning above is sound for `more_restrictive` and does not
   * transfer to `voluntary_on_locked`, and its author said so: it disclaims owner authority and
   * argues only the `more_restrictive` case in detail.
   *
   *   MORE_RESTRICTIVE   asks "is this ward tighter than this patient needs?" That is a question
   *                      about the WARD's character. A mostly-open mixed ward is not "a locked
   *                      ward", so calling it one would be the ward-level/bed-level conflation the
   *                      owner's ruling warns against. **Unchanged: wholly locked only.**
   *
   *   VOLUNTARY_ON_LOCKED asks "might this voluntary patient end up unable to walk out?" That is a
   *                      question about the BED, and a mixed ward has locked beds in it. **Fires
   *                      for any ward with a locked bed.**
   *
   * ⚠️ **WHAT THE OLD SHARED GUARD DID, WHICH IS WHY THIS IS A REGRESSION RATHER THAN A
   * PREFERENCE.** Before the split every "Secure" ward raised the voluntary warning. After it, only
   * wholly-locked wards did — so `bty-adult-secure`, **the owner's own worked example of a mixed
   * ward** (4 of 17 locked, "Ward 7 in Bentley is a locked/Open ward"), stopped warning that a
   * voluntary patient might be placed behind its locked doors. A change made to stop the app giving
   * a wrong clinical answer had quietly removed a clinical warning.
   *
   * **The notice is informational and gates nothing** — it never blocks a placement. So the failure
   * directions are not symmetric: firing on a mixed ward costs a coordinator one sentence they can
   * dismiss, and not firing costs them the only prompt to check a voluntary patient's legal status
   * before admission. **Erring toward the sentence.**
   *
   * ⚠️ **NOTHING PINNED THE MIXED CASE IN EITHER DIRECTION.** `ward-restriction-notice.test.ts`
   * only ever exercised a wholly-locked ward and a wholly-open one, so the old condition passed
   * everywhere because nothing tested the case it changed — not because it was confirmed correct.
   *
   * **This is Ward Lead's ruling, not the owner's, and it is cheap to reverse.** It is recorded for
   * him as a decision taken rather than a default that happened.
   */
  if (movement.legalStatus === "Voluntary") {
    if (!unitHasLockedBeds(unit)) return undefined;
    return {
      level: "voluntary_on_locked",
      text: "Voluntary patient on a locked ward — review legal status before admission",
    };
  }
  if (unitHasOpenBeds(unit)) return undefined;
  if (movement.security === "Open") {
    return { level: "more_restrictive", text: "More restrictive than this movement requires" };
  }
  return undefined;
}

export type EligibilityWarning = { level: "ineligible"; text: string; failedGates: GateResult[] };

/**
 * The other half of the finding in `docs/ward-flow/the-engine-enforces-nothing.md`: `eligibility()`
 * already computes whether this ward may lawfully or safely hold this movement, and nothing on the
 * ward's own screen showed it. `ward-screen.tsx`'s accept and pull buttons deliberately mirror the
 * reducer's own (eligibility-free) checks so the two can never advertise different verdicts — which
 * means their silent agreement reads as "nothing wrong" even on a movement `eligibility()` would
 * refuse outright. This is INFORMATION, never a gate: it never blocks accept or pull, and it calls
 * `eligibility()` exactly as written — `ward-eligibility.ts` is a protected surface and its pass/fail
 * semantics are untouched here, the same discipline `restrictionNotice` above already keeps.
 *
 * Independent of `restrictionNotice`, not a second copy of it: that function flags a ward MORE
 * restrictive than a movement strictly needs (never itself a hard `eligibility()` failure — its
 * `security` gate only fails the other direction, a movement needing Secure placed on an Open
 * ward), or a voluntary patient held on a locked ward (a fact `eligibility()` does not gate on at
 * all — its `authorisation` gate only fires for a NON-voluntary movement). Neither of
 * `restrictionNotice`'s two cases can coincide with a failing `eligibility()` gate for the same
 * pair, so a case already flagged there never also earns this warning for the same underlying fact.
 *
 * Lists EVERY failing gate's own `detail`, never just the first — `candidateReason()` deliberately
 * picks one gate for a single-line "why not eligible" summary elsewhere on the coordinator's
 * screen; a ward silently told about only one of several problems would read as complete when it
 * is not.
 */
export function eligibilityWarning(movement: Movement, unit: Unit, now: Instant): EligibilityWarning | undefined {
  const failedGates = eligibility(movement, unit, now).gates.filter((gate) => !gate.pass);
  if (failedGates.length === 0) return undefined;
  return {
    level: "ineligible",
    // Opus review round 2, 17 September 2026 (P2), privacy: `wardFacingGateDetail` — never
    // `gate.detail` directly — is what keeps this ward/ED-facing warning from ever joining in the
    // `gender_designation` gate's own "female only"/"Record gender first" wording. This is the
    // only caller of `eligibilityWarning` today (`ward-screen.tsx`, both presentation modes).
    text: `Does not meet every placement requirement — ${failedGates.map((gate) => wardFacingGateDetail(gate)).join("; ")}`,
    failedGates,
  };
}

/**
 * The units among `units` whose cohort matches this movement's, ranked eligible-first using the
 * real eligibility gates, then truncated to `limit`.
 *
 * This is NOT a proximity ranking, and must never be described as one. `Unit` carries no
 * distance, geo, locality or catchment field, and `Movement` carries no catchment either
 * (see `movementHealthService`), so no surface in this prototype can honestly claim a
 * "nearest" anything. Whole-branch review Critical 1 found exactly that claim on screen:
 * WF-018, sitting in SCGH's own emergency department, was offered "RPH Older Adult" first and
 * its own SCGH ward second under a heading reading "Nearest candidates". The tie order below is
 * simply `units`' own array order.
 *
 * Task 5: within that same top-`limit` set, a candidate matching the movement's own security
 * requirement is ranked ahead of a restricted one — see the two-pass reasoning in the body below.
 *
 * This is a shortlist of candidates, never a destination — a unit appearing here has not been
 * referred or accepted; see `destinationUnit` for the movement's actual recorded destination.
 *
 * Whole-branch review Critical 1: this is the function root-caused by the review as reading the
 * frozen fixture on every live surface (a ward's own confirmed capacity could drop to zero and
 * the coordinator's shortlist would still read "Eligible now" for it). It now takes `units` as a
 * parameter instead of reading `allUnits()` itself — every live caller must pass the provider's
 * live `units`, never the frozen fixture. `units` is REQUIRED and deliberately has no default —
 * a defaulted `units = allUnits()` would let every existing call site keep compiling while
 * silently reading frozen capacity again, which is precisely how the original defect survived.
 * The frozen wrapper this comment used to point at was deleted in R70; nothing reads the fixture
 * at render time any more, and `tests/ward-flow-single-source.test.ts` enforces that with a
 * TypeScript-parser walk rather than a text scan.
 */
/**
 * ⚠️ WHAT A WARD IS TO THIS MOVEMENT, IN THE ONLY THREE STATES A COORDINATOR CAN ACT ON.
 *
 * `eligible`    — take it.
 * `overridable` — every failing gate is a JUDGEMENT about the patient, so a named human may take
 *                 it by recording why. The engine will accept that; see `eligibilityRefusal`.
 * `unavailable` — at least one failing gate is a FACT ABOUT THE WORLD: no bed, no specialling
 *                 capacity, a stale count. ⚠️ NO REASON BUYS PAST THESE, and a list that styled
 *                 them like an overridable ward would be offering a coordinator something they can
 *                 never have. The owner's rule: no reason typed into a form creates a bed.
 */
export type ShortlistAvailability = "eligible" | "previously_declined" | "overridable" | "waitlist" | "unavailable";

/**
 * ⚠️ GATES THAT INFORM AND DO NOT BLOCK — a third kind, and neither of the two this file started
 * with fits them.
 *
 * `prior_decline` says a ward has already said no to this person once. The owner ruled that
 * re-approaching such a ward needs NO WRITTEN REASON, and the reducer already agrees: the gate is
 * absent from `SUITABILITY_GATES`, so `eligibilityRefusal` never sees it and a re-approach passes
 * with no friction at all.
 *
 * ⚠️ SO IT MUST NOT BE MOVED INTO `SUITABILITY_GATES` TO FIX THIS. That would make it
 * overridable-WITH-a-reason, which is the thing he ruled against. It needs its own bucket, not a
 * move between the two that exist.
 *
 * A ward that declined at 2pm because it was full, with a bed free at 8pm, must remain reachable —
 * and the coordinator must still SEE that it said no before, because that is useful. The
 * information is useful; the block was wrong.
 */
/**
 * ⚠️ EXPORTED SO IT CAN BE PINNED AGAINST THE ENGINE, NOT SO IT CAN BE IMPORTED FOR CONVENIENCE.
 * `tests/ward-informational-gates.test.ts` proves, for EVERY member, that the reducer genuinely
 * accepts a referral to a ward failing only that gate with NOTHING recorded. Adding a member with
 * no such case makes that test fail rather than pass quietly — the list cannot outrun the engine.
 */
export const INFORMATIONAL_GATES: readonly EligibilityGate[] = ["prior_decline"];

/**
 * ⚠️ THE ONE PLACE THAT SAYS WHICH WARDS A COORDINATOR MAY SIMPLY REFER TO — and it exists because
 * the screen asked a DIFFERENT QUESTION from this file and got a different answer.
 *
 * `verdict.eligible` is false for a previously-declining ward, because `prior_decline` genuinely
 * fails as a gate. So a control that reads `verdict.eligible` to decide whether Refer is available
 * blocks a ward the owner ruled needs NO WRITTEN REASON — and the disabled control then reads
 * "Not eligible … Use Override instead", which demands the very reason he ruled against.
 *
 * ⚠️ THAT IS WHAT SHIPPED IN `4e07bf520`, AND IT IS WORTH BEING PRECISE ABOUT WHAT WENT WRONG: the
 * ward moved into the candidates list correctly, and THE SAME FALSE CLAIM REAPPEARED ON THE REFER
 * BUTTON. The falsehood was not removed, it was MOVED. The list read `availability`; the button
 * read `verdict.eligible`; nothing made them agree, and nothing went red.
 *
 * ⚠️ A browser check passed over it, because it searched for the sentence that had been REMOVED and
 * that sentence was genuinely gone. Confirming the old wording is absent is not confirming the
 * screen is right.
 *
 * Every consumer deciding "may this be referred with nothing recorded?" calls THIS, never
 * `verdict.eligible`.
 */
export function needsNoRecordedReason(availability: ShortlistAvailability): boolean {
  return availability === "eligible" || availability === "previously_declined";
}

export type ShortlistCandidate = {
  unit: Unit;
  verdict: ReturnType<typeof eligibility>;
  availability: ShortlistAvailability;
  tier?: 1 | 2 | 3 | 4;
  priorityTier?: 1 | 2 | 3 | 4;
  waitlist?: boolean;
  waitlistTier?: string;
};

export function isCatchmentUnit(movement: Movement, unit: Unit): boolean {
  if (movement.homeRegion && unit.homeRegion) {
    return movement.homeRegion === unit.homeRegion;
  }
  const originEd = edById(movement.originEdId);
  const edSiteCode =
    originEd?.siteCode ?? (movement.originEdId ? movement.originEdId.replace(/^ed-/, "").toUpperCase() : undefined);
  if (edSiteCode && unit.siteCode && edSiteCode.toUpperCase() === unit.siteCode.toUpperCase()) {
    return true;
  }
  if (edSiteCode && unit.siteCode) {
    const originSite = siteByCode(edSiteCode);
    const unitSite = siteByCode(unit.siteCode);
    if (originSite?.service && unitSite?.service && originSite.service === unitSite.service) {
      return true;
    }
  }
  return false;
}

/**
 * EVERY ward, with an honest verdict on each — never a pre-filtered list.
 *
 * ⚠️ IT REPLACES A FILTER THAT MADE WARDS INVISIBLE RATHER THAN REFUSED. `eligibleCandidatesAmong`
 * drops every unit of a different cohort BEFORE eligibility is computed, so those wards could never
 * be seen, never be reasoned about, and never be overridden — they simply were not there.
 *
 * ⚠️ AND HIDING THEM WAS DEFENSIBLE UNTIL TONIGHT. While the engine refused a mismatched placement
 * outright, showing a coordinator a ward they could not use was noise. Now a judgement gate is
 * overridable with a recorded reason, so a cohort-mismatched ward is a LEGITIMATE DESTINATION and
 * hiding it is the defect. `cohort` is itself one of the overridable gates.
 *
 * ⚠️ NO LIMIT, DELIBERATELY, and this is the part that must not be undone. The list it replaces was
 * capped at `PARALLEL_REFERRAL_CAP` — a rule about how many places ONE REFERRAL MAY BE SENT TO,
 * borrowed as a display count, which is a domain rule doing a layout job. Re-capping would restore
 * the original defect in a new costume: with three eligible wards present, every overridable one
 * would fall off the end and be invisible again. Order it, group it, scroll it — do not truncate it.
 */
export function shortlistCandidates(movement: Movement, units: Unit[], now: Instant): ShortlistCandidate[] {
  /*
   * 🔴 CATCHMENT-PRIORITY ORDERING IS SCOPED TO SECURE-BED PATIENTS, AND DELIBERATELY NOT TO
   * INVOLUNTARY ONES. Owner ruling, 2026-09-18: no catchment-priority ordering for detained
   * patients "for now". Reaffirmed on 2026-09-19 through a peer session, after a build had
   * changed it and it was returned.
   *
   * ⚠️ THIS CONDITION USED TO CARRY A SECOND COMPARISON, AND IT BAITED TWO SESSIONS INTO
   * "FIXING" IT: `movement.legalStatus === "Involuntary"`. `LegalStatus` has no such member --
   * it holds `Voluntary`, `Referred for psychiatric examination`, `Detained awaiting examination`
   * and `Involuntary inpatient` -- so that comparison was dead and this expression already meant
   * exactly what the one line below now says. **Correcting the spelling would not have been a
   * repair.** It would have turned the ordering ON for involuntary inpatients, whom the owner
   * excluded, and OFF for a patient detained awaiting examination in a secure unit, who has it
   * today. One population swapped for another, wearing a typo -- and it read as a tidy-up, because
   * the dead string also sat behind a cast that hid it from the compiler.
   *
   * ✅ The dead comparison and its cast are now gone, so there is nothing left here that looks
   * broken and is not. The live rule is one honest line, and the ruling is recorded rather than
   * implied. If the ordering is ever wanted for a legal status, the question to bring back is
   * WHICH STATUSES -- answered by naming them here, beside this note, never by repairing a string.
   *
   * The version set aside that night is preserved whole under
   * `Backups/claude-work/ward-derivations-uncommitted-*`; nothing of it was discarded.
   *
   * Guarded by `tests/ward-shortlist-candidates.test.ts` -- "catchment-priority ordering".
   */
  const catchmentPriorityApplies = movement.security === "Secure";

  return units
    .map((unit) => {
      const verdict = eligibility(movement, unit, now);
      const failing = verdict.gates.filter((gate) => !gate.pass);
      /*
       * 🔴 Owner reversal, item 2, 17 September 2026: a Non-binary movement failing ONLY
       * `gender_designation` at a single-gender ward is not a dead end — a coordinator can still
       * clear it by recording a `GenderPlacement` for this unit (`ward-eligibility.ts`'s own
       * `genderDesignationResult`). Filtering it into `unavailable` would hide that path exactly
       * the way an Undesignated ward's own gender-placement requirement is never hidden — this
       * unit must stay offerable so the gender-placement form (shown by `needsGenderPlacement` in
       * `shortlist-panel.tsx`, already keyed on `movement.gender`/`genderPlacements`) can reach it.
       * Scoped tightly: only when `gender_designation` is the SOLE failing gate, so a ward that is
       * also cohort-mismatched or full stays in its ordinary bucket.
       */
      const genderPlacementPending =
        // R7 (25 September 2026): any gender that is not female or male, including not recorded.
        movement.gender !== "Female" &&
        movement.gender !== "Male" &&
        failing.length === 1 &&
        failing[0].gate === "gender_designation" &&
        !(movement.genderPlacements ?? []).some((record) => record.unitIds.includes(unit.id));
      // ⚠️ Fail-closed by construction, the same rule the engine applies: a gate is overridable ONLY
      // by appearing in `SUITABILITY_GATES`. Anything else — including a gate added later by
      // somebody who never opened this file — makes the ward unavailable rather than overridable.
      const blocking = failing.filter(
        (gate) =>
          !SUITABILITY_GATES.includes(gate.gate) &&
          !INFORMATIONAL_GATES.includes(gate.gate) &&
          !(genderPlacementPending && gate.gate === "gender_designation"),
      );
      const judgements = failing.filter((gate) => SUITABILITY_GATES.includes(gate.gate));
      const availability: ShortlistAvailability = verdict.eligible
        ? "eligible"
        : blocking.length > 0
          ? "unavailable"
          : judgements.length > 0
            ? "overridable"
            : // Only informational gates failed — usable, needing nothing, with a note.
              "previously_declined";

      const available = movement.security === "Secure" ? lockedBedsFree(unit) : unit.allocatable.value;
      const isCatchment = isCatchmentUnit(movement, unit);

      const cohortMatches = unit.cohort === movement.cohort;
      let tier: 1 | 2 | 3 | 4;
      if (cohortMatches && isCatchment && available > 0) {
        tier = 1;
      } else if (cohortMatches && !isCatchment && available > 0) {
        tier = 2;
      } else if (cohortMatches && isCatchment && available === 0) {
        tier = 3;
      } else {
        tier = 4;
      }

      // 3-Tier Involuntary Waitlist Priority Hierarchy (WF-01):
      // For involuntary placements, in-catchment wards with 0 vacant locked beds are never
      // rejected/disqualified; surfaced via tier 3 and waitlist properties.

      return {
        unit,
        verdict,
        availability,
        tier,
        priorityTier: tier,
        waitlist: tier === 3,
        waitlistTier: tier === 3 ? "Tier 3" : undefined,
      };
    })
    .sort((a, b) => {
      if (catchmentPriorityApplies) {
        const tierDiff = (a.tier ?? 4) - (b.tier ?? 4);
        if (tierDiff !== 0) return tierDiff;
      }
      return rankOf(a.availability) - rankOf(b.availability);
    });
}

/**
 * The gate to SHOW against a ward nothing can buy — the first failing gate OUTSIDE the overridable
 * set, falling back to the first failing gate at all.
 *
 * ⚠️ IT EXISTS BECAUSE THE OBVIOUS VERSION IS WRONG IN THE DANGEROUS DIRECTION, and it was caught
 * by looking at the rendered screen rather than by a test. Taking simply the first failing gate
 * showed "Open ward does not meet a secure requirement" against a ward that is unavailable because
 * it HAS NO BED — naming an OVERRIDABLE reason on a row no reason can buy. A coordinator reading
 * that would reasonably conclude a recorded reason would get them in.
 *
 * The fallback is unreachable for an `unavailable` candidate by construction, and is kept so the
 * function is total for any verdict a caller hands it.
 */
export function blockingGate(verdict: ReturnType<typeof eligibility>) {
  return (
    verdict.gates.find(
      (gate) => !gate.pass && !SUITABILITY_GATES.includes(gate.gate) && !INFORMATIONAL_GATES.includes(gate.gate),
    ) ?? verdict.gates.find((gate) => !gate.pass)
  );
}

/** Eligible first, then what a reason can buy, then what nothing can. Stable within each group, so
 *  the order inside a group is `units`' own and nothing is ranked against its neighbours. */
function rankOf(availability: ShortlistAvailability): number {
  if (availability === "eligible") return 0;
  // A ward that only declined before needs nothing recorded, so it sits above one that does.
  if (availability === "previously_declined") return 1;
  if (availability === "overridable") return 2;
  if (availability === "waitlist") return 3;
  return 4;
}

export function eligibleCandidatesAmong(movement: Movement, units: Unit[], now: Instant, limit = 3) {
  // Eligible-first cut FIRST, restrictiveness reorder SECOND, deliberately in two passes rather
  // than one combined sort. A single combined sort could pull in a unit that was previously
  // outside the top `limit` (a candidate ranked 4th purely because it is restrictive would climb
  // into a 3-slot shortlist ahead of one that was already in it) — a real membership change, not
  // just a reorder, and `/mockups/ward-flow/network` shows this same shortlist. Truncating on
  // eligibility alone first keeps the returned SET identical to before this ordering rule
  // existed; only the ORDER within that set can move.
  const eligibleFirst = units
    .filter((unit) => unit.cohort === movement.cohort)
    .map((unit) => ({ unit, verdict: eligibility(movement, unit, now) }))
    .sort((a, b) => Number(b.verdict.eligible) - Number(a.verdict.eligible))
    .slice(0, limit);
  // Within that fixed set, a candidate matching the movement's own security requirement is
  // ranked ahead of one `restrictionNotice` flags as tighter than required (Task 5) — a locked
  // ward can still genuinely hold an open-status patient, it just should not be the one a
  // coordinator is steered toward first. Eligibility stays the primary key here too, so this
  // pass can never demote an eligible candidate below an ineligible one. `Array.prototype.sort`
  // is stable, so any remaining tie falls back to the eligible-first cut's own order, which is
  // itself `units`' own array order.
  return [...eligibleFirst].sort((a, b) => {
    const eligibleDiff = Number(b.verdict.eligible) - Number(a.verdict.eligible);
    if (eligibleDiff !== 0) return eligibleDiff;
    const aRestricted = restrictionNotice(movement, a.unit) ? 1 : 0;
    const bRestricted = restrictionNotice(movement, b.unit) ? 1 : 0;
    return aRestricted - bRestricted;
  });
}

/**
 * Re-exported from `ward-eligibility.ts`, where this function now lives — see its doc comment
 * there for what it does and for why it moved (fix round C, F1 / review finding C1: importing it
 * from THIS module pulled the bed-release model into referral matching's transitive
 * import graph and broke the D15 contract test). Kept exported here so the six call sites that
 * already import it from `ward-derivations` need no edit.
 */
export { candidateReason } from "@/components/ward-management/ward-eligibility";

export type InboxTone = "danger" | "warning";
export type InboxItem = {
  id: string;
  tone: InboxTone;
  icon: LucideIcon;
  title: string;
  detail: string;
  owner: string;
  movementId: string;
  /**
   * 🔴 **WHETHER THIS ROW CAN BE TICKED OFF AT ALL** — ward-lead task, 2026-09-06. A `"fact"` is a
   * live clinical or legal truth that leaves this list when it stops being true; a `"commitment"`
   * is a human undertaking that leaves when the person says they finished. See `InboxItemKind` and
   * `INBOX_CATEGORIES` in `ward-flow-reducer.ts` for the classification itself, and
   * `COMPLETE_INBOX_ITEM`'s reducer case for the refusal that makes the distinction real rather
   * than advisory.
   *
   * ⚠️ **A RENDERER MAY USE THIS TO DECIDE WHAT CONTROLS TO SHOW, BUT MUST NOT RELY ON IT AS THE
   * SAFEGUARD.** The safeguard is the reducer's refusal; this field exists so a screen can avoid
   * offering a control that would only be refused, not so the screen becomes the place the rule
   * lives.
   */
  kind: InboxItemKind;
};

/**
 * Every item here is computed from real movement fields — nothing is authored.
 *
 * RULING (Task 8): each category uses `.filter()`, never `.find()`. A `.find()`-based inbox
 * reported exactly one item per category regardless of how many movements qualified, silently
 * understating the coordinator's work list.
 *
 * Re-measured against the real fixture at `NOW_ANCHOR` on 2026-08-23: **zero** movements carry a
 * breached legal deadline, one has reached the parallel-referral cap, and two have transport
 * accepted but not departed. The legal category is empty because the 2026-08-23 product-owner
 * correction removed every `dueAt` from Forms 1A and 3B (see `LegalForm`'s own doc comment in
 * ward-model.ts), and the only deadlines left in this fixture — the transport/transfer forms 4A
 * and 4C — are not currently in the past. An earlier version of this comment claimed five
 * movements carried a breached statutory deadline; that number described the deleted fabrication
 * and is not true of any figure in this model.
 *
 * The `.filter()` shape stays regardless, for two reasons: the transport category alone still
 * qualifies two movements today, so `.find()` would still understate the list; and the legal
 * category is dormant rather than removed, so it must count correctly the moment a form that
 * legitimately carries a deadline falls due. This is the coordinator's work list, not a report:
 * every qualifying movement gets its own row.
 */
export function buildActionInbox(
  movements: Movement[],
  now: Instant,
  units: Unit[],
  /** Optional: the whole record, to add outstanding carer/PSP/MHAS notification rows. */
  records?: Omit<Parameters<typeof supportNotificationInboxItems>[0], "units">,
): InboxItem[] {
  const items: InboxItem[] = [];

  // A legal status change can make an already-accepted destination unlawful — see
  // `destinationNoLongerLawful`'s own doc comment. This never re-sorts or un-accepts the
  // patient; it only surfaces the fact for a human, exactly like every other category here.
  const noLongerLawful = movements
    .map((movement) => ({ movement, unit: destinationNoLongerLawful(movement, units) }))
    .filter((entry): entry is { movement: Movement; unit: Unit } => entry.unit !== undefined);
  for (const { movement, unit } of noLongerLawful) {
    items.push({
      id: `${INBOX_CATEGORIES.destination_unlawful.idPrefix}${movement.id}`,
      kind: INBOX_CATEGORIES.destination_unlawful.kind,
      tone: "danger",
      icon: CircleAlert,
      title: "Accepted destination no longer suitable",
      detail: `${movement.id} · ${unit.name} is not set up for involuntary admissions (demo) for ${movement.legalStatus}`,
      owner: movement.owner,
      movementId: movement.id,
    });
  }

  // A form with no `dueAt` is never breached and contributes nothing here; `undefined` must never
  // reach `clockState`'s arithmetic. As of the 2026-08-23 product-owner correction that is every
  // Form 1A and every Form 3B in this model — the record carries no deadline for them. Stated
  // that way deliberately: what this model holds is a fact about the record, whereas what the
  // Mental Health Act does or does not require is a legal claim this prototype is not entitled to
  // make in either direction. The question was settled for the 3B by the clinician (Task 6A:
  // "It is just counting how long they have been in ED determining priority. So counting up") and
  // for the 1A by the product owner on 2026-08-23. See `LegalForm`'s doc comment in ward-model.ts.
  const breachedLegal = movements.filter(
    (movement) => movement.legalForm?.dueAt !== undefined && clockState(movement.legalForm.dueAt, now) === "breached",
  );
  for (const movement of breachedLegal) {
    const dueAt = movement.legalForm?.dueAt;
    if (dueAt === undefined) continue;
    items.push({
      id: `${INBOX_CATEGORIES.legal_timing_breached.idPrefix}${movement.id}`,
      kind: INBOX_CATEGORIES.legal_timing_breached.kind,
      tone: "danger",
      icon: CircleAlert,
      title: "Legal due time passed",
      detail: `${movement.id} · ${formatRemaining(minutesUntil(dueAt, now))}`,
      owner: movement.owner,
      movementId: movement.id,
    });
  }

  const expiredBedPulls = movements.filter(
    (movement) => movement.stage === "pulled" && movement.pullExpiresAt !== undefined && movement.pullExpiresAt < now,
  );
  for (const movement of expiredBedPulls) {
    const pullExpiresAt = movement.pullExpiresAt;
    if (pullExpiresAt === undefined) continue;
    items.push({
      id: `${INBOX_CATEGORIES.bed_pull_expired.idPrefix}${movement.id}`,
      kind: INBOX_CATEGORIES.bed_pull_expired.kind,
      tone: "danger",
      icon: CircleAlert,
      title: "Bed pull expired",
      detail: `${movement.id} · ${formatRemaining(minutesUntil(pullExpiresAt, now))}`,
      owner: movement.owner,
      movementId: movement.id,
    });
  }

  // Whole-branch review Important 4: this counts DECLINES, and the title used to claim the
  // PARALLEL REFERRAL CAP had been reached — two different denominators (`ward-priority.ts`
  // documents the same distinction for the score). WF-009 carries five declines and zero live
  // referrals, so the drawer announced a referral cap reached for a movement with nothing
  // referred anywhere. The threshold is unchanged; only the claim is, so it now names exactly
  // what it measures. `PARALLEL_REFERRAL_CAP` is still the threshold because three refusals is
  // the point at which a coordinator should widen the search, not because three referrals are
  // outstanding.
  //
  // Item 20: `acceptedUnitId === undefined` added 2026-09-17. This row used to ignore acceptance
  // entirely — a movement declined by three wards and then accepted by a fourth kept warning the
  // coordinator that destinations had declined it, past the point where that fact still needed
  // acting on. A ward already accepted is not a movement to widen the search for.
  const heavilyDeclined = movements.filter(
    (movement) => movement.declines.length >= PARALLEL_REFERRAL_CAP && movement.acceptedUnitId === undefined,
  );
  for (const movement of heavilyDeclined) {
    items.push({
      id: `${INBOX_CATEGORIES.destinations_declined.idPrefix}${movement.id}`,
      kind: INBOX_CATEGORIES.destinations_declined.kind,
      tone: "danger",
      icon: CircleAlert,
      title: "Multiple destinations declined",
      detail: `${movement.id} · ${movement.declines.length} destinations have declined`,
      owner: movement.owner,
      movementId: movement.id,
    });
  }

  const stalledTransport = movements.filter(
    (movement) =>
      movement.transport?.acceptedAt !== undefined &&
      movement.transport.enRouteAt === undefined &&
      movement.transport.cancelledAt === undefined,
  );
  for (const movement of stalledTransport) {
    if (!movement.transport) continue;
    items.push({
      id: `${INBOX_CATEGORIES.transport_awaiting_departure.idPrefix}${movement.id}`,
      kind: INBOX_CATEGORIES.transport_awaiting_departure.kind,
      tone: "warning",
      icon: Truck,
      title: "Transport awaiting departure",
      detail: `${movement.id} · accepted ${formatInstant(movement.transport.acceptedAt as Instant)}`,
      owner: movement.owner,
      movementId: movement.id,
    });
  }

  // Advisory carer/PSP/MHAS notifications still to record for recent involuntary moves. These are
  // about COMPLETED moves, so they read every movement in `records`, not the caller's open list.
  if (records) items.push(...supportNotificationInboxItems({ ...records, units }, now));

  return items;
}

/**
 * Task 4 (spec item 1): the shift handover — a point-in-time, printable summary a coordinator
 * hands to the incoming coordinator, built from four fixed sections in a product-owner-approved
 * order. This function is a pure derivation, exactly like every other one in this module — `now`
 * arrives as a parameter, nothing here reads the wall clock — but the FREEZE that makes it a
 * handover rather than a live view is the caller's responsibility, not this function's: a page
 * must call this exactly once, in a `useState` initialiser, so what a coordinator reads never
 * changes under them while the shift clock keeps ticking in the background. Calling this
 * function itself is always safe and always pure; only the page can break the freeze.
 *
 * Every section is scoped to OPEN movements (`isOpen`) — a shift handover is about the live
 * caseload being handed over, not movements that have already arrived or otherwise closed.
 *
 * `longestWaits` carries every open movement, ranked by wait, with deliberately NO threshold:
 * measured against the real fixture at NOW_ANCHOR, zero of the open movements are past the
 * 24-hour departmental access target, so a breach-led ranking would render this section empty.
 * Ranking by wait alone always has something to hand over.
 *
 * `placementGoneWrong` names exactly three situations, none of them a legal claim:
 * - `"escalated"` — the movement carries a recorded `escalation`: a human already declared the
 *   referral network exhausted and rang the state bed coordination desk.
 * - `"declined_by_all"` — the movement has a decline on record, nothing still pending, and no
 *   unit has accepted (`referredUnitIds` empty, `declines` non-empty, `acceptedUnitId`
 *   undefined). `referredUnitIds` alone is not enough: `ACCEPT_IN_PRINCIPLE`
 *   (`ward-flow-reducer.ts`) ALSO empties it, the instant a unit says yes, on a movement that may
 *   already carry an earlier decline from a ward that said no first. Read without the
 *   `acceptedUnitId` check, an accepted movement with one prior decline satisfied the same two
 *   conditions `case "DECLINE"` produces and was reported as refused by every ward on the network
 *   — WF-23. `case "DECLINE"` only ever removes a unit from `referredUnitIds` in the same update
 *   that adds the matching `declines` entry, so "every unit this movement was ever referred to
 *   has since said no, and none of them are still deciding" is what `referredUnitIds.length ===
 *   0 && declines.length > 0` meant ONLY before a movement could also reach empty
 *   `referredUnitIds` by being accepted; the `acceptedUnitId === undefined` conjunct is what
 *   keeps that reading true now that it can.
 * - `"acceptance_withdrawn"` — item 20 / owner decision 2026-09-17: `WITHDRAW_ACCEPTANCE`
 *   (`ward-flow-reducer.ts`) ALSO clears `acceptedUnitId` without reviving a `referredUnitIds`
 *   entry (owner ruling 3 of 2026-09-04 — a withdrawal is not a re-referral), so a movement
 *   declined once and then accepted-then-withdrawn satisfies the exact same three-clause shape
 *   `"declined_by_all"` does. It is not the same fact: nobody has refused this movement since the
 *   coordinator took back a ward's "yes", and reporting it as network-wide refusal would blame the
 *   wards for a withdrawal none of them made — WF-R2. The two are told apart by ORDER, not by the
 *   three clauses above: the latest `Movement.unwinds` entry of kind `"acceptance_withdrawn"` is
 *   compared against the latest `Movement.declines` entry. A withdrawal with no later decline
 *   reads `"acceptance_withdrawn"`; a decline recorded after that withdrawal (a fresh referral
 *   that also said no) puts the movement back in front of a network that has since refused it
 *   again, and it reads `"declined_by_all"` once more.
 * A movement can satisfy more than one of these; the escalation check runs first, and the
 * decline/withdrawal ordering above is exactly what keeps the other two exclusive of each other,
 * so every movement is listed once.
 */
export type HandoverSnapshot = {
  /**
   * WHEN THIS SNAPSHOT WAS TAKEN. Called `frozenAt` until owner decision OD-4, 2026-08-30, when
   * the handover page stopped freezing and began reading live like every other screen. The old
   * name would have gone on describing a freeze that no longer happens — the same way a field
   * keeps asserting a behaviour after the behaviour is removed, which this project has been bitten
   * by before. A snapshot is still taken at a moment; it is simply taken again on every render.
   */
  takenAt: Instant;
  /**
   * ⚠️ **NO RESOLVED UNIT, DELIBERATELY.** This carried `unit: Unit | undefined`, filled by
   * `destinationUnit()` — `acceptedUnitId ?? referredUnitIds[0]` — and the handover page printed it
   * under a column headed "Destination". On a movement with open referrals and no acceptance that
   * named the FIRST WARD ASKED as though a ward had agreed to take the patient.
   *
   * The field is gone rather than corrected because a resolved `Unit` on this row is what invited
   * the fabrication: whoever renders it has to decide what it means, and the honest answer needs
   * the referrals too. The page now builds the cell from the movement itself, via
   * `destinationCell()`, which keeps the three states apart.
   */
  longestWaits: { movement: Movement }[];
  /**
   * ⚠️ **STILL RESOLVED VIA `destinationUnit()`, AND THIS IS NOT THE PATTERN TO COPY.** It cannot
   * fabricate here: every movement reaching this list has `pullExpiresAt` set, and both ways that
   * happens guarantee an `acceptedUnitId` — `PULL_PATIENT` refuses unless
   * `movement.acceptedUnitId === event.unitId` (`ward-flow-reducer.ts`), and all four seeded writers
   * set `acceptedUnitId` with `referredUnitIds: []` (`ward-movements.ts`). Checked over both paths,
   * because proving it over the reducer alone would be a claim about the reducer, not about the
   * field. Left as it is so this repair stays the size of the defect it fixes.
   */
  pulledBeds: { movement: Movement; unit: Unit | undefined; expired: boolean }[];
  inTransit: { movement: Movement; leg: TransportLeg | "Cancelled" | undefined }[];
  placementGoneWrong: {
    movement: Movement;
    kind: "escalated" | "declined_by_all" | "acceptance_withdrawn";
  }[];
};

export type OverrideEntry = { movement: Movement; override: Override };

/**
 * THE WHOLE OVERRIDE REGISTER — the coordinator's view.
 *
 * Every override on every movement, newest last within a movement because that is the order they
 * were made in. This is the unrestricted read, and it exists so the restriction below is a real
 * restriction rather than a name for the only thing there is.
 */
export function allOverrides(movements: Movement[]): OverrideEntry[] {
  return movements.flatMap((movement) => movement.overrides.map((override) => ({ movement, override })));
}

/**
 * THE WARD'S VIEW — the overrides made AGAINST this unit, and nothing else.
 *
 * Owner decision OD-3: an override is **visible to the party overridden**. This is that clause, and
 * it is the whole difference between an accountability record and an audit trail — which store
 * identical data and differ only in who can read them.
 *
 * ⚠️ **THIS FILTERS AT THE SOURCE, NOT AT RENDER, AND THAT IS THE POINT.** The natural
 * implementation is to hand a ward screen `allOverrides` and filter it in the component. That looks
 * identical in review and passes any test asserting a ward sees its own overrides — and it leaks
 * every other ward's the moment somebody adds a column, a debug panel, or a styling change that
 * reveals a row meant to be hidden. **What a ward may not see must not reach it.**
 * `tests/ward-override-register.test.ts` is the boundary that goes red.
 *
 * Same shape and same reasoning as FD-23's ward-blindness rule on referrals, which Ward Referrals
 * is building: a ward-scoped surface is a projection, never the full record with fields hidden.
 */
export function overridesAgainstUnit(movements: Movement[], unitId: string): OverrideEntry[] {
  return allOverrides(movements).filter((entry) => entry.override.unitIds.includes(unitId));
}

export type DeclineEntry = { movement: Movement; decline: Decline };

/**
 * THE WHOLE DECLINES REGISTER — the coordinator's view.
 *
 * Every decline on every movement (`Movement.declines`, written whenever a unit refuses a
 * referral — `ward-flow-reducer.ts`'s `DECLINE_UNIT` case), flattened the same way `allOverrides`
 * flattens `Movement.overrides` above. There is no ward-scoped counterpart: a decline is the
 * declining unit's OWN recorded action against a referral it was offered, not a record kept
 * ABOUT that unit by someone else, so OD-3's "visible to the party overridden" restriction has no
 * analogue here — nothing is being read back to the party the record concerns that they did not
 * already know. Task 5's coordinator bottom bar (`coordinator/exception-drawer.tsx`) is this
 * read's only caller today.
 */
export function allDeclines(movements: Movement[]): DeclineEntry[] {
  return movements.flatMap((movement) => movement.declines.map((decline) => ({ movement, decline })));
}

export function handoverSnapshot(movements: Movement[], units: Unit[], now: Instant): HandoverSnapshot {
  const open = movements.filter(isOpen);

  const longestWaits = [...open]
    .sort((a, b) => now - b.openedAt - (now - a.openedAt))
    .map((movement) => ({ movement }));

  const pulledBeds = open
    .filter((movement) => movement.pullExpiresAt !== undefined)
    .map((movement) => {
      const pullExpiresAt = movement.pullExpiresAt as Instant;
      return { movement, unit: destinationUnit(movement, units), expired: pullExpiresAt <= now };
    });

  const inTransit = open
    .filter((movement) => movement.transport !== undefined)
    .map((movement) => ({ movement, leg: transportLeg(movement.transport) }));

  const escalated = open
    .filter((movement) => movement.escalation !== undefined)
    .map((movement) => ({ movement, kind: "escalated" as const }));
  // Candidates for the remaining two kinds, below: nothing still pending, nothing currently
  // accepted, and at least one decline on record — the shape a genuine network refusal AND a
  // withdrawn acceptance both leave (see this function's doc comment for why `referredUnitIds`
  // and `acceptedUnitId` alone cannot tell them apart). `declines`/`unwinds` timing is what does.
  const escalatedIds = new Set(escalated.map((entry) => entry.movement.id));
  const stranded = open
    .filter((movement) => !escalatedIds.has(movement.id))
    .filter(
      (movement) =>
        movement.referredUnitIds.length === 0 && movement.declines.length > 0 && movement.acceptedUnitId === undefined,
    );

  const declinedByAll: { movement: Movement; kind: "declined_by_all" }[] = [];
  const acceptanceWithdrawn: { movement: Movement; kind: "acceptance_withdrawn" }[] = [];
  for (const movement of stranded) {
    const latestDeclineAt = movement.declines.reduce((latest, decline) => Math.max(latest, decline.at), -Infinity);
    const latestWithdrawalAt = movement.unwinds
      .filter((unwind) => unwind.kind === "acceptance_withdrawn")
      .reduce((latest, unwind) => Math.max(latest, unwind.at), -Infinity);
    // Owner decision, 2026-09-17 (item 20 / WF-R2): an acceptance later withdrawn is not
    // "declined by all" — UNLESS a decline landed after that withdrawal, which puts the movement
    // back in front of a network that has since refused it again.
    if (latestWithdrawalAt > latestDeclineAt) {
      acceptanceWithdrawn.push({ movement, kind: "acceptance_withdrawn" });
    } else {
      declinedByAll.push({ movement, kind: "declined_by_all" });
    }
  }

  return {
    takenAt: now,
    longestWaits,
    pulledBeds,
    inTransit,
    placementGoneWrong: [...escalated, ...declinedByAll, ...acceptanceWithdrawn],
  };
}

/**
 * Task 5 (spec item 4): the escalation board — one place showing every patient whose placement
 * has gone wrong. Two groups, computed independently, and a movement can genuinely appear in
 * both: `escalated` is a fact about the RECORD (a human already declared the network exhausted
 * and rang a contact); `nowhereEligible` is a fact about the LIVE network right now
 * (`eligibleCandidatesAmong`, evaluated against every unit so nothing is truncated). WF-009
 * satisfies both at once in the real fixture — it has a recorded escalation and, independently,
 * still has zero eligible wards — and that overlap is correct, not a bug: the two lists answer
 * different questions and neither implies or excludes the other.
 *
 * 🔴 SPEC D4's PROHIBITION IS WITHDRAWN (owner ruling R-2026-09-04-G). What follows DESCRIBES
 * what this function does today; it is no longer an instruction about what it may ever do.
 *
 * As written, this board records and shows. `nowhereEligible` names WHICH movements have nowhere
 * eligible; it does not name which ward almost fit, or what gate is closest to passing.
 * `escalated` resolves `triedUnitIds` to real `Unit` objects purely as a record of what was
 * already tried, not as live candidates.
 *
 * ⚠️ THAT IS A STATEMENT ABOUT THE CURRENT IMPLEMENTATION, NOT A RULE. D4 said "IT SUGGESTS
 * NOTHING — no least-bad options, no ranking of wards the patient does not fit, no near-miss
 * computation", in capitals, with reasoning. It was never an owner ruling: it was inferred, and
 * then obeyed by everyone who met it because it reads exactly like a safety principle. The owner
 * has since ruled the opposite — the board is to match patients to beds — with the boundary that
 * the software never decides, and the final acceptance comes from the users.
 *
 * Nothing here suggests anything YET because the matching work has not been designed, NOT because
 * it is forbidden. A reader must be able to tell those two apart, and D4's wording made that
 * impossible.
 *
 * Scoped to OPEN movements only (`isOpen`) — a closed movement's placement cannot still be
 * "going wrong" in a way this board exists to surface.
 */
export type EscalationBoard = {
  escalated: { movement: Movement; triedUnits: Unit[] }[];
  nowhereEligible: Movement[];
};

export function escalationBoard(movements: Movement[], units: Unit[], now: Instant): EscalationBoard {
  const open = movements.filter(isOpen);

  const escalated = open
    .filter((movement) => movement.escalation !== undefined)
    .map((movement) => {
      const triedUnitIds = movement.escalation?.triedUnitIds ?? [];
      const triedUnits = triedUnitIds
        .map((unitId) => units.find((unit) => unit.id === unitId))
        .filter((unit): unit is Unit => unit !== undefined);
      return { movement, triedUnits };
    });

  // A large, explicit limit — never the default of 3 — so this counts every unit in the
  // network rather than reading a truncated shortlist length as an eligibility count. That
  // exact mistake (counting `eligibleCandidatesAmong(...).length` instead of filtering to
  // `.verdict.eligible`) produced a false "nowhereEligible is empty on the standard night" claim
  // in an earlier draft of this task's own brief — see tests/ward-scenarios.test.ts's comment.
  const nowhereEligible = open.filter(
    (movement) =>
      eligibleCandidatesAmong(movement, units, now, units.length).filter((candidate) => candidate.verdict.eligible)
        .length === 0,
  );

  return { escalated, nowhereEligible };
}

/**
 * Task 7 (spec item 5): patient search — a plain, pure, case-insensitive filter over the OPEN
 * caseload. Pure and synchronous: no clock read, no debounce, no fetch — the page component owns
 * the query state and calls this on every keystroke/select change.
 *
 * `stage` and `edId` are exact-value filters (a coordinator picking a stage or a department wants
 * that stage or that department, not a substring of it); `text` is the only substring match, and
 * it is checked against five real fields: the movement id, `originEdId`, the resolved destination
 * unit's `id` and `name` (via `destinationUnit`, so this reads the same "actual destination" every
 * other screen does — never a mere shortlist candidate), the stage's own display label (via
 * `stageCopy`, so a coordinator can type what the results table actually shows, e.g. "Bed pulled",
 * rather than the raw enum `pulled`), and `owner`. An empty (or whitespace-only) `text` matches
 * every open movement, so the stage/department selects can filter alone with no text typed.
 *
 * ABSOLUTE RULE, enforced first and unconditionally: `isOpen` is applied before anything else.
 * A closed movement can never reach the result set, even when every other field of the query
 * — including the movement's own id typed verbatim — would otherwise match it. Search existing
 * for a patient who has already left the system must read as "not found", not as a stale hit.
 *
 * `patientDisplayNames`, when supplied, adds that movement's display name to the text haystack.
 * Callers that omit it search the same fields as before.
 */
export type MovementSearchQuery = {
  text: string;
  stage?: MovementStage;
  edId?: string;
  /** Movement id → display name. Included in the text haystack only for ids the caller supplies. */
  patientDisplayNames?: Readonly<Record<string, string>>;
};

export function searchMovements(movements: Movement[], units: Unit[], query: MovementSearchQuery): Movement[] {
  const needle = query.text.trim().toLowerCase();

  return movements
    .filter(isOpen)
    .filter((movement) => query.stage === undefined || movement.stage === query.stage)
    .filter((movement) => query.edId === undefined || movement.originEdId === query.edId)
    .filter((movement) => {
      if (needle === "") return true;
      const destination = destinationUnit(movement, units);
      const patientName = query.patientDisplayNames?.[movement.id];
      const haystack = [
        movement.id,
        movement.originEdId,
        destination?.id,
        destination?.name,
        stageCopy[movement.stage].label,
        movement.owner,
        patientName,
      ].filter((value): value is string => value !== undefined && value.length > 0);
      return haystack.some((value) => value.toLowerCase().includes(needle));
    });
}

/**
 * PATIENT SEARCH ACROSS BOTH RECORDS — the owner's requirement, 2026-08-30:
 *
 * > "when I search that patient, there should be some way of the ED psych to see the patient show
 * > up."
 *
 * **`searchMovements` above cannot satisfy that, and the name is why nobody noticed.** It promises
 * a patient search and searches MOVEMENTS — a record that begins when a person is already being
 * moved. Somebody who has been referred and not yet accepted has no movement, so an ED
 * psychiatrist typing their referral could search and be told, truthfully and uselessly, that
 * there is nothing there. A search that returns nothing is indistinguishable from a search for
 * somebody who does not exist.
 *
 * **This is deliberately a NEW function rather than a widening of `searchMovements`.** That one is
 * called by one component and pinned by twenty assertions describing movement behaviour exactly —
 * the `isOpen` rule above all, which must survive untouched. Widening it in place would have
 * re-pointed every one of those assertions at a function that now answers a different question.
 *
 * **THE THIRD KIND IS THE SEAM AND IT IS DELIBERATELY ABSENT.** An admitted patient — somebody in
 * a bed — is an `Admission`, and searching those is the other half of the owner's requirement. It
 * is NOT built here, because the record that makes a patient survive arrival is being changed by
 * another session right now and building against a shape mid-flight is how two sessions produce
 * one broken record. The union below is what lets that drop in as a third member rather than a
 * rewrite: nothing here assumes there are exactly two kinds, and every consumer must already
 * switch on `kind`.
 */
export type PatientSearchResult = { kind: "movement"; movement: Movement } | { kind: "referral"; referral: Referral };

/**
 * The referral half's own text match, kept beside the movement one rather than merged with it.
 *
 * **The fields are not the same and pretending otherwise would be the defect.** A movement has a
 * destination unit, a stage and an owner; a referral has none of those — it has not been accepted
 * by anybody, which is the entire reason it is still a referral. What it does have is where it
 * came from and who it is for.
 *
 * Deliberately NOT matched: `acceptedUnitId`. A referral that has been accepted has a movement,
 * and matching it here would return the same person twice under two kinds, which reads on screen
 * as two patients.
 */
function referralMatches(referral: Referral, needle: string): boolean {
  if (needle === "") return true;
  const haystack = [
    referral.id,
    referral.originSiteCode,
    referral.homeRegion,
    referral.ageBand,
    referral.source,
    referral.urgency,
  ];
  return haystack.some((value) => String(value).toLowerCase().includes(needle));
}

/**
 * Both records, one result list, in a deliberate order: **referrals first.**
 *
 * A referral is somebody waiting for a decision and a movement is somebody whose decision has been
 * made. When an ED psychiatrist searches a patient, the one still waiting is the one they can act
 * on — so it goes at the top rather than being ranked by whatever the fixture order happens to be.
 *
 * **Queued referrals only.** An accepted referral has a movement and would otherwise appear twice;
 * a declined one is a closed request, and surfacing it is the same untruth `isOpen` exists to
 * prevent on the movement side — a search hit for somebody who is no longer in the system.
 *
 * `stage` and `edId` are movement-shaped filters and are honoured on the movement half alone. When
 * either is set, referrals drop out entirely rather than being silently included: a coordinator
 * who has picked a stage is asking a question referrals cannot answer, and returning them anyway
 * would be answering a different question.
 */
export function searchPatients(
  movements: Movement[],
  referralList: Referral[],
  units: Unit[],
  query: MovementSearchQuery,
): PatientSearchResult[] {
  const needle = query.text.trim().toLowerCase();
  const movementHalf: PatientSearchResult[] = searchMovements(movements, units, query).map((movement) => ({
    kind: "movement",
    movement,
  }));

  const movementFilterSet = query.stage !== undefined || query.edId !== undefined;
  if (movementFilterSet) return movementHalf;

  const referralHalf: PatientSearchResult[] = referralList
    // ⚠️ WF-13: `referralState` alone stays "queued" for a referral whose only destination was
    // withdrawn (`RECORD_REFERRER_WITHDRAWAL` never touches `state`, O-17.11). The added
    // `some(isAwaitingAnswer)` excludes a referral with nothing left genuinely awaiting an
    // answer — the referrer took it back, so it is no longer a patient search can act on.
    .filter((referral) => referralState(referral) === "queued" && referral.destinations.some(isAwaitingAnswer))
    .filter((referral) => referralMatches(referral, needle))
    .map((referral) => ({ kind: "referral", referral }));

  return [...referralHalf, ...movementHalf];
}

/** A real, per-movement audit trail built from actual fields — never generic flavour text. */
export function movementTimeline(movement: Movement) {
  const events: Array<{ at: Instant; label: string }> = [{ at: movement.openedAt, label: "Movement opened" }];
  for (const change of movement.statusChanges) {
    events.push({ at: change.at, label: `Legal status changed: ${change.from} → ${change.to} (${change.by})` });
  }
  for (const decline of movement.declines) {
    events.push({ at: decline.at, label: `Declined by referral: ${decline.reason.replace(/_/g, " ")}` });
  }
  if (movement.transport?.acceptedAt !== undefined) {
    events.push({ at: movement.transport.acceptedAt, label: `Transport accepted by ${movement.transport.provider}` });
  }
  if (movement.transport?.enRouteAt !== undefined) {
    events.push({ at: movement.transport.enRouteAt, label: "Transport en route" });
  }
  if (movement.transport?.collectedAt !== undefined) {
    events.push({ at: movement.transport.collectedAt, label: "Patient collected" });
  }
  if (movement.transport?.arrivedAt !== undefined) {
    events.push({ at: movement.transport.arrivedAt, label: "Arrived at destination" });
  }
  if (movement.closure) {
    events.push({ at: movement.closure.at, label: movement.closure.reason });
  }
  return events.sort((a, b) => a.at - b.at);
}

/**
 * Task 9 (spec item 7): the governance board's audit of changes — every urgency change, legal
 * status change, pull release and transport cancellation across ALL movements, not one patient's
 * own timeline (`movementTimeline` above stays scoped to a single movement; this is the
 * statewide counterpart). Newest first, so the most recent decision is the one a reviewer sees
 * without scrolling.
 *
 * ⚠️ **WIDENED FOR TASK 5'S STEP-BACK PAIR (2026-09-04): `"stage_corrected"` and
 * `"acceptance_withdrawn"` join the two `UnwindRecord` kinds already here.** They are the same
 * category of thing — a coordinator's own mutating decision, unwinding some earlier state — so
 * excluding them from this board's audit would be the false-by-omission twin of leaving a real
 * decision off it. The loop below already iterates every `movement.unwinds` entry regardless of
 * kind, so nothing there needed to change to pick them up; only this type did.
 */
export type ChangeAuditEntry = {
  at: Instant;
  movementId: string;
  kind:
    "urgency" | "legal_status" | "pull_released" | "transport_cancelled" | "stage_corrected" | "acceptance_withdrawn";
  by: string;
  detail: string;
};

export function changeAudit(movements: Movement[]): ChangeAuditEntry[] {
  const entries: ChangeAuditEntry[] = [];
  for (const movement of movements) {
    for (const change of movement.statusChanges) {
      entries.push({
        at: change.at,
        movementId: movement.id,
        kind: "legal_status",
        by: change.by,
        detail: `${change.from} → ${change.to} · ${changeReasonLabels[change.reason]}`,
      });
    }
    for (const change of movement.urgencyChanges) {
      entries.push({
        at: change.at,
        movementId: movement.id,
        kind: "urgency",
        by: change.by,
        detail: `Tier ${change.from} → Tier ${change.to} · ${changeReasonLabels[change.reason]}`,
      });
    }
    for (const unwind of movement.unwinds) {
      if (unwind.kind === "stage_corrected" || unwind.kind === "acceptance_withdrawn") {
        /*
         * ✅ **THE DEFERRAL RECORDED HERE IS CLOSED (2026-09-06), AND IT CLOSED BECAUSE THE LABEL
         * MAP IT WAS WAITING FOR NOW EXISTS.** This block used to render the FACT without the
         * specific reason — "Stage corrected", "Acceptance withdrawn" — because `STEP_BACK_REASONS`
         * had no label anywhere, and fabricating one here would have been a second place authoring
         * text for that list. That reasoning was right and is why nothing was invented in the
         * meantime.
         *
         * `stepBackReasonLabels` (`ward-model.ts`, beside the list itself) is now the one place.
         * The audit line therefore says WHY, the same way the two kinds below already do.
         *
         * ⚠️ **THE CAST IS NARROWER THAN THE ONE BELOW AND DELIBERATELY SO.** `UnwindRecord.reason`
         * is a plain `string` because four unwind kinds share one record shape across three
         * different fixed reason lists. The reducer writes a `StepBackReason` into exactly these
         * two kinds (`STEP_BACK_STAGE`, `WITHDRAW_ACCEPTANCE`) and rejects any reason outside
         * `STEP_BACK_REASONS` before writing — so this narrows back to a guarantee the reducer
         * already enforces rather than inventing one.
         *
         * ⚠️ **AND IT STILL NEVER RENDERS A RAW VALUE.** `?? unwind.reason` is NOT used as a
         * fallback: a lookup miss would print `the_patient_situation_changed` on a coordinator's
         * screen, which is the snake_case defect the label map exists to prevent AND leaks the
         * token the content-free guard bans from every label. A miss is impossible while the
         * `Record` is total and the reducer validates membership, and if both of those ever stop
         * being true the honest outcome is the fact without the reason — which is what this falls
         * back to.
         */
        const stepBackLabel = stepBackReasonLabels[unwind.reason as StepBackReason] as string | undefined;
        const fact = unwind.kind === "stage_corrected" ? "Stage corrected" : "Acceptance withdrawn";
        entries.push({
          at: unwind.at,
          movementId: movement.id,
          kind: unwind.kind,
          by: unwind.by,
          detail: stepBackLabel === undefined ? fact : `${fact} · ${stepBackLabel}`,
        });
        continue;
      }
      // `UnwindRecord.reason` is typed as a plain `string` on `Movement` (ward-model.ts) because
      // `RELEASE_PULL` and `CANCEL_TRANSPORT` share one record shape for two different fixed
      // reason lists. The reducer only ever writes a `ReleasePullReason` into a "pull_released"
      // entry and a `CancelTransportReason` into a "transport_cancelled" one (ward-flow-reducer.ts),
      // so this assertion narrows back to that guarantee rather than inventing one — it does not
      // widen what values can reach the screen. Never render `unwind.reason` unlabelled: that is
      // the raw snake_case defect this file's own doc comment on `changeReasonLabels` exists to
      // prevent.
      const reason = unwind.reason as ReleasePullReason | CancelTransportReason;
      entries.push({
        at: unwind.at,
        movementId: movement.id,
        kind: unwind.kind,
        by: unwind.by,
        detail: changeReasonLabels[reason],
      });
    }
  }
  return entries.sort((a, b) => b.at - a.at);
}

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

/**
 * Minutes from referral to a ward accepting, for one movement — `undefined` when that duration
 * cannot be recovered from this record.
 *
 * `Movement.acceptedAt` (added fix round 1, Task 9) is the direct, reliable source: it is
 * stamped by `ACCEPT_IN_PRINCIPLE` (ward-flow-reducer.ts) the instant a unit is accepted, for
 * every acceptance reached from now on. It is preferred whenever present. Before that field
 * existed, the only place an acceptance instant survived was `withdrawnReferrals` — the same
 * reducer branch withdraws every OTHER referred unit in the same update, stamping each
 * withdrawal with `event.now`, so a movement accepted while more than one unit held a live
 * referral leaves the acceptance instant behind as a side effect. That fallback still applies to
 * the hand-authored seed fixture (`ward-movements.ts`), which sets `acceptedUnitId` directly
 * rather than via a dispatched event and so never carries `acceptedAt` — its one recoverable
 * acceptance (WF-006) is only found this way, and the fixture is deliberately never backfilled
 * with an invented `acceptedAt` to manufacture a bigger sample. A movement accepted with only one
 * referred unit and no `acceptedAt` withdraws nothing and leaves no timestamp anywhere in this
 * model — that movement reached acceptance but genuinely has no recoverable "when", so it is
 * excluded here rather than guessed.
 */
function acceptanceDurationMinutes(movement: Movement): number | undefined {
  if (movement.acceptedUnitId === undefined) return undefined;
  if (movement.acceptedAt !== undefined) return movement.acceptedAt - movement.openedAt;
  if (movement.withdrawnReferrals.length === 0) return undefined;
  return movement.withdrawnReferrals[0].at - movement.openedAt;
}

/** Distinct units this movement has ever referred to: currently referred, declined, withdrawn on
 *  acceptance, and the accepted unit itself. `undefined` when the movement has never referred to
 *  any unit, so it never contributes a fabricated zero to an average. */
function unitsContactedCount(movement: Movement): number | undefined {
  const contacted = new Set<string>([
    ...movement.referredUnitIds,
    ...movement.declines.map((decline) => decline.unitId),
    ...movement.withdrawnReferrals.map((withdrawn) => withdrawn.unitId),
  ]);
  if (movement.acceptedUnitId !== undefined) contacted.add(movement.acceptedUnitId);
  return contacted.size === 0 ? undefined : contacted.size;
}

/**
 * Fix round 1 (Task 9): a computed figure alone is not honest without the basis it was drawn
 * from. `sampleSize` is how many movements actually contributed an observation; `population` is
 * how many movements COULD have — every acceptance for the acceptance measure, every movement
 * passed in for the units-contacted measure. A median or average over a small `sampleSize`
 * against a much larger `population` (this fixture: 1 of 27 acceptances) is a guess wearing the
 * clothes of a measurement unless that gap renders next to the number.
 */
export type EffectivenessMeasure = {
  value: number | undefined;
  sampleSize: number;
  population: number;
};

/**
 * The fewest observations a governance figure may be computed from before it is published.
 *
 * **RULED BY THE OWNER, 2026-08-30, first-hand: hide the governance median below FIVE cases.** It
 * was provisional until then — proposed by a session, recorded as provisional so it would be
 * findable rather than inherited — and he has now decided it.
 *
 * ⚠️ **IT IS A DISPLAY THRESHOLD AND NOT A CLINICAL ONE, AND HE AGREED ON THAT BASIS.** Five is a
 * convention borrowed from health reporting — the point at which a middle value stops describing
 * anything real. **It is not derived from this data and it is not a figure from anywhere else.**
 * That was said to him plainly before he agreed, and it is written here because it is exactly the
 * kind of number a later reader assumes was derived from something.
 *
 * Applied to BOTH measures, not only the median that prompted it. They are the same kind of claim,
 * rendered by the same component with the same basis line, and a floor on one alone would publish
 * an average of two beside a suppressed median of four.
 */
export const MINIMUM_EFFECTIVENESS_SAMPLE = 5;

/**
 * Task 9 (spec item 7), D7: the governance board's two live effectiveness numbers. Conservative
 * failure applies to each independently — a measure this cannot compute returns `undefined`,
 * never `0`, because zero minutes to acceptance or zero units contacted both read as a real
 * result rather than as "unknown". Both describe the current synthetic scenario only; nothing
 * here is a claim about the prototype's real-world effectiveness. Both carry their own basis
 * (`EffectivenessMeasure`) so a thin sample is never presented bare.
 *
 * ⚠️ **AND SINCE 2026-08-30 A THIN SAMPLE IS NOT PUBLISHED — BUT THAT DECISION IS NOT MADE HERE.**
 * Owner ruling: below `MINIMUM_EFFECTIVENESS_SAMPLE` a measure reads "Not enough data to compute"
 * rather than printing a figure. **This function keeps computing honestly and `EffectivenessValue`
 * decides what to publish**, because suppressing here would have gutted five unit tests that exist
 * to prove the median arithmetic and the `acceptedAt`-over-fallback preference — they feed it two
 * and three movements on purpose. A publishing rule enforced inside the calculation stops the
 * calculation being testable at the sizes it is interesting at. The board was publishing **"30 min — from 1 of 27 recorded acceptances"**, and the
 * argument he approved is that **the word *Median* means "a typical case" to a clinician, and no
 * caveat printed beside it undoes that** — on the one page whose entire purpose is being trusted
 * about its own limits.
 *
 * ⚠️ **THIS DOES NOT OVERTURN THE DISCLOSURE RULE AND THAT DISTINCTION WAS NEARLY LOST.**
 * `EffectivenessValue`'s comment says a thin sample "must say so in the same breath as the figure,
 * not in a tooltip or a footnote"; one session read its tail clause as saying SUPPRESS and nearly
 * put "your code disagrees with its own rule, shall I fix it?" to the owner — a framing that gets a
 * yes from anybody and would have deleted a repair somebody deliberately made. The clause attaches
 * to a median **rendered bare**. Disclosure stays: `sampleSize` and `population` survive
 * suppression, so the screen still says "from 1 of 27" beside the absence, which is what makes the
 * absence informative rather than merely blank. **This is a floor beneath the rule, not a
 * replacement for it.**
 */
export function effectivenessNumbers(movements: Movement[]): {
  medianMinutesToAcceptance: EffectivenessMeasure;
  averageUnitsContacted: EffectivenessMeasure;
} {
  const totalAcceptances = movements.filter((movement) => movement.acceptedUnitId !== undefined).length;
  const acceptanceDurations = movements
    .map((movement) => acceptanceDurationMinutes(movement))
    .filter((minutes): minutes is number => minutes !== undefined);

  const contactedCounts = movements
    .map((movement) => unitsContactedCount(movement))
    .filter((count): count is number => count !== undefined);

  const averageUnitsContacted =
    contactedCounts.length === 0
      ? undefined
      : contactedCounts.reduce((total, count) => total + count, 0) / contactedCounts.length;

  return {
    medianMinutesToAcceptance: {
      value: median(acceptanceDurations),
      sampleSize: acceptanceDurations.length,
      population: totalAcceptances,
    },
    averageUnitsContacted: {
      value: averageUnitsContacted,
      sampleSize: contactedCounts.length,
      population: movements.length,
    },
  };
}

/** Decline reasons that waitlist instead of ending the referral. */
export { WAITLIST_INSTEAD_OF_DECLINE_REASONS, GENDER_MISMATCH_DECLINE_REASON };

export function isArrivalLate(
  movement: Pick<Movement, "arrivalDetails" | "stage" | "arrivalLateNotifiedAt">,
  now: Instant,
): boolean {
  return isArrivalLateClock(movement.arrivalDetails?.estimatedArrivalAt, movement.stage, now);
}

export function medicalClearanceWarning(movement: Pick<Movement, "medicalClearance">): string | null {
  if (movement.medicalClearance === undefined) return null;
  if (movement.medicalClearance.cleared) return null;
  return "Not medically cleared — warning only; hold and collection may continue.";
}

export function leaveBedNeedsOpenWarning(leaveBed: LeaveBed, now: Instant): boolean {
  return leaveBedNeedsOpenWarningClock(leaveBed.confirmedAt, leaveBed.openWarningAt, now);
}

export function expectFlagKindFor(
  legalStatus: Movement["legalStatus"],
  openedAt: Instant,
  now: Instant,
): "voluntary_48h" | "involuntary_7d" | null {
  const age = now - openedAt;
  if (legalStatus === "Voluntary") {
    return age >= EXPECT_FLAG_VOLUNTARY_MINUTES ? "voluntary_48h" : null;
  }
  return age >= EXPECT_FLAG_INVOLUNTARY_MINUTES ? "involuntary_7d" : null;
}

/**
 * Legal mismatch between person and ward. Flag only — override continues.
 * involuntary on voluntary-only (unauthorised) ward, or voluntary on locked-only ward.
 */
export function legalMismatchKind(
  movement: Pick<Movement, "legalStatus" | "security">,
  unit: Unit,
): "involuntary_on_voluntary_ward" | "voluntary_on_locked_ward" | null {
  const involuntary = requiresAuthorisedDestination(movement.legalStatus);
  if (involuntary && !unit.authorised) return "involuntary_on_voluntary_ward";
  if (movement.legalStatus === "Voluntary" && unitHasLockedBeds(unit) && !unitHasOpenBeds(unit)) {
    return "voluntary_on_locked_ward";
  }
  return null;
}

/**
 * Infection needing a single room hides shared bays; a closed bay is removed from offer.
 * Staffing / high acuity / cleaning stay banners only and are not modelled here.
 */
export function unitBedOfferBlocked(
  unit: Unit,
  options?: { bayId?: string; isSharedBay?: boolean },
): { blocked: boolean; reason: string | null } {
  if (unit.infectionNeedsSingleRoom && options?.isSharedBay) {
    return { blocked: true, reason: "Infection control: shared bays are hidden; offer a single room." };
  }
  if (options?.bayId && unit.closedBayIds?.includes(options.bayId)) {
    return { blocked: true, reason: `Bay ${options.bayId} is closed.` };
  }
  return { blocked: false, reason: null };
}
