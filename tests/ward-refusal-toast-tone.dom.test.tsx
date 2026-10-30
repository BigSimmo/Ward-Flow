import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { type ActionToast, useActionToast } from "@/components/ward-management/ward-action-toast";
import { ToastProvider } from "@/components/wf/toast-provider";
import { useUndoableStep } from "@/components/ward-management/use-undoable-step";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";

// Walk-through WT-10 (26 Oct 2026): a refusal must not read as a success. Synthetic records only.
const event = { type: "REQUEST_CAPACITY_REFRESH", role: "ward", now: 642, unitId: "ward-test" } as const;

function Page({
  dispatch,
  onMessage,
}: {
  dispatch: (event: WardFlowEvent) => Promise<WardCommandOutcome>;
  onMessage: (message: string, tone: "success" | "warning") => void;
}) {
  const { run } = useUndoableStep({ dispatch, now: 642, routeRole: "ward", rejections: [], onMessage });
  return <button onClick={() => run(event, { success: "Recorded." })}>Record</button>;
}

function BoardToast({ say }: { say: ActionToast | null }) {
  const setToast = useActionToast({ testId: "ward-board-toast" });
  return (
    <button type="button" onClick={() => setToast(say)}>
      Show
    </button>
  );
}

function showOnBoard(say: ActionToast | null) {
  return render(
    <ToastProvider>
      <BoardToast say={say} />
    </ToastProvider>,
  );
}

async function press(dispatch: (event: WardFlowEvent) => Promise<WardCommandOutcome>) {
  const onMessage = vi.fn();
  render(<Page dispatch={dispatch} onMessage={onMessage} />);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Record" }));
  });
  return onMessage;
}

describe("refusals are told apart from successes (walk-through WT-10)", () => {
  it("passes a refused step to the screen as a warning", async () => {
    const onMessage = await press(async () => ({ commandId: "c1", status: "refused", message: "Not allowed." }));
    expect(onMessage).toHaveBeenCalledWith("Not recorded: Not allowed.", "warning");
  });

  it("passes a recorded step to the screen as a success", async () => {
    const onMessage = await press(async () => ({ commandId: "c1", status: "accepted" }));
    expect(onMessage).toHaveBeenCalledWith("Recorded.", "success");
  });

  it("shows a bed board refusal with the warning tone and a recorded step without it", () => {
    const refusal = showOnBoard({ warning: "Not recorded: no bed. Nothing was changed." });
    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    const toast = screen.getByTestId("ward-board-toast");
    expect(toast).toHaveAttribute("data-tone", "warning");
    expect(toast).toHaveTextContent(/^Not recorded: no bed\. Nothing was changed\.$/);
    refusal.unmount();
    showOnBoard("Patient arrived: Alex confirmed on the ward.");
    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(screen.getByTestId("ward-board-toast")).toHaveAttribute("data-tone", "success");
  });
});
