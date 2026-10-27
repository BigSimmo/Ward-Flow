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
    expect(screen.getByTestId("ed-index-match-count")).toHaveTextContent(
      `${solidCards().length} of ${total} EDs match`,
    );
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

describe("All EDs — v10 pass 3: RowSpark, preview and service bars", () => {
  it("draws a 12 hour trend on each card, ending at the card's own waiting count", () => {
    renderIndex();
    const card = screen.getByTestId("ed-index-card-arm-ed");
    const label = within(card).getByTestId("ed-row-spark").getAttribute("aria-label") ?? "";
    expect(label).toMatch(/waiting over 12 hours/u);
    const points = label.split(": ")[1]?.split(", ") ?? [];
    // Seven points (every 2 hours, the last now) and the change word.
    expect(points).toHaveLength(8);
    expect(within(card).getAllByText(/^\d+$/u, { selector: "b" })[0].textContent).toBe(points[6]);
  });

  it("opens a preview of who is waiting, with Enter pinned, and steps to the next ED", async () => {
    renderIndex();
    fireEvent.click(screen.getByTestId("ed-index-preview-arm-ed"));
    // The preview body loads lazily (phone script budget), so wait for it to draw.
    const body = await screen.findByTestId("ed-index-preview-body");
    expect(within(body).getByText("Waiting, longest first")).toBeInTheDocument();
    expect(screen.getByTestId("ed-index-preview-enter")).toHaveAttribute("href", "/ward-flow/ed/arm-ed");
    fireEvent.click(screen.getByRole("button", { name: "Next ED" }));
    expect(screen.getByTestId("ed-index-preview-enter")).not.toHaveAttribute("href", "/ward-flow/ed/arm-ed");
  });

  it("uses the Waiting by service bars as the service filter, dimming other services", () => {
    renderIndex();
    const total = cards().length;
    const bar = screen.getByTestId("ed-index-service-bar-South Metro");
    fireEvent.click(bar);
    expect(bar).toHaveAttribute("aria-pressed", "true");
    expect(cards()).toHaveLength(total);
    expect(solidCards().length).toBeGreaterThan(0);
    for (const card of solidCards()) expect(card).toHaveAttribute("data-service", "South Metro");
    fireEvent.click(bar);
    expect(solidCards()).toHaveLength(total);
  });
});
