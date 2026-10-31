import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArrivalTimeModal } from "@/components/ward-management/referrals/arrival-time-modal";
import { UploadFormsModal } from "@/components/ward-management/referrals/upload-forms-modal";
import { ExtendSheet } from "@/components/ward-management/legal-forms/legal-forms-sheets";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { clearSessionDrafts, draftSessionVersion } from "@/components/ward-management/ward-session-drafts";
import type { Movement } from "@/components/ward-management/ward-model";
import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { perthMidnight } from "@/components/ward-management/ward-clock";
import { typedDateFor } from "./helpers/ward-date-input";

afterEach(() => {
  cleanup();
  clearSessionDrafts();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, failed) => {
    resolve = done;
    reject = failed;
  });
  return { promise, resolve, reject };
}
const accepted = (): WardCommandOutcome => ({ commandId: "synthetic-request", status: "accepted" });
const movements = seedWardFlowState().movements;
const first = movements[0]!;
const second = movements[1]!;
type ModalKind = "arrival" | "document";

function ModalHost({
  kind,
  movement,
  dispatch,
  onClose,
}: {
  kind: ModalKind;
  movement: Movement;
  dispatch: WardCommandDispatch;
  onClose: () => void;
}) {
  const value = useWardFlow();
  const [open, setOpen] = useState(true);
  const close = () => {
    onClose();
    setOpen(false);
  };
  return (
    <WardFlowOverride value={{ ...value, dispatch }}>
      {kind === "arrival" ? (
        <ArrivalTimeModal isOpen={open} movement={movement} onClose={close} />
      ) : (
        <UploadFormsModal isOpen={open} movement={movement} onClose={close} />
      )}
    </WardFlowOverride>
  );
}

function modalTree(kind: ModalKind, movement: Movement, dispatch: WardCommandDispatch, onClose: () => void) {
  return (
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ModalHost kind={kind} movement={movement} dispatch={dispatch} onClose={onClose} />
    </WardFlowProvider>
  );
}

function fillModal(kind: ModalKind) {
  if (kind === "arrival") {
    fireEvent.change(screen.getByLabelText("How they are travelling"), { target: { value: "hospital_transfer" } });
    fireEvent.change(screen.getByLabelText("CAD or tracking number"), { target: { value: "SYNTHETIC-TRACKING" } });
    // The ETA opens blank when nothing is recorded or booked, so a preset is chosen.
    fireEvent.click(screen.getByRole("button", { name: /^\+1h/u }));
  } else {
    fireEvent.change(screen.getByLabelText("Document / Statutory Form Type"), {
      target: { value: "Form 4A Transport order" },
    });
    fireEvent.change(screen.getByLabelText("Select a file to record its details"), {
      target: { files: [new File(["synthetic"], "synthetic-form.pdf", { type: "application/pdf" })] },
    });
  }
}
function submitModal(kind: ModalKind) {
  return screen.getByTestId(kind === "arrival" ? "save-arrival-plan-button" : "confirm-upload-form-button");
}
function expectRetained(kind: ModalKind) {
  if (kind === "arrival") expect(screen.getByLabelText("CAD or tracking number")).toHaveValue("SYNTHETIC-TRACKING");
  else expect(screen.getByRole("dialog")).toHaveTextContent("synthetic-form.pdf");
}

describe.each(["arrival", "document"] as const)("%s accepted-completion gating", (kind) => {
  it.each(["refused", "rejected promise"])(
    "blocks pending duplicate/dismiss, retains edits on %s, and closes after accepted retry",
    async (failure) => {
      const request = deferred<WardCommandOutcome>();
      const dispatch = vi
        .fn<WardCommandDispatch>()
        .mockReturnValueOnce(request.promise)
        .mockReturnValueOnce(accepted());
      const close = vi.fn();
      render(modalTree(kind, first, dispatch, close));
      fillModal(kind);
      const submit = submitModal(kind);
      fireEvent.submit(submit.closest("form")!);
      fireEvent.submit(submit.closest("form")!);
      const dialog = screen.getByRole("dialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
      fireEvent.click(within(dialog).getByRole("button", { name: "Close dialog" }));
      fireEvent.click(dialog.parentElement!);
      fireEvent.keyDown(dialog, { key: "Escape" });
      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(close).not.toHaveBeenCalled();
      if (kind === "document") {
        expect(submit).toHaveAttribute("aria-disabled", "true");
        expect(submit).not.toBeDisabled();
        submit.focus();
        expect(submit).toHaveFocus();
      } else expect(submit).toBeDisabled();
      await act(async () => {
        if (failure === "refused")
          request.resolve({ commandId: "synthetic-request", status: "refused", message: "Synthetic request refused" });
        else request.reject(new Error("Synthetic request rejected"));
      });
      expect(screen.getByRole("alert")).toHaveTextContent(
        failure === "refused" ? "Synthetic request refused" : "Save is not confirmed",
      );
      expectRetained(kind);
      expect(submit).not.toBeDisabled();
      expect(submit).not.toHaveAttribute("aria-disabled", "true");
      fireEvent.click(submit);
      expect(dispatch).toHaveBeenCalledTimes(2);
      expect(close).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("dialog")).toBeNull();
    },
  );

  it("cannot close a newer patient's dialog when the earlier save finishes", async () => {
    const request = deferred<WardCommandOutcome>();
    const dispatch = vi.fn<WardCommandDispatch>().mockReturnValue(request.promise);
    const close = vi.fn();
    const view = render(modalTree(kind, first, dispatch, close));
    fillModal(kind);
    fireEvent.click(submitModal(kind));
    view.rerender(modalTree(kind, second, dispatch, close));
    fillModal(kind);
    await act(async () => {
      request.resolve(accepted());
    });
    expect(close).not.toHaveBeenCalled();
    expectRetained(kind);
    expect(submitModal(kind)).not.toBeDisabled();
  });

  it("does not close when an accepted completion belongs to an expired session", async () => {
    const request = deferred<WardCommandOutcome>();
    const dispatch = vi.fn<WardCommandDispatch>().mockReturnValue(request.promise);
    const close = vi.fn();
    render(modalTree(kind, first, dispatch, close));
    fillModal(kind);
    const owner = draftSessionVersion();
    fireEvent.click(submitModal(kind));
    await act(async () => {
      clearSessionDrafts();
      request.resolve({ ...accepted(), isCurrent: () => owner === draftSessionVersion() });
    });
    expect(close).not.toHaveBeenCalled();
    expectRetained(kind);
    expect(submitModal(kind)).not.toBeDisabled();
  });
});

function extensionTree(
  target: Movement,
  onExtendForm: (movement: Movement, dueAt: number) => boolean | Promise<boolean>,
  onClose: () => void,
) {
  return (
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ExtendSheet
        target={target}
        label="Synthetic movement"
        now={NOW_ANCHOR}
        dayZero={EXTENSION_DAY_ZERO}
        onClose={onClose}
        onExtendForm={onExtendForm}
      />
    </WardFlowProvider>
  );
}
// Audit CS3-05: the date written on the form is compulsory, so each fill types it too.
const EXTENSION_DAY_ZERO = perthMidnight(2026, 9, 24);
function fillExtension(value = "23:30") {
  fireEvent.change(screen.getByLabelText("New expiry date"), {
    target: { value: typedDateFor(NOW_ANCHOR, EXTENSION_DAY_ZERO) },
  });
  fireEvent.change(screen.getByLabelText("New expiry time"), { target: { value } });
  return screen.getByTestId("ward-legal-forms-renew-confirm");
}

describe("legal extension accepted-completion gating", () => {
  it("keeps the pending extension open and retains its time after a rejected promise, then closes on acceptance", async () => {
    let reject!: () => void;
    const request = new Promise<boolean>((_, failed) => {
      reject = () => failed(new Error("Synthetic rejection"));
    });
    const extend = vi.fn().mockReturnValueOnce(request).mockReturnValueOnce(true);
    const close = vi.fn();
    render(extensionTree(first, extend, close));
    const confirm = fillExtension();
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(extend).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByLabelText("New expiry time")).toBeDisabled();
    await act(async () => {
      reject();
    });
    // The legal-forms screen reports the failed outcome (one message, not a second copy in the sheet).
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByLabelText("New expiry time")).toHaveValue("23:30");
    expect(screen.getByLabelText("New expiry time")).not.toBeDisabled();
    fireEvent.click(screen.getByTestId("ward-legal-forms-renew-confirm"));
    expect(extend).toHaveBeenCalledTimes(2);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("ignores the previous patient's completion after the target changes", async () => {
    const request = deferred<boolean>();
    const extend = vi.fn().mockReturnValue(request.promise);
    const close = vi.fn();
    const view = render(extensionTree(first, extend, close));
    fireEvent.click(fillExtension());
    view.rerender(extensionTree(second, extend, close));
    fillExtension("22:30");
    await act(async () => {
      request.resolve(true);
    });
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByLabelText("New expiry time")).toHaveValue("22:30");
  });

  it("cannot close a newer session after the original extension is accepted", async () => {
    const request = deferred<boolean>();
    const close = vi.fn();
    render(extensionTree(first, () => request.promise, close));
    fireEvent.click(fillExtension());
    await act(async () => {
      clearSessionDrafts();
      request.resolve(true);
    });
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByLabelText("New expiry time")).toHaveValue("23:30");
    expect(screen.getByLabelText("New expiry time")).not.toBeDisabled();
  });
});
