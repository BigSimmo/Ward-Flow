// H-0893 (Josh, 27 Oct 2026 03:32Z): the ward referral inbox keeps waiting referrals on top and
// folds answered ones into one "Show N answered" line. Synthetic data only.
import "@testing-library/jest-dom/vitest";
import { useEffect, useRef } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WardReferralInbox } from "@/components/ward-management/referrals/ward-referral-inbox";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/referrals",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

const seed = seedWardFlowState();
const UNIT = seed.units.find((unit) => unit.cohort === "Adult" && unit.siteCode !== "BTY")!;

function refer(history: string) {
  return {
    type: "RECEIVE_REFERRAL" as const,
    role: "community" as const,
    now: NOW_ANCHOR,
    ageBand: "Adult" as const,
    source: "community" as const,
    originSiteCode: "BTY",
    urgency: 2 as const,
    destinations: [
      {
        kind: "psychiatric_ward" as const,
        unitId: UNIT.id,
        sex: "Female" as const,
        gender: "Female" as const,
        secureBedNeeded: false,
        involuntaryBedNeeded: false,
        highAcuityNursingNeeded: false,
      },
    ],
    homeRegion: "Perth Metropolitan" as const,
    suburb: { kind: "named" as const, name: "Bentley" },
    transportNeeded: true,
    history,
  };
}

function Driver() {
  const { dispatch, referrals } = useWardFlow();
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    dispatch(refer("Synthetic story to be answered."));
    dispatch(refer("Synthetic story still waiting."));
  }, [dispatch]);
  const first = referrals.find((referral) => referral.history === "Synthetic story to be answered.");
  return (
    <button
      type="button"
      onClick={() =>
        first &&
        dispatch({
          type: "DECLINE_REFERRAL",
          role: "coordinator",
          now: NOW_ANCHOR,
          referralId: first.id,
          destinationKind: "psychiatric_ward",
          unitId: UNIT.id,
          reason: "no_suitable_bed",
        })
      }
    >
      Synthetic decline
    </button>
  );
}

describe("the ward referral inbox folds answered referrals (H-0893)", () => {
  it("shows waiting referrals first and answered ones behind Show N answered", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Driver />
        <WardReferralInbox unitId={UNIT.id} />
      </WardFlowProvider>,
    );
    const inbox = () => within(screen.getByRole("region", { name: "Ward referral inbox" }));
    expect(inbox().queryByRole("button", { name: /answered$/ })).toBeNull();
    const waitingBefore = inbox().getAllByTestId("ward-referral-inbox-story").length;
    fireEvent.click(screen.getByRole("button", { name: "Synthetic decline" }));

    expect(inbox().getByRole("heading", { level: 2 })).toHaveTextContent(
      `Referral inbox · ${waitingBefore - 1} waiting`,
    );
    expect(inbox().getByText("Synthetic story still waiting.")).toBeInTheDocument();
    expect(inbox().queryByText("Synthetic story to be answered.")).toBeNull();

    const toggle = inbox().getByRole("button", { name: /^Show \d+ answered$/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveTextContent(/^Hide \d+ answered$/);
    expect(inbox().getByText("Synthetic story to be answered.")).toBeInTheDocument();
    // The answered referral sits below every waiting one.
    const stories = inbox()
      .getAllByTestId("ward-referral-inbox-story")
      .map((story) => story.textContent);
    expect(stories.indexOf("Synthetic story to be answered.")).toBeGreaterThan(
      stories.indexOf("Synthetic story still waiting."),
    );
  });
});
