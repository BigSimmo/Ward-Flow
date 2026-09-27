// tests/ward-cancel-transport-no-bed-held.test.ts
//
// Catcher for the CANCEL_TRANSPORT no-bed-held defect (Opus debugger, 3b3f215ba1):
//
//   pull a bed -> book transport -> release the pull, so the movement is back at
//   `accepted_awaiting_bed` and no bed is held -> cancel the transport job.
//
// `CANCEL_TRANSPORT` installed a fresh replacement job (`<id>-replacement-1`) UNCONDITIONALLY,
// whatever stage the movement was actually at. With no bed held, `orphanedTransport`
// (`ward-derivations.ts`) kept flagging the movement forever — each further cancel just minted
// `-replacement-2`, `-replacement-3`, and so on — the officer and the receiving ward kept being
// told "a replacement is being arranged" for a patient with nowhere to go, and a re-pull's
// `BOOK_TRANSPORT` refused with "already booked" against a job nobody wanted.
//
// The fix: `CANCEL_TRANSPORT` removes the job in every case (owner answer 30). Whether the bed is
// still held is read from `admissionId` (and stage at/after `pulled`), never from stage alone —
// `STEP_BACK_STAGE` can land before `pulled` while keeping the admission (TOUCH NOTHING ELSE), and
// WFA-001 requires that cancel still say the bed is held. The no-admission branch leaves
// `STAGE_TRANSITION_BLOCKERS.accepted`; the held branch leaves `.transportCancelled`.
//
// 🔴 SUPERSEDED 2026-09-17, owner answer 30: the bed-held branch used to install a fresh
// `-replacement-N` job instead of removing it ("replace-and-carry-on"), and only the no-bed-held
// branch below (strictly before `pulled`) removed the job outright. The owner's ruling — "no
// automatic rebooking; a person books again" — removed the replacement path everywhere a bed is
// held too, so both branches now remove the job; they differ only in which `blocker` sentence they
// leave behind (`STAGE_TRANSITION_BLOCKERS.accepted` here, `.transportCancelled` where a bed is
// held). The control test below is rewritten to match. Full bed-held coverage, including
// `handover_ready` (not reachable from this file's own fixtures) and rebooking from both stages, is
// in `tests/ward-transport-cancel-no-rebook.test.ts`.
import { describe, expect, it } from "vitest";

import { orphanedTransport } from "../src/components/ward-management/ward-derivations";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import { STEP_BACK_REASONS, TRANSPORT_PROVIDERS } from "../src/components/ward-management/ward-model";
import {
  CANCEL_TRANSPORT_REASONS,
  GENDER_PLACEMENT_REASONS,
  RELEASE_PULL_REASONS,
} from "../src/components/ward-management/ward-change-reasons";

const NOW = NOW_ANCHOR;

function movement(state: WardFlowState, id: string) {
  const found = state.movements.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing movement ${id}`);
  return found;
}

// Same fixture pairing `tests/ward-cancel-transport-stage.test.ts` uses for its own
// `pulledAndBookedMovement()`: `rph-adult-secure` widened for room, `WF-012` already proven to
// pass this unit's eligibility gates with no override needed.
const CAPACITY_UNIT = "rph-adult-secure";
const CAPACITY_MOVEMENT = "WF-012";

function withRoom(state: WardFlowState, unitId: string): WardFlowState {
  return {
    ...state,
    units: state.units.map((candidate) =>
      candidate.id === unitId
        ? {
            ...candidate,
            beds: 20,
            empty: { ...candidate.empty, value: 6, confirmedAt: NOW },
            allocatable: { ...candidate.allocatable, value: 6, confirmedAt: NOW },
          }
        : candidate,
    ),
    bedReleases: state.bedReleases.filter((release) => release.unitId !== unitId),
  };
}

function pulledAndBookedMovement(movementId = CAPACITY_MOVEMENT, unitId = CAPACITY_UNIT) {
  let state = withRoom(seedWardFlowState(), unitId);
  for (const step of [
    // T12 (item 9, owner answer 17 September 2026): WF-012 is Non-binary, so referring it needs
    // a reason and a recorded ward check — the fixture predates T12 and never carried either.
    {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      unitIds: [unitId],
      genderPlacementReason: GENDER_PLACEMENT_REASONS[0],
      genderPlacementChecked: true,
    },
    { type: "ACCEPT_IN_PRINCIPLE", role: "ward", unitId },
    { type: "PULL_PATIENT", role: "ward", unitId },
  ] as const) {
    state = wardFlowReducer(state, { ...step, now: NOW, movementId } as never);
  }
  const booked = wardFlowReducer(state, {
    type: "BOOK_TRANSPORT",
    role: "ed",
    now: NOW + 1,
    movementId,
    provider: TRANSPORT_PROVIDERS[0],
    escortRequired: false,
    cadNumber: "CAD-STUB-0001",
    transportLegalStatus: "voluntary",
    estimatedAt: 0,
  });
  expect(booked.rejections, "the fixture's own walk to a booked transport was refused").toEqual([]);
  expect(movement(booked, movementId).stage).toBe("pulled");
  return { state: booked, movementId, unitId };
}

// The no-bed shape under test: a movement at `accepted_awaiting_bed` with a booked job still standing.
// Under WF-37 / Ruling 2, `RELEASE_PULL` clears linked transport immediately. To test CANCEL_TRANSPORT
// on a movement at `accepted_awaiting_bed` where transport was booked, we use `steppedBackNoBed`.
function releasedNoBed(movementId = CAPACITY_MOVEMENT, unitId = CAPACITY_UNIT) {
  return steppedBackNoBed(movementId, unitId);
}

// The other route to the same no-bed shape: `STEP_BACK_STAGE`'s own "TOUCH NOTHING ELSE" rule
// (ward-flow-reducer.ts, that case's own comment) moves only `stage`, `stageChanges` and
// `unwinds` — it never touches `transport` OR `blocker`. So a movement can land back at
// `accepted_awaiting_bed` with a booked job still standing WITHOUT ever going through
// `RELEASE_PULL`, which (since the fourth fix round) now corrects `blocker` itself. A scenario
// that only ever goes through `RELEASE_PULL` can never tell whether `CANCEL_TRANSPORT`'s OWN
// no-bed-branch `blocker` write is doing anything — this one can, because nothing upstream of
// `CANCEL_TRANSPORT` has touched `blocker` yet when it runs.
function steppedBackNoBed(movementId = CAPACITY_MOVEMENT, unitId = CAPACITY_UNIT) {
  const { state: booked } = pulledAndBookedMovement(movementId, unitId);
  const cancelledJobId = movement(booked, movementId).transport!.id;
  const steppedBack = wardFlowReducer(booked, {
    type: "STEP_BACK_STAGE",
    role: "coordinator",
    now: NOW + 2,
    movementId,
    to: "accepted_awaiting_bed",
    reason: STEP_BACK_REASONS[0],
  });
  expect(steppedBack.rejections, "the fixture's own step-back was refused").toEqual([]);
  expect(movement(steppedBack, movementId).stage).toBe("accepted_awaiting_bed");
  expect(movement(steppedBack, movementId).transport?.id).toBe(cancelledJobId);
  // Control on the control: unlike `RELEASE_PULL`, `STEP_BACK_STAGE` leaves `blocker` untouched —
  // it still reads whatever `BOOK_TRANSPORT` last wrote. Proven here, not assumed, so the test
  // below is known to start from a genuinely uncorrected value.
  expect(movement(steppedBack, movementId).blocker).toBe("Awaiting a transport provider response");
  return { state: steppedBack, movementId, unitId, cancelledJobId };
}

function cancel(state: WardFlowState, movementId: string, now: number) {
  return wardFlowReducer(state, {
    type: "CANCEL_TRANSPORT",
    role: "coordinator",
    now,
    movementId,
    reason: CANCEL_TRANSPORT_REASONS[0],
  });
}

describe("CANCEL_TRANSPORT when no bed is held", () => {
  it("removes the job rather than replacing it: transport clears, the orphan clears, the unwind still names the job", () => {
    const { state: released, movementId, cancelledJobId } = releasedNoBed();

    const cancelled = cancel(released, movementId, NOW + 3);
    expect(cancelled.rejections).toEqual([]);
    const after = movement(cancelled, movementId);

    expect(after.transport).toBeUndefined();
    expect(orphanedTransport(after)).toBeUndefined();

    const unwind = after.unwinds.at(-1);
    expect(unwind?.kind).toBe("transport_cancelled");
    expect(unwind?.transportId).toBe(cancelledJobId);

    // WFA-001 (2026-09-22): `STEP_BACK_STAGE` keeps `admissionId` (TOUCH NOTHING ELSE), so the
    // bed is still held. Cancel therefore writes `transportCancelled`, not the no-admission
    // `accepted` sentence — the same fact the officer/ward notices state ("the bed is still held").
    expect(after.blocker).toBe("Transport cancelled; not booked again yet");
  });

  it("reached via STEP_BACK_STAGE rather than RELEASE_PULL, CANCEL_TRANSPORT's own blocker write still corrects it", () => {
    // `steppedBackNoBed()` proves `blocker` is STILL the BOOK_TRANSPORT sentence right up until
    // this cancel — nothing upstream corrected it. After cancel it must name the held bed
    // (admissionId survived the step-back), not pretend no bed is held.
    const { state: steppedBack, movementId } = steppedBackNoBed();

    const cancelled = cancel(steppedBack, movementId, NOW + 3);
    expect(cancelled.rejections).toEqual([]);
    expect(movement(cancelled, movementId).blocker).toBe("Transport cancelled; not booked again yet");
  });

  it("refuses a second cancel — the job is already gone", () => {
    const { state: released, movementId } = releasedNoBed();
    const cancelled = cancel(released, movementId, NOW + 3);
    expect(cancelled.rejections).toEqual([]);

    const secondCancel = cancel(cancelled, movementId, NOW + 4);
    expect(secondCancel.rejections).toHaveLength(1);
    expect(secondCancel.rejections.at(-1)?.reason).toMatch(/has no transport job to cancel/);
    // Refused, not silently accepted: the movement is untouched by the second attempt.
    expect(movement(secondCancel, movementId)).toEqual(movement(cancelled, movementId));
  });

  it("a re-pull then BOOK_TRANSPORT succeeds, and the new job's id differs from the cancelled job's", () => {
    const { state: released, movementId, unitId, cancelledJobId } = releasedNoBed();
    const cancelled = cancel(released, movementId, NOW + 3);
    expect(cancelled.rejections).toEqual([]);

    const repulled = wardFlowReducer(cancelled, {
      type: "PULL_PATIENT",
      role: "ward",
      now: NOW + 4,
      movementId,
      unitId,
    });
    expect(repulled.rejections, "the re-pull was refused").toEqual([]);
    expect(movement(repulled, movementId).stage).toBe("pulled");

    const rebooked = wardFlowReducer(repulled, {
      type: "BOOK_TRANSPORT",
      role: "ed",
      now: NOW + 5,
      movementId,
      provider: TRANSPORT_PROVIDERS[0],
      escortRequired: false,
      cadNumber: "CAD-STUB-0001",
      transportLegalStatus: "voluntary",
      estimatedAt: 0,
    });
    expect(rebooked.rejections, "the re-booking was refused — this is the 'already booked' regression").toEqual([]);
    const rebookedJobId = movement(rebooked, movementId).transport?.id;
    expect(rebookedJobId).toBeDefined();
    expect(rebookedJobId).not.toBe(cancelledJobId);
  });

  it("tells the officer and the receiving ward, and neither notice promises a replacement", () => {
    const { state: released, movementId } = releasedNoBed();
    const before = released.notices.length;
    const cancelled = cancel(released, movementId, NOW + 3);
    expect(cancelled.rejections).toEqual([]);

    const raised = cancelled.notices.slice(before);
    expect(raised).toHaveLength(2);
    expect(raised.map((notice) => notice.kind).sort()).toEqual(
      ["transport_cancelled_officer", "transport_cancelled_ward"].sort(),
    );
    for (const notice of raised) {
      expect(notice.sentence.toLowerCase()).not.toContain("replacement");
      expect(notice.sentence.toLowerCase()).toContain("the bed is still held and nothing has been rebooked");
    }
  });

  it("control, REWRITTEN for owner answer 30 (2026-09-17): cancelling at pulled (no release) no longer replaces the job either — see tests/ward-transport-cancel-no-rebook.test.ts for the full no-automatic-rebooking suite", () => {
    // Until 2026-09-17 this test was named "still creates the replacement exactly as before" and
    // pinned `-replacement-1` here as the control against the no-bed-held branch above. Owner
    // answer 30 removed automatic rebooking everywhere a bed is held, not only where it is not, so
    // the two branches this file distinguishes (bed held vs not) now agree on the one fact that
    // matters — no job survives a cancel — and differ only in `blocker`, asserted below.
    const { state: booked, movementId } = pulledAndBookedMovement();
    const originalJobId = movement(booked, movementId).transport!.id;
    const before = booked.notices.length;

    const cancelled = cancel(booked, movementId, NOW + 3);
    expect(cancelled.rejections).toEqual([]);
    const after = movement(cancelled, movementId);

    expect(after.transport).toBeUndefined();
    expect(orphanedTransport(after)).toBeUndefined();
    // Bed IS held here (stage stayed `pulled`), so this reads the new blocker rather than the
    // no-bed-held branch's `STAGE_TRANSITION_BLOCKERS.accepted` pinned above.
    expect(after.blocker).toBe("Transport cancelled; not booked again yet");

    const unwind = after.unwinds.at(-1);
    expect(unwind?.kind).toBe("transport_cancelled");
    expect(unwind?.transportId).toBe(originalJobId);

    const raised = cancelled.notices.slice(before);
    expect(raised).toHaveLength(2);
    for (const notice of raised) {
      expect(notice.sentence.toLowerCase()).not.toContain("replacement");
      expect(notice.sentence.toLowerCase()).toContain("the bed is still held and nothing has been rebooked");
    }
  });

  it("WF-37 / Ruling 2: RELEASE_PULL clears linked transport immediately so re-allocation is never blocked", () => {
    // Owner ruling 2026-09-25: RELEASE_PULL refuses while a transport job is booked ("...has a
    // transport job booked; cancel it (CANCEL_TRANSPORT) before releasing the pull") — until this
    // ruling RELEASE_PULL cleared a linked job automatically. Cancel first; the release still lands
    // at the same end state this test has always pinned.
    const { state: booked, movementId } = pulledAndBookedMovement();
    const cancelled = cancel(booked, movementId, NOW + 2);
    expect(cancelled.rejections).toEqual([]);
    const released = wardFlowReducer(cancelled, {
      type: "RELEASE_PULL",
      role: "coordinator",
      now: NOW + 3,
      movementId,
      reason: RELEASE_PULL_REASONS[0],
    });
    expect(released.rejections).toEqual([]);
    expect(movement(released, movementId).stage).toBe("accepted_awaiting_bed");
    expect(movement(released, movementId).transport).toBeUndefined();
    expect(orphanedTransport(movement(released, movementId))).toBeUndefined();
  });
});
