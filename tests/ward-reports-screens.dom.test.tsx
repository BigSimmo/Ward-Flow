import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
const route = vi.hoisted(() => ({ pathname: "/mockups/ward-flow/statistics/weekly" }));
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: vi.fn() }),
}));

import {
  forgetDowntimePack,
  lastDowntimePack,
  rememberDowntimePack,
  type DowntimePack,
} from "@/components/ward-management/reports/downtime-pack";
import { DowntimePackScreen } from "@/components/ward-management/reports/downtime-pack-screen";
import { PatientChronologyScreen } from "@/components/ward-management/reports/patient-chronology-screen";
import { WeeklyReportScreen } from "@/components/ward-management/reports/weekly-report-screen";
import { OperationalLinks } from "@/components/ward-management/tools/ward-tools-workspace";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const inProvider = (node: ReactNode) => render(<WardFlowProvider initialNow={NOW_ANCHOR}>{node}</WardFlowProvider>);

afterEach(() => {
  forgetDowntimePack();
  route.pathname = "/mockups/ward-flow/statistics/weekly";
});

const OLD_PACK: DowntimePack = {
  generatedAt: -1,
  wards: [],
  totals: {
    beds: 0,
    ready: 0,
    pulled: 0,
    closed: 0,
    occupied: 0,
    beingMadeReady: 0,
    pendingPreparation: 0,
    onLeave: 0,
  },
  edQueue: [],
  pendingMoves: [],
  legalForms: [],
};

describe("read-only report screens", () => {
  it("opens a chronology for the patient named in the link, labelled synthetic", () => {
    inProvider(<PatientChronologyScreen initialPatientId="PT-013" />);
    const page = screen.getByTestId("ward-patient-chronology");
    expect(within(page).getAllByText(/Synthetic demo data/u).length).toBeGreaterThan(0);
    const table = screen.getByTestId("ward-chronology-table");
    expect(within(table).getAllByRole("row").length).toBeGreaterThan(1);
    expect(screen.getByTestId("ward-chronology-csv")).toBeTruthy();
    expect(screen.getByTestId("ward-chronology-print")).toBeTruthy();
  });

  it("asks for a patient before showing any chronology", () => {
    inProvider(<PatientChronologyScreen />);
    expect(screen.queryByTestId("ward-chronology-table")).toBeNull();
    expect(screen.queryByTestId("ward-chronology-csv")).toBeNull();
    fireEvent.change(screen.getByTestId("ward-chronology-patient"), { target: { value: "PT-013" } });
    expect(screen.getByTestId("ward-chronology-table")).toBeTruthy();
  });

  it("renders the weekly report for the last full week by default, with a Weekly tab current", () => {
    inProvider(<WeeklyReportScreen />);
    expect(screen.getByTestId("ward-weekly-range").textContent).toMatch(/^Last full week/u);
    const nav = within(screen.getByRole("navigation", { name: "Ward Flow statistics sections" }));
    expect(nav.getByRole("link", { name: "Weekly" })).toHaveAttribute("aria-current", "page");
    fireEvent.change(screen.getByTestId("ward-weekly-week"), { target: { value: "-1" } });
    expect(screen.getByTestId("ward-weekly-range").textContent).toMatch(/^This week so far/u);
  });

  it("takes a stamped downtime snapshot and keeps it in tab memory", () => {
    inProvider(<DowntimePackScreen />);
    expect(screen.getByTestId("ward-downtime-generated").textContent).toMatch(/^Generated /u);
    expect(screen.getByTestId("ward-downtime-beds")).toBeTruthy();
    expect(lastDowntimePack()?.generatedAt).toBe(NOW_ANCHOR);
  });

  it("reads the coordinator audit only on a coordinator route, and says so elsewhere", () => {
    route.pathname = "/mockups/ward-flow/reports/chronology";
    const { unmount } = inProvider(<PatientChronologyScreen initialPatientId="PT-013" />);
    expect(screen.queryByTestId("ward-chronology-audit-withheld")).toBeNull();
    unmount();

    route.pathname = "/mockups/ward-flow/ward/some-ward";
    inProvider(<PatientChronologyScreen initialPatientId="PT-013" />);
    expect(screen.getByTestId("ward-chronology-audit-withheld").textContent).toBe(
      "Coordinator audit not shown for this role",
    );
    expect(screen.getByText("Records and session log")).toBeTruthy();
  });

  it("takes a fresh pack when the remembered one is forgotten while the screen stays open", () => {
    inProvider(<DowntimePackScreen />);
    const first = lastDowntimePack();
    expect(first).not.toBeNull();
    act(() => forgetDowntimePack());
    expect(lastDowntimePack()).not.toBeNull();
    expect(lastDowntimePack()).not.toBe(first);
    expect(screen.queryByText("Taking snapshot")).toBeNull();
  });

  it("keeps a pack from this world, but not one from another world generation", () => {
    rememberDowntimePack(OLD_PACK);
    const { unmount } = inProvider(<DowntimePackScreen />);
    expect(lastDowntimePack()).toBe(OLD_PACK);
    unmount();

    rememberDowntimePack(OLD_PACK, -1);
    inProvider(<DowntimePackScreen />);
    expect(lastDowntimePack()).not.toBe(OLD_PACK);
  });

  it("takes a fresh pack from the restored day after a changed saved session is restored", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 23, 10, 0));
    window.sessionStorage.clear();
    let world!: ReturnType<typeof useWardFlow>;
    function Probe() {
      const value = useWardFlow();
      useEffect(() => {
        world = value;
      }, [value]);
      return null;
    }
    try {
      const first = render(
        <WardFlowProvider>
          <Probe />
        </WardFlowProvider>,
      );
      const unit = world.units.find((candidate) => candidate.empty.value < candidate.beds)!;
      const seedReady = bedStates(unit, world.admissions, world.bedReleases, world.leaveBeds).ready;
      act(() =>
        world.dispatch({
          type: "CONFIRM_CAPACITY",
          role: "ward",
          now: world.now,
          unitId: unit.id,
          actingUnitId: unit.id,
          expectedRevision: unit.allocatable.revision ?? 0,
          value: unit.empty.value + 1,
        }),
      );
      first.unmount();
      forgetDowntimePack();

      // Reload: the screen first takes a pack from the seed, then the changed day is restored.
      render(
        <WardFlowProvider>
          <Probe />
          <DowntimePackScreen />
        </WardFlowProvider>,
      );
      expect(screen.queryByText("Taking snapshot")).toBeNull();
      const restoredUnit = world.units.find((candidate) => candidate.id === unit.id)!;
      const live = bedStates(restoredUnit, world.admissions, world.bedReleases, world.leaveBeds);
      expect(live.ready).not.toBe(seedReady);
      expect(lastDowntimePack()?.wards.find((ward) => ward.unitId === unit.id)?.counts).toEqual(live);
    } finally {
      cleanup();
      window.sessionStorage.clear();
      vi.useRealTimers();
    }
  });

  it("states how many ready beds are still being made ready", () => {
    rememberDowntimePack({
      ...OLD_PACK,
      wards: [
        {
          unitId: "U1",
          name: "Sample ward",
          service: "Sample service",
          beds: 4,
          counts: { ready: 2, pulled: 0, closed: 0, occupied: 2, beingMadeReady: 1, onLeave: 0 },
          pendingPreparation: 1,
        },
      ],
    });
    inProvider(<DowntimePackScreen />);
    const table = within(screen.getByTestId("ward-downtime-beds"));
    const head = table.getAllByRole("columnheader").map((cell) => cell.textContent);
    expect(head).toEqual(
      expect.arrayContaining(["Ready", "Being made ready", "Occupied", "On leave", "Pulled", "Closed"]),
    );
    expect(head).not.toContain("Held");
    const row = table.getByRole("row", { name: /Sample ward/u });
    const cells = within(row)
      .getAllByRole("cell")
      .map((cell) => cell.textContent);
    // Ward, service, beds, ready, being made ready, ...
    expect(cells.slice(1, 4)).toEqual(["4", "2", "1"]);
  });

  it("is reachable from the Tools drawer's shortcuts", () => {
    render(<OperationalLinks onNavigate={() => {}} />);
    expect(screen.getByRole("link", { name: /Downtime pack/u })).toHaveAttribute(
      "href",
      "/mockups/ward-flow/reports/downtime",
    );
    expect(screen.getByRole("link", { name: /Patient chronology/u })).toHaveAttribute(
      "href",
      "/mockups/ward-flow/reports/chronology",
    );
  });
});
