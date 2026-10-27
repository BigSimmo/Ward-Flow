import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EdPresentation } from "@/components/ward-management/ed/ed-board-controls";

// Form friction fix 10 (27 Oct 2026): Escape never throws away typed presentation text. Only Cancel
// or Close discards it. Synthetic data only.
function cancelEvent(dialog: HTMLElement) {
  const event = new Event("cancel", { cancelable: true });
  fireEvent(dialog, event);
  return event;
}

describe("ED presentation editor keeps typed text", () => {
  it("refuses Escape while the text differs from what is saved, and allows it once unchanged", () => {
    render(<EdPresentation patientName="Synthetic person" value="Low mood" onChange={vi.fn()} />);
    const dialog = document.querySelector("dialog")!;
    const text = screen.getByLabelText("Brief presentation");

    fireEvent.change(text, { target: { value: "Low mood, not sleeping" } });
    expect(cancelEvent(dialog).defaultPrevented).toBe(true);

    fireEvent.change(text, { target: { value: "Low mood" } });
    expect(cancelEvent(dialog).defaultPrevented).toBe(false);
  });
});
