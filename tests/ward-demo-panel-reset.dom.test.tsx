import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { WardDemoPanel } from "@/components/ward-management/tools/ward-demo-panel";
import { formatInstant } from "@/components/ward-management/ward-clock";
import {
  WardFlowOverride,
  WardFlowProvider,
  useWardFlow,
  useWardFlowClock,
} from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/capacity",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function ScenarioProbe() {
  return <output data-testid="scenario">{useWardFlow().scenario}</output>;
}

function ClockProbe() {
  return <output data-testid="clock">{formatInstant(useWardFlowClock())}</output>;
}

function renderPanel(wrap: (panel: ReactNode) => ReactNode = (panel) => panel) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ClockProbe />
      {wrap(<WardDemoPanel />)}
    </WardFlowProvider>,
  );
}

const panel = () => screen.getByTestId("ward-tools-demo-panel");
const status = () => within(panel()).getByRole("status");

describe("Reset demo in Tools, Demo (DA-10)", () => {
  it("asks first, and changes nothing when cancelled", () => {
    renderPanel();
    fireEvent.click(within(panel()).getByRole("button", { name: "+1 hour" }));
    const moved = screen.getByTestId("clock").textContent;

    fireEvent.click(screen.getByTestId("ward-tools-demo-reset"));
    const dialog = screen.getByRole("dialog", { name: "Reset the demo?" });
    // On this device the reset reaches this browser only, and the confirm says so.
    expect(dialog).toHaveTextContent("This puts Standard day back to its start");
    expect(dialog).toHaveTextContent("replaces the demo data in this browser only. Other devices are not changed");
    expect(dialog).not.toHaveTextContent("everyone");
    expect(dialog).toHaveTextContent("There is no undo");
    // Nothing happens until the confirm.
    expect(screen.getByTestId("clock").textContent).toBe(moved);

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("clock").textContent).toBe(moved);
    expect(status()).toHaveTextContent("");
  });

  it("resets after the confirm and only then says it was reset", () => {
    renderPanel();
    const start = screen.getByTestId("clock").textContent;
    fireEvent.click(within(panel()).getByRole("button", { name: "+1 hour" }));
    expect(screen.getByTestId("clock").textContent).not.toBe(start);

    fireEvent.click(screen.getByTestId("ward-tools-demo-reset"));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Reset demo" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("clock").textContent).toBe(start);
    expect(status()).toHaveTextContent("Standard day reset to its start in this browser only.");
  });

  it("resets the scenario that is loaded, not the standard night", () => {
    renderPanel((child) => (
      <>
        <ScenarioProbe />
        {child}
      </>
    ));
    fireEvent.click(within(panel()).getByRole("button", { name: /Scarce beds/ }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Load Scarce beds?" })).getByRole("button", {
        name: "Load Scarce beds",
      }),
    );
    expect(screen.getByTestId("scenario")).toHaveTextContent("scarce");

    fireEvent.click(within(panel()).getByRole("button", { name: "+1 hour" }));
    fireEvent.click(screen.getByTestId("ward-tools-demo-reset"));
    const dialog = screen.getByRole("dialog", { name: "Reset the demo?" });
    expect(dialog).toHaveTextContent("This puts Scarce beds back to its start");
    fireEvent.click(within(dialog).getByRole("button", { name: "Reset demo" }));
    expect(screen.getByTestId("scenario")).toHaveTextContent("scarce");
    expect(status()).toHaveTextContent("Scarce beds reset to its start");
  });

  it("asks before a scenario card replaces the demo data, and changes nothing when cancelled", () => {
    renderPanel((child) => (
      <>
        <ScenarioProbe />
        {child}
      </>
    ));
    fireEvent.click(within(panel()).getByRole("button", { name: /Scarce beds/ }));
    const dialog = screen.getByRole("dialog", { name: "Load Scarce beds?" });
    expect(dialog).toHaveTextContent("This replaces the demo data in this browser only");
    expect(screen.getByTestId("scenario")).toHaveTextContent("standard");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("scenario")).toHaveTextContent("standard");
    expect(status()).toHaveTextContent("");
  });

  it("says it reaches everyone in the workspace when the demo is shared", () => {
    function Shared({ children }: { children: ReactNode }) {
      const value = useWardFlow();
      return (
        <WardFlowOverride
          value={{ ...value, shared: { status: "ready", error: null, ...value.shared, enabled: true } }}
        >
          {children}
        </WardFlowOverride>
      );
    }
    renderPanel((child) => <Shared>{child}</Shared>);
    fireEvent.click(screen.getByTestId("ward-tools-demo-reset"));
    const dialog = screen.getByRole("dialog", { name: "Reset the demo?" });
    expect(dialog).toHaveTextContent("replaces the demo data for everyone in this workspace");
    expect(dialog).not.toHaveTextContent("this browser only");
  });

  it("says nothing changed when the reset is refused", () => {
    function Refusing({ children }: { children: ReactNode }) {
      const value = useWardFlow();
      return (
        <WardFlowOverride
          value={{ ...value, dispatch: () => ({ commandId: "c-1", status: "refused", message: "No" }) }}
        >
          {children}
        </WardFlowOverride>
      );
    }
    renderPanel((child) => <Refusing>{child}</Refusing>);
    fireEvent.click(screen.getByTestId("ward-tools-demo-reset"));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Reset demo" }));
    expect(status()).toHaveTextContent("The demo was not reset. Nothing changed.");
    expect(status()).not.toHaveTextContent("Demo reset to the start");
  });
  it("says the reset is not confirmed when a shared save fails, rather than promising nothing changed", () => {
    function Failing({ children }: { children: ReactNode }) {
      const value = useWardFlow();
      return (
        <WardFlowOverride value={{ ...value, dispatch: () => ({ commandId: "c-2", status: "failed" }) }}>
          {children}
        </WardFlowOverride>
      );
    }
    renderPanel((child) => <Failing>{child}</Failing>);
    fireEvent.click(screen.getByTestId("ward-tools-demo-reset"));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Reset demo" }));
    expect(status()).toHaveTextContent("The reset was not confirmed.");
    expect(status()).not.toHaveTextContent("Nothing changed");
  });
});
