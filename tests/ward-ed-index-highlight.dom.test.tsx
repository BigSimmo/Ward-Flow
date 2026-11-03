import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EdIndex } from "@/components/ward-management/ed/ed-index";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * All EDs, v10 (10 Oct 2026): the hero carries at most five highlight chips. Diagnosed issues E1
 * (Josh, 3 Nov 2026) replaced v10 rule 5: the hero chips and the service and status filters now hide
 * the EDs they leave out, and a "Showing" line says what is shown and in what order. Since the October
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

describe("All EDs — hero chips", () => {
  it("has five highlight chips at most, each a pressed toggle", () => {
    renderIndex();
    const chips = within(screen.getByRole("group", { name: "Highlight people waiting" })).getAllByRole("button");
    expect(chips.length).toBeGreaterThan(0);
    expect(chips.length).toBeLessThanOrEqual(5);
    for (const chip of chips) expect(chip).toHaveAttribute("aria-pressed", "false");
  });

  it("hides EDs a chip does not match, says so, and clears", () => {
    renderIndex();
    const total = cards().length;
    const chip = within(screen.getByRole("group", { name: "Highlight people waiting" })).getByRole("button", {
      name: /Past 24h/u,
    });
    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(cards().length).toBeLessThan(total);
    expect(cards().length).toBeGreaterThan(0);
    expect(screen.getByTestId("ed-index-highlight-note")).toHaveTextContent("the rest are hidden");

    fireEvent.click(within(screen.getByTestId("ed-index-highlight-note")).getByRole("button", { name: "Clear" }));
    expect(chip).toHaveAttribute("aria-pressed", "false");
    expect(cards()).toHaveLength(total);
  });
});

describe("All EDs — filters hide what they leave out (E1, 3 Nov 2026)", () => {
  it("shows only the clear EDs when the status filter is Clear, and says how many", () => {
    renderIndex();
    const total = cards().length;
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Status" })).getByRole("radio", { name: "Clear" }));
    expect(cards().length).toBeLessThan(total);
    expect(screen.queryAllByTestId(/^ed-index-card-/u)).toHaveLength(0);
    expect(screen.getByTestId("ed-index-match-count")).toHaveTextContent(
      `Showing ${cards().length} of ${total} EDs · Clear`,
    );
  });

  it("has no keyword box (D-91): the header search finds an ED", () => {
    renderIndex();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    // "/" is left for the header search.
    const slash = new KeyboardEvent("keydown", { key: "/", bubbles: true, cancelable: true });
    window.dispatchEvent(slash);
    expect(slash.defaultPrevented).toBe(false);
  });

  it("says No match when the filters match nothing, and Clear filters brings every ED back", () => {
    renderIndex();
    const total = cards().length;
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Status" })).getByRole("radio", { name: "Clear" }));
    // Each service count applies the other filters, so a service at 0 leaves no ED shown.
    const empty = within(screen.getByRole("radiogroup", { name: "Health service" }))
      .getAllByRole("radio")
      .find((radio) => /\D0$/u.test(radio.textContent ?? ""));
    expect(empty).toBeDefined();
    fireEvent.click(empty!);
    expect(screen.queryAllByTestId(/^ed-index-(card|clear)-/u)).toHaveLength(0);
    expect(screen.getByText("No match")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Clear filters" })[0]);
    expect(cards()).toHaveLength(total);
  });

  it("numbers each card by its place in the chosen order", () => {
    renderIndex();
    const ranks = screen.getAllByTestId(/^ed-index-card-/u).map((card) => card.querySelector("h2")?.textContent ?? "");
    ranks.forEach((title, index) => expect(title.startsWith(String(index + 1))).toBe(true));
    expect(screen.getByTestId("ed-index-match-count")).toHaveTextContent("Sorted longest wait first");
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

  it("opens on Waiting by ED, whose bars open that ED's preview", async () => {
    renderIndex();
    expect(screen.getByRole("heading", { name: "Waiting by ED" })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("ed-index-ed-bar-arm-ed"));
    await screen.findByTestId("ed-index-preview-body");
    expect(screen.getByTestId("ed-index-preview-enter")).toHaveAttribute("href", "/ward-flow/ed/arm-ed");
  });

  it("switches to Waiting by service, whose bars filter to one service and clear again", () => {
    renderIndex();
    const total = cards().length;
    fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Waiting by" })).getByRole("radio", { name: "By service" }),
    );
    const bar = screen.getByTestId("ed-index-service-bar-South Metro");
    fireEvent.click(bar);
    expect(bar).toHaveAttribute("aria-pressed", "true");
    expect(cards().length).toBeGreaterThan(0);
    expect(cards().length).toBeLessThan(total);
    for (const card of cards()) expect(card).toHaveAttribute("data-service", "South Metro");
    fireEvent.click(bar);
    expect(cards()).toHaveLength(total);
  });

  it("steps the preview only through the EDs the filters show", async () => {
    renderIndex();
    fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Waiting by" })).getByRole("radio", { name: "By service" }),
    );
    fireEvent.click(screen.getByTestId("ed-index-service-bar-South Metro"));
    const shownIds = cards().map((card) => card.getAttribute("data-testid")?.replace(/^ed-index-(card|clear)-/u, ""));
    expect(shownIds.length).toBeGreaterThan(1);
    fireEvent.click(screen.getByTestId(`ed-index-preview-${shownIds[0]}`));
    await screen.findByTestId("ed-index-preview-body");
    for (let step = 0; step < shownIds.length + 1; step += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Next ED" }));
      const href = screen.getByTestId("ed-index-preview-enter").getAttribute("href") ?? "";
      expect(shownIds).toContain(href.replace("/ward-flow/ed/", ""));
    }
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

  it("hides the nobody-waiting departments when the filter is Has waiting (E1)", () => {
    renderIndex();
    expect(clearOnly().length).toBeGreaterThan(0);
    fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Status" })).getByRole("radio", { name: "Has waiting" }),
    );
    expect(clearOnly()).toHaveLength(0);
  });
});
