import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The real panel needs a referral and the ward engine; this test only covers the lazy wrapper.
const loadAttempts = { count: 0, failFirst: true };
vi.mock("@/components/ward-management/referrals/referral-history-corrections", () => {
  loadAttempts.count += 1;
  if (loadAttempts.failFirst && loadAttempts.count === 1) throw new Error("chunk failed");
  return { ReferralHistoryAndCorrections: () => <p>History panel</p> };
});

describe("lazy referral history", () => {
  it("says when the history did not load and draws it after Try again", async () => {
    const { ReferralHistoryAndCorrections } =
      await import("@/components/ward-management/referrals/referral-history-corrections-lazy");
    const props = {} as Parameters<typeof ReferralHistoryAndCorrections>[0];
    render(<ReferralHistoryAndCorrections {...props} />);

    expect(await screen.findByTestId("ward-referral-history-load-failed")).toHaveTextContent(
      "The written history and corrections did not load.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("History panel")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-referral-history-load-failed")).not.toBeInTheDocument();
  });
});
