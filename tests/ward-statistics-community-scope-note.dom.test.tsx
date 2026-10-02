import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same reason as every sibling dom suite: `ClinicalRail` renders next/link anchors, and jsdom
// cannot provide an App Router context.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { StatisticsCommunityScreen } from "@/components/ward-management/statistics/statistics-community-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * 🔴 **D-44. THE DRAWING'S SCOPE NOTE DENIED A COMPARISON THE PAGE MAKES.**
 *
 * Its words were *"A fixed period view of this team's own numbers, **not a comparison against any
 * other team**"* — and the screen carries *Where this team sits*, a table of every team's figures,
 * which Q-12 and §4.15 both say to keep.
 *
 * ⚠️ **Obeying both would have shipped a sentence denying a comparison directly above one** — the
 * same shape as the defects this lane has spent the day cataloguing, except built in on day one by
 * following two correct instructions rather than drifted into.
 *
 * **Ruled: keep the panel, carve the note.** The note's purpose survives a carve-out; the panel's
 * does not survive deletion.
 */
function renderCommunityScreen() {
  const team = COMMUNITY_TEAM_PAGES[0];
  expect(team, "no community team pages exist, so this suite would assert nothing").toBeDefined();
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <StatisticsCommunityScreen teamId={team!.id} />
    </WardFlowProvider>,
  );
}

describe("the community screen's scope note", () => {
  /**
   * 🔴 **Naming the panels by their RENDERED TITLES is the whole point.** *"Every count below"* is
   * unfalsifiable — there is no way to hold it against the screen and find it wrong. *"Every count
   * in **This team, in figures**"* can be checked by anyone who can read the page.
   */
  it("names both panels by the titles that render, so the claim can be checked against the screen", () => {
    renderCommunityScreen();

    const note = screen.getByTestId("ward-statistics-community-scope-note");
    expect(note.textContent).toContain("Caseload");
    expect(note.textContent).toContain("Where this team sits");
  });

  /**
   * 🔴 **The two negative assertions carry the ruling.**
   *
   * *"Not a comparison against any other team"* is the FALSE half — the page does compare.
   *
   * ⚠️ **And *"unless the figure says otherwise"* is worse than false: it makes the claim
   * UNFALSIFIABLE.** Any figure that contradicts the sentence is covered by the sentence. A wrong
   * claim can be caught; an unfalsifiable one cannot, which is why it goes rather than being
   * softened.
   */
  it("no longer denies the comparison, and carries no escape hatch", () => {
    renderCommunityScreen();

    const note = screen.getByTestId("ward-statistics-community-scope-note");
    expect(note.textContent).not.toContain("not a comparison against any other team");
    expect(note.textContent).not.toContain("unless the figure says otherwise");
  });

  /** The read-only clause is true, unrelated to the carve-out, and kept verbatim. */
  it("keeps the read-only clause", () => {
    renderCommunityScreen();

    const note = screen.getByTestId("ward-statistics-community-scope-note");
    expect(note.textContent).toContain("nothing here opens a case, accepts a referral or books a contact");
  });

  /**
   * ⚠️ **The panel the note carves out must actually be on the page.** Without this, the note could
   * name a panel that had been removed and every assertion above would still pass — a scope claim
   * describing a screen that no longer exists.
   */
  it("renders the panel the carve-out names", () => {
    renderCommunityScreen();

    expect(screen.getByTestId("ward-statistics-community-comparison")).toBeInTheDocument();
  });
});
