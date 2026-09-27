import { describe, expect, it } from "vitest";

import { buildActionInbox } from "../src/components/ward-management/ward-derivations";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import {
  inboxItemCompletionState,
  seedWardFlowState,
  wardFlowReducer,
  type InboxCompletionEntry,
} from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

function seeded() {
  return seedWardFlowState();
}

/**
 * A real row from the real fixture, exactly as `coordinator-screen.tsx` would compute it — not a
 * fabricated id, so a test asserting "the row survives" is asserting something about the actual
 * inbox rather than a string this file made up.
 */
function firstRealInboxItemId(): string {
  const state = seeded();
  const items = buildActionInbox(state.movements, NOW, state.units);
  if (items.length === 0) throw new Error("fixture produced no inbox items — pick a different row source");
  return items[0].id;
}

describe("ACKNOWLEDGE_INBOX_ITEM", () => {
  it("records who and when, not a boolean", () => {
    const state = seeded();
    const inboxItemId = firstRealInboxItemId();
    const next = wardFlowReducer(state, {
      type: "ACKNOWLEDGE_INBOX_ITEM",
      role: "coordinator",
      now: NOW,
      inboxItemId,
    });
    expect(next.rejections).toEqual([]);
    expect(next.inboxAcknowledgements[inboxItemId]).toEqual([{ at: NOW, by: "Flow coordinator" }]);
  });

  it("never removes or hides the row it acknowledges — buildActionInbox is untouched", () => {
    const state = seeded();
    const before = buildActionInbox(state.movements, NOW, state.units);
    expect(before.length, "fixture produced no inbox items to prove non-removal against").toBeGreaterThan(0);
    const inboxItemId = before[0].id;

    const next = wardFlowReducer(state, {
      type: "ACKNOWLEDGE_INBOX_ITEM",
      role: "coordinator",
      now: NOW,
      inboxItemId,
    });

    // `buildActionInbox` reads only `movements` and `units`. Acknowledging touches neither, so the
    // computed row set must come back byte-for-byte identical — this is the proof, not an inference
    // from reading the reducer's source.
    const after = buildActionInbox(next.movements, NOW, next.units);
    expect(after).toEqual(before);
    expect(after.some((item) => item.id === inboxItemId)).toBe(true);
  });

  it("is not idempotent: a second acknowledgement is a distinct fact, not a duplicate collapsed away", () => {
    const state = seeded();
    const inboxItemId = firstRealInboxItemId();
    const onceAcknowledged = wardFlowReducer(state, {
      type: "ACKNOWLEDGE_INBOX_ITEM",
      role: "coordinator",
      now: NOW,
      inboxItemId,
    });
    const twiceAcknowledged = wardFlowReducer(onceAcknowledged, {
      type: "ACKNOWLEDGE_INBOX_ITEM",
      role: "coordinator",
      now: NOW,
      inboxItemId,
    });
    expect(twiceAcknowledged.rejections).toEqual([]);
    expect(twiceAcknowledged.inboxAcknowledgements[inboxItemId]).toHaveLength(2);
  });

  /**
   * 🔴 THE TIMING TRAP. `ADVANCE_CLOCK` is the only thing that moves `now` independently, so two
   * dispatches in the same render carry the identical `at`. A join, sort or dedup keyed on `at`
   * alone would collapse these two into one and silently drop the second acknowledger's record —
   * this asserts both survive as two distinct array entries, identified by their position in the
   * append-only array rather than by `at`.
   */
  it("keeps two same-instant acknowledgements distinct — never joined or deduplicated by `at`", () => {
    const state = seeded();
    const inboxItemId = firstRealInboxItemId();
    const event: WardFlowEvent = { type: "ACKNOWLEDGE_INBOX_ITEM", role: "coordinator", now: NOW, inboxItemId };

    // Two dispatches, no ADVANCE_CLOCK between them — both events land at exactly NOW.
    const afterFirst = wardFlowReducer(state, event);
    const afterSecond = wardFlowReducer(afterFirst, event);

    const history = afterSecond.inboxAcknowledgements[inboxItemId];
    expect(history).toHaveLength(2);
    expect(history[0].at).toBe(NOW);
    expect(history[1].at).toBe(NOW);
    // Same instant, same role — and still two entries, not one. Distinctness comes from array
    // position, never from the timestamp.
    expect(history[0]).not.toBe(history[1]);
  });

  it("is refused for a role EVENT_ROLE does not permit", () => {
    const state = seeded();
    const inboxItemId = firstRealInboxItemId();
    const next = wardFlowReducer(state, {
      type: "ACKNOWLEDGE_INBOX_ITEM",
      role: "ward",
      now: NOW,
      inboxItemId,
    });
    expect(next.rejections).toHaveLength(1);
    expect(next.inboxAcknowledgements[inboxItemId]).toBeUndefined();
  });

  it("refuses a blank inboxItemId — a blank names no row", () => {
    const state = seeded();
    const next = wardFlowReducer(state, {
      type: "ACKNOWLEDGE_INBOX_ITEM",
      role: "coordinator",
      now: NOW,
      inboxItemId: "   ",
    });
    expect(next.rejections).toHaveLength(1);
  });
});

describe("COMPLETE_INBOX_ITEM and REOPEN_INBOX_ITEM", () => {
  /**
   * 🔴 **THE FOUR TESTS THAT USED TO LIVE AT THE TOP OF THIS BLOCK COMPLETED A REAL FIXTURE ROW AND
   * EXPECTED IT TO SUCCEED. THEY WENT RED ON 2026-09-06 AND THEY WERE RIGHT TO.**
   *
   * `firstRealInboxItemId()` returns `bed-pull-WF-004` — a FACT. Once every category
   * `buildActionInbox` emits was classified (`INBOX_CATEGORIES`, `ward-flow-reducer.ts`), completing
   * it became the exact act the classification exists to forbid, so the assertions asking for a
   * clean completion were asserting the defect. They are rewritten here as refusals rather than
   * repaired, because there is nothing to repair: no row this inbox can currently emit is a
   * commitment.
   *
   * ⚠️ **THAT MAKES THE SUCCESS PATHS OF `COMPLETE_INBOX_ITEM` AND `REOPEN_INBOX_ITEM` UNREACHABLE
   * TODAY, AND THAT IS A FINDING RATHER THAN A GAP IN THIS FILE.** Their mechanics — append-only
   * history, the undo, two same-instant entries staying distinct — are still covered, one layer
   * down, against `inboxItemCompletionState` directly (below), so the logic that landed with those
   * events is not left unguarded while it waits for a commitment category to exist.
   */
  it("refuses to tick off a fact row, and records nothing against it", () => {
    const state = seeded();
    const inboxItemId = firstRealInboxItemId();
    const next = wardFlowReducer(state, {
      type: "COMPLETE_INBOX_ITEM",
      role: "coordinator",
      now: NOW,
      inboxItemId,
    });
    expect(next.rejections).toHaveLength(1);
    expect(next.rejections[0].reason).toContain("live fact");
    expect(next.inboxCompletions[inboxItemId]).toBeUndefined();
    expect(inboxItemCompletionState(next.inboxCompletions[inboxItemId])).toBe("open");
  });

  it("never removes or hides the row it refuses — buildActionInbox is untouched", () => {
    const state = seeded();
    const before = buildActionInbox(state.movements, NOW, state.units);
    const inboxItemId = before[0].id;
    const next = wardFlowReducer(state, {
      type: "COMPLETE_INBOX_ITEM",
      role: "coordinator",
      now: NOW,
      inboxItemId,
    });
    expect(buildActionInbox(next.movements, NOW, next.units)).toEqual(before);
  });

  /**
   * A SECOND ATTEMPT ON THE SAME FACT ROW IS REFUSED AGAIN, NOT SWALLOWED. The old test here
   * expected the first to succeed and the second to be refused as "already complete"; both are now
   * refused for the prior reason, and both refusals are filed. A refusal that stops being recorded
   * on repetition would leave a coordinator pressing a control that silently does nothing.
   */
  it("refuses a second attempt on the same fact row, and files that refusal too", () => {
    const state = seeded();
    const inboxItemId = firstRealInboxItemId();
    const once = wardFlowReducer(state, {
      type: "COMPLETE_INBOX_ITEM",
      role: "coordinator",
      now: NOW,
      inboxItemId,
    });
    const twice = wardFlowReducer(once, {
      type: "COMPLETE_INBOX_ITEM",
      role: "coordinator",
      now: NOW + 10,
      inboxItemId,
    });
    expect(twice.rejections).toHaveLength(2);
    expect(twice.inboxCompletions[inboxItemId]).toBeUndefined();
  });

  /**
   * THE UNDO AND THE APPEND-ONLY HISTORY, PROVED AGAINST `inboxItemCompletionState` ITSELF. This is
   * the coverage the reducer-level "is undoable" test used to give, moved one layer down because
   * the reducer can no longer be driven into a completed state on any row that exists.
   *
   * 🔴 THE TIMING TRAP is asserted here too: both entries carry the identical `at`, because
   * `ADVANCE_CLOCK` is the only thing that moves `now` and a complete-then-reopen in one render is
   * two events at one instant. The state is read from the LAST array position, never by comparing
   * timestamps, so the pair must stay distinct.
   */
  it("derives complete/open from the last entry, so a reversal never erases the completion", () => {
    const completedOnly: InboxCompletionEntry[] = [{ at: NOW, by: "Flow coordinator", kind: "completed" }];
    expect(inboxItemCompletionState(completedOnly)).toBe("complete");

    // Same instant as the completion — no ADVANCE_CLOCK between them.
    const reopenedAfter: InboxCompletionEntry[] = [
      ...completedOnly,
      { at: NOW, by: "Flow coordinator", kind: "reopened" },
    ];
    expect(inboxItemCompletionState(reopenedAfter)).toBe("open");
    expect(reopenedAfter).toHaveLength(2);
    expect(reopenedAfter[0].at).toBe(reopenedAfter[1].at);
    // The completion is still readable underneath its own reversal.
    expect(reopenedAfter[0].kind).toBe("completed");

    const completedAgain: InboxCompletionEntry[] = [
      ...reopenedAfter,
      { at: NOW, by: "Flow coordinator", kind: "completed" },
    ];
    expect(inboxItemCompletionState(completedAgain)).toBe("complete");
    expect(completedAgain).toHaveLength(3);

    // No entries at all is "open" — the default every sequence-derived record in the reducer uses.
    expect(inboxItemCompletionState(undefined)).toBe("open");
    expect(inboxItemCompletionState([])).toBe("open");
  });

  it("refuses to reopen a row that is not currently complete", () => {
    const state = seeded();
    const inboxItemId = firstRealInboxItemId();
    const next = wardFlowReducer(state, {
      type: "REOPEN_INBOX_ITEM",
      role: "coordinator",
      now: NOW,
      inboxItemId,
    });
    expect(next.rejections).toHaveLength(1);
    expect(next.inboxCompletions[inboxItemId]).toBeUndefined();
  });

  /**
   * 🔴 THE TIMING TRAP, ON THE REFUSAL PATH — which is the only path a real row can reach now.
   * Two attempts on the same row in one render carry the identical `at`, because `ADVANCE_CLOCK`
   * is the only thing that moves `now`. Both must survive as two distinct rejections: a refusal
   * log that collapsed same-instant entries would tell a coordinator their second press did
   * something different from their first when it did not.
   *
   * The complete-then-reopen pair this test used to drive through the reducer is now asserted
   * against `inboxItemCompletionState` directly, above — the reducer cannot be driven into a
   * completed state on any row that exists while every category is a fact.
   */
  it("keeps two same-instant refusals distinct — never joined or collapsed by `at`", () => {
    const state = seeded();
    const inboxItemId = firstRealInboxItemId();
    const event = { type: "COMPLETE_INBOX_ITEM", role: "coordinator", now: NOW, inboxItemId } as const;

    // Two dispatches, no ADVANCE_CLOCK between them — both land at exactly NOW.
    const afterFirst = wardFlowReducer(state, event);
    const afterSecond = wardFlowReducer(afterFirst, event);

    expect(afterSecond.rejections).toHaveLength(2);
    expect(afterSecond.rejections[0].at).toBe(NOW);
    expect(afterSecond.rejections[1].at).toBe(NOW);
    expect(afterSecond.rejections[0].id).not.toBe(afterSecond.rejections[1].id);
    expect(afterSecond.inboxCompletions[inboxItemId]).toBeUndefined();
  });

  it("is refused for a role EVENT_ROLE does not permit", () => {
    const state = seeded();
    const inboxItemId = firstRealInboxItemId();
    const next = wardFlowReducer(state, {
      type: "COMPLETE_INBOX_ITEM",
      role: "ed",
      now: NOW,
      inboxItemId,
    });
    expect(next.rejections).toHaveLength(1);
    expect(next.inboxCompletions[inboxItemId]).toBeUndefined();
  });

  /**
   * 🔴 THE SAFETY PROPERTY THIS WHOLE PACKAGE EXISTS FOR: nobody may silence a live legal breach by
   * ticking a box. Acknowledging and completing are two INDEPENDENT tracks — completing a row must
   * never erase, shadow or otherwise disturb an acknowledgement already recorded against the same
   * row. This is proved in both directions in the report accompanying this change: this assertion
   * is the direction a passing suite can check; the other direction (deliberately breaking the
   * isolation and watching this go red) was done by hand against this exact test and is not
   * re-enacted here, because a committed test cannot commit its own counter-example.
   */
  it("completing a row never touches an existing acknowledgement of the same row", () => {
    const state = seeded();
    const inboxItemId = firstRealInboxItemId();
    const acknowledged = wardFlowReducer(state, {
      type: "ACKNOWLEDGE_INBOX_ITEM",
      role: "coordinator",
      now: NOW,
      inboxItemId,
    });
    expect(acknowledged.inboxAcknowledgements[inboxItemId]).toHaveLength(1);

    const completed = wardFlowReducer(acknowledged, {
      type: "COMPLETE_INBOX_ITEM",
      role: "coordinator",
      now: NOW + 1,
      inboxItemId,
    });

    // ⚠️ **THIS NOW PASSES FOR A SECOND REASON AS WELL, AND THE READER MUST NOT BE LEFT TO GUESS
    // WHICH.** Since the classification landed, the completion above is REFUSED outright (the row
    // is a fact), so the acknowledgement would survive even if the two tracks were not independent.
    // The refusal is asserted first, so this test states which world it is in; the isolation
    // property itself is still worth asserting for the day a commitment row exists.
    expect(completed.rejections).toHaveLength(1);
    // The acknowledgement survives, untouched, exactly as it was before the attempt.
    expect(completed.inboxAcknowledgements[inboxItemId]).toEqual(acknowledged.inboxAcknowledgements[inboxItemId]);
    expect(completed.inboxAcknowledgements[inboxItemId]).toHaveLength(1);
  });

  it("refuses a blank inboxItemId on both COMPLETE and REOPEN", () => {
    const state = seeded();
    const completedBlank = wardFlowReducer(state, {
      type: "COMPLETE_INBOX_ITEM",
      role: "coordinator",
      now: NOW,
      inboxItemId: "",
    });
    expect(completedBlank.rejections).toHaveLength(1);

    const reopenedBlank = wardFlowReducer(state, {
      type: "REOPEN_INBOX_ITEM",
      role: "coordinator",
      now: NOW,
      inboxItemId: "",
    });
    expect(reopenedBlank.rejections).toHaveLength(1);
  });
});
