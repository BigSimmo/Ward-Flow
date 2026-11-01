import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CommunityScreen } from "@/components/ward-management/community/community-screen";
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
    expect(screen.getByTestId("ward-community-hero-answer")).toHaveTextContent("142 on the caseload");
    expect(screen.getByText("9 in hospital · 5 waiting for a case manager")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /CTO reviews due/u })).toHaveTextContent("3");
    expect(screen.getByRole("tab", { name: /^Clinicians/u })).toHaveTextContent("Clinicians12");
    expect(within(screen.getByTestId("ward-community-glance")).getByText("Byrne, T.")).toBeInTheDocument();
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

  it("leaves other teams on their own records", () => {
    renderTeam("albany");
    expect(screen.queryByText(/waiting for a case manager/u)).not.toBeInTheDocument();
    expect(screen.queryByText("Byrne, T.")).not.toBeInTheDocument();
  });
});
