import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Walk-through WT-11 (26 Oct 2026): Confirm arrival was one tap with no second identifier. The
// ward now checks the name and UMRN before the arrival is recorded, as a departure does. WF-014 is
// a synthetic seed journey moving to rph-adult-secure with transport collected.
function renderWard() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardScreen unitId="rph-adult-secure" />
    </WardFlowProvider>,
  );
}

describe("Confirm arrival checks who has arrived first (walk-through WT-11)", () => {
  it("asks with the person's name and UMRN before recording the arrival", () => {
    renderWard();
    fireEvent.click(screen.getByTestId("ward-confirm-arrival-WF-014"));
    const check = screen.getByTestId("ward-arrival-identity");
    const line = within(check).getByTestId("ward-arrival-identity-check").textContent ?? "";
    expect(line).toMatch(/^Check: [A-Z][^·]+ · UM\d+$/u);
    expect(line).not.toMatch(/not recorded/iu);
    // Nothing is recorded until the check is confirmed.
    expect(screen.getByTestId("ward-confirm-arrival-WF-014")).toBeInTheDocument();
    fireEvent.click(within(check).getByRole("button", { name: "Confirm arrival" }));
    expect(screen.queryByTestId("ward-confirm-arrival-WF-014")).not.toBeInTheDocument();
  });

  it("records nothing when the check is cancelled", () => {
    renderWard();
    fireEvent.click(screen.getByTestId("ward-confirm-arrival-WF-014"));
    fireEvent.click(within(screen.getByTestId("ward-arrival-identity")).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByTestId("ward-arrival-identity")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-confirm-arrival-WF-014")).toBeInTheDocument();
  });
});
