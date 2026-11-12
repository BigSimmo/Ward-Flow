import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// PR #1626 review: the toast's reason menu loads on use (D-148). If its code cannot load, plain
// buttons still offer the choice within the Undo window. Synthetic labels only.
vi.mock("@/components/wf/toast-choices", () => {
  throw new Error("Chunk failed to load");
});

import { ToastView } from "@/components/wf/toast";

describe("toast choices without the menu's code", () => {
  it("offers the choices as plain buttons, which chooses and closes the toast", async () => {
    const onChoose = vi.fn();
    const onClose = vi.fn();
    render(
      <ToastView
        title="Bed 4 closed."
        choices={{
          label: "Add a reason",
          items: [
            { id: "staffing", label: "Staffing" },
            { id: "maintenance", label: "Maintenance" },
          ],
          onChoose,
        }}
        onClose={onClose}
      />,
    );
    // The menu's import has failed, and React has settled on the fallback the failed import gives,
    // not the Suspense fallback shown while it is pending.
    await expect(import("@/components/wf/toast-choices")).rejects.toThrow();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const group = await screen.findByRole("group", { name: "Add a reason" });
    fireEvent.click(within(group).getByRole("button", { name: "Staffing" }));
    expect(onChoose).toHaveBeenCalledWith("staffing");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
