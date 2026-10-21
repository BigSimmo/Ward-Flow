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

  it("retakes the pack on the hour and offers it to print or save", () => {
    renderShell();
    const opening = lastDowntimePack();
    act(() => setClock(ELEVEN - 1));
    expect(lastDowntimePack()).toBe(opening);
    act(() => setClock(ELEVEN));
    expect(lastDowntimePack()?.generatedAt).toBe(ELEVEN);
    const line = screen.getByTestId("ward-downtime-pack-line");
    expect(line.textContent).toMatch(/^Downtime pack 11:00 ready\. Print it or save it as a PDF/u);
    expect(line.hasAttribute("data-shift-change")).toBe(false);
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

  it("goes once put aside or printed, and comes back with the next pack", () => {
    renderShell();
    act(() => setClock(ELEVEN));
    fireEvent.click(screen.getByTestId("ward-downtime-pack-dismiss"));
    expect(screen.queryByTestId("ward-downtime-pack-line")).toBeNull();
    act(() => setClock(12 * HOUR));
    expect(screen.getByTestId("ward-downtime-pack-line").textContent).toMatch(/12:00/u);
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
    act(() => setClock(ELEVEN));
    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.queryByTestId("ward-downtime-pack-line")).toBeNull();
    expect(screen.getByTestId("ward-offline-banner").textContent).toMatch(
      /use the downtime pack taken at 11:00, printed or saved as a PDF\.$/u,
    );
  });

  it("writes nothing to browser storage", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    renderShell();
    act(() => setClock(ELEVEN));
    fireEvent.click(screen.getByTestId("ward-downtime-pack-dismiss"));
    const packWrites = setItem.mock.calls.filter(([, value]) => String(value).includes("generatedAt"));
    expect(packWrites).toEqual([]);
  });
});
