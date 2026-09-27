import { fireEvent, render, screen, within } from "@testing-library/react";
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
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * The community team screen's search and patient dossier read the patient records.
 *
 * Until 25 Sept 2026 the search showed the same three typed hits whatever was typed (one of them
 * "Farah Davenporton · UM100010 · FSH Secure Bed 04 · In Bed 8d · Wait 4h 12m", none of it on her
 * record), and the dossier gave every person the same clinician, care tier and review date.
 */
const TEAM = COMMUNITY_TEAM_PAGES[0]!;

function renderScreen() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CommunityScreen teamId={TEAM.id} />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Search sample patients by name or UMRN" }));
}

function typeSearch(text: string) {
  fireEvent.change(screen.getByPlaceholderText("Type UMRN or name..."), { target: { value: text } });
}

describe("community team screen: search and dossier come from the patient record", () => {
  it("shows no patient until something is typed", () => {
    renderScreen();

    expect(screen.getByTestId("ward-community-search-hint")).toBeTruthy();
    expect(screen.queryByTestId(/^ward-community-search-hit-/)).toBeNull();
    expect(screen.queryByText(/Davenporton/)).toBeNull();
  });

  it("finds the typed patient with only what her record holds", () => {
    renderScreen();
    typeSearch("Davenport");

    const hit = screen.getByTestId("ward-community-search-hit-PT-010");
    expect(hit.textContent).toContain("Farah Davenporton · UM100010");
    expect(hit.textContent).toContain("Involuntary patient (recorded)");
    expect(hit.textContent).toContain("Mirrabooka Community Team");
    for (const invented of ["FSH Secure Bed 04", "In Bed 8d", "Wait 4h 12m", "35y"]) {
      expect(hit.textContent, invented).not.toContain(invented);
    }
    expect(screen.queryByTestId("ward-community-search-hit-PT-005"), "a hit that does not match").toBeNull();
  });

  it("says so when nobody matches", () => {
    renderScreen();
    typeSearch("zzqq");

    expect(screen.getByTestId("ward-community-search-empty").textContent).toContain("zzqq");
    expect(screen.queryByTestId(/^ward-community-search-hit-/)).toBeNull();
  });

  it("opens a dossier that says what Ward Flow does not record", () => {
    renderScreen();
    typeSearch("UM100010");
    fireEvent.click(screen.getByTestId("ward-community-search-hit-PT-010"));

    const dossier = screen.getByRole("dialog", { name: "Patient Dossier: Farah Davenporton · UM100010" });
    expect(within(dossier).getAllByText("Not recorded in Ward Flow")).toHaveLength(3);
    for (const invented of ["Dr S. Chen", "Tier 1 Intensive Outreach", "25 Sep 2026", "Form 1A MHA"]) {
      expect(dossier.textContent, invented).not.toContain(invented);
    }
  });
});
