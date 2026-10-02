import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WardDynamicIsland, type DynamicIslandMetric } from "@/components/ward-management/shell/ward-dynamic-island";

describe("WardDynamicIsland", () => {
  it("renders stage title, status pip, and all metrics", () => {
    const metrics: DynamicIslandMetric[] = [
      { id: "metric-overrides", label: "Overrides", value: 7, tone: "warn" },
      { id: "metric-catchment", label: "Catchment", value: 3, tone: "accent" },
      { id: "metric-acuity", label: "Acuity", value: 2, tone: "warn" },
      { id: "metric-upheld", label: "Upheld", value: 4, tone: "good" },
    ];

    render(<WardDynamicIsland title="Governance HUD" status="warning" metrics={metrics} />);

    const region = screen.getByRole("region", { name: "Governance HUD HUD" });
    expect(region).toBeDefined();

    expect(screen.getByText("Governance HUD")).toBeDefined();
    expect(screen.getByText("Overrides")).toBeDefined();
    expect(screen.getByText("7")).toBeDefined();
    expect(screen.getByText("Catchment")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
    expect(screen.getByText("Acuity")).toBeDefined();
    expect(screen.getByText("2")).toBeDefined();
    expect(screen.getByText("Upheld")).toBeDefined();
    expect(screen.getByText("4")).toBeDefined();
  });

  it("supports interactive metric buttons and handles clicks", () => {
    const handleClick = vi.fn();
    const metrics: DynamicIslandMetric[] = [
      {
        id: "btn-occupied",
        label: "Occupied",
        value: 19,
        active: true,
        onClick: handleClick,
      },
      {
        id: "btn-ready",
        label: "Ready",
        value: 2,
        active: false,
        onClick: vi.fn(),
      },
    ];

    render(<WardDynamicIsland title="Unit Status" status="nominal" metrics={metrics} />);

    const occupiedBtn = screen.getByRole("button", { name: "Occupied: 19" });
    expect(occupiedBtn.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(occupiedBtn);
    expect(handleClick).toHaveBeenCalledTimes(1);

    const readyBtn = screen.getByRole("button", { name: "Ready: 2" });
    expect(readyBtn.getAttribute("aria-pressed")).toBe("false");
  });

  it("renders status pip with critical alarm animation and custom actions", () => {
    render(
      <WardDynamicIsland
        title="ED Pressure"
        status="alarm"
        statusText="2 past access target"
        metrics={[{ label: "Breaches", value: 2, tone: "danger" }]}
        actions={<button type="button">Escalate</button>}
      />,
    );

    const statusPip = screen.getByRole("status");
    expect(statusPip.getAttribute("aria-label")).toBe("Synthetic status: 2 past access target");
    expect(statusPip.getAttribute("title")).toBe("2 past access target");
    expect(screen.getByText("Escalate")).toBeDefined();
  });

  it("preserves direct label.nextElementSibling traversal to metricValue and subtext without colon element splitting", () => {
    const metrics: DynamicIslandMetric[] = [
      {
        id: "metric-active",
        label: "Active Transit Runs",
        value: 5,
        subtext: "Dispatched or In Transit",
      },
    ];

    render(<WardDynamicIsland title="Transport Dispatch" metrics={metrics} />);

    const label = screen.getByText(/Active Transit Runs/);
    const value = label.nextElementSibling;
    const sub = value?.nextElementSibling;

    expect(value?.textContent).toBe("5");
    expect(sub?.textContent).toBe("Dispatched or In Transit");
  });

  it("handles labels already ending in colons, metric units, and custom aria-labels", () => {
    const metrics: DynamicIslandMetric[] = [
      {
        id: "metric-caseload",
        label: "Caseload in Scope:",
        value: 42,
        unit: "pts",
        ariaLabel: "Total caseload: 42 patients",
      },
    ];

    render(<WardDynamicIsland title="Handover HUD" metrics={metrics} />);

    expect(screen.getByText(/Caseload in Scope/)).toBeDefined();
    expect(screen.queryByText(/Caseload in Scope::/)).toBeNull();
    expect(screen.getByText("42")).toBeDefined();
    expect(screen.getByText("pts")).toBeDefined();

    const item = screen.getByRole("listitem", { name: "Total caseload: 42 patients" });
    expect(item).toBeDefined();
  });

  it("supports alignment options and status tone styling variants", () => {
    const { container, rerender } = render(
      <WardDynamicIsland
        title="Capacity Center"
        align="center"
        status="neutral"
        metrics={[
          { label: "Critical", value: 1, tone: "critical" },
          { label: "Muted", value: 0, tone: "neutral" },
        ]}
      />,
    );

    const section = container.querySelector("section");
    expect(section?.className).toMatch(/islandWrapperCenter/);

    const neutralPip = screen.getByRole("status");
    expect(neutralPip.getAttribute("aria-label")).toBe("Synthetic status: Monitoring");

    rerender(<WardDynamicIsland title="Capacity End" align="end" metrics={[]} />);
    expect(section?.className).toMatch(/islandWrapperEnd/);
  });
});
