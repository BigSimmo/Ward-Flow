import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { CircleAlert } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WardTasksDrawer } from "@/components/ward-management/ward-tasks-drawer";
import type { InboxItem } from "@/components/ward-management/ward-derivations";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR, activeWardNetwork } from "@/components/ward-management/ward-sites";
import { dueSoonThresholdsOf } from "@/components/ward-management/ward-clock";
import { Sheet } from "@/components/wf/sheet";
import { WardBar } from "@/components/ward-management/shell/ward-bar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

// The Tasks variant exposes escalation; the default coordinator Alerts preview has one action per row.
vi.mock("@/components/ward-management/shell/ward-access", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/shell/ward-access")>();
  return {
    ...actual,
    useAccessNavFilter: () => (entries: { id: string }[]) => entries.filter((entry) => entry.id !== "alerts"),
  };
});

vi.mock("@/components/ward-management/ward-flow-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-flow-provider")>();
  return {
    ...actual,
    useWardFlow: () => mockContext,
    useWardFlowSelect: () => mockContext,
    useOptionalWardFlowSelect: () => mockContext,
    useDueSoonThresholds: () => dueSoonThresholdsOf(mockContext.configuration),
    useWardNetwork: () => activeWardNetwork(),
    useWardFlowClock: () => mockContext.now,
  };
});

const seed = seedWardFlowStateAt(0);
const mockContext = { ...seed, now: NOW_ANCHOR, dayZero: new Date(0), dispatch: vi.fn(), setFocusMovementId: vi.fn() };
const movements = seed.movements
  .filter((movement) => !movement.closure && movement.stage !== "arrived")
  .slice(0, 2)
  .map((movement, index) => ({
    ...movement,
    escalation: index === 0 ? { at: NOW_ANCHOR - 10, triedUnitIds: [], contact: "Duty consultant" } : undefined,
  }));
const items: InboxItem[] = movements.map((movement, index) => ({
  id: `synthetic-task-${index}`,
  kind: "fact",
  tone: "warning",
  icon: CircleAlert,
  title: `Synthetic escalation review ${index + 1}`,
  detail: "Synthetic fixture",
  movementId: movement.id,
  owner: movement.owner,
}));

afterEach(() => vi.restoreAllMocks());

function renderDrawer(withBackdrop = false, inSheet = false) {
  const onClose = vi.fn();
  const dispatch = vi.fn();
  const content = (
    <WardTasksDrawer
      alertsScreenOpen={false}
      items={items}
      acknowledgements={{}}
      completions={{}}
      role="coordinator"
      now={NOW_ANCHOR}
      dispatch={dispatch}
      onClose={onClose}
      onSelectMovement={vi.fn()}
      records={{ ...seed, movements }}
      withBackdrop={withBackdrop}
    />
  );
  render(
    inSheet ? (
      <Sheet open onClose={onClose} ariaLabel="Tasks" headerHidden>
        {content}
      </Sheet>
    ) : (
      content
    ),
  );
  const card = (index = 0) => screen.getByTestId(`ward-task-${items[index].id}`).closest("li")!;
  const trigger = (index = 0) => within(card(index)).getByRole("button", { name: "Escalate" });
  fireEvent.click(trigger());
  return { onClose, dispatch, card, trigger };
}

function editDraft() {
  const input = screen.getByPlaceholderText("Contact name or service");
  fireEvent.change(input, { target: { value: "State bed desk" } });
  return input;
}

describe("unsaved escalation dismissal", () => {
  it.each(["Escape", "Cancel", "Escalate", "Close", "backdrop"])(
    "keeps the changed draft when %s is cancelled, then discards only after confirmation",
    (route) => {
      const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
      const { onClose, trigger } = renderDrawer(route === "backdrop");
      const input = editDraft();
      const dismiss = () => {
        if (route === "Escape") fireEvent.keyDown(input, { key: "Escape" });
        else if (route === "Cancel") fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        else if (route === "Escalate") fireEvent.click(trigger());
        else if (route === "Close") fireEvent.click(screen.getByRole("button", { name: "Close tasks panel" }));
        else fireEvent.click(screen.getByTestId("ward-tasks-drawer-backdrop"));
      };
      dismiss();
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(input).toHaveValue("State bed desk");
      expect(input).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
      confirm.mockReturnValue(true);
      dismiss();
      expect(confirm).toHaveBeenCalledTimes(2);
      expect(screen.queryByPlaceholderText("Contact name or service")).toBeNull();
      if (route === "Close" || route === "backdrop") expect(onClose).toHaveBeenCalledTimes(1);
      else {
        expect(onClose).not.toHaveBeenCalled();
        expect(trigger()).toHaveFocus();
      }
    },
  );

  it("does not prompt for the existing saved contact or an edit restored to that contact", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { trigger } = renderDrawer();
    let input = screen.getByPlaceholderText("Contact name or service");
    expect(input).toHaveValue("Duty consultant");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByPlaceholderText("Contact name or service")).toBeNull();
    fireEvent.click(trigger());
    input = editDraft();
    fireEvent.change(input, { target: { value: "Duty consultant" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByPlaceholderText("Contact name or service")).toBeNull();
    expect(confirm).not.toHaveBeenCalled();
  });

  it.each([false, true])("closes a clean drawer without confirmation (backdrop: %s)", (withBackdrop) => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { onClose } = renderDrawer(withBackdrop);
    fireEvent.click(
      withBackdrop
        ? screen.getByTestId("ward-tasks-drawer-backdrop")
        : screen.getByRole("button", { name: "Close tasks panel" }),
    );
    expect(confirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("handles escalation Escape inside the real outer Sheet before that Sheet can close", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { onClose, trigger } = renderDrawer(false, true);
    const input = editDraft();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(confirm).toHaveBeenCalledOnce();
    expect(input).toHaveValue("State bed desk");
    expect(onClose).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByPlaceholderText("Contact name or service")).toBeNull();
    expect(trigger()).toHaveFocus();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("confirms a subject switch and opens the next subject with its own contact", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { trigger } = renderDrawer();
    const input = editDraft();
    fireEvent.click(trigger(1));
    expect(confirm).toHaveBeenCalledOnce();
    expect(input).toHaveValue("State bed desk");
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(trigger(1)).toHaveAttribute("aria-expanded", "false");
    confirm.mockReturnValue(true);
    fireEvent.click(trigger(1));
    expect(screen.getByPlaceholderText("Contact name or service")).toHaveValue("");
    fireEvent.keyDown(screen.getByPlaceholderText("Contact name or service"), { key: "Escape" });
    expect(confirm).toHaveBeenCalledTimes(2);
    fireEvent.click(trigger());
    expect(screen.getByPlaceholderText("Contact name or service")).toHaveValue("Duty consultant");
  });

  it("records the draft directly and leaves no dirty navigation guard", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { dispatch } = renderDrawer();
    editDraft();
    fireEvent.click(screen.getByRole("button", { name: "Record escalation" }));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "RECORD_ESCALATION", contact: "State bed desk" }),
    );
    expect(screen.queryByPlaceholderText("Contact name or service")).toBeNull();
    expect(
      (window as typeof window & { __wardFlowConfirmNavigation?: () => boolean }).__wardFlowConfirmNavigation?.(),
    ).not.toBe(false);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("lets Contact Escape close that panel and return focus while keeping the escalation draft", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { card } = renderDrawer();
    const input = editDraft();
    const contact = within(card()).getByRole("button", { name: "Contact" });
    fireEvent.click(contact);
    const openContacts = screen.getByRole("button", { name: "Open patient contacts" });
    openContacts.focus();
    fireEvent.keyDown(openContacts, { key: "Escape" });
    expect(screen.queryByRole("button", { name: "Open patient contacts" })).toBeNull();
    expect(input).toHaveValue("State bed desk");
    expect(contact).toHaveFocus();
    expect(confirm).not.toHaveBeenCalled();
  });

  it("lets Snooze Escape close only the nested popover and return focus", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { card, onClose } = renderDrawer();
    const input = editDraft();
    const snooze = within(card()).getByRole("button", { name: /^Snooze / });
    fireEvent.click(snooze);
    const dialog = within(card()).getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(within(card()).queryByRole("dialog")).toBeNull();
    expect(input).toHaveValue("State bed desk");
    expect(snooze).toHaveFocus();
    expect(confirm).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("still guards Escape from the escalation input when Contact is also open", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { card } = renderDrawer();
    fireEvent.click(within(card()).getByRole("button", { name: "Contact" }));
    const input = editDraft();
    input.focus();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(confirm).toHaveBeenCalledOnce();
    expect(input).toHaveValue("State bed desk");
    expect(screen.getByRole("button", { name: "Open patient contacts" })).toBeInTheDocument();
  });

  it("registers changed drafts with the shared navigation and beforeunload guards", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderDrawer();
    editDraft();
    const confirmNavigation = (window as typeof window & { __wardFlowConfirmNavigation?: () => boolean })
      .__wardFlowConfirmNavigation;
    expect(confirmNavigation).toBeTypeOf("function");
    expect(confirmNavigation?.()).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
  });

  it("protects the draft before snoozing its row out of the active list", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { card, dispatch } = renderDrawer();
    const input = editDraft();
    const snooze = within(card()).getByRole("button", { name: /^Snooze / });
    const chooseReason = () => {
      fireEvent.click(snooze);
      fireEvent.click(screen.getByRole("button", { name: "Awaiting call back" }));
    };
    chooseReason();
    expect(confirm).toHaveBeenCalledOnce();
    expect(dispatch).not.toHaveBeenCalled();
    expect(input).toHaveValue("State bed desk");
    confirm.mockReturnValue(true);
    chooseReason();
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "SNOOZE_INBOX_ITEM", inboxItemId: items[0].id }),
    );
    expect(screen.queryByPlaceholderText("Contact name or service")).toBeNull();
  });

  it("also protects a footer link to the current page because it closes the drawer", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { onClose } = renderDrawer();
    editDraft();
    const link = screen.getByTestId("ward-tasks-jump-delays");
    link.setAttribute("href", window.location.href);
    fireEvent.click(link);
    expect(confirm).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText("Contact name or service")).toHaveValue("State bed desk");
  });

  it("guards footer navigation once and keeps the drawer when navigation is cancelled", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { onClose } = renderDrawer();
    const input = editDraft();
    const link = screen.getByTestId("ward-tasks-jump-delays");
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);
    expect(confirm).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
    expect(input).toHaveValue("State bed desk");
    confirm.mockReturnValue(true);
    fireEvent.click(link);
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(onClose).toHaveBeenCalledOnce();
  });
});

async function openShellDraft() {
  render(<WardBar />);
  fireEvent.click(screen.getByTestId("ward-bar-tasks-trigger"));
  const sheet = await screen.findByTestId("ward-bar-tasks-sheet");
  const task = within(sheet).getByRole("button", { name: "Multiple destinations declined" });
  const card = task.closest("li")!;
  fireEvent.click(within(card).getByRole("button", { name: "Escalate" }));
  const input = screen.getByPlaceholderText("Contact name or service");
  fireEvent.change(input, { target: { value: "Synthetic escalation draft" } });
  return { sheet, input };
}

describe("task draft protection through the real shell Sheet", () => {
  it("asks before another drawer replaces Tasks and keeps the draft when cancelled", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { input } = await openShellDraft();
    const openTools = () =>
      fireEvent(window, new CustomEvent("ward-flow-open-drawer", { detail: { drawerId: "tools" } }));
    openTools();
    expect(confirm).toHaveBeenCalledOnce();
    expect(screen.getByTestId("ward-bar-tasks-sheet")).toBeInTheDocument();
    expect(input).toHaveValue("Synthetic escalation draft");
    confirm.mockReturnValue(true);
    openTools();
    await waitFor(() => expect(screen.queryByTestId("ward-bar-tasks-sheet")).toBeNull());
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  it("keeps or discards on a backdrop close even when no drawer history entry exists", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const back = vi.spyOn(window.history, "back");
    const { sheet, input } = await openShellDraft();
    const state = { ...window.history.state };
    delete state.wardDrawer;
    window.history.replaceState(state, "");
    const backdrop = sheet.parentElement!;
    const close = () => {
      fireEvent.pointerDown(backdrop);
      fireEvent.click(backdrop);
    };
    input.focus();
    close();
    expect(confirm).toHaveBeenCalledOnce();
    expect(screen.getByTestId("ward-bar-tasks-sheet")).toBeInTheDocument();
    expect(input).toHaveValue("Synthetic escalation draft");
    expect(input).toHaveFocus();
    expect(back).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    close();
    await waitFor(() => expect(screen.queryByTestId("ward-bar-tasks-sheet")).toBeNull());
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(back).not.toHaveBeenCalled();
  });

  it("confirms header dismissal once through the ordinary history close", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const back = vi.spyOn(window.history, "back");
    const { sheet } = await openShellDraft();
    expect(window.history.state?.wardDrawer).toBeTruthy();
    fireEvent.click(within(sheet).getByRole("button", { name: "Close tasks panel" }));
    await waitFor(() => expect(screen.queryByTestId("ward-bar-tasks-sheet")).toBeNull());
    expect(back).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledOnce();
  });
});
