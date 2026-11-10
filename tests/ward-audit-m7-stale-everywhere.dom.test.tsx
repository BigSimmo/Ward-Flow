/**
 * Master audit M7 (10 Nov 2026): stale data must never look live. When the shared reads freeze
 * (the last good read is older than two refreshes, `2 * SHARED_REFRESH_MS`), every main surface
 * says how old its figures are: Home, the ward board, the TV (prominently, as nobody is watching it)
 * and the printed handover and shift brief (fixed: M7 print, D-125). The freeze is published the same way the shell publishes it
 * (`publishLiveRefresh` from `WardSharedAccess`). Synthetic data only.
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ back: vi.fn(), replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { publishLiveRefresh } from "@/components/wf";
import { clk } from "@/components/wf/format";
import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { WardBoard } from "@/components/ward-management/board/ward-board";
import { BedMeetingTvScreen } from "@/components/ward-management/bed-meeting/bed-meeting-tv";
import { WardDailySheet, WardDailySheetDialog } from "@/components/ward-management/board/ward-daily-sheet";
import { DEFAULT_PRINT_OPTIONS, HandoverPrintSheet } from "@/components/ward-management/handover/handover-print-sheet";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { useWardFlow, WardFlowOverride, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { SHARED_REFRESH_MS } from "@/components/ward-management/ward-operational-defaults";
import { WARD_ADMISSIONS_ANCHOR } from "@/components/ward-management/ward-admissions-seed";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const STALE_LIMIT_MS = 2 * SHARED_REFRESH_MS;
let lastGood = 0;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  vi.setSystemTime(new Date("2026-10-07T10:26:00+08:00"));
  lastGood = Date.now();
});
afterEach(() => {
  cleanup();
  act(() => publishLiveRefresh(undefined));
  vi.useRealTimers();
});

/** Reads froze: the last good read is the shell's, and nothing has answered since. */
function freezeReads(forMs: number) {
  act(() => publishLiveRefresh({ unavailable: false, receivedAt: lastGood, staleAfterMs: STALE_LIMIT_MS }));
  act(() => vi.advanceTimersByTime(forMs));
}

/** The provider as a shared, signed-in workspace whose status is still "ready" (an open, silent connection). */
function SharedReady({ children }: { children: ReactNode }) {
  const value = useWardFlow();
  return (
    <WardFlowOverride
      value={{ ...value, shared: { enabled: true, status: "ready", error: null, receivedAt: lastGood } }}
    >
      {children}
    </WardFlowOverride>
  );
}

const notUpdating = () => new RegExp(`Not updating since ${clk(lastGood)}`, "u");

describe("M7: frozen reads show their age on every main surface", () => {
  it("Home: the hero says Not updating since the last good read, and not before the limit", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CoordinatorScreen />
      </WardFlowProvider>,
    );
    freezeReads(STALE_LIMIT_MS - 500);
    expect(screen.getByTestId("ward-coordinator").textContent).not.toMatch(notUpdating());
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByTestId("ward-coordinator").textContent).toMatch(notUpdating());
  });

  it("Board: the ward board's hero says Not updating since the last good read", () => {
    render(
      <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
        <WardBoard unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );
    freezeReads(STALE_LIMIT_MS - 500);
    expect(document.body.textContent).not.toMatch(notUpdating());
    act(() => vi.advanceTimersByTime(1000));
    expect(document.body.textContent).toMatch(notUpdating());
  });

  it("TV: a silent connection (status still ready) turns the screen to a red not-updating warning", () => {
    act(() => setWardFeatureFlagOnDevice("bed-meeting-tv", true));
    try {
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <SharedReady>
            <BedMeetingTvScreen />
          </SharedReady>
        </WardFlowProvider>,
      );
      freezeReads(STALE_LIMIT_MS - 500);
      expect(screen.queryByTestId("bed-meeting-tv-stale")).toBeNull();
      expect(screen.getByTestId("bed-meeting-tv-as-at")).not.toHaveTextContent(/not updating/u);
      act(() => vi.advanceTimersByTime(1000));
      const warning = screen.getByTestId("bed-meeting-tv-stale");
      // Prominent: the danger level, in the As at line every TV layout shows.
      expect(warning).toHaveAttribute("data-level", "danger");
      expect(warning).toHaveTextContent(/not updating/u);
      expect(screen.getByTestId("bed-meeting-tv-as-at")).toHaveTextContent(/not updating/u);
    } finally {
      act(() => setWardFeatureFlagOnDevice("bed-meeting-tv", null));
    }
  });

  const STALE_WORDS = () => new RegExp(`^Not updating since ${clk(lastGood)}\\. Figures may be out of date\\.$`, "u");

  it("M7 print: every printed handover page's stamp says it is not updating, with the last good read", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
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
      </WardFlowProvider>,
    );
    freezeReads(STALE_LIMIT_MS - 500);
    expect(screen.queryByTestId("handover-print-not-updating")).toBeNull();
    act(() => vi.advanceTimersByTime(1000));
    const pages = screen.getAllByText(/^Page \d+ of \d+/u);
    const lines = screen.getAllByTestId("handover-print-not-updating");
    expect(lines).toHaveLength(pages.length);
    for (const line of lines) expect(line.textContent).toMatch(STALE_WORDS());
  });

  it("M7 print: the shift brief's As at stamp says it is not updating, and the copied brief keeps it", () => {
    render(
      <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
        <WardDailySheetDialog now={WARD_ADMISSIONS_ANCHOR} onClose={() => {}} />
      </WardFlowProvider>,
    );
    freezeReads(STALE_LIMIT_MS - 500);
    expect(screen.queryByTestId("ward-daily-sheet-not-updating")).toBeNull();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByTestId("ward-daily-sheet-dialog-stamp").textContent).toMatch(/^As at /u);
    const lines = screen.getAllByTestId("ward-daily-sheet-not-updating");
    // The dialog's stamp carries it once; the embedded sheet inside does not repeat it.
    expect(lines).toHaveLength(1);
    expect(lines[0]!.textContent).toMatch(STALE_WORDS());
    expect(screen.getByTestId("ward-daily-sheet-dialog-stamp").getAttribute("title")).toMatch(
      new RegExp(`Not updating since ${clk(lastGood)}\\. Figures may be out of date\\.`, "u"),
    );
  });

  it("M7 print: the standalone shift brief (printed with the ward board) says so beside its timestamp", () => {
    render(
      <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
        <WardDailySheet now={WARD_ADMISSIONS_ANCHOR} />
      </WardFlowProvider>,
    );
    freezeReads(STALE_LIMIT_MS - 500);
    expect(screen.queryByTestId("ward-daily-sheet-not-updating")).toBeNull();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByTestId("ward-daily-sheet-not-updating").textContent).toMatch(STALE_WORDS());
  });
});
