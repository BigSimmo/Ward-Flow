import { fireEvent, screen, within } from "@testing-library/react";

/** D-80 item 17: the coordinator gives its "on behalf of the ward" reason before a ward's record opens. */
export function giveOnBehalfReason(reason = "The ward asked for help"): void {
  const form = screen.getByTestId("ward-on-behalf-reason");
  fireEvent.click(within(form).getByRole("radio", { name: reason }));
  fireEvent.click(within(form).getByRole("button", { name: "Open record" }));
}
