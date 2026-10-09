import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";
import { delayGroups, legalDeadlineMinutes, ownerOf } from "@/components/ward-management/delays/delays-derivations";
import { OVER_8H, boardRows, isPinned, runwayBins } from "@/components/ward-management/delays/delays-board-model";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { showEveryDelayRow } from "./helpers/delays-interactions";
import { installMatchMediaStub } from "./setup/jsdom.setup";

/**
 * The Delays board's data views (approved Delays page mockup, October 2026): the waiting table with
 * its row timeline, the search box, the Longest wait order, and the three graphs under the table.
 * Each graph highlights the same table rather than opening a view of its own, so every case below
 * checks the TABLE after pressing something in a graph.
 *
 * This replaces the PR 48 Focus table / Action workspace layouts, their pagination and the
 * separate wait timeline table, which the approved mockup removed.
 */

const state = seedWardFlowState();
const OPEN = state.movements.filter(isOpen);
const GROUPS = delayGroups(state.movements, allUnits(), NOW_ANCHOR);
const ROWS = boardRows(GROUPS, NOW_ANCHOR);

function renderDelays() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <DelaysScreen />
    </WardFlowProvider>,
  );
}

function waiting(): HTMLElement {
  return screen.getByRole("region", { name: "Waiting" });
}

function listed(): string[] {
  return within(waiting())
    .queryAllByTestId(/^delays-select-/u)
    .map((node) => (node.getAttribute("data-testid") ?? "").replace("delays-select-", ""));
}

function graphs(): HTMLElement {
  return screen.getByRole("region", { name: "Delay graphs" });
}

function expectHighlight(expectedIds: Set<string>): void {
  showEveryDelayRow();
  expect(listed().sort()).toEqual(OPEN.map((movement) => movement.id).sort());
  expect(screen.getByTestId("delays-shown-count").textContent).toBe(`${expectedIds.size} of ${OPEN.length}`);
  for (const row of ROWS) {
    expect(screen.getByTestId(`delays-row-${row.movement.id}`)).toHaveAttribute(
      "data-delays-row-matches",
      expectedIds.has(row.movement.id) ? "true" : "false",
    );
  }
}

describe("the Delays board's data views", () => {
  it("has the populations the cases below need, or they prove nothing", () => {
    expect(OPEN.length).toBeGreaterThan(20);
    expect(
      ROWS.some((row) => row.waited >= OVER_8H),
      "nobody has waited 8h",
    ).toBe(true);
    expect(OPEN.some((movement) => legalDeadlineMinutes(movement, NOW_ANCHOR) !== undefined)).toBe(true);
    expect(
      runwayBins(ROWS).some((bin) => bin.ids.size > 0),
      "nothing crosses a line in the next 4 hours, so the runway has nothing to filter",
    ).toBe(true);
  });

  it("opens a timeline under the chosen row, naming arrival, now, and any recorded legal time", () => {
    renderDelays();
    const withDue = ROWS.filter((row) => row.dueIn !== undefined && row.dueIn >= 0)[0];
    expect(withDue, "no open person carries a future legal time").toBeDefined();
    showEveryDelayRow();
    fireEvent.click(screen.getByTestId(`delays-select-${withDue.movement.id}`));
    const timeline = screen.getByTestId(`delays-row-timeline-${withDue.movement.id}`);
    expect(timeline).toHaveTextContent(/Arrived, /u);
    expect(timeline).toHaveTextContent(/Now/u);
    expect(timeline).toHaveTextContent(new RegExp(`Form ${withDue.movement.legalForm!.code} due`, "u"));
    expect(screen.getByTestId(`delays-select-${withDue.movement.id}`)).toHaveAttribute("aria-expanded", "true");

    // Choosing the same row again closes it; only one row's timeline is ever open.
    fireEvent.click(screen.getByTestId(`delays-select-${withDue.movement.id}`));
    expect(screen.queryByTestId(`delays-row-timeline-${withDue.movement.id}`)).toBeNull();
  });

  it("finds a person by name, and the count follows", () => {
    renderDelays();
    showEveryDelayRow();
    const first = within(waiting()).getAllByTestId(/^delays-select-/u)[0];
    const name = first.querySelector("b")?.textContent ?? "";
    expect(name, "the first row shows no name").not.toBe("");
    fireEvent.change(screen.getByRole("searchbox", { name: "Find a person or ED" }), { target: { value: name } });
    const matching = new Set(
      ROWS.filter((row) => resolveSubjectPatient(row.movement, state).formalName === name).map(
        (row) => row.movement.id,
      ),
    );
    expect(matching.size, "the search matched nobody").toBeGreaterThanOrEqual(1);
    expectHighlight(matching);
  });

  it("Longest wait lists pinned recorded legal times first, then everyone else longest first", () => {
    renderDelays();
    fireEvent.click(screen.getByRole("button", { name: "Longest wait" }));
    const ids = listed();
    expect(ids).toHaveLength(OPEN.length);
    const byId = new Map<string, (typeof ROWS)[number]>(ROWS.map((row) => [row.movement.id, row]));
    const pinned = ids.filter((id) => isPinned(byId.get(id)!));
    expect(ids.slice(0, pinned.length), "a pinned legal time is not at the top").toEqual(pinned);
    const rest = ids.slice(pinned.length).map((id) => byId.get(id)!.waited);
    expect(rest, "everyone else is not longest wait first").toEqual([...rest].sort((a, b) => b - a));
  });

  it("the spread graph's lane label filters the table to that owner", () => {
    renderDelays();
    const lane = within(graphs()).getByRole("button", { name: /^Wards\b/u });
    fireEvent.click(lane);
    const expected = new Set(
      ROWS.filter((row) => ownerOf(row.cause) === "wards").map((row) => row.movement.id),
    );
    expectHighlight(expected);
    expect(lane).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("delays-owner-wards"), "the tile and the lane disagree").toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("never draws two people's dots on the same spot, however many share a wait", () => {
    // Fourteen people with the same wait: more than the eleven slots the first version searched.
    const base = OPEN.find((movement) => movement.acceptedUnitId === undefined)!;
    const crowd = Array.from({ length: 14 }, (_, index) => ({
      ...base,
      id: `WF-CROWD-${index}` as typeof base.id,
      patientId: undefined,
    }));
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DelaysScreen movements={crowd} />
      </WardFlowProvider>,
    );
    const spots = [...graphs().querySelectorAll<HTMLElement>("button[aria-label*='waited']")].map(
      (dot) => `${dot.style.left}|${dot.style.top}`,
    );
    expect(spots).toHaveLength(crowd.length);
    expect(new Set(spots).size, "two dots overlap").toBe(spots.length);
  });

  it("keeps the table's column headers and cell roles, which the phone card layout relies on", () => {
    renderDelays();
    const table = within(waiting()).getByRole("table");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((th) => th.textContent),
    ).toEqual(["Person", "Waited", "T", "Wards", "Legal", "Last update"]);
    const people = within(table).getAllByTestId(/^delays-select-/u);
    expect(people.length).toBeGreaterThan(0);
    for (const person of people) {
      expect(within(person.closest("tr")!).getAllByRole("cell"), "a person's row lost its cells").toHaveLength(6);
    }
  });

  it("a dot on the spread graph opens that person's row and panel", () => {
    renderDelays();
    const target = ROWS.find((row) => row.cause === "awaiting_transport")!;
    expect(target, "nobody is awaiting transport").toBeDefined();
    const dots = within(graphs()).getAllByRole("button", { pressed: false });
    const row = within(waiting()).queryByTestId(`delays-select-${target.movement.id}`);
    expect(row, "transport starts folded, so this proves the dot unfolds it").toBeNull();
    const name = resolveSubjectPatient(target.movement, state).formalName;
    const dot = dots.find((button) => (button.getAttribute("aria-label") ?? "").startsWith(`${name}, waited`));
    expect(dot, `no spread dot names ${target.movement.id}`).toBeDefined();
    fireEvent.click(dot!);
    expect(screen.getByRole("region", { name: "Why this person is waiting" })).toBeInTheDocument();
    const opened = within(waiting())
      .getAllByTestId(/^delays-select-/u)
      .find((button) => button.getAttribute("aria-expanded") === "true");
    expect(opened, "no row opened from the dot").toBeDefined();
    expect(opened, "the dot opened somebody else's row").toHaveAttribute(
      "data-testid",
      `delays-select-${target.movement.id}`,
    );
  });

  it("a half hour on the runway filters to who crosses a line in it, and switches to Longest wait", () => {
    renderDelays();
    fireEvent.click(within(graphs()).getByRole("tab", { name: "Next 4 hours" }));
    const bins = runwayBins(ROWS);
    const busy = bins.find((bin) => bin.ids.size > 0)!;
    const column = within(graphs()).getAllByRole("button", { name: /cross 8h/u })[busy.index];
    fireEvent.click(column);
    expect(column).toHaveAttribute("aria-pressed", "true");
    expectHighlight(busy.ids);
    expect(screen.getByRole("button", { name: "Longest wait" })).toHaveAttribute("aria-pressed", "true");
    expect(within(graphs()).getByText(/highlighted in the table/u)).toBeInTheDocument();
  });

  it("a matrix cell filters to that catchment and owner, and pressing it again clears both", () => {
    renderDelays();
    fireEvent.click(within(graphs()).getByRole("tab", { name: "Where and whose move" }));
    const cell = within(graphs()).getByRole("button", { name: /^East Metro, Yours: \d+ waiting/u });
    const count = Number(/: (\d+) waiting/u.exec(cell.getAttribute("aria-label") ?? "")?.[1]);
    expect(count, "nobody is in that cell").toBeGreaterThan(0);
    fireEvent.click(cell);
    const expected = new Set(
      ROWS.filter((row) => row.origin === "East Metro" && row.owner === "yours").map((row) => row.movement.id),
    );
    expect(expected.size).toBe(count);
    expectHighlight(expected);
    expect(screen.getByRole("button", { name: "Remove filter East Metro" })).toBeInTheDocument();
    fireEvent.click(within(graphs()).getByRole("button", { name: /^East Metro, Yours: \d+ waiting/u }));
    expect(screen.getByTestId("delays-shown-count").textContent).toBe(`${OPEN.length} of ${OPEN.length}`);
  });

  it("opening a person from the rail keeps them on the table even when a filter would not match", () => {
    renderDelays();
    const topQuiet = ROWS.filter((row) => row.silent)
      .sort((a, b) => b.quiet - a.quiet)
      .slice(0, 7);
    const target = topQuiet.find((row) => !row.locked);
    expect(target, "every one of the quietest needs a locked bed, so the filter cannot hide them").toBeDefined();
    showEveryDelayRow();
    const name = screen.getByTestId(`delays-select-${target!.movement.id}`).querySelector("b")?.textContent ?? "";
    expect(name).not.toBe("");

    fireEvent.click(screen.getByRole("button", { name: /^Locked bed \d+$/u }));
    expect(within(waiting()).getByTestId(`delays-select-${target!.movement.id}`)).toBeInTheDocument();

    const rail = screen.getByRole("region", { name: "Escalations and resolved" });
    const button = within(rail)
      .getAllByRole("button")
      .find((candidate) => candidate.textContent?.startsWith(name));
    expect(button, "the person is not in Longest quiet").toBeDefined();
    fireEvent.click(button!);

    expect(screen.getByTestId(`delays-select-${target!.movement.id}`)).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId(`delays-detail-${target!.movement.id}`)).toBeInTheDocument();
  });

  it("on a phone or tablet, opening a person from the rail moves focus to their sheet", () => {
    installMatchMediaStub(true);
    const frame = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    try {
      renderDelays();
      const rail = screen.getByRole("region", { name: "Escalations and resolved" });
      const quietButton = within(rail)
        .getAllByRole("button")
        .find(
          (button) => button.closest("section") === rail && /Waiting on you|Awaiting/u.test(button.textContent ?? ""),
        );
      expect(quietButton, "Longest quiet lists nobody").toBeDefined();
      fireEvent.click(quietButton!);
      const sheet = screen.getByRole("region", { name: "Why this person is waiting" });
      expect(sheet.contains(document.activeElement), "focus stayed on the covered table").toBe(true);
      // The sheet is in the shared modal stack, which answers Escape at the window.
      fireEvent.keyDown(window, { key: "Escape" });
      expect(screen.queryByRole("region", { name: "Why this person is waiting" })).toBeNull();
    } finally {
      frame.mockRestore();
      installMatchMediaStub(false);
    }
  });

  it("a blocker filter that stopped applying stays gone when its people come back", () => {
    const wf018 = OPEN.find((movement) => movement.id === "WF-018")!;
    const view = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DelaysScreen movements={OPEN} />
      </WardFlowProvider>,
    );
    fireEvent.click(within(graphs()).getByRole("tab", { name: "Where and whose move" }));
    fireEvent.click(within(graphs()).getByRole("button", { name: "Blocker" }));
    fireEvent.click(within(graphs()).getByRole("button", { name: /, Family: 1 waiting/u }));
    expect(screen.getByTestId("delays-shown-count").textContent).toBe(`1 of ${OPEN.length}`);

    const without = OPEN.filter((movement) => movement.id !== wf018.id);
    view.rerender(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DelaysScreen movements={without} />
      </WardFlowProvider>,
    );
    view.rerender(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DelaysScreen movements={OPEN} />
      </WardFlowProvider>,
    );
    // The catchment half of the cell's filter still applies; the blocker half must not return.
    expect(
      screen.queryByRole("button", { name: /^Remove filter Patient or family$/u }),
      "the emptied blocker filter came back",
    ).toBeNull();
    const sameOrigin = ROWS.filter((row) => row.origin === ROWS.find((r) => r.movement.id === wf018.id)!.origin);
    expect(screen.getByTestId("delays-shown-count").textContent).toBe(`${sameOrigin.length} of ${OPEN.length}`);
  });

  it("a filter that does not match the open person keeps their panel open beside a dimmed row", () => {
    renderDelays();
    const open = ROWS.find((row) => !row.locked)!;
    showEveryDelayRow();
    fireEvent.click(screen.getByTestId(`delays-select-${open.movement.id}`));
    expect(screen.getByTestId(`delays-detail-${open.movement.id}`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Locked bed \d+$/u }));
    expect(screen.getByTestId(`delays-detail-${open.movement.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`delays-row-${open.movement.id}`)).toHaveAttribute("data-delays-row-matches", "false");
    fireEvent.click(screen.getByRole("button", { name: /^Locked bed \d+$/u }));
    showEveryDelayRow();
    expect(screen.queryByTestId(`delays-detail-${open.movement.id}`), "the panel stayed open after clearing").toBeNull();
  });

  it("a headline count with nobody behind it is plain text, never a button that empties the table", () => {
    const short = OPEN.filter((movement) => NOW_ANCHOR - movement.openedAt < OVER_8H);
    expect(short.length, "nobody has waited under 8h").toBeGreaterThan(0);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DelaysScreen movements={short} />
      </WardFlowProvider>,
    );
    for (const id of ["delays-stat-over8", "delays-stat-over24"]) {
      expect(screen.getByTestId(id).tagName, `${id} is a button at zero`).not.toBe("BUTTON");
    }
  });

  it("moves between people with the arrow keys, Home and End", () => {
    renderDelays();
    const people = within(waiting()).getAllByTestId(/^delays-select-/u);
    people[0].focus();
    fireEvent.keyDown(people[0], { key: "ArrowDown" });
    expect(people[1]).toHaveFocus();
    fireEvent.keyDown(people[1], { key: "End" });
    expect(people[people.length - 1]).toHaveFocus();
    fireEvent.keyDown(people[people.length - 1], { key: "Home" });
    expect(people[0]).toHaveFocus();
    fireEvent.keyDown(people[0], { key: "ArrowUp" });
    expect(people[0]).toHaveFocus();
  });

  it("Escape closes the panel and returns focus to the row that opened it", () => {
    const frame = (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    };
    const original = window.requestAnimationFrame;
    window.requestAnimationFrame = frame;
    try {
      renderDelays();
      const person = within(waiting()).getAllByTestId(/^delays-select-/u)[0];
      fireEvent.click(person);
      expect(screen.getByRole("region", { name: "Why this person is waiting" })).toBeInTheDocument();
      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.queryByRole("region", { name: "Why this person is waiting" })).toBeNull();
      expect(within(waiting()).getAllByTestId(/^delays-select-/u)[0]).toHaveFocus();
    } finally {
      window.requestAnimationFrame = original;
    }
  });
});
