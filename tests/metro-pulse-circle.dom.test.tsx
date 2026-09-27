/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MetroPulseCircle } from "@/components/ui/metro-pulse-circle";

describe("MetroPulseCircle", () => {
  it("renders with aria-hidden to avoid screen reader noise", () => {
    render(<MetroPulseCircle data-testid="metro-dot" />);
    const dot = screen.getByTestId("metro-dot");

    expect(dot).toHaveAttribute("aria-hidden", "true");
    expect(dot).toHaveAttribute("data-metro-status", "live");
  });

  it("applies the appropriate status classes for each semantic tone", () => {
    const { rerender } = render(<MetroPulseCircle status="live" data-testid="metro-dot" />);
    let dot = screen.getByTestId("metro-dot");
    expect(dot.className).toContain("circle");
    expect(dot.className).toContain("live");

    rerender(<MetroPulseCircle status="connected" data-testid="metro-dot" />);
    dot = screen.getByTestId("metro-dot");
    expect(dot.className).toContain("live");

    rerender(<MetroPulseCircle status="syncing" data-testid="metro-dot" />);
    dot = screen.getByTestId("metro-dot");
    expect(dot.className).toContain("syncing");

    rerender(<MetroPulseCircle status="stale" data-testid="metro-dot" />);
    dot = screen.getByTestId("metro-dot");
    expect(dot.className).toContain("syncing");

    rerender(<MetroPulseCircle status="error" data-testid="metro-dot" />);
    dot = screen.getByTestId("metro-dot");
    expect(dot.className).toContain("error");

    rerender(<MetroPulseCircle status="static" data-testid="metro-dot" />);
    dot = screen.getByTestId("metro-dot");
    expect(dot.className).toContain("static");
    expect(dot.className).toContain("noPulse");

    rerender(<MetroPulseCircle status="frozen" data-testid="metro-dot" />);
    dot = screen.getByTestId("metro-dot");
    expect(dot.className).toContain("static");
    expect(dot.className).toContain("noPulse");
  });

  it("allows suppressing pulsing while preserving semantic hue", () => {
    render(<MetroPulseCircle status="live" pulse={false} data-testid="metro-dot" />);
    const dot = screen.getByTestId("metro-dot");

    expect(dot.className).toContain("live");
    expect(dot.className).toContain("noPulse");
  });
});
