// Alerts redesign (Josh, 1 Nov 2026, Q184): Broadcast alert sits under the hero's More menu on every
// screen size, so a test that opens the composer goes through More first.
import { fireEvent, screen, within } from "@testing-library/react";

/** The hero's More button, which is also the composer's trigger (focus returns to it). */
export function alertsMoreButton(): HTMLElement {
  return screen.getByRole("button", { name: "More alert actions" });
}

/** Opens the hero's More menu and returns its Broadcast alert item. */
export function alertsBroadcastItem(): HTMLElement {
  fireEvent.click(alertsMoreButton());
  return within(screen.getByRole("menu")).getByRole("menuitem", { name: /Broadcast alert/ });
}

/** Opens the broadcast composer from the hero's More menu, as a desk that may broadcast. */
export function openAlertsBroadcast(): void {
  fireEvent.click(alertsBroadcastItem());
}
