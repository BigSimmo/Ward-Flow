import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  communityScopedReferrals,
  type CommunityScopedReferral,
} from "@/components/ward-management/ward-referral-visibility";

const fixture = vi.hoisted(() => ({ referrals: [] as CommunityScopedReferral[] }));
vi.mock("@/components/ward-management/ward-flow-provider", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ward-management/ward-flow-provider")>()),
  useCommunityScopedReferrals: () => fixture.referrals,
}));

import { CommunityScreen } from "@/components/ward-management/community/community-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { communityTeamById } from "@/components/ward-management/community/community-derivations";
import { WF_PHONE_QUERY } from "@/components/wf";

function renderTeam(teamId = "midland", explicit = false) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CommunityScreen teamId={teamId} demonstration {...(explicit ? { referrals: fixture.referrals } : {})} />
    </WardFlowProvider>,
  );
}

function expectTotals(waiting: number, urgent: number) {
  // Locked design (1 Nov 2026): the Referrals tab carries the queue total; the hero's Act now chip the urgent count.
  expect(screen.getByRole("tab", { name: /^Referrals/u })).toHaveTextContent(`Referrals${waiting}`);
  expect(screen.getByRole("button", { name: /Act now/u })).toHaveTextContent(String(urgent));
}

beforeEach(() => {
  fixture.referrals = [];
});
afterEach(() => vi.unstubAllGlobals());

describe("community demonstration queue totals", () => {
  it("counts Midland's two rendered sample referrals, including its Priority 2 urgent answer", () => {
    renderTeam();
    expectTotals(2, 1);
    expect(within(screen.getByTestId("ward-community-waiting-list")).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("button", { name: /^All referrals/u })).toHaveTextContent("2");
  });

  it("keeps the queue total while filtering its visible rows, including an empty priority", () => {
    renderTeam();
    fireEvent.click(screen.getByRole("button", { name: /^Priority 2 urgent/u }));
    expect(within(screen.getByTestId("ward-community-waiting-list")).getAllByRole("listitem")).toHaveLength(1);
    expectTotals(2, 1);
    fireEvent.click(screen.getByRole("button", { name: /^Priority 1 immediate/u }));
    expect(screen.getByTestId("ward-community-waiting-empty")).toBeInTheDocument();
    expectTotals(2, 1);
  });

  it("counts the Fremantle alias cohort from its five rows", () => {
    renderTeam("alma-street-fremantle");
    expectTotals(5, 4);
    expect(within(screen.getByTestId("ward-community-waiting-list")).getAllByRole("listitem")).toHaveLength(5);
  });

  it("shows zero when a configured team has no sample referrals", () => {
    renderTeam("mead-centre-armadale");
    expectTotals(0, 0);
    expect(screen.queryByTestId("ward-community-waiting-list")).not.toBeInTheDocument();
  });

  it("does not substitute sample totals for explicit empty records", () => {
    renderTeam("midland", true);
    expectTotals(0, 0);
    expect(screen.queryByTestId("ward-community-waiting-list")).not.toBeInTheDocument();
  });

  it("preserves the actual scoped queue and its urgent count when records are supplied", () => {
    const seed = seedWardFlowState();
    fixture.referrals = communityScopedReferrals([
      {
        ...seed.referrals[0]!,
        urgency: 2,
        destinations: [
          { destination: { kind: "community_team", teamName: communityTeamById("midland")!.name }, state: "queued" },
        ],
      },
    ]);
    renderTeam("midland", true);
    expectTotals(1, 1);
    // Count queue rows only: a seeded referral's intake summary renders its own nested list items.
    expect(screen.getByTestId("ward-community-waiting-list").children).toHaveLength(1);
  });

  it("keeps the phone queue total and rendered sample rows together", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === WF_PHONE_QUERY,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    renderTeam();
    expect(screen.getByRole("radio", { name: /^Waiting/u })).toHaveTextContent("Waiting2");
    expect(within(screen.getByTestId("ward-community-phone-list-waiting")).getAllByRole("listitem")).toHaveLength(2);
  });

  it("preserves the depot room's recorded 16:30 closing time", () => {
    renderTeam();
    expect(screen.getByText("Room 2 · Depot & Physical Health").parentElement).toHaveTextContent("9am – 4:30pm");
  });
});
