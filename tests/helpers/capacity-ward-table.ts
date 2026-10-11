// Device audit option A (Capacity, 11 Oct 2026): the ward table is the bed map's Table layout,
// not a second list under the map. Suites that read the table open that layout first, through the
// map's own control, as a coordinator would.
import { fireEvent, screen, within } from "@testing-library/react";

export function showWardTable(): void {
  const layouts = screen.getByRole("group", { name: "Bed map layout" });
  fireEvent.click(within(layouts).getByRole("button", { name: "Table" }));
}
