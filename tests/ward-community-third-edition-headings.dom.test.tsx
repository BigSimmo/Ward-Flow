import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { CommunityScreen } from "@/components/ward-management/community/community-screen";
import { wardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * 🔴 THE COMMUNITY SCREEN'S V2 SOVEREIGN OPERATIONAL TABS AND CHROME.
 * Modernized from third-edition headings to assert the 5 Sovereign operational tabs,
 * 4 Sovereign action buttons, 6 telemetry capsules, and coordinator subtitle.
 */

const SOVEREIGN_TABS = [
  "Waiting for the team's answer",
  "In a bed or holding one",
  "Expected back",
  "Active Caseload & CTOs",
  "This team",
] as const;

const SOVEREIGN_ACTIONS = ["Intake New Referral", "Record Contact", "CTO Register", "Catchment MDT"] as const;

const SOVEREIGN_TELEMETRY = ["Caseload", "Triage", "Inpatients", "Egress", "CTOs", "Crisis"] as const;

/** The wordings the third edition and sovereign console replaced. */
const RETIRED_HEADINGS = [
  "Waiting for your answer",
  "Worth your attention",
  "Ours, in a bed or holding one",
  "Admitted while already with this team",
  "Discharged into the area",
] as const;

/** Tile wordings the third edition replaced. */
const RETIRED_TILES = [
  "Waiting for your answer",
  "Ours, in a bed or holding one",
  "Admitted while already with this team",
  "Discharged into the area",
] as const;

function renderTeam(teamId: string) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CommunityScreen teamId={teamId} />
    </WardFlowProvider>,
  );
}

describe("the community team screen's V2 Sovereign operational tabs", () => {
  const team = COMMUNITY_TEAM_PAGES[0];

  it("has a team to render, so every assertion below walks something", () => {
    expect(COMMUNITY_TEAM_PAGES.length, "no community team pages — every case below would be vacuous").toBeGreaterThan(
      1,
    );
    expect(team.id, "the first team page has no id to route to").toBeTruthy();
  });

  it("renders the 5 V2 Sovereign operational tabs, and each is actually visible", () => {
    renderTeam(team.id);

    for (const tabName of SOVEREIGN_TABS) {
      const found = screen.getByRole("tab", { name: new RegExp(tabName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") });
      expect(
        found,
        `the Sovereign console draws tab "${tabName}" and the screen does not render it`,
      ).toBeInTheDocument();
      expect(found, `tab "${tabName}" is in the document but not visible`).toBeVisible();
    }
  });

  it("no longer renders any retired wording", () => {
    renderTeam(team.id);

    for (const retired of RETIRED_HEADINGS) {
      expect(
        screen.queryByRole("heading", { name: retired }),
        `"${retired}" is the pre-third-edition wording and is still on the screen`,
      ).toBeNull();
    }
  });
});

describe("the community team screen names its viewer (item 45)", () => {
  const team = COMMUNITY_TEAM_PAGES[0];

  it("gives the exact subtitle naming the bed coordinator's view", () => {
    renderTeam(team.id);

    expect(
      screen.getByText("The bed coordinator's view of this team's referrals and bed flow."),
      "the subtitle no longer names the bed coordinator as the viewer, or its wording drifted from the build plan's §3",
    ).toBeVisible();
  });

  it("routes to the community chrome role, so the coordinator task inbox is not exposed", () => {
    expect(
      wardChromeRole(`/mockups/ward-flow/community/${team.id}`),
      "this screen's own route no longer resolves to the community chrome role",
    ).toBe("community");
  });
});

describe("the community team screen's Sovereign action bar and telemetry capsule ribbon", () => {
  const team = COMMUNITY_TEAM_PAGES[0];

  it("renders the Sovereign action buttons", () => {
    renderTeam(team.id);

    for (const action of SOVEREIGN_ACTIONS) {
      const button = screen.getByRole("button", {
        name: new RegExp(action.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
      });
      expect(button, `Sovereign action button "${action}" is missing`).toBeInTheDocument();
    }
  });

  it("renders the 6 telemetry capsule labels", () => {
    renderTeam(team.id);

    for (const label of SOVEREIGN_TELEMETRY) {
      expect(screen.getAllByText(label).length, `Sovereign telemetry capsule "${label}" is missing`).toBeGreaterThan(0);
    }
  });

  it("carries no retired tile wording", () => {
    renderTeam(team.id);

    for (const retired of RETIRED_TILES) {
      expect(screen.queryAllByText(retired), `"${retired}" is a retired tile label and is still on the screen`).toEqual(
        [],
      );
    }
  });
});

describe("community live-route source integrity", () => {
  it("uses the provider population on Fremantle routes just as explicit provider inputs do", () => {
    function ProviderInputs() {
      const { admissions, referrals } = useWardFlow();
      return <CommunityScreen teamId="alma-street-fremantle" admissions={admissions} referrals={referrals} />;
    }
    const live = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CommunityScreen teamId="alma-street-fremantle" />
      </WardFlowProvider>,
    );
    const liveText = live.container.textContent;
    live.unmount();
    const explicit = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ProviderInputs />
      </WardFlowProvider>,
    );
    expect(liveText).toBe(explicit.container.textContent);
  });
});
