// TC-08 (audits 24 and 26 Oct 2026, H-0221 and H-0777): the banner's preview mode reads an expiry on its own clock.
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { WardBroadcastBanner } from "@/components/ward-management/shell/ward-broadcast-banner";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { calendarDateOf } from "@/components/ward-management/ward-clock";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const alert = (expiresAt: string | number) => ({
  id: "synthetic-preview",
  title: "Synthetic preview alert",
  message: "Synthetic preview message.",
  severity: "warning" as const,
  expiresAt,
});

afterEach(cleanup);

describe("broadcast banner preview mode", () => {
  it("reads a board-minute expiry against the board clock, not the device's real time", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardBroadcastBanner activeAlert={alert(NOW_ANCHOR + 90)} />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("ward-broadcast-banner")).toHaveTextContent("1h 30m remaining");
  });

  // H-0221: an ISO expiry is read against the board clock's calendar moment, not the device's real time.
  it("reads a calendar expiry against the board clock, not the device's real time", () => {
    const dayZero = Date.UTC(2026, 0, 4, 16);
    const expiresAt = new Date(calendarDateOf(NOW_ANCHOR + 45, new Date(dayZero)).getTime()).toISOString();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR} initialDayZero={dayZero}>
        <WardBroadcastBanner activeAlert={alert(expiresAt)} />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("ward-broadcast-banner")).toHaveTextContent("45m remaining");
  });

  it("shows nothing for a calendar expiry with no board clock, whatever the device's real time", () => {
    render(<WardBroadcastBanner activeAlert={alert(new Date(Date.now() + 45 * 60_000).toISOString())} />);
    expect(screen.queryByTestId("ward-broadcast-banner")).toBeNull();
  });

  it("shows nothing for a board-minute expiry with no board clock to read it against", () => {
    render(<WardBroadcastBanner activeAlert={alert(NOW_ANCHOR + 90)} />);
    expect(screen.queryByTestId("ward-broadcast-banner")).toBeNull();
  });
});
