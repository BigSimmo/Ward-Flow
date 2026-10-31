import "@testing-library/jest-dom/vitest";
import { useEffect } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CommunityScreen } from "@/components/ward-management/community/community-screen";
import { communityTeamSlug } from "@/components/ward-management/community/community-derivations";
import { ReferralOwnerAndCalls } from "@/components/ward-management/referrals/referral-owner-and-calls-panel";
import { referralTimeline } from "@/components/ward-management/referrals/referral-board-parts";
import { referralFollowUpLine } from "@/components/ward-management/referrals/referral-owner-and-calls-model";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Fix plan item 4 on screen: the referral's owner desk, Assign, and Log a call. */
let pathname = "/ward-flow/referrals";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const seed = seedWardFlowState();
const WARD = seed.units.find((unit) => unit.cohort === "Adult")!;

function Refer() {
  const { dispatch } = useWardFlow();
  useEffect(() => {
    dispatch({
      type: "RECEIVE_REFERRAL",
      role: "community",
      now: NOW_ANCHOR,
      ageBand: "Adult",
      source: "community",
      originSiteCode: "BTY",
      urgency: 2,
      destinations: [
        {
          kind: "psychiatric_ward",
          unitId: WARD.id,
          sex: "Female",
          gender: "Female",
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
      ],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Bentley" },
      transportNeeded: true,
      history: "Synthetic referral.",
    });
  }, [dispatch]);
  return null;
}

function Panel() {
  const { referrals } = useWardFlow();
  const referral = referrals.at(-1);
  if (!referral) return null;
  return (
    <>
      <ReferralOwnerAndCalls referral={referral} now={NOW_ANCHOR + 40} />
      <output data-testid="record">
        {`${referral.destinations[0]?.state}|${referralFollowUpLine(referral, NOW_ANCHOR + 40) ?? "none"}`}
      </output>
      <ol data-testid="timeline">
        {referralTimeline(referral, seed.units).map((entry) => (
          <li key={`${entry.at}-${entry.text}`}>{entry.text}</li>
        ))}
      </ol>
    </>
  );
}

function setup() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Refer />
      <Panel />
    </WardFlowProvider>,
  );
}

describe("referral owner and call log", () => {
  beforeEach(() => {
    pathname = "/ward-flow/referrals";
  });

  it("assigns the referral to a chosen desk and shows the owner", () => {
    setup();
    const owner = () => screen.getByTestId(/^ward-referral-owner-RF-/u);
    expect(owner()).toHaveTextContent("Owner Not assigned");
    const assign = screen.getByRole("button", { name: "Assign" });
    expect(assign).toHaveAttribute("aria-disabled", "true");
    fireEvent.change(screen.getByRole("combobox", { name: "Assign to" }), { target: { value: "coordinator" } });
    fireEvent.click(assign);
    expect(owner()).toHaveTextContent("Owner Bed coordinator · assigned 10:42 by Bed coordinator");
    expect(screen.getByTestId("record")).toHaveTextContent("queued|Owner Bed coordinator");
    expect(screen.getByTestId("timeline")).toHaveTextContent("Assigned to Bed coordinator by Bed coordinator");
  });

  it("logs a call with who was rung and what they said, without answering the referral", () => {
    setup();
    const log = screen.getByRole("button", { name: "Log a call" });
    expect(log).toHaveAttribute("aria-disabled", "true");
    fireEvent.change(screen.getByRole("combobox", { name: "Who was rung" }), { target: { value: `ward:${WARD.id}` } });
    fireEvent.change(screen.getByRole("combobox", { name: "What they said" }), { target: { value: "said_yes" } });
    expect(log).not.toHaveAttribute("aria-disabled");
    fireEvent.click(log);
    const calls = within(screen.getByRole("list", { name: "Calls logged" }));
    expect(calls.getByText(new RegExp(`${WARD.name}: Said yes`))).toBeInTheDocument();
    expect(calls.getByText(/Bed coordinator, 40 min ago/)).toBeInTheDocument();
    // "Said yes" on the phone is not an acceptance.
    expect(screen.getByTestId("record")).toHaveTextContent("queued|Last call 40 min ago");
    expect(screen.getByTestId("timeline")).toHaveTextContent(`Bed coordinator rang ${WARD.name}: Said yes`);
  });

  it("offers wards in name order with no suggestion, and the referrer", () => {
    setup();
    const who = screen.getByRole("combobox", { name: "Who was rung" });
    expect(within(who).getByRole("option", { name: "The referrer" })).toBeInTheDocument();
    const wardNames = within(within(who).getByRole("group", { name: "Wards" }))
      .getAllByRole("option")
      .map((option) => option.textContent ?? "");
    expect(wardNames).toEqual([...wardNames].sort((a, b) => a.localeCompare(b)));
    expect(wardNames).toHaveLength(seed.units.length);
  });

  it("lets a community desk only take the referral for itself", () => {
    pathname = "/ward-flow/community";
    setup();
    expect(screen.queryByRole("combobox", { name: "Assign to" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Take this referral" }));
    expect(screen.getByTestId("record")).toHaveTextContent("Owner Community team");
    expect(screen.getByRole("button", { name: "Take this referral" })).toHaveAttribute("aria-disabled", "true");
  });
});

const TEAM = "Mead Centre (Armadale)";

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
      destinations: [{ kind: "community_team", teamName: TEAM }],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Bentley" },
      transportNeeded: false,
      history: "Synthetic referral.",
    });
  }, [dispatch]);
  return null;
}

function Owner() {
  const { referrals } = useWardFlow();
  const referral = referrals.at(-1);
  return <output data-testid="owner">{referral?.ownerHistory?.map((entry) => entry.owner).join(",") ?? ""}</output>;
}

describe("community team Assign", () => {
  it("takes the referral for the team's desk, and refuses a second tap", async () => {
    pathname = `/ward-flow/community/${communityTeamSlug(TEAM)}`;
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferToTeam />
        <CommunityScreen teamId={communityTeamSlug(TEAM)} />
        <Owner />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Assign" })[0]!);
    const dialog = within(screen.getByRole("dialog", { name: /^Assign referral/u }));
    expect(dialog.queryByText(/Not wired in this prototype/u)).not.toBeInTheDocument();
    fireEvent.click(dialog.getByRole("button", { name: "Take for this team" }));
    expect(screen.getByTestId("owner")).toHaveTextContent("community");
    expect(await dialog.findByText("Assigned to this team's desk.")).toHaveAttribute("role", "status");
    fireEvent.click(dialog.getByRole("button", { name: "Take for this team" }));
    expect(screen.getByTestId("owner")).toHaveTextContent(/^community$/u);
    expect(await dialog.findByText(/^Not assigned\. It may already be/u)).toHaveAttribute("role", "status");
  });
});
