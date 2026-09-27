import type { ReactNode } from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Same reason as every sibling community dom suite: this screen renders next/link anchors and
// jsdom cannot provide an App Router context.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { CommunityScreen } from "@/components/ward-management/community/community-screen";
import { communityTeamSlug } from "@/components/ward-management/community/community-derivations";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * F10 (Opus adversarial review, 2026-09-17) / item 48: `community_referral_received` notices have
 * nowhere else to be seen — `WardChromeRole` has no "community" member, so the team's own page
 * (`CommunityScreen`, `/community/[teamId]`) is where RB4 asks for them to be listed, with
 * "Mark as read".
 */
const TEAM_NAME = "Mead Centre (Armadale)";
const TEAM_ID = communityTeamSlug(TEAM_NAME);

function Seeder({ movementId }: { movementId: string }) {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      data-testid="seed-referral"
      onClick={() =>
        dispatch({
          type: "REFER_TO_COMMUNITY_TEAM",
          role: "ed",
          now,
          movementId,
          team: TEAM_NAME,
        })
      }
    >
      seed
    </button>
  );
}

function renderTeamPage() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Seeder movementId="WF-003" />
      <CommunityScreen teamId={TEAM_ID} />
    </WardFlowProvider>,
  );
}

describe("a community team sees its own notices and can mark them read", () => {
  it("shows nothing before any referral has been raised", () => {
    renderTeamPage();
    expect(screen.queryByTestId("ward-community-notices")).not.toBeInTheDocument();
  });

  it("lists the notice with the plan's own wording, and marking it read removes the button", () => {
    renderTeamPage();
    fireEvent.click(screen.getByTestId("seed-referral"));

    const section = screen.getByTestId("ward-community-notices");
    expect(section).toHaveTextContent("1 unread");
    expect(section).toHaveTextContent(`referred a patient for community follow-up: referral`);

    // RB4's own wording: the referral is also on this team's real waiting list, not only in the
    // notice inbox — the two are separate facts and both must hold.
    const waitingFigure = screen.getByText("Waiting for an answer").closest('[data-ward-primitive="figure"]');
    expect(waitingFigure).not.toBeNull();
    expect(waitingFigure).toHaveTextContent("1");

    fireEvent.click(screen.getByRole("button", { name: "Mark as read" }));
    expect(section).toHaveTextContent("0 unread");
    expect(section).toHaveTextContent("Read");
    expect(screen.queryByRole("button", { name: "Mark as read" })).not.toBeInTheDocument();
  });

  it("never lists a notice addressed to a different team", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Seeder movementId="WF-003" />
        <CommunityScreen teamId={communityTeamSlug("Bentley Adult Mental Health")} />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("seed-referral"));
    expect(screen.queryByTestId("ward-community-notices")).not.toBeInTheDocument();
  });
});

describe("the reducer addresses the notice this screen reads", () => {
  it("keeps the placeId a slug this screen's own teamId matches", () => {
    const before = seedWardFlowState();
    const after = wardFlowReducer(before, {
      type: "REFER_TO_COMMUNITY_TEAM",
      role: "ed",
      now: NOW_ANCHOR,
      movementId: "WF-003",
      team: TEAM_NAME,
    });
    const notice = after.notices.find((n) => n.kind === "community_referral_received")!;
    expect(notice.to).toEqual({ role: "community", placeId: TEAM_ID });
  });
});
