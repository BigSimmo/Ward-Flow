import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { delayGroups, ownerOf } from "@/components/ward-management/delays/delays-derivations";

function renderDelays() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <DelaysScreen />
    </WardFlowProvider>,
  );
}

describe("the selected delay data views", () => {
  it("adds the named wait timeline before the existing radar and renders both lower sections as tables", () => {
    renderDelays();
    const timeline = screen.getByRole("region", { name: "Wait timeline" });
    const currentGraph = screen.getByRole("region", { name: "Who is holding people up" });
    expect(timeline.compareDocumentPosition(currentGraph) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(timeline).getByRole("table")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Waiting" })).getByRole("table")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "What the blocker is" })).getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Focus table/u })).toHaveAttribute("aria-selected", "true");
  });

  it("preserves patient-name search and selection when switching layouts", () => {
    renderDelays();
    const list = screen.getByTestId("delays-waiting-list");
    const first = within(list).getAllByRole("button")[0];
    const name = first.querySelector('[data-ward-primitive="record-id"]')?.textContent;
    expect(name).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox", { name: "Filter patient worklist" }), { target: { value: name } });
    expect(within(list).getAllByRole("row")).toHaveLength(1);
    fireEvent.click(within(list).getAllByRole("button")[0]);
    expect(screen.getByRole("region", { name: "Selected patient delay details" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Action workspace/u }));
    expect(screen.getByRole("searchbox", { name: "Filter patient worklist" })).toHaveValue(name);
    expect(within(screen.getByTestId("delays-waiting-list")).getAllByRole("button")[0]).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("region", { name: "Selected patient delay details" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "What the blocker is" })).toBeInTheDocument();
  });

  it("filters by the responsible team without changing the service-scope blocker totals", () => {
    renderDelays();
    const state = seedWardFlowState();
    const expectedTransport = delayGroups(state.movements, state.units, NOW_ANCHOR)
      .filter((group) => ownerOf(group.cause) === "transport")
      .reduce((sum, group) => sum + group.movements.length, 0);
    fireEvent.click(screen.getByRole("tab", { name: /Action workspace/u }));
    const queues = screen.getByRole("complementary", { name: "Responsible team queues" });
    fireEvent.click(within(queues).getByRole("button", { name: /^Transport/u }));
    expect(within(screen.getByTestId("delays-waiting-list")).getAllByRole("row")).toHaveLength(expectedTransport);
    const blockers = screen.getByRole("region", { name: "What the blocker is" });
    expect(within(blockers).getByRole("row", { name: /Total waiting/u })).toHaveTextContent(
      String(state.movements.filter(isOpen).length),
    );
  });

  it("paginates the timeline and supports keyboard switching between table layouts", () => {
    renderDelays();
    const timeline = screen.getByRole("region", { name: "Wait timeline" });
    expect(within(timeline).getByRole("button", { name: "Previous timeline page" })).toBeDisabled();
    const first = within(timeline).getAllByRole("button", { name: /^Inspect timeline/u })[0].textContent;
    fireEvent.click(within(timeline).getByRole("button", { name: "Next timeline page" }));
    expect(within(timeline).getAllByRole("button", { name: /^Inspect timeline/u })[0].textContent).not.toBe(first);
    const tab = screen.getByRole("tab", { name: /Focus table/u });
    fireEvent.keyDown(tab, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /Action workspace/u })).toHaveFocus();
    expect(screen.getByRole("tab", { name: /Action workspace/u })).toHaveAttribute("aria-selected", "true");
  });
});
