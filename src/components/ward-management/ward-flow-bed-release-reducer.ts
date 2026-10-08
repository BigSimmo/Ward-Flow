import { BED_PREPARATION_NOTES, BED_RELEASE_BLOCKERS } from "./ward-change-reasons";
import { BED_RELEASE_WAITING_ON, type Unit, type BedRelease } from "./ward-model";
import type { Admission } from "./ward-admissions";
import type { AuditDecision } from "./ward-audit";
import type { WardFlowEvent } from "./ward-flow-events";
import type { WardFlowState } from "./ward-flow-reducer";

type BedReleaseEvent = Extract<
  WardFlowEvent,
  {
    type:
      | "FLAG_BED_RELEASE"
      | "CONFIRM_BED_RELEASE"
      | "REVERT_BED_RELEASE"
      | "BLOCK_BED_RELEASE"
      | "CLEAR_BED_RELEASE_BLOCK"
      | "SET_BED_PREPARATION"
      | "RELEASE_BED";
  }
>;
type BedReleaseOperations = {
  reject: (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState;
  findUnit: (state: WardFlowState, id: string) => Unit | undefined;
  findAdmission: (state: WardFlowState, id: string) => Admission | undefined;
  findBedRelease: (state: WardFlowState, id: string) => BedRelease | undefined;
  replaceUnit: (state: WardFlowState, id: string, next: Unit) => WardFlowState;
  replaceBedRelease: (state: WardFlowState, id: string, next: BedRelease) => WardFlowState;
};
type ScopedRelease = { release: BedRelease } | { rejected: WardFlowState };
type FlaggedStay = { unit: Unit; admission: Admission } | { rejected: WardFlowState };

/** Role permission, resource revision and audit boundaries remain at the main reducer entry.
 * These handlers retain named-stay checks, refusal order and the shared audit decision. */
export function reduceBedReleaseEvent(
  state: WardFlowState,
  event: BedReleaseEvent,
  decision: AuditDecision,
  operations: BedReleaseOperations,
): WardFlowState {
  switch (event.type) {
    case "FLAG_BED_RELEASE":
      return flagRelease(state, event, decision, operations);
    case "CONFIRM_BED_RELEASE":
      return confirmRelease(state, event, decision, operations);
    case "REVERT_BED_RELEASE":
      return revertRelease(state, event, decision, operations);
    case "BLOCK_BED_RELEASE":
      return blockRelease(state, event, decision, operations);
    case "CLEAR_BED_RELEASE_BLOCK":
      return clearReleaseBlock(state, event, decision, operations);
    case "SET_BED_PREPARATION":
      return setPreparation(state, event, decision, operations);
    case "RELEASE_BED":
      return releaseBed(state, event, decision, operations);
  }
}
function resolveRelease(
  state: WardFlowState,
  event: Exclude<BedReleaseEvent, { type: "FLAG_BED_RELEASE" }>,
  operations: BedReleaseOperations,
): ScopedRelease {
  const release = operations.findBedRelease(state, event.releaseId);
  if (!release) return { rejected: operations.reject(state, event, `no bed release found for id ${event.releaseId}`) };
  if (event.actingUnitId !== release.unitId)
    return {
      rejected: operations.reject(
        state,
        event,
        `${event.type} was raised acting as unit ${event.actingUnitId} but release ${release.id} belongs to unit ${release.unitId}`,
      ),
    };
  return { release };
}
function resolveFlaggedStay(
  state: WardFlowState,
  event: Extract<BedReleaseEvent, { type: "FLAG_BED_RELEASE" }>,
  operations: BedReleaseOperations,
): FlaggedStay {
  // Same claim-not-proof discipline as CONFIRM_CAPACITY (see that case's own comment in
  // full): this compares what the caller SAID it was acting as against the unit the release
  // is being written to, and refuses when they differ. It does not authenticate anything —
  // `FLAG_BED_RELEASE` is `ward`-only, so unlike RELEASE_PULL/CANCEL_TRANSPORT there is no
  // coordinator caller to exempt, and the comparison always runs.
  if (event.actingUnitId !== event.unitId) {
    return {
      rejected: operations.reject(
        state,
        event,
        `FLAG_BED_RELEASE was raised acting as unit ${event.actingUnitId} but targets unit ${event.unitId}`,
      ),
    };
  }
  const flaggedUnit = operations.findUnit(state, event.unitId);
  if (!flaggedUnit) return { rejected: operations.reject(state, event, `no unit found for id ${event.unitId}`) };
  // Owner decision 2026-09-25: a bed release is a named patient's discharge. These five checks
  // are what makes `admissionId` real rather than decorative — see `BedRelease.admissionId`'s
  // own doc comment for why this exists and what it replaces (a ward-wide count guess with two
  // hard-coded id exceptions).
  const flaggedAdmission = operations.findAdmission(state, event.admissionId);
  if (!flaggedAdmission) {
    return { rejected: operations.reject(state, event, `no admission found for id ${event.admissionId}`) };
  }
  return { unit: flaggedUnit, admission: flaggedAdmission };
}

function flaggedStayRefusal(
  state: WardFlowState,
  event: Extract<BedReleaseEvent, { type: "FLAG_BED_RELEASE" }>,
  flaggedAdmission: Admission,
): string | null {
  if (flaggedAdmission.unitId !== event.unitId) {
    return `FLAG_BED_RELEASE names admission ${flaggedAdmission.id} on unit ${flaggedAdmission.unitId}, not unit ${event.unitId}`;
  }
  if (flaggedAdmission.state === "departed") {
    return `admission ${flaggedAdmission.id} has already left, and a bed release completes when they leave`;
  }
  if (flaggedAdmission.state !== "occupied") {
    return `admission ${flaggedAdmission.id} is ${flaggedAdmission.state}, and only somebody occupying a bed can have a bed release`;
  }
  const flaggedLiveRelease = state.bedReleases.find(
    (r) => r.admissionId === flaggedAdmission.id && r.state !== "discharged",
  );
  if (flaggedLiveRelease) {
    return `admission ${flaggedAdmission.id} already has a live bed release (${flaggedLiveRelease.id})`;
  }
  return null;
}

function flagRelease(
  state: WardFlowState,
  event: Extract<BedReleaseEvent, { type: "FLAG_BED_RELEASE" }>,
  decision: AuditDecision,
  operations: BedReleaseOperations,
): WardFlowState {
  const resolved = resolveFlaggedStay(state, event, operations);
  if ("rejected" in resolved) return resolved.rejected;
  const flaggedUnit = resolved.unit,
    flaggedAdmission = resolved.admission;
  const refusal = flaggedStayRefusal(state, event, flaggedAdmission);
  if (refusal !== null) return operations.reject(state, event, refusal);

  // Review Finding 1: a typed caller cannot construct this event with a `blocker` outside
  // `BED_RELEASE_BLOCKERS` — it is a required union member, not a plain `string`. This check
  // exists for the untyped caller anyway: "Blockers are chosen, never typed" (binding spec)
  // is a runtime rule, not merely a compile-time one, so a defined `blocker` is checked by
  // real membership, not by truthiness alone.
  if (event.blocker !== undefined && !BED_RELEASE_BLOCKERS.includes(event.blocker)) {
    return operations.reject(state, event, `FLAG_BED_RELEASE blocker must be chosen from BED_RELEASE_BLOCKERS`);
  }

  // Bed-model rework (2026-08-28): a flag ALWAYS creates a `"expected"` release, and a
  // blocker sets the blocked FLAG on it rather than choosing a different state. Spec D3's
  // old "blocked xor expected" rule is gone with the fourth state it described — a bed
  // that is coming free but currently held up is a prediction AND a block, and pretending
  // those were alternatives is what let `capacityBreakdown` count such a release nowhere.
  // `waitingOn` is therefore kept on both paths, because the release is expected on both.
  // Fix round 2 (P1): `expectedAt` now carries the ward's own estimate of when the bed will
  // actually be free (`event.expectedAt`, collected on the flag form exactly like
  // `expectedReturn` on the leave-bed form) rather than `event.now`. Before this fix every
  // release a ward flagged at runtime was stamped with the instant it was REPORTED, which
  // `releaseBand()` (spec D5) then always classified `now` — the four planning bands
  // (now / by-midday / by-1600 / tonight) only ever worked for the hand-authored fixture,
  // never for anything a ward actually flagged.
  //
  // `confirmedAt` is deliberately kept as `event.now` — it is a genuinely different fact,
  // when the ward made this report — while `expectedAt` is when the ward expects the bed to
  // be free. The two can differ (a ward flagging now that a bed will be free by 1600), and
  // conflating them was exactly the bug. Neither field carries anything about the departing
  // PATIENT's own timing (binding spec §4): `expectedAt` is an operational estimate about the
  // BED, the same category `expectedReturn` on `RECORD_LEAVE_BED` already sits in and is
  // already permitted to carry — see that event's own doc comment and `LeaveBed`'s type.
  const flaggingRole = `NUM ${flaggedUnit.name}`;

  const release: BedRelease = {
    // "WR-9NN" mirrors `nextReferralId`'s own "9" prefix above — visibly distinct at a
    // glance from the hand-authored "WR-00N" fixture ids, same reasoning as
    // RAISE_REFERRAL's "WF-9NN". Safe to derive from `state.bedReleases.length` here
    // (unlike `RECORD_LEAVE_BED`'s own id below, see that case's comment): nothing in
    // this reducer ever removes an entry from `bedReleases` — every other bed-release
    // case transitions a release in place via `replaceBedRelease`, so the array only ever
    // grows and its length is a safe, collision-free id source.
    id: `WR-9${String(state.bedReleases.length).padStart(2, "0")}`,
    unitId: flaggedUnit.id,
    admissionId: flaggedAdmission.id,
    state: "expected",
    expectedAt: event.expectedAt,
    waitingOn: event.waitingOn,
    blocker: event.blocker ?? null,
    blockedBy: event.blocker !== undefined ? flaggingRole : null,
    // A bed nobody has yet left is not being made ready. Preparation only ever begins after
    // `RELEASE_BED`, and only through `SET_BED_PREPARATION` — see that case.
    preparing: false,
    preparationNote: null,
    confirmedAt: event.now,
    confirmedBy: flaggingRole,
  };

  decision.outcome = "accepted";

  decision.reasonCode = "none";

  return { ...state, bedReleases: [...state.bedReleases, release] };
}

function confirmRelease(
  state: WardFlowState,
  event: Extract<BedReleaseEvent, { type: "CONFIRM_BED_RELEASE" }>,
  decision: AuditDecision,
  operations: BedReleaseOperations,
): WardFlowState {
  const resolved = resolveRelease(state, event, operations);
  if ("rejected" in resolved) return resolved.rejected;
  const release = resolved.release;

  // Legal transition: expected -> confirmed. Nothing else. Naming both the current state and
  // the attempted target keeps a refusal readable without having to cross-reference the state
  // machine comment above. (Before the 2026-08-28 rework this also accepted `blocked ->
  // confirmed`; there is no such state now, and a blocked release is confirmed from whichever
  // stage it is actually in, keeping its flag.)
  if (release.state !== "expected") {
    return operations.reject(state, event, `cannot move release ${release.id} from ${release.state} to confirmed`);
  }

  // Fix round 2 (P2, spec D7): `confirmedAt` restates to `event.now` on every accepted
  // transition, not just at creation — before this fix a transition spread `...release` and
  // kept the ORIGINAL `confirmedAt`, so `WardFreshness` on this row kept reporting when the
  // release was first flagged rather than when its current state was last reported, which
  // defeats D7's whole point ("every screen states when its data was last true"). `confirmedBy`
  // is deliberately NOT restated: the guard above already refuses this event whenever
  // `event.actingUnitId !== release.unitId`, so the acting ward on every accepted transition
  // is, by construction, always the same ward that produced the existing `confirmedBy` — there
  // is no other unit's role this could ever become, so restating it would write back the exact
  // same string it already holds.
  //
  // `blocker`/`blockedBy` are deliberately CARRIED THROUGH untouched (bed-model rework,
  // 2026-08-28): "a discharge that is decided and stuck is exactly that — still confirmed,
  // and flagged". Clearing the flag here would re-create the counting defect this rework
  // exists to close, just from the other end, by making a confirmation quietly assert the
  // bed is unstuck. `CLEAR_BED_RELEASE_BLOCK` is the one and only way a flag comes off.
  const updated: BedRelease = {
    ...release,
    state: "confirmed",
    waitingOn: null,
    confirmedAt: event.now,
  };

  decision.outcome = "accepted";

  decision.reasonCode = "none";

  return operations.replaceBedRelease(state, release.id, updated);
}

function revertRelease(
  state: WardFlowState,
  event: Extract<BedReleaseEvent, { type: "REVERT_BED_RELEASE" }>,
  decision: AuditDecision,
  operations: BedReleaseOperations,
): WardFlowState {
  const resolved = resolveRelease(state, event, operations);
  if ("rejected" in resolved) return resolved.rejected;
  const release = resolved.release;

  // Legal transition: confirmed -> expected. `discharged` is terminal and `expected` is
  // already there, so both fall into the same refusal.
  if (release.state !== "confirmed") {
    return operations.reject(state, event, `cannot move release ${release.id} from ${release.state} to expected`);
  }

  // Membership check, not truthiness — the same discipline BLOCK_BED_RELEASE's own blocker
  // check holds to, and for the same reason: a runtime rule, not merely a compile-time one.
  if (!BED_RELEASE_WAITING_ON.includes(event.waitingOn)) {
    return operations.reject(state, event, `REVERT_BED_RELEASE waitingOn must be chosen from BED_RELEASE_WAITING_ON`);
  }

  // The blocked flag survives: reversing the discharge decision does not unstick the bed.
  const reverted: BedRelease = {
    ...release,
    state: "expected",
    waitingOn: event.waitingOn,
    confirmedAt: event.now,
  };

  decision.outcome = "accepted";

  decision.reasonCode = "none";

  return operations.replaceBedRelease(state, release.id, reverted);
}

function blockRelease(
  state: WardFlowState,
  event: Extract<BedReleaseEvent, { type: "BLOCK_BED_RELEASE" }>,
  decision: AuditDecision,
  operations: BedReleaseOperations,
): WardFlowState {
  const resolved = resolveRelease(state, event, operations);
  if ("rejected" in resolved) return resolved.rejected;
  const release = resolved.release;

  // A typed caller cannot construct this event without `blocker` — it is a required field,
  // not the optional one `FLAG_BED_RELEASE` carries. This check exists for the untyped
  // caller anyway: "blocked with no blocker" is a contradiction in terms (spec D3) and must
  // be refused at runtime, not merely disallowed at compile time. Review Finding 1: this used
  // to be a truthiness test (`!event.blocker`), which refuses a missing or empty value but
  // accepts any other non-empty string — a real membership test against
  // `BED_RELEASE_BLOCKERS` is what "Blockers are chosen, never typed" (binding spec) actually
  // requires.
  if (!event.blocker || !BED_RELEASE_BLOCKERS.includes(event.blocker)) {
    return operations.reject(state, event, `BLOCK_BED_RELEASE requires a blocker chosen from BED_RELEASE_BLOCKERS`);
  }

  // Bed-model rework (2026-08-28): this sets a FLAG and moves no stage at all. A blocked
  // release keeps whichever stage it was in — `expected` stays expected, and a confirmed
  // discharge that gets stuck stays CONFIRMED and keeps counting as confirmed. Only
  // `discharged` is refused: the bed is already free, so there is nothing left to hold up.
  const blockedUnit = operations.findUnit(state, release.unitId);

  if (!blockedUnit) return operations.reject(state, event, `no unit found for id ${release.unitId}`);

  if (release.state === "discharged") {
    return operations.reject(state, event, `cannot block release ${release.id} because it is already released`);
  }

  // Fix round 2 (P2, spec D7): same freshness restatement as CONFIRM_BED_RELEASE's own case
  // (see its comment in full) — `confirmedAt` moves to `event.now` on this write too, and
  // `confirmedBy` stays untouched for the same reason. `blockedBy` is a separate role field
  // rather than a reuse of `confirmedBy` because "who says this bed is stuck" and "who last
  // reported its stage" are different questions once a block outlives a stage change.
  const updated: BedRelease = {
    ...release,
    blocker: event.blocker,
    blockedBy: `NUM ${blockedUnit.name}`,
    confirmedAt: event.now,
  };

  decision.outcome = "accepted";

  decision.reasonCode = "none";

  return operations.replaceBedRelease(state, release.id, updated);
}

function clearReleaseBlock(
  state: WardFlowState,
  event: Extract<BedReleaseEvent, { type: "CLEAR_BED_RELEASE_BLOCK" }>,
  decision: AuditDecision,
  operations: BedReleaseOperations,
): WardFlowState {
  const resolved = resolveRelease(state, event, operations);
  if ("rejected" in resolved) return resolved.rejected;
  const release = resolved.release;

  // Refused rather than silently accepted as a no-op: "this bed is no longer stuck" is a
  // claim about a bed that WAS stuck, and a screen offering it on an unflagged release is a
  // defect the reducer should surface on the rejections list, not absorb.
  if (release.blocker === null) {
    return operations.reject(state, event, `release ${release.id} carries no blocked flag to clear`);
  }

  const unblocked: BedRelease = {
    ...release,
    blocker: null,
    blockedBy: null,
    confirmedAt: event.now,
  };

  decision.outcome = "accepted";

  decision.reasonCode = "none";

  return operations.replaceBedRelease(state, release.id, unblocked);
}

function setPreparation(
  state: WardFlowState,
  event: Extract<BedReleaseEvent, { type: "SET_BED_PREPARATION" }>,
  decision: AuditDecision,
  operations: BedReleaseOperations,
): WardFlowState {
  const resolved = resolveRelease(state, event, operations);
  if ("rejected" in resolved) return resolved.rejected;
  const release = resolved.release;

  // Membership check, same discipline as the blocker checks above: "notes are chosen, never
  // typed" is a RUNTIME rule, not merely a compile-time one, so an untyped caller supplying
  // anything outside `BED_PREPARATION_NOTES` is refused rather than stored.
  //
  // The owner supplied that list on 2026-08-28, so this now accepts the two real notes where
  // it previously refused everything. The `string | undefined` binding and the `readonly
  // string[]` widening are kept deliberately: they were what made this guard compile while
  // `BedPreparationNote` was `never`, they cost nothing now, and they are what keeps the
  // check honest if a future edit ever empties the array again.
  const requestedNote: string | undefined = event.note;

  if (requestedNote !== undefined && !(BED_PREPARATION_NOTES as readonly string[]).includes(requestedNote)) {
    return operations.reject(state, event, `SET_BED_PREPARATION note must be chosen from BED_PREPARATION_NOTES`);
  }

  const prepared: BedRelease = {
    ...release,
    preparing: event.preparing,
    // Clearing the flag clears the note with it — "being made ready, waiting on nothing" is
    // a state, "not being made ready, waiting on a clean" is a contradiction.
    preparationNote: event.preparing ? (event.note ?? null) : null,
    confirmedAt: event.now,
  };

  decision.outcome = "accepted";

  decision.reasonCode = "none";

  return operations.replaceBedRelease(state, release.id, prepared);
}

function releaseBed(
  state: WardFlowState,
  event: Extract<BedReleaseEvent, { type: "RELEASE_BED" }>,
  decision: AuditDecision,
  operations: BedReleaseOperations,
): WardFlowState {
  const resolved = resolveRelease(state, event, operations);
  if ("rejected" in resolved) return resolved.rejected;
  const release = resolved.release;

  // Legal transitions: confirmed -> discharged and expected -> discharged. `discharged` is
  // terminal, so only a release already in it is refused. The stage is `discharged` and the
  // word "released" below belongs to the retired FOUR-stage model, kept only where it
  // describes that model's own history — owner ruling 2026-08-30, discharged not released. Expected is accepted deliberately:
  // "the person has left" is a statement of fact about an empty bed, not a prediction being
  // promoted into availability, and the four-stage model already permitted the same journey
  // via `expected -> blocked -> released`. Narrowing it during the rework would have refused
  // a path wards could already take.
  if (release.state === "discharged") {
    return operations.reject(
      state,
      event,
      `release ${release.id} is already discharged and cannot be discharged again`,
    );
  }

  const unit = operations.findUnit(state, release.unitId);

  if (!unit) return operations.reject(state, event, `no unit found for id ${release.unitId}`);

  // Owner decision 2026-09-25: this completes a release only once its named admission has
  // actually left. While they are still in the bed, record the leaving instead
  // (`RECORD_LEAVING`) — that is what now completes the release, in the same write that raises
  // the unit's figures. See `departAdmission`'s own comment.
  const releasedAdmission = operations.findAdmission(state, release.admissionId);

  if (!releasedAdmission) {
    return operations.reject(
      state,
      event,
      `release ${release.id} names admission ${release.admissionId}, which does not exist`,
    );
  }

  if (releasedAdmission.state !== "departed") {
    return operations.reject(
      state,
      event,
      `release ${release.id} completes when admission ${releasedAdmission.id} is recorded as having left (RECORD_LEAVING); they are still ${releasedAdmission.state}`,
    );
  }

  // Fix round 2 (P2, spec D7): same freshness restatement as CONFIRM_BED_RELEASE's own case
  // (see its comment in full) — `confirmedAt` moves to `event.now` on this transition too,
  // and `confirmedBy` stays untouched for the same reason.
  // The blocked flag comes off here, and here only besides `CLEAR_BED_RELEASE_BLOCK`: once
  // the bed is actually free there is nothing left being held up, so a surviving flag would
  // be a claim about a discharge that has already happened.
  const updatedRelease: BedRelease = {
    ...release,
    state: "discharged",
    waitingOn: null,
    blocker: null,
    blockedBy: null,
    confirmedAt: event.now,
  };

  // RELEASE_BED is the one event in this six-case group that changes an actual bed count,
  // not just a record about one — this is where the expected/confirmed expectation
  // `FLAG_BED_RELEASE`/`CONFIRM_BED_RELEASE` only anticipated becomes the physical fact.
  // `capacityBreakdown`'s `availableNow` is deliberately blind to `bedReleases` itself (Task
  // 2: nothing expected or confirmed-but-unreleased may ever be added into it), so the only
  // way a release ever moves that number is through the unit's own fields, here. Both
  // `allocatable.value` and `empty.value` rise by one: the bed is now truly free, not merely
  // reserved (`allocatable` alone) or physically vacant while still pulled for someone else
  // (`empty` alone) — mirroring `PATIENT_ARRIVED`'s and `PULL_PATIENT`'s own single-field writes,
  // just on both fields at once, because this bed had never been decremented by either of
  // those handlers to begin with.
  //
  // Fix round 1 (Critical): both writes are clamped to `unit.beds`, the unit's own physical
  // ceiling. Without this clamp, repeated legal FLAG_BED_RELEASE -> CONFIRM_BED_RELEASE ->
  // RELEASE_BED cycles on one unit can walk `empty.value` past `unit.beds` — nothing in this
  // handler or in `FLAG_BED_RELEASE` caps how many releases a unit accumulates against its
  // own occupied-bed count. `unitCapacity`'s reconciliation identity
  // (`available + held + blocked + occupied === unit.beds`, `tests/ward-capacity-reconciliation.test.ts`)
  // depends on `empty.value` never exceeding `unit.beds` — once it does, `notEmpty` collapses
  // to zero and the four figures stop summing to the unit's real bed count, which is exactly
  // the sentence `ward-screen.tsx` tells a coordinator is always true. `unitCapacity` itself
  // clamps every figure it derives so that already-over/under-counted authored data is never
  // taken at face value; an unclamped write here broke that discipline from the write side
  // instead of the read side. Do not remove this clamp to "simplify" the arithmetic.
  // The person has already left (refused above otherwise), and `departAdmission` moved the
  // figures then. This event now only records the stage. It never moves a count.
  const departureAlreadyIncremented = true;

  // `sexMix` is NOT touched here: a release does not say who left, and occupant counts follow
  // the leaver's gender (owner rulings 2026-09-25), so the count moves when the admission
  // departs (`departAdmission`), never by guessing a sex here. 5d7f438126's guess (decrement
  // the larger bucket) was removed 2026-09-25; it also subtracted twice when the occupant later left.
  const updatedUnit: Unit = departureAlreadyIncremented
    ? {
        ...unit,
        allocatable: { ...unit.allocatable, confirmedAt: event.now },
        empty: { ...unit.empty, confirmedAt: event.now },
      }
    : {
        ...unit,
        allocatable: {
          ...unit.allocatable,
          value: Math.min(unit.beds, unit.allocatable.value + 1),
          confirmedAt: event.now,
        },
        empty: { ...unit.empty, value: Math.min(unit.beds, unit.empty.value + 1), confirmedAt: event.now },
      };

  const withUnit = operations.replaceUnit(state, unit.id, updatedUnit);

  decision.outcome = "accepted";

  decision.reasonCode = "none";

  return operations.replaceBedRelease(withUnit, release.id, updatedRelease);
}
