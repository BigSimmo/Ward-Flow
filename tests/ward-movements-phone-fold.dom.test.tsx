import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MovementsScreen } from "@/components/ward-management/movements/movements-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * Design audit A12 (5 Nov 2026): an open Movements group on a phone listed every row (21 in
 * "Placement requested") with no Show more. The list rule is about eight rows, then "Show N more",
 * as desktop folds. Synthetic demo data only.
 */
vi.mock("@/components/wf", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/wf")>()),
  useIsPhone: () => true,
}));

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("Movements phone groups fold", () => {
  it("shows about eight rows of an open group, then a Show N more row that opens the rest", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <MovementsScreen />
      </WardFlowProvider>,
    );
    const toggles = screen.getAllByTestId(/^movements-group-toggle-/);
    // The largest group in the seed: open it if it is not open already.
    const sized = toggles.map((toggle) => ({
      toggle,
      people: Number(/(\d+)\s*(people|person)\s*$/.exec(toggle.textContent ?? "")?.[1] ?? 0),
    }));
    const biggest = sized.sort((a, b) => b.people - a.people)[0]!;
    expect(biggest.people).toBeGreaterThan(9);
    if (biggest.toggle.getAttribute("aria-expanded") !== "true") fireEvent.click(biggest.toggle);

    const more = screen.getByRole("button", { name: `Show ${biggest.people - 8} more` });
    const block = more.parentElement!;
    expect(within(block).getAllByRole("listitem").length).toBeLessThanOrEqual(9);
    fireEvent.click(more);
    expect(screen.queryByRole("button", { name: `Show ${biggest.people - 8} more` })).toBeNull();
    expect(within(block).getAllByRole("listitem").length).toBeGreaterThanOrEqual(biggest.people);
  });
});
