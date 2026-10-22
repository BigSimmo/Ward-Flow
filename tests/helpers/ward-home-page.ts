// Home v7, Josh 22 Oct 2026: Home opens on My list, and the priority queue sits behind the
// "Everyone waiting" switch. Journeys that read or pick queue rows choose it first, as a
// coordinator would.
import { expect, type Page } from "playwright/test";

/** Switches Home's list to Everyone waiting (the priority queue); does nothing when it is showing. */
export async function showEveryoneWaitingOn(page: Page): Promise<void> {
  const everyone = page.getByRole("radio", { name: /^Everyone waiting/u });
  await expect(everyone).toBeVisible({ timeout: 15_000 });
  if ((await everyone.getAttribute("aria-checked")) !== "true") await everyone.click();
  await expect(everyone).toHaveAttribute("aria-checked", "true");
}
