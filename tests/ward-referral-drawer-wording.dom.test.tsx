import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardReferralDrawer } from "@/components/ward-management/referrals/ward-referral-drawer";
import { discardReferralDraft } from "@/components/ward-management/referrals/referral-draft-cache";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(() => {
  cleanup();
  discardReferralDraft();
});

function renderDrawer() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardReferralDrawer onClose={vi.fn()} initialPatientId="PT-023" />
    </WardFlowProvider>,
  );
}

describe("new-referral drawer wording (P051, P151)", () => {
  it("P051: the rail says Before you send while items remain, not Ready to send", () => {
    renderDrawer();
    const rail = screen.getByTestId("ward-referral-summary-rail");
    expect(within(rail).getByRole("heading", { name: "Before you send" })).toBeInTheDocument();
    expect(within(rail).queryByRole("heading", { name: "Ready to send" })).toBeNull();
    // Send stays locked while items remain.
    expect(screen.getByTestId("ward-referral-send-locked")).toHaveAttribute("aria-disabled", "true");
  });

  it("P151: one '* Required' legend explains the asterisk", () => {
    renderDrawer();
    expect(screen.getAllByText("* Required")).toHaveLength(1);
  });
});
