import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/alerts",
  useRouter: () => ({ back: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}));

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { ToastProvider } from "@/components/wf";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * P069 in the real Alerts list. Recording the arrival closes the "Bed pull expired" alert, so the alert
 * detail (and the control inside it) leaves the list at once. The toast with its 10 s Undo must still
 * appear, and Undo must bring the alert back. The standalone test in `ward-alerts-arrived-at-ward.dom.test.tsx`
 * keeps the control mounted and cannot see this. Synthetic seed data only.
 */
const NOW = NOW_ANCHOR;
// Well past the bed hold, so the pulled bed's alert is on the list.
const LATER = NOW + 600;

function pulledNoTransport() {
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
  const steps = [
    {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      movementId,
      unitId,
      overrideReason: "The bed information is known to be out of date",
    },
    { type: "PULL_PATIENT", role: "ward", movementId, unitId },
    { type: "RECORD_TRANSPORT_NEED", role: "ed", movementId, needed: false },
  ].map((step, index) => ({ ...step, now: NOW + index + 1 }) as unknown as WardFlowEvent);
  return { movementId, steps };
}

function Seed({ steps }: { steps: WardFlowEvent[] }) {
  const { dispatch } = useWardFlow();
  useEffect(() => {
    for (const step of steps) dispatch(step);
    // Once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function Stage({ movementId }: { movementId: string }) {
  const { movements } = useWardFlow();
  return <span data-testid="stage">{movements.find((candidate) => candidate.id === movementId)?.stage}</span>;
}

describe("Arrived at ward from the real Alerts list (P069)", () => {
  it("still shows the toast with 10 s Undo after the alert leaves the list, and Undo brings the alert back", async () => {
    const { movementId, steps } = pulledNoTransport();
    const { container } = render(
      <WardFlowProvider initialNow={LATER}>
        <ToastProvider>
          <Seed steps={steps} />
          <Stage movementId={movementId} />
          <AlertsScreen />
        </ToastProvider>
      </WardFlowProvider>,
    );
    const alertRow = () =>
      container.querySelector<HTMLElement>(`li[data-alert-id="bed-pull-${movementId}"]`) as HTMLElement | null;
    const row = alertRow();
    expect(row, "the expired bed pull should be on the Alerts list").not.toBeNull();
    expect(screen.getByTestId("stage")).toHaveTextContent("pulled");

    fireEvent.click(within(row!).getByTestId("ward-alerts-open"));
    const panel = screen.getByRole("complementary", { name: "Selected alert" });
    fireEvent.click(within(panel).getByRole("button", { name: "Arrived at ward" }));
    await act(async () => {
      fireEvent.click(within(panel).getByRole("button", { name: "Mark arrived" }));
    });

    // The arrival is recorded and the alert has left the list, taking its detail with it.
    expect(screen.getByTestId("stage")).not.toHaveTextContent("pulled");
    expect(alertRow()).toBeNull();

    // The toast and its Undo outlive the alert.
    expect(await screen.findByText(/ arrived at /)).toBeInTheDocument();
    expect(screen.getByText("10s left")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Undo/ }));
    });
    expect(screen.getByTestId("stage")).toHaveTextContent("pulled");
    expect(alertRow()).not.toBeNull();
    expect(await screen.findByText("Undone. Back as it was.")).toBeInTheDocument();
  });
});
