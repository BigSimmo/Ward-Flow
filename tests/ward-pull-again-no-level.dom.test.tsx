import { render, screen } from "@testing-library/react";
import { useEffect, useState, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// jsdom has no App Router context for next/link.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// The journey the Undo left open records no observation level (synthetic seed change only).
const target = vi.hoisted(() => ({ movementId: undefined as string | undefined }));
vi.mock("@/components/ward-management/ward-flow-reducer", async (original) => {
  const actual = await original<typeof import("@/components/ward-management/ward-flow-reducer")>();
  const { NOT_RECORDED_OBSERVATION } = await import("@/components/ward-management/ward-observation");
  return {
    ...actual,
    seedWardFlowStateAt: (...args: Parameters<typeof actual.seedWardFlowStateAt>) => {
      const state = actual.seedWardFlowStateAt(...args);
      const movement = state.movements.find(
        (candidate) => !candidate.closure && candidate.stage === "accepted_awaiting_bed",
      );
      if (movement) {
        target.movementId = movement.id;
        movement.observation = { ...NOT_RECORDED_OBSERVATION };
      }
      return state;
    },
  };
});

import { acceptedReferralsAwaitingPull } from "@/components/ward-management/referrals/accepted-ward-referral";
import { PullAcceptedReferral } from "@/components/ward-management/referrals/pull-accepted-referral";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider } from "@/components/wf";

/**
 * Review G-1 (D-188 tightened again 13 Nov, every pull): Pull the bed on a journey an Undo left open
 * is refused while that journey records no observation level; the level is chosen on the movement.
 */
let current: ReturnType<typeof useWardFlow> | undefined;
function Capture() {
  const flow = useWardFlow();
  useEffect(() => {
    current = flow;
  });
  return null;
}

function PullAgainForm() {
  const value = useWardFlow();
  const [[item]] = useState(() => acceptedReferralsAwaitingPull(value.referrals, value.units, value.movements));
  return item && target.movementId ? (
    <PullAcceptedReferral item={{ ...item, movementId: target.movementId }} onDone={() => {}} />
  ) : (
    <p>Nothing to pull</p>
  );
}

describe("Pull the bed again with no level recorded (review G-1)", () => {
  it("is refused, and says to choose the level on the movement", () => {
    render(
      <ToastProvider>
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <Capture />
          <PullAgainForm />
        </WardFlowProvider>
      </ToastProvider>,
    );
    expect(target.movementId, "the seed has no open journey awaiting a bed").toBeDefined();
    expect(current).toBeDefined();
    expect(screen.getByTestId("ward-pull-accepted-recorded")).toHaveTextContent("Not recorded");
    expect(screen.getByTestId("ward-pull-accepted-confirm")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Choose an observation level on the movement first")).toBeInTheDocument();
  });
});
