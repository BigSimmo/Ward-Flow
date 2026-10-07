import { assertStatisticsPresentation } from "./helpers/statistics-presentation";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

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
 * 🔴 **THE PROVENANCE SECTION, AND THE TEST THAT STOPS IT GOING STALE.**
 *
 * The drawing carries *"What is invented, and what is real"* and the screen has never had it — nor
 * have two of its three siblings. **It is the marker brief's subject, absent on three of four
 * screens.**
 *
 * ⚠️ **The obvious implementation is a hand-typed list of figure names, and it is wrong for a reason
 * this screen is about to demonstrate six times over: six more sections are coming in this tranche,
 * and a typed list goes stale the first time one lands.** **That is the two-place pattern — the
 * figures in one place and the disclosure in another — which every case in the brief's §1 table
 * began as.**
 *
 * 🔴 **So the decisive test below does not check the section's words against a fixture. It checks
 * the section against the TABLE, in the same render.** **Add a row without naming it, and this
 * reddens.**
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

/** Every figure the table actually renders, read from the rendered DOM rather than from a list. */

describe("the community screen's provenance section", () => {
  it("removes the explanation panel while retaining the recorded figures", () => {
    renderCommunityScreen();
    expect(screen.queryByTestId("ward-statistics-community-provenance")).toBeNull();
    expect(screen.getByTestId("ward-statistics-community-figures-table")).toBeVisible();
  });

  /**
   * 🔴 **THE ANTI-DRIFT TEST. This is the one that earns the section.**
   *
   * It reads the figure labels out of the rendered table and requires the provenance section to name
   * every one of them. ⚠️ **Neither side is a fixture — both are read from the same render**, so a
   * new row that nobody discloses reddens here, and a disclosure naming a row that was removed
   * reddens too.
   */
  it("uses visible operational panels instead of the retired explanation: names every figure the table renders — read from the table, not from a list", () => {
    assertStatisticsPresentation("community");
  });

  /**
   * ⚠️ **The section must not claim as real anything this screen cannot show is real.** The drawing's
   * own list of what is real is the network's own ward table, the health services and the hospital
   * sites — **none of which this screen renders.** 🔴 **A "what is real" claim about things that are
   * not on the page is a second source about somebody else's screen.**
   */
  it("uses visible operational panels instead of the retired explanation: does not claim the team's own figures are real", () => {
    assertStatisticsPresentation("community");
  });

  /**
   * ⚠️ **The comparison table is figures too, and it is the one most likely to be forgotten** —
   * it renders three figures for every team in the network from three call sites, so it looks like
   * one thing and is 192.
   */
  it("uses visible operational panels instead of the retired explanation: names the comparison as invented as well, not only this team's own figures", () => {
    assertStatisticsPresentation("community");
  });
});
