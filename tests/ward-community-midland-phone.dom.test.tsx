import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommunityScreen } from "@/components/ward-management/community/community-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider, WF_PHONE_QUERY } from "@/components/wf";

/*
 * The approved Community team phone design (Q155) on the Midland page: the band hero with three
 * figures per section, the section track, phone rows and the referral sheet. Every figure is invented.
 */
beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === WF_PHONE_QUERY,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});
afterEach(() => vi.unstubAllGlobals());

function renderTeam(teamId = "midland") {
  return render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CommunityScreen teamId={teamId} />
      </WardFlowProvider>
    </ToastProvider>,
  );
}

describe("Midland community team on a phone (approved design)", () => {
  it("shows the hero, the section track and the team list", () => {
    renderTeam();
    const hero = screen.getByTestId("ward-community-phone-hero");
    expect(hero).toHaveTextContent("142 on the caseload");
    expect(hero).toHaveTextContent("Act now");
    const track = screen.getByRole("radiogroup", { name: "Team sections" });
    expect(
      within(track)
        .getAllByRole("radio")
        .map((radio) => radio.textContent?.replace(/\d+$/u, "").trim()),
    ).toEqual(["Home", "Caseload", "In hospital", "Referrals", "Clinicians"]);
    expect(screen.getByText("7-day follow-up due today")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show 4 for this week" }));
    expect(screen.getByText("Waiting for a case manager")).toBeInTheDocument();
  });

  it("changes the hero figures with the section and filters the caseload", () => {
    renderTeam();
    fireEvent.click(screen.getByRole("radio", { name: /^Caseload/u }));
    expect(screen.getByTestId("ward-community-phone-hero")).toHaveTextContent("On a CTO");
    fireEvent.click(screen.getByRole("button", { name: /No case manager/u }));
    expect(screen.getByRole("button", { name: /No case manager/u })).toHaveAttribute("aria-pressed", "true");
  });

  it("opens a referral as a sheet and the full referral from it", () => {
    renderTeam();
    fireEvent.click(screen.getByRole("radio", { name: /^Referrals/u }));
    fireEvent.click(screen.getAllByRole("button", { name: /^Open/u })[0]!);
    const sheet = screen.getByTestId("ward-community-phone-demo-referral");
    expect(within(sheet).getByRole("button", { name: "Accept for Midland" })).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole("button", { name: /Full referral/u }));
    expect(screen.queryByTestId("ward-community-phone-hero")).not.toBeInTheDocument();
  });

  it("offers Refer from team on Referrals and says unconnected actions are not wired", () => {
    renderTeam();
    expect(screen.queryByRole("button", { name: "Refer from team" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /^Referrals/u }));
    expect(screen.getByRole("button", { name: "Refer from team" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /^Clinicians/u }));
    fireEvent.click(screen.getAllByRole("button", { name: /^Call/u })[0]!);
    expect(screen.getByText("Not wired in this prototype.")).toBeInTheDocument();
  });

  it("leaves other teams on the generic phone tree", () => {
    renderTeam("albany");
    expect(screen.queryByRole("radiogroup", { name: "Team sections" })).not.toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Team lists" })).toBeInTheDocument();
  });
});
