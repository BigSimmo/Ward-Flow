import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";

import { ToastProvider } from "@/components/wf";
import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { edStepSaid, edStepUndone } from "@/components/ward-management/ed/ed-screen-model";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allEmergencyDepartments, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(cleanup);

/**
 * Coordinator request (1 Nov 2026): two identical "Marked handover ready" toasts side by side left
 * Undo free to take back the wrong person's step. Each ED step toast now names its person, surname
 * first, in both the recorded and the undone wording.
 */
describe("ED step toasts name the person", () => {
  it("words the step and its undo with the person's name", () => {
    const who = "SYNTHETIC, Test";
    expect(edStepSaid({ type: "HANDOVER_READY", role: "ed", now: 0, movementId: "m" } as never, who)).toBe(
      "Marked handover ready for SYNTHETIC, Test",
    );
    expect(edStepUndone(who)).toBe("Undone for SYNTHETIC, Test. Back as it was.");
  });

  it("names the person on the toast and on its Undo", () => {
    const edId = allEmergencyDepartments()
      .map((ed) => ed.id)
      .find((id) => {
        render(
          <WardFlowProvider initialNow={NOW_ANCHOR}>
            <ToastProvider>
              <EdScreen edId={id} />
            </ToastProvider>
          </WardFlowProvider>,
        );
        const found = screen.queryAllByTestId(/^ward-ed-inbox-clearance-no-/u).length > 0;
        cleanup();
        return found;
      });
    expect(edId).toBeDefined();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <EdScreen edId={edId!} />
        </ToastProvider>
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getAllByTestId(/^ward-ed-inbox-clearance-no-/u)[0]!);
    const toast = screen.getByText(/^Recorded not medically cleared for \S.*, \S/u);
    const who = toast.textContent!.replace("Recorded not medically cleared for ", "");
    fireEvent.click(screen.getByRole("button", { name: /Undo/u }));
    expect(screen.getByText(`Undone for ${who}. Back as it was.`)).toBeInTheDocument();
  });
});
