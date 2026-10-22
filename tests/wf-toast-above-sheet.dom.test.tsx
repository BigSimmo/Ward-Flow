/** @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OverlayRoot } from "@/components/wf/overlay-root";
import { Sheet } from "@/components/wf/sheet";
import { SHEET_INERT_SKIP_ATTRIBUTE } from "@/components/wf/sheet-focus";
import { ToastProvider, useToast } from "@/components/wf";

// Visual desk, 22 Oct 2026: "Pull the bed" in the Destination sheet raised a "Bed pulled" toast whose
// Undo could not be pressed, because the open sheet inerted the toast layer behind it.
function PullInSheet({ onUndo }: { onUndo: () => void }) {
  const toast = useToast();
  return (
    <Sheet open onClose={() => {}} title="Destination and placement" portal>
      <button
        type="button"
        onClick={() =>
          toast.push({ tone: "success", title: "Bed pulled", undo: { durationMs: 5000, onUndo, onExpire: () => {} } })
        }
      >
        Pull the bed
      </button>
    </Sheet>
  );
}

describe.each([
  ["layout OverlayRoot", true],
  ["fallback host", false],
])("toast Undo above an open sheet (%s)", (_label, withRoot) => {
  it("keeps the toast layer live and lets Undo take the click", () => {
    const onUndo = vi.fn();
    render(
      <ToastProvider>
        {withRoot ? <OverlayRoot /> : null}
        <PullInSheet onUndo={onUndo} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Pull the bed" }));
    const undo = screen.getByRole("button", { name: "Undo" });
    const host = undo.closest<HTMLElement>('[data-overlay-host="toast"]');
    expect(host).not.toBeNull();
    expect(host).toHaveAttribute(SHEET_INERT_SKIP_ATTRIBUTE);
    expect(undo.closest("[inert]")).toBeNull();
    fireEvent.click(undo);
    expect(onUndo).toHaveBeenCalledTimes(1);
  });
});
