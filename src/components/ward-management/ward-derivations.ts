/**
 * Pure derivations shared by the three Ward Flow view files (console, modes, network). Nothing
 * here depends on React — no hooks, no browser APIs — so this module carries no "use client"
 * directive and cannot itself become a client/server boundary problem. It is the single place
 * these three files can drift out of sync if a formula changes, so a change here changes every
 * consumer at once rather than needing three coordinated edits.
 */
import { currentLegalDueAt } from "@/components/ward-management/legal-forms/legal-form-progression";
import {
  INBOX_CATEGORIES,
  type InboxItemKind,
  STAGE_TRANSITION_BLOCKERS,
} from "@/components/ward-management/ward-flow-reducer";
import { DECLINE_REASON_LABELS, isAwaitingAnswer, referralState } from "@/components/ward-management/ward-referrals";
import { CalendarClock, CircleAlert, Truck, type LucideIcon } from "lucide-react";

import {
  bedIsOccupied,
  plannedAdmissionIsOverdue,
  type Admission,
  type PlannedAdmission,
} from "@/components/ward-management/ward-admissions";
import { boundedBedAvailability } from "@/components/ward-management/ward-ready-beds";
import { bedHoldLapsed } from "@/components/ward-management/ward-bed-hold";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import {
  formatElapsed,
  formatInstantWithDay,
  formatRemaining,
  splitDuration,
  type Instant,
  isClockBreached,
  minutesUntil,
} from "@/components/ward-management/ward-clock";
import {
  eligibility,
  requiresAuthorisedDestination,
  type EligibilityGate,
} from "@/components/ward-management/ward-eligibility";
import {
  MOVEMENT_STAGES,
  PARALLEL_REFERRAL_CAP,
  type BedReleaseState,
  type Decline,
  type HealthService,
  type LeaveBed,
  type Movement,
  type MovementStage,
  type Override,
  type Referral,
  type Unit,
} from "@/components/ward-management/ward-model";
import { allEmergencyDepartments, siteByCode } from "@/components/ward-management/ward-sites";
import { unitHasOpenBeds } from "@/components/ward-management/ward-bed-designation";
import {
  EXPECT_FLAG_INVOLUNTARY_MINUTES,
  EXPECT_FLAG_VOLUNTARY_MINUTES,
  WAITLIST_INSTEAD_OF_DECLINE_REASONS,
  isArrivalLate as isArrivalLateClock,
  leaveBedNeedsOpenWarning as leaveBedNeedsOpenWarningClock,
} from "@/components/ward-management/ward-legal-clock";
import { REFERRABLE_MOVEMENT_STAGES } from "@/components/ward-management/ward-flow-reducer";

/** UI-only role concept; not part of the domain model. */
export type WardRole = "flow" | "ed" | "ward";

import { stageCopy } from "@/components/ward-management/ward-stage-copy";
import { supportNotificationInboxItems } from "@/components/ward-management/ward-support-notifications";
import { INFORMATIONAL_GATES, eligibleCandidatesAmong } from "./ward-derivations-shortlist";
import { type TransportLeg, transportLeg } from "./ward-derivations-transport";
export {
  orphanedTransport,
  transportNeedState,
  unitSiteCode,
  transportStatusLabel,
  transportLeg,
  unitCapacity,
  edMedicalTripBedRetention,
} from "./ward-derivations-transport";
export type { TransportLeg, BedRetentionBasis } from "./ward-derivations-transport";
export {
  restrictionNotice,
  eligibilityWarning,
  INFORMATIONAL_GATES,
  needsNoRecordedReason,
  shortlistCandidates,
  blockingGate,
  eligibleCandidatesAmong,
} from "./ward-derivations-shortlist";
import { plannedInitialsLabel } from "./ward-flow-demo-storage-constants";
export type { ShortlistCandidate } from "./ward-derivations-shortlist";
export { changeAudit, MINIMUM_EFFECTIVENESS_SAMPLE, effectivenessNumbers } from "./ward-derivations-records";
export type { ChangeAuditEntry } from "./ward-derivations-records";
export { stageCopy };

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

/** A real, per-movement audit trail built from actual fields — never generic flavour text. */
export function movementTimeline(movement: Movement) {
  const events: Array<{ at: Instant; label: string }> = [{ at: movement.openedAt, label: "Movement opened" }];
  for (const change of movement.statusChanges) {
    events.push({ at: change.at, label: `Legal status changed: ${change.from} → ${change.to} (${change.by})` });
  }
  for (const decline of movement.declines) {
    events.push({
      at: decline.at,
      label: `Declined by referral: ${DECLINE_REASON_LABELS[decline.reason] ?? decline.reason}`,
    });
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
  const counts = new Map<MovementStage, number>();
  for (const movement of movements) {
    counts.set(movement.stage, (counts.get(movement.stage) ?? 0) + 1);
  }
  return MOVEMENT_STAGES.map((id) => ({
    id,
    ...stageCopy[id],
    count: counts.get(id) ?? 0,
  }));
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

const edServiceById = new Map<string, HealthService | undefined>(
  allEmergencyDepartments().map((candidate) => [candidate.id, siteByCode(candidate.siteCode)?.service]),
);

const unitMapCache = new WeakMap<readonly Unit[], Map<string, Unit>>();

function getUnitByIdMap(units: readonly Unit[]): Map<string, Unit> {
  let cached = unitMapCache.get(units);
  if (!cached) {
    cached = new Map(units.map((unit) => [unit.id, unit]));
    unitMapCache.set(units, cached);
  }
  return cached;
}

/**
 * The health service that owns the ED a movement originated in. This is the origin service,
 * not the patient's catchment — catchment is determined by where a patient lives, not where
 * they presented (see the glossary and Accepted ADR 3). `Movement` has no catchment field;
 * adding one is Phase 2 model work, not a derivation this module can safely invent.
 */
export function movementHealthService(movement: Movement): HealthService | undefined {
  return edServiceById.get(movement.originEdId);
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
  if (movement.admissionId !== undefined) return true;
  if (movement.closure !== undefined) return false;
  return movement.stage === "pulled" || movement.stage === "handover_ready" || movement.stage === "moving";
}

/**
 * A movement whose transport was stopped mid-journey but whose held bed has not yet been released.
 * Surfaced to clinicians so the held bed is visible and can be released.
 */
export function isStoppedTransportAwaitingRelease(movement?: Movement | null): boolean {
  if (!movement) return false;
  return (
    movement.transport?.stoppedAt !== undefined &&
    (movement.blocker === STAGE_TRANSITION_BLOCKERS.transportStoppedAwaitingRelease ||
      movement.admissionId !== undefined)
  );
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
  const unit = getUnitByIdMap(units).get(movement.acceptedUnitId);
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
  return `This patient cannot be referred while the journey is ${stageCopy[movement.stage].label.toLowerCase()} — referral is only available while placement is requested or a destination is under review.`;
}

/**
 * The unit a movement is *actually* recorded against — accepted, or else the first live
 * referral. Never falls back to a different unit, and never returns a merely-suggested
 * candidate. When this is `undefined`, no destination is shown (Audit 1, Josh 20 Oct: no
 * "Suggested destination").
 *
 * Whole-branch review Critical 1: takes the caller's own `units` rather than resolving via
 * `unitById` (the frozen `ward-sites.ts` fixture). Every live surface must pass the provider's
 * live `units` here — a ward that has just dropped its own allocatable beds to zero, or received
 * a patient, must be reflected the instant this is called next, not only at first paint.
 */
export function destinationUnit(movement: Movement, units: Unit[]): Unit | undefined {
  const id = movement.acceptedUnitId ?? movement.referredUnitIds[0];
  return id ? getUnitByIdMap(units).get(id) : undefined;
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
 * Re-exported from `ward-eligibility.ts`, where this function now lives — see its doc comment
 * there for what it does and for why it moved (fix round C, F1 / review finding C1: importing it
 * from THIS module pulled the bed-release model into referral matching's transitive
 * import graph and broke the D15 contract test). Kept exported here so the six call sites that
 * already import it from `ward-derivations` need no edit.
 */
export { candidateReason } from "@/components/ward-management/ward-eligibility";

type InboxTone = "danger" | "warning";
export type InboxItem = {
  id: string;
  tone: InboxTone;
  icon: LucideIcon;
  title: string;
  detail: string;
  owner: string;
  movementId: string;
  /**
   * A planned admission row's own booking, for the patient resolver to name a linked person. The
   * row has no movement, so `movementId` is empty and the booking id is never shown.
   */
  plannedAdmission?: PlannedAdmission;
  /** The person's label when the booking holds initials only, such as "Initials RK". */
  personLabel?: string;
  /** Where the row opens when it is not about a movement: a planned admission opens Capacity. */
  href?: string;
  /**
   * Set on a discharge notification row: the discharged stay it is about. The Tasks drawer opens
   * that stay's checklist on the discharges board instead of the movement page.
   */
  admissionId?: string;
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
  /**
   * When this row's recorded time falls or fell due, where the record holds one: a legal form's
   * typed due time, a bed hold's expiry, a decision target's due time. Absent otherwise. Read by
   * the Tasks "Due first" sort (stream A, 9 Oct 2026); never used to decide whether a row exists.
   */
  dueAt?: Instant;
  /**
   * When this occurrence of the row began, where the record holds it (stream A, 9 Oct 2026): a
   * snooze or ownership written before it belongs to an earlier occurrence on the same movement
   * and is ignored. Set from `inboxOccurrenceSince`, which the reducer reads too.
   */
  since?: Instant;
  /**
   * Audit F-19: set on a duplicate bed request row, which is about a person rather than a movement
   * (`movementId` is empty). Alerts names the person from it. Coordinator only (FD-23).
   */
  personId?: string;
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
/**
 * Optional fourth argument for `buildActionInbox`: support-notification fields (#159) plus planned
 * admissions (stream D). One records object carries both; call sites that need either set of rows
 * pass that object rather than two positional extras. Every field is optional so a planned-only
 * caller need not invent empty support-notification collections.
 */
export type ActionInboxRecords = Partial<Omit<Parameters<typeof supportNotificationInboxItems>[0], "units">> & {
  plannedAdmissions?: readonly PlannedAdmission[];
  /**
   * Top 25 item 12: when set, a "Transport awaiting departure" row
   * whose transport was accepted at least this many minutes ago is named a stuck handover for the
   * sending team. Callers pass the configured transport booked target
   * (`configuration.transportBookedTargetMinutes`), never a separate figure. Left out, the row is
   * exactly as before.
   */
  stuckHandoverMinutes?: number;
};

export function buildActionInbox(
  movements: Movement[],
  now: Instant,
  units: Unit[],
  /** Optional: planned admissions and/or support-notification fields for extra inbox rows. */
  records?: ActionInboxRecords,
): InboxItem[] {
  const items: InboxItem[] = [];
  const plannedAdmissions = records?.plannedAdmissions ?? [];

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

  // A form with no current deadline is never breached and contributes nothing here; `undefined`
  // must never reach `clockState`'s arithmetic. As of the 2026-08-23 product-owner correction that
  // is every Form 1A and every Form 3B in this model — the record carries no deadline for them.
  // Stated that way deliberately: what this model holds is a fact about the record, whereas what
  // the Mental Health Act does or does not require is a legal claim this prototype is not entitled
  // to make in either direction. The question was settled for the 3B by the clinician (Task 6A:
  // "It is just counting how long they have been in ED determining priority. So counting up") and
  // for the 1A by the product owner on 2026-08-23. See `LegalForm`'s doc comment in ward-model.ts.
  // Only the typed expiry still in force can create current work. Ended forms remain history.
  for (const movement of movements) {
    const dueAt = currentLegalDueAt(movement);
    if (dueAt === undefined || !isClockBreached(dueAt, now)) continue;
    items.push({
      id: `${INBOX_CATEGORIES.legal_timing_breached.idPrefix}${movement.id}`,
      kind: INBOX_CATEGORIES.legal_timing_breached.kind,
      tone: "danger",
      icon: CircleAlert,
      title: "Legal due time passed",
      detail: `${movement.id} · ${formatRemaining(minutesUntil(dueAt, now))}`,
      owner: movement.owner,
      movementId: movement.id,
      dueAt,
      since: dueAt,
    });
  }

  const expiredBedPulls = movements.filter(
    (movement) => movement.stage === "pulled" && bedHoldLapsed(movement.pullExpiresAt, now),
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
      dueAt: pullExpiresAt,
      since: pullExpiresAt,
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
    const acceptedAt = movement.transport.acceptedAt as Instant;
    const stuckAfter = records?.stuckHandoverMinutes;
    const waited = now - acceptedAt;
    // Same id, kind and tone either way, so counts, snoozes and act-now figures never move with
    // the flag: only the wording and the owner say the handover is stuck.
    const stuck = stuckAfter !== undefined && waited >= stuckAfter;
    items.push({
      id: `${INBOX_CATEGORIES.transport_awaiting_departure.idPrefix}${movement.id}`,
      kind: INBOX_CATEGORIES.transport_awaiting_departure.kind,
      tone: "warning",
      icon: Truck,
      title: stuck ? "Handover waiting too long" : "Transport awaiting departure",
      detail: stuck
        ? `${movement.id} · transport accepted ${formatInstantWithDay(acceptedAt, now)}, not left after ${splitDuration(waited)}. Target ${splitDuration(stuckAfter)}`
        : `${movement.id} · accepted ${formatInstantWithDay(acceptedAt, now)}`,
      owner: stuck ? "Sending team" : movement.owner,
      movementId: movement.id,
      since: movement.transport.acceptedAt,
    });
  }

  // Stream D: a booked planned admission whose expected arrival has passed with no arrival
  // recorded. There is no movement behind the row — leave `movementId` empty so movement-only
  // surfaces skip it, and carry the booking on `plannedAdmission`.
  for (const planned of plannedAdmissions.filter((booking) => plannedAdmissionIsOverdue(booking, now))) {
    const unit = getUnitByIdMap(units).get(planned.unitId);
    items.push({
      id: `${INBOX_CATEGORIES.planned_arrival_overdue.idPrefix}${planned.id}`,
      kind: INBOX_CATEGORIES.planned_arrival_overdue.kind,
      tone: "warning",
      icon: CalendarClock,
      title: "Planned arrival not recorded",
      detail: `${unit?.name ?? "Ward not recorded"} · expected ${formatInstantWithDay(planned.expectedArrivalAt, now)}, ${formatRemaining(minutesUntil(planned.expectedArrivalAt, now))}`,
      owner: unit?.name ?? "Ward",
      movementId: "",
      plannedAdmission: planned,
      // The reducer reads the same start for snoozes and owners (`inboxRowSince`).
      since: planned.expectedArrivalAt,
      // `WARD_CAPACITY_HREF`, spelled out: ward-nav reaches this file through ward-facade.
      href: "/ward-flow/capacity",
      ...(planned.initials !== null ? { personLabel: plannedInitialsLabel(planned.initials) } : {}),
    });
  }

  // Clinical owner ruling (14 Oct 2026): no eligible bed keeps the patient on the waitlist with a
  // visible flag and notifies the bed coordinator. It never drops, closes or releases the movement;
  // this row only surfaces the fact for the coordinator, like every other category here.
  const noEligibleBed = movements.filter(
    (movement) =>
      isOpen(movement) &&
      // Only people still waiting for a placement (the waitlist), never a journey already past it.
      (REFERRABLE_MOVEMENT_STAGES as readonly string[]).includes(movement.stage) &&
      movement.acceptedUnitId === undefined &&
      units.length > 0 &&
      // A ward refused ONLY because its capacity figure is stale is not "no eligible bed": the bed may
      // well be there. Such a ward keeps the movement off this row, so a stale feed cannot flood the
      // coordinator with false "nowhere" notices. The same goes for a ward that failed only an
      // informational gate (an earlier decline): the coordinator may still refer there with nothing
      // recorded, so the network is not out of beds.
      eligibleCandidatesAmong(movement, units, now, units.length).every((candidate) =>
        candidate.verdict.gates.some(
          (gate) => !gate.pass && gate.gate !== "capacity_freshness" && !INFORMATIONAL_GATES.includes(gate.gate),
        ),
      ),
  );
  for (const movement of noEligibleBed) {
    items.push({
      id: `${INBOX_CATEGORIES.no_eligible_bed.idPrefix}${movement.id}`,
      kind: INBOX_CATEGORIES.no_eligible_bed.kind,
      tone: "danger",
      icon: CircleAlert,
      title: "No eligible bed: shown to the bed coordinator",
      detail: "No ward in the network is currently eligible; the patient stays on the waitlist",
      owner: "Bed coordinator",
      movementId: movement.id,
    });
  }

  // Advisory carer/PSP/MHAS notifications still to record for recent involuntary moves. These are
  // about COMPLETED moves, so they read every movement in `records`, not the caller's open list.
  // Only when the caller passed the notification record fields — `{ plannedAdmissions }` alone is
  // enough for overdue bookings and must not be treated as a support-notification source.
  if (records?.movements && records.admissions && records.patients && records.referrals) {
    items.push(
      ...supportNotificationInboxItems(
        {
          movements: records.movements,
          admissions: records.admissions,
          patients: records.patients,
          referrals: records.referrals,
          supportNotifications: records.supportNotifications,
          units,
        },
        now,
      ),
    );
  }

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
 * `placementGoneWrong` names exactly four situations, none of them a legal claim:
 * - `"escalated"` — the movement carries a recorded `escalation`: a human already declared the
 *   referral network exhausted and rang the state bed coordination desk.
 * - `"declined_by_all"` — the movement has a decline on record, nothing still pending, and no
 *   unit has accepted (`referredUnitIds` empty, `declines` non-empty, `acceptedUnitId`
 *   undefined). `referredUnitIds` alone is not enough: `ACCEPT_IN_PRINCIPLE`
 *   (`ward-flow-reducer.ts`) ALSO empties it, the instant a unit says yes, on a movement that may
 *   already carry an earlier decline from a ward that said no first. Read without the
 *   `acceptedUnitId` check, an accepted movement with one prior decline satisfied the same two
 *   conditions `case "DECLINE"` produces and was reported as refused by every ward on the network
 *   — `case "DECLINE"` only ever removes a unit from `referredUnitIds` in the same update
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
 * - `"transport_stopped_awaiting_release"` — transport was stopped while the movement still holds
 *   its bed, and the journey remains visible until that bed is released.
 *
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
    kind: "escalated" | "declined_by_all" | "acceptance_withdrawn" | "transport_stopped_awaiting_release";
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
  return movements.flatMap((movement) =>
    movement.declines
      .filter(
        (decline) =>
          !(WAITLIST_INSTEAD_OF_DECLINE_REASONS as readonly string[]).includes(decline.reason) &&
          !decline.reason.includes("waitlist"),
      )
      .map((decline) => ({ movement, decline })),
  );
}

export function handoverSnapshot(movements: Movement[], units: Unit[], now: Instant): HandoverSnapshot {
  const open = movements.filter(isOpen);

  const longestWaits = [...open]
    .sort((a, b) => now - b.openedAt - (now - a.openedAt))
    .map((movement) => ({ movement }));

  const stoppedAwaitingRelease = movements.filter(isStoppedTransportAwaitingRelease);
  const openIds = new Set(open.map((openMovement) => openMovement.id));

  const pulledBedCandidates = [...open, ...stoppedAwaitingRelease.filter((movement) => !openIds.has(movement.id))];
  const pulledBeds = pulledBedCandidates
    .filter((movement) => movement.pullExpiresAt !== undefined)
    .map((movement) => {
      const pullExpiresAt = movement.pullExpiresAt as Instant;
      // A stopped journey is no longer in transit, so its held bed can still lapse.
      const stopped = movement.closure !== undefined || movement.transport?.cancelledAt !== undefined;
      const isCollected = !stopped && (movement.stage === "moving" || movement.transport?.collectedAt !== undefined);
      return {
        movement,
        unit: destinationUnit(movement, units),
        expired: !isCollected && pullExpiresAt <= now,
      };
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
    const latestRequestWithdrawalAt = movement.withdrawnReferrals.reduce(
      (latest, w) => Math.max(latest, w.at),
      -Infinity,
    );
    // Owner decision, 2026-09-17 (item 20 / WF-R2): an acceptance later withdrawn is not
    // "declined by all" — UNLESS a decline landed after that withdrawal, which puts the movement
    // back in front of a network that has since refused it again.
    // A3-8 / A3-9: Similarly, if a request to a destination was withdrawn (e.g. Ward A declined
    // and Ward B was withdrawn by the referrer), the movement was NOT declined by all.
    if (latestWithdrawalAt > latestDeclineAt) {
      acceptanceWithdrawn.push({ movement, kind: "acceptance_withdrawn" });
    } else if (latestRequestWithdrawalAt >= latestDeclineAt) {
      // A withdrawal at or newer than the last decline is not a network refusal.
      continue;
    } else {
      declinedByAll.push({ movement, kind: "declined_by_all" });
    }
  }

  const stoppedGoneWrong = stoppedAwaitingRelease.map((movement) => ({
    movement,
    kind: "transport_stopped_awaiting_release" as const,
  }));

  return {
    takenAt: now,
    longestWaits,
    pulledBeds,
    inTransit,
    placementGoneWrong: [...escalated, ...declinedByAll, ...acceptanceWithdrawn, ...stoppedGoneWrong],
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
  const unitMap = getUnitByIdMap(units);

  const escalated = open
    .filter((movement) => movement.escalation !== undefined)
    .map((movement) => {
      const triedUnitIds = movement.escalation?.triedUnitIds ?? [];
      const triedUnits = triedUnitIds
        .map((unitId) => unitMap.get(unitId))
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
/**
 * An accepted referral with nothing yet built from it (audit A3-5). Accepting pulls no bed and
 * creates no movement, so until the ward starts the placement the referral is the only record of
 * that person. Linked by the referral's own id only (D-14: no patient link is read here). A
 * finished journey keeps its movement or admission, so it never comes back as a waiting referral.
 * Only a ward's acceptance waits for a bed: an ED psychiatry or community acceptance is complete
 * without one (Codex review, #547). The Patients page shows these in its census as Bed found; the
 * header search uses this.
 */
export function acceptedReferralAwaitingMovement(
  referral: Referral,
  movements: readonly Pick<Movement, "referralId">[],
  admissions: readonly Pick<Admission, "referralId">[],
): boolean {
  if (referralState(referral) !== "accepted") return false;
  const wardAccepted = referral.destinations.some(
    (addressing) => addressing.state === "accepted" && addressing.destination.kind === "psychiatric_ward",
  );
  if (!wardAccepted) return false;
  const linked = (record: { referralId?: string | null }) => record.referralId === referral.id;
  return !movements.some(linked) && !admissions.some(linked);
}

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
    // ⚠️ `referralState` alone stays "queued" for a referral whose only destination was
    // withdrawn (`RECORD_REFERRER_WITHDRAWAL` never touches `state`, O-17.11). The added
    // `some(isAwaitingAnswer)` excludes a referral with nothing left genuinely awaiting an
    // answer — the referrer took it back, so it is no longer a patient search can act on.
    .filter((referral) => referralState(referral) === "queued" && referral.destinations.some(isAwaitingAnswer))
    .filter((referral) => referralMatches(referral, needle))
    .map((referral) => ({ kind: "referral", referral }));

  return [...referralHalf, ...movementHalf];
}

export function isArrivalLate(
  movement: Pick<Movement, "arrivalDetails" | "stage" | "arrivalLateNotifiedAt">,
  now: Instant,
): boolean {
  return isArrivalLateClock(movement.arrivalDetails?.estimatedArrivalAt, movement.stage, now);
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

function toInstantMinutes(val: Instant | string): number {
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  const parsed = Date.parse(val);
  if (Number.isNaN(parsed)) return 0;
  return Math.floor(parsed / 60_000);
}

/**
 * Top 25 items 1 and 5: occupied stays whose ward's own expected discharge falls from now to the
 * discharge prep window ahead (`CLINICAL_VALUES.dischargePrepWindow`). The ward discharge prep
 * prompt and the discharge support notices both read this one list, so they always agree.
 */
export function deriveAfternoonDischarges(admissions: readonly Admission[], now: Instant | string): Admission[] {
  const nowMin = toInstantMinutes(now);
  const windowMinutes = CLINICAL_VALUES.dischargePrepWindow.value;
  return admissions.filter((adm) => {
    if (!bedIsOccupied(adm) || adm.expectedDischargeAt === null || !Number.isFinite(adm.expectedDischargeAt)) {
      return false;
    }
    const diff = adm.expectedDischargeAt - nowMin;
    return diff >= 0 && diff <= windowMinutes;
  });
}

interface CompatibleWardCandidate {
  unit: Unit;
  availableNow: number;
  failingGates: EligibilityGate[];
  isOutOfArea: boolean;
}

/**
 * Every ward not yet asked that passes every eligibility gate, in a fixed neutral order: health
 * service, then ward name.
 *
 * Audit 1, Josh 20 Oct (CS-03, NB-3): this replaces `deriveTopCompatibleWards`, which ranked
 * in-area first, then most free beds, and cut the list to three. That was a "best match" pick and
 * hid other eligible wards. Nothing here ranks or caps; the coordinator chooses.
 */
function eligibleWardsInFixedOrder(
  movement: Movement,
  units: readonly Unit[],
  now: Instant,
): CompatibleWardCandidate[] {
  const originService = movementHealthService(movement);
  const serviceOf = (unit: Unit) => siteByCode(unit.siteCode)?.service ?? "";
  return units
    .filter((u) => !movement.referredUnitIds.includes(u.id))
    .map((unit) => {
      const check = eligibility(movement, unit, now);
      // A previous decline is informational: the ward may be referred again without an override.
      const failingGates = (check.gates ?? [])
        .filter((g) => !g.pass && !INFORMATIONAL_GATES.includes(g.gate))
        .map((g) => g.gate);
      return {
        unit,
        availableNow: boundedBedAvailability(unit).available,
        failingGates,
        isOutOfArea: Boolean(originService && siteByCode(unit.siteCode)?.service !== originService),
      };
    })
    .filter((entry) => entry.failingGates.length === 0)
    .sort((a, b) => serviceOf(a.unit).localeCompare(serviceOf(b.unit)) || a.unit.name.localeCompare(b.unit.name));
}

export interface NextWardsAfterRefusal {
  /** The most recent decline, so the screen can say why the last ward said no. */
  latestDecline: Decline;
  /** Every eligible ward not yet asked, in fixed order (health service, then name). Not ranked. */
  candidates: CompatibleWardCandidate[];
}

/**
 * Wards not yet asked after a refusal (Top 25 item 3). Once a ward has declined and none has
 * accepted, this lists every ward nobody has asked yet that passes every eligibility gate, in a
 * fixed neutral order with no cap (Audit 1, Josh 20 Oct). A ward that declined or still holds a
 * live request is left out. The coordinator still chooses and refers with `REFER_TO_UNITS`.
 */
export function deriveNextWardsAfterRefusal(
  movement: Movement,
  units: readonly Unit[],
  now: Instant,
): NextWardsAfterRefusal | undefined {
  // A ward that waitlisted (no bed yet) still holds a live request, so it is not a refusal.
  const refusals = movement.declines.filter(
    (decline) => !(WAITLIST_INSTEAD_OF_DECLINE_REASONS as readonly string[]).includes(decline.reason),
  );
  if (refusals.length === 0 || movement.acceptedUnitId !== undefined) return undefined;
  const latestDecline = refusals.reduce((latest, decline) => (decline.at > latest.at ? decline : latest));
  const asked = new Set([...movement.declines.map((decline) => decline.unitId), ...movement.referredUnitIds]);
  const notAsked = units.filter((unit) => !asked.has(unit.id));
  return { latestDecline, candidates: eligibleWardsInFixedOrder(movement, notAsked, now) };
}
