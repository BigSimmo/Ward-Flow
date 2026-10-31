import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EdIndex } from "@/components/ward-management/ed/ed-index";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * All EDs, v10 (10 Oct 2026): the hero carries at most five highlight chips, and the hero chips and
 * the service and status filters all highlight and dim. No ED is ever hidden. Since the October
 * 2026 design review (Josh, 31 Oct 2026) a department with nobody waiting sits on one shared line
 * (`ed-index-clear-<id>`) rather than as a card, and the keyword box is gone (D-91).
 */
function renderIndex() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <EdIndex />
    </WardFlowProvider>,
  );
}

/** Every department in the Cards view: a card for each with someone waiting, a clear-line entry for the rest. */
const cards = () => screen.getAllByTestId(/^ed-index-(card|clear)-/u);
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
      `${solidCards().length} of ${total} EDs match, sample data`,
    );
  });

  it("has no keyword box (D-91): the header search finds an ED", () => {
    renderIndex();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("keeps every ED when the filters match nothing, and offers Reset", () => {
    renderIndex();
    const total = cards().length;
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Status" })).getByRole("radio", { name: "Clear" }));
    // Each service count applies the other filters, so a service at 0 leaves no ED solid.
    const empty = within(screen.getByRole("radiogroup", { name: "Health service" }))
      .getAllByRole("radio")
      .find((radio) => /\D0$/u.test(radio.textContent ?? ""));
    expect(empty).toBeDefined();
    fireEvent.click(empty!);
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

describe("All EDs — design review (Josh, 31 Oct 2026): title count and the nobody-waiting line", () => {
  const cardsOnly = () => screen.getAllByTestId(/^ed-index-card-/u);
  const clearOnly = () => screen.queryAllByTestId(/^ed-index-clear-/u);

  it("counts every department in the title, with the number that have someone waiting beside it", () => {
    renderIndex();
    const total = cards().length;
    const withWaiting = cardsOnly().length;
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(new RegExp(`\\d+ waiting across ${total} EDs`, "u"));
    expect(screen.getByText(`${withWaiting} with someone waiting`)).toBeInTheDocument();
  });

  it("puts each department with nobody waiting on one line, with its own Enter button and no card", () => {
    renderIndex();
    const line = screen.getByRole("group", { name: "Departments with no one waiting" });
    expect(within(line).getByText("No one waiting")).toBeInTheDocument();
    const clear = clearOnly();
    expect(clear.length).toBeGreaterThan(0);
    for (const entry of clear) {
      expect(line).toContainElement(entry);
      const id = entry.getAttribute("data-testid")!.replace("ed-index-clear-", "");
      expect(within(entry).getByRole("link", { name: /^Enter / })).toHaveAttribute("href", `/ward-flow/ed/${id}`);
      expect(screen.queryByTestId(`ed-index-card-${id}`)).not.toBeInTheDocument();
    }
    // Every card has someone waiting, and reads the chip's own words for forms.
    for (const card of cardsOnly()) expect(card).toHaveTextContent(/\d+ under a form/u);
  });

  it("dims the nobody-waiting departments with the filters, never hiding them", () => {
    renderIndex();
    const clearCount = clearOnly().length;
    fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Status" })).getByRole("radio", { name: "Has waiting" }),
    );
    expect(clearOnly()).toHaveLength(clearCount);
    for (const entry of clearOnly()) expect(entry).toHaveAttribute("data-dim", "true");
  });
});
