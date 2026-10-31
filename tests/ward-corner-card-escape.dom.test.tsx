/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { useCornerCardEscape } from "@/components/ward-management/help/use-corner-card-escape";

// Notifications pass (30 Oct 2026): the help corner cards (tour offer, What's new, screen hints)
// closed only by their buttons. Escape now closes them, after anything open has had the key.
function Card({ withDialog = false }: { withDialog?: boolean }) {
  const [open, setOpen] = useState(true);
  useCornerCardEscape(open, () => setOpen(false));
  return (
    <>
      <input aria-label="Notes" />
      {withDialog ? <div role="dialog" aria-modal="true" aria-label="Confirm" /> : null}
      {open ? <section data-testid="corner-card">Want a quick tour?</section> : null}
    </>
  );
}

describe("help corner cards close on Escape", () => {
  it("closes on Escape", () => {
    render(<Card />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("corner-card")).toBeNull();
  });

  it("leaves Escape to an open dialog first", () => {
    render(<Card withDialog />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByTestId("corner-card")).toBeInTheDocument();
  });

  it("leaves typing alone", () => {
    render(<Card />);
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Notes" }), { key: "Escape" });
    expect(screen.getByTestId("corner-card")).toBeInTheDocument();
  });
});
