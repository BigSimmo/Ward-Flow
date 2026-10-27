// TC-08 (audits 24 and 26 Oct 2026, H-0221 and H-0777): the banner's preview mode reads an expiry on its own clock.
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { WardBroadcastBanner } from "@/components/ward-management/shell/ward-broadcast-banner";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
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

  it("reads a real-time expiry against real time, even inside a provider", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardBroadcastBanner
          activeAlert={alert(new Date((Math.floor(Date.now() / 60_000) + 45) * 60_000).toISOString())}
        />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("ward-broadcast-banner")).toHaveTextContent(/4[45]m remaining/);
  });

  it("shows nothing for a board-minute expiry with no board clock to read it against", () => {
    render(<WardBroadcastBanner activeAlert={alert(NOW_ANCHOR + 90)} />);
    expect(screen.queryByTestId("ward-broadcast-banner")).toBeNull();
  });
});
