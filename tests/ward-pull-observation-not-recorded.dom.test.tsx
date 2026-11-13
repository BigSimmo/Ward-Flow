import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect, useState, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// jsdom has no App Router context for next/link.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// The record as an ED board holds it when the observation level is recorded as "not recorded".
vi.mock("@/components/ward-management/referrals/accepted-ward-referral", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/referrals/accepted-ward-referral")>();
  return {
    ...actual,
    recordedPullDetails: () => ({
      legalStatus: "Voluntary",
      legalFormCode: null,
      observation: { level: "not_recorded", intervalMinutes: null, reviewAt: null },
      fromEdBoard: false,
    }),
  };
});

import { acceptedReferralsAwaitingPull } from "@/components/ward-management/referrals/accepted-ward-referral";
import {
  CHOOSE_INTERVAL_LINE,
  PullAcceptedReferral,
} from "@/components/ward-management/referrals/pull-accepted-referral";
import { INTERMITTENT_INTERVAL_MINUTES } from "@/components/ward-management/ward-observation";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider } from "@/components/wf";

/**
 * D-188 (tightened 13 Nov): an observation level must be chosen before the bed is pulled,
 * also when the record holds it as "not recorded". Synthetic seed data only.
 */
let current: ReturnType<typeof useWardFlow> | undefined;
function Capture() {
  const flow = useWardFlow();
  useEffect(() => {
    current = flow;
  });
  return null;
}

function FormFirst() {
  const value = useWardFlow();
  const [[item]] = useState(() => acceptedReferralsAwaitingPull(value.referrals, value.units, value.movements));
  return item ? <PullAcceptedReferral item={item} onDone={() => {}} /> : <p>Nothing to pull</p>;
}

describe("Pull the bed: observation recorded as not recorded, D-188 (tightened 13 Nov)", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    current = undefined;
  });

  it("shows Not recorded with nothing chosen and keeps the pull locked until a level is chosen", async () => {
    render(
      <ToastProvider>
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <Capture />
          <FormFirst />
        </WardFlowProvider>
      </ToastProvider>,
    );
    const [first] = acceptedReferralsAwaitingPull(current!.referrals, current!.units, current!.movements);
    const observation = screen.getByTestId("ward-pull-accepted-observation");
    expect(within(observation).queryByRole("radio", { checked: true })).toBeNull();
    expect(observation).toHaveTextContent("Not recorded");
    const confirm = screen.getByTestId("ward-pull-accepted-confirm");
    expect(confirm).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Choose observation level", { selector: "[id$='-why']" })).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(confirm);
    });
    expect(current!.movements.some((movement) => movement.referralId === first!.referral.id)).toBe(false);

    fireEvent.click(within(observation).getByRole("radio", { name: "General" }));
    expect(observation).toHaveTextContent("Changed by Bed coordinator");
    expect(confirm).not.toHaveAttribute("aria-disabled", "true");
    await act(async () => {
      fireEvent.click(confirm);
    });
    const journey = current!.movements.find((movement) => movement.referralId === first!.referral.id)!;
    expect(journey.stage).toBe("pulled");
    expect(journey.observation.level).toBe("general");
  });

  it("D-188 (tightened 13 Nov), D-187: Intermittent with no interval recorded leaves Check every blank and the pull locked", async () => {
    render(
      <ToastProvider>
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <Capture />
          <FormFirst />
        </WardFlowProvider>
      </ToastProvider>,
    );
    const [first] = acceptedReferralsAwaitingPull(current!.referrals, current!.units, current!.movements);
    const observation = screen.getByTestId("ward-pull-accepted-observation");
    fireEvent.click(within(observation).getByRole("radio", { name: "Intermittent" }));
    const interval = screen.getByTestId<HTMLSelectElement>("ward-pull-accepted-interval");
    // Nothing pre-selected: never the first interval in the list.
    expect(interval.value).toBe("");
    const confirm = screen.getByTestId("ward-pull-accepted-confirm");
    expect(confirm).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(CHOOSE_INTERVAL_LINE, { selector: "[id$='-why']" })).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(confirm);
    });
    expect(current!.movements.some((movement) => movement.referralId === first!.referral.id)).toBe(false);

    const chosen = INTERMITTENT_INTERVAL_MINUTES[1]!;
    fireEvent.change(interval, { target: { value: String(chosen) } });
    expect(confirm).not.toHaveAttribute("aria-disabled", "true");
    await act(async () => {
      fireEvent.click(confirm);
    });
    const journey = current!.movements.find((movement) => movement.referralId === first!.referral.id)!;
    expect(journey.stage).toBe("pulled");
    expect(journey.observation).toMatchObject({ level: "intermittent", intervalMinutes: chosen });
  });
});
