import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/people/WF-005",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

import { PatientTransitOperations } from "@/components/ward-management/patients/patient-transit-operations";
import { CANCEL_TRANSPORT_REASONS, changeReasonLabels } from "@/components/ward-management/ward-change-reasons";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider } from "@/components/wf";

/*
 * A9-12 (Audit 9, approved by Josh 13 Nov 2026): once transport was booked, both hints sent the
 * coordinator to a cancel control that was not on the patient page. The page now has it, and the
 * hints name it.
 */
afterEach(() => cleanup());

const MOVEMENT = "WF-005";

function Deck() {
  const { movements } = useWardFlow();
  const movement = movements.find((row) => row.id === MOVEMENT)!;
  return (
    <>
      <PatientTransitOperations movement={movement} showMetrics={false} bare />
      <output data-testid="why">{useWardFlow().rejections.at(-1)?.reason ?? ""}</output>
      <output data-testid="cancelled">
        {movement.transport && movement.transport.cancelledAt === undefined ? "booked" : "cancelled"}
      </output>
    </>
  );
}

describe("A9-12: cancel transport from the patient page", () => {
  it("offers Cancel transport to the coordinator, asks for a reason, and cancels the job", async () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <Deck />
        </ToastProvider>
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("cancelled")).toHaveTextContent("booked");
    const control = screen.getByTestId("ward-patient-cancel-transport");
    const button = within(control).getByRole("button", { name: "Cancel transport" });
    // No reason is chosen for the coordinator: the button waits for one.
    expect(button).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(button);
    expect(screen.getByTestId("cancelled")).toHaveTextContent("booked");

    fireEvent.click(within(control).getByRole("button", { name: changeReasonLabels[CANCEL_TRANSPORT_REASONS[0]] }));
    fireEvent.click(within(control).getByRole("button", { name: "Cancel transport" }));
    // CANCEL_TRANSPORT removes the job, so the movement holds no live booking afterwards.
    await waitFor(() => expect(screen.getByTestId("cancelled")).toHaveTextContent("cancelled"));
    expect(screen.queryByTestId("ward-patient-cancel-transport")).toBeNull();
    expect(screen.getByTestId("why").textContent).toBe("");
  });
});
