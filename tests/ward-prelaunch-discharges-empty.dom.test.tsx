import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// The board renders next/link anchors and this suite never checks routing (as ward-discharge-board.dom.test.tsx).
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { DischargeBoard } from "@/components/ward-management/discharges/discharge-board";
import { useWardFlow, WardFlowOverride, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/* Q277 (pre-launch review E5, 2 Nov 2026): with no discharges and every filter on All, the list says
   plainly that there is nothing, instead of blaming filters nobody set. */
function EmptyBoard() {
  const flow = useWardFlow();
  return (
    <WardFlowOverride value={{ ...flow, bedReleases: [] }}>
      <DischargeBoard />
    </WardFlowOverride>
  );
}

describe("Q277: Discharges says plainly when nothing is open", () => {
  it("says No discharges open. when no filter is set", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EmptyBoard />
      </WardFlowProvider>,
    );
    expect(screen.getAllByText("No discharges open.").length).toBeGreaterThan(0);
    expect(screen.queryByText("No releases match these filters.")).toBeNull();
  });
});
