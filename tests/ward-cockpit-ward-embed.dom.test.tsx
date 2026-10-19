import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/ward/patient",
  useRouter: () => ({ back: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}));

import { MovementWorkspaceCockpit } from "@/components/ward-management/movements/movement-workspace-cockpit";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { movementById } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Review on #342 (CodeAnt): the patient page embeds the movement cockpit on ward routes with
 * role `ward`, and the cockpit used to raise every action as the coordinator. A ward now raises in
 * its own name, so an action only a coordinator may take shows as off, with the reason.
 */
describe("the movement cockpit embedded on a ward page", () => {
  it("shows the coordinator-only urgent flag as off, with the reason", () => {
    const movement = movementById("WF-001");
    if (!movement) throw new Error("fixture movement missing");
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <MovementWorkspaceCockpit movementId={movement.id} embedded role="ward" />
      </WardFlowProvider>,
    );
    const toggle = screen.getByTestId("ward-console-urgent-flag-toggle");
    expect(toggle).toBeDisabled();
    const reasonId = toggle.getAttribute("aria-describedby");
    expect(reasonId).toBeTruthy();
    expect(document.getElementById(reasonId as string)).toHaveTextContent(/coordinator/i);
  });

  it("shows Cancel transport as off when another team booked the job, with the reason", () => {
    // Test-only scaffold: pull, book as the emergency department, then step back, so the job is
    // left with no bed held and the cancel control shows. Each step goes through the real reducer.
    function Drive() {
      const { dispatch, now, movements } = useWardFlow();
      const unitId = movements.find((candidate) => candidate.id === "WF-003")?.acceptedUnitId ?? "";
      return (
        <button
          type="button"
          data-testid="test-orphan"
          onClick={() => {
            dispatch({ type: "PULL_PATIENT", role: "ward", now, movementId: "WF-003", unitId });
            dispatch({
              type: "BOOK_TRANSPORT",
              role: "ed",
              now,
              movementId: "WF-003",
              provider: "Patient transport service",
              escortRequired: true,
              cadNumber: "CAD-STUB-0001",
              transportLegalStatus: "voluntary",
              estimatedAt: 0,
            });
            dispatch({
              type: "STEP_BACK_STAGE",
              role: "coordinator",
              now,
              movementId: "WF-003",
              to: "accepted_awaiting_bed",
              reason: "recorded_in_error",
            });
          }}
        >
          orphan
        </button>
      );
    }
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Drive />
        <MovementWorkspaceCockpit movementId="WF-003" embedded role="ward" />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("test-orphan"));
    const cancel = screen.getByTestId("ward-console-cancel-transport");
    expect(cancel).toHaveAttribute("aria-disabled", "true");
    expect(cancel).toHaveAttribute("aria-describedby", "ward-console-cancel-transport-not-yours");
    expect(screen.getByTestId("ward-console-cancel-transport-not-yours")).toHaveTextContent(/did not book the job/);
    fireEvent.change(screen.getByTestId("ward-console-cancel-transport-reason"), {
      target: { value: "destination_changed" },
    });
    fireEvent.click(cancel);
    expect(screen.getByTestId("ward-patient-orphaned-transport")).toBeInTheDocument();
  });
});
