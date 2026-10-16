import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { hasOpenSheet } from "@/components/wf/sheet-focus";
import { WardTasksDrawer } from "@/components/ward-management/ward-tasks-drawer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const openers: HTMLButtonElement[] = [];
afterEach(() => {
  cleanup();
  for (const opener of openers.splice(0)) opener.remove();
});

function opener() {
  const button = document.createElement("button");
  button.textContent = "Synthetic tasks opener";
  document.body.append(button);
  button.focus();
  openers.push(button);
  return button;
}
function Harness() {
  const [open, setOpen] = useState(true);
  return open ? (
    <WardTasksDrawer
      alertsScreenOpen={false}
      items={[]}
      acknowledgements={{}}
      completions={{}}
      role="coordinator"
      now={NOW_ANCHOR}
      dispatch={vi.fn()}
      onClose={() => setOpen(false)}
      onSelectMovement={() => {}}
      withBackdrop
    />
  ) : null;
}
async function afterFrames() {
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

it("keeps focus on the connected opener after a modal drawer closes and unmounts", async () => {
  const previous = opener();
  render(<Harness />);
  const drawer = screen.getByRole("dialog", { name: "Tasks" });
  expect(drawer.contains(document.activeElement)).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Close tasks panel" }));
  expect(screen.queryByRole("dialog", { name: "Tasks" })).toBeNull();
  expect(previous).toHaveFocus();
  await afterFrames();
  expect(previous).toHaveFocus();
});

it("does not attempt to restore focus to an opener removed while the drawer is open", async () => {
  const previous = opener();
  render(<Harness />);
  expect(screen.getByRole("dialog", { name: "Tasks" }).contains(document.activeElement)).toBe(true);
  previous.remove();
  fireEvent.click(screen.getByRole("button", { name: "Close tasks panel" }));
  await afterFrames();
  expect(previous.isConnected).toBe(false);
  expect(document.activeElement).toBe(document.body);
});

it("registers the open drawer on the sheet stack and stops Escape from reaching guarded board listeners", async () => {
  const previous = opener();
  const boardEscapeSpy = vi.fn();
  const onWindowKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && !event.defaultPrevented && !hasOpenSheet()) {
      boardEscapeSpy();
    }
  };
  window.addEventListener("keydown", onWindowKeyDown);
  try {
    const { unmount } = render(<Harness />);
    expect(hasOpenSheet()).toBe(true);
    const closeBtn = screen.getByRole("button", { name: "Close tasks panel" });
    fireEvent.keyDown(closeBtn, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Tasks" })).toBeNull();
    expect(hasOpenSheet()).toBe(false);
    expect(boardEscapeSpy).not.toHaveBeenCalled();
    expect(previous).toHaveFocus();
    unmount();

    // Also verify Escape dispatched on document.body exercises useWardModalFocus's window capture listener directly
    render(<Harness />);
    expect(hasOpenSheet()).toBe(true);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Tasks" })).toBeNull();
    expect(hasOpenSheet()).toBe(false);
    expect(boardEscapeSpy).not.toHaveBeenCalled();
  } finally {
    window.removeEventListener("keydown", onWindowKeyDown);
  }
});
