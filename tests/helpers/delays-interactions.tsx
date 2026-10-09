import { fireEvent, render, screen, within } from "@testing-library/react";

/**
 * Population guards exercise every live row. The Delays board folds the lower blocker groups and
 * shows five rows per group, so this opens every group and every "Show N more" before returning.
 */
export function renderAllDelays(...args: Parameters<typeof render>): ReturnType<typeof render> {
  const result = render(...args);
  showEveryDelayRow();
  return result;
}

/** Opens every folded blocker group and every "Show N more" row in the Waiting table. */
export function showEveryDelayRow(): void {
  const waiting = screen.queryByRole("region", { name: "Waiting" });
  if (waiting === null) return;
  for (const header of within(waiting).queryAllByTestId(/^delays-cause-/u)) {
    if (header.getAttribute("aria-expanded") === "false") fireEvent.click(header);
  }
  for (const more of within(waiting).queryAllByRole("button", { name: /^Show \d+ more$/u })) {
    fireEvent.click(more);
  }
}

/** Opens a person's row and returns their panel in the rail. */
export function inspectDelayPerson(id: string): HTMLElement {
  if (screen.queryByTestId(`delays-select-${id}`) === null) showEveryDelayRow();
  const trigger = screen.getByTestId(`delays-select-${id}`);
  if (trigger.getAttribute("aria-expanded") !== "true") fireEvent.click(trigger);
  return screen.getByRole("region", { name: "Why this person is waiting" });
}
