import { describe, expect, it } from "vitest";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { checkSyntheticPayload } from "@/lib/synthetic-data-guard";

// The scenario file refuses anything the synthetic-data guard flags, so the seeded demo state must
// pass it, or a fresh scenario could never be saved.
describe("ward flow seed passes the synthetic-data guard", () => {
  it("passes seedWardFlowState() without false positives", () => {
    const result = checkSyntheticPayload(seedWardFlowState());
    expect(result.safe).toBe(true);
  });
});
