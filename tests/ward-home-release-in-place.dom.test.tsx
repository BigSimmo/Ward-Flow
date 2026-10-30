import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";

import { alertKindOf } from "@/components/ward-management/alerts/alerts-model";
import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { RELEASE_PULL_REASONS } from "@/components/ward-management/ward-change-reasons";
import { buildActionInbox, isOpen } from "@/components/ward-management/ward-derivations";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider } from "@/components/wf";

/**
 * H-0977 (workflow-speed audit WS-14, 26 Oct 2026): Home's Act now "Release bed" on an expired bed
 * pull opens one sheet with a release reason and releases in place. The release is raised only by
 * the button press, never by opening the sheet.
 */

const hold = buildActionInbox(wardMovements.filter(isOpen), NOW_ANCHOR, allUnits()).find(
  (item) => alertKindOf(item.id) === "hold",
);

describe("Home Release bed releases in place", () => {
  let latest: ReturnType<typeof useWardFlow> | undefined;
  function Probe() {
    latest = useWardFlow();
    return null;
  }

  function renderHome() {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <Probe />
          <CoordinatorScreen />
        </ToastProvider>
      </WardFlowProvider>,
    );
  }

  it("opens a reason sheet, raises nothing until pressed, then releases the pulled bed", async () => {
    if (!hold) throw new Error("fixture drifted: the seeded inbox has no expired bed pull");
    renderHome();
    const logBefore = latest!.eventLog?.length ?? 0;

    fireEvent.click(screen.getAllByRole("button", { name: /^Release pulled bed for / }).at(0)!);
    const sheet = await screen.findByTestId("home-release-sheet");
    expect(sheet).toHaveTextContent("Choose a reason to release this pulled bed");
    expect(sheet).not.toHaveTextContent(/set a new pull time limit/i);
    // Opening the sheet raises no event.
    expect(latest!.eventLog?.length ?? 0).toBe(logBefore);

    const submit = () => within(sheet).getByRole("button", { name: /^Release pulled bed for / });
    expect(submit()).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(submit());
    expect(latest!.eventLog?.length ?? 0).toBe(logBefore);

    fireEvent.change(within(sheet).getByRole("combobox", { name: "Reason for release" }), {
      target: { value: RELEASE_PULL_REASONS[0] },
    });
    expect(submit()).not.toHaveAttribute("aria-disabled");
    fireEvent.click(submit());

    expect(screen.queryByTestId("home-release-sheet")).not.toBeInTheDocument();
    const released = latest!.eventLog?.filter((entry) => entry.type === "RELEASE_PULL") ?? [];
    expect(released).toHaveLength(1);
    expect(released[0]).toMatchObject({ accepted: true, role: "coordinator" });
    const movement = latest!.movements.find((candidate) => candidate.id === released[0]!.movementId);
    expect(movement?.stage).not.toBe("pulled");
    // Codex review on #864: the outcome is still said after the sheet closes.
    expect(await screen.findByText(/^Bed released for /)).toBeInTheDocument();
  });
});
