import { fireEvent, render, screen, within } from "@testing-library/react";

/**
 * Population guards exercise every live row. The Waiting board folds the lower blocker groups (By
 * blocker) or wait bands (Longest wait) and shows the first few rows of each, so this opens every
 * group and band and every "Show N more" before returning.
 */
export function renderAllDelays(...args: Parameters<typeof render>): ReturnType<typeof render> {
  const result = render(...args);
  // Fail here, by name, if the board did not render, rather than in a caller's later assertion.
  screen.getByRole("region", { name: "Waiting" });
  showEveryDelayRow();
  return result;
}

/** Opens every folded blocker group or wait band, and every "Show N more" row, in the Waiting table. */
export function showEveryDelayRow(): void {
  const waiting = screen.queryByRole("region", { name: "Waiting" });
  if (waiting === null) return;
  for (const header of within(waiting).queryAllByTestId(/^delays-(?:cause|band|attention-group)/u)) {
    if (header.getAttribute("aria-expanded") === "false") fireEvent.click(header);
  }
  for (const more of within(waiting).queryAllByRole("button", { name: /^Show (?:all )?\d+(?: more)?$/u })) {
    fireEvent.click(more);
  }
}

/**
 * Opens a person's row and returns their drawer (head, body and foot; drawer review, 6 Nov 2026).
 * Clears filters that hide them first.
 */
export function inspectDelayPerson(id: string): HTMLElement {
  if (screen.queryByTestId(`delays-select-${id}`) === null) showEveryDelayRow();
  const hidden = screen.queryByTestId("delays-hidden-note");
  if (screen.queryByTestId(`delays-select-${id}`) === null && hidden !== null) {
    fireEvent.click(within(hidden).getByRole("button", { name: "Show everyone" }));
    showEveryDelayRow();
  }
  const trigger = screen.getByTestId(`delays-select-${id}`);
  if (trigger.getAttribute("aria-expanded") !== "true") fireEvent.click(trigger);
  return screen.getByTestId(`delays-detail-${id}`);
}

/**
 * The whole open person drawer (the Movement drawer, with Waiting's lead inside it), not only the
 * lead block `inspectDelayPerson` returns. Simplification mock-up (26 Nov 2026): on a laptop the
 * coordinator's person opens in the Movement drawer; the phone sheet and ward and ED desks keep the
 * Waiting person panel.
 */
export function delayPersonDrawer(id: string): HTMLElement {
  let node: HTMLElement | null = inspectDelayPerson(id);
  while (
    node !== null &&
    node.querySelector(
      '[data-testid="ward-movement-drawer-more"], [data-testid="wf-drawer-pager"], [data-testid="ward-movement-drawer-urgent-toggle"]',
    ) === null
  )
    node = node.parentElement;
  if (node === null) throw new Error(`the open drawer for ${id} was not found`);
  return node;
}

/**
 * Opens Today's follow-up (Escalated, Attention, Done today) from the list head's Follow-up button.
 * Simplification mock-up (26 Nov 2026): on a laptop the registers no longer sit beside the list; they
 * open as a side sheet. Does nothing where the registers are already on screen (phone cards, ward desk).
 */
export function openFollowUp(): void {
  const button = screen.queryByTestId("delays-follow-up");
  if (button !== null && button.getAttribute("aria-expanded") !== "true") fireEvent.click(button);
}

/**
 * The Filters menu item (Locked bed, No update 2h+, the saved views), opened from the list head.
 * Simplification mock-up (26 Nov 2026): these folded into one kit Filters menu; each is a
 * `menuitemcheckbox` ticked while on, no longer a pressed chip. Opens the menu if it is closed.
 */
export function filterMenuItem(name: RegExp | string): HTMLElement {
  const trigger = screen.getByTestId("delays-filters");
  if (screen.queryByRole("menu") === null) fireEvent.click(trigger);
  return screen.getByRole("menuitemcheckbox", { name });
}

/** Presses a Filters menu item once. Selecting closes the menu, so the next call reopens it. */
export function toggleFilter(name: RegExp | string): void {
  fireEvent.click(filterMenuItem(name));
  if (screen.queryByRole("menu") !== null) fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
}

/** Whether a Filters menu item is ticked, read by opening the menu and closing it again. */
export function filterIsOn(name: RegExp | string): boolean {
  const on = filterMenuItem(name).getAttribute("aria-checked") === "true";
  if (screen.queryByRole("menu") !== null) fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
  return on;
}
