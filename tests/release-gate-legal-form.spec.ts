import { expect, test, type Locator, type Page } from "playwright/test";

import { expectAccessible, expectNoReloadSince, plantSentinel, waitForScreen } from "./helpers/ward-release-gate";

/**
 * The release gate's legal form journey (Tier 1 item 7, Josh 4 Nov 2026: "Yes to all
 * recommendations"): filing a Mental Health Act form from the Forms page.
 *
 * A Form 1A lodged on an ED move with no time written is opened on Forms. The coordinator types the
 * date and time written on the paper with its region and age band, marks the paper received, takes
 * the receipt back from its Undo toast, marks it again, and the move's own page then shows the form.
 *
 * Times are only ever as typed (Josh, 31 Oct 2026): nothing here checks a worked-out legal time.
 * Starts from one typed URL and then moves only through the app's own links, like the other
 * release-gate journeys, with an axe check at each key step. Synthetic data only.
 */

test.describe.configure({ timeout: 120_000 });

/** Today's date in Perth as the date field takes it. The demo day starts on the real Perth day. */
function perthToday(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Australia/Perth",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
}

/** A first-visit tip can sit over the panel's buttons; it is screen help, not part of the journey. */
async function dismissTip(page: Page) {
  const tip = page.getByTestId("ward-help-hint");
  if (await tip.isVisible()) await tip.getByRole("button", { name: "Got it" }).click();
}

/** The toast an action raised, found by its title so an older toast cannot answer for it. */
function toastFor(page: Page, title: string): Locator {
  return page.locator("[data-wf-toast]").filter({ hasText: title });
}

test("Legal form: a Form 1A gets its time written and is marked received, the receipt undoes, and the move shows the form", async ({
  page,
}, testInfo) => {
  await page.goto("/ward-flow/legal-forms", { waitUntil: "load" });
  await waitForScreen(page, "ward-legal-forms-page");
  await plantSentinel(page);
  await dismissTip(page);
  await expectAccessible(page, testInfo, "Forms page");

  // Any Form 1A in the seed with no time written and no expiry typed. Its row's label leads with the
  // person's name, then (on the phone) their UMRN.
  const rowLabel = /^([^,]+, [^,]+), (?:UM\d+, )?Form 1A \(.*No deadline recorded/u;
  const row = page.getByRole("button", { name: rowLabel }).first();
  await expect(row).toBeVisible();
  const name = rowLabel.exec((await row.getAttribute("aria-label")) ?? "")?.[1] ?? "";
  expect(name, "the row's label leads with the person's name").not.toBe("");
  await dismissTip(page);
  await row.click();

  const panel = page.getByTestId("ward-legal-selected");
  await expect(panel).toBeVisible();
  await expect(panel.getByText("Add the time written")).toBeVisible();
  await expectAccessible(page, testInfo, "Form 1A open, time not written");
  await dismissTip(page);

  // The time written on the paper, with the region and age band typed from it.
  await panel.getByLabel("Date written").fill(perthToday());
  await panel.getByLabel("Time", { exact: true }).fill("09:30");
  await panel.getByRole("radio", { name: "Metro", exact: true }).click();
  await panel.getByRole("radio", { name: "Adult", exact: true }).click();
  await panel.getByRole("button", { name: "Save time written" }).click();
  await expect(panel.getByText("Written 09:30 on the form")).toBeVisible();
  await expect(toastFor(page, `Form time recorded for ${name}`)).toBeVisible();

  // The paper reaches the coordinator. Received is the next step, and it offers Undo.
  const markReceived = panel.getByRole("button", { name: "Mark Form 1A received" }).first();
  await markReceived.click();
  await expect(panel.getByText("Form 1A received", { exact: true })).toBeVisible();
  const receivedToast = toastFor(page, `Form marked received for ${name}`);
  await expect(receivedToast).toBeVisible();
  await expectAccessible(page, testInfo, "Form 1A received");

  // A receipt marked by mistake comes back from its toast, and the written time stays.
  await receivedToast.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(toastFor(page, `Received mark undone for ${name}`)).toBeVisible();
  await expect(panel.getByText("Form 1A received", { exact: true })).toHaveCount(0);
  await expect(panel.getByText("Written 09:30 on the form")).toBeVisible();

  await markReceived.click();
  await expect(panel.getByText("Form 1A received", { exact: true })).toBeVisible();
  await expectNoReloadSince(page, "filing the form");

  // The move's own page reads the same live record.
  await panel.getByRole("link", { name: "Open move" }).click();
  await page.waitForURL("**/ward-flow/movements/**");
  await waitForScreen(page, "ward-person-screen");
  // Its Legal now panel names the form the coordinator just filed.
  // (a region on the phone, a headed block on desktop, each with the form's code in bold).
  await expect(page.getByRole("heading", { name: "Legal now" })).toBeVisible();
  await expect(
    page
      .locator("strong")
      .filter({ hasText: /^Form 1A\b/u })
      .first(),
  ).toBeVisible();
  await expectAccessible(page, testInfo, "the move after the form was filed");
  await expectNoReloadSince(page, "opening the move");
});
