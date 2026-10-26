/** @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Sheet } from "@/components/wf/sheet";
import { PhoneSheet } from "@/components/wf/phone";
import { OverlayRoot } from "@/components/wf/overlay-root";
import { ToastProvider, useToast } from "@/components/wf/toast-provider";

beforeEach(() => {
  // Match browsers that report rectangles even inside a closed native disclosure.
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({ length: 1 } as DOMRectList);
});
afterEach(() => vi.restoreAllMocks());

function Contents() {
  const toast = useToast();
  return (
    <>
      <details>
        <summary>More actions</summary>
        <button type="button">Inside disclosure</button>
      </details>
      <button
        type="button"
        onClick={() =>
          toast.push({ title: "Draft discarded", tone: "info", undo: { durationMs: 5000, onUndo: () => {} } })
        }
      >
        Discard draft
      </button>
    </>
  );
}

describe.each([Sheet, PhoneSheet])("modal Tab targets (%s)", (Component) => {
  it("skips closed disclosure content in both directions and includes it after opening", () => {
    render(
      <ToastProvider>
        <OverlayRoot />
        <Component open title="Actions" onClose={() => {}}>
          <Contents />
        </Component>
      </ToastProvider>,
    );
    const summary = screen.getByText("More actions");
    const discard = screen.getByRole("button", { name: "Discard draft" });
    const inside = screen.getByText("Inside disclosure");
    summary.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(discard).toHaveFocus();
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(summary).toHaveFocus();
    summary.closest("details")!.open = true;
    fireEvent.keyDown(window, { key: "Tab" });
    expect(inside).toHaveFocus();
    summary.closest("details")!.open = false;
    discard.focus();
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(summary).toHaveFocus();
  });

  it("includes a portalled Undo toast in the top modal's forward and reverse cycle", () => {
    render(
      <ToastProvider>
        <OverlayRoot />
        <Component open title="Actions" onClose={() => {}}>
          <Contents />
        </Component>
      </ToastProvider>,
    );
    const discard = screen.getByRole("button", { name: "Discard draft" });
    fireEvent.click(discard);
    const undo = screen.getByRole("button", { name: "Undo" });
    discard.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(undo).toHaveFocus();
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(discard).toHaveFocus();
  });
});
