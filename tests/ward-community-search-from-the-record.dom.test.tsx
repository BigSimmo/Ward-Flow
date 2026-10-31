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
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * The community team screen's patient dossier reads the patient record.
 *
 * Until 25 Sept 2026 the screen's own search showed the same three typed hits whatever was typed,
 * and the dossier gave every person the same clinician, care tier and review date. On 30 Oct 2026
 * Josh removed that sample-patient search as a copy of the header search, which finds the same
 * people with the same engine (search and forms review); "/" now reaches the header search here.
 */
const TEAM = COMMUNITY_TEAM_PAGES[0]!;

function renderScreen() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CommunityScreen teamId={TEAM.id} />
    </WardFlowProvider>,
  );
}

// The dossier's "Not recorded in Ward Flow" check moved to ward-community-transport.dom.test.tsx,
// which opens it from the In a bed tab now that this search is gone.
describe("community team screen: no second patient search", () => {
  it("offers no sample-patient search of its own", () => {
    renderScreen();

    expect(screen.queryByRole("button", { name: "Search sample patients by name or UMRN" })).toBeNull();
    expect(screen.queryByPlaceholderText("Type UMRN or name...")).toBeNull();
    expect(screen.queryByRole("button", { name: "Find a person" })).toBeNull();
  });

  it('leaves "/" for the header search', () => {
    renderScreen();

    const slash = new KeyboardEvent("keydown", { key: "/", bubbles: true, cancelable: true });
    document.body.dispatchEvent(slash);
    expect(slash.defaultPrevented).toBe(false);
  });
});
