import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/people/WF-005",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

import { PatientTransitOperations } from "@/components/ward-management/patients/patient-transit-operations";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider } from "@/components/wf";

/*
 * F-106 (A14-04, approved by Josh 13 Nov 2026): after Confirm arrival the panel still showed the bed
 * pull timer until Esc. Once the person has arrived the bed is no longer held for them, so the timer
 * goes. Synthetic data only.
 */
afterEach(() => cleanup());

const HOUR = 60 * 60 * 1000;

function Deck({ patch }: { patch: (movement: Movement, now: number) => Movement }) {
  const { movements, now } = useWardFlow();
  const movement = movements.find((row) => row.id === "WF-005")!;
  return <PatientTransitOperations movement={patch(movement, now)} showMetrics={false} bare />;
}

function renderDeck(patch: (movement: Movement, now: number) => Movement) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ToastProvider>
        <Deck patch={patch} />
      </ToastProvider>
    </WardFlowProvider>,
  );
}

describe("F-106: the pull timer goes once the person has arrived", () => {
  it("shows the timer while the bed is pulled", () => {
    renderDeck((movement, now) => ({ ...movement, stage: "pulled", closure: undefined, pullExpiresAt: now + HOUR }));
    expect(screen.getByTestId("ward-patient-transit-pull-timer")).toHaveTextContent("Bed pulled");
  });

  it("shows no timer after arrival, even with the pull time still on the record", () => {
    renderDeck((movement, now) => ({ ...movement, stage: "arrived", pullExpiresAt: now + HOUR }));
    expect(screen.queryByTestId("ward-patient-transit-pull-timer")).toBeNull();
  });
});
