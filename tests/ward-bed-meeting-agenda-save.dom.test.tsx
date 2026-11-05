import "@testing-library/jest-dom/vitest";
import { act, cleanup, configure, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BedMeetingAgendaScreen } from "@/components/ward-management/bed-meeting/bed-meeting-agenda-screen";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

configure({ getElementError: () => new Error("Agenda save query failed; record-bearing diagnostics suppressed.") });

let recordAction: WardCommandDispatch;

function ReceiptBoundary({ children }: { children: ReactNode }) {
  const value = useWardFlow();
  const dispatch: WardCommandDispatch = (event) =>
    event.type === "RECORD_BED_MEETING_ACTION" ? recordAction(event) : value.dispatch(event);
  return (
    <WardFlowOverride value={{ ...value, dispatch, shared: { enabled: true, status: "ready", error: null } }}>
      {children}
    </WardFlowOverride>
  );
}

function openAction() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ReceiptBoundary>
        <BedMeetingAgendaScreen />
      </ReceiptBoundary>
    </WardFlowProvider>,
  );
  const waits = screen.getByTestId("bed-meeting-agenda-ed-waits");
  fireEvent.click(within(waits).getAllByTestId("bed-meeting-add-action")[0]!);
  chooseActionOwnerAndDue();
}

// The form's choices are chips and a segmented Due in (B1, Josh 3 Nov 2026), never drop-downs.
function chooseActionOwnerAndDue() {
  const form = screen.getByTestId("bed-meeting-action-form");
  fireEvent.click(within(form).getByRole("button", { name: "Book transport" }));
  fireEvent.click(within(form).getByRole("button", { name: "ED clinician" }));
  fireEvent.click(within(form).getByRole("radio", { name: "4h" }));
}

function expectChoicesKept() {
  const form = screen.getByTestId("bed-meeting-action-form");
  expect(within(form).getByRole("button", { name: "Book transport" })).toHaveAttribute("aria-pressed", "true");
  expect(within(form).getByRole("button", { name: "ED clinician" })).toHaveAttribute("aria-pressed", "true");
  expect(within(form).getByRole("radio", { name: "4h" })).toHaveAttribute("aria-checked", "true");
}

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  localStorage.clear();
});

describe("Agenda action confirmation", () => {
  it("keeps action, owner and due choices while pending and after its command is refused", async () => {
    let resolve!: (outcome: WardCommandOutcome) => void;
    const completion = new Promise<WardCommandOutcome>((answer) => {
      resolve = answer;
    });
    recordAction = vi.fn<WardCommandDispatch>(() => completion);
    openAction();
    fireEvent.click(screen.getByTestId("bed-meeting-action-record"));

    expect(screen.queryByTestId("bed-meeting-action-form")).not.toBeNull();
    expectChoicesKept();

    await act(async () => {
      resolve({ commandId: "synthetic-agenda-save", status: "refused", message: "Synthetic refusal." });
    });
    expect(screen.queryByTestId("bed-meeting-action-form")).not.toBeNull();
    expectChoicesKept();
    expect(screen.getByTestId("bed-meeting-action-form")).toHaveTextContent("Not recorded: Synthetic refusal.");
  });
  it("blocks duplicate pending submits and closes only on its accepted receipt", async () => {
    let resolve!: (outcome: WardCommandOutcome) => void;
    recordAction = vi.fn<WardCommandDispatch>(
      () =>
        new Promise<WardCommandOutcome>((answer) => {
          resolve = answer;
        }),
    );
    openAction();
    const save = screen.getByTestId("bed-meeting-action-record");
    fireEvent.click(save);
    fireEvent.click(save);
    expect(recordAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("bed-meeting-action-form")).not.toBeNull();
    await act(async () => {
      resolve({ commandId: "synthetic-save", status: "accepted" });
    });
    expect(screen.queryByTestId("bed-meeting-action-form")).toBeNull();
  });

  it("keeps a rejected promise's choices available for another attempt", async () => {
    recordAction = vi.fn<WardCommandDispatch>(() => Promise.reject(new Error("Synthetic failure")));
    openAction();
    await act(async () => {
      fireEvent.click(screen.getByTestId("bed-meeting-action-record"));
    });
    expect(screen.queryByTestId("bed-meeting-action-form")).not.toBeNull();
    expect(screen.queryByTestId("bed-meeting-action-form")).toHaveTextContent(/not confirmed/iu);
  });

  it("an old accepted receipt cannot close a cancelled and reopened form", async () => {
    let resolve!: (outcome: WardCommandOutcome) => void;
    recordAction = vi.fn<WardCommandDispatch>(
      () =>
        new Promise<WardCommandOutcome>((answer) => {
          resolve = answer;
        }),
    );
    openAction();
    fireEvent.click(screen.getByTestId("bed-meeting-action-record"));
    fireEvent.click(screen.getByRole("button", { name: /^Cancel the action for/u }));
    fireEvent.click(
      within(screen.getByTestId("bed-meeting-agenda-ed-waits")).getAllByTestId("bed-meeting-add-action")[0]!,
    );
    await act(async () => {
      resolve({ commandId: "synthetic-old-save", status: "accepted" });
    });
    expect(screen.queryByTestId("bed-meeting-action-form")).not.toBeNull();
  });

  it("keeps an uncertain command locked until its original-id Retry confirms acceptance", async () => {
    let confirm!: (outcome: WardCommandOutcome) => void;
    const confirmation = new Promise<WardCommandOutcome>((answer) => {
      confirm = answer;
    });
    recordAction = vi.fn<WardCommandDispatch>(() => ({ commandId: "synthetic-retry", status: "failed", confirmation }));
    openAction();
    fireEvent.click(screen.getByTestId("bed-meeting-action-record"));
    fireEvent.click(screen.getByTestId("bed-meeting-action-record"));
    expect(recordAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("bed-meeting-action-form")).not.toBeNull();
    await act(async () => {
      confirm({ commandId: "synthetic-retry", status: "accepted" });
    });
    expect(screen.queryByTestId("bed-meeting-action-form")).toBeNull();
  });

  it("a receipt from an ended workspace cannot close this form", async () => {
    recordAction = vi.fn<WardCommandDispatch>(() => ({
      commandId: "synthetic-stale",
      status: "accepted",
      isCurrent: () => false,
    }));
    openAction();
    await act(async () => {
      fireEvent.click(screen.getByTestId("bed-meeting-action-record"));
    });
    expect(screen.queryByTestId("bed-meeting-action-form")).not.toBeNull();
  });
  it.each(["pending", "uncertain"] as const)(
    "cancel and reopen retains the %s command lock for the same subject",
    (mode) => {
      const confirmation = new Promise<WardCommandOutcome>(() => {});
      recordAction = vi.fn<WardCommandDispatch>(() =>
        mode === "pending"
          ? new Promise<WardCommandOutcome>(() => {})
          : { commandId: "synthetic-held", status: "failed", confirmation },
      );
      openAction();
      fireEvent.click(screen.getByTestId("bed-meeting-action-record"));
      fireEvent.click(screen.getByRole("button", { name: /^Cancel the action for/u }));
      fireEvent.click(
        within(screen.getByTestId("bed-meeting-agenda-ed-waits")).getAllByTestId("bed-meeting-add-action")[0]!,
      );
      chooseActionOwnerAndDue();
      fireEvent.click(screen.getByTestId("bed-meeting-action-record"));
      expect(recordAction).toHaveBeenCalledTimes(1);
    },
  );
});
