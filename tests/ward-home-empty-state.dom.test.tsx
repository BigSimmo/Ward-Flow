// pop-state-empty (Josh, 31 Oct 2026): on Home an empty group is one calm line with a green tick
// under its heading, in the group's own words, not a blank box.
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MyListCard } from "@/components/ward-management/coordinator/my-list-card";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const handlers = { selectedId: undefined, onSelect: vi.fn(), onRelease: vi.fn(), onReturn: vi.fn() };

describe("Home empty state", () => {
  it.each([false, true])("gives each empty My List group one line with a tick (phone %s)", (phone) => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <MyListCard
          act={[]}
          wait={[]}
          referrals={[]}
          units={[]}
          now={NOW_ANCHOR}
          phone={phone}
          handlers={handlers}
          selectedReferralId={undefined}
          onSelectReferral={vi.fn()}
          decideHref={(id) => `/ward-flow/referrals?referral=${id}`}
        />
      </WardFlowProvider>,
    );
    for (const [group, line] of [
      ["Act now", "None firing now. The checks run are named in the header."],
      ["Referrals to decide", "No referral is waiting on a decision."],
      ["Waiting on others", "Nothing is waiting on a transport leg or an arrival."],
    ] as const) {
      const region = screen.getByRole("region", { name: group });
      const empty = within(region).getByText(line).closest("p")!;
      const tick = empty.querySelector('svg[data-wf-glyph="success"]');
      expect(tick).not.toBeNull();
      expect(tick?.getAttribute("aria-hidden")).toBe("true");
    }
  });
});
