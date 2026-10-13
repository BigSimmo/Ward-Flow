import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";

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
      items={[]}
      acknowledgements={{}}
      completions={{}}
      role="coordinator"
      now={NOW_ANCHOR}
      dispatch={vi.fn()}
      onClose={() => setOpen(false)}
      onSelectMovement={() => {}}
    />
  ) : null;
}
async function afterFrames() {
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

it("keeps focus on the connected opener after a no-backdrop drawer closes and unmounts", async () => {
  const previous = opener();
  render(<Harness />);
  const drawer = screen.getByRole("complementary", { name: "Tasks" });
  expect(drawer.contains(document.activeElement)).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Close tasks panel" }));
  expect(screen.queryByRole("complementary", { name: "Tasks" })).toBeNull();
  expect(previous).toHaveFocus();
  await afterFrames();
  expect(previous).toHaveFocus();
});

it("does not attempt to restore focus to an opener removed while the drawer is open", async () => {
  const previous = opener();
  render(<Harness />);
  expect(screen.getByRole("complementary", { name: "Tasks" }).contains(document.activeElement)).toBe(true);
  previous.remove();
  fireEvent.click(screen.getByRole("button", { name: "Close tasks panel" }));
  await afterFrames();
  expect(previous.isConnected).toBe(false);
  expect(document.activeElement).toBe(document.body);
});
