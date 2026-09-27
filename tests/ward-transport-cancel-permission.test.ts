import { describe, expect, it } from "vitest";

import { EVENT_ROLE } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";

/**
 * WHO MAY CANCEL A TRANSPORT — `TR-D6`, owner, 2026-08-30, verbatim from the register:
 *
 *   *"A TRANSPORT MAY BE CANCELLED BY THE TEAM THAT BOOKED IT AND BY THE COORDINATOR. The sending
 *   team owns the job (`TR-D5`), so it may undo it; the coordinator is the only role that sees the
 *   whole picture and is therefore the only one positioned to notice a booking that has become
 *   wrong.* ⚠️ *The receiving ward may NOT cancel — it did not book it, and a booking cancelled by
 *   the destination is indistinguishable on the sending board from one that failed."*
 *
 * ⚠️ **THE CODE IMPLEMENTED THE EXACT INVERSE, AND IT LOOKED ENTIRELY REASONABLE.** The reducer
 * permitted a `ward` caller only when its stated unit MATCHED `movement.acceptedUnitId` — that is,
 * only the receiving ward, the one role the ruling excludes — and rejected every other ward. It
 * carried a careful comment about claim-not-proof discipline while doing it. Nothing was sloppy;
 * the rule was simply backwards, and "a ward may act on its own patient" is such a natural
 * sentence that it reads as correct in review.
 *
 * ⚠️ **AND THE HARM IS NOT ABSTRACT, WHICH IS WHY THE OWNER GAVE A REASON RATHER THAN A RULE.** A
 * cancellation by the destination looks, from the sending department, exactly like a booking that
 * failed. The sending team cannot tell "they changed their mind" from "it never went through", so
 * it re-books — or does not, and waits for a vehicle nobody is sending.
 *
 * The sending team is an emergency department: `Movement.originEdId` is required, so every
 * movement in this model originates at one. Hence `["coordinator", "ed"]`.
 *
 * 🔴 **WIDENED 2026-09-15, owner ruling WLQ-11: "whoever booked transport may cancel it; the
 * receiving ward still may not."** The paragraph above is still exactly right about the RECEIVING
 * ward — that exclusion is unchanged and re-tested below — but `["coordinator", "ed"]` is no
 * longer the whole list. A `ward` can also book a job (`BOOK_TRANSPORT`'s own role list has always
 * included it, TR-D1/TR-D5), and until now the ONLY ward that could ever cancel one was none at
 * all: `ward` was absent from `EVENT_ROLE.CANCEL_TRANSPORT` outright, so a ward that booked its
 * own transport could not undo it either — TR-D6 solved the receiving-ward problem by removing a
 * role the booking ward also needed.
 *
 * `ward` is now back in the list, but the identity check moved from the role gate into the
 * reducer: `BOOK_TRANSPORT` records `transport.bookedBy` (the booking ward's own `actingUnitId`
 * claim, same discipline as everywhere else), and `CANCEL_TRANSPORT`'s `ward` branch compares the
 * caller's claim against it. A pre-existing (seeded) transport job carries no `bookedBy` at all,
 * so every ward is refused on one — TR-D6's original coordinator/ED-only rule, unchanged there.
 */
const NOW = NOW_ANCHOR;
const ACCEPTING_UNIT = "fre-adult-open";

/**
 * ⚠️ HOW A CANCELLATION IS RECORDED, because my first draft of this file asserted the wrong thing
 * and the coordinator case failed while being permitted.
 *
 * `CANCEL_TRANSPORT` does NOT set `transport.cancelledAt`. It unwinds exactly one reservation —
 * appending a `transport_cancelled` entry to `movement.unwinds` with the role and the reason — and
 * immediately issues a REPLACEMENT job, because the movement still needs transporting. That is the
 * `UnwindRecord` contract working as designed: the movement survives, keeps its acceptance, and the
 * cancelled job stays named in the audit trail.
 *
 * `cancelledAt` is set by a different event entirely — an examination whose outcome closes the
 * movement — where the transport is cancelled as a CONSEQUENCE rather than as an act. Six screens
 * render "Cancelled" from that flag, and none of them is describing this event.
 *
 * So the observable here is the unwind record, never the flag.
 */

/** A movement carried to a booked transport job by the real event path, not hand-assembled. */
function withBookedTransport(): { state: WardFlowState; movementId: string } {
  const movementId = "WF-001";
  const events = [
    { type: "REFER_TO_UNITS", role: "coordinator", unitIds: [ACCEPTING_UNIT] },
    { type: "ACCEPT_IN_PRINCIPLE", role: "ward", unitId: ACCEPTING_UNIT },
    { type: "PULL_PATIENT", role: "ward", unitId: ACCEPTING_UNIT },
    // Booking is a step of its own since 2026-08-31: `HANDOVER_READY` used to fabricate the
    // transport job and answer the escort question by deriving it from legal status. It no
    // longer invents either, so a walk that reaches handover without booking is refused.
    {
      type: "BOOK_TRANSPORT",
      role: "ed",
      provider: "Ambulance service",
      escortRequired: true,
      // Owner's third ruling, 2026-09-17: required and never defaulted.
      cadNumber: "CAD-2026-0001",
      transportLegalStatus: "voluntary",
      estimatedAt: NOW + 30,
    },
    { type: "HANDOVER_READY", role: "ed" },
    { type: "TRANSPORT_ACCEPTED", role: "officer" },
  ] as const;

  let state = seedWardFlowState();
  for (const event of events) {
    state = wardFlowReducer(state, { ...event, now: NOW, movementId } as never);
  }
  return { state, movementId };
}

/**
 * A SECOND MOVEMENT, BOOKED BY A WARD RATHER THAN THE SENDING ED — the fixture WLQ-11 actually
 * needs. `BOOKING_WARD` is deliberately a DIFFERENT unit from `ACCEPTING_UNIT`: TR-D1 books
 * transport for whoever is SENDING the patient, not the receiving ward, and a fixture where the
 * same unit did both would not exercise "the receiving ward still may not" at all.
 */
const BOOKING_WARD = "rph-adult-secure";

function withWardBookedTransport(): { state: WardFlowState; movementId: string } {
  const movementId = "WF-001";
  const events = [
    { type: "REFER_TO_UNITS", role: "coordinator", unitIds: [ACCEPTING_UNIT] },
    { type: "ACCEPT_IN_PRINCIPLE", role: "ward", unitId: ACCEPTING_UNIT },
    { type: "PULL_PATIENT", role: "ward", unitId: ACCEPTING_UNIT },
    {
      type: "BOOK_TRANSPORT",
      role: "ward",
      provider: "Ambulance service",
      escortRequired: true,
      actingUnitId: BOOKING_WARD,
      cadNumber: "CAD-2026-0002",
      transportLegalStatus: "voluntary",
      estimatedAt: NOW + 30,
    },
  ] as const;

  let state = seedWardFlowState();
  for (const event of events) {
    state = wardFlowReducer(state, { ...event, now: NOW, movementId } as never);
  }
  return { state, movementId };
}

/**
 * A THIRD MOVEMENT, BOOKED BY A COMMUNITY TEAM — owner's third ruling, 2026-09-17 (answer 9):
 * "only the community team that booked transport may cancel it." `BOOKING_TEAM` is a real,
 * derived team id (`COMMUNITY_TEAM_PAGES[0]`), never a hand-typed slug — the reducer's
 * `communityTeamById` check would refuse an invented one.
 */
const BOOKING_TEAM = COMMUNITY_TEAM_PAGES[0]!.id;
const OTHER_TEAM = COMMUNITY_TEAM_PAGES[1]!.id;

function withCommunityBookedTransport(): { state: WardFlowState; movementId: string } {
  const movementId = "WF-001";
  const events = [
    { type: "REFER_TO_UNITS", role: "coordinator", unitIds: [ACCEPTING_UNIT] },
    { type: "ACCEPT_IN_PRINCIPLE", role: "ward", unitId: ACCEPTING_UNIT },
    { type: "PULL_PATIENT", role: "ward", unitId: ACCEPTING_UNIT },
    {
      type: "BOOK_TRANSPORT",
      role: "community",
      provider: "Ambulance service",
      escortRequired: true,
      actingPlaceId: BOOKING_TEAM,
      cadNumber: "CAD-2026-0003",
      transportLegalStatus: "voluntary",
      estimatedAt: NOW + 30,
    },
  ] as const;

  let state = seedWardFlowState();
  for (const event of events) {
    state = wardFlowReducer(state, { ...event, now: NOW, movementId } as never);
  }
  return { state, movementId };
}

function cancel(state: WardFlowState, movementId: string, role: string, actingUnitId?: string, actingPlaceId?: string) {
  return wardFlowReducer(state, {
    type: "CANCEL_TRANSPORT",
    role,
    now: NOW,
    movementId,
    reason: "destination_changed",
    ...(actingUnitId === undefined ? {} : { actingUnitId }),
    ...(actingPlaceId === undefined ? {} : { actingPlaceId }),
  } as never);
}

function unwinds(state: WardFlowState, movementId: string) {
  const movement = state.movements.find((candidate) => candidate.id === movementId);
  return (movement?.unwinds ?? []).filter((entry) => entry.kind === "transport_cancelled");
}

describe("who may cancel a transport", () => {
  const { state, movementId } = withBookedTransport();
  const movement = state.movements.find((candidate) => candidate.id === movementId);

  it("reaches a real booked transport job, or every assertion below is vacuous", () => {
    // ⚠️ The canary. A walk that was rejected leaves no transport job, and then EVERY cancel below
    // is refused for "no transport job to cancel" — which would look exactly like a permission
    // rule working perfectly while testing nothing at all.
    expect(state.rejections, "the setup walk must be accepted in full").toEqual([]);
    expect(movement?.transport, "there must be a transport job to cancel").toBeDefined();
    expect(movement?.transport?.cancelledAt).toBeUndefined();
    expect(
      movement?.acceptedUnitId,
      "the movement must be accepted somewhere, or 'the receiving ward' names nobody",
    ).toBe(ACCEPTING_UNIT);
  });

  it("lets the COORDINATOR cancel — the only role that sees the whole picture", () => {
    const after = cancel(state, movementId, "coordinator");
    expect(after.rejections).toEqual([]);
    expect(unwinds(after, movementId)).toHaveLength(1);
    expect(unwinds(after, movementId)[0]).toMatchObject({ by: "coordinator", reason: "destination_changed" });
  });

  it("lets the SENDING EMERGENCY DEPARTMENT cancel — it booked the job, so it may undo it", () => {
    const after = cancel(state, movementId, "ed");
    expect(after.rejections).toEqual([]);
    expect(unwinds(after, movementId)).toHaveLength(1);
    expect(unwinds(after, movementId)[0]).toMatchObject({ by: "ed", reason: "destination_changed" });
  });

  it("⚠️ REFUSES THE RECEIVING WARD, which is the whole of TR-D6", () => {
    const after = cancel(state, movementId, "ward", ACCEPTING_UNIT);
    expect(
      after.rejections.length,
      "the receiving ward cancelled a transport it did not book. From the sending department that " +
        "is indistinguishable from a booking that failed, so they cannot tell 'they changed their " +
        "mind' from 'it never went through' — they re-book, or wait for a vehicle nobody is " +
        "sending. TR-D6 excludes this role by name.",
    ).toBe(1);
    expect(unwinds(after, movementId), "the job must be untouched, not merely reported as refused").toEqual([]);
  });

  it("refuses ANY ward, not only the receiving one — a ward is never the booking team here", () => {
    // Stated separately because "refuses the accepted unit" is satisfied by a rule that permits
    // every OTHER ward, which is precisely the inverted rule this file replaced.
    const after = cancel(state, movementId, "ward", "rph-adult-secure");
    expect(after.rejections.length).toBe(1);
    expect(unwinds(after, movementId)).toEqual([]);
  });

  it("names exactly the four permitted roles in the permission table — WLQ-11 re-admits `ward`, the third ruling admits `community`", () => {
    // `ward` reappearing here is NOT TR-D6 reversed: TR-D6's harm was a role gate that could not
    // tell the receiving ward from the booking one, so it excluded every ward to be safe. WLQ-11
    // puts the identity check in the reducer instead (`transport.bookedBy`), so the role gate can
    // safely admit `ward` again — the two tests below prove the receiving ward is still refused.
    //
    // 🔴 `community` ADDED — owner's third ruling, 2026-09-17 (answer 9): "only the community team
    // that booked transport may cancel it." This test used to assert `community` was absent for
    // want of an identity claim; `actingPlaceId` (`BOOK_TRANSPORT`/`CANCEL_TRANSPORT`, same
    // claim-not-proof discipline as `actingUnitId`) is what closes that gap — see the
    // "who may cancel a COMMUNITY-booked transport" describe block below.
    expect([...EVENT_ROLE.CANCEL_TRANSPORT].sort()).toEqual(["community", "coordinator", "ed", "ward"]);
  });

  it("still REQUIRES a reason — TR-D6 says that must not be weakened to optional", () => {
    const after = wardFlowReducer(state, {
      type: "CANCEL_TRANSPORT",
      role: "coordinator",
      now: NOW,
      movementId,
    } as never);
    expect(after.rejections.length).toBe(1);
    expect(unwinds(after, movementId)).toEqual([]);
  });
});

describe("WLQ-11 (owner, 2026-09-15): whoever booked transport may cancel it", () => {
  it("lets the BOOKING WARD cancel — it booked the job, exactly like the sending ED could already", () => {
    const { state, movementId } = withWardBookedTransport();
    expect(state.rejections, "the ward-booked setup walk must be accepted in full, or this proves nothing").toEqual([]);
    const after = cancel(state, movementId, "ward", BOOKING_WARD);
    expect(after.rejections).toEqual([]);
    expect(unwinds(after, movementId)).toHaveLength(1);
    expect(unwinds(after, movementId)[0]).toMatchObject({ by: "ward", reason: "destination_changed" });
  });

  it("STILL REFUSES the RECEIVING ward on a job a different ward booked — the WLQ-11 half of TR-D6", () => {
    const { state, movementId } = withWardBookedTransport();
    const after = cancel(state, movementId, "ward", ACCEPTING_UNIT);
    expect(
      after.rejections.length,
      "the receiving ward did not book this job — a DIFFERENT ward did — so WLQ-11 excludes it " +
        "exactly as TR-D6 always excluded the receiving ward from an ED-booked job",
    ).toBe(1);
    expect(unwinds(after, movementId)).toEqual([]);
  });

  it("refuses a THIRD ward that is neither the booker nor the receiver", () => {
    const { state, movementId } = withWardBookedTransport();
    const after = cancel(state, movementId, "ward", "gh-adult-open");
    expect(after.rejections.length).toBe(1);
    expect(unwinds(after, movementId)).toEqual([]);
  });

  it("refuses a WARD on a PRE-EXISTING job with no recorded booker — TR-D6's original rule, unchanged", () => {
    // `withBookedTransport()` (top of file) books as `ed`, which is how every transport job in
    // this suite was booked before WLQ-11 existed — and it still records `bookedBy: { role: "ed" }`
    // rather than nothing, so this case is really about a ward's claim never matching an `ed`
    // booker, not about a genuinely unbooked job. The seeded-fixture case (no `bookedBy` at all)
    // is the one WLQ-11's brief calls out by name, and it is the same refusal for the same reason:
    // a ward whose claim cannot be matched against the recorded booker is refused, never guessed at.
    const { state, movementId } = withBookedTransport();
    const after = cancel(state, movementId, "ward", ACCEPTING_UNIT);
    expect(after.rejections.length).toBe(1);
    expect(unwinds(after, movementId)).toEqual([]);
  });

  it("still lets the COORDINATOR and the booking ED cancel a WARD-booked job — their rights are unconditional", () => {
    const { state, movementId } = withWardBookedTransport();
    const byCoordinator = cancel(state, movementId, "coordinator");
    expect(byCoordinator.rejections).toEqual([]);
    const byEd = cancel(state, movementId, "ed");
    expect(byEd.rejections).toEqual([]);
  });
});

describe("owner's third ruling (2026-09-17, answer 9): a community team may cancel only a booking it logged", () => {
  it("lets the BOOKING TEAM cancel — it logged the job, exactly like a booking ward could already", () => {
    const { state, movementId } = withCommunityBookedTransport();
    expect(
      state.rejections,
      "the community-booked setup walk must be accepted in full, or this proves nothing",
    ).toEqual([]);
    const after = cancel(state, movementId, "community", undefined, BOOKING_TEAM);
    expect(after.rejections).toEqual([]);
    expect(unwinds(after, movementId)).toHaveLength(1);
    expect(unwinds(after, movementId)[0]).toMatchObject({ by: "community", reason: "destination_changed" });
  });

  it("REFUSES A DIFFERENT community team on a job this one did not book", () => {
    const { state, movementId } = withCommunityBookedTransport();
    const after = cancel(state, movementId, "community", undefined, OTHER_TEAM);
    expect(
      after.rejections.length,
      "a community team that did not book this job cancelled it — indistinguishable, from the " +
        "booking team's board, from a booking that failed",
    ).toBe(1);
    expect(unwinds(after, movementId)).toEqual([]);
  });

  it("REQUIRES actingPlaceId from a community canceller — an unnamed claim can never be matched", () => {
    const { state, movementId } = withCommunityBookedTransport();
    const after = cancel(state, movementId, "community");
    expect(after.rejections.length).toBe(1);
    expect(unwinds(after, movementId)).toEqual([]);
  });

  it("refuses a community canceller on a job with no recorded booker at all (a pre-existing/ED-booked job)", () => {
    const { state, movementId } = withBookedTransport();
    const after = cancel(state, movementId, "community", undefined, BOOKING_TEAM);
    expect(after.rejections.length).toBe(1);
    expect(unwinds(after, movementId)).toEqual([]);
  });

  it("still lets the COORDINATOR and the booking ED cancel a COMMUNITY-booked job — their rights are unconditional", () => {
    const { state, movementId } = withCommunityBookedTransport();
    const byCoordinator = cancel(state, movementId, "coordinator");
    expect(byCoordinator.rejections).toEqual([]);
    const byEd = cancel(state, movementId, "ed");
    expect(byEd.rejections).toEqual([]);
  });

  it("STILL REFUSES a ward on a job a community team booked — the community claim and the unit claim never cross-match", () => {
    const { state, movementId } = withCommunityBookedTransport();
    const after = cancel(state, movementId, "ward", ACCEPTING_UNIT);
    expect(after.rejections.length).toBe(1);
    expect(unwinds(after, movementId)).toEqual([]);
  });
});
