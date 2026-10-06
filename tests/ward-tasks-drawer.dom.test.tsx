import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WardTasksDrawer } from "@/components/ward-management/ward-tasks-drawer";
import { buildActionInbox, isOpen, type InboxItem } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { buildTaskCardContexts, taskFocusHref } from "@/components/ward-management/ward-task-card-context";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

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
const contexts = buildTaskCardContexts(seed.movements, seed.units, {
  patients: seed.patients,
  referrals: seed.referrals,
  movements: seed.movements,
});

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
      contexts={contexts}
      {...overrides}
    />,
  );
  return { dispatch, onClose, onSelectMovement, drawer: screen.getByRole("complementary", { name: "Tasks" }) };
}

describe("the tasks drawer", () => {
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
    expect(within(drawer).getByTestId(`ward-task-ack-${items[0].id}`)).toHaveTextContent(/Acknowledged by/u);
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

describe("task workspace acknowledgement filters", () => {
  it("has no search field", () => {
    const { drawer } = renderDrawer();
    expect(within(drawer).queryByRole("textbox", { name: "Search tasks" })).toBeNull();
    expect(within(drawer).getByRole("status")).toHaveTextContent(`${items.length} of ${items.length} tasks`);
  });

  it("shows the patient and UMRN, and leaves the movement id and flow coordinator off the card", () => {
    const { drawer } = renderDrawer();
    const item = items[0];
    const person = contexts[item.movementId];
    const row = within(drawer).getByTestId(`ward-task-row-${item.id}`);
    expect(person.displayName.length).toBeGreaterThan(0);
    expect(row).toHaveTextContent(person.displayName);
    expect(within(row).getByTestId(`ward-task-umrn-${item.id}`)).toHaveTextContent(person.umrn);
    expect(row).toHaveTextContent(item.title);
    expect(row).not.toHaveTextContent(item.movementId);
    expect(row).not.toHaveTextContent(item.owner);
  });

  it("sends Open, Refer, Contact, and Escalate to the matching destination", () => {
    const referable = items.find((item) => contexts[item.movementId]?.canRefer);
    const declined = items.find((item) => item.id.startsWith("declines-"));
    expect(referable, "seed must include a referable inbox row").toBeDefined();
    expect(declined, "seed must include a declined-destination inbox row").toBeDefined();
    const openContexts = {
      ...contexts,
      [declined!.movementId]: { ...contexts[declined!.movementId], alreadyEscalated: false },
    };

    const { drawer, onSelectMovement } = renderDrawer({ contexts: openContexts });
    const referRow = within(drawer).getByTestId(`ward-task-row-${referable!.id}`);
    fireEvent.click(within(referRow).getByRole("button", { name: "Refer" }));
    expect(onSelectMovement).toHaveBeenCalledWith(referable!.movementId, "refer");

    const declinedRow = within(drawer).getByTestId(`ward-task-row-${declined!.id}`);
    fireEvent.click(within(declinedRow).getByRole("button", { name: "Escalate" }));
    expect(onSelectMovement).toHaveBeenCalledWith(declined!.movementId, "escalate");

    const firstRow = within(drawer).getByTestId(`ward-task-row-${items[0].id}`);
    fireEvent.click(within(firstRow).getByRole("button", { name: "Contact" }));
    expect(onSelectMovement).toHaveBeenCalledWith(items[0].movementId, "contact");
    fireEvent.click(within(firstRow).getByRole("button", { name: "Open" }));
    expect(onSelectMovement).toHaveBeenCalledWith(items[0].movementId, "record");
    expect(taskFocusHref(items[0].movementId, "record")).toBe(`/mockups/ward-flow/movements/${items[0].movementId}`);
    expect(taskFocusHref(items[0].movementId, "refer")).toBe(
      `/mockups/ward-flow/movements/${items[0].movementId}?focus=refer`,
    );
    expect(taskFocusHref(items[0].movementId, "contact")).toBe(
      `/mockups/ward-flow/movements/${items[0].movementId}?focus=contact`,
    );
    expect(taskFocusHref(items[0].movementId, "escalate")).toBe(
      `/mockups/ward-flow/delays?movement=${items[0].movementId}`,
    );
  });

  it("hides Refer when the movement cannot be referred, and shows Escalated once escalation is recorded", () => {
    const blocked = items.find((item) => contexts[item.movementId] && !contexts[item.movementId].canRefer);
    const declined = items.find((item) => item.id.startsWith("declines-"));
    expect(blocked, "seed must include an inbox row whose stage cannot be referred").toBeDefined();
    expect(declined, "seed must include a declined-destination inbox row").toBeDefined();
    const escalatedContexts = {
      ...contexts,
      [declined!.movementId]: { ...contexts[declined!.movementId], alreadyEscalated: true },
    };
    const { drawer } = renderDrawer({ contexts: escalatedContexts });
    const blockedRow = within(drawer).getByTestId(`ward-task-row-${blocked!.id}`);
    expect(within(blockedRow).queryByRole("button", { name: "Refer" })).toBeNull();
    expect(within(blockedRow).getByRole("button", { name: "Contact" })).toBeTruthy();
    const declinedRow = within(drawer).getByTestId(`ward-task-row-${declined!.id}`);
    expect(within(declinedRow).queryByRole("button", { name: "Escalate" })).toBeNull();
    expect(within(declinedRow).getByText("Escalated")).toBeTruthy();
  });

  it("filters to completed commitments, then clears back to every fact", () => {
    const source = items[0];
    const commitment: InboxItem = {
      ...source,
      id: `commitment-${source.movementId}`,
      kind: "commitment",
      title: "Confirm the ward call",
      detail: `${source.movementId} · follow up the ward`,
    };
    const { drawer } = renderDrawer({
      items: [source, commitment],
      completions: {
        [commitment.id]: [{ at: NOW_ANCHOR, by: "Bed coordinator", kind: "completed" }],
      },
    });
    fireEvent.change(within(drawer).getByRole("combobox", { name: "Filter acknowledgement state" }), {
      target: { value: "completed" },
    });
    expect(within(drawer).getByTestId(`ward-task-${commitment.id}`)).toBeVisible();
    expect(within(drawer).queryByTestId(`ward-task-${source.id}`)).toBeNull();
    expect(within(drawer).getByRole("button", { name: "Reopen" })).toBeTruthy();
    fireEvent.change(within(drawer).getByRole("combobox", { name: "Filter acknowledgement state" }), {
      target: { value: "all" },
    });
    expect(within(drawer).getByTestId(`ward-task-${source.id}`)).toBeVisible();
    expect(within(drawer).getByRole("button", { name: "Acknowledge" })).toBeTruthy();
  });

  it("uses the severity filter, then clears an empty result", () => {
    const { drawer } = renderDrawer();
    const critical = items.find((item) => item.tone === "danger")!;
    fireEvent.click(within(drawer).getByRole("button", { name: /^Review/u }));
    expect(within(drawer).queryByTestId(`ward-task-${critical.id}`)).toBeNull();
    const reviewLeft = items.some((item) => item.tone !== "danger");
    if (!reviewLeft) {
      expect(within(drawer).getByText("No tasks in this view")).toBeVisible();
      fireEvent.click(within(drawer).getByRole("button", { name: "Clear filters" }));
    }
    fireEvent.click(within(drawer).getByRole("button", { name: /^All/u }));
    expect(within(drawer).getAllByRole("button", { name: "Acknowledge" })).toHaveLength(items.length);
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
    const filter = within(drawer).getByRole("combobox", { name: "Filter acknowledgement state" });
    fireEvent.change(filter, { target: { value: "unacknowledged" } });
    expect(within(drawer).queryByTestId(`ward-task-${item.id}`)).toBeNull();
    fireEvent.change(filter, { target: { value: "acknowledged" } });
    expect(within(drawer).getByTestId(`ward-task-${item.id}`)).toBeVisible();
    expect(within(drawer).queryByRole("button", { name: /Acknowledge visible/ })).toBeNull();
    fireEvent.change(filter, { target: { value: "all" } });
    expect(within(drawer).getAllByRole("button", { name: "Acknowledge" })).toHaveLength(items.length);
  });
});
