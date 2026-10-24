/** @vitest-environment jsdom */
import { useRef, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToastProvider, useToast } from "@/components/wf/toast-provider";

function Actions({ removeTrigger = false, moveOnUndo = false }: { removeTrigger?: boolean; moveOnUndo?: boolean }) {
  const toast = useToast();
  const [draft, setDraft] = useState(true);
  const next = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button type="button">Edit rules</button>
      {draft ? (
        <button
          type="button"
          onClick={() => {
            if (removeTrigger) setDraft(false);
            toast.push({
              title: "Draft discarded",
              tone: "info",
              undo: {
                durationMs: 5000,
                onUndo: () => {
                  if (moveOnUndo) next.current?.focus();
                },
              },
            });
          }}
        >
          Discard draft
        </button>
      ) : null}
      <button ref={next} type="button">
        Next task
      </button>
      <button type="button" onClick={() => toast.push({ title: "Copied", tone: "info", duration: 0 })}>
        Copy summary
      </button>
    </>
  );
}

describe("toast focus return", () => {
  it.each([false, true])(
    "returns to a surviving workflow control after Undo (removed trigger: %s)",
    (removeTrigger) => {
      render(
        <ToastProvider>
          <Actions removeTrigger={removeTrigger} />
        </ToastProvider>,
      );
      const edit = screen.getByRole("button", { name: "Edit rules" });
      edit.focus();
      const discard = screen.getByRole("button", { name: "Discard draft" });
      discard.focus();
      fireEvent.click(discard);
      const undo = screen.getByRole("button", { name: "Undo" });
      undo.focus();
      fireEvent.click(undo);
      expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
      expect(removeTrigger ? edit : discard).toHaveFocus();
    },
  );

  it("returns focus after Dismiss without stealing focus from an action's chosen target", () => {
    const view = render(
      <ToastProvider>
        <Actions moveOnUndo />
      </ToastProvider>,
    );
    const copy = screen.getByRole("button", { name: "Copy summary" });
    copy.focus();
    fireEvent.click(copy);
    const dismiss = screen.getByRole("button", { name: "Dismiss: Copied" });
    dismiss.focus();
    fireEvent.click(dismiss);
    expect(copy).toHaveFocus();
    view.rerender(
      <ToastProvider>
        <Actions moveOnUndo />
      </ToastProvider>,
    );
    const discard = screen.getByRole("button", { name: "Discard draft" });
    discard.focus();
    fireEvent.click(discard);
    const undo = screen.getByRole("button", { name: "Undo" });
    undo.focus();
    fireEvent.click(undo);
    expect(screen.getByRole("button", { name: "Next task" })).toHaveFocus();
  });
});
