import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => <a {...props}>{children}</a>,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow/statistics",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import {
  NetworkFigures,
  ToolsContactDirectory,
  toolsDirectoryEntries,
} from "@/components/ward-management/tools/ward-tools-workspace";
import { WardFlowProvider, useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { assertStatisticsPresentation } from "./helpers/statistics-presentation";

function AdvanceClock() {
  const { dispatch } = useWardFlow();
  const now = useWardFlowClock();
  return (
    <button onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes: 70 })}>
      Advance test clock
    </button>
  );
}

describe("visible statistics across every main mode", () => {
  it.each(["hub", "overview", "compare", "service", "ward", "ed", "community"] as const)(
    "keeps %s panels visible without explanatory disclosures",
    (mode) => assertStatisticsPresentation(mode),
  );
});

describe("whole-network tools figures", () => {
  it("keeps the full bed base on a ward route and narrows only the chosen figure category", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <NetworkFigures />
      </WardFlowProvider>,
    );
    const totalLabel = screen.getByText("Total beds");
    expect(totalLabel.parentElement?.querySelector("dd")).toHaveTextContent(
      String(allUnits().reduce((sum, unit) => sum + unit.beds, 0)),
    );
    fireEvent.click(screen.getByRole("button", { name: "Flow" }));
    expect(screen.queryByText("Total beds")).toBeNull();
    expect(screen.getByText("Admissions today")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "All figures" }));
    expect(screen.getByText("Total beds")).toBeVisible();
  });
  it("updates recorded deadline totals when the shared clock advances", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AdvanceClock />
        <NetworkFigures />
      </WardFlowProvider>,
    );
    const count = () => Number(screen.getByText("Deadline passed").parentElement?.querySelector("dd")?.textContent);
    const before = count();
    fireEvent.click(screen.getByRole("button", { name: "Advance test clock" }));
    expect(count()).toBeGreaterThan(before);
  });
});

describe("contact directory", () => {
  it("covers each ward and service, with clearly marked mock methods and retained published contacts", () => {
    const entries = toolsDirectoryEntries(allUnits());
    expect(entries.filter((entry) => entry.category === "wards").map((entry) => entry.id)).toEqual(
      allUnits().map((unit) => unit.id),
    );
    expect(new Set(entries.map((entry) => entry.category))).toEqual(
      new Set(["wards", "ed", "community", "switchboards", "coordinators", "transport", "escalation"]),
    );
    expect(entries.find((entry) => entry.name === "Bentley" && entry.category === "community")).toMatchObject({
      phone: "08 9416 3800",
      mockPhone: false,
    });
    expect(entries.every((entry) => entry.phone && entry.email)).toBe(true);
    expect(entries.filter((entry) => entry.mockEmail).every((entry) => entry.email?.endsWith("@example.invalid"))).toBe(
      true,
    );
  });
  it("combines search with contact types and never dials mock contacts", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToolsContactDirectory onNavigate={vi.fn()} />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Bed flow" }));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "north" } });
    const list = screen.getByRole("list", { name: "Contact directory" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(within(list).getByRole("link")).toHaveAttribute("href", "/mockups/ward-flow/on-call#ward-reach-bed");
    expect(list.querySelector('a[href^="tel:"]')).toBeNull();
    expect(list.querySelector('a[href^="mailto:"]')).toBeNull();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "no such contact" } });
    expect(screen.getByText("No matching contacts")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset search" }));
    expect(within(list).getAllByRole("listitem").length).toBeGreaterThan(10);
  });
});
