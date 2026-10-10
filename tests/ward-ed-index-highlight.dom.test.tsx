import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EdIndex } from "@/components/ward-management/ed/ed-index";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * All EDs, v10 (10 Oct 2026): the hero carries at most five highlight chips, and the hero chips,
 * the service and status filters and the search all highlight and dim. No ED is ever hidden.
 */
function renderIndex() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <EdIndex />
    </WardFlowProvider>,
  );
}

const cards = () => screen.getAllByTestId(/^ed-index-card-/u);
const solidCards = () => cards().filter((card) => card.getAttribute("data-dim") !== "true");

describe("All EDs — hero chips", () => {
  it("has five highlight chips at most, each a pressed toggle", () => {
    renderIndex();
    const chips = within(screen.getByRole("group", { name: "Highlight people waiting" })).getAllByRole("button");
    expect(chips.length).toBeGreaterThan(0);
    expect(chips.length).toBeLessThanOrEqual(5);
    for (const chip of chips) expect(chip).toHaveAttribute("aria-pressed", "false");
  });

  it("dims EDs and people a chip does not match, keeps every ED, and clears", () => {
    renderIndex();
    const total = cards().length;
    const chip = within(screen.getByRole("group", { name: "Highlight people waiting" })).getByRole("button", {
      name: /No bed yet/u,
    });
    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(cards()).toHaveLength(total);
    expect(screen.getByTestId("ed-index-highlight-note")).toHaveTextContent("all EDs stay");

    fireEvent.click(within(screen.getByTestId("ed-index-highlight-note")).getByRole("button", { name: "Clear" }));
    expect(chip).toHaveAttribute("aria-pressed", "false");
    expect(solidCards()).toHaveLength(total);
  });
});

describe("All EDs — filters highlight and dim, they never hide", () => {
  it("keeps every ED when the status filter is Clear, dimming the ones with people waiting", () => {
    renderIndex();
    const total = cards().length;
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Status" })).getByRole("radio", { name: "Clear" }));
    expect(cards()).toHaveLength(total);
    expect(solidCards().length).toBeLessThan(total);
    expect(screen.getByTestId("ed-index-match-count")).toHaveTextContent(`${solidCards().length} of ${total} match`);
  });

  it("keeps every ED when a search matches nothing, and offers Reset", () => {
    renderIndex();
    const total = cards().length;
    fireEvent.change(screen.getByRole("searchbox", { name: /Highlight emergency departments/u }), {
      target: { value: "zzzz-no-such-ed" },
    });
    expect(cards()).toHaveLength(total);
    expect(solidCards()).toHaveLength(0);
    expect(screen.getByText("No match")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Reset filters" })[0]);
    expect(solidCards()).toHaveLength(total);
  });
});
