/**
 * A loaded world with typed text is not saved on this device; the Demo panel says so in plain
 * words and how to keep it (stress test 25 Oct 2026). Synthetic only.
 */
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { WardDemoPanel } from "@/components/ward-management/tools/ward-demo-panel";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/capacity",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function Saving({ on, children }: { on: boolean; children: ReactNode }) {
  const value = useWardFlow();
  return <WardFlowOverride value={{ ...value, savingOnDevice: on }}>{children}</WardFlowOverride>;
}

function renderPanel(on: boolean) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Saving on={on}>
        <WardDemoPanel />
      </Saving>
    </WardFlowProvider>,
  );
}

describe("Demo panel: a world that is not saved on this device", () => {
  it("says a reload loses it and to save it to a file", () => {
    renderPanel(false);
    const note = screen.getByTestId("ward-tools-device-save-paused");
    expect(note).toHaveTextContent("Not saved on this device, because this world holds typed text.");
    expect(note).toHaveTextContent("Reloading loses it, so use Save to file to keep it.");
    expect(note).not.toHaveTextContent("D-18");
  });

  it("shows nothing while the device is saving", () => {
    renderPanel(true);
    expect(screen.queryByTestId("ward-tools-device-save-paused")).toBeNull();
  });
});
