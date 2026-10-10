import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { TRANSPORT_PROVIDERS } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";

/**
 * THE SENDING TEAM BOOKS THE TRANSPORT, AND THE ESCORT QUESTION IS ANSWERED BY A PERSON.
 *
 * `TR-D1` (OWNER, 2026-08-30): **the sending ward or ED arranges transport.** Once a receiving ward
 * accepts, the team currently holding the patient books the transport out. ⚠️ **His reason is the
 * whole design: the sending team knows the facts the booking needs** — whether an escort is
 * required, whether the patient is settled enough to travel. **The bed coordinator was REJECTED for
 * this**: it owns the bed search and does not know the patient's state. `TR-D5` generalises it to
 * every movement, which is why the ward is a booker too and not only the ED.
 *
 * ⚠️ **AND THIS EVENT EXISTS BECAUSE THE REDUCER WAS ANSWERING THAT QUESTION ITSELF.**
 * `HANDOVER_READY` fabricates a transport job on the spot and fills the escort question by
 * DERIVING it: `escortRequired: movement.legalStatus !== "Voluntary"`. **That is a clinical
 * judgement, made by nobody, presented on screen as though a clinician had made it** — and it is
 * wrong in both directions. A voluntary patient can need an escort; a detained one settled enough
 * to travel may not. `TR-D1` names escort as one of the two facts the sending team is booking
 * BECAUSE it knows them.
 *
 * ⚠️ **BLANK, NEVER PRE-FILLED** (owner, relayed): the booking control opens with the escort
 * question unanswered. A pre-filled answer is a judgement nobody made wearing the clothes of one
 * somebody did — the same defect as the derivation, moved into the UI where it looks like a
 * default rather than a claim. This file pins the model half: the event REQUIRES an answer, so
 * there is no value the form can omit and no default for the reducer to invent.
 *
 * ✅ **THE FABRICATION IS GONE, 2026-08-31.** A test here asserted it was PRESENT, with the removal
 * steps in its own body and worded so it could not stay green afterwards — the debt could not be
 * forgotten or quietly inherited. The booking control landed at `caacf1eda`, the derivation went
 * with it in the same hour, and that test failed exactly as designed and was deleted by its own
 * instructions. **`HANDOVER_READY` now REQUIRES a booked transport rather than inventing one**, and
 * the two changes shipped together because a stage reachable with no transport, on a model where
 * nothing else creates one, is a patient marked ready to hand over with no way to move them.
 */
const NOW = NOW_ANCHOR;

function heldBedMovement() {
  const state = seedWardFlowState();
  const movement = state.movements.find((candidate) => candidate.stage === "pulled");
  expect(movement, "the fixture must hold a movement with a bed held, or nothing here is exercised").toBeDefined();
  return { state, movementId: movement!.id, sendingEd: movement!.originEdId };
}

function book(overrides: Record<string, unknown> = {}) {
  const { state, movementId } = heldBedMovement();
  return wardFlowReducer(state, {
    type: "BOOK_TRANSPORT",
    role: "ed",
    now: NOW,
    movementId,
    provider: TRANSPORT_PROVIDERS[0],
    escortRequired: true,
    // Owner's third ruling, 2026-09-17: the phone-logged facts, required and never defaulted —
    // see the dedicated `describe` block below for the refusal tests these defaults exist beside.
    cadNumber: "CAD-2026-0001",
    transportLegalStatus: "voluntary",
    estimatedAt: NOW + 30,
    ...overrides,
  } as never);
}

describe("BOOK_TRANSPORT", () => {
  it("books a job the sending ED asked for, with the escort answer it gave", () => {
    const { movementId } = heldBedMovement();
    const state = book();
    expect(state.rejections, "the booking must be accepted, or nothing below is exercised").toEqual([]);

    const movement = state.movements.find((candidate) => candidate.id === movementId)!;
    expect(movement.transport).toBeDefined();
    expect(movement.transport!.provider).toBe(TRANSPORT_PROVIDERS[0]);
    expect(movement.transport!.escortRequired).toBe(true);
    expect(movement.transport!.acceptedAt, "booking is not acceptance — the provider has not answered").toBeUndefined();
  });

  it("⚠️ CARRIES THE ANSWER GIVEN, not one derived from the patient's legal status", () => {
    // The defect this event exists to end, stated as a test rather than a comment. A DETAINED
    // patient booked with no escort must record no escort: the sending team is the one that knows
    // whether this person is settled enough to travel, and `legalStatus` cannot know it.
    const { state, movementId } = heldBedMovement();
    const movement = state.movements.find((candidate) => candidate.id === movementId)!;
    expect(movement.legalStatus, "this case only bites for a patient the old derivation would have escorted").not.toBe(
      "Voluntary",
    );

    const booked = wardFlowReducer(state, {
      type: "BOOK_TRANSPORT",
      role: "ed",
      now: NOW,
      movementId,
      provider: TRANSPORT_PROVIDERS[0],
      escortRequired: false,
      cadNumber: "CAD-2026-0004",
      transportLegalStatus: "voluntary",
      estimatedAt: NOW + 30,
      ...{},
    } as never);
    expect(booked.rejections).toEqual([]);
    const after = booked.movements.find((candidate) => candidate.id === movementId)!;
    expect(
      after.transport!.escortRequired,
      "the reducer overrode a clinician's answer with one derived from legal status",
    ).toBe(false);
  });

  it("lets the sending WARD book too, because TR-D5 generalises beyond bed placement", () => {
    const state = book({ role: "ward", actingUnitId: "rph-adult-secure" });
    expect(state.rejections).toEqual([]);
  });

  /**
   * WLQ-11 (owner, 2026-09-15): a `ward` booker's `actingUnitId` is what `CANCEL_TRANSPORT` later
   * compares a would-be canceller's claim against (`transport.bookedBy.unitId`). A ward booking
   * with no claim at all would write a booker nothing could ever match — not even the same ward
   * booking again — so the reducer refuses it outright, the same "answered by a person, required
   * so there is no value to omit" discipline `escortRequired` already uses above.
   */
  it("🔴 REFUSES A WARD BOOKING WITH NO actingUnitId — WLQ-11, so bookedBy is never unmatchable", () => {
    const { movementId } = heldBedMovement();
    const state = book({ role: "ward" });
    expect(state.rejections.length).toBe(1);
    expect(state.rejections[0]!.reason).toContain("actingUnitId");
    expect(
      state.movements.find((candidate) => candidate.id === movementId)!.transport,
      "a refused booking must leave the movement with no transport at all",
    ).toBeUndefined();
  });

  it("WLQ-11: a ward booking records `bookedBy` with its own claimed unit, ED and community record only their role", () => {
    const { movementId } = heldBedMovement();
    const byWard = book({ role: "ward", actingUnitId: "rph-adult-secure" }).movements.find(
      (candidate) => candidate.id === movementId,
    )!.transport;
    expect(byWard!.bookedBy).toEqual({ role: "ward", unitId: "rph-adult-secure" });

    const byEd = book().movements.find((candidate) => candidate.id === movementId)!.transport;
    expect(byEd!.bookedBy).toEqual({ role: "ed" });
  });

  /**
   * `community` ADDED to `EVENT_ROLE.BOOK_TRANSPORT` on 2026-09-01 (OWNER): the booking belongs to
   * whoever is SENDING the patient, and a community team is one of those senders.
   *
   * ⚠️ **WHAT THIS TEST CANNOT SHOW, and the reason is in the model rather than in the test.**
   * There is no community-SENT patient to book for. `Movement.originEdId` is required, and
   * `RAISE_REFERRAL` — the only event that creates a movement — refuses an `edId` that is not in
   * `allEmergencyDepartments()`, so every movement is sent from an emergency department whoever
   * raised it. The movement booked below is an ED's, and it is the only kind there is.
   *
   * The permission is still genuinely exercisable — `case "BOOK_TRANSPORT"` gates on
   * `movement.stage` alone and never compares the caller against `originEdId` — but it is therefore
   * UNSCOPED: a community team may book for any pulled movement in the state. That is stated here
   * rather than left for a reader to find, because a passing test named "lets a community team
   * book" reads as though the sender relationship had been checked, and nothing checked it.
   */
  it("lets a COMMUNITY team book, and writes the SAME record apart from who booked it", () => {
    const { movementId } = heldBedMovement();
    const byCommunity = book({ role: "community", actingPlaceId: COMMUNITY_TEAM_PAGES[0]!.id });
    expect(byCommunity.rejections, "the community booking must be accepted, or nothing below is exercised").toEqual([]);

    const community = byCommunity.movements.find((candidate) => candidate.id === movementId)!.transport;
    const byEd = book().movements.find((candidate) => candidate.id === movementId)!.transport;
    expect(community, "a booking that was accepted must actually have written a job").toBeDefined();
    /*
     * 🔴 CORRECTED 2026-09-15 under WLQ-11 (owner): this used to assert `expect(community).toEqual
     * (byEd)` outright — "the reducer stores... NOTHING about the caller... so a community booking
     * must be indistinguishable from the ED's". That was true until WLQ-11 ("whoever booked
     * transport may cancel it") gave `CANCEL_TRANSPORT` a reason to tell bookers apart, and
     * `transport.bookedBy.role` is now exactly the caller attribution that sentence said would
     * never appear.
     *
     * 🔴 CORRECTED AGAIN under the owner's third ruling (2026-09-17, answer 9): "only the community
     * team that booked transport may cancel it" gave `bookedBy` a `placeId` for a community booker
     * too, the same claim-not-proof discipline `unitId` already holds for a `ward` booker — so the
     * two records below now differ in `bookedBy.role`/`bookedBy.placeId` together.
     */
    expect(community).toEqual({ ...byEd, bookedBy: { role: "community", placeId: COMMUNITY_TEAM_PAGES[0]!.id } });
    expect(byEd!.bookedBy).toEqual({ role: "ed" });
  });

  /**
   * Owner's third ruling, 2026-09-17 (answer 9): the identical "required, no default" discipline
   * `actingUnitId` already holds for a `ward` booker, now given to a `community` one too.
   */
  it("🔴 REFUSES A COMMUNITY BOOKING WITH NO actingPlaceId — so bookedBy is never unmatchable", () => {
    const { movementId } = heldBedMovement();
    const state = book({ role: "community", actingPlaceId: undefined });
    expect(state.rejections.length).toBe(1);
    expect(state.rejections[0]!.reason).toContain("actingPlaceId");
    expect(
      state.movements.find((candidate) => candidate.id === movementId)!.transport,
      "a refused booking must leave the movement with no transport at all",
    ).toBeUndefined();
  });

  it("refuses a community booking whose actingPlaceId does not name a real team", () => {
    const state = book({ role: "community", actingPlaceId: "not-a-real-team" });
    expect(state.rejections.length).toBe(1);
    expect(state.rejections[0]!.reason).toContain("does not name a real community team");
  });

  /**
   * Owner's third ruling, 2026-09-17, verbatim: "you enter the CAD transport number, state
   * voluntary or involuntary, state estimated time as well. This is the booking." All three are
   * required and never defaulted, the identical discipline `escortRequired` already holds to.
   */
  describe("the three phone-logged facts are required and never defaulted", () => {
    it("refuses a missing CAD number", () => {
      const state = book({ cadNumber: undefined });
      expect(state.rejections.length).toBe(1);
      expect(state.rejections[0]!.reason).toContain("cadNumber");
    });

    it("refuses a blank CAD number", () => {
      const state = book({ cadNumber: "   " });
      expect(state.rejections.length).toBe(1);
      expect(state.rejections[0]!.reason).toContain("cadNumber");
    });

    it("refuses a missing transportLegalStatus", () => {
      const state = book({ transportLegalStatus: undefined });
      expect(state.rejections.length).toBe(1);
      expect(state.rejections[0]!.reason).toContain("transportLegalStatus");
    });

    it("refuses a transportLegalStatus outside TRANSPORT_LEGAL_STATUSES", () => {
      const state = book({ transportLegalStatus: "detained" });
      expect(state.rejections.length).toBe(1);
      expect(state.rejections[0]!.reason).toContain("transportLegalStatus");
    });

    it("refuses a missing estimatedAt", () => {
      const state = book({ estimatedAt: undefined });
      expect(state.rejections.length).toBe(1);
      expect(state.rejections[0]!.reason).toContain("estimatedAt");
    });

    it("accepts and stores all three when answered", () => {
      const { movementId } = heldBedMovement();
      const state = book({ cadNumber: "CAD-9988", transportLegalStatus: "involuntary", estimatedAt: NOW + 45 });
      expect(state.rejections).toEqual([]);
      const transport = state.movements.find((candidate) => candidate.id === movementId)!.transport!;
      expect(transport.cadNumber).toBe("CAD-9988");
      expect(transport.transportLegalStatus).toBe("involuntary");
      expect(transport.estimatedAt).toBe(NOW + 45);
    });

    it("does NOT change Movement.legalStatus — transportLegalStatus is a separate, independent fact", () => {
      const { state: before, movementId } = heldBedMovement();
      const legalStatusBefore = before.movements.find((candidate) => candidate.id === movementId)!.legalStatus;
      const after = book({
        transportLegalStatus: legalStatusBefore === "Voluntary" ? "involuntary" : "voluntary",
      });
      expect(after.rejections).toEqual([]);
      expect(after.movements.find((candidate) => candidate.id === movementId)!.legalStatus).toBe(legalStatusBefore);
    });
  });

  it("⚠️ STILL REFUSES A ROLE OUTSIDE THE GATE, so 2026-09-01 WIDENED the list rather than opening it", () => {
    // `officer` is the transport provider's own role: it accepts, drives and delivers a job
    // (`TRANSPORT_ACCEPTED` … `PATIENT_ARRIVED`) and has never been able to create one. A widening
    // written as "anyone may book" — or a gate accidentally removed — turns this test green, which
    // is the only thing standing between one added role and no role check at all.
    const { movementId } = heldBedMovement();
    const state = book({ role: "officer" });
    expect(state.rejections.length).toBe(1);
    expect(state.rejections[0]!.reason).toContain("BOOK_TRANSPORT requires role");
    expect(
      state.movements.find((candidate) => candidate.id === movementId)!.transport,
      "a refused booking must leave the movement with no transport at all",
    ).toBeUndefined();
  });

  it("refuses a role that is not a sender (the transport officer)", () => {
    // TR-D1 once refused the coordinator by name. Josh superseded that on 10 Oct 2026: the
    // coordinator may take every action. The transport officer still may not book.
    const state = book({ role: "officer" });
    expect(state.rejections.length).toBe(1);
    expect(state.movements.some((movement) => movement.transport?.escortRequired === true)).toBe(
      seedWardFlowState().movements.some((movement) => movement.transport?.escortRequired === true),
    );
  });

  it("refuses a provider that is not on the fixed list", () => {
    const state = book({ provider: "Uber" });
    expect(state.rejections.length).toBe(1);
    expect(state.rejections[0]!.reason).toContain("provider");
  });

  it("⚠️ REFUSES A MISSING ESCORT ANSWER — the whole point of the event", () => {
    // `undefined` rather than a wrong boolean, because the control opens BLANK. If the reducer
    // accepted it and stored `false`, the screen would show "no escort required" for a question
    // nobody answered — the derivation defect wearing a different hat.
    const state = book({ escortRequired: undefined });
    expect(state.rejections.length).toBe(1);
    expect(state.rejections[0]!.reason).toContain("escort");
  });

  it("refuses to book on a movement whose bed is not held yet", () => {
    const state = seedWardFlowState();
    const early = state.movements.find((candidate) => candidate.stage === "placement_requested")!;
    const booked = wardFlowReducer(state, {
      type: "BOOK_TRANSPORT",
      role: "ed",
      now: NOW,
      movementId: early.id,
      provider: TRANSPORT_PROVIDERS[0],
      escortRequired: true,
    } as never);
    expect(booked.rejections.length).toBe(1);
    expect(booked.movements.find((candidate) => candidate.id === early.id)!.transport).toBeUndefined();
  });

  it("🔴 REFUSES A HANDOVER WITH NO TRANSPORT BOOKED — the half that replaced the fabrication", () => {
    // ⚠️ THIS TEST DID NOT EXIST WHEN THE PRECONDITION DID. Removing `HANDOVER_READY`'s fabrication
    // and adding `if (!movement.transport) reject` were written together, the whole suite went
    // green, and a mutation deleting the new guard ALSO left 68 tests green. The walks were all
    // repaired to book first, so every one of them satisfied the precondition and none of them
    // tested it. **Repairing the callers of a new rule removes the only evidence the rule works.**
    const { state, movementId } = heldBedMovement();
    const before = state.movements.find((candidate) => candidate.id === movementId)!;
    expect(before.transport, "the fixture must have no transport, or this proves nothing").toBeUndefined();

    const refused = wardFlowReducer(state, {
      type: "HANDOVER_READY",
      role: "ed",
      now: NOW,
      movementId,
    } as never);
    expect(refused.rejections.length).toBe(1);
    expect(refused.rejections[0]!.reason).toContain("transport is booked");
    expect(
      refused.movements.find((candidate) => candidate.id === movementId)!.stage,
      "a refused handover must leave the stage alone",
    ).toBe("pulled");
  });

  it("allows the handover once transport IS booked, so the guard is a precondition and not a wall", () => {
    // The other direction, without which "always refuse" would satisfy the test above.
    const { movementId } = heldBedMovement();
    const booked = book();
    const ready = wardFlowReducer(booked, {
      type: "HANDOVER_READY",
      role: "ed",
      now: NOW,
      movementId,
    } as never);
    expect(ready.rejections).toEqual([]);
    expect(ready.movements.find((candidate) => candidate.id === movementId)!.stage).toBe("handover_ready");
    expect(
      ready.movements.find((candidate) => candidate.id === movementId)!.transport!.escortRequired,
      "the booked answer must survive the handover, not be recomputed by it",
    ).toBe(true);
  });

  it("refuses to book twice, because a second job would replace one a provider may have accepted", () => {
    const { movementId } = heldBedMovement();
    const once = book();
    const twice = wardFlowReducer(once, {
      type: "BOOK_TRANSPORT",
      role: "ed",
      now: NOW,
      movementId,
      provider: TRANSPORT_PROVIDERS[1],
      escortRequired: false,
    } as never);
    expect(twice.rejections.length).toBe(1);
    expect(
      twice.movements.find((candidate) => candidate.id === movementId)!.transport!.provider,
      "the first booking must survive the refused second one",
    ).toBe(TRANSPORT_PROVIDERS[0]);
  });
});
