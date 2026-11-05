import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LiveChip, publishLiveRefresh } from "@/components/wf/live";

/**
 * M8 (Josh, 3 Nov 2026): "One clock in the top bar. Stale is said in words, and phones and TVs keep
 * a freshness line." A tablet or desktop Live chip shows no age or clock, and nothing at all unless
 * it is the pause control; Paused, Stale and Offline always show in words. The phone keeps its line.
 */
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

const pill = (container: HTMLElement) => container.querySelector('[aria-hidden="true"]');

describe("Live chip, one clock (M8)", () => {
  it("shows nothing on tablet and desktop while live, but keeps the status line", () => {
    const { container } = render(<LiveChip state="live" age="10:42" onHero />);
    expect(pill(container)).toBeNull();
    expect(container).not.toHaveTextContent("10:42");
    expect(screen.getByRole("status")).toHaveTextContent(/^Demo$/);
  });

  it("keeps one status region mounted when a hidden chip turns stale (Codex, #1375)", () => {
    const { rerender } = render(<LiveChip state="live" onHero />);
    const region = screen.getByRole("status");
    rerender(<LiveChip state="stale" asAt={new Date("2026-10-07T10:26:00+08:00")} onHero />);
    expect(screen.getByRole("status")).toBe(region);
    expect(region).toHaveTextContent(/^Not updating since 10:26$/);
  });

  it("keeps the pause pill on tablet and desktop, without an age", () => {
    render(<LiveChip state="live" age="1s" onTogglePause={() => undefined} />);
    expect(screen.getByRole("button", { name: /pause demo updates$/ })).toHaveAccessibleName(
      "Demo, pause demo updates",
    );
  });

  it("says Paused, Not updating since and Offline in words", () => {
    const { container, rerender } = render(<LiveChip state="paused" onHero />);
    expect(pill(container)).toHaveTextContent(/^Paused$/);
    rerender(<LiveChip state="stale" asAt={new Date("2026-10-07T10:26:00+08:00")} onHero />);
    expect(pill(container)).toHaveTextContent(/^Not updating since 10:26$/);
    expect(screen.getByRole("status")).toHaveTextContent(/^Not updating since 10:26$/);
    rerender(<LiveChip state="offline" onHero />);
    expect(pill(container)).toHaveTextContent(/^Offline$/);
  });

  it("turns a live chip into Not updating since the last good refresh", () => {
    const receivedAt = new Date("2026-10-07T10:26:00+08:00").getTime();
    try {
      act(() => publishLiveRefresh({ unavailable: true, receivedAt }));
      const { container } = render(<LiveChip state="live" onHero />);
      expect(pill(container)).toHaveTextContent(/^Not updating since 10:26$/);
    } finally {
      act(() => publishLiveRefresh(undefined));
    }
  });

  it("keeps the phone's freshness line", () => {
    const restore = asPhone();
    try {
      const { container } = render(<LiveChip state="live" age="10:42" onHero />);
      expect(pill(container)).toHaveTextContent("Demo 10:42");
    } finally {
      restore();
    }
  });
});
