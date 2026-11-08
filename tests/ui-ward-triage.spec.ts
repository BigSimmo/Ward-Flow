import { expect, test, type Page } from "playwright/test";

/**
 * Triage and risk (Josh's approved mock-up, built into the app 7 Nov 2026). One journey through the
 * app's own controls: New in the app bar, then Triage, choose a synthetic person, the form opens
 * blank, fill every needed answer, sign, and the signed triage shows on the patient record. A
 * second journey checks the phone's Create sheet offers New triage beside New referral.
 *
 * Synthetic data only: the typed answers below are invented, and the record must show the codes
 * alone (urgency, outcome, legal status, review, flag count), never the typed text.
 */

const TYPED_NOTE = "Why now: Synthetic test patient, three days of rising distress.";

async function choose(page: Page, group: string, option: string) {
  await page
    .getByRole("radiogroup", { name: group, exact: true })
    .getByRole("radio", { name: option, exact: true })
    .first()
    .click();
}

/** The first referral awaiting triage, else the first person a search finds. */
async function pickPerson(page: Page) {
  await expect(page.getByTestId("triage-start")).toBeVisible();
  const awaiting = page.getByRole("list", { name: "Referrals awaiting triage" }).getByTestId("triage-start-person");
  if ((await awaiting.count()) > 0) {
    await awaiting.first().click();
    return;
  }
  await page.getByLabel("Search by name, UMRN or date of birth").fill("a");
  await page.getByRole("list", { name: "Matching people" }).getByTestId("triage-start-person").first().click();
}

async function fillTriage(page: Page) {
  await page.locator("#triage-rev").getByRole("button", { name: "Now", exact: true }).click();
  await choose(page, "How", "In person");
  await choose(page, "Where they were", "Emergency department");
  await choose(page, "Referral type", "Medical practitioner");
  // Program comes from the desk as one fact line with Change.
  await expect(page.getByTestId("triage-program")).toContainText("Program ");
  await choose(page, "Person present", "Yes");
  await choose(page, "Purpose", "Assessment");
  await choose(page, "Episode", "ED episode");
  await page
    .getByRole("textbox", { name: "Assessment", exact: true })
    .fill(`${TYPED_NOTE}\nRequest: Assessment today.`);
  // A problem from More that is not common shows as a chosen chip, so it can be cleared.
  await page.getByTestId("triage-problems-more").click();
  await page.keyboard.type("grief");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("group", { name: "Problems", exact: true }).getByRole("button", { name: "Grief or loss" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .locator("#triage-mse-box")
    .fill(
      [
        "Appearance and behaviour: Calm",
        "Speech: Normal rate",
        "Mood and affect: Anxious",
        "Thought form: Linear",
        "Thought content: No delusions",
        "Perception: No perceptual disturbance",
        "Cognition: Alert, oriented",
        "Insight and judgement: Partial insight",
      ].join("\n"),
    );
  await page.getByRole("radiogroup", { name: "Urgency", exact: true }).getByRole("radio").nth(2).click();
  // Referred on with no "Referred to" action nudges for one; Accepted does not.
  await choose(page, "Outcome", "Referred on");
  await expect(page.getByTestId("triage-referred-nudge")).toBeVisible();
  await choose(page, "Outcome", "Accepted");
  await expect(page.getByTestId("triage-referred-nudge")).toHaveCount(0);
  await choose(page, "Mental Health Act", "Community treatment order");
  await choose(page, "Rest of history", "Not present");
  await page.locator('[data-factor="general.now.agit"] button').first().click();
  await choose(page, "Rest of current risk", "Not present");
  await page.locator("#triage-rest-ok").click();
  await choose(page, "Asked alone", "Yes");
  for (const question of await page.locator("[data-fdv-question]").all())
    await question.getByRole("radio", { name: "No", exact: true }).click();
  await page
    .locator("#triage-rp")
    .fill("Risk: Synthetic distress.\nProtective: Engaged.\nPlan: Follow up in 72 hours.");
  await choose(page, "Risk may change quickly", "No");
  await choose(page, "Factors add uncertainty", "No");
  await choose(page, "Review risk by", "72 hours");
}

test.describe("@mockup triage and risk", () => {
  test("New, then Triage, opens a blank form that signs to the patient record", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/ward-flow", { waitUntil: "load" });

    const newButton = page.getByTestId("ward-bar-primary-action");
    await expect(newButton).toHaveText("New");
    await expect(newButton).toHaveAttribute("aria-haspopup", "menu");
    await newButton.click();
    const menu = page.getByRole("menu", { name: "New" });
    await expect(menu.getByRole("menuitem")).toHaveCount(2);
    await expect(page.getByTestId("ward-new-triage")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(newButton).toBeFocused();

    await newButton.click();
    await page.getByTestId("ward-new-triage").click();
    await expect(page).toHaveURL(/\/ward-flow\/triage\/new$/);
    await pickPerson(page);
    await expect(page).toHaveURL(/\/ward-flow\/people\/[^/]+\/triage$/);
    await expect(page.getByTestId("triage-risk-page")).toBeVisible();
    // Nothing clinical pre-selected: only the two layout switches are set.
    const checked = await page
      .locator('[role="radio"][aria-checked="true"]')
      .evaluateAll((radios) => radios.map((radio) => radio.closest('[role="radiogroup"]')?.getAttribute("aria-label")));
    expect(checked.filter((group) => group !== "Mental state layout" && group !== "Past or current")).toEqual([]);

    await fillTriage(page);
    await page.getByTestId("triage-sign-foot").getByRole("button", { name: "Sign and send" }).click();
    const dialog = page.getByTestId("triage-sign-dialog");
    await dialog.getByRole("button", { name: "Sign", exact: true }).click();
    await expect(page.getByTestId("triage-signed")).toBeVisible();
    await expect(page.getByTestId("triage-signed-tag")).toContainText("by Dr S. Chen");

    await page.getByTestId("triage-signed").getByRole("link", { name: "Open patient record" }).click();
    await expect(page).toHaveURL(/\/ward-flow\/people\/[^/]+$/);
    const card = page.getByTestId("patient-triage-card");
    await expect(card).toContainText("Signed ");
    await expect(card).toContainText("Urgency C, within 12 hours");
    await expect(card).toContainText("Community treatment order (as chosen). Not legally checked.");
    await expect(card).not.toContainText("Synthetic test patient");
  });

  test("the phone's Create sheet offers New triage beside New referral", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/ward-flow", { waitUntil: "load" });
    await page.getByTestId("ward-phone-create").click();
    const sheet = page.getByTestId("ward-phone-create-sheet");
    await expect(sheet.getByTestId("ward-phone-create-referral")).toBeVisible();
    await sheet.getByTestId("ward-phone-create-triage").click();
    await expect(page).toHaveURL(/\/ward-flow\/triage\/new$/);
    await expect(page.getByTestId("triage-start")).toBeVisible();
  });
});
