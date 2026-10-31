import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CircleAlert } from "lucide-react";

import { InboxSnoozeControl } from "@/components/ward-management/inbox-snooze-control";
import { WardTasksDrawer } from "@/components/ward-management/ward-tasks-drawer";
import { buildActionInbox, isOpen, type InboxItem } from "@/components/ward-management/ward-derivations";
import { inboxItemIsActNow, seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
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
      alertsScreenOpen={false}
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
  return { dispatch, drawer: screen.getByRole("complementary", { name: "Alerts" }) };
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

  it("picks a time, needs a reason, then snoozes, and holds a red row to 1h at most", () => {
    const { dispatch, drawer } = renderDrawer();
    const presets = openSnooze(drawer, red);
    // UX audit (21 Oct 2026): the first allowed time is selected on open and the chips are live.
    expect(within(presets).getByRole("button", { name: /^30m/ })).toHaveAttribute("aria-pressed", "true");
    const fourHours = within(presets).getByRole("button", { name: /^4h/ });
    expect(fourHours).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(fourHours);
    expect(dispatch).not.toHaveBeenCalled();

    fireEvent.click(within(presets).getByRole("button", { name: /^1h/ }));
    expect(dispatch).not.toHaveBeenCalled();

    const reasons = screen.getByRole("group", { name: "Snooze because" });
    fireEvent.click(within(reasons).getByRole("button", { name: "Awaiting call back" }));
    expect(dispatch).toHaveBeenCalledWith({
      type: "SNOOZE_INBOX_ITEM",
      role: "coordinator",
      now: NOW_ANCHOR,
      inboxItemId: red.id,
      until: NOW_ANCHOR + 60,
      reason: "awaiting_call_back",
    });
  });

  it("says when the row comes back and the act now limit in words, not only on hover", () => {
    const { drawer } = renderDrawer();
    openSnooze(drawer, red);
    expect(screen.getByText(/^Back at/)).toHaveTextContent(/^Back at \d\d:\d\d\. Act now: 1h 00m at most\.$/);
  });

  it("opens as its own bottom sheet on a phone, and records the snooze from there", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === "(max-width: 48rem)",
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    try {
      const onSnooze = vi.fn();
      render(<InboxSnoozeControl subject="Synthetic alert" actNow now={NOW_ANCHOR} onSnooze={onSnooze} />);
      fireEvent.click(screen.getByRole("button", { name: "Snooze Synthetic alert" }));
      const sheet = screen.getByRole("dialog", { name: "Snooze" });
      expect(sheet).toHaveAccessibleDescription("Synthetic alert");
      const presets = within(sheet).getByRole("group", { name: "Back in" });
      expect(within(presets).getByRole("button", { name: /^30m/ })).toHaveAttribute("aria-pressed", "true");
      const reasons = within(sheet).getByRole("group", { name: "Snooze because" });
      fireEvent.click(within(reasons).getByRole("button", { name: "Waiting on ward" }));
      expect(onSnooze).toHaveBeenCalledWith(NOW_ANCHOR + 30, "waiting_on_ward");
      expect(screen.queryByRole("dialog", { name: "Snooze" })).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("forgets an abandoned time when the picker closes without a reason", () => {
    const { dispatch, drawer } = renderDrawer();
    let presets = openSnooze(drawer, red);
    fireEvent.click(within(presets).getByRole("button", { name: /^1h/ }));
    // Close with the trigger, then open again: the first allowed time is back.
    fireEvent.click(
      within(drawer)
        .getAllByRole("button", { name: new RegExp(`^Snooze ${red.title}`) })
        .at(0)!,
    );
    expect(screen.queryByRole("group", { name: "Back in" })).toBeNull();
    presets = openSnooze(drawer, red);
    expect(within(presets).getByRole("button", { name: /^30m/ })).toHaveAttribute("aria-pressed", "true");
    expect(within(presets).getByRole("button", { name: /^1h/ })).toHaveAttribute("aria-pressed", "false");
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("moves a snoozed row into the Snoozed section with who and why, and returns it on request", () => {
    const onSelectMovement = vi.fn();
    const { dispatch, drawer } = renderDrawer({
      onSelectMovement,
      records: {
        movements: seed.movements,
        patients: seed.patients,
        referrals: seed.referrals,
        units: seed.units,
      },
      snoozes: {
        [red.id]: [
          {
            at: NOW_ANCHOR,
            by: "Bed coordinator",
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
    expect(snoozed).toHaveTextContent(/Back .* · Awaiting call back · Bed coordinator/i);
    // Patient identity stays on the snoozed row so two patients with the same title are distinct.
    const snoozedRow = screen.getByTestId(`ward-task-snoozed-${red.id}`);
    const expected = resolveSubjectPatient(
      seed.movements.find((row) => row.id === red.movementId),
      seed,
    );
    expect(expected.patient, "the red row's movement has a linked synthetic patient").toBeDefined();
    expect(within(snoozedRow).getByText(expected.displayName)).toBeInTheDocument();
    expect(within(snoozedRow).getByText(expected.umrn)).toBeInTheDocument();
    expect(snoozedRow.textContent).not.toMatch(/WF-\d/);
    const open = within(snoozedRow).getByRole("button", { name: "Open patient" });
    expect(open).toBe(screen.getByTestId(`ward-task-snoozed-open-${red.id}`));
    fireEvent.click(open);
    expect(onSelectMovement).toHaveBeenCalledWith(red.movementId);
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
            by: "Bed coordinator",
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
    const { drawer } = renderDrawer({ ownership: { [red.id]: [{ at: NOW_ANCHOR - 5, by: "Bed coordinator" }] } });
    expect(within(drawer).queryByTestId(`ward-task-own-${red.id}`)).toBeNull();
    expect(drawer).toHaveTextContent(/Owned by Bed coordinator since/);
  });

  it("says who acknowledged a row", () => {
    const { drawer } = renderDrawer({
      acknowledgements: { [red.id]: [{ at: NOW_ANCHOR - 2, by: "Bed coordinator" }] },
    });
    expect(drawer).toHaveTextContent(/Acknowledged by Bed coordinator at/);
  });

  it("offers Due first, which puts rows with a due time ahead of rows without one", () => {
    const due = (id: string, at?: number): InboxItem => ({
      ...red,
      id: `${red.id}-${id}`,
      title: `Row ${id}`,
      dueAt: at,
    });
    renderDrawer({ items: [due("none"), due("late", NOW_ANCHOR + 90), due("soon", NOW_ANCHOR + 10)] });
    const sort = screen.getByRole("combobox", { name: "Sort alerts" });
    fireEvent.change(sort, { target: { value: "due-first" } });
    const titles = screen.getAllByText(/^Row (none|late|soon)$/).map((node) => node.textContent);
    expect(titles).toEqual(["Row soon", "Row late", "Row none"]);
  });

  it("says Nothing active, not No outstanding work, when every row is snoozed, and keeps Open on it", () => {
    const onSelectMovement = vi.fn();
    renderDrawer({
      items: [red],
      onSelectMovement,
      snoozes: {
        [red.id]: [
          {
            at: NOW_ANCHOR,
            by: "Bed coordinator",
            kind: "snoozed",
            until: NOW_ANCHOR + 30,
            reason: "awaiting_call_back",
          },
        ],
      },
    });
    expect(screen.getByRole("heading", { name: "Nothing active" })).toBeInTheDocument();
    expect(screen.queryByText("No outstanding work")).toBeNull();
    const snoozed = screen.getByTestId("ward-tasks-snoozed");
    expect(within(snoozed).getByRole("button", { name: /^Return .* now, / })).toBeInTheDocument();
    fireEvent.click(within(snoozed).getByRole("button", { name: "Open patient" }));
    expect(onSelectMovement).toHaveBeenCalledWith(red.movementId);
  });

  it("opens a snoozed discharge notification row by its stay, never an empty movement", () => {
    const onSelectMovement = vi.fn();
    const onSelectDischarge = vi.fn();
    const discharge: InboxItem = {
      id: "notify-discharge-AD-LEFT-01",
      tone: "warning",
      icon: CircleAlert,
      title: "Discharge notifications to record",
      detail: "Carer, PSP, MHAS not recorded",
      owner: "Ward",
      movementId: "",
      admissionId: "AD-LEFT-01",
      kind: "fact",
    };
    renderDrawer({
      items: [discharge],
      onSelectMovement,
      onSelectDischarge,
      snoozes: {
        [discharge.id]: [
          {
            at: NOW_ANCHOR,
            by: "Bed coordinator",
            kind: "snoozed",
            until: NOW_ANCHOR + 60,
            reason: "awaiting_call_back",
          },
        ],
      },
    });
    const snoozed = screen.getByTestId("ward-tasks-snoozed");
    fireEvent.click(within(snoozed).getByTestId(`ward-task-snoozed-open-${discharge.id}`));
    expect(onSelectDischarge).toHaveBeenCalledWith("AD-LEFT-01");
    expect(onSelectMovement).not.toHaveBeenCalled();
  });
});

describe("phone tasks: act now, then oldest, and a Seen marker (remaining-pages audit ops-8, ops-9)", () => {
  it("orders by the age each row shows and marks acknowledged rows Seen", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === "(max-width: 48rem)",
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    try {
      const review = (id: string, since?: number): InboxItem => ({
        ...red,
        id: `review-${id}`,
        kind: "fact",
        tone: "warning",
        icon: CircleAlert,
        title: `Row ${id}`,
        detail: "Synthetic row",
        since,
        dueAt: undefined,
      });
      const recent = review("recent", NOW_ANCHOR - 15);
      const oldest = review("oldest", NOW_ANCHOR - 72);
      renderDrawer({
        items: [recent, review("untimed"), oldest, red],
        acknowledgements: { [recent.id]: [{ at: NOW_ANCHOR, by: "Bed coordinator" }] },
      });
      const titles = screen
        .getAllByRole("button", { name: /^(Row (recent|oldest|untimed)|.*expired.*)$/iu })
        .map((node) => node.textContent);
      expect(titles).toEqual([red.title, "Row oldest", "Row recent", "Row untimed"]);
      expect(screen.getAllByText("1h 12m").length).toBeGreaterThan(0);
      expect(screen.getByTestId(`ward-task-seen-${recent.id}`)).toHaveTextContent("Seen");
      expect(screen.queryByTestId(`ward-task-seen-${oldest.id}`)).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
