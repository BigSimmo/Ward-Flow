import type { WardFlowEvent } from "./ward-flow-events";
import type { WardFlowState } from "./ward-flow-reducer";
import type { Movement } from "./ward-model";
import type { Instant } from "./ward-clock";
import { stageCopy } from "./ward-stage-copy";
type TransportProgressEvent = Extract<
  WardFlowEvent,
  { type: "HANDOVER_READY" | "TRANSPORT_ACCEPTED" | "TRANSPORT_EN_ROUTE" | "PATIENT_COLLECTED" }
>;
type TransportProgressOperations = {
  reject: (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState;
  findMovement: (state: WardFlowState, id: string) => Movement | undefined;
  replaceMovement: (state: WardFlowState, id: string, next: Movement) => WardFlowState;
  heldUnitGenderRefusal: (state: WardFlowState, movement: Movement, now: Instant) => string | null;
  blockers: {
    examinationRevokedAwaitingRelease: string;
    transportAccepted: string;
    transportEnRoute: string;
    collected: string;
  };
};
/** Forward transport commands retain booked-job and examination guards. The facade
 * supplies the held-bed gender check and keeps permissions, audit and resource revisions. */
export function reduceTransportProgressEvent(
  state: WardFlowState,
  event: TransportProgressEvent,
  operations: TransportProgressOperations,
): WardFlowState {
  switch (event.type) {
    case "HANDOVER_READY":
      return readyHandover(state, event, operations);
    case "TRANSPORT_ACCEPTED":
      return acceptTransport(state, event, operations);
    case "TRANSPORT_EN_ROUTE":
      return recordEnRoute(state, event, operations);
    case "PATIENT_COLLECTED":
      return recordCollection(state, event, operations);
  }
}

function readyHandover(
  state: WardFlowState,
  event: Extract<TransportProgressEvent, { type: "HANDOVER_READY" }>,
  operations: TransportProgressOperations,
): WardFlowState {
  const movement = operations.findMovement(state, event.movementId);

  if (!movement) return operations.reject(state, event, `no movement found for id ${event.movementId}`);

  if (movement.closure) {
    return operations.reject(
      state,
      event,
      `cannot ready a handover for a closed movement (${movement.closure.reason})`,
    );
  }

  if (movement.stage !== "pulled") {
    return operations.reject(
      state,
      event,
      `cannot ready a handover at the movement's current stage (${stageCopy[movement.stage].label})`,
    );
  }

  /*
   * 🔴 THIS FABRICATED A TRANSPORT JOB AND ANSWERED A CLINICAL QUESTION NOBODY HAD ASKED.
   *
   * It created `transport` on the spot with `escortRequired: movement.legalStatus !==
   * "Voluntary"` — a judgement made by no person, rendered on screen as though a clinician had
   * made it, and wrong in BOTH directions: a voluntary patient can need an escort, and a
   * detained one settled enough to travel may not. `TR-D1` names escort as one of the two facts
   * the sending team is booking BECAUSE it knows them. The provider was fabricated too, taking
   * `TRANSPORT_PROVIDERS[0]` whenever the event carried no choice.
   *
   * It survived `BOOK_TRANSPORT` landing by an hour, deliberately: removing it before a booking
   * control existed would have dead-ended "Mark handover ready" on a screen this session does
   * not own. The control landed at `caacf1eda` with the escort question blank and the provider
   * unchosen, so the bridge goes.
   *
   * ⚠️ **HANDOVER READY NOW REQUIRES A BOOKED TRANSPORT rather than inventing one.** The two
   * changes cannot be apart: a stage that can be reached with no transport, on a model where
   * nothing else creates one, is a patient marked ready to hand over with no way to move them.
   */
  const noTransportNeeded = recordedNoTransportNeeded(movement);

  if (!movement.transport && !noTransportNeeded) {
    return operations.reject(state, event, `cannot ready a handover before transport is booked (BOOK_TRANSPORT)`);
  }

  // P1-3 (Ward Lead ruling, 17 September 2026): re-run at every forward step while a bed is
  // held — see `heldUnitGenderRefusal`'s own doc comment for why only these two judgements and
  // why `PATIENT_ARRIVED` below is deliberately exempt.
  const handoverGenderRefusal = operations.heldUnitGenderRefusal(state, movement, event.now);

  if (handoverGenderRefusal) return operations.reject(state, event, handoverGenderRefusal);

  const updated: Movement = {
    ...movement,
    stage: "handover_ready",
    stageChanges: [
      ...movement.stageChanges,
      { at: event.now, from: movement.stage, to: "handover_ready", by: event.role },
    ],
  };

  return operations.replaceMovement(state, movement.id, updated);
}

function acceptTransport(
  state: WardFlowState,
  event: Extract<TransportProgressEvent, { type: "TRANSPORT_ACCEPTED" }>,
  operations: TransportProgressOperations,
): WardFlowState {
  const movement = operations.findMovement(state, event.movementId);

  if (!movement) return operations.reject(state, event, `no movement found for id ${event.movementId}`);

  if (movement.closure) {
    return operations.reject(
      state,
      event,
      `cannot accept transport for a closed movement (${movement.closure.reason})`,
    );
  }

  // WLQ-4 close-out (2026-09-20): while examinationRevokedAwaitingRelease (or a revoked/
  // community_order examination still holding a bed), do not advance the transport pathway.
  // PATIENT_COLLECTED already refused this; PATIENT_ARRIVED stays reachable by owner answer 5.
  {
    if (transportAwaitsBedRelease(movement, operations)) {
      return operations.reject(
        state,
        event,
        `cannot advance transport for movement ${movement.id}: the examination was revoked and the bed is still held — a coordinator must release the bed first`,
      );
    }
  }

  if (movement.stage !== "handover_ready" || !movement.transport) {
    return operations.reject(
      state,
      event,
      `cannot accept transport at the movement's current stage (${stageCopy[movement.stage].label})`,
    );
  }

  // Instant 0 is a recorded midnight, not "unset" — never truthiness-check timestamps.
  if (movement.transport.acceptedAt !== undefined) {
    return operations.reject(state, event, `transport for movement ${movement.id} was already accepted`);
  }

  // P1-3 (Ward Lead ruling, 17 September 2026) — see `heldUnitGenderRefusal`'s own doc comment.
  const transportAcceptedGenderRefusal = operations.heldUnitGenderRefusal(state, movement, event.now);

  if (transportAcceptedGenderRefusal) return operations.reject(state, event, transportAcceptedGenderRefusal);

  const updated: Movement = {
    ...movement,
    transport: { ...movement.transport, acceptedAt: event.now },
    // ⚠️ THE PROVIDER HAS NOW ANSWERED, so `"Awaiting a transport provider response"` — which
    // `BOOK_TRANSPORT` wrote and nothing had replaced — is not merely stale here, it is
    // CONTRADICTED BY THE RECORD BESIDE IT: `acceptedAt` on the same movement, on the same
    // screen, holds the answer the sentence says is outstanding.
    blocker: operations.blockers.transportAccepted,
  };

  return operations.replaceMovement(state, movement.id, updated);
}

function recordEnRoute(
  state: WardFlowState,
  event: Extract<TransportProgressEvent, { type: "TRANSPORT_EN_ROUTE" }>,
  operations: TransportProgressOperations,
): WardFlowState {
  const movement = operations.findMovement(state, event.movementId);

  if (!movement) return operations.reject(state, event, `no movement found for id ${event.movementId}`);

  if (movement.closure) {
    return operations.reject(state, event, `cannot move transport for a closed movement (${movement.closure.reason})`);
  }

  // WLQ-4 close-out (2026-09-20): while examinationRevokedAwaitingRelease (or a revoked/
  // community_order examination still holding a bed), do not advance the transport pathway.
  // PATIENT_COLLECTED already refused this; PATIENT_ARRIVED stays reachable by owner answer 5.
  {
    if (transportAwaitsBedRelease(movement, operations)) {
      return operations.reject(
        state,
        event,
        `cannot advance transport for movement ${movement.id}: the examination was revoked and the bed is still held — a coordinator must release the bed first`,
      );
    }
  }

  /*
   * 🔴 THIS MESSAGE USED TO NAME ONE CAUSE FOR A GUARD THAT TESTS TWO, AND IT WAS FALSE AT ONE
   * REACHABLE STAGE. It asserted that transport had not been accepted. ⚠️ The wording is
   * deliberately NOT spelled out, and this line says so on purpose: a comment that quotes the
   * string it removed puts that string back in the file, so a search for the false claim finds
   * this file and cannot tell a removal from a survival. Do not restore it for clarity.
   *
   * The guard is `stage !== "handover_ready" || acceptedAt === undefined`. At stage `moving` the
   * first half fires while `transport.acceptedAt` IS set — `moving` is only reachable through
   * `PATIENT_COLLECTED`, which requires `enRouteAt`, which requires this very event to have
   * succeeded, which required `acceptedAt`. `transport.acceptedAt` has exactly ONE writer
   * (`TRANSPORT_ACCEPTED`) and is never cleared; the `acceptedAt: undefined` in
   * `WITHDRAW_ACCEPTANCE` is `Movement.acceptedAt`, the BED acceptance, a different field that
   * looks identical.
   *
   * ⚠️ So a coordinator re-dispatching after the patient was already collected was told to go
   * and get the transport accepted — which had happened, and the patient had already left.
   *
   * The repair reports the two facts the guard actually checked, rather than naming one of them
   * as the cause. It cannot assert something other than what is stored.
   *
   * Instant 0 is a recorded midnight — compare with `=== undefined`, never truthiness.
   */
  if (movement.stage !== "handover_ready" || movement.transport?.acceptedAt === undefined) {
    return operations.reject(
      state,
      event,
      `cannot mark transport en route: the movement must be at ${stageCopy.handover_ready.label} ` +
        `with transport accepted (it is at ${stageCopy[movement.stage].label}, transport ` +
        `${movement.transport?.acceptedAt !== undefined ? "accepted" : "not accepted"})`,
    );
  }

  if (movement.transport.enRouteAt !== undefined) {
    return operations.reject(state, event, `transport for movement ${movement.id} is already en route`);
  }

  const updated: Movement = {
    ...movement,
    transport: { ...movement.transport, enRouteAt: event.now },
    // The vehicle is moving. This is the instant the old sentence was worst: a coordinator
    // reading "Awaiting a transport provider response" chased a patient whose ambulance was
    // already on the road. Still an ACTIVE blocker — nobody has been collected — so the
    // operational score is unchanged by the rewording.
    blocker: operations.blockers.transportEnRoute,
  };

  return operations.replaceMovement(state, movement.id, updated);
}

function recordCollection(
  state: WardFlowState,
  event: Extract<TransportProgressEvent, { type: "PATIENT_COLLECTED" }>,
  operations: TransportProgressOperations,
): WardFlowState {
  const movement = operations.findMovement(state, event.movementId);

  if (!movement) return operations.reject(state, event, `no movement found for id ${event.movementId}`);

  if (movement.closure) {
    return operations.reject(
      state,
      event,
      `cannot collect a patient for a closed movement (${movement.closure.reason})`,
    );
  }

  // T9, owner answer 5 (second round, 2026-09-17): while a withdrawn or revoked examination
  // still holds this movement's bed, collection is refused until a person releases the bed or
  // records a repeat examination — `PATIENT_ARRIVED` carries no such guard and must stay
  // reachable regardless. `examinationRevokedWhileBedHeld`'s own definition
  // (`ward-derivations.ts`), inlined for the identical reason the gender-check guard above
  // inlines `isOpen` rather than importing `ward-derivations.ts` — that module imports FROM
  // this file, so importing back would close a circular module edge.
  if (revokedExaminationHoldsBed(movement)) {
    return operations.reject(
      state,
      event,
      `cannot collect a patient for movement ${movement.id}: the examination was revoked and this movement still holds a bed — a person must release the bed first`,
    );
  }

  /*
   * 🔴 THE SAME DEFECT AS `TRANSPORT_EN_ROUTE` ABOVE, and false at the same stage. The old
   * message asserted that transport was not yet en route. ⚠️ Deliberately not spelled out here,
   * and this line says so on purpose — see the note above for why.
   *
   * At stage `moving` the stage half of the guard fires while `transport.enRouteAt` IS set,
   * because reaching `moving` requires having already SUCCEEDED at this very event.
   * `enRouteAt` has one writer and is never cleared.
   *
   * ⚠️ So a coordinator re-dispatching after the patient was already collected was told
   * transport had not set off, when collection had already happened.
   */
  // Instant 0 is a recorded midnight — compare with `=== undefined`, never truthiness.
  if (movement.stage !== "handover_ready" || movement.transport?.enRouteAt === undefined) {
    return operations.reject(
      state,
      event,
      `cannot collect a patient: the movement must be at ${stageCopy.handover_ready.label} ` +
        `with transport en route (it is at ${stageCopy[movement.stage].label}, transport ` +
        `${movement.transport?.enRouteAt !== undefined ? "en route" : "not en route"})`,
    );
  }

  // P1-3 (Ward Lead ruling, 17 September 2026) — see `heldUnitGenderRefusal`'s own doc comment.
  // The last of the four re-checks: `PATIENT_ARRIVED` deliberately has none.
  const collectedGenderRefusal = operations.heldUnitGenderRefusal(state, movement, event.now);

  if (collectedGenderRefusal) return operations.reject(state, event, collectedGenderRefusal);

  const updated: Movement = {
    ...movement,
    stage: "moving",
    transport: { ...movement.transport, collectedAt: event.now },
    // Nothing is blocking a patient who is in a vehicle — and the SEED already says so in these
    // exact words on its two `moving` movements. Reused verbatim rather than reworded.
    blocker: operations.blockers.collected,
    // `transport.collectedAt` above and this entry's `at` are the same `event.now` — see
    // `StageChange`'s doc comment.
    stageChanges: [...movement.stageChanges, { at: event.now, from: movement.stage, to: "moving", by: event.role }],
  };

  return operations.replaceMovement(state, movement.id, updated);
}

function recordedNoTransportNeeded(movement: Movement): boolean {
  return (movement.transportNeed?.needed ?? movement.transport?.needed) === false;
}

function revokedExaminationHoldsBed(movement: Movement): boolean {
  const examinationOutcome = movement.examination?.outcome;
  return (
    (examinationOutcome === "community_order" || examinationOutcome === "revoked") && movement.admissionId !== undefined
  );
}

function transportAwaitsBedRelease(movement: Movement, operations: TransportProgressOperations): boolean {
  const revokedHoldingBed = revokedExaminationHoldsBed(movement);
  const awaitingRelease = movement.blocker === operations.blockers.examinationRevokedAwaitingRelease;
  return revokedHoldingBed || awaitingRelease;
}
