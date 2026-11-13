import { act, cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Time audit C8 (D-194, Josh 13 Nov 2026, under D-150): training on the signed-in site keeps its
 * scripted clock (10:42, +15 minutes), and the header names it "Training clock" so nobody reads it
 * as the real Perth time. Outside training the header reads "Board time 10:42", with no zone label
 * (RC 2.6, F-113: the board clock is the demo's scripted time).
 * Synthetic data only.
 */

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { startTraining, stopTraining } from "@/components/ward-management/demo-reset/ward-training-mode";
import { NextBar } from "@/components/ward-management/shell-next/next-bar";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

beforeEach(() => {
  if (typeof window.requestAnimationFrame !== "function") {
    window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      setTimeout(() => cb(Date.now()), 0) as unknown as number) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = ((id: number) =>
      clearTimeout(id as unknown as ReturnType<typeof setTimeout>)) as typeof window.cancelAnimationFrame;
  }
});

afterEach(() => {
  act(() => stopTraining());
  cleanup();
  window.sessionStorage.clear();
});

function renderBar() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <NextBar />
    </WardFlowProvider>,
  );
}

describe("header clock in training (C8)", () => {
  it("reads Board time, with no zone label (F-113), outside training", () => {
    renderBar();
    const clock = screen.getByTestId("ward-bar-demo-clock");
    expect(clock).toHaveTextContent("Board time");
    expect(clock).toHaveTextContent("10:42");
    expect(clock).not.toHaveTextContent("AWST");
    expect(clock).not.toHaveTextContent("Training clock");
  });

  it("reads Training clock, not AWST, while training is on", () => {
    act(() => startTraining());
    renderBar();
    const clock = screen.getByTestId("ward-bar-demo-clock");
    expect(clock).toHaveTextContent("Training clock");
    expect(clock).toHaveTextContent("10:42");
    expect(clock).not.toHaveTextContent("AWST");
    expect(clock).not.toHaveTextContent("Board time");
    expect(clock).toHaveAccessibleName(/^Training clock 10:42\b/u);
  });
});
