import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MovementsScreen } from "@/components/ward-management/movements/movements-screen";
import { resetWardAccessStoreForTests } from "@/components/ward-management/shell/ward-access-store";
import { endWardFlowBrowserSession } from "@/components/ward-management/ward-browser-data";
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
  resetWardAccessStoreForTests();
});
afterEach(() => {
  endWardFlowBrowserSession();
});

const renderMovements = () =>
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <MovementsScreen />
    </WardFlowProvider>,
  );

/** Opens the seed's largest group and returns its size and its "Show N more" row. */
function openBiggestGroup() {
  const sized = screen.getAllByTestId(/^movements-group-toggle-/).map((toggle) => ({
    toggle,
    people: Number(/(\d+)\s*(people|person)\s*$/.exec(toggle.textContent ?? "")?.[1] ?? 0),
  }));
  const biggest = sized.sort((a, b) => b.people - a.people)[0]!;
  if (biggest.toggle.getAttribute("aria-expanded") !== "true") fireEvent.click(biggest.toggle);
  const moreName = `Show ${biggest.people - 8} more`;
  return { moreName, more: screen.getByRole("button", { name: moreName }) };
}

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

  it("Show fewer folds a group opened with Show N more back to its first rows", () => {
    renderMovements();
    const { moreName, more } = openBiggestGroup();
    fireEvent.click(more);
    expect(screen.queryByRole("button", { name: moreName })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Show all \d+$/ }));
    fireEvent.click(screen.getByRole("button", { name: "Show fewer" }));
    expect(screen.getByRole("button", { name: moreName })).toBeInTheDocument();
  });

  it("Back from a movement keeps a group opened with Show N more", () => {
    window.history.pushState(null, "", "/ward-flow/movements");
    const first = renderMovements();
    const { moreName, more } = openBiggestGroup();
    fireEvent.click(more);
    first.unmount();
    window.history.pushState(null, "", "/ward-flow/people/P-1");

    window.history.replaceState(null, "", "/ward-flow/movements");
    window.dispatchEvent(new PopStateEvent("popstate"));
    renderMovements();
    expect(screen.queryByRole("button", { name: moreName })).toBeNull();
  });
});
