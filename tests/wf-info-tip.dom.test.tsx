import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InfoTip } from "@/components/wf/info-tip";

/** D-224 (Josh, 14 Nov 2026): tips open on tap, click or keyboard, never on hover alone. */
describe("tap-to-open ⓘ", () => {
  const setup = () =>
    render(
      <p>
        Ready <InfoTip about="Ready">Beds clean and staffed now.</InfoTip>
        <button type="button">Elsewhere</button>
      </p>,
    );

  it("does not open on hover", () => {
    setup();
    const button = screen.getByRole("button", { name: "About Ready" });
    fireEvent.mouseEnter(button);
    fireEvent.pointerEnter(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("info-tip-text")).toBeNull();
  });

  it("opens on press and closes on a second press", () => {
    setup();
    const button = screen.getByRole("button", { name: "About Ready" });
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    const tip = screen.getByTestId("info-tip-text");
    expect(tip).toHaveAttribute("role", "note");
    expect(tip).toHaveTextContent("Beds clean and staffed now.");
    expect(button).toHaveAttribute("aria-controls", tip.id);
    fireEvent.click(button);
    expect(screen.queryByTestId("info-tip-text")).toBeNull();
  });

  it("closes on Escape and gives focus back to the ⓘ", () => {
    setup();
    const button = screen.getByRole("button", { name: "About Ready" });
    fireEvent.click(button);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("info-tip-text")).toBeNull();
    expect(button).toHaveFocus();
  });

  it("closes on a tap outside but not on a tap inside the tip", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "About Ready" }));
    fireEvent.pointerDown(screen.getByTestId("info-tip-text"));
    expect(screen.getByTestId("info-tip-text")).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByRole("button", { name: "Elsewhere" }));
    expect(screen.queryByTestId("info-tip-text")).toBeNull();
  });

  it("is left off paper", () => {
    setup();
    expect(screen.getByRole("button", { name: "About Ready" })).toHaveAttribute("data-print-hide");
  });
});
