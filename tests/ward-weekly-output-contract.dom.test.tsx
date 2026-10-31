import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/statistics/weekly",
  useRouter: () => ({ push: vi.fn() }),
}));

import { ToastProvider } from "@/components/wf";
import { WeeklyReportScreen } from "@/components/ward-management/reports/weekly-report-screen";
import { perthMidnight } from "@/components/ward-management/ward-clock";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { installMatchMediaStub } from "./setup/jsdom.setup";

afterEach(() => {
  cleanup();
  installMatchMediaStub(false);
});

function report() {
  return render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR} initialDayZero={perthMidnight(2026, 9, 23).getTime()}>
        <WeeklyReportScreen />
      </WardFlowProvider>
    </ToastProvider>,
  );
}

it("carries complete Perth period boundaries and a dated generation stamp on detached reports", () => {
  report();
  const period = screen.getByTestId("ward-weekly-period");
  expect(period).toHaveTextContent("Mon, 12 Oct 2026, 00:00 AWST (inclusive)");
  expect(period).toHaveTextContent("Mon, 19 Oct 2026, 00:00 AWST (exclusive)");
  expect(period).not.toHaveTextContent("Counted to");
  expect(screen.getByTestId("ward-weekly-range")).toHaveTextContent("Generated Fri, 23 Oct 2026, 10:42 AWST");

  fireEvent.change(screen.getByTestId("ward-weekly-week"), { target: { value: "-1" } });
  expect(period).toHaveTextContent("Mon, 19 Oct 2026, 00:00 AWST (inclusive)");
  expect(period).toHaveTextContent("Mon, 26 Oct 2026, 00:00 AWST (exclusive)");
  expect(period).toHaveTextContent("Counted to Fri, 23 Oct 2026, 10:42 AWST (exclusive)");
});

it("keeps a historical selected week and its honest occupied-time label when the phone print tree takes over", () => {
  const listeners = new Set<() => void>();
  let phone = false;
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query === "(max-width: 48rem)" && phone,
    media: query,
    onchange: null,
    addEventListener: (_event: string, notify: EventListenerOrEventListenerObject) =>
      listeners.add(notify as () => void),
    removeEventListener: (_event: string, notify: EventListenerOrEventListenerObject) =>
      listeners.delete(notify as () => void),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  report();
  fireEvent.change(screen.getByTestId("ward-weekly-week"), { target: { value: "1" } });
  const historicalPercent = screen.getByTestId("ward-weekly-occupancy").textContent;
  act(() => {
    phone = true;
    for (const notify of listeners) notify();
  });

  expect(screen.getByTestId("ward-weekly-phone")).toBeInTheDocument();
  // The phone hero names the week; the line under the week switch says only when it was made.
  expect(document.body).toHaveTextContent("Mon 5 Oct to Sun 11 Oct");
  expect(screen.getByTestId("ward-weekly-range")).toHaveTextContent(/^Generated /);
  expect(screen.getByTestId("ward-weekly-period")).toHaveTextContent("Mon, 5 Oct 2026, 00:00 AWST (inclusive)");
  expect(screen.getByTestId("ward-weekly-occupancy")).toHaveTextContent(historicalPercent!);
  expect(screen.queryByText("Average in use, this week so far")).not.toBeInTheDocument();
  expect(screen.getAllByText("Recorded occupied bed time")).toHaveLength(2);
  expect(
    within(screen.getByTestId("ward-weekly-occupancy-definition")).getByText(/Closed beds stay in the denominator/),
  ).toBeInTheDocument();
});

it.each([false, true])(
  "distinguishes current in-use beds from historical occupied-time percentages (phone=%s)",
  (phone) => {
    installMatchMediaStub(phone);
    report();
    const definition = screen.getByTestId("ward-weekly-occupancy-definition");
    expect(definition).toHaveTextContent("current total bed count and counted time");
    expect(definition).toHaveTextContent("time pulled for arrival is excluded");
    expect(definition).toHaveTextContent("Historical bed capacity and pull times are not reconstructed");
    expect(screen.getByText("In use now", { exact: true })).toBeInTheDocument();
    expect(screen.queryByText("Average occupancy", { exact: true })).not.toBeInTheDocument();
  },
);
