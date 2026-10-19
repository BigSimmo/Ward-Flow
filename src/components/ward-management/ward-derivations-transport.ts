/**
 * Transport and bed-holding derivations: whether a movement needs transport, the transport job's
 * status and leg, a unit's capacity figures and the ED medical-trip bed-retention decision. Split
 * out of `ward-derivations.ts`, which re-exports everything here.
 */
import {
  type BedRelease,
  ED_MEDICAL_BED_RELEASE_THRESHOLD_HOURS,
  MOVEMENT_STAGES,
  type Movement,
  type TransportJob,
  type Unit,
} from "@/components/ward-management/ward-model";
import { boundedBedAvailability } from "@/components/ward-management/ward-ready-beds";
import { siteByCode } from "@/components/ward-management/ward-sites";

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
  const { effectiveEmpty, available, held } = boundedBedAvailability(unit);
  const notEmpty = Math.max(unit.beds - effectiveEmpty, 0);
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
