import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// Audit 1 TS-9 (20 Oct 2026): raising a new expect flag after one was cleared kept only the new one,
// so the cleared flag's record (when it was raised and who cleared it) was lost.
describe("an expect flag raised again", () => {
  it("keeps the cleared earlier flag in its history", () => {
    const seeded = seedWardFlowState();
    const movement = seeded.movements.find((candidate) => !candidate.closure && !candidate.expectFlag);
    if (!movement) throw new Error("seed has no open movement without an expect flag");
    const movementId = movement.id;

    const raised = wardFlowReducer(seeded, {
      type: "RAISE_EXPECT_FLAG",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId,
      kind: "voluntary_48h",
    });
    const cleared = wardFlowReducer(raised, {
      type: "CLEAR_EXPECT_FLAG",
      role: "ward",
      now: NOW_ANCHOR + 60,
      movementId,
    });
    const again = wardFlowReducer(cleared, {
      type: "RAISE_EXPECT_FLAG",
      role: "coordinator",
      now: NOW_ANCHOR + 120,
      movementId,
      kind: "involuntary_7d",
    });

    expect(again.rejections).toHaveLength(cleared.rejections.length);
    const after = again.movements.find((candidate) => candidate.id === movementId)!;
    expect(after.expectFlag).toEqual({ raisedAt: NOW_ANCHOR + 120, kind: "involuntary_7d" });
    expect(after.expectFlagHistory).toEqual([
      { raisedAt: NOW_ANCHOR, kind: "voluntary_48h", clearedAt: NOW_ANCHOR + 60, clearedBy: "ward" },
    ]);
    // A saved board holding the history still loads.
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(again)))).toBe(true);
  });

  it("adds no history the first time", () => {
    const seeded = seedWardFlowState();
    const movement = seeded.movements.find((candidate) => !candidate.closure && !candidate.expectFlag)!;
    const raised = wardFlowReducer(seeded, {
      type: "RAISE_EXPECT_FLAG",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: movement.id,
      kind: "voluntary_48h",
    });
    expect(raised.movements.find((candidate) => candidate.id === movement.id)!.expectFlagHistory).toBeUndefined();
  });
});
