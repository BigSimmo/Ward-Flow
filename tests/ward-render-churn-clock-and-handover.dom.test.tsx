// @vitest-environment jsdom

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { HandoverPage } from "@/components/ward-management/handover/handover-page";
import * as handoverModel from "@/components/ward-management/handover/handover-model";

vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow/handover",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("Task 6: Background render-churn elimination & HandoverPage timer isolation", () => {
  it("isolates the 1000ms meeting timer into a leaf component so HandoverPage does not re-render every second", () => {
    vi.useFakeTimers();
    const handoverShiftSpy = vi.spyOn(handoverModel, "handoverShift");

    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <HandoverPage />
      </WardFlowProvider>,
    );

    const startBtn = screen.getByRole("button", { name: /start meeting/i });
    fireEvent.click(startBtn);

    expect(screen.getByRole("button", { name: /stop 00:00/i })).toBeTruthy();
    const callsAfterStart = handoverShiftSpy.mock.calls.length;

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByRole("button", { name: /stop 00:05/i })).toBeTruthy();
    expect(handoverShiftSpy.mock.calls.length).toBe(callsAfterStart);
    handoverShiftSpy.mockRestore();
  });

  it("maintains sequential h1 -> h2 heading hierarchy on HandoverPage and guards active meeting state on beforeunload", () => {
    const { container } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <HandoverPage />
      </WardFlowProvider>,
    );

    const sinceHeading = screen.getByRole("heading", { name: /since you looked/i });
    expect(sinceHeading.tagName).toBe("H2");

    const headings = Array.from(container.querySelectorAll("h1, h2, h3, h4, h5, h6")).map((el) => ({
      level: Number(el.tagName.slice(1)),
      text: el.textContent?.trim() ?? "",
    }));
    expect(headings.length).toBeGreaterThan(1);
    for (let i = 1; i < headings.length; i++) {
      expect(
        headings[i]!.level - headings[i - 1]!.level,
        `Heading jumped from h${headings[i - 1]!.level} ("${headings[i - 1]!.text}") to h${headings[i]!.level} ("${headings[i]!.text}")`,
      ).toBeLessThanOrEqual(1);
    }

    fireEvent.click(screen.getByRole("button", { name: /start meeting/i }));
    const unloadEvent = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unloadEvent);
    expect(unloadEvent.defaultPrevented).toBe(true);
  });
});
