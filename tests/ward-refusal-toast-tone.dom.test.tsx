import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BoardToastView } from "@/components/ward-management/board/ward-board-toast";
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
    const { rerender } = render(<BoardToastView toast={{ warning: "Not recorded: no bed. Nothing was changed." }} />);
    const toast = screen.getByTestId("ward-board-toast");
    expect(toast).toHaveAttribute("data-tone", "warning");
    expect(toast).toHaveTextContent(/^Not recorded: no bed\. Nothing was changed\.$/);
    rerender(<BoardToastView toast="Patient arrived: Alex confirmed on the ward." />);
    expect(screen.getByTestId("ward-board-toast")).not.toHaveAttribute("data-tone");
    rerender(<BoardToastView toast={null} />);
    expect(screen.queryByTestId("ward-board-toast")).not.toBeInTheDocument();
  });
});
