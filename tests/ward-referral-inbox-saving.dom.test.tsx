import "@testing-library/jest-dom/vitest";
import { useEffect, useRef, type ReactNode } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WardReferralInbox } from "@/components/ward-management/referrals/ward-referral-inbox";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Audit row P053: while one answer is saving, Accept, Waiting list and Decline are unavailable, so
 * a second press cannot send the same decision again under a new command id.
 */
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/referrals",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

const UNIT = seedWardFlowState().units.find((unit) => unit.cohort === "Adult")!;

function Refer() {
  const { dispatch } = useWardFlow();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    dispatch({
      type: "RECEIVE_REFERRAL",
      role: "community",
      now: NOW_ANCHOR,
      ageBand: "Adult",
      source: "community",
      originSiteCode: "BTY",
      urgency: 2,
      destinations: [
        {
          kind: "psychiatric_ward",
          unitId: UNIT.id,
          sex: "Female",
          gender: "Female",
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
      ],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Bentley" },
      transportNeeded: true,
      history: "Synthetic saving case.",
    });
  }, [dispatch]);
  return null;
}

const sent: string[] = [];
let settle: ((outcome: WardCommandOutcome) => void) | undefined;

function Hold({ children }: { children: ReactNode }) {
  const value = useWardFlow();
  const dispatch: WardCommandDispatch = (event) => {
    if (event.type === "RECEIVE_REFERRAL") return value.dispatch(event);
    sent.push(event.type);
    return new Promise<WardCommandOutcome>((resolve) => {
      settle = resolve;
    }) as ReturnType<WardCommandDispatch>;
  };
  return <WardFlowOverride value={{ ...value, dispatch }}>{children}</WardFlowOverride>;
}

describe("referral inbox answers while saving (P053)", () => {
  it("greys every answer while one is in flight, sends it once, and frees them after", async () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Hold>
          <Refer />
          <WardReferralInbox unitId={UNIT.id} />
        </Hold>
      </WardFlowProvider>,
    );
    const inbox = within(screen.getByRole("region", { name: "Ward referral inbox" }));
    const accept = inbox.getByRole("button", { name: "Accept referral" });
    const waitlist = inbox.getByRole("button", { name: "Waiting list" });
    fireEvent.change(inbox.getByLabelText("Decline reason"), { target: { value: "no_suitable_bed" } });
    const decline = inbox.getByRole("button", { name: "Decline referral" });
    expect(accept).not.toHaveAttribute("aria-disabled");

    fireEvent.click(accept);
    for (const button of [accept, waitlist, decline]) {
      expect(button).toHaveAttribute("aria-disabled", "true");
      fireEvent.click(button);
    }
    expect(sent).toEqual(["ACCEPT_REFERRAL"]);

    await act(async () => {
      settle?.({ status: "failed", commandId: "c-1", message: "Not saved" } as WardCommandOutcome);
    });
    expect(accept).not.toHaveAttribute("aria-disabled");
    expect(waitlist).not.toHaveAttribute("aria-disabled");
  });
});
