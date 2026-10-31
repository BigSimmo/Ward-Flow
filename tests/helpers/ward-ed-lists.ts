import { expect, type Page } from "playwright/test";

/**
 * Opens the ED board's Lists the way a clinician does, so a list row (the referral inbox, for one)
 * can be read and used.
 *
 * On a desktop the ED board redesign (Josh, 31 Oct 2026) folds the Lists under the board behind one
 * closed "Lists by step" row, because the board already shows those people; this opens that row. On
 * a phone the Lists are a pane chosen from the board's pane switch; this chooses Lists. Either way it
 * leaves an open fold or a chosen pane as it is, so calling it twice does not close the Lists again.
 */
export async function openEdLists(page: Page) {
  const screen = page.getByTestId("ward-ed-screen");
  const fold = screen.locator("details").filter({ has: page.locator("summary", { hasText: /^Lists by step/u }) });
  const pane = screen.getByRole("radio", { name: /^Lists/u });
  await expect(fold.or(pane).first(), "the ED board offers its Lists as a fold or a pane").toBeVisible({
    timeout: 15_000,
  });
  if ((await fold.count()) > 0) {
    if ((await fold.getAttribute("open")) === null) await fold.locator("summary").click();
    await expect(fold).toHaveAttribute("open", "");
    return;
  }
  if ((await pane.getAttribute("aria-checked")) !== "true") await pane.click();
  await expect(pane).toHaveAttribute("aria-checked", "true");
}
