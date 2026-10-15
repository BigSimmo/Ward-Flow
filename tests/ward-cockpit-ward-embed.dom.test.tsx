import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow/ward/patient",
  useRouter: () => ({ back: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}));

import { MovementWorkspaceCockpit } from "@/components/ward-management/movements/movement-workspace-cockpit";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
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
});
