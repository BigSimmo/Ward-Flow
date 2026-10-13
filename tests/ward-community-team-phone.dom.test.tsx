import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { communityTeamById } from "@/components/ward-management/community/community-derivations";
import { CommunityScreen } from "@/components/ward-management/community/community-screen";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { ToastProvider, WF_PHONE_QUERY } from "@/components/wf";

/**
 * Community team on a phone (v10 all-pages mockup, "Community team", Phone; device audit option A,
 * 11 Oct 2026): its own tree with the band hero, tool chips that open sheets, and Waiting / In bed /
 * Back / CTOs one tap apart on one switch with counts. Notices and provenance sit behind one closed
 * "About this data". Every coordinator action stays reachable: intake, record contact, switch team,
 * and accept or decline a waiting referral from its sheet (decline locked until a reason is chosen).
 */

function asPhone() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === WF_PHONE_QUERY,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

/**
 * Option B (Josh, 13 Oct 2026): the team's intake modal is retired; "Refer from team" opens the one
 * referral slide-out instead, which lives in the shell and is not rendered here. A referral to this
 * team is received through the same event the slide-out sends.
 */
function ReceiveForTeam() {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      hidden
      data-testid="fixture-receive-for-team"
      onClick={() =>
        dispatch({
          type: "RECEIVE_REFERRAL",
          role: "community",
          now,
          ageBand: "Adult",
          destinations: [{ kind: "community_team", teamName: communityTeamById("midland")!.name }],
          homeRegion: "Perth Metropolitan",
          suburb: { kind: "unknown", reason: "not_known" },
          source: "community",
          urgency: 2,
          originSiteCode: "SCGH",
          transportNeeded: false,
          history: "",
        })
      }
    />
  );
}

function renderTeam() {
  return render(
    <ToastProvider>
      <WardFlowProvider>
        <ReceiveForTeam />
        <CommunityScreen teamId="midland" />
      </WardFlowProvider>
    </ToastProvider>,
  );
}

beforeEach(asPhone);
afterEach(() => vi.unstubAllGlobals());

describe("Community team on a phone", () => {
  it("renders the phone tree, not the desktop stack", () => {
    renderTeam();
    expect(screen.getByTestId("ward-community-phone")).toBeInTheDocument();
    expect(screen.getByTestId("ward-community-phone-hero")).toHaveTextContent("on the caseload");
    expect(screen.queryByRole("tablist", { name: "Community team lists" })).not.toBeInTheDocument();
    const lists = screen.getByRole("radiogroup", { name: "Team lists" });
    // One switch, each list with its count (the hero figures that repeated it are gone).
    expect(
      within(lists)
        .getAllByRole("radio")
        .map((radio) => radio.textContent?.replace(/\d+$/u, "").trim()),
    ).toEqual(["Waiting", "In bed", "Back", "CTOs"]);
    expect(screen.queryByTestId("wf-phone-hero-figure-back")).not.toBeInTheDocument();
  });

  it("switches lists from the segmented control and the CTO register chip", () => {
    renderTeam();
    fireEvent.click(screen.getByRole("radio", { name: /^In bed/u }));
    expect(screen.getByTestId("ward-community-phone-list-inBed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /^Back/u }));
    expect(screen.getByTestId("ward-community-phone-list-back")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("ward-community-phone-chip-cto"));
    expect(screen.getByTestId("ward-community-phone-list-ctos")).toBeInTheDocument();
  });

  it("opens How to reach and On duty as sheets, and keeps coverage in About this data", () => {
    renderTeam();
    fireEvent.click(screen.getByTestId("ward-community-phone-chip-reach"));
    expect(screen.getByTestId("ward-community-contact")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByTestId("ward-community-phone-chip-duty"));
    expect(screen.getByTestId("ward-community-roster")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    const about = screen.getByTestId("ward-community-about-this-data");
    expect(about).not.toHaveAttribute("open");
    expect(within(about).getByTestId("ward-community-limits")).toBeInTheDocument();
  });

  it("keeps the team actions: record contact and switch team", () => {
    renderTeam();
    fireEvent.click(screen.getByTestId("ward-community-phone-chip-contact"));
    expect(screen.getByTestId("ward-community-contact-save")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Switch team" }));
    expect(screen.getByRole("searchbox", { name: "Find a team" })).toBeInTheDocument();
  });

  it("offers Refer from team, and a referral to the team waits as a person row whose sheet declines only with a reason", () => {
    renderTeam();
    expect(screen.getByRole("button", { name: "Refer from team" })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("fixture-receive-for-team"));
    // The page opened on the first list with someone in it; the new referral waits on Waiting.
    fireEvent.click(screen.getByRole("radio", { name: /^Waiting/u }));

    const list = screen.getByTestId("ward-community-phone-list-waiting");
    const row = within(list).getAllByRole("button")[0]!;
    fireEvent.click(row);
    const sheet = screen.getByTestId("ward-community-phone-referral");
    expect(within(sheet).getByRole("button", { name: "Accept referral" })).toBeInTheDocument();

    fireEvent.click(within(sheet).getByRole("button", { name: "Decline" }));
    const decline = () => within(sheet).getByRole("button", { name: /Decline referral/ });
    expect(decline()).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(within(sheet).getAllByRole("radio")[0]!);
    expect(decline()).not.toHaveAttribute("aria-disabled");
    fireEvent.click(decline());
    expect(screen.getByTestId("toast-region")).toHaveTextContent("Referral declined");
    expect(within(screen.getByTestId("ward-community-phone-list-waiting")).queryAllByRole("listitem")).toHaveLength(0);
  });
});
