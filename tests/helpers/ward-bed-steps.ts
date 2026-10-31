// My ward's bed record (redesign approved 31 Oct 2026) shows one filled step and one plain step as
// buttons, and puts the rest under More. A test that asks for a bed step by name should not care
// which of the three places it is in today, so these look in all of them: a button first, then
// each bed record's More menu (opened, searched and closed again when the step is not there).
import { fireEvent, screen, within } from "@testing-library/react";

type StepName = string | RegExp;

/** The bed step named `name`, as a button or as a More menu item, or null when it is not offered. */
export function queryBedStep(name: StepName, container?: HTMLElement): HTMLElement | null {
  const root = container ? within(container) : screen;
  const direct = root.queryByRole("button", { name });
  if (direct) return direct;
  for (const bar of root.queryAllByTestId("bed-record-actions")) {
    const more = within(bar).queryByRole("button", { name: "More" });
    if (!more) continue;
    if (more.getAttribute("aria-expanded") !== "true") fireEvent.click(more);
    const item = within(bar).queryByRole("menuitem", { name });
    if (item) return item;
    fireEvent.click(more);
  }
  return null;
}

/** The bed step named `name`; throws when no bed record offers it. */
export function getBedStep(name: StepName, container?: HTMLElement): HTMLElement {
  const step = queryBedStep(name, container);
  if (!step) throw new Error(`no bed step named ${String(name)} is offered, as a button or under More`);
  return step;
}
