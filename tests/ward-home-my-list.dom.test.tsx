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
    // CB-3: the row's name is "Open referral for <name>: <visible title>".
    const name = open!.getAttribute("aria-label")!.replace(/^Open referral for (.+?): .*$/u, "$1");
    // The row keeps its Decide; the side panel the row opened holds the decision itself (item 6a).
    expect(screen.getAllByRole("link", { name: `Decide referral for ${name}` }).length).toBeGreaterThanOrEqual(1);
    expect(await screen.findByRole("region", { name: `Decide on this referral for ${name}` })).toBeInTheDocument();
  });

  it("decides in Home's panel: a plain click on Decide opens the referral here, not the board (item 6a)", async () => {
    renderHome();
    const group = screen.getByRole("region", { name: "Referrals to decide" });
    const decide = within(group).getAllByRole("link", { name: /^Decide referral for / })[0]!;
    const name = decide.getAttribute("aria-label")!.replace(/^Decide referral for /u, "");
    // The href stays for a new tab; a plain click is kept on Home.
    expect(decide.getAttribute("href")).toMatch(/referrals/u);
    expect(decide).toHaveAttribute("aria-haspopup", "dialog");
    expect(fireEvent.click(decide)).toBe(false);
    expect(await screen.findByRole("region", { name: `Decide on this referral for ${name}` })).toBeInTheDocument();
  });
});
