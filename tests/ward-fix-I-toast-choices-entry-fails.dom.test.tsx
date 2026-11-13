import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Audit 4 A4-08 (13 Nov 2026): the toast loaded its choices' entry with React's own `lazy` and no
// failure handling, so a failed fetch threw to the page. Now that toast shows without its choices,
// keeping its title and its own Close. Synthetic labels only.
vi.mock("@/components/wf/toast-choices-entry", () => {
  throw new Error("Chunk failed to load");
});

import { ToastView } from "@/components/wf/toast";

describe("toast whose choices' code cannot load", () => {
  it("still shows the toast and its Close, without the choices, and does not throw", async () => {
    render(
      <ToastView
        title="Bed 4 closed."
        choices={{ label: "Add a reason", items: [{ id: "staffing", label: "Staffing" }], onChoose: vi.fn() }}
        onClose={vi.fn()}
      />,
    );
    await expect(import("@/components/wf/toast-choices-entry")).rejects.toThrow();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByText("Bed 4 closed.")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Add a reason" })).toBeNull();
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
  });
});
