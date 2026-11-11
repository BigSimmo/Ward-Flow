import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommunityScreen } from "@/components/ward-management/community/community-screen";
import {
  recordMidlandDecision,
  undoMidlandDecision,
} from "@/components/ward-management/community/team-2026/midland-decisions";
import { REFERRALS } from "@/components/ward-management/community/team-2026/midland-demo";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * The locked community team design (design/community-team-2026-11) on the Midland page, which
 * carries the mock-up's demo team (Q126, Q132: Midland only). Every figure here is invented.
 */
function renderTeam(teamId: string) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CommunityScreen teamId={teamId} />
    </WardFlowProvider>,
  );
}

describe("Midland community team demo (locked design)", () => {
  it("states the mock-up's figures in the hero and section tabs", () => {
    renderTeam("midland");
    // Page-top redesign (Josh, 9 Nov 2026): figures, the act row, chips and the week-ahead band.
    expect(screen.getByTestId("ward-community-hero-answer")).toHaveTextContent(/^142\s*on the caseload$/u);
    const figures = screen.getByRole("group", { name: "Team figures" });
    expect(within(figures).getByText("in hospital").closest("p")).toHaveTextContent(/^9 in hospital$/u);
    expect(within(figures).getByText("no case manager").closest("p")).toHaveTextContent(/^5 no case manager$/u);
    expect(screen.getByText("3 need someone today")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("ward-community-glance")).getByRole("button", { name: /CTO reviews/u }),
    ).toHaveTextContent("3");
    expect(screen.getByRole("tab", { name: /^Clinicians/u })).toHaveTextContent("Clinicians12");
    expect(screen.getByTestId("community-top-duty")).toHaveTextContent("Duty: Byrne, Tom");
  });

  it("opens each section from its tab, with the Midland lists", () => {
    renderTeam("midland");
    fireEvent.click(screen.getByRole("tab", { name: /^Caseload/u }));
    expect(screen.getByRole("tabpanel", { name: /^Caseload/u })).toHaveTextContent("Showing 24 of 142");
    fireEvent.click(screen.getByRole("tab", { name: /^Clinicians/u }));
    const clinicians = screen.getByRole("tabpanel", { name: /^Clinicians/u });
    fireEvent.click(within(clinicians).getByRole("radio", { name: /^Away/u }));
    expect(within(clinicians).getAllByRole("button", { name: /^Call/u })).toHaveLength(1);
  });

  it("filters the caseload from a case manager on Team home", () => {
    renderTeam("midland");
    fireEvent.click(
      within(screen.getByRole("tabpanel", { name: /^Team home/u })).getByRole("button", { name: /Byrne, Tom/u }),
    );
    const caseload = screen.getByRole("tabpanel", { name: /^Caseload/u });
    expect(within(caseload).getByRole("combobox", { name: "Case manager" })).toHaveValue("byrne");
  });

  it("finds a client or clinician from the tab row (Q190)", () => {
    renderTeam("midland");
    const find = screen.getByRole("searchbox", { name: "Find a client or clinician" });
    fireEvent.change(find, { target: { value: "ashcombe" } });
    expect(screen.getByRole("tab", { name: /^Caseload/u })).toHaveAttribute("aria-selected", "true");
    const caseload = screen.getByRole("tabpanel", { name: /^Caseload/u });
    expect(within(caseload).getAllByText("Ashcombe, Rhys").length).toBeGreaterThan(0);
    expect(within(caseload).queryByText("Bellworth, Tamsin")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /^Clinicians/u }));
    fireEvent.change(find, { target: { value: "petrov" } });
    expect(screen.getByRole("tab", { name: /^Clinicians/u })).toHaveAttribute("aria-selected", "true");
    const clinicians = screen.getByRole("tabpanel", { name: /^Clinicians/u });
    expect(within(clinicians).getAllByText("Petrov, Dr Lena").length).toBeGreaterThan(0);
    expect(within(clinicians).queryByText("Ramsay, Dr Kofi")).not.toBeInTheDocument();
  });

  it("leaves other teams on their own records", () => {
    renderTeam("albany");
    expect(screen.queryByRole("searchbox", { name: "Find a client or clinician" })).not.toBeInTheDocument();
    expect(screen.queryByText(/waiting for a case manager/u)).not.toBeInTheDocument();
    expect(screen.queryByText("Byrne, Tom")).not.toBeInTheDocument();
  });

  // Page-top redesign (9 Nov 2026): the hero's referrals chip and the overview tile are gone, so the
  // Referrals tab is the count's one place on the page.
  it("counts referrals to answer from one source in the Referrals tab (audit B2)", () => {
    window.localStorage.clear();
    const counts = () => ({
      tab: screen.getByRole("tab", { name: /^Referrals/u }).textContent,
    });
    const { unmount } = renderTeam("midland");
    const before = counts();
    expect(before.tab).toBe(`Referrals${REFERRALS.length}`);
    unmount();
    recordMidlandDecision(REFERRALS[0]!.id, "Accepted for Midland", Date.now());
    try {
      renderTeam("midland");
      const after = counts();
      expect(after.tab).toBe(`Referrals${REFERRALS.length - 1}`);
    } finally {
      undoMidlandDecision(REFERRALS[0]!.id);
    }
  });
});

// Live audit item 6 (11 Nov 2026): the signed-in shared workspace never shows the Midland demo team,
// so its home lists the shared referrals and nothing is kept in this browser.
describe("Midland on the signed-in shared workspace", () => {
  it("shows the team's own page, not the demo team", () => {
    vi.stubEnv("NEXT_PUBLIC_WARD_SHARED_ENABLED", "true");
    try {
      renderTeam("midland");
      expect(screen.queryByTestId("community-top-duty")).toBeNull();
      expect(screen.queryByText("3 need someone today")).toBeNull();
      expect(screen.getByTestId("ward-community-screen")).toBeInTheDocument();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
