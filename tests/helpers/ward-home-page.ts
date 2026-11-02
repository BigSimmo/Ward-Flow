// Home v7, Josh 22 Oct 2026: Home opens on My list, and the priority queue sits behind the
// "Open" switch (renamed from "Everyone waiting" in the Home build, 31 Oct 2026, then "Waiting", then "Open" in Q260). Journeys that read or pick queue rows choose it first, as a
// coordinator would.
import { expect, type Page } from "playwright/test";

/**
 * Switches Home's list to Open (the priority queue); does nothing when it is showing.
 * A click that lands before Home hydrates is lost, so it clicks again until the switch takes it.
 */
export async function showEveryoneWaitingOn(page: Page): Promise<void> {
  // Find a bed in an open Tools sheet has its own "Open" bed filter, so Home's switch is the one outside it.
  const everyone = page
    .getByRole("radio", { name: /^Open/u })
    .locator('xpath=self::*[not(ancestor::*[@data-testid="ward-bar-tools-sheet"])]');
  await expect(everyone).toBeVisible({ timeout: 15_000 });
  await expect(async () => {
    if ((await everyone.getAttribute("aria-checked")) !== "true") await everyone.click();
    await expect(everyone).toHaveAttribute("aria-checked", "true", { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}
