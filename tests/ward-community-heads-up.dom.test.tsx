import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { communityTeamById } from "@/components/ward-management/community/community-derivations";
import { HomeTeamHeadsUpCard } from "@/components/ward-management/home-team-heads-up-card";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * Item 46 (D-133): the team page card shows the ED name and time, and nothing for another team.
 * D-141 (11 Nov 2026): it leads with the patient's UMRN in Geist Mono, never their name.
 */
describe("home team heads-up card", () => {
  it("lists the open-episode patient in ED on the Midland page: UMRN, ED name and time only", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <HomeTeamHeadsUpCard team={communityTeamById("midland")!} now={NOW_ANCHOR} />
      </WardFlowProvider>,
    );
    const items = screen.getAllByTestId("ward-community-heads-up-item");
    expect(items).toHaveLength(1);
    expect(items[0]!.textContent).toMatch(/^UM\d{6} is in Armadale ED since \d{2}:\d{2}( yesterday)?$/u);
    const umrn = items[0]!.querySelector("span span");
    expect(umrn?.textContent).toMatch(/^UM\d{6}$/u);
    expect(umrn?.className).toMatch(/umrn/u);
    expect(screen.getByRole("heading", { name: "Your patients in ED" })).toBeInTheDocument();
  });

  it("renders nothing for a team with no open-episode patient in ED", () => {
    const { container } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <HomeTeamHeadsUpCard team={communityTeamById("bentley")!} now={NOW_ANCHOR} />
      </WardFlowProvider>,
    );
    expect(container.querySelector('[data-testid="ward-community-heads-up"]')).toBeNull();
  });
});
