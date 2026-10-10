import type { WardFlowEvent } from "./ward-flow-events";
import type { WardFlowState } from "./ward-flow-reducer";
import { STAGE_TRANSITION_BLOCKERS } from "./ward-stage-transition-blockers";
import { MOVEMENT_STAGES, type Movement, type Notice } from "./ward-model";
import { CANCEL_TRANSPORT_REASONS } from "./ward-change-reasons";
type TransportCancellationEvent = Extract<WardFlowEvent, { type: "CANCEL_TRANSPORT" }>;
type BookedTransport = NonNullable<Movement["transport"]>;
type CancellationContext = { movement: Movement; cancelledTransport: BookedTransport; bedIsHeld: boolean };
type TransportCancellationOperations = {
  reject: (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState;
  findMovement: (state: WardFlowState, id: string) => Movement | undefined;
  replaceMovement: (state: WardFlowState, id: string, next: Movement) => WardFlowState;
  makeNotice: (
    now: WardFlowEvent["now"],
    count: number,
    kind: Notice["kind"],
    to: Notice["to"],
    about: Notice["about"],
    sentence: string,
  ) => Notice;
  appendNotices: (state: WardFlowState, notices: readonly Notice[]) => WardFlowState;
};
/** Cancel only the recorded transport job. The movement, held bed and stage history stay intact; no replacement is booked. */
export function reduceTransportCancellationEvent(
  state: WardFlowState,
  event: TransportCancellationEvent,
  operations: TransportCancellationOperations,
): WardFlowState {
  return cancelTransport(state, event, operations);
}

function cancelTransport(
  state: WardFlowState,
  event: Extract<TransportCancellationEvent, { type: "CANCEL_TRANSPORT" }>,
  operations: TransportCancellationOperations,
): WardFlowState {
  const movement = operations.findMovement(state, event.movementId);
  if (!movement) return operations.reject(state, event, `no movement found for id ${event.movementId}`);
  if (movement.closure) {
    return operations.reject(
      state,
      event,
      `cannot cancel transport for a closed movement (${movement.closure.reason})`,
    );
  }
  if (!movement.transport) {
    return operations.reject(state, event, `movement ${movement.id} has no transport job to cancel`);
  }
  const refusal =
    cancellableJourneyRefusal(movement.id, movement.transport) ??
    cancellingCallerRefusal(movement.id, movement.transport, event) ??
    cancellationReasonRefusal(event);
  if (refusal !== undefined) return operations.reject(state, event, refusal);
  const context = cancellationContext(movement, movement.transport);
  const next = operations.replaceMovement(state, movement.id, recordedCancellation(context, event));
  return operations.appendNotices(next, cancelledJourneyNotices(state, event, context, operations));
}
function cancellableJourneyRefusal(movementId: string, transport: BookedTransport): string | undefined {
  if (transport.cancelledAt !== undefined) {
    return `transport for movement ${movementId} was already cancelled`;
  }
  if (transport.arrivedAt !== undefined) {
    return `cannot cancel transport for movement ${movementId} — the patient has arrived`;
  }
  if (transport.collectedAt !== undefined) {
    return `cannot cancel transport for movement ${movementId} — the patient has departed`;
  }
  return undefined;
}
function cancellingCallerRefusal(
  movementId: string,
  transport: BookedTransport,
  event: TransportCancellationEvent,
): string | undefined {
  /*
   * ⚠️ THIS CHECK USED TO BE TR-D6 INVERTED, AND IT READ AS OBVIOUSLY CORRECT.
   *
   * It was: `if (event.role === "ward" && event.actingUnitId !== movement.acceptedUnitId)
   * reject` — permitting a ward caller ONLY when it was the accepted unit. That is, only the
   * RECEIVING ward: the one party the owner's ruling excludes by name. Every other ward was
   * refused. It carried a careful comment about claim-not-proof discipline while doing exactly
   * the wrong thing, because "a ward may act on its own patient" is such a natural sentence
   * that it survives review.
   *
   * TR-D6 (owner, 2026-08-30): a transport may be cancelled by the team that BOOKED it and by
   * the coordinator. The receiving ward may not — it did not book the job, and a booking
   * cancelled by the destination is indistinguishable on the sending board from one that
   * failed, so the sending team cannot tell "they changed their mind" from "it never went
   * through". They re-book, or they wait for a vehicle nobody is sending.
   *
   * `ward` was then removed from `EVENT_ROLE.CANCEL_TRANSPORT` altogether, because the role
   * gate alone could not tell the receiving ward from the booking one — excluding every ward
   * was the only safe fix available with `BOOK_TRANSPORT` recording no booker at all.
   *
   * 🔴 WLQ-11 (owner, 2026-09-15): *"whoever booked transport may cancel it; the receiving
   * ward still may not."* `ward` is back in `EVENT_ROLE.CANCEL_TRANSPORT`, and the finer
   * distinction TR-D6 could not make is made HERE instead, against `transport.bookedBy`
   * (`BOOK_TRANSPORT`'s own new field — see its doc comment). Same claim-not-proof discipline
   * as everywhere else `actingUnitId` appears: this compares what the caller SAID it was
   * acting as against who is recorded as having booked, and refuses when they differ —
   * including when they differ because `bookedBy` is entirely absent, which is every transport
   * job booked before this ruling existed. TR-D6's original coordinator/ED-only rule is
   * therefore UNCHANGED for those jobs. Unused for a coordinator or `ed` caller, whose rights
   * remain unconditional (`ed` is still the sending team on every movement today).
   *
   * 🔴 **`community` GAINED THE IDENTICAL CHECK, AGAINST `bookedBy.placeId`, UNDER THE OWNER'S
   * THIRD RULING (2026-09-17, answer 9) — see that branch just below.** This paragraph used to
   * say `community` "cannot be checked the same way"; that was true only for as long as
   * nothing plumbed a community identity claim into `BOOK_TRANSPORT`, and the third ruling is
   * what plumbed one (`actingPlaceId`, the same claim-not-proof discipline as `actingUnitId`).
   */

  if (event.role === "ward" && !recordedWardBooker(transport, event))
    return `CANCEL_TRANSPORT raised as ward acting as ${event.actingUnitId} may only cancel transport it booked for movement ${movementId}`;

  // 🔴 Owner's third ruling, 2026-09-17 (answer 9): "only the community team that booked
  // transport may cancel it." Same shape as the `ward` branch just above, against
  // `bookedBy.placeId` instead of `bookedBy.unitId` — a `community` caller whose claim does
  // not match the recorded booker is refused, including when `bookedBy` was never a
  // `community` booking at all or predates this ruling and carries no `placeId`.

  if (event.role === "community" && !recordedCommunityBooker(transport, event))
    return `CANCEL_TRANSPORT raised as community acting as ${event.actingPlaceId} may only cancel transport it booked for movement ${movementId}`;

  return cancellingEdClaimRefusal(movementId, transport, event);
}
function recordedWardBooker(transport: BookedTransport, event: TransportCancellationEvent): boolean {
  if (transport.bookedBy?.role !== "ward") return false;
  if (!event.actingUnitId) return false;
  return transport.bookedBy.unitId === event.actingUnitId;
}
function recordedCommunityBooker(transport: BookedTransport, event: TransportCancellationEvent): boolean {
  if (transport.bookedBy?.role !== "community") return false;
  if (!event.actingPlaceId) return false;
  return transport.bookedBy.placeId === event.actingPlaceId;
}
function cancellingEdClaimRefusal(
  movementId: string,
  transport: BookedTransport,
  event: TransportCancellationEvent,
): string | undefined {
  if (event.role !== "ed" || !event.actingPlaceId) return undefined;
  const bookedPlace = transport.bookedBy?.placeId;
  if (bookedPlace && bookedPlace !== event.actingPlaceId)
    return `CANCEL_TRANSPORT raised as ED acting as ${event.actingPlaceId} may only cancel transport it booked for movement ${movementId}`;
  return undefined;
}
function cancellationReasonRefusal(
  event: Extract<TransportCancellationEvent, { type: "CANCEL_TRANSPORT" }>,
): string | undefined {
  if (!CANCEL_TRANSPORT_REASONS.includes(event.reason)) {
    /*
     * Runtime membership, not merely the type. `reason` is declared required on the event, but
     * a type-only guarantee passes `vitest run` with no `tsc` involved — and a caller omitting
     * it was accepted, writing `reason: undefined` into the unwind record. TR-D6 says this must
     * not be weakened to optional; an unenforced requirement already is.
     */
    return `CANCEL_TRANSPORT reason must be chosen from CANCEL_TRANSPORT_REASONS`;
  }
  return undefined;
}
function cancellationContext(movement: Movement, transport: BookedTransport): CancellationContext {
  // Never closes the movement — the patient stays open, only the transport job unwinds. The
  // cancelled job remains named in the audit trail while a clean replacement follows the
  // ordinary acceptance path. The bed itself is untouched by this handler.
  //
  // 🔴 FIX ROUND (2026-09-16 audit): this used to set `stage: "handover_ready"` unconditionally,
  // whatever stage the movement was actually at. `BOOK_TRANSPORT` runs at `pulled`, and nothing
  // advances the stage to `handover_ready` except `HANDOVER_READY` itself — so a job cancelled
  // right after booking, before the ED ever marked the handover ready, was pushed straight to
  // `handover_ready` anyway, skipping that act entirely.
  //
  // 🔴 SECOND FIX ROUND (adversarial review of 65aa7c54a6): the first repair replaced the
  // unconditional jump with `movement.stage === "pulled" ? "pulled" : "handover_ready"`, whose
  // own comment claimed `handover_ready` was the ONLY other stage reachable here. FALSE.
  // `STEP_BACK_STAGE` can move a movement with a booked, uncollected transport job back to ANY
  // strictly-earlier stage without touching `transport` at all (its own "TOUCH NOTHING ELSE"
  // rule) — including `accepted_awaiting_bed`. `RELEASE_PULL` reaches the same stage the same
  // way: it releases the BED, never the transport, and lands back at `accepted_awaiting_bed`
  // with the booked job still standing. Both paths then hit this handler with
  // `movement.stage === "accepted_awaiting_bed"`, and the ternary jumped them forward to
  // `handover_ready` anyway — the exact defect the first fix round believed it had closed.
  // See `tests/ward-cancel-transport-stage.test.ts` for both reproductions.
  //
  // The correct rule needs no case analysis at all: `CANCEL_TRANSPORT` unwinds a transport job,
  // and nothing about unwinding a job changes where the PATIENT currently sits in the pathway.
  // The stage is therefore left exactly as found, in every reachable case.
  //
  // 🔴 THIRD FIX ROUND (Opus debugger, 3b3f215ba1): a replacement job was installed
  // UNCONDITIONALLY, even when no bed is held at all — `RELEASE_PULL` (or a `STEP_BACK_STAGE`
  // that lands the same way) can put a movement back at a stage strictly before `pulled` while
  // a transport job is still standing (`orphanedTransport`, `ward-derivations.ts`, is the
  // existing name for exactly that shape). Installing a fresh replacement there kept the
  // orphan flagged forever — every cancel just minted `-replacement-N`, the officer and the
  // receiving ward kept being told a replacement was coming for a patient with nowhere to go,
  // and a re-pull's `BOOK_TRANSPORT` refused with "already booked" against a job nobody wanted.
  //
  // `MOVEMENT_STAGES`'s own order distinguished the two branches: at or after `pulled` the bed
  // is held (or was, moments ago); strictly before `pulled`, no bed is held. Until the fix
  // round immediately below, only the no-bed branch removed the job — the bed-held branch kept
  // installing a fresh `-replacement-N`, exactly the way this round's own comment describes.
  //
  // 🔴 FIFTH FIX ROUND, owner answer 30 (2026-09-17), build plan item 30: *"Cancelling
  // transport while a bed is held: no automatic rebooking; a person books again."* The
  // bed-held branch's replacement job is deleted by this round, not merely reworded — see
  // `tests/ward-transport-cancel-no-rebook.test.ts` and the rewritten control test in
  // `tests/ward-cancel-transport-no-bed-held.test.ts`. Both branches now remove the job for the
  // SAME reason `orphanedTransport` already reads "no job" as "nothing to flag" on the no-bed
  // branch: a cancelled job is gone, whichever branch cancelled it. `BOOK_TRANSPORT`'s own
  // stage guard is widened (see its case above) so a person CAN book again from `handover_ready`
  // as well as `pulled` — before this round nobody needed to, because a job was always already
  // standing there.
  const cancelledTransport = transport;
  // WFA-001 / same OR as `releasePulledBedAndAdmission`: `STEP_BACK_STAGE` can leave
  // `admissionId` standing at a stage strictly before `pulled`, and the bed is still held.
  // Stage alone is not enough — a cancelled job while the admission remains must say so.
  const bedIsHeld =
    movement.admissionId !== undefined || MOVEMENT_STAGES.indexOf(movement.stage) >= MOVEMENT_STAGES.indexOf("pulled");
  return { movement, cancelledTransport, bedIsHeld };
}
function recordedCancellation(context: CancellationContext, event: TransportCancellationEvent): Movement {
  const { movement, cancelledTransport, bedIsHeld } = context;

  const updatedMovement: Movement = {
    ...movement,
    // `stage` is deliberately NOT written here — see the SECOND FIX ROUND comment above:
    // cancelling a transport job never advances or reverts the movement's stage, in every
    // reachable case, so the spread above already carries the right value forward.
    //
    // FIFTH FIX ROUND: no branch replaces the job any more — `orphanedTransport` already reads
    // an absent job as "nothing to flag" (its own first line: `if (movement.transport ===
    // undefined) return undefined`), and an absent job is what lets `BOOK_TRANSPORT` succeed
    // again instead of refusing with "already booked", on the bed-held branch exactly as it
    // already did on the no-bed one.
    transport: undefined,
    // 🔴 FOURTH FIX ROUND (owner follow-up, 2026-09-17), same defect and same fix as
    // `RELEASE_PULL`'s own comment just above it in this file: on the no-bed branch the job is
    // GONE, so whatever `blocker` last said ("Awaiting a transport provider response", or an
    // even later provider-progress sentence) is now false; the movement reads exactly as it did
    // the moment it first reached `accepted_awaiting_bed`.
    //
    // FIFTH FIX ROUND: the bed-held branch used to leave `blocker` exactly as found, which was
    // correct only while the job survived (replaced, not removed). Now the job is gone there
    // too, so the same discipline applies for the same reason — `STAGE_TRANSITION_BLOCKERS.
    // transportCancelled` states the fact the record now supports: the bed is still held, and
    // nobody has booked again yet.
    blocker: bedIsHeld ? STAGE_TRANSITION_BLOCKERS.transportCancelled : STAGE_TRANSITION_BLOCKERS.accepted,
    unwinds: [
      ...movement.unwinds,
      {
        at: event.now,
        kind: "transport_cancelled",
        by: event.role,
        reason: event.reason,
        transportId: cancelledTransport.id,
        cadNumber: cancelledTransport.cadNumber,
      },
    ],
    // No entry appended — `stage` never moves here (see above), so an append-only stage
    // HISTORY recording a transition would misstate what this cancellation did. Every other
    // writer in this file only ever appends when `to` differs from the stage it read; here
    // `to` and `from` would always be identical, so there is nothing to record.
    stageChanges: movement.stageChanges,
  };
  return updatedMovement;
}
function cancelledJourneyNotices(
  state: WardFlowState,
  event: TransportCancellationEvent,
  context: CancellationContext,
  operations: TransportCancellationOperations,
): Notice[] {
  const { movement, bedIsHeld } = context;

  /*
   * Communication addendum §1.3: "CANCEL_TRANSPORT — the officer and the receiving ward —
   * somebody is expecting a person who is no longer coming." Two independent notices, each
   * its own `NoticeKind` so the two can never collide under `makeNotice`'s id rule.
   *
   * The officer is always notified: `officer` carries no `placeId` in this model (a single
   * role, never split by place — see `Addressee`'s own doc comment). The receiving ward is
   * `movement.acceptedUnitId`, which every movement reaching `CANCEL_TRANSPORT` has: transport
   * can only be booked (`BOOK_TRANSPORT`) once a movement is `pulled`, and a movement cannot
   * reach `pulled` without an accepted unit first (`PULL_PATIENT`). Guarded rather than
   * asserted, so a future relaxation of that chain degrades to "no ward notice" instead of a
   * runtime crash.
   *
   * 🔴 THIRD FIX ROUND: "a replacement is being arranged" is false on the no-bed branch — there
   * is nothing to arrange a replacement FOR, and telling the officer and the receiving ward
   * otherwise is the same misleading-notice defect this whole round exists to close. Each
   * sentence states the two facts the record actually supports instead: the job was cancelled,
   * and nothing has been rebooked.
   *
   * 🔴 FIFTH FIX ROUND, owner answer 30 (2026-09-17): "a replacement is being arranged" is now
   * ALSO false on the bed-held branch — nothing is arranging anything any more, on either
   * branch, because this round deletes the automatic replacement outright (see the reducer's
   * own comment above `cancelledTransport`). Wording from the build plan's exact on-screen
   * wording table (`docs/ward-flow/plans/2026-09-17-build-plan-referrals-transport.md` §4, T1).
   */
  const cancelledNote = bedIsHeld
    ? "the bed is still held and nothing has been rebooked."
    : "no bed is held and nothing has been rebooked.";
  const transportNotices: Notice[] = [
    operations.makeNotice(
      event.now,
      state.notices.length,
      "transport_cancelled_officer",
      { role: "officer" },
      { movementId: movement.id },
      `Transport for ${movement.id} was cancelled (${event.reason.replace(/_/g, " ")}); ${cancelledNote}`,
    ),
  ];
  if (movement.acceptedUnitId !== undefined) {
    const receivingUnitId = movement.acceptedUnitId;
    transportNotices.push(
      operations.makeNotice(
        event.now,
        state.notices.length,
        "transport_cancelled_ward",
        { role: "ward", placeId: receivingUnitId },
        { movementId: movement.id, unitId: receivingUnitId },
        `The transport bringing your patient for ${movement.id} was cancelled (${event.reason.replace(/_/g, " ")}); ${cancelledNote}`,
      ),
    );
  }
  return transportNotices;
}
