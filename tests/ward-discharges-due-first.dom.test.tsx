import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { DischargeBoard, groupDischarges } from "@/components/ward-management/discharges/discharge-board";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { bedReleases } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Stream A, 9 Oct 2026: a Due first sort beside the board's own default order. */
function renderBoard() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <DischargeBoard />
    </WardFlowProvider>,
  );
}

function renderedIds(group: string): string[] {
  const body = screen.getByTestId(`ward-discharge-group-${group}`);
  return [...body.querySelectorAll("tr[data-release-id]")].map((row) => row.getAttribute("data-release-id")!);
}

describe("discharges: due first sort", () => {
  it("defaults to the board's own order and offers Due first", () => {
    renderBoard();
    const sort = screen.getByRole("combobox", { name: "Sort" });
    expect(sort).toHaveValue("default");
    expect([...(sort as HTMLSelectElement).options].map((option) => option.textContent)).toEqual([
      "Default",
      "Due first",
    ]);
    const groups = groupDischarges(bedReleases, NOW_ANCHOR);
    expect(renderedIds("expected")).toEqual(groups.expected.map((release) => release.id));
  });

  it("orders each open release group by expected time, earliest first", () => {
    renderBoard();
    fireEvent.change(screen.getByRole("combobox", { name: "Sort" }), { target: { value: "due-first" } });
    const groups = groupDischarges(bedReleases, NOW_ANCHOR);
    const byId = new Map(bedReleases.map((release) => [release.id, release.expectedAt]));
    let compared = 0;
    for (const key of ["blocked", "confirmed", "expected"] as const) {
      const ids = renderedIds(key);
      expect(ids).toHaveLength(groups[key].length);
      const times = ids.map((id) => byId.get(id)!);
      expect(times).toEqual([...times].sort((a, b) => a - b));
      compared += ids.length;
    }
    expect(compared, "no open release rendered, so the order was never checked").toBeGreaterThan(1);
  });
});
