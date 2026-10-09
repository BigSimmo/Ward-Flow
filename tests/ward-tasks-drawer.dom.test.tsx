import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WardTasksDrawer } from "@/components/ward-management/ward-tasks-drawer";
import { buildActionInbox, isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { Movement } from "@/components/ward-management/ward-model";
import { supportNotificationTaskId } from "@/components/ward-management/ward-support-notifications";

/**
 * 🔴 **THE TASKS DRAWER HAD NO TEST OF ITS OWN UNTIL NOW, AND IT IS ON EVERY WARD ROUTE.**
 *
 * The reducer half is well covered — `ward-inbox-events.test.ts`, `ward-inbox-classification.test.ts`
 * and `ward-event-permissions.test.ts` all exercise `ACKNOWLEDGE_INBOX_ITEM` and the refusal that
 * makes acknowledge-only real. **Nothing rendered the component.** Grepped 2026-09-07: no test file
 * mentioned `WardTasksDrawer` or `ward-tasks-opener` at all.
 *
 * ⚠️ **AND IT WAS FOUND BY AN ACCIDENT WORTH RECORDING.** A verification run named
 * `tests/ward-tasks-drawer.dom.test.tsx` alongside two real files. **Vitest ran two, reported
 * "2 passed", and exited 0 — it does not complain about a named file that does not exist.** The
 * only tell was `Test Files 2` against three names given. A run that silently drops a file you
 * asked for is indistinguishable from one that ran it, unless somebody reconciles the count.
 *
 * 🔴 **WHAT THIS PINS IS THE OWNER'S RULING, TWICE GIVEN: the panel is ACKNOWLEDGE-ONLY.**
 * 2026-09-06 *"Neither — acknowledge only"*, and again on 2026-09-07 when the contradiction with his
 * own request for a tickable to-do list was put back to him: *"No I want it to be more of an
 * acknowledgement please."* A ruling recorded only in a doc comment is the artefact that has failed
 * repeatedly on this project. This is the version that reddens.
 *
 * ⚠️ **THE REDUCER IS STILL THE SAFEGUARD, NOT THIS FILE.** `COMPLETE_INBOX_ITEM` refuses anything
 * it has not classified as a commitment, structurally, whatever a screen renders. These assertions
 * cover the SCREEN's half — that a coordinator is never offered a control the reducer would refuse,
 * which is a usability and honesty property rather than a safety one.
 */

const seed = seedWardFlowState();
const items = buildActionInbox(seed.movements.filter(isOpen), NOW_ANCHOR, seed.units);

function renderDrawer(overrides: Partial<Parameters<typeof WardTasksDrawer>[0]> = {}) {
  const dispatch = vi.fn();
  const onClose = vi.fn();
  const onSelectMovement = vi.fn();
  render(
    <WardTasksDrawer
      items={items}
      acknowledgements={{}}
      completions={{}}
      role="coordinator"
      now={NOW_ANCHOR}
      dispatch={dispatch}
      onClose={onClose}
      onSelectMovement={onSelectMovement}
      {...overrides}
    />,
  );
  const drawer = screen.getByRole(overrides.withBackdrop ? "dialog" : "complementary", { name: "Tasks" });
  return { dispatch, onClose, onSelectMovement, drawer };
}

describe("the tasks drawer", () => {
  it("is announced as a modal dialog when it opens over a backdrop", () => {
    render(
      <WardTasksDrawer
        items={items}
        acknowledgements={{}}
        completions={{}}
        role="coordinator"
        now={NOW_ANCHOR}
        dispatch={vi.fn()}
        onClose={vi.fn()}
        onSelectMovement={vi.fn()}
        withBackdrop
      />,
    );
    const drawer = screen.getByRole("dialog", { name: "Tasks" });
    expect(drawer).toHaveAttribute("aria-modal", "true");
  });

  it("has rows to assert about, so nothing below passes over an empty list", () => {
    expect(items.length, "the seed produced no inbox rows — every assertion here would be vacuous").toBeGreaterThan(0);
  });

  it("renders one row per inbox item and states the count", () => {
    const { drawer } = renderDrawer();
    for (const item of items) {
      expect(within(drawer).getByTestId(`ward-task-${item.id}`), `${item.title} is missing`).toBeTruthy();
    }
    expect(screen.getByTestId("ward-tasks-drawer-count")).toHaveTextContent(String(items.length));
  });

  /**
   * 🔴 The ruling, as a check. Every category `buildActionInbox` can emit is classified `"fact"`, so
   * no row today may offer "Mark done" or "Reopen" — and every row must offer "Acknowledge".
   */
  it("offers acknowledgement on every row and completion on none", () => {
    const { drawer } = renderDrawer();
    expect(within(drawer).getAllByRole("button", { name: "Acknowledge" })).toHaveLength(items.length);
    expect(
      within(drawer).queryByRole("button", { name: /Mark done/u }),
      "a fact row is offering a control the reducer would refuse — see the owner's acknowledge-only ruling",
    ).toBeNull();
    expect(within(drawer).queryByRole("button", { name: /Reopen/u })).toBeNull();
  });

  it("dispatches an acknowledgement for the row that was clicked, and nothing else", () => {
    const { drawer, dispatch } = renderDrawer();
    fireEvent.click(within(drawer).getAllByRole("button", { name: "Acknowledge" })[0]);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "ACKNOWLEDGE_INBOX_ITEM",
      role: "coordinator",
      now: NOW_ANCHOR,
      inboxItemId: items[0].id,
    });
  });

  /**
   * ⚠️ **An acknowledged row must not read as resolved.** Acknowledging says a person has seen the
   * fact; the fact is still true, and only `buildActionInbox` no longer returning it removes the
   * row. A drawer that hid or greyed an acknowledged row would let a standing legal breach look
   * dealt with because somebody glanced at it.
   */
  it("keeps an acknowledged row in the list, and keeps its control available", () => {
    const acknowledged = {
      [items[0].id]: [{ at: NOW_ANCHOR, by: "Bed coordinator", kind: "acknowledged" as const }],
    };
    const { drawer } = renderDrawer({ acknowledgements: acknowledged });
    expect(within(drawer).getByTestId(`ward-task-${items[0].id}`)).toBeTruthy();
    expect(within(drawer).getByTestId(`ward-task-ack-${items[0].id}`)).toHaveTextContent(/Acknowledged/u);
    // Never disabled: a second acknowledgement is a distinct fact — another person is now answerable
    // too — not a repeat of the first.
    expect(within(drawer).getAllByRole("button", { name: "Acknowledge" })).toHaveLength(items.length);
    expect(screen.getByTestId("ward-tasks-drawer-count")).toHaveTextContent(String(items.length));
  });

  it("closes on its own control without dispatching anything", () => {
    const { drawer, onClose, dispatch } = renderDrawer();
    fireEvent.click(within(drawer).getByRole("button", { name: "Close tasks panel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("closes on Escape key press", () => {
    const { onClose, dispatch } = renderDrawer();
    fireEvent.keyDown(window, { key: "Escape", code: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("renders backdrop when withBackdrop is true and closes on backdrop click", () => {
    const { onClose, dispatch } = renderDrawer({ withBackdrop: true });
    const backdrop = screen.getByTestId("ward-tasks-drawer-backdrop");
    expect(backdrop).toBeInTheDocument();
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("filters recorded forms so Past Due / Critical hides Review Due cards and Review Due hides critical cards", () => {
    const critical = items.find((item) => item.kind === "fact" && item.tone === "danger");
    const review = items.find((item) => item.kind === "fact" && item.tone !== "danger");
    expect(critical, "seed must produce a critical fact or this filter assertion is vacuous").toBeDefined();
    expect(review, "seed must produce a review-due fact or this filter assertion is vacuous").toBeDefined();

    const { drawer } = renderDrawer();
    expect(within(drawer).getByTestId(`ward-task-${critical!.id}`)).toBeTruthy();
    expect(within(drawer).getByTestId(`ward-task-${review!.id}`)).toBeTruthy();

    fireEvent.click(within(drawer).getByRole("button", { name: /^Critical/u }));
    expect(within(drawer).getByTestId(`ward-task-${critical!.id}`)).toBeTruthy();
    expect(within(drawer).queryByTestId(`ward-task-${review!.id}`)).toBeNull();

    fireEvent.click(within(drawer).getByRole("button", { name: /^Review/u }));
    expect(within(drawer).getByTestId(`ward-task-${review!.id}`)).toBeTruthy();
    expect(within(drawer).queryByTestId(`ward-task-${critical!.id}`)).toBeNull();
  });
});

describe("task workspace state filters and actions", () => {
  it("removes search and combines severity with acknowledgement state", () => {
    const critical = items.find((item) => item.tone === "danger")!;
    const { drawer } = renderDrawer({
      acknowledgements: { [critical.id]: [{ at: NOW_ANCHOR, by: "Bed coordinator" }] },
    });
    expect(within(drawer).queryByRole("textbox", { name: "Search tasks" })).toBeNull();
    fireEvent.change(within(drawer).getByRole("combobox", { name: "Filter task state" }), {
      target: { value: "acknowledged" },
    });
    expect(within(drawer).getByTestId(`ward-task-${critical.id}`)).toBeVisible();
    fireEvent.click(within(drawer).getByRole("button", { name: /^Review/u }));
    expect(within(drawer).getByText("No matching tasks")).toBeVisible();
    fireEvent.click(within(drawer).getByRole("button", { name: "Clear filters" }));
    expect(within(drawer).getAllByRole("button", { name: "Acknowledge" })).toHaveLength(items.length);
  });

  it("offers completed tasks without allowing live facts to be marked done", () => {
    const { drawer } = renderDrawer();
    fireEvent.change(within(drawer).getByRole("combobox", { name: "Filter task state" }), {
      target: { value: "completed" },
    });
    expect(within(drawer).getByText("No completed tasks")).toBeVisible();
    expect(within(drawer).queryByRole("button", { name: "Mark done" })).toBeNull();
  });

  it("shows linked patient identity and routes actions with the correct patient context", () => {
    const { drawer, onSelectMovement, dispatch } = renderDrawer({ records: seed });
    const item = items.find((item) => item.title === "Multiple destinations declined")!;
    const card = within(drawer).getByTestId(`ward-task-${item.id}`).closest("li")!;
    // v6 (TasksDrawer.webp): the meta line reads "Critical · Tobias Wren · UM100023", record number bare.
    expect(card).toHaveTextContent(/Tobias Wren·UM\d+/u);
    expect(card).not.toHaveTextContent(item.movementId);
    expect(card).not.toHaveTextContent("Flow coordinator");
    fireEvent.click(within(card).getByRole("button", { name: "Refer" }));
    expect(onSelectMovement).toHaveBeenLastCalledWith(item.movementId, "refer");
    fireEvent.click(within(card).getByRole("button", { name: "Contact" }));
    expect(onSelectMovement).toHaveBeenLastCalledWith(item.movementId, "contact");
    fireEvent.click(within(card).getByRole("button", { name: "Escalate" }));
    fireEvent.change(within(card).getByRole("textbox"), { target: { value: "Duty coordinator" } });
    fireEvent.click(within(card).getByRole("button", { name: "Record escalation" }));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "RECORD_ESCALATION", movementId: item.movementId, contact: "Duty coordinator" }),
    );
  });

  it("acknowledges only visible, unacknowledged facts", () => {
    const critical = items.filter((item) => item.tone === "danger");
    const acked = critical[0];
    const { drawer, dispatch } = renderDrawer({
      acknowledgements: {
        [acked.id]: [{ at: NOW_ANCHOR, by: "Bed coordinator" }],
      },
    });
    fireEvent.click(within(drawer).getByRole("button", { name: /^Critical/u }));
    fireEvent.click(within(drawer).getByRole("button", { name: /Acknowledge visible/ }));
    expect(dispatch).toHaveBeenCalledTimes(critical.length - 1);
    for (const item of critical.slice(1))
      expect(dispatch).toHaveBeenCalledWith({
        type: "ACKNOWLEDGE_INBOX_ITEM",
        role: "coordinator",
        now: NOW_ANCHOR,
        inboxItemId: item.id,
      });
  });

  it("keeps acknowledged facts visible by default and makes their filter explicit", () => {
    const item = items[0];
    const { drawer } = renderDrawer({
      acknowledgements: {
        [item.id]: [{ at: NOW_ANCHOR, by: "Bed coordinator" }],
      },
    });
    const filter = within(drawer).getByRole("combobox", { name: "Filter task state" });
    fireEvent.change(filter, { target: { value: "unacknowledged" } });
    expect(within(drawer).queryByTestId(`ward-task-${item.id}`)).toBeNull();
    fireEvent.change(filter, { target: { value: "acknowledged" } });
    expect(within(drawer).getByTestId(`ward-task-${item.id}`)).toBeVisible();
    expect(within(drawer).queryByRole("button", { name: /Acknowledge visible/ })).toBeNull();
    fireEvent.change(filter, { target: { value: "all" } });
    expect(within(drawer).getAllByRole("button", { name: "Acknowledge" })).toHaveLength(items.length);
  });
});

describe("carer, PSP and MHAS rows open the right checklist", () => {
  // WF-300 marked an involuntary inpatient, so the seed has one arrival row and one discharge row.
  const state = {
    ...seed,
    movements: seed.movements.map((movement): Movement =>
      movement.id === "WF-300" ? { ...movement, legalStatus: "Involuntary inpatient" } : movement,
    ),
  };
  const notificationItems = buildActionInbox(state.movements.filter(isOpen), NOW_ANCHOR, state.units, state).filter(
    (item) => item.id.startsWith("notify-"),
  );

  function renderNotifications() {
    const onSelectMovement = vi.fn();
    const onSelectDischarge = vi.fn();
    render(
      <WardTasksDrawer
        items={notificationItems}
        acknowledgements={{}}
        completions={{}}
        role="coordinator"
        now={NOW_ANCHOR}
        dispatch={vi.fn()}
        onClose={vi.fn()}
        onSelectMovement={onSelectMovement}
        onSelectDischarge={onSelectDischarge}
        records={state}
      />,
    );
    return { onSelectMovement, onSelectDischarge };
  }

  it("opens a discharge row on the discharges board by its admission id", () => {
    const { onSelectMovement, onSelectDischarge } = renderNotifications();
    fireEvent.click(screen.getByTestId(`ward-task-${supportNotificationTaskId("discharge", "AD-LEFT-01")}`));
    expect(onSelectDischarge).toHaveBeenCalledWith("AD-LEFT-01");
    expect(onSelectMovement).not.toHaveBeenCalled();
  });

  it("opens an admission row on its movement page", () => {
    const { onSelectMovement, onSelectDischarge } = renderNotifications();
    fireEvent.click(screen.getByTestId(`ward-task-${supportNotificationTaskId("admission", "WF-300")}`));
    expect(onSelectMovement).toHaveBeenCalledWith("WF-300");
    expect(onSelectDischarge).not.toHaveBeenCalled();
  });
});
