/**
 * Review fixes on M123 (the local settings line) and M7 (the "Not updating since" stamp), 10 Nov 2026:
 * the line reaches signed-in executives, follows a paused weekly report's held figures and prints on
 * the isolated handover and shift brief sheets; going offline keeps the stale stamp. Synthetic data only.
 */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/statistics/weekly",
  useRouter: () => ({ back: vi.fn(), replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { publishLiveRefresh, ToastProvider } from "@/components/wf";
import { clk } from "@/components/wf/format";
import { WeeklyReportScreen } from "@/components/ward-management/reports/weekly-report-screen";
import { LocalSettingsNote } from "@/components/ward-management/shell/local-settings-note";
import { WardDailySheetDialog } from "@/components/ward-management/board/ward-daily-sheet";
import { DEFAULT_PRINT_OPTIONS, HandoverPrintSheet } from "@/components/ward-management/handover/handover-print-sheet";
import { ExecutiveStatisticsProvider } from "@/components/ward-management/statistics/executive-statistics-context";
import { projectExecutiveReportingFoundation } from "@/components/ward-management/statistics/executive-statistics-projector";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { WARD_ADMISSIONS_ANCHOR } from "@/components/ward-management/ward-admissions-seed";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const LINE = /^Local settings in use: Pull time limit /u;

function ChangeHold() {
  const { dispatch, configuration, now } = useWardFlow();
  return (
    <button
      type="button"
      onClick={() =>
        dispatch({
          type: "SET_CONFIGURATION",
          role: "coordinator",
          now,
          payload: { ...configuration, pullHoldMinutes: configuration.pullHoldMinutes - 15 },
        })
      }
    >
      Change
    </button>
  );
}
const change = () => act(() => fireEvent.click(screen.getByRole("button", { name: "Change" })));
/** Stands in for the shell's print footer, which sits outside the page. */
const footer = () => screen.queryByTestId("footer-local-settings");

function Handover() {
  return (
    <HandoverPrintSheet
      groups={[]}
      columns={[]}
      ctx={{ now: NOW_ANCHOR, cutoff: NOW_ANCHOR, readyBeds: () => 0 }}
      wards={[]}
      held={[]}
      outsideAct={[]}
      isHighlighted={() => false}
      anyHighlight={false}
      scopeLabel="Whole network"
      shiftLabel="Day"
      densityLabel="Standard"
      sheetDate="Friday"
      options={DEFAULT_PRINT_OPTIONS}
      onOptionsChange={() => {}}
      controls={null}
      highlightControls={null}
      onOpenPatient={() => {}}
      onBack={() => {}}
      onPrintPrepared={() => {}}
      preparedAt={null}
      now={NOW_ANCHOR}
    />
  );
}

afterEach(() => {
  cleanup();
  act(() => publishLiveRefresh(undefined));
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});

describe("M123 review fixes", () => {
  it("a signed-in executive (no operational provider) sees the line from the report's public settings", () => {
    const state = seedWardFlowState();
    const data = projectExecutiveReportingFoundation(
      state,
      { role: "executive", scope: { kind: "statewide" } },
      {
        now: NOW_ANCHOR,
        dayZero: "2026-09-22T16:00:00.000Z",
        startedAt: "2026-10-23T02:42:00.000Z",
        places: wardPlaceLookup(state.units),
      },
    );
    data.publicConfiguration = {
      ...data.publicConfiguration,
      pullHoldMinutes: data.publicConfiguration.pullHoldMinutes - 15,
    };
    const binding = { actorId: "synthetic-report-reader", accessContext: "a".repeat(64), epoch: 1, revision: 1 };
    render(
      <ExecutiveStatisticsProvider
        binding={binding}
        snapshot={{ binding, receivedAt: 100, expiresAt: 200, data }}
        now={150}
        controls={{ executive: true, paused: false, togglePause: null }}
      >
        <WeeklyReportScreen />
        <LocalSettingsNote as="span" testId="footer-local-settings" />
      </ExecutiveStatisticsProvider>,
    );
    expect(screen.getByTestId("ward-weekly-local-settings").textContent).toMatch(LINE);
    expect(footer()?.textContent).toMatch(LINE);
  });

  it("a paused weekly report and its print footer keep the settings held with its figures", () => {
    render(
      <ToastProvider>
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <WeeklyReportScreen />
          <LocalSettingsNote as="span" testId="footer-local-settings" />
          <ChangeHold />
        </WardFlowProvider>
      </ToastProvider>,
    );
    fireEvent.click(screen.getAllByRole("button", { name: /pause demo updates/u })[0]!);
    change();
    expect(screen.queryByTestId("ward-weekly-local-settings")).toBeNull();
    expect(footer()).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: /resume|pause demo updates/iu })[0]!);
    expect(screen.getByTestId("ward-weekly-local-settings").textContent).toMatch(LINE);
    expect(footer()?.textContent).toMatch(LINE);
  });

  it("every isolated handover page carries the line inside the print stack", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Handover />
        <ChangeHold />
      </WardFlowProvider>,
    );
    change();
    const stack = document.querySelector<HTMLElement>("[data-wf-print-stack]")!;
    const pages = within(stack).getAllByText(/^Page \d+ of \d+/u);
    const lines = within(stack).getAllByTestId("handover-print-local-settings");
    expect(lines).toHaveLength(pages.length);
    for (const line of lines) expect(line.textContent).toMatch(LINE);
  });

  it("the shift brief dialog, printed alone, carries the line inside the dialog", () => {
    render(
      <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
        <ChangeHold />
        <WardDailySheetDialog now={WARD_ADMISSIONS_ANCHOR} onClose={() => {}} />
      </WardFlowProvider>,
    );
    change();
    const dialog = screen.getByTestId("ward-daily-sheet-modal");
    expect(within(dialog).getByTestId("ward-daily-sheet-local-settings").textContent).toMatch(LINE);
  });
});

describe("M7 review fix: offline keeps the stale stamp", () => {
  function goOffline(lastGood: number) {
    act(() => publishLiveRefresh({ unavailable: false, receivedAt: lastGood, staleAfterMs: 60_000 }));
    act(() => {
      Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
      window.dispatchEvent(new Event("offline"));
    });
  }
  const words = (lastGood: number) => `Not updating since ${clk(lastGood)}. Figures may be out of date.`;

  it("the printed handover still says Not updating since the last good read", () => {
    const lastGood = Date.now();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Handover />
      </WardFlowProvider>,
    );
    goOffline(lastGood);
    const lines = screen.getAllByTestId("handover-print-not-updating");
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line.textContent).toBe(words(lastGood));
  });

  it("the shift brief and its copied stamp still say Not updating since the last good read", () => {
    const lastGood = Date.now();
    render(
      <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
        <WardDailySheetDialog now={WARD_ADMISSIONS_ANCHOR} onClose={() => {}} />
      </WardFlowProvider>,
    );
    goOffline(lastGood);
    expect(screen.getByTestId("ward-daily-sheet-not-updating").textContent).toBe(words(lastGood));
    expect(screen.getByTestId("ward-daily-sheet-dialog-stamp").getAttribute("title")).toContain(words(lastGood));
  });
});
