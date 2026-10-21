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
  markDowntimePackHandled,
} from "@/components/ward-management/reports/downtime-pack";
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
