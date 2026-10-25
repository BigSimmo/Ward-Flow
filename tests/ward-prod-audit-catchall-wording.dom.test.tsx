import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { CommunityScreen } from "@/components/ward-management/community/community-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Wording ROUTING item 9: the community Expected back chips and the contact button read in
 * sentence case, like every other chip. Synthetic demonstration cohort only.
 */
describe("community Expected back wording is sentence case", () => {
  it("names its chips in sentence case", () => {
    const { container } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CommunityScreen teamId={COMMUNITY_TEAM_PAGES[0]!.id} demonstration />
      </WardFlowProvider>,
    );
    const panel = container.querySelector<HTMLElement>("#tab-egress")!;
    const text = panel.textContent ?? "";
    for (const words of ["Due today", "Upcoming discharges", "Overdue (priority follow-up)"]) {
      expect(text).toContain(words);
    }
    expect(text).not.toMatch(/Due Today|Upcoming Discharges|Follow-Up Register/u);
  });
});
