import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { DecisionClock } from "@/components/ward-management/referrals/referral-board-parts";
import { WardFlowContext } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Referral } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Smart features idea 3 on screen: the note sits under a waiting referral's decision clock. */
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const NOW = NOW_ANCHOR;

function waitingReferral(openedAt?: number) {
  const seeded = seedWardFlowState();
  const unit = seeded.units[0]!;
  const referral: Referral = {
    ...seeded.referrals[0]!,
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          unitId: unit.id,
          sex: "Female",
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
        state: "queued",
        referredAt: NOW - 60,
        ...(openedAt === undefined ? {} : { openedAt }),
      },
    ],
  };
  const value = { movements: seeded.movements, inboxOwnership: {}, units: seeded.units };
  return { referral, unit, value: value as unknown as React.ContextType<typeof WardFlowContext> };
}

describe("Being worked on by", () => {
  it("names the ward that opened a waiting referral, and leaves the clock running", () => {
    const { referral, unit, value } = waitingReferral(NOW - 5);
    render(
      <WardFlowContext.Provider value={value}>
        <DecisionClock referral={referral} now={NOW} />
      </WardFlowContext.Provider>,
    );
    expect(screen.getByTestId(`ward-referral-worked-on-${referral.id}`)).toHaveTextContent(
      `Being worked on by ${unit.name}`,
    );
    expect(screen.getByTestId(`ward-referral-clock-${referral.id}`)).toHaveTextContent("waiting");
  });

  it("shows nothing until a desk opens or claims it", () => {
    const { referral, value } = waitingReferral();
    render(
      <WardFlowContext.Provider value={value}>
        <DecisionClock referral={referral} now={NOW} />
      </WardFlowContext.Provider>,
    );
    expect(screen.queryByTestId(`ward-referral-worked-on-${referral.id}`)).toBeNull();
  });
});
