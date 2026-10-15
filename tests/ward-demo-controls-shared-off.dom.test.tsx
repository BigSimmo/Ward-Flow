import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { WardDemoReset } from "@/components/ward-management/demo-reset/ward-demo-reset";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardDemoPanel } from "@/components/ward-management/tools/ward-demo-panel";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { DEMO_CONTROLS_OFF } from "@/components/ward-management/ward-flow-raise";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * The Backend PR (#329) lets the shared workspace switch demo controls off. Every demo control then
 * shows as unavailable with its reason, instead of offering a change the server refuses.
 */

function SharedOff({ children }: { children: ReactNode }) {
  const value = useWardFlow();
  return <WardFlowOverride value={{ ...value, demoControlsAvailable: false }}>{children}</WardFlowOverride>;
}

function renderOff(node: ReactNode) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <SharedOff>{node}</SharedOff>
    </WardFlowProvider>,
  );
}

afterEach(() => {
  act(() => setWardFeatureFlagOnDevice("demo-reset", null));
});

describe("demo controls when the shared workspace switches them off", () => {
  it("are on by default on this device", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardDemoPanel />
      </WardFlowProvider>,
    );
    expect(screen.getByRole("button", { name: "+15 min" })).toBeEnabled();
    expect(screen.queryByText(DEMO_CONTROLS_OFF)).toBeNull();
  });

  it("the Tools demo panel disables its scenario, clock and reset controls and says why", () => {
    renderOff(<WardDemoPanel />);
    const note = screen.getByTestId("ward-tools-demo-off");
    expect(note).toHaveTextContent(DEMO_CONTROLS_OFF);
    for (const name of ["+15 min", "+1 hour", "Reset demo"]) {
      const button = screen.getByRole("button", { name });
      expect(button, name).toBeDisabled();
      expect(button.getAttribute("aria-describedby"), name).toBe(note.id);
    }
    for (const radio of within(screen.getByRole("radiogroup", { name: "Demo scenario" })).getAllByRole("radio")) {
      expect(radio).toBeDisabled();
    }
  });

  it("the one tap demo reset disables its choices and never opens the confirm", () => {
    act(() => setWardFeatureFlagOnDevice("demo-reset", true));
    renderOff(<WardDemoReset />);
    const off = screen.getByTestId("ward-demo-reset-off");
    const choice = screen.getByTestId("ward-demo-reset-winter-surge");
    expect(choice).toBeDisabled();
    expect(choice.getAttribute("aria-describedby")).toContain(off.id);
    fireEvent.click(choice);
    expect(screen.queryByTestId("ward-demo-reset-confirm")).toBeNull();
  });
});
