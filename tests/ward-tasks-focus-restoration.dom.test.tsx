import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";

import { WardTasksDrawer } from "@/components/ward-management/ward-tasks-drawer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// These tests cover the Tasks words. The One Alerts queue flag (on by default in development) has
// its own words, tested in tests/ward-alerts-one-queue.dom.test.tsx. Set before each test and not
// reset after, so no flag change re-renders a tree that is being torn down.
beforeEach(() => setWardFeatureFlagOnDevice("alerts-one-queue", false));

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
