import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/referrals",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { communityTeamSlug } from "@/components/ward-management/community/community-derivations";
import { ReferralBoard } from "@/components/ward-management/referrals/referral-board";
import { ReferralPhoneHero } from "@/components/ward-management/referrals/referral-board-phone";
import { DecidedSection } from "@/components/ward-management/referrals/referral-board-sections";
import { WardAccessScope } from "@/components/ward-management/shell/ward-access";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { scopeWardFlowState } from "@/components/ward-management/ward-access-state";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { referralQueueOrder } from "@/components/ward-management/ward-referrals";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Desk views (Josh, 31 Oct 2026): the community clinician's branches on the one Referrals board. */
const SEED = seedWardFlowState();
const teamDesk = (teamName: string): WardAccess => ({ role: "community", scope: { kind: "team", teamName } });
const QUEUED_IDS = new Set(referralQueueOrder(SEED.referrals).map(({ id }) => id));
const TEAMS = [
  ...new Set(
    SEED.referrals.flatMap((referral) =>
      referral.destinations.flatMap((line) =>
        line.destination.kind === "community_team" ? [line.destination.teamName] : [],
      ),
    ),
  ),
];
const scopedReferrals = (teamName: string) =>
  scopeWardFlowState(SEED, teamDesk(teamName), { now: NOW_ANCHOR, places: wardPlaceLookup(SEED.units) }).state
    .referrals;
// The demo has nothing waiting on a team, so one synthetic referral is sent to this one.
const BUSY_TEAM = "Mead Centre (Armadale)";
// A team with none waiting but some decided.
const QUIET_TEAM = TEAMS.find((team) => {
  const own = scopedReferrals(team);
  return own.length > 0 && !own.some(({ id }) => QUEUED_IDS.has(id));
});
const teamWords = (team: string) => (/\bteam\b/i.test(team) ? team : `${team} team`);

function deskAs(access: WardAccess) {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess(access);
  });
}

function ReferToTeam() {
  const { dispatch } = useWardFlow();
  useEffect(() => {
    dispatch({
      type: "RECEIVE_REFERRAL",
      role: "coordinator",
      now: NOW_ANCHOR,
      ageBand: "Adult",
      source: "community",
      originSiteCode: "BTY",
      urgency: 2,
      destinations: [{ kind: "community_team", teamName: BUSY_TEAM }],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Bentley" },
      transportNeeded: false,
      history: "Synthetic referral.",
    });
  }, [dispatch]);
  return null;
}

function renderBoard({ refer = false } = {}) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      {refer ? <ReferToTeam /> : null}
      <WardAccessScope>
        <ReferralBoard />
      </WardAccessScope>
    </WardFlowProvider>,
  );
}

afterEach(() => {
  cleanup();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

describe("the community clinician's Referrals board", () => {
  it("names the team, drops the coordinator's tools and links to the team's Waiting list", async () => {
    deskAs(teamDesk(BUSY_TEAM));
    renderBoard({ refer: true });
    const hero = await screen.findByTestId("ward-referral-kpis");
    expect(await within(hero).findByRole("heading", { name: "1 waiting on the team" })).toBeInTheDocument();
    expect(within(hero).getByText(`Referrals · ${teamWords(BUSY_TEAM)}`)).toBeInTheDocument();
    expect(within(hero).getByTestId("ward-referral-team-page")).toHaveAttribute(
      "href",
      `/ward-flow/community/${communityTeamSlug(BUSY_TEAM)}`,
    );
    expect(within(hero).queryByTestId("ward-referral-meeting")).not.toBeInTheDocument();
    expect(within(hero).queryByTestId("ward-referral-next-overdue")).not.toBeInTheDocument();
    expect(within(hero).queryAllByTestId(/^ward-referral-highlight-/)).toEqual([]);
    expect(within(hero).queryByText(/Beds ready/)).not.toBeInTheDocument();
  });

  it("keeps the desk's own actions: the board is not read only", async () => {
    deskAs(teamDesk(BUSY_TEAM));
    renderBoard({ refer: true });
    const rows = await screen.findAllByTestId(/^ward-referral-board-select-(?!decided)/);
    const id = rows[0]!.getAttribute("data-testid")!.replace("ward-referral-board-select-", "");
    fireEvent.click(rows[0]!);
    const detail = screen.getByRole("region", { name: "Selected referral detail" });
    expect(within(detail).queryByTestId("ward-referral-read-only")).not.toBeInTheDocument();
    expect(within(detail).queryByTestId("ward-referral-read-only-foot")).not.toBeInTheDocument();
    fireEvent.click(within(detail).getByRole("tab", { name: /^Patient/ }));
    // Take this referral and Log a call are the community desk's own (ASSIGN_REFERRAL, LOG_REFERRAL_CONTACT).
    fireEvent.click(within(detail).getByRole("button", { name: /Owner and calls/ }));
    expect(await within(detail).findByTestId(`ward-referral-assign-${id}`)).toHaveTextContent("Take this referral");
    expect(within(detail).getAllByText("Log a call").length).toBeGreaterThan(0);
  });

  it("opens on History when nothing is waiting on the team", () => {
    expect(QUIET_TEAM).toBeDefined();
    deskAs(teamDesk(QUIET_TEAM!));
    renderBoard();
    expect(screen.getByRole("heading", { name: "Nothing waiting on the team" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^History/ })).toHaveAttribute("aria-selected", "true");
    const decided = screen.getByTestId("ward-referral-board-decided");
    expect(within(decided).queryByTestId("ward-referral-board-decided-note")).not.toBeInTheDocument();
  });

  it("leaves the coordinator's board as it was", () => {
    deskAs({ role: "coordinator", scope: { kind: "statewide" } });
    renderBoard();
    const hero = screen.getByTestId("ward-referral-kpis");
    expect(within(hero).getByText("Referrals")).toBeInTheDocument();
    expect(within(hero).getByRole("heading", { name: /awaiting decision/ })).toBeInTheDocument();
    expect(within(hero).getByTestId("ward-referral-meeting")).toBeInTheDocument();
    expect(within(hero).queryByTestId("ward-referral-team-page")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^Queue/ })).toHaveAttribute("aria-selected", "true");
  });
});

describe("the community clinician's phone hero", () => {
  const hero = (count: number) => (
    <ReferralPhoneHero
      count={count}
      oldest={count > 0 ? "2h 0m" : undefined}
      median={
        <>
          decided in <b>6h 38m</b> (median)
        </>
      }
      overdue={0}
      tier1={0}
      bedsReady={4}
      highlight={null}
      onHighlight={vi.fn()}
      onBeds={vi.fn()}
      bedsOpen={false}
      onNextOverdue={vi.fn()}
      onMeeting={vi.fn()}
    />
  );

  it("over an empty list keeps only the team link and the median", () => {
    deskAs(teamDesk("Midland"));
    render(hero(0));
    expect(screen.getByText("Referrals · Midland team")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Nothing waiting on the team" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the team’s Waiting list" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Next overdue|Bed meeting list|Beds ready|Tier 1/ })).toBeNull();
    expect(screen.queryByText("No referral waiting")).toBeNull();
  });

  it("with referrals waiting shows Overdue and Tier 1, never Beds ready", () => {
    deskAs(teamDesk("Midland"));
    render(hero(2));
    expect(screen.getByRole("heading", { name: "2 waiting on the team" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tier 1/ })).toBeInTheDocument();
    expect(screen.queryByTestId("ward-referral-phone-beds")).toBeNull();
    expect(screen.queryByRole("button", { name: "Bed meeting list" })).toBeNull();
  });

  it("is unchanged for the coordinator", () => {
    deskAs({ role: "coordinator", scope: { kind: "statewide" } });
    render(hero(2));
    expect(screen.getByText("Referrals · statewide")).toBeInTheDocument();
    expect(screen.getByTestId("ward-referral-phone-beds")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bed meeting list" })).toBeInTheDocument();
    expect(screen.queryByTestId("ward-referral-team-page")).toBeNull();
  });
});

describe("the community clinician's decided list", () => {
  const decided = SEED.referrals.filter(({ id }) => !QUEUED_IDS.has(id));

  it("opens on its first 8 rows, then Show more, with no count or acceptance note", () => {
    expect(decided.length).toBeGreaterThan(8);
    deskAs(teamDesk("Midland"));
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DecidedSection
          decided={decided}
          decidedTotal={decided.length}
          units={SEED.units}
          now={NOW_ANCHOR}
          onSelect={vi.fn()}
        />
      </WardFlowProvider>,
    );
    const cards = screen.getByTestId("ward-referral-board-decided-cards");
    expect(within(cards).getAllByRole("listitem")).toHaveLength(8);
    expect(screen.queryByTestId("ward-referral-board-decided-note")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: `Show ${decided.length - 8} more` }));
    expect(within(cards).getAllByRole("listitem")).toHaveLength(decided.length);
    expect(screen.getByRole("button", { name: "Show fewer" })).toBeInTheDocument();
  });

  it("lists every row with the note for the coordinator", () => {
    deskAs({ role: "coordinator", scope: { kind: "statewide" } });
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DecidedSection
          decided={decided}
          decidedTotal={decided.length}
          units={SEED.units}
          now={NOW_ANCHOR}
          onSelect={vi.fn()}
        />
      </WardFlowProvider>,
    );
    expect(within(screen.getByTestId("ward-referral-board-decided-cards")).getAllByRole("listitem")).toHaveLength(
      decided.length,
    );
    expect(screen.getByTestId("ward-referral-board-decided-note")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Show \d+ more$/ })).toBeNull();
  });
});
