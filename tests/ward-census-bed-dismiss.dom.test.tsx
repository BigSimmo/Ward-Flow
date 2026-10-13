import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, onClick }: { children: ReactNode; href: string; onClick?: () => void }) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        onClick?.();
      }}
    >
      {children}
    </a>
  ),
}));

import { Sheet } from "@/components/ui/sheet";
import { buildCensus } from "@/components/ward-management/search/patient-census";
import { CensusDetail } from "@/components/ward-management/search/patient-census-view";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { SHEET_INERT_MARKER } from "@/components/ui/sheet-focus";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

it("dismisses the Census modal when its ward-bed link is activated", async () => {
  const seed = seedWardFlowState();
  const admission = { ...wardAdmissions.find((item) => item.state === "occupied")!, bedNumber: 1 };
  const row = buildCensus({
    ...seed,
    admissions: [admission],
    movements: [],
    referrals: [],
    now: NOW_ANCHOR,
    dayZero: new Date("2026-10-01T00:00:00+08:00"),
  }).rows.find((item) => item.kind === "admission" && item.unitId && item.bedNumber !== undefined)!;
  expect(row).toBeDefined();
  function Harness() {
    const [open, setOpen] = useState(true);
    return (
      <Sheet open={open} onClose={() => setOpen(false)} title="Census patient" portal>
        <CensusDetail row={row} now={NOW_ANCHOR} onNavigate={() => setOpen(false)} onCopy={() => {}} copyNote={null} />
      </Sheet>
    );
  }
  render(<Harness />);
  fireEvent.click(screen.getByRole("link", { name: "Ward bed" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(window.sessionStorage.getItem("wardflow:census-bed-opener-target")).toBe(`${row.unitId}:${row.bedNumber}`);
  expect(document.querySelector(`[${SHEET_INERT_MARKER}="true"]`)).toBeNull();
});
