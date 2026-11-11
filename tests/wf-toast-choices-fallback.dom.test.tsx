import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// PR #1626 review: the toast's reason menu loads on use (D-148). If its code cannot load, a plain
// list still offers the choice within the Undo window. Synthetic labels only.
vi.mock("@/components/wf/toast-choices", () => {
  throw new Error("Chunk failed to load");
});

import { ToastView } from "@/components/wf/toast";

describe("toast choices without the menu's code", () => {
  it("offers the choices as a plain list, which chooses and closes the toast", async () => {
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
    await act(async () => {});
    const list = await screen.findByRole("combobox", { name: "Add a reason" });
    fireEvent.change(list, { target: { value: "staffing" } });
    expect(onChoose).toHaveBeenCalledWith("staffing");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
