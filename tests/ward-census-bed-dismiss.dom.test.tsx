import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState, type AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ navigate: undefined as ((href: string) => void) | undefined, back: vi.fn() }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ back: navigation.back }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a
      {...rest}
      href={href}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
        navigation.navigate?.(href);
      }}
    >
      {children}
    </a>
  ),
}));

import { Sheet } from "@/components/wf/sheet";
import { buildCensus } from "@/components/ward-management/search/patient-census";
import { CensusDetail } from "@/components/ward-management/search/patient-census-view";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { SHEET_INERT_MARKER } from "@/components/wf/sheet-focus";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";

import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
beforeEach(() => {
  navigation.navigate = undefined;
  navigation.back.mockReset();
  window.sessionStorage.clear();
  window.history.replaceState(null, "", "/ward-flow/search");
});
afterEach(cleanup);

it("dismisses the Census modal when its ward-bed link is activated", async () => {
  const seed = seedWardFlowState();
  const admission = { ...wardAdmissions.find((item) => item.state === "occupied")!, bedNumber: 1 };
  const row = buildCensus({
    ...seed,
    admissions: [admission],
    movements: [],
    referrals: [],
    now: NOW_ANCHOR,
    thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
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

it("Escape returns from the Census-linked bed to its Ward bed link with no lingering modal isolation", async () => {
  const seed = seedWardFlowState();
  const admission = { ...wardAdmissions.find((item) => item.state === "occupied")!, bedNumber: 1 };
  const row = buildCensus({
    ...seed,
    admissions: [admission],
    movements: [],
    referrals: [],
    now: NOW_ANCHOR,
    thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
    dayZero: new Date("2026-10-01T00:00:00+08:00"),
  }).rows.find((item) => item.kind === "admission" && item.unitId && item.bedNumber !== undefined)!;
  expect(row).toBeDefined();
  function Harness() {
    const [wardOpen, setWardOpen] = useState(false);
    const [detailsOpen, setDetailsOpen] = useState(true);
    navigation.navigate = (href) => {
      window.history.pushState(null, "", href);
      setWardOpen(true);
    };
    navigation.back.mockImplementation(() => {
      window.history.replaceState(null, "", "/ward-flow/search");
      setWardOpen(false);
    });
    if (wardOpen) return <WardScreen unitId={row.unitId!} />;
    return (
      <>
        <CensusDetail row={row} now={NOW_ANCHOR} onCopy={() => {}} copyNote={null} />
        <Sheet open={detailsOpen} onClose={() => setDetailsOpen(false)} title="Census patient" portal>
          <CensusDetail
            row={row}
            now={NOW_ANCHOR}
            onNavigate={() => setDetailsOpen(false)}
            onCopy={() => {}}
            copyNote={null}
          />
        </Sheet>
      </>
    );
  }
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Harness />
    </WardFlowProvider>,
  );
  fireEvent.click(
    within(screen.getByRole("dialog", { name: "Census patient" })).getByRole("link", { name: "Ward bed" }),
  );
  const bedDrawer = document.querySelector<HTMLElement>('[role="dialog"][aria-labelledby="drawer-bed-title"]');
  expect(bedDrawer).not.toBeNull();
  fireEvent.keyDown(bedDrawer!, { key: "Escape", code: "Escape" });
  expect(navigation.back).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(screen.getByRole("link", { name: "Ward bed" })).toHaveFocus());
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  expect(screen.getByRole("link", { name: "Ward bed" })).toHaveFocus();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.querySelector(`[${SHEET_INERT_MARKER}="true"]`)).toBeNull();
  expect(window.sessionStorage.getItem("wardflow:census-bed-opener-target")).toBeNull();
  expect(window.sessionStorage.getItem("wardflow:census-bed-opener")).toBeNull();
});
