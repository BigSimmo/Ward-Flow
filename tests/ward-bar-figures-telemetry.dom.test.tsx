import { fireEvent, render, screen, within } from "@testing-library/react";
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

describe("Figures in the Tools workspace", () => {
  beforeEach(() => {
    resetWardLiveRegionForTests();
  });

  function openTools(minutes = 0) {
    renderBarWithAdvance(minutes);
    expect(within(screen.getByTestId("ward-bar")).queryByTestId("ward-bar-figures-trigger")).toBeNull();
    fireEvent.click(screen.getByTestId("ward-bar-tools-trigger"));
    return screen.getByRole("dialog", { name: "Tools" });
  }

  it("removes Figures from the header and offers it inside Tools", () => {
    const tools = openTools();
    expect(within(tools).getByTestId("ward-bar-figures-trigger")).toHaveTextContent("Figures");
    expect(within(tools).getByTestId("ward-bar-figures-trigger")).toHaveTextContent("Nothing flagged");
  });

  it("keeps deadline status reactive when the demonstration clock advances", () => {
    const tools = openTools();
    fireEvent.click(within(tools).getByRole("button", { name: "Overview", exact: true }));
    fireEvent.click(within(tools).getByTestId("ward-demo-controls-trigger"));
    fireEvent.click(within(tools).getByTestId("ward-demo-advance-60"));
    fireEvent.click(within(tools).getByRole("button", { name: "Overview" }));
    expect(within(tools).getByTestId("ward-bar-figures-trigger").textContent).toMatch(/deadline passed|due within/i);
  });

  it("shows deadline flags and all figure clusters within the same Tools dialog", () => {
    const tools = openTools(70);
    const launch = within(tools).getByTestId("ward-bar-figures-trigger");
    expect(launch.textContent).toMatch(/deadline passed|due within/i);
    fireEvent.click(launch);
    expect(within(tools).getByRole("button", { name: "Figures" })).toHaveAttribute("aria-pressed", "true");
    expect(within(tools).getByTestId("ward-stats-drawer-content")).toBeVisible();
    for (const heading of ["Risk & Statutory Clocks", "Supply & Capacity", "Demand & Flow"]) {
      expect(within(tools).getByText(heading)).toBeVisible();
    }
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(within(tools).getByRole("button", { name: "Figures" })).toHaveFocus();
  });

  it("keeps utilities and demo controls accessible through their sections", () => {
    const tools = openTools();
    fireEvent.click(within(tools).getByRole("button", { name: "Utilities" }));
    expect(within(tools).getByText("Catchment resolver")).toBeVisible();
    expect(within(tools).getByText("Form date review")).toBeVisible();
    fireEvent.click(within(tools).getByRole("button", { name: "Overview", exact: true }));
    expect(within(tools).getByRole("button", { name: /change view/i })).toBeVisible();
  });

  it("filters the directory without losing its navigation links", () => {
    const tools = openTools();
    fireEvent.click(within(tools).getByRole("button", { name: "Directory" }));
    const wardList = within(tools).getByRole("list", { name: "Ward contacts" });
    const firstLink = within(wardList).getAllByRole("link")[0];
    const name = firstLink.querySelector("span")!.textContent!;
    const href = firstLink.getAttribute("href");
    fireEvent.change(within(tools).getByRole("textbox", { name: "Search ward contacts" }), { target: { value: name } });
    expect(within(wardList).getByRole("link", { name: new RegExp(name) })).toHaveAttribute("href", href);
    fireEvent.change(within(tools).getByRole("textbox", { name: "Search ward contacts" }), {
      target: { value: "no-such-unit" },
    });
    expect(within(wardList).queryAllByRole("link")).toHaveLength(0);
    expect(within(tools).getByText(/No matching locations/)).toBeVisible();
  });

  it("closes Tools from Figures without leaving a second drawer open", () => {
    const tools = openTools();
    fireEvent.click(within(tools).getByTestId("ward-bar-figures-trigger"));
    fireEvent.click(within(tools).getByRole("button", { name: /^close$/i }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
