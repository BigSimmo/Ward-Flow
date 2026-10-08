import type { WardFlowEvent } from "./ward-flow-events";
import type { WardFlowState } from "./ward-flow-reducer";
import { BLOCKERS_MEANING_NOTHING_IS_BLOCKING, type Movement } from "./ward-model";
import { URGENT_MARK_REASONS } from "./ward-change-reasons";
type MovementFlagsEvent = Extract<
  WardFlowEvent,
  { type: "FLAG_MOVEMENT_URGENT" | "CLEAR_MOVEMENT_URGENT_FLAG" | "RECORD_MOVEMENT_BLOCKER" | "CLEAR_MOVEMENT_BLOCKER" }
>;
type MovementFlagsOperations = {
  reject: (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState;
  findMovement: (state: WardFlowState, id: string) => Movement | undefined;
  replaceMovement: (state: WardFlowState, id: string, next: Movement) => WardFlowState;
};
/** Permission, audit and revision guards remain in the main reducer. These commands
 * retain explicit flag provenance and the closed vocabulary for clearing blockers. */
export function reduceMovementFlagsEvent(
  state: WardFlowState,
  event: MovementFlagsEvent,
  operations: MovementFlagsOperations,
): WardFlowState {
  switch (event.type) {
    case "FLAG_MOVEMENT_URGENT":
      return flagUrgent(state, event, operations);
    case "CLEAR_MOVEMENT_URGENT_FLAG":
      return clearUrgent(state, event, operations);
    case "RECORD_MOVEMENT_BLOCKER":
      return recordBlocker(state, event, operations);
    case "CLEAR_MOVEMENT_BLOCKER":
      return clearBlocker(state, event, operations);
  }
}

/**
 * SOMEBODY SAYS WHAT IS ACTUALLY HOLDING THIS PATIENT UP.
 *
 * ⚠️ **`Movement.blocker` — the free-prose one — and NOT `BedRelease.blocker`**, the
 * `BedReleaseBlocker` enum written by `BLOCK_BED_RELEASE`/`CLEAR_BED_RELEASE_BLOCK` further
 * down this file. Two different fields share that name and this case touches only the first.
 *
 * The field had ONE runtime writer, `RAISE_REFERRAL`, stamping `"Awaiting coordinator
 * referral"` at creation, and nothing after it. `STAGE_TRANSITION_BLOCKERS` now restates it
 * wherever a transition contradicts it; this is the other half, and it is the half that
 * matters most, because the
 * things a coordinator actually needs to read — a single room not yet clean, a family not yet
 * reached, an escort provider still finding a vehicle — are facts NOTHING in this model can
 * compute. Only a person can put them here.
 *
 * ⚠️ **THE VALUE IS NOT MEMBERSHIP-CHECKED, WHICH IS A DEPARTURE FROM EVERY OTHER REASON IN
 * THIS REDUCER, AND IT IS DELIBERATE.** `BLOCK_BED_RELEASE` checks its blocker against
 * `BED_RELEASE_BLOCKERS`; `REFER_TO_UNITS` checks its override reason against
 * `OVERRIDE_REASONS`. This one has no list to check against, on the owner's 2026-09-01 ruling:
 * a fixed list cannot hold an absence together with its reason (`"None — in transit"` versus
 * `"None — handover complete"`), and it cannot hold activity by parties the model has no field
 * for. Constraining it would lose exactly what deriving it would lose.
 *
 * The one check is that something was actually said. A blank is refused rather than stored:
 * `Movement.blocker` has no null, so an empty string would be indistinguishable from a field
 * nobody had reached, which is the ambiguity this event exists to end.
 *
 * ⚠️ **NO ROLE IS RECORDED ALONGSIDE IT.** Four roles may raise this and the record does not
 * say which did — deliberately, because inventing an attribution is worse than omitting one,
 * and this field has never claimed to be attributed. If who said it ever matters, that is a
 * new field with its own ruling, not a quiet addition here.
 */
/**
 * THE URGENT FLAG, ON AND OFF — the mechanism the owner asked for on 2026-08-30 and that
 * nobody could reach until 2026-09-01.
 *
 * `Movement.flaggedUrgent` was added with a ranking rule above it (`queueOrder` in
 * ward-priority.ts puts it ABOVE all three urgency tiers) and a badge below it (the coordinator
 * queue's "Flagged urgent"). The only writer was the literal `false` in `RAISE_REFERRAL`, and
 * exactly one hand-authored movement carried `true`. **A fully built feature with no way in.**
 *
 * ⚠️ **BOTH HALVES, and the clearing half is the one that stops this becoming a new permanent
 * state.** A flag nobody can remove sits above every tier for the rest of the demonstration on
 * a patient whose situation has resolved, and the seeded `true` could never be cleared at all.
 *
 * ⚠️ **A REASON, AN AUTHOR AND AN INSTANT ARE NOW RECORDED TOO — item 37, 2026-09-17,** closing
 * the part of the owner's "I will build on it later" that this pair used to leave open.
 * `event.reason` is checked against `URGENT_MARK_REASONS` at runtime (a type-only guarantee
 * passes `vitest run` with no `tsc` involved — the same discipline `CHANGE_URGENCY` and every
 * other reason-carrying case in this file already hold to) and, together with `event.role` and
 * `event.now`, is written to `Movement.urgentFlag`. Clearing stays reason-free: taking a flag
 * back down cannot promote anybody, so there is nothing here for a reason to justify.
 *
 * ⚠️ **AND A HISTORY SURVIVES A CLEAR — review fix-forward item 6, 2026-09-17.** `urgentFlag`
 * is overwritten by every raise and erased by every clear; `urgentFlagHistory` is append-only.
 * Raising pushes a new entry with `clearedAt`/`clearedBy` both absent; clearing fills those two
 * on the OPEN entry (the last one with no `clearedAt`) rather than pushing a second entry, so
 * one raise-then-clear cycle is one row. `findLastIndex` rather than `find` from the front: the
 * open entry is always the newest one, and a movement flagged, cleared, then flagged again has
 * an OLDER closed entry ahead of it that must never be the one clearing touches.
 */
function flagUrgent(
  state: WardFlowState,
  event: Extract<MovementFlagsEvent, { type: "FLAG_MOVEMENT_URGENT" }>,
  operations: MovementFlagsOperations,
): WardFlowState {
  const movement = operations.findMovement(state, event.movementId);

  if (!movement) return operations.reject(state, event, `no movement found for id ${event.movementId}`);

  // A closed movement is off `queueOrder` entirely (`isOpen` removes it), so flagging one would
  // change nothing and report that it had. Refused rather than accepted as a silent no-op, the
  // same discipline every other movement-scoped handler here holds to.
  if (movement.closure) {
    return operations.reject(state, event, `cannot flag a closed movement as urgent (${movement.closure.reason})`);
  }

  if (movement.flaggedUrgent) {
    return operations.reject(state, event, `movement ${movement.id} is already flagged urgent`);
  }

  if (!URGENT_MARK_REASONS.includes(event.reason)) {
    return operations.reject(state, event, `FLAG_MOVEMENT_URGENT reason must be chosen from URGENT_MARK_REASONS`);
  }

  return operations.replaceMovement(state, movement.id, {
    ...movement,
    flaggedUrgent: true,
    urgentFlag: { at: event.now, by: event.role, reason: event.reason },
    urgentFlagHistory: [
      ...(movement.urgentFlagHistory ?? []),
      { raisedAt: event.now, raisedBy: event.role, reason: event.reason },
    ],
  });
}

function clearUrgent(
  state: WardFlowState,
  event: Extract<MovementFlagsEvent, { type: "CLEAR_MOVEMENT_URGENT_FLAG" }>,
  operations: MovementFlagsOperations,
): WardFlowState {
  const movement = operations.findMovement(state, event.movementId);

  if (!movement) return operations.reject(state, event, `no movement found for id ${event.movementId}`);

  // ⚠️ NO `closure` CHECK, unlike flagging above, and the asymmetry is the point. Removing a
  // flag can never promote anybody, so refusing it has no protective value — while a flag that
  // could not be cleared on some future path is the exact permanent state this pair exists to
  // prevent. The guard below is the only one needed: it proves there is something to clear.
  if (!movement.flaggedUrgent) {
    return operations.reject(state, event, `movement ${movement.id} is not flagged urgent`);
  }

  // `undefined` stays `undefined` — a movement flagged before this history existed (WF-018)
  // has nothing to update, and clearing it must not invent an empty log where there was none.
  const history = movement.urgentFlagHistory;

  const openIndex = history?.findLastIndex((entry) => entry.clearedAt === undefined) ?? -1;

  const updatedHistory =
    history === undefined || openIndex === -1
      ? history
      : history.map((entry, index) =>
          index === openIndex ? { ...entry, clearedAt: event.now, clearedBy: event.role } : entry,
        );

  // Clears the provenance together with the boolean — the two fields can never disagree about
  // whether a flag is live (see `Movement.urgentFlag`'s own doc comment).
  return operations.replaceMovement(state, movement.id, {
    ...movement,
    flaggedUrgent: false,
    urgentFlag: undefined,
    urgentFlagHistory: updatedHistory,
  });
}

function recordBlocker(
  state: WardFlowState,
  event: Extract<MovementFlagsEvent, { type: "RECORD_MOVEMENT_BLOCKER" }>,
  operations: MovementFlagsOperations,
): WardFlowState {
  const movement = operations.findMovement(state, event.movementId);

  if (!movement) return operations.reject(state, event, `no movement found for id ${event.movementId}`);

  // Refused for a closed movement, the same as every other movement-scoped handler here. A
  // closed movement is off every open board and its blocker is the closing one — a later edit
  // would describe an obstruction to something that is no longer happening.
  if (movement.closure) {
    return operations.reject(
      state,
      event,
      `cannot record a blocker for a closed movement (${movement.closure.reason})`,
    );
  }

  const blocker = event.blocker.trim();

  if (blocker.length === 0) {
    return operations.reject(
      state,
      event,
      `RECORD_MOVEMENT_BLOCKER blocker must say something — a blank is not a statement`,
    );
  }

  /*
   * ⚠️ A NEAR-MISS OF A "NOTHING IS BLOCKING" SENTINEL IS REFUSED, AND SENT TO THE RIGHT EVENT.
   *
   * `hasActiveBlocker` (ward-priority.ts) compares against `BLOCKERS_MEANING_NOTHING_IS_BLOCKING`
   * by exact equality, so `"none — in transit"` in lower case would be stored as an ACTIVE
   * blocker worth ten points in `operationalScore` — a wrong score on a movement nobody is
   * holding up, which is the computed kind of wrong rather than the displayed kind.
   *
   * ⚠️ **THIS IS EXACT EQUALITY IGNORING CASE AGAINST A CLOSED SET, AND MUST NEVER BECOME A
   * PATTERN.** That boundary is the whole reason it is safe: `"None of the secure units can
   * take him"` is not case-insensitively equal to any member, so it is stored as the real
   * blocker it is — the case `tests/ward-priority.test.ts` pins. A `/^none/i` here would
   * swallow it, which is precisely the fix that was refused.
   *
   * It does NOT catch every way of typing "nothing is blocking" and is not meant to.
   * `"Nothing outstanding"` and `"N/A"` are still stored as obstructions, because this set does
   * not interpret English and must not start. `CLEAR_MOVEMENT_BLOCKER` is what a person uses,
   * and this refusal names it rather than leaving them to guess.
   */
  const nearMiss = BLOCKERS_MEANING_NOTHING_IS_BLOCKING.find(
    (inactive) => inactive.toLowerCase() === blocker.toLowerCase() && inactive !== blocker,
  );

  if (nearMiss !== undefined) {
    return operations.reject(
      state,
      event,
      `"${blocker}" differs from "${nearMiss}" only in case, and would be stored as an active blocker — use CLEAR_MOVEMENT_BLOCKER to say nothing is holding this up`,
    );
  }

  // Trimmed, never as typed: trailing whitespace would make two identical statements compare
  // unequal, and `hasActiveBlocker` (ward-priority.ts) trims before matching its "nothing is
  // blocking" shapes — a stored `"None — in transit "` would score ten points there.
  return operations.replaceMovement(state, movement.id, { ...movement, blocker });
}

/**
 * NOTHING IS HOLDING THIS PATIENT UP ANY MORE.
 *
 * ⚠️ **CLEARING IS REPRESENTED, NOT INTERPRETED, AND THAT IS THE WHOLE POINT OF THE EVENT.**
 * `RECORD_MOVEMENT_BLOCKER` shipped earlier the same day accepting any non-blank prose, while
 * `hasActiveBlocker` recognised "nothing is blocking" by case-sensitive match against a small
 * vocabulary. A person clearing a blocker by typing `"none — resolved"` or `"no blocker"` left
 * the movement scoring ten points as obstructed in `operationalScore`, and so ranked above
 * patients who really were blocked — silently, with nothing red.
 *
 * Widening the recogniser was refused: the next phrasing is missed too, and a case-insensitive
 * `/^none/i` would swallow `"None of the secure units can take him"`, a real blocker the
 * priority tests pin. Instead this writes ONE sentinel from
 * `BLOCKERS_MEANING_NOTHING_IS_BLOCKING`, so the recogniser only ever knows a closed set.
 *
 * `"None — cleared"` rather than `"No blocker"`: an absence WITH its reason. "No blocker" means
 * nobody ever recorded one; this means somebody looked and said it is gone. That is the same
 * distinction `"None — in transit"` and `"None — handover complete"` exist to preserve, and it
 * is the property the owner's ruling against deriving this field turns on.
 */
function clearBlocker(
  state: WardFlowState,
  event: Extract<MovementFlagsEvent, { type: "CLEAR_MOVEMENT_BLOCKER" }>,
  operations: MovementFlagsOperations,
): WardFlowState {
  const movement = operations.findMovement(state, event.movementId);

  if (!movement) return operations.reject(state, event, `no movement found for id ${event.movementId}`);

  if (movement.closure) {
    return operations.reject(
      state,
      event,
      `cannot clear the blocker on a closed movement (${movement.closure.reason})`,
    );
  }

  // Refused rather than accepted as a no-op, the same discipline as the flag pair above: a
  // control that reports success for an act that changed nothing is the untruth this prototype
  // names as mattering most. `"None — cleared"` and the other sentinels are all already
  // "nothing is blocking", so there is nothing to clear.
  if (BLOCKERS_MEANING_NOTHING_IS_BLOCKING.some((inactive) => inactive === movement.blocker.trim())) {
    return operations.reject(state, event, `movement ${movement.id} already records that nothing is holding it up`);
  }

  return operations.replaceMovement(state, movement.id, { ...movement, blocker: "None — cleared" });
}
