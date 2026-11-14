import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useLayoutEffect, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

/*
 * Root-cause fixes 2.3 (footer clock words), 3.3 (a pack print counts only when the person says it
 * printed) and 3.5 (the ward page's constant observation figure counts staff). Synthetic data only.
 */

const desk = vi.hoisted(() => ({ role: "coordinator" as string }));
vi.mock("@/components/ward-management/ward-role-gate", async (original) => ({
  ...(await original<typeof import("@/components/ward-management/ward-role-gate")>()),
  useRouteRole: () => desk.role,
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { DowntimePackScreen } from "@/components/ward-management/reports/downtime-pack-screen";
import { forgetDowntimePack } from "@/components/ward-management/reports/downtime-pack";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { WardSharedSaveContext } from "@/components/ward-management/shell/ward-shared-save-context";
import { useWardFlowSelect, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allUnits, DEMONSTRATION_DAY_LABEL, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { BedStateCounts } from "@/components/ward-management/ward-bed-states";
import { wardHeroTopParts } from "@/components/ward-management/ward/ward-hero-top-parts";
import { ToastProvider } from "@/components/wf";

afterEach(() => {
  cleanup();
  forgetDowntimePack();
  vi.restoreAllMocks();
  desk.role = "coordinator";
});

describe("2.3 the footer names the clock from the mode, with no fixed date", () => {
  it("says Demo board clock on the public demo, with no scenario date", () => {
    render(<WardPrototypeFooter />);
    const footer = screen.getByTestId("ward-prototype-footer");
    expect(footer).toHaveTextContent("Demo board clock");
    expect(footer.outerHTML).not.toContain(DEMONSTRATION_DAY_LABEL);
    expect(footer.outerHTML).not.toMatch(/scenario set on/i);
  });

  it("says Real Perth time on the signed-in site, never Demo board clock", () => {
    render(
      <WardSharedSaveContext.Provider
        value={{ unconfirmedSave: false, status: "ready", error: null, retry: () => undefined }}
      >
        <WardPrototypeFooter />
      </WardSharedSaveContext.Provider>,
    );
    const footer = screen.getByTestId("ward-prototype-footer");
    expect(footer).toHaveTextContent("Real Perth time");
    expect(footer.outerHTML).not.toMatch(/demo board clock/i);
    expect(footer.outerHTML).not.toContain(DEMONSTRATION_DAY_LABEL);
    expect(footer).toHaveTextContent("Synthetic prototype");
  });
});

describe("3.3 a pack print is recorded only when the person says it printed", () => {
  const seen: { prints: number | null } = { prints: null };
  function Count() {
    const { downtimePackPrints } = useWardFlowSelect("downtimePackPrints");
    useLayoutEffect(() => {
      seen.prints = downtimePackPrints?.length ?? 0;
    });
    return null;
  }
  const renderScreen = () =>
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <Count />
          <DowntimePackScreen />
        </ToastProvider>
      </WardFlowProvider>,
    );

  it("records nothing on Not yet, so a cancelled print keeps the warning", async () => {
    vi.spyOn(window, "print").mockImplementation(() => undefined);
    renderScreen();
    fireEvent.click(await screen.findByTestId("ward-downtime-print"));
    expect(await screen.findByText("Did it print?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Not yet" }));
    await act(async () => undefined);
    expect(seen.prints).toBe(0);
    expect(screen.queryByTestId("ward-downtime-last-printed")).toBeNull();
    expect(screen.getByTestId("ward-downtime-old-packs")).toHaveTextContent("never printed");
  });

  it("asks once when the Print button and the browser's afterprint both fire, and records on Yes", async () => {
    vi.spyOn(window, "print").mockImplementation(() => {
      window.dispatchEvent(new Event("afterprint"));
    });
    renderScreen();
    fireEvent.click(await screen.findByTestId("ward-downtime-print"));
    expect(await screen.findAllByText("Did it print?")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(await screen.findByTestId("ward-downtime-last-printed")).toBeInTheDocument();
    expect(seen.prints).toBeGreaterThan(0);
  });
});

describe("3.5 the ward page's constant observation figure is labelled as staff", () => {
  it("names the figure as staff, matching its spoken label", () => {
    const unit = allUnits()[0]!;
    const { wardBand } = wardHeroTopParts({
      unit,
      states: { ready: 0, occupied: 0 } as BedStateCounts,
      now: NOW_ANCHOR,
      isPhone: false,
      arrivalsToday: 0,
      openArrivals: () => undefined,
      actNowCount: 0,
      heldUpCount: 0,
      pastDateCount: 0,
      bedCountsStale: false,
      staffedSpecialling: 2,
      obsNotRecorded: 0,
      bedFilter: "all",
      pickBedFilter: () => undefined,
      openShiftTodo: () => undefined,
    });
    render(<>{wardBand}</>);
    const band = screen.getByTestId("ward-hero-checking");
    // Wave 4 (D-191): the mock words the cell "Staff on constant obs".
    expect(band).toHaveTextContent("Staff on constant obs");
    expect(band.textContent).not.toMatch(/Constant obs(?! staff)/);
    // The band speaks a cell's ariaLabel only when the cell is pressable, so read the label it is given.
    const cells = (wardBand.props as { cells: { id: string; ariaLabel?: string }[] }).cells;
    expect(cells.find((cell) => cell.id === "obs")?.ariaLabel).toBe("Staff on constant observation: 2");
  });
});
