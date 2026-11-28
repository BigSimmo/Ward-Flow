import { expect, type Page } from "playwright/test";

/**
 * Opens the ED board's lists the way a clinician does, so a list row (the referral inbox, for one)
 * can be read and used.
 *
 * Batch 1 item 14 (26 Nov 2026, r10): Lists joined My list, and the board's tabs are Board and My
 * list on every size, so this chooses My list (the card that holds the referral inbox, Awaiting
 * review, Expected and Forms). A chosen tab is left as it is, so calling it twice does not close it.
 */
export async function openEdLists(page: Page) {
  const screen = page.getByTestId("ward-ed-screen");
  const pane = screen.getByRole("radio", { name: /^My list/u });
  await expect(pane, "the ED board offers its lists as the My list tab").toBeVisible({ timeout: 15_000 });
  if ((await pane.getAttribute("aria-checked")) !== "true") await pane.click();
  await expect(pane).toHaveAttribute("aria-checked", "true");
  await expect(screen.getByTestId("ward-ed-my-list")).toBeVisible();
}
