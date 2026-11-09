// Home v7, Josh 22 Oct 2026: Home opens on My list, and the priority queue sits behind a list
// switch. Journeys that read or pick queue rows choose it first, as a coordinator would.
//
// Home flow (Q340, Q341, Q345, 3 Nov 2026): the lists are "Needs you" and "Flow" (was My List and
// Open). Flow is one card named "Flow", with a section per stage; each stage shows its oldest 5 rows
// and its own "Show all N" button. Today's review sits under the "More for this list" menu.
import { expect, type Locator, type Page } from "playwright/test";

/** Chooses one of Home's lists by its radio, clicking again until a click lands after hydration. */
async function chooseHomeList(page: Page, name: RegExp): Promise<void> {
  // Keep to Home's own switch, outside any Tools sheet that is open over it.
  const radio = page
    .getByRole("radio", { name })
    .locator('xpath=self::*[not(ancestor::*[@data-testid="ward-bar-tools-sheet"])]');
  await expect(radio).toBeVisible({ timeout: 15_000 });
  await expect(async () => {
    if ((await radio.getAttribute("aria-checked")) !== "true") await radio.click();
    await expect(radio).toHaveAttribute("aria-checked", "true", { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}

/**
 * Switches Home's list to Flow (every open movement, by stage); does nothing when it is showing.
 * The name is kept from the "Everyone waiting" switch so the journeys that call it read the same.
 */
export async function showEveryoneWaitingOn(page: Page): Promise<void> {
  await chooseHomeList(page, /^Flow/u);
}

/**
 * Switches Home's list to Needs you, where referrals to decide are listed (Home flow, Q340), and
 * opens that group's "Show N more" so every referral row shows.
 */
export async function showNeedsYouReferrals(page: Page): Promise<Locator> {
  await chooseHomeList(page, /^Needs you/u);
  const group = page.getByTestId("home-my-list").getByRole("region", { name: "Referrals to decide", exact: true });
  await expect(group).toBeVisible();
  const more = group.getByRole("button", { name: /^Show \d+ more$/u });
  if ((await more.count()) > 0 && (await more.getAttribute("aria-expanded")) !== "true") await more.click();
  return group;
}

/** Home's Flow card (was the "Priority queue" card). */
export function homeFlowCard(page: Page): Locator {
  return page.getByRole("region", { name: "Flow", exact: true });
}

/** Opens every stage in the Flow card that hides rows behind its "Show all N" button. */
export async function showAllFlowRows(queue: Locator): Promise<void> {
  const closed = queue.locator('button[aria-expanded="false"]').filter({ hasText: /^Show all \d+$/u });
  // Each click turns its button into "Show top 5", so the closed set shrinks by one each time.
  for (let guard = 0; guard < 10 && (await closed.count()) > 0; guard += 1) {
    const before = await closed.count();
    await closed.first().click();
    await expect(closed).toHaveCount(before - 1);
  }
}

/** Opens Today's review from Home's "More for this list" menu (Home notes 4: it replaced Registers). */
export async function openTodaysReview(page: Page): Promise<void> {
  await page.getByRole("button", { name: "More for this list" }).click();
  await page
    .getByRole("menu", { name: "More for this list" })
    .getByRole("menuitem", { name: "Today's review" })
    .click();
  await page.waitForURL("**/ward-flow/review");
  await page.getByTestId("ward-todays-review").waitFor();
}
