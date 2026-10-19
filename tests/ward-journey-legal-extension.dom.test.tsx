import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useRef } from "react";
import { describe, expect, it } from "vitest";
import { ToastProvider } from "@/components/wf";
import { LegalFormsScreen } from "@/components/ward-management/legal-forms/legal-forms-screen";
import { ExtendSheet } from "@/components/ward-management/legal-forms/legal-forms-sheets";
import { WardFlowProvider, WardFlowOverride, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { clearSessionDrafts } from "@/components/ward-management/ward-session-drafts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

let flow: ReturnType<typeof useWardFlow>;
function ControlledScreen({ completion }: { completion: ReturnType<typeof deferred<WardCommandOutcome>> }) {
  const value = useWardFlow();
  useEffect(() => {
    flow = value;
  }, [value]);
  const attempts = useRef(0);
  const dispatch: WardCommandDispatch = (event) =>
    event.type === "RECORD_LEGAL_FORM_EXPIRY" && attempts.current++ === 0 ? completion.promise : value.dispatch(event);
  const target = seedWardFlowStateAt(0).movements.find((m) => !m.closure && m.legalForm?.dueAt !== undefined)!;
  return (
    <WardFlowOverride value={{ ...value, dispatch }}>
      <LegalFormsScreen initialMovementId={target.id} />
    </WardFlowOverride>
  );
}

describe("legal extension completion and recovery", () => {
  it.each(["refused", "timeout"] as const)("retains the value after %s and allows retry", async (failure) => {
    const completion = deferred<WardCommandOutcome>();
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <WardFlowProvider initialNow={642}>
          <ControlledScreen completion={completion} />
        </WardFlowProvider>
      </ToastProvider>,
    );
    act(() => {
      flow.dispatch({ type: "ADVANCE_CLOCK", role: "demo", now: 642, minutes: 600 });
    });
    const trigger = screen.getByRole("button", { name: "Extend recorded form" });
    await user.click(trigger);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("ward-legal-extend")).toBeNull());
    // The sheet hands focus back on the next animation frame, so wait for it.
    await waitFor(() => expect(trigger).toHaveFocus());
    await user.click(trigger);
    const input = screen.getByTestId("ward-legal-forms-renew-expiry");
    fireEvent.change(input, { target: { value: "23:59" } });
    await user.click(screen.getByTestId("ward-legal-forms-renew-confirm"));
    expect(screen.getByTestId("ward-legal-extend")).toBeVisible();
    expect(input).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    await act(async () => {
      if (failure === "refused")
        completion.resolve({ commandId: "synthetic", status: "refused", message: "Synthetic refusal" });
      else completion.reject(new Error("Synthetic timeout"));
    });
    expect(screen.getByText(failure === "refused" ? /Synthetic refusal/ : /Save is not confirmed/)).toBeVisible();
    expect(input).toHaveValue("23:59");
    expect(input).not.toBeDisabled();
    fireEvent.change(input, { target: { value: "23:58" } });
    expect(input).toHaveValue("23:58");
    await user.click(screen.getByTestId("ward-legal-forms-renew-confirm"));
    await waitFor(() => expect(screen.queryByTestId("ward-legal-extend")).toBeNull());
    expect(flow.movements.some((m) => m.legalForm?.dueAt === 1438)).toBe(true);
  });

  it("waits for acceptance before clearing and closing", async () => {
    const completion = deferred<boolean>();
    const target = seedWardFlowStateAt(0).movements.find((m) => !m.closure && m.legalForm?.dueAt !== undefined)!;
    let closed = 0;
    render(
      <WardFlowProvider initialNow={1242}>
        <ExtendSheet
          target={target}
          label="Synthetic record"
          now={1242}
          onClose={() => closed++}
          onExtendForm={() => completion.promise}
        />
      </WardFlowProvider>,
    );
    fireEvent.change(screen.getByTestId("ward-legal-forms-renew-expiry"), { target: { value: "23:59" } });
    fireEvent.click(screen.getByTestId("ward-legal-forms-renew-confirm"));
    expect(closed).toBe(0);
    await act(async () => completion.resolve(true));
    expect(closed).toBe(1);
    expect(screen.getByTestId("ward-legal-forms-renew-expiry")).toHaveValue("");
  });

  it("does not let a completion from an old session clear or close the current input", async () => {
    const completion = deferred<boolean>();
    const target = seedWardFlowStateAt(0).movements.find((m) => !m.closure && m.legalForm?.dueAt !== undefined)!;
    let closed = 0;
    render(
      <WardFlowProvider initialNow={1242}>
        <ExtendSheet
          target={target}
          label="Synthetic record"
          now={1242}
          onClose={() => closed++}
          onExtendForm={() => completion.promise}
        />
      </WardFlowProvider>,
    );
    fireEvent.change(screen.getByTestId("ward-legal-forms-renew-expiry"), { target: { value: "23:59" } });
    fireEvent.click(screen.getByTestId("ward-legal-forms-renew-confirm"));
    clearSessionDrafts();
    await act(async () => completion.resolve(true));
    expect(closed).toBe(0);
    expect(screen.getByTestId("ward-legal-forms-renew-expiry")).toHaveValue("23:59");
    expect(screen.getByTestId("ward-legal-forms-renew-expiry")).not.toBeDisabled();
  });
});
