import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";

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

function asPhone() {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query === "(max-width: 46.4375rem)",
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}

describe("page Live chip (P168)", () => {
  // M8 (Josh, 3 Nov 2026): one clock, in the top bar. On tablet and desktop the pill is the pause
  // control alone; the phone keeps its freshness line.
  it("keeps the pause pill without a clock on tablet and desktop", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Chip />
      </WardFlowProvider>,
    );
    const chip = screen.getByRole("button", { name: "Demo, pause demo updates" });
    expect(chip).toHaveTextContent(/^Demo$/);
    expect(chip).not.toHaveTextContent(formatInstant(NOW_ANCHOR));
  });

  it("shows the ward clock on a phone, not a seconds counter, and does not tick each second", () => {
    const restore = asPhone();
    onTestFinished(restore);
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
