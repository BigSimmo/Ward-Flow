import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
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
import { releaseBand } from "@/components/ward-management/ward-bed-availability";
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
  // Discharges redesign (approved 31 Oct 2026): a group shows its first rows, then Show more.
  const more = screen.queryByTestId(`ward-discharge-more-${group}`)?.querySelector("button");
  if (more?.getAttribute("aria-expanded") === "false") fireEvent.click(more);
  const body = screen.getByTestId(`ward-discharge-group-${group}`);
  return [...body.querySelectorAll("tr[data-release-id]")].map((row) => row.getAttribute("data-release-id")!);
}

describe("discharges: due first sort", () => {
  it("defaults to the board's own order and offers Due first", () => {
    renderBoard();
    // Discharges redesign (3 Nov 2026): Sort is a kit Menu of radio items, not a browser <select>.
    const sort = screen.getByTestId("ward-discharges-sort");
    expect(sort).toHaveAccessibleName("Sort: Default");
    fireEvent.click(sort);
    const menu = screen.getByRole("menu");
    const items = within(menu).getAllByRole("menuitemradio");
    expect(items.map((item) => item.textContent)).toEqual(["Default", "Due first"]);
    expect(within(menu).getByRole("menuitemradio", { name: "Default" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(sort);
    const groups = groupDischarges(bedReleases, NOW_ANCHOR, { heldUpAnyDate: true });
    expect(renderedIds("expected")).toEqual(groups.expected.map((release) => release.id));
  });

  it("orders each open release group by expected time, earliest first", () => {
    renderBoard();
    fireEvent.click(screen.getByTestId("ward-discharges-sort"));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Due first" }));
    expect(screen.getByTestId("ward-discharges-sort")).toHaveAccessibleName("Sort: Due first");
    const groups = groupDischarges(bedReleases, NOW_ANCHOR, { heldUpAnyDate: true });
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

  it("keeps stored order inside one time band, which is why the default line names bands only", () => {
    const open = groupDischarges(bedReleases, NOW_ANCHOR, { heldUpAnyDate: true }).expected[0]!;
    const later = { ...open, id: "band-later", expectedAt: open.expectedAt + 1 };
    const earlier = { ...open, id: "band-earlier", expectedAt: open.expectedAt };
    expect(releaseBand(later, NOW_ANCHOR)).toBe(releaseBand(earlier, NOW_ANCHOR));
    // The later time is stored first, and the default order leaves it first.
    const ids = groupDischarges([later, earlier], NOW_ANCHOR).expected.map((release) => release.id);
    expect(ids).toEqual(["band-later", "band-earlier"]);
  });
});
