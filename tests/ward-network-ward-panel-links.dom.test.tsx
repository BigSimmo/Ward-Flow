import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

/** The desk's access check, set per case. */
const access = vi.hoisted(() => ({ canOpen: (() => true) as (href: string) => boolean }));
vi.mock("@/components/ward-management/shell/ward-access", async (load) => ({
  ...(await load<typeof import("@/components/ward-management/shell/ward-access")>()),
  useCanOpenHref: () => (href: string) => access.canOpen(href),
}));

import { CapacityWardSidebar } from "@/components/ward-management/capacity/capacity-ward-sidebar";
import { networkWardRows } from "@/components/ward-management/capacity/capacity-derivations";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider } from "@/components/wf/toast-provider";

/**
 * Bug list row 21 (31 Oct 2026): Capacity's ward panel offered Open ward and Discharge board to
 * every desk, without asking whether this desk may open them. Synthetic seed only.
 */
function renderSidebar() {
  const [row] = networkWardRows(allUnits(), NOW_ANCHOR);
  render(
    <ToastProvider>
      <WardFlowProvider>
        <CapacityWardSidebar row={row} onBack={() => {}} now={NOW_ANCHOR} />
      </WardFlowProvider>
    </ToastProvider>,
  );
  return row;
}

describe("Capacity ward panel links follow the desk's access", () => {
  it("shows both links to a desk that may open them", () => {
    access.canOpen = () => true;
    const row = renderSidebar();
    expect(screen.getByRole("link", { name: "Open ward" })).toHaveAttribute("href", `/ward-flow/ward/${row.unit.id}`);
    expect(screen.getByRole("link", { name: "Discharge board" })).toHaveAttribute("href", "/ward-flow/discharges");
  });

  it("hides a link the desk cannot open", () => {
    access.canOpen = (href) => href === "/ward-flow/discharges";
    renderSidebar();
    expect(screen.queryByRole("link", { name: "Open ward" })).toBeNull();
    expect(screen.getByRole("link", { name: "Discharge board" })).toBeInTheDocument();
  });
});
