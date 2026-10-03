import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  StatisticsInsightChart,
  type InsightRow,
} from "@/components/ward-management/statistics/statistics-insight-chart";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));
const metrics = [
  { id: "wait", label: "Elapsed wait", unit: "h", note: "Open placements only." },
  { id: "count", label: "Count", unit: "people", note: "Recorded counts." },
];
const rows: InsightRow[] = [
  {
    id: "alpha",
    name: "Alpha",
    context: "North",
    values: { wait: 12, count: 3 },
    groups: ["urgent", "unplaced"],
    href: "/mockups/ward-flow/statistics/ed/alpha",
  },
  { id: "beta", name: "Beta", context: "South", values: { wait: 0, count: 0 } },
  { id: "gamma", name: "Gamma", values: { wait: null, count: null }, unavailable: "Not linked" },
  ...Array.from({ length: 4 }, (_, index) => ({
    id: `other-${index}`,
    name: `Other ${index}`,
    values: { wait: index + 1, count: index + 1 },
  })),
];
function chart() {
  return render(
    <StatisticsInsightChart
      title="Waits"
      testId="waits"
      metrics={metrics}
      rows={rows}
      groups={[
        { id: "urgent", label: "Urgent" },
        { id: "unplaced", label: "Unplaced" },
      ]}
    />,
  );
}

describe("interactive statistics insights", () => {
  it("keeps unknown and zero distinct and bounds the drawn scale", () => {
    chart();
    expect(screen.getByRole("button", { name: "Beta: 0 h" })).toBeInTheDocument();
    const unknown = screen.getByRole("button", { name: "Gamma: Not linked" });
    expect(unknown.querySelector('[class*="bar"]')).toBeNull();
    const alpha = screen.getByRole("button", { name: "Alpha: 12 h" });
    expect(alpha.querySelector<HTMLElement>('[class*="bar"]')?.style.width).toBe("80%");
  });
  it("allows selection, close and a real detail route", () => {
    chart();
    fireEvent.click(screen.getByRole("button", { name: "Alpha: 12 h" }));
    const details = within(screen.getByRole("complementary", { name: "Alpha details" }));
    expect(details.getByRole("link")).toHaveAttribute("href", rows[0].href);
    fireEvent.click(details.getByRole("button", { name: "Close chart details" }));
    expect(screen.queryByRole("complementary")).toBeNull();
  });
  it("filters overlapping operational groups without duplicating records", () => {
    chart();
    fireEvent.change(screen.getByLabelText("Waits group"), { target: { value: "urgent" } });
    expect(screen.getByRole("button", { name: "Alpha: 12 h" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Beta: 0 h" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Waits group"), { target: { value: "unplaced" } });
    expect(screen.getAllByRole("button", { name: "Alpha: 12 h" })).toHaveLength(1);
  });
  it("clears hidden selection on search and recovers from an empty search", () => {
    chart();
    fireEvent.click(screen.getByRole("button", { name: "Alpha: 12 h" }));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "nothing matches" } });
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.getByText("No matching records.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("button", { name: "Alpha: 12 h" })).toBeInTheDocument();
  });
  it("switches the measure and sorts by its values, keeping unavailable records last", () => {
    chart();
    fireEvent.change(screen.getByLabelText("Waits measure"), { target: { value: "count" } });
    fireEvent.change(screen.getByLabelText("Waits order"), { target: { value: "value" } });
    const plotted = screen.getAllByRole("button").filter((button) => button.hasAttribute("data-chart-record"));
    expect(plotted[0]).toHaveAccessibleName("Other 3: 4 people");
    expect(plotted.at(-1)).toHaveAccessibleName("Gamma: Not linked");
    expect(screen.getByText("Recorded counts.")).toBeInTheDocument();
  });
  it("exports only visible rows and retains unavailable values as absences", async () => {
    let exported: Blob | undefined;
    const create = vi.fn((blob: Blob) => {
      exported = blob;
      return "blob:chart";
    });
    vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    try {
      chart();
      fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Gamma" } });
      fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
      expect(create).toHaveBeenCalledOnce();
      const csv = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsText(exported!);
      });
      expect(csv).toContain('"Gamma","","","h","Not linked"');
      expect(csv).toContain("Synthetic current-state data");
      expect(csv).not.toContain("Alpha");
    } finally {
      click.mockRestore();
      vi.unstubAllGlobals();
    }
  });
  it("supports keyboard row navigation and returns focus after Escape or close", () => {
    chart();
    const alpha = screen.getByRole("button", { name: "Alpha: 12 h" });
    const beta = screen.getByRole("button", { name: "Beta: 0 h" });
    alpha.focus();
    fireEvent.keyDown(alpha, { key: "ArrowDown" });
    expect(beta).toHaveFocus();
    fireEvent.keyDown(beta, { key: "Home" });
    expect(alpha).toHaveFocus();
    fireEvent.click(alpha);
    const close = screen.getByRole("button", { name: "Close chart details" });
    close.focus();
    fireEvent.keyDown(close, { key: "Escape" });
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(alpha).toHaveFocus();
    fireEvent.click(alpha);
    fireEvent.click(screen.getByRole("button", { name: "Close chart details" }));
    expect(alpha).toHaveFocus();
  });
  it("offers reset only for changed controls and disables empty exports", () => {
    chart();
    expect(screen.queryByRole("button", { name: "Reset" })).toBeNull();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "absent" } });
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Reset" })).toBeNull();
  });
  it("shows operational guides only inside the measured scale and preserves urgent row meaning", () => {
    render(
      <StatisticsInsightChart
        title="Waits"
        testId="waits"
        variant="timeline"
        metrics={[
          {
            ...metrics[0],
            references: [
              { value: 24, label: "24h" },
              { value: 48, label: "48h" },
            ],
          },
        ]}
        rows={[{ ...rows[0], values: { wait: 25 }, tone: "warning" }]}
      />,
    );
    expect(screen.getByText("24h")).toBeInTheDocument();
    expect(screen.queryByText("48h")).toBeNull();
    const alpha = screen.getByRole("button", { name: "Alpha: 25 h" });
    expect(alpha).toHaveAttribute("data-tone", "warning");
    expect(alpha.querySelector<HTMLElement>('i[class*="reference"]')?.style.left).toBe("80%");
  });
  it("switches to tabular values without losing filters, missingness or selection", () => {
    chart();
    const alpha = screen.getByRole("button", { name: "Alpha: 12 h" });
    fireEvent.click(alpha);
    fireEvent.click(screen.getByRole("button", { name: "Waits data view" }));
    const table = within(screen.getByRole("table"));
    expect(table.getByRole("row", { name: /Beta/ })).toHaveTextContent("0 h");
    expect(table.getByRole("row", { name: /Gamma/ })).toHaveTextContent("Not linked");
    expect(table.getByRole("button", { name: "Alpha: 12 h" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(screen.getByRole("button", { name: "Close chart details" }), { key: "Escape" });
    expect(table.getByRole("button", { name: "Alpha: 12 h" })).toHaveFocus();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Gamma" } });
    expect(table.getAllByRole("row")).toHaveLength(2);
    fireEvent.change(screen.getByLabelText("Waits measure"), { target: { value: "count" } });
    expect(table.getByRole("columnheader", { name: "Count (people)" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Waits data view" }));
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("button", { name: "Gamma: Not linked" })).toBeInTheDocument();
  });
  it("drops removed live records from the inspector", () => {
    const view = chart();
    fireEvent.click(screen.getByRole("button", { name: "Alpha: 12 h" }));
    view.rerender(<StatisticsInsightChart title="Waits" testId="waits" metrics={metrics} rows={rows.slice(1)} />);
    expect(screen.queryByRole("complementary")).toBeNull();
  });
});
