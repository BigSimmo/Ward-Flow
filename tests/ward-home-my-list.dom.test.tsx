import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function renderHome() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CoordinatorScreen />
    </WardFlowProvider>,
  );
}

describe("Home My List referral rows (D-92, Josh 31 Oct 2026)", () => {
  it("opens a referral in the side panel; only Decide goes to the Referrals board", async () => {
    renderHome();
    const group = screen.getByRole("region", { name: "Referrals to decide" });
    const open = within(group).getAllByRole("button", { name: /^Open referral for /u })[0];
    expect(open, "the seed must hold a referral awaiting a decision").toBeDefined();
    // The row itself is a button, not a link away from Home.
    expect(within(group).queryAllByRole("link", { name: /^Open referral for /u })).toHaveLength(0);
    const decide = within(group).getAllByRole("link", { name: /^Decide referral for / })[0]!;
    expect(decide.getAttribute("href")).toMatch(/referrals/u);

    fireEvent.click(open!);
    expect(open).toHaveAttribute("aria-current", "true");
    const name = open!.getAttribute("aria-label")!.replace(/^Open referral for /u, "");
    const panelDecide = await screen.findAllByRole("link", { name: `Decide referral for ${name}` });
    // One Decide in the row, one in the side panel the row opened.
    expect(panelDecide.length).toBeGreaterThanOrEqual(2);
  });
});
