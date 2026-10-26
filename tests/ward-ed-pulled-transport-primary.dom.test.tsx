import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * H-0974 (workflow-speed audit WS-09, 26 Oct 2026): once a bed is pulled for a patient and no
 * transport is logged, the row's main button, Log transport booking, logs the booking, even while the
 * examination is still unrecorded. Seeded WF-004 (St John of God Midland ED) is pulled with no
 * examination and no transport.
 */
function renderEd() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <EdScreen edId="sjgm-ed" />
    </WardFlowProvider>,
  );
}

describe("ED board row — pulled bed puts the transport booking first", () => {
  it("makes Log transport booking the main button for a pulled bed with no transport logged", () => {
    renderEd();
    const next = screen.getByTestId("ward-ed-next-WF-004");
    expect(next).toHaveTextContent("Log transport booking");
    expect(next).not.toHaveTextContent("Record exam");
  });

  it("opens the transport booking from the main button", () => {
    renderEd();
    const next = screen.getByTestId("ward-ed-next-WF-004");
    expect(next).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(next);
    expect(screen.getByTestId("ward-ed-next-WF-004")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("ward-ed-transport-legal-status-WF-004")).toBeInTheDocument();
  });
});
