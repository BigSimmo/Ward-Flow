import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { UploadFormsModal } from "@/components/ward-management/referrals/upload-forms-modal";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const movement = seedWardFlowState().movements[0]!;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function setup(dispatch: WardCommandDispatch) {
  const close = vi.fn();
  function Boundary({ children }: { children: ReactNode }) {
    const state = useWardFlow();
    return <WardFlowOverride value={{ ...state, dispatch }}>{children}</WardFlowOverride>;
  }
  const tree = (open: boolean) => (
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Boundary>
        <UploadFormsModal isOpen={open} onClose={close} movement={movement} />
      </Boundary>
    </WardFlowProvider>
  );
  const view = render(tree(true));
  const type = screen.getByLabelText("Document / Statutory Form Type");
  fireEvent.change(type, { target: { value: "Clinical transfer summary" } });
  fireEvent.change(screen.getByLabelText("Select a file to record its details"), {
    target: { files: [new File(["synthetic"], "synthetic.pdf", { type: "application/pdf" })] },
  });
  return {
    ...view,
    close,
    type,
    tree,
    submit: () => fireEvent.click(screen.getByTestId("confirm-upload-form-button")),
  };
}

it("holds metadata and duplicate submission until its original uncertain command is confirmed", async () => {
  const answer = deferred<WardCommandOutcome>();
  const confirmation = deferred<WardCommandOutcome>();
  const dispatch = vi.fn<WardCommandDispatch>(() => answer.promise);
  const h = setup(dispatch);
  h.submit();
  await act(async () =>
    answer.resolve({ commandId: "synthetic-upload", status: "failed", confirmation: confirmation.promise }),
  );
  expect(h.type).toHaveValue("Clinical transfer summary");
  expect(h.type).toBeDisabled();
  h.submit();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(dispatch).toHaveBeenCalledTimes(1);
  expect(h.close).not.toHaveBeenCalled();
  await act(async () =>
    confirmation.resolve({ commandId: "synthetic-upload", status: "accepted", isCurrent: () => true }),
  );
  expect(h.close).toHaveBeenCalledTimes(1);
});

it("keeps document choices on refusal and closes only after the subsequent accepted save", async () => {
  const dispatch = vi
    .fn<WardCommandDispatch>()
    .mockReturnValueOnce({ commandId: "synthetic-refusal", status: "refused", message: "Synthetic refusal" })
    .mockReturnValueOnce({ commandId: "synthetic-accepted", status: "accepted", isCurrent: () => true });
  const h = setup(dispatch);
  h.submit();
  expect(h.type).toHaveValue("Clinical transfer summary");
  expect(h.type).not.toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent("Synthetic refusal");
  expect(h.close).not.toHaveBeenCalled();
  h.submit();
  expect(h.close).toHaveBeenCalledTimes(1);
});

it("does not let an old confirmation close a newly opened metadata dialog", async () => {
  const confirmation = deferred<WardCommandOutcome>();
  const dispatch = vi.fn<WardCommandDispatch>(() => ({
    commandId: "synthetic-old",
    status: "failed",
    confirmation: confirmation.promise,
  }));
  const h = setup(dispatch);
  h.submit();
  h.rerender(h.tree(false));
  h.rerender(h.tree(true));
  await act(async () =>
    confirmation.resolve({ commandId: "synthetic-old", status: "accepted", isCurrent: () => true }),
  );
  expect(h.close).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Document / Statutory Form Type")).toHaveValue("");
});
