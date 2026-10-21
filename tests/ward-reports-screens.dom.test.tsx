import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { StrictMode, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
const route = vi.hoisted(() => ({ pathname: "/ward-flow/statistics/weekly" }));
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
import { DowntimePackBoundary, useDowntimePackOwner } from "@/components/ward-management/reports/downtime-pack-context";
import { useTakeDowntimePack } from "@/components/ward-management/reports/use-take-downtime-pack";
import { PatientChronologyScreen } from "@/components/ward-management/reports/patient-chronology-screen";
import { WeeklyReportScreen } from "@/components/ward-management/reports/weekly-report-screen";
import { ToastProvider } from "@/components/wf";
import { WardToolsSheet } from "@/components/ward-management/tools/ward-tools-sheet";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardSharedAccess, type WardSharedConnection } from "@/components/ward-management/ward-shared-access";
import { WardAccessScope } from "@/components/ward-management/shell/ward-access";
import { setWardAccess, resetWardAccessStoreForTests } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";

// The ward layout wraps every route in the shared wf ToastProvider; the screens rely on it.
function InitialPack({ pack, generation = null }: { pack: DowntimePack; generation?: number | null }) {
  const owner = useDowntimePackOwner();
  useLayoutEffect(() => rememberDowntimePack(pack, generation, owner), [pack, generation, owner]);
  return null;
}

const inProvider = (node: ReactNode, remembered?: { pack: DowntimePack; generation?: number }) =>
  render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        {remembered && <InitialPack {...remembered} />}
        {node}
      </WardFlowProvider>
    </ToastProvider>,
  );

afterEach(() => {
  cleanup();
  forgetDowntimePack();
  resetWardAccessStoreForTests();
  setWardFeatureFlagOnDevice("role-access", null);
  route.pathname = "/ward-flow/statistics/weekly";
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
  leftEd: 0,
};

describe("read-only report screens", () => {
  it("invalidates through the real shared session boundary on account, membership and sign-out changes", () => {
    const state = seedWardFlowState();
    const base: WardSharedConnection = {
      enabled: true,
      signedIn: true,
      status: "ready",
      error: null,
      receivedAt: 0,
      actorId: "ACCOUNT-A",
      workingAs: "MEMBERSHIP-A",
      access: { role: "coordinator", scope: { kind: "statewide" } },
      snapshot: {
        dataMode: "prototype",
        revision: 1,
        now: NOW_ANCHOR,
        accessContext: "a".repeat(64),
        payload: { version: 1, state, dayZero: "2026-10-18T00:00:00Z", startedAt: "2026-10-18T10:00:00Z" },
      },
      dispatch: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
      retry: vi.fn(),
      pushApi: { pushKey: vi.fn(), pushStatus: vi.fn(), pushSubscribe: vi.fn(), pushUnsubscribe: vi.fn() },
    };
    let update!: (patch: Partial<WardSharedConnection>) => void;
    function Harness() {
      const [connection, setConnection] = useState(base);
      useLayoutEffect(() => {
        update = (patch) => setConnection((old) => ({ ...old, ...patch }));
      }, []);
      return (
        <WardSharedAccess connection={connection}>
          <DowntimePackScreen />
        </WardSharedAccess>
      );
    }
    inProvider(<Harness />);
    const first = lastDowntimePack();
    expect(first).not.toBeNull();
    act(() => update({ actorId: "ACCOUNT-B" }));
    const second = lastDowntimePack();
    expect(second).not.toBe(first);
    expect(second).not.toBeNull();
    act(() => update({ workingAs: "MEMBERSHIP-B" }));
    const third = lastDowntimePack();
    expect(third).not.toBe(second);
    expect(third).not.toBeNull();
    act(() => update({ signedIn: false, snapshot: null }));
    expect(lastDowntimePack()).toBeNull();
    expect(screen.queryByTestId("ward-downtime-print")).toBeNull();
    act(() => update({ signedIn: true, snapshot: base.snapshot }));
    expect(lastDowntimePack()).not.toBe(third);
    expect(lastDowntimePack()).not.toBeNull();
  });

  it("retakes from the real narrowed desk and clears print rows from outside its scope", () => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess({ role: "coordinator", scope: { kind: "statewide" } });
    const state = seedWardFlowState();
    const siteCode = state.units[0].siteCode;
    inProvider(
      <WardAccessScope>
        <DowntimePackScreen />
      </WardAccessScope>,
    );
    const first = lastDowntimePack()!;
    act(() => setWardAccess({ role: "bed_manager", scope: { kind: "site", siteCode } }));
    const narrowed = lastDowntimePack()!;
    expect(narrowed).not.toBe(first);
    expect(narrowed.edQueue.length).toBeLessThan(first.edQueue.length);
    expect(screen.queryAllByTestId("ward-downtime-ed")).toHaveLength(1);
    expect(screen.getByTestId("ward-downtime-ed").textContent).not.toContain(
      first.edQueue.find((line) => !narrowed.edQueue.some((kept) => kept.movementId === line.movementId))!.person,
    );
  });

  it("takes a usable pack when strict effects remount the access boundary", () => {
    inProvider(
      <StrictMode>
        <DowntimePackBoundary identity="strict">
          <DowntimePackScreen />
        </DowntimePackBoundary>
      </StrictMode>,
    );
    expect(lastDowntimePack()).not.toBeNull();
    expect(screen.queryByText("Taking snapshot")).toBeNull();
  });
  it("preserves a frozen pack across navigation but replaces it after an offscreen access transition", () => {
    let change!: (identity: string) => void;
    let navigate!: (visible: boolean) => void;
    function Harness() {
      const [identity, setIdentity] = useState("account-A:statewide");
      const [visible, setVisible] = useState(true);
      useLayoutEffect(() => {
        change = setIdentity;
        navigate = setVisible;
      }, []);
      return <DowntimePackBoundary identity={identity}>{visible ? <DowntimePackScreen /> : null}</DowntimePackBoundary>;
    }
    inProvider(<Harness />);
    const first = lastDowntimePack();
    expect(first).not.toBeNull();
    act(() => navigate(false));
    act(() => navigate(true));
    expect(lastDowntimePack()).toBe(first);
    act(() => navigate(false));
    act(() => change("account-A:service"));
    expect(lastDowntimePack()).toBeNull();
    act(() => change("account-A:statewide"));
    act(() => navigate(true));
    expect(lastDowntimePack()).not.toBe(first);
    expect(lastDowntimePack()).not.toBeNull();
  });

  it("drops snapshot timers from the previous access context before print", () => {
    vi.useFakeTimers();
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    let change!: (identity: string) => void;
    function Harness() {
      const [identity, setIdentity] = useState("account-A");
      useLayoutEffect(() => {
        change = setIdentity;
      }, []);
      return (
        <DowntimePackBoundary identity={identity}>
          <DowntimePackScreen />
        </DowntimePackBoundary>
      );
    }
    try {
      inProvider(<Harness />);
      fireEvent.click(screen.getByTestId("ward-downtime-refresh"));
      act(() => change("account-B"));
      const current = lastDowntimePack();
      act(() => vi.advanceTimersByTime(500));
      expect(lastDowntimePack()).toBe(current);
      expect(screen.queryByText("Taking snapshot")).toBeNull();
      fireEvent.click(screen.getByTestId("ward-downtime-print"));
      expect(print).toHaveBeenCalledTimes(1);
    } finally {
      print.mockRestore();
      vi.useRealTimers();
    }
  });

  it("closes a phone patient detail sheet when access changes", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === "(max-width: 48rem)",
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    let change!: (identity: string) => void;
    function Harness() {
      const [identity, setIdentity] = useState("scope-A");
      useLayoutEffect(() => {
        change = setIdentity;
      }, []);
      return (
        <DowntimePackBoundary identity={identity}>
          <DowntimePackScreen />
        </DowntimePackBoundary>
      );
    }
    try {
      inProvider(<Harness />);
      fireEvent.click(screen.getByRole("radio", { name: /^ED/u }));
      const person = lastDowntimePack()!.edQueue[0].person;
      const row = screen.getAllByRole("button").find((button) => button.textContent?.includes(person))!;
      expect(row).toBeDefined();
      fireEvent.click(row);
      expect(screen.getByRole("dialog", { name: person })).toBeTruthy();
      act(() => change("scope-B"));
      expect(screen.queryByRole("dialog")).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("opens a chronology for the patient named in the link, labelled synthetic", () => {
    inProvider(<PatientChronologyScreen initialPatientId="PT-013" />);
    const page = screen.getByTestId("ward-patient-chronology");
    expect(within(page).getAllByText(/Synthetic demo data/u).length).toBeGreaterThan(0);
    const table = screen.getByTestId("ward-chronology-table");
    expect(within(table).getAllByRole("row").length).toBeGreaterThan(1);
    expect(screen.getByTestId("ward-chronology-csv")).toBeTruthy();
    expect(screen.getByTestId("ward-chronology-print")).toBeTruthy();
  });

  it("confirms Copy row in the shared wf toast, and says so when the copy fails", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    try {
      inProvider(<PatientChronologyScreen initialPatientId="PT-013" />);
      const table = screen.getByTestId("ward-chronology-table");
      fireEvent.click(within(table).getAllByRole("button", { expanded: false })[0]);
      fireEvent.click(screen.getByRole("button", { name: "Copy row" }));
      await act(async () => undefined);
      expect(writeText).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("toast-region")).toHaveTextContent("Row copied");

      writeText.mockRejectedValueOnce(new Error("blocked"));
      fireEvent.click(screen.getByRole("button", { name: "Copy row" }));
      await act(async () => undefined);
      expect(screen.getByTestId("toast-region")).toHaveTextContent("Could not copy the row");
    } finally {
      Reflect.deleteProperty(navigator, "clipboard");
    }
  });

  it("on a phone keeps record kind and the role view one tap away, in a sheet", () => {
    route.pathname = "/ward-flow/reports/chronology";
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === "(max-width: 48rem)",
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    try {
      inProvider(<PatientChronologyScreen initialPatientId="PT-013" />);
      // Ops-19: the hero repeats no count the source tabs already carry.
      expect(screen.queryByText("From records")).toBeNull();
      const filters = screen.getByTestId("ward-chronology-phone-filters");
      expect(filters).toHaveTextContent("Every record kind · Bed coordinator");
      fireEvent.click(within(filters).getByRole("button"));
      const sheet = screen.getByRole("dialog", { name: "Record kind and view" });
      expect(within(sheet).getByRole("radiogroup", { name: "View as" })).toBeTruthy();
      fireEvent.click(within(sheet).getByRole("radio", { name: "Ward nurse" }));
      fireEvent.click(within(sheet).getByRole("button", { name: "Done" }));
      expect(screen.getByTestId("ward-chronology-phone-filters")).toHaveTextContent("Ward nurse");
      expect(screen.getByTestId("ward-chronology-nurse-view")).toBeTruthy();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  // Renders every synthetic patient's chronology in turn; slower CI runners need the headroom.
  it("lists patients Family, Given in family-name order, and groups each board day once (ops-24, ops-18)", () => {
    route.pathname = "/ward-flow/reports/chronology";
    inProvider(<PatientChronologyScreen />);
    const picker = screen.getByTestId("ward-chronology-patient") as HTMLSelectElement;
    const options = [...picker.options].filter((option) => option.value !== "");
    expect(options.length).toBeGreaterThan(1);
    const names = options.map((option) => option.textContent!.split(" · ")[0]!);
    for (const name of names) expect(name).toMatch(/^[^,]+, [^,]+$/u);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    // Every day heading appears once per patient, whatever the device's time zone.
    let headings = 0;
    for (const option of options) {
      fireEvent.change(picker, { target: { value: option.value } });
      // A plain selector, not *ByRole: role queries over every patient's table took minutes in CI.
      const days = Array.from(document.querySelectorAll('[scope="rowgroup"]')).map(
        (cell) => cell.firstElementChild?.firstChild?.textContent ?? "",
      );
      expect(new Set(days).size, `${option.value}: ${days.join(" | ")}`).toBe(days.length);
      headings += days.length;
    }
    expect(headings).toBeGreaterThan(options.length);
  }, 90_000);

  it("asks for a patient before showing any chronology", () => {
    inProvider(<PatientChronologyScreen />);
    expect(screen.queryByTestId("ward-chronology-table")).toBeNull();
    expect(screen.queryByTestId("ward-chronology-csv")).toBeNull();
    fireEvent.change(screen.getByTestId("ward-chronology-patient"), { target: { value: "PT-013" } });
    expect(screen.getByTestId("ward-chronology-table")).toBeTruthy();
  });

  it("renders the weekly report for the last full week by default, with a Weekly tab current", () => {
    inProvider(<WeeklyReportScreen />);
    expect(screen.getByTestId("ward-weekly-range").textContent).toMatch(/^Week: Last full week/u);
    const nav = within(screen.getByRole("navigation", { name: "Ward Flow statistics sections" }));
    expect(nav.getByRole("link", { name: "Weekly" })).toHaveAttribute("aria-current", "page");
    fireEvent.change(screen.getByTestId("ward-weekly-week"), { target: { value: "-1" } });
    expect(screen.getByTestId("ward-weekly-range").textContent).toMatch(/^Week: This week so far/u);
  });

  it("takes a stamped downtime snapshot and keeps it in tab memory", () => {
    inProvider(<DowntimePackScreen />);
    expect(screen.getByTestId("ward-downtime-generated").textContent).toMatch(/^Taken .* · next pack 11:00$/u);
    expect(screen.getByTestId("ward-downtime-beds")).toBeTruthy();
    expect(lastDowntimePack()?.generatedAt).toBe(NOW_ANCHOR);
  });

  it("on a phone prints all four full tables, whichever section is open", () => {
    route.pathname = "/ward-flow/reports/downtime";
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === "(max-width: 48rem)",
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    try {
      inProvider(<DowntimePackScreen />);
      // Ops-20: the counts sit once, in the section control, never repeated as hero figures.
      expect(screen.queryByText("Still in ED")).toBeNull();
      expect(screen.getByRole("radiogroup", { name: "Downtime pack section" })).toBeTruthy();
      const printPack = within(screen.getByTestId("ward-downtime-print-pack"));
      const pack = lastDowntimePack();
      expect(pack).not.toBeNull();
      expect(printPack.getByTestId("ward-downtime-beds")).toBeTruthy();
      // F-08: the printout carries the synthetic notice, so paper is never read as real records.
      expect(printPack.getByTestId("ward-downtime-print-notice").textContent).toMatch(/invented records/u);
      const ed = printPack.getByTestId("ward-downtime-ed");
      expect(within(ed).getAllByRole("row")).toHaveLength(pack!.edQueue.length + 1);
      expect(within(ed).getByRole("columnheader", { name: "Legal status" })).toBeTruthy();
      expect(within(printPack.getByTestId("ward-downtime-moves")).getAllByRole("row")).toHaveLength(
        pack!.pendingMoves.length + 1,
      );
      expect(within(printPack.getByTestId("ward-downtime-legal")).getAllByRole("row")).toHaveLength(
        pack!.legalForms.length + 1,
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("reads the coordinator audit only on a coordinator route, and says so elsewhere", () => {
    route.pathname = "/ward-flow/reports/chronology";
    const { unmount } = inProvider(<PatientChronologyScreen initialPatientId="PT-013" />);
    expect(screen.queryByTestId("ward-chronology-audit-withheld")).toBeNull();
    unmount();

    route.pathname = "/ward-flow/ward/some-ward";
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
    const { unmount } = inProvider(<DowntimePackScreen />, { pack: OLD_PACK });
    expect(lastDowntimePack()).toBe(OLD_PACK);
    unmount();

    inProvider(<DowntimePackScreen />, { pack: OLD_PACK, generation: -1 });
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
    const remembered: DowntimePack = {
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
    };
    inProvider(<DowntimePackScreen />, { pack: remembered });
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
    // Beds, ready, being made ready, ... (the ward is the row header; the Service column was dropped
    // because it repeated the group head, device audit 11 Oct 2026).
    expect(cells.slice(0, 3)).toEqual(["4", "2", "1"]);
  });

  it("groups beds by service with subtotals that add up to the hero's ready count", () => {
    inProvider(<DowntimePackScreen />);
    const pack = lastDowntimePack()!;
    const subtotals = screen.getAllByTestId("ward-downtime-subtotal");
    expect(subtotals.length).toBe(new Set(pack.wards.map((ward) => ward.service)).size);
    const readySum = subtotals.reduce((sum, row) => sum + Number(within(row).getAllByRole("cell")[1].textContent), 0);
    expect(readySum).toBe(pack.totals.ready);
    expect(screen.getByTestId("ward-downtime-total-ready").textContent).toBe(String(pack.totals.ready));
    expect(screen.getByTestId("ward-downtime-frozen").textContent).toMatch(/^Frozen \d\d:\d\d$/u);
  });

  it("shows a delta twin on each hero figure after a new snapshot", () => {
    vi.useFakeTimers();
    try {
      inProvider(<DowntimePackScreen />);
      expect(screen.queryByText(/since the last pack/u)).toBeNull();
      fireEvent.click(screen.getByTestId("ward-downtime-refresh"));
      expect(screen.getByTestId("ward-downtime-refresh").textContent).toContain("Taking snapshot");
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getAllByText(/since the last pack/u)).toHaveLength(4);
    } finally {
      vi.useRealTimers();
    }
  });

  it("drops the delta twins when the hourly schedule replaces the pack New snapshot took", () => {
    vi.useFakeTimers();
    let retake!: () => void;
    function ScheduledRetake() {
      const take = useTakeDowntimePack();
      useLayoutEffect(() => {
        retake = take;
      }, [take]);
      return null;
    }
    try {
      inProvider(
        <>
          <ScheduledRetake />
          <DowntimePackScreen />
        </>,
      );
      fireEvent.click(screen.getByTestId("ward-downtime-refresh"));
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getAllByText(/since the last pack/u)).toHaveLength(4);
      act(() => retake());
      expect(screen.queryByText(/since the last pack/u)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("filters the chronology by source and keeps the count line equal to the rows shown", () => {
    route.pathname = "/ward-flow/reports/chronology";
    inProvider(<PatientChronologyScreen initialPatientId="PT-013" />);
    const bodyRows = () =>
      within(screen.getByTestId("ward-chronology-table"))
        .getAllByRole("row")
        .filter((row) => within(row).queryAllByRole("button").length > 0);
    const all = bodyRows().length;
    fireEvent.click(screen.getByRole("radio", { name: "Records" }));
    const records = bodyRows().length;
    expect(records).toBeLessThanOrEqual(all);
    expect(screen.getByTestId("ward-chronology-count").textContent).toBe(`${records} of ${all} shown`);
  });

  it("opens a clicked event in the side panel and narrows the sources for the ward nurse view", () => {
    route.pathname = "/ward-flow/reports/chronology";
    inProvider(<PatientChronologyScreen initialPatientId="PT-013" />);
    const table = within(screen.getByTestId("ward-chronology-table"));
    fireEvent.click(table.getAllByRole("button")[0]);
    expect(screen.getByRole("button", { name: "Copy row" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next" })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Ward nurse" }));
    expect(screen.getByTestId("ward-chronology-nurse-view")).toBeTruthy();
    expect(screen.queryByRole("radio", { name: "Audit" })).toBeNull();
  });

  it("offers Clear filters when nothing matches", () => {
    route.pathname = "/ward-flow/reports/chronology";
    inProvider(<PatientChronologyScreen initialPatientId="PT-013" />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Find in events" }), {
      target: { value: "zzzz no such words" },
    });
    expect(screen.queryByTestId("ward-chronology-table")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByTestId("ward-chronology-table")).toBeTruthy();
  });

  it("is reachable from the Tools sheet's Print and share group", () => {
    inProvider(
      <WardToolsSheet isPhone={false} roleLabel="Bed coordinator" onNavigate={() => {}} onNewReferral={() => {}} />,
    );
    expect(screen.getByRole("link", { name: /Downtime pack/u })).toHaveAttribute("href", "/ward-flow/reports/downtime");
    expect(screen.getByRole("link", { name: /Patient chronology/u })).toHaveAttribute(
      "href",
      "/ward-flow/reports/chronology",
    );
  });
});
