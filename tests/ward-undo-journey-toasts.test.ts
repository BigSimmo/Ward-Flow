import { afterEach, describe, expect, it } from "vitest";

import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import type { Movement } from "../src/components/ward-management/ward-model";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import type { StepUndo } from "../src/components/ward-management/ward-undo";
import {
  forgetJourneyUndoToasts,
  journeyUndoToastsMovedOn,
  noteJourneyUndoToast,
  plainUndoRefusal,
} from "../src/components/ward-management/ward-undo-journey-toasts";

/**
 * Screen audit 19 Nov 2026 (item 4): an Undo toast closes once its journey records a later step or
 * closes, and a late Undo's refusal is said in plain words. Synthetic seed data only.
 */
const NOW = NOW_ANCHOR;
const MOVEMENT_ID = "WF-009";
const UNIT_ID = "rph-adult-secure";

function pulledState(): { before: WardFlowState; pulled: WardFlowState } {
  let state: WardFlowState = seedWardFlowState();
  for (const event of [
    { type: "REFER_TO_UNITS", role: "coordinator", unitIds: [UNIT_ID] },
    { type: "ACCEPT_IN_PRINCIPLE", role: "ward", unitId: UNIT_ID, actingUnitId: UNIT_ID },
  ] as const)
    state = wardFlowReducer(state, { ...event, now: NOW, movementId: MOVEMENT_ID } as never);
  const pulled = wardFlowReducer(state, {
    type: "PULL_PATIENT",
    role: "ward",
    now: NOW,
    movementId: MOVEMENT_ID,
    unitId: UNIT_ID,
    actingUnitId: UNIT_ID,
  });
  expect(pulled.rejections).toEqual([]);
  return { before: state, pulled };
}

const movementOf = (state: WardFlowState) => state.movements.find((m) => m.id === MOVEMENT_ID)!;
const withMovement = (state: WardFlowState, movement: Movement) =>
  state.movements.map((m) => (m.id === MOVEMENT_ID ? movement : m));

function notePull(toastId: string, state: WardFlowState) {
  noteJourneyUndoToast(toastId, {
    type: "RELEASE_PULL",
    movementId: MOVEMENT_ID,
    expectedPull: { unitId: UNIT_ID, stageIndex: movementOf(state).stageChanges.length - 1 },
  });
}

afterEach(forgetJourneyUndoToasts);

describe("an Undo toast closes once its journey has moved on (item 4a)", () => {
  it("keeps a bed pull's Undo while the pull stands, and before its own save has arrived", () => {
    const { before, pulled } = pulledState();
    notePull("toast-1", pulled);
    expect(journeyUndoToastsMovedOn(before.movements)).toEqual([]);
    expect(journeyUndoToastsMovedOn(pulled.movements)).toEqual([]);
  });

  it("closes a bed pull's Undo once transport is booked, a later stage is recorded or the journey closes", () => {
    const { pulled } = pulledState();
    const movement = movementOf(pulled);
    const later: Movement[] = [
      { ...movement, transport: { bookedAt: NOW } } as unknown as Movement,
      {
        ...movement,
        stage: "handover_ready",
        stageChanges: [...movement.stageChanges, { at: NOW, from: "pulled", to: "handover_ready", by: "ed" }],
      } as unknown as Movement,
      {
        ...movement,
        closure: { at: NOW, outcome: "arrived", reason: "Patient arrived at the accepting unit" },
      } as unknown as Movement,
    ];
    for (const [index, next] of later.entries()) {
      notePull(`toast-${index}`, pulled);
      expect(journeyUndoToastsMovedOn(withMovement(pulled, next))).toEqual([`toast-${index}`]);
      // Named once: the note is forgotten as it is returned.
      expect(journeyUndoToastsMovedOn(withMovement(pulled, next))).toEqual([]);
    }
  });

  it("closes a step's Undo once the journey no longer reads as that step left it", () => {
    const { before, pulled } = pulledState();
    const record = {
      kind: "step",
      undoType: "UNDO_ED_STEP",
      action: "HANDOVER_READY",
      subjectId: MOVEMENT_ID,
      at: NOW,
      seq: 3,
      role: "ed",
      unitId: null,
      changes: [
        {
          slice: "movements",
          mode: "id",
          id: MOVEMENT_ID,
          index: 0,
          before: movementOf(before),
          after: movementOf(pulled),
        },
      ],
    } as StepUndo;
    noteJourneyUndoToast("toast-step", { type: "UNDO_ED_STEP", movementId: MOVEMENT_ID }, record);
    // The step's own save not here yet, then here: the Undo stays.
    expect(journeyUndoToastsMovedOn(before.movements)).toEqual([]);
    expect(journeyUndoToastsMovedOn(pulled.movements)).toEqual([]);
    const next = { ...movementOf(pulled), pullExpiresAt: NOW + 999 } as Movement;
    expect(journeyUndoToastsMovedOn(withMovement(pulled, next))).toEqual(["toast-step"]);
  });

  it("notes nothing for an Undo that names no journey, and forgets a toast that has gone", () => {
    const { pulled } = pulledState();
    noteJourneyUndoToast("toast-a", { type: "UNDO_PATIENT_RECORD", patientId: "P-1" });
    noteJourneyUndoToast(undefined, { type: "RELEASE_PULL", movementId: MOVEMENT_ID });
    notePull("toast-gone", pulled);
    const closed = {
      ...movementOf(pulled),
      closure: { at: NOW, outcome: "arrived", reason: "x" },
    } as unknown as Movement;
    expect(journeyUndoToastsMovedOn(withMovement(pulled, closed), () => false)).toEqual([]);
    expect(journeyUndoToastsMovedOn(withMovement(pulled, closed))).toEqual([]);
  });
});

describe("a late Undo's refusal is said in plain words (item 4b)", () => {
  it("turns the engine's own refusal after arrival into one plain sentence", () => {
    const { pulled } = pulledState();
    const closed = {
      ...movementOf(pulled),
      closure: { at: NOW, outcome: "arrived", reason: "Patient arrived at the accepting unit" },
    } as unknown as Movement;
    const refused = wardFlowReducer(
      { ...pulled, movements: withMovement(pulled, closed) },
      {
        type: "RELEASE_PULL",
        role: "ward",
        now: NOW + 1,
        movementId: MOVEMENT_ID,
        reason: "pull_made_in_error",
        actingUnitId: UNIT_ID,
        expectedPull: { unitId: UNIT_ID, stageIndex: 0 },
      },
    );
    const reason = refused.rejections.at(-1)!.reason;
    expect(reason).toContain("closed movement");
    expect(plainUndoRefusal(reason)).toBe("Can't undo: this person has already arrived.");
  });

  it("covers the other refusals a late Undo meets, and leaves any other reason alone", () => {
    expect(plainUndoRefusal("cannot release a pull for a closed movement (Referral withdrawn)")).toBe(
      "Can't undo: this journey has already closed.",
    );
    expect(
      plainUndoRefusal("movement X has a transport job booked; cancel it (CANCEL_TRANSPORT) before releasing"),
    ).toBe("Can't undo: transport is booked. Cancel the transport first.");
    expect(plainUndoRefusal("This has changed since, so it cannot be undone")).toBe(
      "Can't undo: this has changed since. Check the record.",
    );
    expect(plainUndoRefusal("Undo is only possible within 15 minutes of the decision")).toBe(
      "Can't undo: the time to undo has passed.",
    );
    expect(plainUndoRefusal("Only the ward that made this decision, or the coordinator, can undo it")).toBeUndefined();
  });
});
