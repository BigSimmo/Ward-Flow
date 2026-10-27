import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/alerts",
  useRouter: () => ({ back: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}));

import { ToastProvider } from "@/components/wf";
import { AlertArrivedAtWard } from "@/components/ward-management/alerts/alert-arrived-at-ward";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * P069, approved by Josh in chat, Oct 27, 2026, 10:02 PM AWST: "P069: yes, approve the Arrived at
 * ward confirm and toast exactly as shown, with 10 s Undo", and at 11:36 PM AWST: "P069: show the
 * action only for no-transport pulls, no engine change". Synthetic seed data only.
 */
const NOW = NOW_ANCHOR;

function pulledSteps(needed: boolean) {
  const seed = seedWardFlowState();
  const open = seed.movements.find(
    (candidate) =>
      candidate.referredUnitIds.length > 0 &&
      !candidate.acceptedUnitId &&
      !candidate.closure &&
      !candidate.transport &&
      (seed.units.find((unit) => unit.id === candidate.referredUnitIds[0])?.allocatable.value ?? 0) > 0,
  )!;
  const movementId = open.id;
  const unitId = open.referredUnitIds[0]!;
  const unitName = seed.units.find((unit) => unit.id === unitId)!.name;
  const steps = [
    {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      movementId,
      unitId,
      overrideReason: "The bed information is known to be out of date",
    },
    { type: "PULL_PATIENT", role: "ward", movementId, unitId },
    { type: "RECORD_TRANSPORT_NEED", role: "ed", movementId, needed },
  ].map((step, index) => ({ ...step, now: NOW + index + 1 }) as unknown as WardFlowEvent);
  return { movementId, unitName, steps };
}

function Harness({ movementId, steps }: { movementId: string; steps: WardFlowEvent[] }) {
  const { dispatch, movements } = useWardFlow();
  useEffect(() => {
    for (const step of steps) dispatch(step);
    // Once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const movement = movements.find((candidate) => candidate.id === movementId)!;
  return (
    <>
      <span data-testid="stage">{movement.stage}</span>
      <AlertArrivedAtWard movement={movement} displayName="Synthetic patient" />
    </>
  );
}

function renderFor(needed: boolean) {
  const { movementId, unitName, steps } = pulledSteps(needed);
  render(
    <WardFlowProvider initialNow={NOW + 10}>
      <ToastProvider>
        <Harness movementId={movementId} steps={steps} />
      </ToastProvider>
    </WardFlowProvider>,
  );
  return { unitName };
}

describe("Arrived at ward on a pulled-bed alert (P069)", () => {
  it("asks first with the approved wording, records the arrival, and offers Undo for 10 s", async () => {
    const { unitName } = renderFor(false);
    expect(screen.getByTestId("stage")).toHaveTextContent("pulled");
    fireEvent.click(screen.getByRole("button", { name: "Arrived at ward" }));
    expect(
      screen.getByText(`Mark Synthetic patient as arrived at ${unitName}? The pulled bed becomes occupied.`),
    ).toBeInTheDocument();
    expect(screen.getByTestId("stage")).toHaveTextContent("pulled");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Mark arrived" }));
    });
    expect(screen.getByTestId("stage")).not.toHaveTextContent("pulled");
    expect(await screen.findByText(`Synthetic patient arrived at ${unitName}`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Undo/ })).toBeInTheDocument();
    expect(screen.getByText("10s left")).toBeInTheDocument();
  });

  it("Cancel records nothing", () => {
    renderFor(false);
    fireEvent.click(screen.getByRole("button", { name: "Arrived at ward" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByTestId("stage")).toHaveTextContent("pulled");
    expect(screen.queryByText(/The pulled bed becomes occupied/)).not.toBeInTheDocument();
  });

  it("is not offered when transport is needed, because the engine would refuse the arrival", () => {
    renderFor(true);
    expect(screen.getByTestId("stage")).toHaveTextContent("pulled");
    expect(screen.queryByRole("button", { name: "Arrived at ward" })).not.toBeInTheDocument();
  });
});
