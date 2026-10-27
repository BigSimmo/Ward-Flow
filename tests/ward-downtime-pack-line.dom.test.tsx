import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useLayoutEffect, useState, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
const route = vi.hoisted(() => ({ pathname: "/ward-flow" }));
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: vi.fn() }),
}));

import {
  forgetDowntimePack,
  lastDowntimePack,
  lastDowntimeSyncAt,
  markDowntimePackHandled,
  noteDowntimeSync,
  rememberDowntimePack,
  type DowntimePack,
} from "@/components/ward-management/reports/downtime-pack";
import { DowntimePackScreen } from "@/components/ward-management/reports/downtime-pack-screen";
import { WardAccessScope } from "@/components/ward-management/shell/ward-access";
import { resetWardAccessStoreForTests } from "@/components/ward-management/shell/ward-access-store";
import { WardDowntimePackLine } from "@/components/ward-management/shell/ward-downtime-pack-line";
import { WardOfflineBanner } from "@/components/ward-management/shell/ward-offline-banner";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import { WardFlowClockContext, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const HOUR = 60;
/** NOW_ANCHOR is 10:42 on the opening day. */
const ELEVEN = 11 * HOUR;
const SHIFT_CHANGE = 15 * HOUR;

let setClock!: (now: number) => void;
function Clock({ children }: { children: ReactNode }) {
  const [now, setNow] = useState(NOW_ANCHOR);
  useLayoutEffect(() => {
    setClock = setNow;
  }, []);
  return <WardFlowClockContext.Provider value={now}>{children}</WardFlowClockContext.Provider>;
}

function renderShell() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardAccessScope>
        <Clock>
          <WardOfflineBanner />
          <WardDowntimePackLine />
        </Clock>
      </WardAccessScope>
    </WardFlowProvider>,
  );
}

function renderShellWithScreen() {
  route.pathname = "/ward-flow/reports/downtime";
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardAccessScope>
        <Clock>
          <WardDowntimePackLine />
          <DowntimePackScreen />
        </Clock>
      </WardAccessScope>
    </WardFlowProvider>,
  );
}

function setOnline(value: boolean) {
  vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(value);
}

afterEach(() => {
  cleanup();
  forgetDowntimePack();
  resetWardAccessStoreForTests();
  vi.restoreAllMocks();
  route.pathname = "/ward-flow";
});

describe("WardDowntimePackLine (fix plan item 9)", () => {
  it("takes a pack on opening without asking for paper", () => {
    renderShell();
    expect(lastDowntimePack()?.generatedAt).toBe(NOW_ANCHOR);
    expect(screen.queryByTestId("ward-downtime-pack-line")).toBeNull();
  });

  it("retakes the pack on the hour silently, asking for paper only at shift change (Josh, 21 Oct 2026)", () => {
    renderShell();
    const opening = lastDowntimePack();
    act(() => setClock(ELEVEN - 1));
    expect(lastDowntimePack()).toBe(opening);
    act(() => setClock(ELEVEN));
    expect(lastDowntimePack()?.generatedAt).toBe(ELEVEN);
    expect(screen.queryByTestId("ward-downtime-pack-line")).toBeNull();
    act(() => setClock(SHIFT_CHANGE));
    const line = screen.getByTestId("ward-downtime-pack-line");
    expect(line.textContent).toMatch(/^Shift change downtime pack 15:00 ready\. Print it or save it as a PDF/u);
    expect(screen.getByTestId("ward-downtime-pack-open").getAttribute("href")).toBe("/ward-flow/reports/downtime");
  });

  it("builds the scheduled pack from the live board", () => {
    renderShell();
    act(() => setClock(ELEVEN));
    const state = seedWardFlowState();
    const pack = lastDowntimePack()!;
    for (const ward of pack.wards) {
      const unit = state.units.find((candidate) => candidate.id === ward.unitId)!;
      expect(ward.counts).toEqual(bedStates(unit, state.admissions, state.bedReleases, state.leaveBeds));
    }
  });

  it("names the shift change pack as the handover copy", () => {
    renderShell();
    act(() => setClock(SHIFT_CHANGE));
    const line = screen.getByTestId("ward-downtime-pack-line");
    expect(line.textContent).toMatch(/^Shift change downtime pack 15:00 ready\./u);
    expect(line.getAttribute("data-shift-change")).toBe("true");
  });

  it("still names the handover copy when the retake runs late after the shift change", () => {
    renderShell();
    act(() => setClock(14 * HOUR + 59));
    act(() => setClock(SHIFT_CHANGE + 2));
    expect(lastDowntimePack()?.shiftChangeAt).toBe(SHIFT_CHANGE);
    expect(screen.getByTestId("ward-downtime-pack-line").textContent).toMatch(
      /^Shift change downtime pack 15:02 ready\./u,
    );
  });

  it("takes no pack while offline, then takes the one due as the connection returns", () => {
    renderShell();
    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
    });
    act(() => setClock(ELEVEN));
    expect(lastDowntimePack()?.generatedAt).toBe(NOW_ANCHOR);
    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event("online"));
    });
    expect(lastDowntimePack()?.generatedAt).toBe(ELEVEN);
  });

  it("keeps asking with the fresher hourly pack while the shift change pack is not handled", () => {
    renderShell();
    act(() => setClock(SHIFT_CHANGE));
    act(() => setClock(16 * HOUR));
    expect(lastDowntimePack()?.generatedAt).toBe(16 * HOUR);
    expect(screen.getByTestId("ward-downtime-pack-line").textContent).toMatch(
      /^Shift change downtime pack 16:00 ready\./u,
    );
    fireEvent.click(screen.getByTestId("ward-downtime-pack-dismiss"));
    act(() => setClock(17 * HOUR));
    expect(lastDowntimePack()?.generatedAt).toBe(17 * HOUR);
    expect(screen.queryByTestId("ward-downtime-pack-line")).toBeNull();
  });

  it("carries nothing over when the clock moves back before an unhandled shift change pack", () => {
    renderShell();
    act(() => setClock(SHIFT_CHANGE));
    expect(screen.getByTestId("ward-downtime-pack-line")).toBeTruthy();
    act(() => setClock(14 * HOUR));
    expect(lastDowntimePack()?.generatedAt).toBe(14 * HOUR);
    expect(lastDowntimePack()?.shiftChangeAt).toBeUndefined();
    expect(screen.queryByTestId("ward-downtime-pack-line")).toBeNull();
  });

  it("goes once put aside or printed, and comes back with the next shift change pack", () => {
    renderShell();
    act(() => setClock(SHIFT_CHANGE));
    fireEvent.click(screen.getByTestId("ward-downtime-pack-dismiss"));
    expect(screen.queryByTestId("ward-downtime-pack-line")).toBeNull();
    act(() => setClock(16 * HOUR));
    expect(screen.queryByTestId("ward-downtime-pack-line")).toBeNull();
    act(() => setClock(23 * HOUR));
    expect(screen.getByTestId("ward-downtime-pack-line").textContent).toMatch(/23:00/u);
    act(() => markDowntimePackHandled(lastDowntimePack()!));
    expect(screen.queryByTestId("ward-downtime-pack-line")).toBeNull();
  });

  it("stays off the pack's own screen, which still follows the schedule", () => {
    route.pathname = "/ward-flow/reports/downtime";
    renderShell();
    act(() => setClock(ELEVEN));
    expect(lastDowntimePack()?.generatedAt).toBe(ELEVEN);
    expect(screen.queryByTestId("ward-downtime-pack-line")).toBeNull();
  });

  it("offline, hides the line and the offline notice names the last pack", () => {
    renderShell();
    act(() => setClock(SHIFT_CHANGE));
    expect(screen.getByTestId("ward-downtime-pack-line")).toBeTruthy();
    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.queryByTestId("ward-downtime-pack-line")).toBeNull();
    expect(screen.getByTestId("ward-offline-banner").textContent).toMatch(
      /use the downtime pack taken at 15:00, printed or saved as a PDF\.$/u,
    );
  });

  // Owner, 22 Oct 2026: allow it offline, labelled "taken offline" with the last sync time. Codex on
  // #551: forgetting the pack (session end, restore) also forgets the sync, which described the old records.
  it("offline with no pack, takes one labelled taken offline, with no sync recorded for replaced records", () => {
    renderShellWithScreen();
    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
    });
    act(() => setClock(ELEVEN));
    act(() => forgetDowntimePack());
    const pack = lastDowntimePack();
    expect(pack?.offline).toEqual({ lastSyncAt: null });
    const frozen = screen.getByTestId("ward-downtime-frozen").textContent ?? "";
    // The hero chip is kept short (visual desk, 22 Oct 2026); the taken line below says "Taken offline".
    expect(frozen).toMatch(/Offline · last updated not recorded/u);
    expect(frozen).not.toMatch(/11:00/u);
    expect(screen.getByTestId("ward-downtime-generated").textContent).toMatch(
      /^Taken offline · last updated not recorded · next pack when the connection returns$/u,
    );
    expect(screen.getByTestId("ward-downtime-stale").textContent).toMatch(/Stale · no update recorded/u);
    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event("online"));
    });
    expect(lastDowntimePack()?.offline).toBeUndefined();
    expect(lastDowntimePack()?.generatedAt).toBe(ELEVEN);
  });

  it("keeps the last sync only for its own world, never a future one, and forgets it with the session", () => {
    noteDowntimeSync(NOW_ANCHOR, 1);
    expect(lastDowntimeSyncAt(1, ELEVEN)).toBe(NOW_ANCHOR);
    // A reset or scenario switch starts a new world generation.
    expect(lastDowntimeSyncAt(2, ELEVEN)).toBeNull();
    // A clock reset puts the old sync in the future.
    expect(lastDowntimeSyncAt(1, NOW_ANCHOR - HOUR)).toBeNull();
    // An exiting screen boundary keeps it; a session end or restore does not.
    forgetDowntimePack({} as Parameters<typeof forgetDowntimePack>[0]);
    expect(lastDowntimeSyncAt(1, ELEVEN)).toBe(NOW_ANCHOR);
    forgetDowntimePack();
    expect(lastDowntimeSyncAt(1, ELEVEN)).toBeNull();
  });

  it("keeps a pack taken online: an offline pack never replaces it", () => {
    const base = { generatedAt: 0, wards: [], edQueue: [], pendingMoves: [], legalForms: [], leftEd: 0 };
    const totals = {
      beds: 0,
      ready: 0,
      pulled: 0,
      closed: 0,
      occupied: 0,
      beingMadeReady: 0,
      pendingPreparation: 0,
      onLeave: 0,
    };
    const online = { ...base, totals } as DowntimePack;
    const offline = { ...base, totals, generatedAt: 60, offline: { lastSyncAt: 0 } } as DowntimePack;
    const laterOffline = { ...offline, generatedAt: 120 };
    rememberDowntimePack(offline);
    expect(lastDowntimePack()).toBe(offline);
    rememberDowntimePack(laterOffline);
    expect(lastDowntimePack()).toBe(laterOffline);
    rememberDowntimePack(online);
    expect(lastDowntimePack()).toBe(online);
    rememberDowntimePack(offline);
    expect(lastDowntimePack()).toBe(online);
  });

  it("offline, the screen keeps the pack taken online", () => {
    renderShellWithScreen();
    const taken = lastDowntimePack();
    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
    });
    act(() => setClock(ELEVEN));
    expect(lastDowntimePack()).toBe(taken);
    expect(taken?.offline).toBeUndefined();
  });

  it("writes nothing to browser storage", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    renderShell();
    act(() => setClock(SHIFT_CHANGE));
    fireEvent.click(screen.getByTestId("ward-downtime-pack-dismiss"));
    const packWrites = setItem.mock.calls.filter(([, value]) => String(value).includes("generatedAt"));
    expect(packWrites).toEqual([]);
  });

  /**
   * Local visual check, 21 Oct 2026: the pinned banner holder shrank to 0px in the fixed-height page
   * column, so the line covered the top of Home (390px and 1280px). It now keeps its height and
   * pushes the page down (measured in Chromium after the fix).
   */
  it("sits in a banner holder that keeps its height, so the line pushes the page down", () => {
    const css = readFileSync(resolve(process.cwd(), "src/app/ward-flow/ward-flow-layout.module.css"), "utf8");
    const start = css.indexOf("\n.bannerHolder {");
    expect(start).toBeGreaterThan(-1);
    expect(css.slice(start, css.indexOf("}", start))).toContain("flex-shrink: 0");
  });
});
