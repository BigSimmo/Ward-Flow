import { fireEvent, render, screen, within } from "@testing-library/react";

/** Population guards exercise every live row by using the worklist's actual page-size control. */
export function renderAllDelays(...args: Parameters<typeof render>): ReturnType<typeof render> {
  const result = render(...args);
  const waiting = screen.getByRole("region", { name: "Waiting" });
  fireEvent.change(within(waiting).getByRole("combobox", { name: "Rows per page" }), { target: { value: "100" } });
  return result;
}

/** The compact October designs keep the existing clinical tools behind an explicit disclosure. */
export function inspectDelayPerson(id: string): HTMLElement {
  fireEvent.click(screen.getByTestId(`delays-select-${id}`));
  const summary = screen.getByText("Patient actions and full details");
  const disclosure = summary.closest("details");
  if (!disclosure) throw new Error("Selected delay has no patient-tools disclosure");
  disclosure.open = true;
  return screen.getByRole("region", { name: "Why this person is waiting" });
}
