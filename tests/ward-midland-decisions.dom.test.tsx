import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearWardFlowDemoState } from "@/components/ward-management/ward-flow-demo-storage";
import {
  MIDLAND_DECISIONS_KEY,
  midlandSavedLine,
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

// SD-06 (audit, 5 Nov 2026): Midland's decisions belong to the demonstration day, so Reset demo
// (which clears the saved day) clears them too, in storage and in this page's memory.
describe("Reset demo clears Midland's decisions", () => {
  beforeEach(() => window.localStorage.clear());
  it("removes the stored decisions with the saved day", () => {
    const first = REFERRALS[0]!;
    recordMidlandDecision(first.id, "Accepted for Midland", 1);
    expect(read()[first.id]).toBeDefined();
    expect(clearWardFlowDemoState()).toBe(true);
    expect(window.localStorage.getItem(MIDLAND_DECISIONS_KEY)).toBeNull();
    expect(openReferrals(REFERRALS, {})).toHaveLength(REFERRALS.length);
  });
});

describe("WF-05 Accept toast is honest about where it saved", () => {
  it("says the decision is saved in this browser, not a shared save time", () => {
    expect(midlandSavedLine(true)).toBe("Saved in this browser · moved to Answered");
    expect(midlandSavedLine(false)).toBe("Saved in this browser");
    expect(midlandSavedLine(true)).not.toMatch(/\d{2}:\d{2}/);
  });
});

describe("a decision this browser could not store", () => {
  it("reports it as kept for this visit only", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    try {
      expect(recordMidlandDecision(REFERRALS[0]!.id, "Accepted for Midland", 1)).toBe(false);
    } finally {
      setItem.mockRestore();
    }
    expect(recordMidlandDecision(REFERRALS[0]!.id, "Accepted for Midland", 2)).toBe(true);
    undoMidlandDecision(REFERRALS[0]!.id);
    expect(midlandSavedLine(true, false)).toBe(
      "Kept for this visit only: this browser could not save it · moved to Answered",
    );
  });
});

describe("the phone Answered list", () => {
  beforeEach(() => window.localStorage.clear());
  it("shows a referral answered on this device", async () => {
    const { render, screen, fireEvent, cleanup } = await import("@testing-library/react");
    const { MidlandPhone } = await import("@/components/ward-management/community/team-2026/midland-phone");
    const first = REFERRALS[0]!;
    recordMidlandDecision(first.id, "Accepted for Midland", Date.now());
    render(<MidlandPhone section="referrals" open={vi.fn()} onRecordContact={vi.fn()} onReferFromTeam={vi.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: /Answered/u }));
    expect(screen.getByText("Accepted for Midland")).toBeTruthy();
    expect(screen.getAllByText(first.n).length).toBeGreaterThan(0);
    cleanup();
    undoMidlandDecision(first.id);
  });
});

describe("the phone home Act now list", () => {
  beforeEach(() => window.localStorage.clear());
  it("drops the overdue Sallowfield referral once it is answered", async () => {
    const { render, screen, cleanup } = await import("@testing-library/react");
    const { MidlandPhone } = await import("@/components/ward-management/community/team-2026/midland-phone");
    const props = { section: "home", open: vi.fn(), onRecordContact: vi.fn(), onReferFromTeam: vi.fn() } as const;
    render(<MidlandPhone {...props} />);
    expect(screen.queryByText("Referral past its answer time")).toBeTruthy();
    cleanup();
    recordMidlandDecision("r1", "Accepted for Midland", Date.now());
    render(<MidlandPhone {...props} />);
    expect(screen.queryByText("Referral past its answer time")).toBeNull();
    cleanup();
    undoMidlandDecision("r1");
  });
});
