import { render } from "@testing-library/react";
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
 * The community-team statistics page shows no typed figures.
 *
 * Until 25 Sept 2026 it drew case-duration bands with "142" open cases and a "184d" median, a fixed
 * "92.4%" follow-up gauge against a 90% benchmark, and a "28 received" referral-source chart, all
 * from constants. Josh's ruling that day: a figure comes from the record or says "Not recorded".
 */
function renderCommunityStatistics() {
  const team = COMMUNITY_TEAM_PAGES[0];
  expect(team, "no community team pages exist, so this suite would assert nothing").toBeDefined();
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <StatisticsCommunityScreen teamId={team!.id} />
    </WardFlowProvider>,
  );
}

describe("community-team statistics: no typed figures", () => {
  it("says the case durations, follow-up share and referral sources are not recorded", () => {
    const { container } = renderCommunityStatistics();
    const text = container.textContent ?? "";

    expect(text).toContain("no history of how long a case has stayed open");
    expect(text).toContain("there is no follow-up percentage to show");
    expect(text).toContain("Referral sources are not recorded in this prototype.");
    for (const invented of ["142", "184d", "92.4%", "28 received"]) {
      expect(text, invented).not.toContain(invented);
    }
  });
});
