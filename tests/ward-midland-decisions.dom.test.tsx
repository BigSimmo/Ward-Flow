import { beforeEach, describe, expect, it } from "vitest";
import {
  MIDLAND_DECISIONS_KEY,
  openReferrals,
  recordMidlandDecision,
  undoMidlandDecision,
} from "@/components/ward-management/community/team-2026/midland-decisions";
import { REFERRALS } from "@/components/ward-management/community/team-2026/midland-demo";

const read = () => JSON.parse(window.localStorage.getItem(MIDLAND_DECISIONS_KEY) ?? "{}") as Record<string, unknown>;

describe("WF-05 Accept for Midland records the decision", () => {
  beforeEach(() => window.localStorage.clear());
  it("stores the decision, so To answer drops by one after a reload", () => {
    const first = REFERRALS[0]!;
    recordMidlandDecision(first.id, "Accepted for Midland", 1);
    expect(read()[first.id]).toEqual({ id: first.id, line: "Accepted for Midland", at: 1 });
    const decided = { [first.id]: { id: first.id, line: "x", at: 1 } };
    const open = openReferrals(REFERRALS, decided);
    expect(open).toHaveLength(REFERRALS.length - 1);
    expect(open.every(({ r, index }) => REFERRALS[index] === r)).toBe(true);
    undoMidlandDecision(first.id);
    expect(read()[first.id]).toBeUndefined();
  });
});
