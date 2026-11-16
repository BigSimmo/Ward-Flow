import { act, cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Time audit C8 (D-194, Josh 13 Nov 2026, under D-150): training on the signed-in site keeps its
 * scripted clock (10:42, +15 minutes), and the clock is named "Training clock" so nobody reads it
 * as the real Perth time. Outside training it reads "Board time 10:42", with no zone label
 * (RC 2.6, F-113: the board clock is the demo's scripted time). Since D-258 (16 Nov 2026) the header
 * has no clock: the rail's shift card and the phone Menu's time card carry the name.
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
  usePathname: () => "/bedchart",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { startTraining, stopTraining } from "@/components/ward-management/demo-reset/ward-training-mode";
import { NextBar } from "@/components/ward-management/shell-next/next-bar";
import { NextPhoneMenuTop } from "@/components/ward-management/shell-next/next-phone-menu-top";
import { NextRailBody } from "@/components/ward-management/shell-next/next-rail-body";
import { setRailOpenPreference } from "@/components/ward-management/shell/ward-rail-preferences";
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

function renderShell() {
  setRailOpenPreference(true);
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <NextRailBody />
      <NextBar />
      <NextPhoneMenuTop onGo={() => {}} />
    </WardFlowProvider>,
  );
}

describe("clock name in training (C8)", () => {
  it("reads Board time, with no zone label (F-113), outside training, and none in the header", () => {
    renderShell();
    expect(screen.queryByTestId("ward-bar-demo-clock")).not.toBeInTheDocument();
    const rail = screen.getByTestId("ward-rail-live-clock").closest("[title]");
    expect(rail).toHaveAttribute("title", expect.stringMatching(/^Board time 10:42 am\./u));
    const phone = screen.getByTestId("next-phone-menu-time");
    expect(phone).toHaveTextContent("Board time");
    expect(phone).toHaveTextContent("10:42");
    expect(phone).toHaveTextContent("Handover");
    expect(phone).not.toHaveTextContent("AWST");
    expect(phone).not.toHaveTextContent("Training clock");
  });

  it("reads Training clock, not AWST, while training is on", () => {
    act(() => startTraining());
    renderShell();
    const rail = screen.getByTestId("ward-rail-live-clock").closest("[title]");
    expect(rail).toHaveAttribute("title", expect.stringMatching(/^Training clock 10:42 am\./u));
    const phone = screen.getByTestId("next-phone-menu-time");
    expect(phone).toHaveTextContent("Training clock");
    expect(phone).toHaveTextContent("10:42");
    expect(phone).not.toHaveTextContent("AWST");
    expect(phone).not.toHaveTextContent("Board time");
  });
});
