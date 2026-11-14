// @vitest-environment jsdom
// CC-6 (mechanics and clock audit, 14 Nov 2026): the handover meeting chip shows the length History
// records, on the board clock. Before, the chip counted real seconds ("Stop 00:05") while History
// recorded board minutes, so a moved demo clock showed two different lengths for one meeting.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
const announced = vi.hoisted(() => [] as string[]);
vi.mock("@/components/ward-management/shell/ward-live-region", async (original) => ({
  ...(await original<typeof import("@/components/ward-management/shell/ward-live-region")>()),
  announceToWardShell: (text: string) => announced.push(text),
}));

import { HandoverPage } from "@/components/ward-management/handover/handover-page";
import { handoverMeetingMinutes } from "@/components/ward-management/handover/handover-sheet-parts";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

function AdvanceClock() {
  const { dispatch, now } = useWardFlow();
  return (
    <button type="button" onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes: 25 })}>
      Advance the demo clock
    </button>
  );
}

it("one rule for the length: whole board minutes, at least 1", () => {
  expect(handoverMeetingMinutes(600, 600)).toBe(1);
  expect(handoverMeetingMinutes(600, 601)).toBe(1);
  expect(handoverMeetingMinutes(600, 625)).toBe(25);
});

it("the chip follows the board clock, not real seconds, and matches what History records", () => {
  vi.useFakeTimers();
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <AdvanceClock />
      <HandoverPage />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Start meeting" }));
  expect(screen.getByTestId("ward-handover-meeting").textContent).toContain("Stop 1 min");

  // Real time passes, the pinned board clock does not: the chip does not count it.
  act(() => {
    vi.advanceTimersByTime(90_000);
  });
  expect(screen.getByTestId("ward-handover-meeting").textContent).toContain("Stop 1 min");

  // The demo clock moves 25 minutes: the chip says 25 min, and so does History.
  act(() => fireEvent.click(screen.getByRole("button", { name: "Advance the demo clock" })));
  expect(screen.getByTestId("ward-handover-meeting").textContent).toContain("Stop 25 min");
  fireEvent.click(screen.getByTestId("ward-handover-meeting"));
  expect(announced).toContain("Meeting took 25 min. Added to History.");
  expect(screen.getByTestId("ward-handover-meeting").textContent).toContain("Start meeting");
});
