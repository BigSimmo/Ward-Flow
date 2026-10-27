import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { formatInstant } from "@/components/ward-management/ward-clock";
import { PageLiveChip, usePageLive } from "@/components/ward-management/ward-page-live";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * P168 (audit register): the page Live chip counted seconds since the provider's last tick ("Demo 8s",
 * "Demo 25s"), so screens disagreed and it ticked every second. It shows the ward clock instead, the
 * same time Home and the phone chip show, and holds it while paused.
 */
function Chip() {
  const live = usePageLive();
  return <PageLiveChip paused={live.paused} onTogglePause={live.togglePause} />;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("page Live chip (P168)", () => {
  it("shows the ward clock, not a seconds counter, and does not tick each second", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Chip />
      </WardFlowProvider>,
    );
    const chip = screen.getByRole("button", { name: /pause demo updates/ });
    expect(chip).toHaveTextContent(`Demo ${formatInstant(NOW_ANCHOR)}`);
    act(() => vi.advanceTimersByTime(5000));
    expect(chip).toHaveTextContent(`Demo ${formatInstant(NOW_ANCHOR)}`);
    expect(chip.textContent).not.toMatch(/\d+s/);
    fireEvent.click(chip);
    expect(chip).toHaveTextContent(`Paused`);
  });
});
