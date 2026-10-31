import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const route = { pathname: "/ward-flow" };
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

describe("Figures in the Tools sheet", () => {
  beforeEach(() => {
    resetWardLiveRegionForTests();
  });

  // The Tools sheet is a `next/dynamic` import, so its first paint waits for that chunk. Testing
  // Library's default 1 s wait was too short on a loaded CI runner (shard 4, 9 Oct 2026): content
  // arrived late, not missing. Wait for it as long as it takes.
  async function openTools(minutes = 0) {
    renderBarWithAdvance(minutes);
    expect(within(screen.getByTestId("ward-bar")).queryByTestId("ward-tools-service-now")).toBeNull();
    fireEvent.click(screen.getByTestId("ward-bar-tools-trigger"));
    const tools = screen.getByRole("dialog", { name: "Tools" });
    await within(tools).findByTestId("ward-tools-toggle-figures", {}, { timeout: 15_000 });
    return tools;
  }

  it("keeps Figures out of the header and does not repeat the headline figures in Tools", async () => {
    const tools = await openTools();
    // Simplification A5 (19 Oct 2026): the "Service now" block left; All figures stays one row away.
    expect(within(tools).queryByTestId("ward-tools-service-now")).toBeNull();
    expect(within(tools).queryByRole("region", { name: "Service now" })).toBeNull();
    expect(within(tools).getByTestId("ward-tools-toggle-figures")).toBeVisible();
  });

  it("opens all figure clusters in place within the same Tools dialog", async () => {
    const tools = await openTools(70);
    const toggle = within(tools).getByTestId("ward-tools-toggle-figures");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    for (const heading of ["Waits and recorded limits", "Beds and capacity", "Flow and discharges"]) {
      expect(within(tools).getByRole("heading", { name: heading })).toBeVisible();
    }
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("keeps catchment, form times and the demo row in the same sheet, with no tab bar", async () => {
    const tools = await openTools();
    expect(within(tools).queryByRole("group", { name: "Tools sections" })).toBeNull();
    expect(within(tools).queryByRole("button", { name: "Shift desk" })).toBeNull();
    fireEvent.click(within(tools).getByTestId("ward-tools-toggle-form-times"));
    expect(within(tools).getByTestId("ward-form-times")).toBeVisible();
    fireEvent.click(within(tools).getByTestId("ward-tools-toggle-catchment"));
    expect(await within(tools).findByTestId("ward-catchment-resolver", {}, { timeout: 15_000 })).toBeVisible();
    // The app bar no longer has a Synthetic pill, so on a desktop the demo controls sit in Tools as
    // one Demo row (the board clock opens them). There is still no separate demo trigger.
    expect(within(tools).getByTestId("ward-tools-toggle-demo")).toBeVisible();
    expect(within(tools).queryByTestId("ward-demo-controls-trigger")).toBeNull();
  });

  it("searches contacts without losing the On-call link", async () => {
    const tools = await openTools();
    fireEvent.click(within(tools).getByTestId("ward-tools-toggle-contacts"));
    const search = within(tools).getByRole("searchbox", { name: "Search a team, ward or role" });
    fireEvent.change(search, { target: { value: "no-such-team" } });
    expect(within(tools).getByText("No contact matches.")).toBeVisible();
    expect(within(tools).getByRole("link", { name: "Open On-call" })).toBeVisible();
  });

  it("closes Tools from All figures without leaving a second drawer open", async () => {
    const tools = await openTools();
    fireEvent.click(within(tools).getByTestId("ward-tools-toggle-figures"));
    fireEvent.click(within(tools).getByRole("button", { name: /^close$/i }));
    // Closing steps Back through the drawer's own history entry; the sheet stays until popstate.
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
