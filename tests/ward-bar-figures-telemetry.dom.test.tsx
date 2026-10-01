import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const route = { pathname: "/mockups/ward-flow" };
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

import { WardBar } from "@/components/ward-management/shell/ward-bar";
import { WardLiveRegion, resetWardLiveRegionForTests } from "@/components/ward-management/shell/ward-live-region";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function AdvanceClock({ minutes }: { minutes: number }) {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      data-testid="test-advance-clock"
      onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes })}
    >
      advance clock
    </button>
  );
}

function renderBarWithAdvance(minutes = 0) {
  const result = render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardLiveRegion />
      <AdvanceClock minutes={minutes} />
      <WardBar />
    </WardFlowProvider>,
  );
  if (minutes > 0) {
    fireEvent.click(screen.getByTestId("test-advance-clock"));
  }
  return result;
}

describe("WardBar Figures Telemetry Trigger & Drawer", () => {
  beforeEach(() => {
    resetWardLiveRegionForTests();
  });

  it("renders the Figures telemetry trigger in WardBar drawerTriggers", () => {
    renderBarWithAdvance(0);
    const trigger = screen.getByTestId("ward-bar-figures-trigger");
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent("Figures");
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("shows nominal status when no legal deadlines are approaching or passed", () => {
    renderBarWithAdvance(0);
    const trigger = screen.getByTestId("ward-bar-figures-trigger");
    expect(trigger).toHaveAttribute("title", "Clinical telemetry: Nominal");
    expect(trigger.querySelector('[data-tone="good"]')).toBeInTheDocument();
  });

  it("shows active alarm badge when a legal deadline becomes critical", () => {
    renderBarWithAdvance(70);
    const trigger = screen.getByTestId("ward-bar-figures-trigger");
    const badge = trigger.querySelector('[data-tone="danger"]');
    expect(badge).toBeInTheDocument();
    expect(badge?.textContent).toMatch(/\d+/);
    expect(trigger.getAttribute("title")).toMatch(/deadline passed|due within/i);
  });

  it("opens the Figures & Telemetry drawer on click and renders all metric clusters", () => {
    renderBarWithAdvance(70);
    const trigger = screen.getByTestId("ward-bar-figures-trigger");
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const sheet = screen.getByTestId("ward-bar-figures-sheet");
    expect(sheet).toBeInTheDocument();

    const drawerContent = screen.getByTestId("ward-stats-drawer-content");
    expect(drawerContent).toBeInTheDocument();

    // Verify all 3 Swiss clusters are present
    expect(screen.getByText("Risk & Statutory Clocks")).toBeInTheDocument();
    expect(screen.getByText("Supply & Capacity")).toBeInTheDocument();
    expect(screen.getByText("Demand & Flow")).toBeInTheDocument();

    // Verify legal disclaimer is rendered
    expect(screen.getByText(/Figures derived continuously from live clinical arrivals/i)).toBeInTheDocument();
  });

  it("closes the drawer when clicking the close button", () => {
    renderBarWithAdvance(0);
    const trigger = screen.getByTestId("ward-bar-figures-trigger");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    const closeBtn = screen.getByRole("button", { name: /^close$/i });
    fireEvent.click(closeBtn);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
