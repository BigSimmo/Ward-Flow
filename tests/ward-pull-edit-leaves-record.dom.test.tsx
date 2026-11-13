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

// The record holds a legal status, "no form" and an observation level, so every fact on the form
// starts filled in from it. Synthetic values only.
vi.mock("@/components/ward-management/referrals/accepted-ward-referral", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/referrals/accepted-ward-referral")>();
  return {
    ...actual,
    recordedPullDetails: () => ({
      legalStatus: "Voluntary",
      legalFormCode: null,
      observation: { level: "general", intervalMinutes: null, reviewAt: null },
      fromEdBoard: false,
    }),
  };
});

import { acceptedReferralsAwaitingPull } from "@/components/ward-management/referrals/accepted-ward-referral";
import { PullAcceptedReferral } from "@/components/ward-management/referrals/pull-accepted-referral";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider } from "@/components/wf";

/**
 * D-188 and D-191 (Josh, 13 Nov 2026): the pull form fills in from the record and can be changed,
 * but a change on the form never updates the record. It stays on the pull ("Changed by ..."), so
 * the referral, the patient and every other movement are exactly as they were. Synthetic seed only.
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

describe("Pull the bed: an edit on the form leaves the record unchanged (D-188, D-191)", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    current = undefined;
  });

  it("carries the changed observation level on the pull only", async () => {
    render(
      <ToastProvider>
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <Capture />
          <FormFirst />
        </WardFlowProvider>
      </ToastProvider>,
    );
    const [first] = acceptedReferralsAwaitingPull(current!.referrals, current!.units, current!.movements);
    expect(first, "the seed has no accepted referral awaiting a pull").toBeDefined();
    const referralBefore = structuredClone(current!.referrals.find((r) => r.id === first!.referral.id));
    const patientsBefore = structuredClone(current!.patients);
    const movementsBefore = structuredClone(current!.movements);

    const observation = screen.getByTestId("ward-pull-accepted-observation");
    // Filled in from the record, then changed by the person pulling.
    expect(within(observation).getByRole("radio", { name: "General" })).toBeChecked();
    fireEvent.click(within(observation).getByRole("radio", { name: "Constant within sight" }));
    expect(observation).toHaveTextContent("Changed by Bed coordinator");

    const confirm = screen.getByTestId("ward-pull-accepted-confirm");
    expect(confirm).not.toHaveAttribute("aria-disabled", "true");
    await act(async () => {
      fireEvent.click(confirm);
    });

    const journey = current!.movements.find((movement) => movement.referralId === first!.referral.id);
    expect(journey?.stage).toBe("pulled");
    expect(journey?.observation.level).not.toBe("general");

    // The record is untouched: the referral, every patient and every movement that existed before.
    expect(current!.referrals.find((r) => r.id === first!.referral.id)).toEqual(referralBefore);
    expect(current!.patients).toEqual(patientsBefore);
    for (const before of movementsBefore) {
      expect(current!.movements.find((movement) => movement.id === before.id)).toEqual(before);
    }
  });
});
