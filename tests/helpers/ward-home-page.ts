// Home v7, Josh 22 Oct 2026: Home opens on My list, and the priority queue sat behind a list switch.
//
// Home flow (Q340, Q341, Q345, 3 Nov 2026) made the lists "Needs you" and "Flow". r10 (simplification
// area 2 item 1, built 28 Nov 2026) folded Flow into Waiting: every open movement is a Waiting row
// (`delays-row-<id>`), the row opens the person's drawer, and the drawer foot's More menu (or a plain
// "Open on Home" link for a desk that cannot find beds) opens Home's Placement drawer for that
// movement. These helpers walk that path the way a coordinator does. Today's review sits under
// Home's "More for this list" menu.
import { expect, type Locator, type Page } from "playwright/test";

import { goViaNav } from "./ward-release-gate";

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
 * Opens Waiting, where every open movement is listed now that Flow folded into it (r10). Goes
 * through the app's own navigation (a client-side step, so a journey's no-reload check holds);
 * does nothing when Waiting is already showing. The name is kept from the "Everyone waiting" switch
 * so the journeys that call it read the same.
 */
export async function showEveryoneWaitingOn(page: Page): Promise<void> {
  if (new URL(page.url()).pathname === "/bedchart/waiting") {
    await expect(page.getByTestId("ward-delays-page")).toBeVisible();
    return;
  }
  await goViaNav(page, "/bedchart/waiting", "ward-delays-page");
}

/**
 * Switches Home's list to Needs you, where referrals to decide are listed (Home flow, Q340), and
 * opens that group's "Show N more" so every referral row shows. On desktop Needs you is Home's only
 * list (no switch), so there is nothing to choose.
 */
export async function showNeedsYouReferrals(page: Page): Promise<Locator> {
  if ((await page.getByRole("radio", { name: /^Needs you/u }).count()) > 0) await chooseHomeList(page, /^Needs you/u);
  const group = page.getByTestId("home-my-list").getByRole("region", { name: "Referrals to decide", exact: true });
  await expect(group).toBeVisible();
  const more = group.getByRole("button", { name: /^Show \d+ more$/u });
  if ((await more.count()) > 0 && (await more.getAttribute("aria-expanded")) !== "true") await more.click();
  return group;
}

/** The list that holds every open movement: Waiting's board (was Home's "Flow" card, r10). */
export function homeFlowCard(page: Page): Locator {
  return page.getByTestId("ward-delays-page");
}

/** One movement's row on Waiting (was `ward-queue-row-<id>` on Home's Flow card). */
export function waitingRow(scope: Page | Locator, movementId: string): Locator {
  return scope.getByTestId(`delays-row-${movementId}`);
}

/**
 * Opens every Waiting group that hides rows: a folded group (its head button) and a group's "Show
 * all N" or "Show N more" (the about-eight list rule). Each click opens one, so the closed set
 * shrinks each time.
 */
export async function showAllFlowRows(queue: Locator): Promise<void> {
  const folded = queue.locator(
    '[data-testid="delays-attention-group"][aria-expanded="false"], [data-testid^="delays-band-"][aria-expanded="false"]',
  );
  for (let guard = 0; guard < 10 && (await folded.count()) > 0; guard += 1) {
    const before = await folded.count();
    await folded.first().click();
    await expect(folded).toHaveCount(before - 1);
  }
  const more = queue.locator('tr[role="row"] button[data-wf-show-more]:not([aria-expanded="true"])');
  for (let guard = 0; guard < 10 && (await more.count()) > 0; guard += 1) {
    const before = await more.count();
    await more.first().click();
    await expect(more).toHaveCount(before - 1);
  }
}

/** Shows the movement's Waiting row, opening Waiting and its folded groups when needed. */
export async function revealWaitingRow(page: Page, movementId: string): Promise<Locator> {
  await showEveryoneWaitingOn(page);
  const queue = homeFlowCard(page);
  const row = waitingRow(queue, movementId);
  await expect(queue.locator('[data-testid^="delays-row-"]').first()).toBeVisible();
  if (!(await row.isVisible())) await showAllFlowRows(queue);
  await expect(row).toBeVisible();
  return row;
}

/**
 * From an open Waiting drawer, its foot's "Open on Home": a More menu item for a desk that finds
 * beds, else a plain link. Home then opens Placement for that movement.
 */
export async function openOnHomeFromWaiting(page: Page, movementId: string): Promise<Locator> {
  const door = page.getByTestId(`delays-foot-coordinator-${movementId}`);
  await expect(door).toBeVisible();
  if ((await door.evaluate((element) => element.tagName)) === "A") await door.click();
  else {
    await door.click();
    await page.getByRole("menuitem", { name: "Open on Home", exact: true }).click();
  }
  await page.waitForURL((url) => url.pathname === "/bedchart");
  const placement = page.getByRole("complementary", { name: "Placement", exact: true });
  await expect(placement).toHaveAttribute("data-subject-movement", movementId);
  return placement;
}

/**
 * Opens Home's Placement for one movement the r10 way: its Waiting row, the person's drawer, then
 * the drawer's Open on Home. Returns the Placement drawer.
 */
export async function openPlacementFromWaiting(page: Page, movementId: string): Promise<Locator> {
  await revealWaitingRow(page, movementId);
  await page.getByTestId(`delays-select-${movementId}`).click();
  return openOnHomeFromWaiting(page, movementId);
}

/**
 * Opens Today's review from Home's "More for this list" menu (Home notes 4: it replaced Registers).
 * Batch 3 (one Handover, r10): it is Governance's Review tab now, so the menu goes there.
 */
export async function openTodaysReview(page: Page): Promise<void> {
  await page.getByRole("button", { name: "More for this list" }).click();
  await page
    .getByRole("menu", { name: "More for this list" })
    .getByRole("menuitem", { name: "Today's review" })
    .click();
  await page.waitForURL((url) => url.pathname === "/bedchart/governance" && url.searchParams.get("tab") === "review");
  await page.getByTestId("ward-mode-governance").waitFor();
}
