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
      <AdvanceClock minutes={minutes || 60} />
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

  it("keeps deadline status reactive when the shared clock advances", () => {
    const tools = openTools();
    fireEvent.click(screen.getByTestId("test-advance-clock"));
    expect(within(tools).getByTestId("ward-bar-figures-trigger").textContent).toMatch(/deadline passed|due within/i);
  });

  it("shows deadline flags and all figure clusters within the same Tools dialog", async () => {
    const tools = openTools(70);
    const launch = within(tools).getByTestId("ward-bar-figures-trigger");
    expect(launch.textContent).toMatch(/deadline passed|due within/i);
    fireEvent.click(launch);
    expect(within(tools).getByRole("button", { name: "Figures" })).toHaveAttribute("aria-pressed", "true");
    expect(await within(tools).findByRole("heading", { name: "Beds and capacity" })).toBeVisible();
    for (const heading of ["Waits and recorded limits", "Beds and capacity", "Flow and discharges"]) {
      expect(within(tools).getByRole("heading", { name: heading })).toBeVisible();
    }
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(within(tools).getByRole("button", { name: "Figures" })).toHaveFocus();
  });

  it("keeps compact utilities and scenario controls in the shift desk", async () => {
    const tools = openTools();
    fireEvent.click(within(tools).getByRole("button", { name: "Utilities" }));
    expect(within(tools).getByText("Catchment resolver")).toBeVisible();
    expect(within(tools).getByText("Form date review")).toBeVisible();
    fireEvent.click(within(tools).getByRole("button", { name: "Shift desk" }));
    expect(await within(tools).findByRole("link", { name: /Shift handover/ })).toBeVisible();
    expect(within(tools).queryByRole("button", { name: "Demo" })).toBeNull();
    expect(within(tools).getByTestId("ward-demo-controls-trigger")).toBeVisible();
  });

  it("filters the directory without losing its navigation links", async () => {
    const tools = openTools();
    fireEvent.click(within(tools).getByRole("button", { name: "Directory" }));
    const search = await within(tools).findByRole("searchbox", { name: "Search contact directory" });
    fireEvent.click(within(tools).getByRole("button", { name: "Wards" }));
    const wardList = within(tools).getByRole("list", { name: "Contact directory" });
    const firstLink = within(wardList).getAllByRole("link")[0];
    const name = firstLink.querySelector("strong")!.textContent!;
    const href = firstLink.getAttribute("href");
    fireEvent.change(search, { target: { value: name } });
    expect(within(wardList).getByRole("link", { name: new RegExp(name) })).toHaveAttribute("href", href);
    fireEvent.change(search, { target: { value: "no-such-unit" } });
    expect(within(wardList).queryAllByRole("link")).toHaveLength(0);
    expect(within(tools).getByText("No matching contacts")).toBeVisible();
  });

  it("closes Tools from Figures without leaving a second drawer open", () => {
    const tools = openTools();
    fireEvent.click(within(tools).getByTestId("ward-bar-figures-trigger"));
    fireEvent.click(within(tools).getByRole("button", { name: /^close$/i }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
