// Review E-14 (F-142): with "Reset the demo?" open over Tools, narrowing the window past the two-pane
// line (1280 wide) redraws the demo panel elsewhere. The confirm must survive the switch, and Escape
// closes the confirm first and Tools only after that.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Sheet } from "@/components/wf";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardToolsSheet } from "@/components/ward-management/tools/ward-tools-sheet";
import { useToolsTwoPane } from "@/components/ward-management/tools/ward-tools-two-pane";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/capacity",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const WIDE = "(min-width: 80rem)";
const media = { wide: true, listeners: new Set<() => void>() };

function setWide(wide: boolean) {
  media.wide = wide;
  act(() => {
    for (const listener of Array.from(media.listeners)) listener();
  });
}

beforeEach(() => {
  media.wide = true;
  media.listeners.clear();
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        get matches() {
          return query === WIDE ? media.wide : false;
        },
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener: (_type: string, listener: () => void) => {
          if (query === WIDE) media.listeners.add(listener);
        },
        removeEventListener: (_type: string, listener: () => void) => {
          media.listeners.delete(listener);
        },
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** The bar's Tools sheet: two panes from 1280 wide, one page at a time below that. */
function ToolsHost() {
  const [open, setOpen] = useState(true);
  const twoPane = useToolsTwoPane(false);
  return (
    <>
      <button type="button" data-testid="tools-host-open" onClick={() => setOpen(true)}>
        Tools
      </button>
      <button type="button" data-testid="tools-host-close" onClick={() => setOpen(false)}>
        Close Tools
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Tools" testId="tools-host">
        <WardToolsSheet
          isPhone={false}
          twoPane={twoPane}
          roleLabel="Bed coordinator"
          onNavigate={() => setOpen(false)}
          onNewReferral={() => {}}
        />
      </Sheet>
    </>
  );
}

function renderTools() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ToolsHost />
    </WardFlowProvider>,
  );
}

const confirm = () => screen.queryByRole("dialog", { name: "Reset the demo?" });

describe("the demo confirm across the Tools two-pane switch", () => {
  it("stays open when the window narrows, and Escape closes it before Tools", async () => {
    const user = userEvent.setup();
    renderTools();
    expect(screen.getByTestId("ward-tools-sheet-v3")).toHaveAttribute("data-two-pane", "true");
    fireEvent.click(screen.getByTestId("ward-tools-toggle-demo"));
    fireEvent.click(within(screen.getByTestId("ward-tools-demo-panel")).getByTestId("ward-tools-demo-reset"));
    expect(confirm()).not.toBeNull();

    // 1440 to 1000 wide: the panel moves from the right pane to its own page.
    setWide(false);
    expect(screen.getByTestId("ward-tools-sheet-v3")).not.toHaveAttribute("data-two-pane");
    expect(screen.getByTestId("ward-tools-page")).toBeInTheDocument();
    expect(confirm()).not.toBeNull();
    await waitFor(() => expect(confirm()!.contains(document.activeElement)).toBe(true));

    // The first Escape answers the confirm only.
    await user.keyboard("{Escape}");
    expect(confirm()).toBeNull();
    expect(screen.getByTestId("tools-host")).toBeInTheDocument();

    // The second Escape closes Tools.
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("tools-host")).toBeNull());
  });

  it("survives widening again, and an answered confirm stays closed through later switches", () => {
    renderTools();
    fireEvent.click(screen.getByTestId("ward-tools-toggle-demo"));
    fireEvent.click(screen.getByTestId("ward-tools-demo-reset"));
    setWide(false);
    expect(confirm()).not.toBeNull();
    setWide(true);
    expect(screen.getByTestId("ward-tools-sheet-v3")).toHaveAttribute("data-two-pane", "true");
    expect(confirm()).not.toBeNull();
    fireEvent.click(within(confirm()!).getByRole("button", { name: "Cancel" }));
    expect(confirm()).toBeNull();
    setWide(false);
    expect(confirm()).toBeNull();
    setWide(true);
    expect(confirm()).toBeNull();
  });

  it("drops the pending confirm when Tools closes, so reopening Tools does not bring it back", () => {
    renderTools();
    fireEvent.click(screen.getByTestId("ward-tools-toggle-demo"));
    fireEvent.click(screen.getByTestId("ward-tools-demo-reset"));
    expect(confirm()).not.toBeNull();
    // Tools closes underneath it (a navigation from the sheet does this).
    act(() => screen.getByTestId("tools-host-close").click());
    expect(screen.queryByTestId("tools-host")).toBeNull();
    expect(confirm()).toBeNull();
    act(() => screen.getByTestId("tools-host-open").click());
    expect(screen.getByTestId("tools-host")).toBeInTheDocument();
    setWide(false);
    expect(confirm()).toBeNull();
    expect(screen.queryByTestId("ward-tools-page")).toBeNull();
  });
});
