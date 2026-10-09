import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WardTasksDrawer } from "@/components/ward-management/ward-tasks-drawer";
import { buildActionInbox, isOpen, type InboxItem } from "@/components/ward-management/ward-derivations";
import { inboxItemIsActNow, seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Stream A, 9 Oct 2026: take ownership, snooze with a reason and a return time, the Snoozed
 * section, the acknowledgement's "who", and the Due first sort — on the Tasks drawer that
 * `shell/ward-bar.tsx` mounts. The reducer refusals are pinned in `ward-inbox-snooze.test.ts`.
 */

const seed = seedWardFlowState();
const items = buildActionInbox(seed.movements.filter(isOpen), NOW_ANCHOR, seed.units);
const red = items.find((item) => inboxItemIsActNow(item.id) && item.tone === "danger")!;

function renderDrawer(overrides: Partial<Parameters<typeof WardTasksDrawer>[0]> = {}) {
  const dispatch = vi.fn();
  render(
    <WardTasksDrawer
      items={items}
      acknowledgements={{}}
      completions={{}}
      role="coordinator"
      now={NOW_ANCHOR}
      dispatch={dispatch}
      onClose={vi.fn()}
      onSelectMovement={vi.fn()}
      {...overrides}
    />,
  );
  return { dispatch, drawer: screen.getByRole("complementary", { name: "Tasks" }) };
}

function openSnooze(drawer: HTMLElement, item: InboxItem) {
  const trigger = within(drawer)
    .getAllByRole("button", { name: new RegExp(`^Snooze ${item.title}`) })
    .at(0)!;
  fireEvent.click(trigger);
  return screen.getByRole("group", { name: "Back in" });
}

describe("tasks drawer: ownership and snooze", () => {
  it("has a red act-now row to work with", () => {
    expect(red, "the seed produced no red act-now row").toBeDefined();
  });

  it("takes ownership as the current role", () => {
    const { dispatch } = renderDrawer();
    fireEvent.click(screen.getByTestId(`ward-task-own-${red.id}`));
    expect(dispatch).toHaveBeenCalledWith({
      type: "TAKE_INBOX_ITEM_OWNERSHIP",
      role: "coordinator",
      now: NOW_ANCHOR,
      inboxItemId: red.id,
    });
  });

  it("needs a reason, then snoozes for 30m, and holds a red row to 1h at most", () => {
    const { dispatch, drawer } = renderDrawer();
    const presets = openSnooze(drawer, red);
    fireEvent.click(within(presets).getByRole("button", { name: /^30m/ }));
    expect(dispatch).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole("combobox", { name: "Reason" }), { target: { value: "awaiting_call_back" } });
    const fourHours = within(presets).getByRole("button", { name: /^4h/ });
    expect(fourHours).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(fourHours);
    expect(dispatch).not.toHaveBeenCalled();

    fireEvent.click(within(presets).getByRole("button", { name: /^30m/ }));
    expect(dispatch).toHaveBeenCalledWith({
      type: "SNOOZE_INBOX_ITEM",
      role: "coordinator",
      now: NOW_ANCHOR,
      inboxItemId: red.id,
      until: NOW_ANCHOR + 30,
      reason: "awaiting_call_back",
    });
  });

  it("moves a snoozed row into the Snoozed section with who and why, and returns it on request", () => {
    const { dispatch, drawer } = renderDrawer({
      snoozes: {
        [red.id]: [
          {
            at: NOW_ANCHOR,
            by: "Flow coordinator",
            kind: "snoozed",
            until: NOW_ANCHOR + 30,
            reason: "awaiting_call_back",
          },
        ],
      },
    });
    expect(within(drawer).queryByTestId(`ward-task-own-${red.id}`)).toBeNull();
    const snoozed = screen.getByTestId("ward-tasks-snoozed");
    expect(snoozed).toHaveTextContent(red.title);
    expect(snoozed).toHaveTextContent(/Back .* · Awaiting call back · Flow coordinator/i);
    fireEvent.click(screen.getByTestId(`ward-task-unsnooze-${red.id}`));
    expect(dispatch).toHaveBeenCalledWith({
      type: "UNSNOOZE_INBOX_ITEM",
      role: "coordinator",
      now: NOW_ANCHOR,
      inboxItemId: red.id,
    });
  });

  it("brings a snoozed row back once its time has passed", () => {
    renderDrawer({
      now: NOW_ANCHOR + 31,
      snoozes: {
        [red.id]: [
          {
            at: NOW_ANCHOR,
            by: "Flow coordinator",
            kind: "snoozed",
            until: NOW_ANCHOR + 30,
            reason: "awaiting_call_back",
          },
        ],
      },
    });
    expect(screen.queryByTestId("ward-tasks-snoozed")).toBeNull();
    expect(screen.getByTestId(`ward-task-own-${red.id}`)).toBeInTheDocument();
  });

  it("shows who owns a row and hides Take for the owner", () => {
    const { drawer } = renderDrawer({ ownership: { [red.id]: [{ at: NOW_ANCHOR - 5, by: "Flow coordinator" }] } });
    expect(within(drawer).queryByTestId(`ward-task-own-${red.id}`)).toBeNull();
    expect(drawer).toHaveTextContent(/Owned by Flow coordinator since/);
  });

  it("says who acknowledged a row", () => {
    const { drawer } = renderDrawer({
      acknowledgements: { [red.id]: [{ at: NOW_ANCHOR - 2, by: "Flow coordinator" }] },
    });
    expect(drawer).toHaveTextContent(/Acknowledged by Flow coordinator at/);
  });

  it("offers Due first, which puts rows with a due time ahead of rows without one", () => {
    const due = (id: string, at?: number): InboxItem => ({
      ...red,
      id: `${red.id}-${id}`,
      title: `Row ${id}`,
      dueAt: at,
    });
    renderDrawer({ items: [due("none"), due("late", NOW_ANCHOR + 90), due("soon", NOW_ANCHOR + 10)] });
    const sort = screen.getByRole("combobox", { name: "Sort tasks" });
    fireEvent.change(sort, { target: { value: "due-first" } });
    const titles = screen.getAllByText(/^Row (none|late|soon)$/).map((node) => node.textContent);
    expect(titles).toEqual(["Row soon", "Row late", "Row none"]);
  });
});
