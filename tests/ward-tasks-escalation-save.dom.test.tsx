import "@testing-library/jest-dom/vitest";
import { act, cleanup, configure, fireEvent, render, screen, within } from "@testing-library/react";
import { CircleAlert } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WardTasksDrawer } from "@/components/ward-management/ward-tasks-drawer";
import type { InboxItem } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

configure({
  getElementError: () => new Error("Escalation receipt query failed; record-bearing diagnostics suppressed."),
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Tasks escalation confirmation", () => {
  it("retains the typed contact while pending and when its command is refused", async () => {
    const seed = seedWardFlowState();
    const movement = seed.movements.find((row) => !row.closure && row.stage !== "arrived")!;
    const item: InboxItem = {
      id: "synthetic-escalation",
      kind: "fact",
      tone: "warning",
      icon: CircleAlert,
      title: "Synthetic escalation review",
      detail: "Synthetic fixture",
      movementId: movement.id,
      owner: movement.owner,
    };
    let resolve!: (outcome: WardCommandOutcome) => void;
    const completion = new Promise<WardCommandOutcome>((answer) => {
      resolve = answer;
    });
    const dispatch = vi.fn<WardCommandDispatch>(() => completion);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardTasksDrawer
          alertsScreenOpen={false}
          items={[item]}
          acknowledgements={{}}
          completions={{}}
          role="coordinator"
          now={NOW_ANCHOR}
          dispatch={dispatch}
          onClose={vi.fn()}
          onSelectMovement={vi.fn()}
          records={seed}
        />
      </WardFlowProvider>,
    );
    const card = screen.getByTestId(`ward-task-${item.id}`).closest("li")!;
    fireEvent.click(within(card).getByRole("button", { name: "Escalate" }));
    fireEvent.change(screen.getByPlaceholderText("Contact name or service"), { target: { value: "Synthetic desk" } });
    fireEvent.click(screen.getByRole("button", { name: "Record escalation" }));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "RECORD_ESCALATION", contact: "Synthetic desk" }),
    );
    expect(screen.queryByPlaceholderText("Contact name or service")).not.toBeNull();
    expect(screen.getByPlaceholderText("Contact name or service")).toHaveValue("Synthetic desk");
    await act(async () => {
      resolve({ commandId: "synthetic-escalation", status: "refused", message: "Synthetic refusal." });
    });
    expect(screen.queryByPlaceholderText("Contact name or service")).not.toBeNull();
    expect(screen.getByPlaceholderText("Contact name or service")).toHaveValue("Synthetic desk");
    expect(card.textContent?.includes("Not recorded: Synthetic refusal.")).toBe(true);
    let confirm!: (outcome: WardCommandOutcome) => void;
    const confirmation = new Promise<WardCommandOutcome>((answer) => {
      confirm = answer;
    });
    dispatch.mockReturnValue({ commandId: "synthetic-escalation-retry", status: "failed", confirmation });
    fireEvent.click(screen.getByRole("button", { name: "Record escalation" }));
    fireEvent.click(screen.getByRole("button", { name: "Record escalation" }));
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(screen.getByPlaceholderText("Contact name or service")).toHaveValue("Synthetic desk");
    // A save that may yet be confirmed holds the form (#1331): Cancel and Escalate discard nothing,
    // and no second command goes for the same contact.
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(within(card).getByRole("button", { name: "Escalate" }));
    expect(screen.getByPlaceholderText("Contact name or service")).toHaveValue("Synthetic desk");
    fireEvent.click(screen.getByRole("button", { name: "Record escalation" }));
    expect(dispatch).toHaveBeenCalledTimes(2);

    await act(async () => {
      confirm({ commandId: "synthetic-escalation-retry", status: "accepted" });
    });
    expect(screen.queryByPlaceholderText("Contact name or service")).toBeNull();
  });
});
