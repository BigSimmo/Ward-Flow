import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommunityScreen } from "@/components/ward-management/community/community-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider, WF_PHONE_QUERY } from "@/components/wf";
import { useWardBarPlaceSwitch } from "@/components/ward-management/shell/ward-bar-place-switch";

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

/** Stands in for the phone bar: the place line a page registers (the bar reads the same store). */
function PlaceLine() {
  const entry = useWardBarPlaceSwitch();
  return entry ? (
    <button type="button" aria-label={`${entry.actionLabel}: ${entry.label}`} onClick={entry.onPress}>
      {entry.label}
    </button>
  ) : null;
}

function renderTeam(teamId = "midland") {
  return render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CommunityScreen teamId={teamId} />
      </WardFlowProvider>
    </ToastProvider>,
  );
}

/** Referrals and Clinicians sit under the folder row's More on a phone (page-top redesign, 9 Nov 2026). */
function openMoreSection(name: RegExp) {
  fireEvent.click(screen.getByTestId("community-top-more"));
  fireEvent.click(screen.getByRole("menuitem", { name }));
}

describe("Midland community team on a phone (approved design)", () => {
  it("shows the hero, the section track and the team list", () => {
    renderTeam();
    // Page-top redesign (Josh, 9 Nov 2026): three folder tabs, the other sections under More.
    const hero = screen.getByTestId("ward-community-phone-hero");
    expect(hero).toHaveTextContent(/142\s*on the caseload/u);
    expect(hero).toHaveTextContent("3 need someone today");
    const track = screen.getByRole("radiogroup", { name: "Team sections" });
    expect(
      within(track)
        .getAllByRole("radio")
        .map((radio) => radio.textContent?.replace(/\d+$/u, "").trim()),
    ).toEqual(["Team home", "Caseload", "In hospital"]);
    expect(screen.getByText("7-day follow-up due today")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show 4 for this week" }));
    expect(screen.getByText("Waiting for a case manager")).toBeInTheDocument();
  });

  it("keeps the team's figures in the top on every section and filters the caseload", () => {
    renderTeam();
    fireEvent.click(screen.getByRole("radio", { name: /^Caseload/u }));
    expect(screen.getByTestId("ward-community-phone-hero")).toHaveTextContent(/142\s*on the caseload/u);
    fireEvent.click(screen.getByRole("button", { name: /No case manager/u }));
    expect(screen.getByRole("button", { name: /No case manager/u })).toHaveAttribute("aria-pressed", "true");
  });

  it("opens a referral as a sheet and the full referral from it", () => {
    renderTeam();
    openMoreSection(/^Referrals/u);
    fireEvent.click(screen.getAllByRole("button", { name: /^Open/u })[0]!);
    const sheet = screen.getByTestId("ward-community-phone-demo-referral");
    expect(within(sheet).getByRole("button", { name: "Accept for Midland" })).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole("button", { name: /Full referral/u }));
    expect(screen.queryByTestId("ward-community-phone-hero")).not.toBeInTheDocument();
  });

  it("offers Refer from team in the top on every section and says unconnected actions are not wired", () => {
    renderTeam();
    expect(screen.getByRole("button", { name: "Refer from team" })).toBeInTheDocument();
    openMoreSection(/^Referrals/u);
    expect(screen.getByRole("button", { name: "Refer from team" })).toBeInTheDocument();
    openMoreSection(/^Clinicians/u);
    fireEvent.click(screen.getAllByRole("button", { name: /^Call/u })[0]!);
    expect(screen.getByText("Not wired in this prototype.")).toBeInTheDocument();
  });

  it("opens Switch team from the bar's place line, not the hero", () => {
    render(
      <ToastProvider>
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <PlaceLine />
          <CommunityScreen teamId="midland" />
        </WardFlowProvider>
      </ToastProvider>,
    );
    expect(screen.queryByTestId("ward-community-switch-team")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Switch team: East Metro · Adult" }));
    expect(screen.getByTestId("ward-community-switch-drawer")).toBeInTheDocument();
  });

  it("leaves other teams on the generic phone tree", () => {
    renderTeam("albany");
    expect(screen.queryByRole("radiogroup", { name: "Team sections" })).not.toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Team lists" })).toBeInTheDocument();
  });
});
