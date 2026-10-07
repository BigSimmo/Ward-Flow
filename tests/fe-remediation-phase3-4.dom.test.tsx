import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WardFlowProvider, useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { WardBoard } from "@/components/ward-management/board/ward-board";
import { SettingsScreen } from "@/components/ward-management/settings/settings-screen";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

describe("Phase 3 & 4 Front-End Ergonomics Remediation", () => {
  it("exposes now reactively and via getter without throwing", () => {
    function TestConsumer() {
      const { now: contextNow } = useWardFlow();
      const clockNow = useWardFlowClock();
      return (
        <div>
          <span data-testid="context-now">{contextNow}</span>
          <span data-testid="clock-now">{clockNow}</span>
        </div>
      );
    }

    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <TestConsumer />
      </WardFlowProvider>,
    );

    expect(screen.getByTestId("context-now").textContent).toBe(String(NOW_ANCHOR));
    expect(screen.getByTestId("clock-now").textContent).toBe(String(NOW_ANCHOR));
  });

  it("does not flag out-of-service beds with alert state when count is 0 on Dabakarn", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardBoard unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );

    const blockedFigure = screen.getByTestId("ward-board-figure-blockedBeds");
    expect(blockedFigure).toBeInTheDocument();
    expect(blockedFigure.querySelector("dd")?.textContent).toBe("0");
    // Crucial: data-has-alert must not be true when count is 0
    expect(blockedFigure.getAttribute("data-has-alert")).toBeNull();
  });

  it("renders storage quota without ISMP trailing zeros (5 MB, not 5.0 MB)", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <SettingsScreen />
      </WardFlowProvider>,
    );

    // Matches e.g. "48 KB of 5 MB (1%)"
    expect(screen.getByText(/of 5 MB/i)).toBeInTheDocument();
    expect(screen.queryByText(/5\.0 MB/i)).toBeNull();
  });

  it("provides accessible aria-label on icon-only reset default buttons in Settings", async () => {
    const { fireEvent } = await import("@testing-library/react");
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <SettingsScreen />
      </WardFlowProvider>,
    );

    const editBtn = screen.getByRole("button", { name: /Edit Defaults/i });
    fireEvent.click(editBtn);

    const firstInput = screen.getAllByLabelText(/Edit /i)[0];
    expect(firstInput).toBeInTheDocument();
    fireEvent.change(firstInput, { target: { value: "modified-value-999" } });

    const resetBtn = screen.getByRole("button", { name: /Reset ".*" to standard default/i });
    expect(resetBtn).toBeInTheDocument();
    expect(resetBtn.getAttribute("aria-label")).toMatch(/^Reset ".*" to standard default$/);
  });
});
