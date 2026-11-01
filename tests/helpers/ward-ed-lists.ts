import { expect, type Page } from "playwright/test";

/**
 * Opens the ED board's Lists the way a clinician does, so a list row (the referral inbox, for one)
 * can be read and used.
 *
 * On a desktop the Lists are one open card under the board (handover build, Josh, 1 Nov 2026), so
 * there is nothing to open. On a phone the Lists are a pane chosen from the board's pane switch; this
 * chooses Lists, and leaves a chosen pane as it is, so calling it twice does not close the Lists.
 */
export async function openEdLists(page: Page) {
  const screen = page.getByTestId("ward-ed-screen");
  const card = screen.getByRole("region", { name: /^Lists/u });
  const pane = screen.getByRole("radio", { name: /^Lists/u });
  await expect(card.or(pane).first(), "the ED board offers its Lists as a card or a pane").toBeVisible({
    timeout: 15_000,
  });
  if ((await pane.count()) === 0) return;
  if ((await pane.getAttribute("aria-checked")) !== "true") await pane.click();
  await expect(pane).toHaveAttribute("aria-checked", "true");
}
