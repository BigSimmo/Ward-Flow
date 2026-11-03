import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WardDetailsLightDismiss } from "@/components/ward-management/shell/ward-details-light-dismiss";

// D-95 (3 Nov 2026): a click outside a floating <details> drop-down closes it; inline disclosures stay open.
function Page() {
  return (
    <>
      <WardDetailsLightDismiss />
      <details open data-testid="floating">
        <summary>Change ward</summary>
        <div style={{ position: "absolute" }}>
          <a href="#a">Ward A</a>
        </div>
      </details>
      <details open data-testid="inline">
        <summary>More detail</summary>
        <p>Inline text</p>
      </details>
      <details open data-testid="opted-out" data-light-dismiss="off">
        <summary>Pinned</summary>
        <div style={{ position: "absolute" }}>Stays</div>
      </details>
      <p>Outside</p>
    </>
  );
}

describe("WardDetailsLightDismiss", () => {
  it("closes a floating details on an outside press and leaves inline and opted-out ones open", () => {
    render(<Page />);
    fireEvent.pointerDown(screen.getByText("Outside"));
    expect(screen.getByTestId("floating")).not.toHaveAttribute("open");
    expect(screen.getByTestId("inline")).toHaveAttribute("open");
    expect(screen.getByTestId("opted-out")).toHaveAttribute("open");
  });

  it("keeps a floating details open when the press is inside it", () => {
    render(<Page />);
    fireEvent.pointerDown(screen.getByText("Ward A"));
    expect(screen.getByTestId("floating")).toHaveAttribute("open");
  });
});
