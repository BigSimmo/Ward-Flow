import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { homeActNowAnswer, homeActNowParts } from "@/components/ward-management/coordinator/home-act-now-words";
import { MyListCard } from "@/components/ward-management/coordinator/my-list-card";
import { PlannedList } from "@/components/ward-management/coordinator/planned-list";
import type { PlannedRow } from "@/components/ward-management/coordinator/planned-model";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { Referral } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider } from "@/components/wf";

/**
 * Wave 4 Home (D-191, 13 Nov 2026; Home notes items 1, 4, 6, 7). Synthetic seed data only.
 */
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("act box words split in two (notes item 4)", () => {
  it("keeps the head and the parts the one-line answer had", () => {
    expect(homeActNowParts(4, 1)).toEqual({
      head: "4 need a person now",
      detail: "3 alerts, 1 accepted with no bed pulled",
    });
    expect(homeActNowParts(3, 0)).toEqual({ head: "3 need a person now", detail: undefined });
    const parts = homeActNowParts(2, 1, " in East Metro");
    expect(`${parts.head}: ${parts.detail}`).toBe(homeActNowAnswer(2, 1, " in East Metro"));
  });
});

describe("Home after wave 4", () => {
  it("labels the hero figures as count nouns and keeps Needs you to two groups", () => {
    render(
      <ToastProvider>
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <CoordinatorScreen />
        </WardFlowProvider>
      </ToastProvider>,
    );
    expect(screen.getByTestId("home-figure-ed")).toHaveTextContent(/^\d+ Open movements$/u);
    expect(screen.getByTestId("home-figure-beds")).toHaveTextContent(/^\d+ Ready$/u);
    // Ruling 4: "In use", never "at risk"; at or over the line it keeps the amber dot.
    const occupancy = screen.queryByTestId("home-figure-occupancy");
    if (occupancy) {
      expect(occupancy).toHaveTextContent(/In use/u);
      expect(occupancy).not.toHaveTextContent(/at risk/iu);
    }
    // Ruling 2: no "Waiting on others" group.
    const needs = screen.getByTestId("home-my-list");
    expect(within(needs).queryByRole("region", { name: "Waiting on others" })).toBeNull();
    expect(needs.getAttribute("aria-label")).toMatch(/^Needs you, \d+ items$/u);
    // Notes item 4: the head alone, then the parts on their own line when a bed is still to pull.
    expect(screen.getByTestId("hero-next-answer").textContent).not.toContain(":");
  });
});

const row = (over: Partial<PlannedRow>): PlannedRow => ({
  id: "row",
  at: NOW_ANCHOR,
  kind: "move",
  what: "Planned move",
  who: "Synthetic, Person",
  where: "Synthetic ED to Synthetic Ward",
  later: false,
  past: false,
  ...over,
});

describe("Later today agenda (notes item 1)", () => {
  it("groups rows into Past planned time, Rest of your shift and After your shift, and says an empty group in one line", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PlannedList
          now={NOW_ANCHOR}
          title="Later today"
          rows={[
            row({ id: "a", at: NOW_ANCHOR - 30, past: true, kind: "admission", who: "Initials SY" }),
            row({ id: "b", at: NOW_ANCHOR + 20 }),
          ]}
        />
      </WardFlowProvider>,
    );
    const past = screen.getByTestId("home-planned-group-past");
    expect(past).toHaveTextContent("Past planned time");
    expect(past).toHaveTextContent("not done yet");
    expect(within(past).getByRole("listitem")).toHaveAttribute("data-past", "true");
    expect(within(past).getByRole("listitem")).toHaveTextContent("Initials SY");
    expect(screen.getByTestId("home-planned-group-shift")).toHaveTextContent("Synthetic, Person");
    expect(screen.getByTestId("home-planned-group-later")).toHaveTextContent(/Nothing recorded after .+ yet\./u);
    expect(screen.getByTestId("home-tomorrow")).toHaveTextContent("Not a prediction.");
  });
});

describe("Needs you card (notes items 6 and 7)", () => {
  it("puts the since line at the top of the card and a referral on one line with its place in words", () => {
    const referral = {
      id: "ref-syn",
      urgency: 3,
      raisedAt: NOW_ANCHOR - 30,
      originSiteCode: "RPH",
      ageBand: "Adult",
      homeRegion: "Perth Metropolitan",
      destinations: [],
      source: "ed_medical",
    } as unknown as Referral;
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <MyListCard
          act={[]}
          since={<p data-testid="since-stub">Since 07:00</p>}
          referrals={[referral]}
          units={[]}
          now={NOW_ANCHOR}
          phone={false}
          handlers={{ selectedId: undefined, onSelect: vi.fn(), onRelease: vi.fn(), onReturn: vi.fn() }}
          selectedReferralId={undefined}
          onSelectReferral={vi.fn()}
          decideHref={(id) => `/ward-flow/referrals?referral=${id}`}
        />
      </WardFlowProvider>,
    );
    const card = screen.getByTestId("home-my-list");
    expect(card.firstElementChild).toBe(screen.getByTestId("since-stub"));
    const line = card.querySelector('[data-referral-id="ref-syn"]')!;
    expect(line).toHaveTextContent("Tier 3 · No ward asked · from Royal Perth ED · Adult, Perth Metropolitan");
  });
});
