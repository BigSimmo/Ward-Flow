// DA-14 (design audit, 19 Oct 2026): choosing a service in the header redraws the whole page, about
// 260 ms on a slow phone. `selectService` in `shell/ward-bar.tsx` now closes the panel first and
// moves the store write to the next task, so the closed panel paints before the redraw starts.

import type { ReactNode } from "react";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Same mocking idiom as `tests/ward-service-panel-note.dom.test.tsx` for mounting `WardBar` alone.
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

import { WardBar } from "@/components/ward-management/shell/ward-bar";
import { WardLiveRegion } from "@/components/ward-management/shell/ward-live-region";
import { resetServiceScopeForTests } from "@/components/ward-management/shell/ward-service-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { HEALTH_SERVICES } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(() => {
  vi.useRealTimers();
  resetServiceScopeForTests();
});

describe("header service picker (DA-14)", () => {
  it("applies the new service after the tap, not inside it, and closes the panel", () => {
    vi.useFakeTimers();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardLiveRegion />
        <WardBar />
      </WardFlowProvider>,
    );
    const trigger = screen.getByTestId("ward-bar-service-trigger");
    fireEvent.click(trigger);
    const service = HEALTH_SERVICES[0];
    fireEvent.click(screen.getByRole("button", { name: new RegExp(service) }));

    // The click itself leaves the page as it was: no redraw inside the tap.
    expect(trigger).toHaveAttribute("aria-label", "Service: Statewide");

    act(() => {
      vi.runAllTimers();
    });
    expect(screen.queryByTestId("ward-bar-service-panel")).toBeNull();
    expect(trigger).toHaveAttribute("aria-label", `Service: ${service}`);
  });
});
