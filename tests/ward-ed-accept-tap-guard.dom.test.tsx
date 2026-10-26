import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ReferralMatchView } from "@/components/ward-management/referrals/referral-match";
import { ACCEPT_SECOND_TAP_GUARD_MS } from "@/components/ward-management/referrals/use-referral-match-state";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { Referral } from "@/components/ward-management/ward-model";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

/**
 * Audit CS3-08: "Confirm acceptance" replaces "Accept presentation" in the same place, so a double
 * tap accepted the presentation without a real second look. A tap within 600 ms of opening the
 * confirm is now the same double tap and is ignored. Synthetic referral only.
 */
const REFERRAL: Referral = {
  id: "RF-TAP-GUARD",
  ageBand: "Adult",
  homeRegion: "Perth Metropolitan",
  suburb: { kind: "named", name: "Armadale" },
  source: "community",
  raisedAt: NOW_ANCHOR - 30,
  urgency: 2,
  originSiteCode: "RPH",
  transportNeeded: false,
  destinations: [
    { destination: { kind: "emergency_department", edId: "rph-ed", purpose: "psychiatric_review" }, state: "queued" },
  ],
  ...FIXTURE_HISTORY,
};

afterEach(() => vi.restoreAllMocks());

function renderView() {
  const sent: WardFlowEvent[] = [];
  const dispatch = (event: WardFlowEvent) => {
    sent.push(event);
  };
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ReferralMatchView referral={REFERRAL} units={allUnits()} now={NOW_ANCHOR} dispatch={dispatch} rejections={[]} />
    </WardFlowProvider>,
  );
  return () => sent.filter((event) => event.type === "ACCEPT_REFERRAL").length;
}

describe("ED accept confirm ignores the double tap (audit CS3-08)", () => {
  it("ignores a tap on Confirm acceptance straight after Accept, and takes a later one", () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    const accepted = renderView();
    fireEvent.click(screen.getByTestId("ward-referral-match-accept-emergency_department"));
    clock.mockReturnValue(1_000_000 + 120);
    fireEvent.click(screen.getByTestId("ward-referral-match-confirm-accept-emergency_department"));
    expect(accepted()).toBe(0);
    expect(screen.getByTestId("ward-referral-match-confirm-accept-emergency_department")).toBeInTheDocument();
    clock.mockReturnValue(1_000_000 + ACCEPT_SECOND_TAP_GUARD_MS + 50);
    fireEvent.click(screen.getByTestId("ward-referral-match-confirm-accept-emergency_department"));
    expect(accepted()).toBe(1);
  });
});
