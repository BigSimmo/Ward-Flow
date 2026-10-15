import { expect, test } from "playwright/test";

import { unitById } from "@/components/ward-management/ward-sites";
import { bedReleases, wardMovements } from "@/components/ward-management/ward-movements";

import {
  capacityReady,
  expectAccessible,
  expectNoReloadSince,
  goToDesk,
  goViaNav,
  isPhoneLayout,
  openWardFlow,
  openWardHome,
  openWardList,
  plantSentinel,
  waitForScreen,
  wardDesk,
  wardFigure,
} from "./helpers/ward-release-gate";
import { escapeForRegExp } from "./helpers/ward-place-names";

/**
 * The release gate: four core bed-flow journeys that must pass before a change ships.
 *
 * 1. ED referral to bed offer: the ED raises a referral into a movement, the coordinator offers a
 *    ward, and the ward accepts and pulls the patient.
 * 2. Morning bed meeting: a ward confirms its numbers and the coordinator's capacity board moves.
 * 3. Transfer with transport: the officer runs a booked job to delivery and the ward confirms arrival.
 * 4. Discharge with bed release: a ward confirms a release, the person leaves, and the bed is ready.
 *
 * Each runs on desktop Chrome (1440px) and phone WebKit (390x844) through the release-gate projects
 * in `playwright.config.ts`, with an axe WCAG 2.1 AA check at every key step. Each starts from one
 * typed URL and then moves only through the app's own links and drawers, so every later screen
 * reads the same live state. The longer per-screen journeys (`ui-ward-*.spec.ts`) keep the detail.
 * Synthetic data only.
 */

test.describe.configure({ timeout: 120_000 });

test("ED referral to bed offer: the ED raises a referral, the coordinator offers a ward, the ward accepts and pulls", async ({
  page,
}, testInfo) => {
  // Royal Perth's inbox holds RF-009, queued and not yet raised into a movement.
  await page.goto("/mockups/ward-flow/ed/rph-ed", { waitUntil: "load" });
  await waitForScreen(page, "ward-ed-screen");
  await plantSentinel(page);
  await expectAccessible(page, testInfo, "ED board");

  const patientRowsBefore = new Set(
    await page
      .locator('[data-testid^="ward-ed-patient-"]')
      .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-testid") ?? "")),
  );
  // The phone ED page shows its board first; the referral inbox sits under Lists.
  if (isPhoneLayout(page)) await page.getByRole("radio", { name: /^Lists/u }).click();
  await page
    .getByTestId("ward-ed-inbox-row-RF-009")
    .getByRole("button", { name: /View referral/u })
    .click();
  await page.getByTestId("ward-ed-inbox-raise-RF-009").click();
  await expect(page.getByRole("region", { name: "Raise into a movement" })).toBeVisible();
  await page.getByTestId("ward-ed-referral-cohort").selectOption("Adult");
  await page.getByTestId("ward-ed-referral-security").selectOption("Open");
  await page.getByTestId("ward-ed-referral-sex").selectOption("Male");
  await page.getByTestId("ward-ed-referral-gender").selectOption("Male");
  await page.getByTestId("ward-ed-referral-legal-status").selectOption("Voluntary");
  await page.getByTestId("ward-ed-referral-urgency").selectOption("3");
  await page.getByTestId("ward-ed-referral-specialling-not-required").click();
  await page.getByTestId("ward-ed-referral-high-acuity-not-required").click();
  await expectAccessible(page, testInfo, "ED raise form, filled");
  await page.getByTestId("ward-ed-referral-submit").click();

  const patientRowsAfter = await page
    .locator('[data-testid^="ward-ed-patient-"]')
    .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-testid") ?? ""));
  const raised = patientRowsAfter.filter((id) => !patientRowsBefore.has(id));
  expect(raised, "exactly one new movement must appear on the ED's patient board").toHaveLength(1);
  const movementId = raised[0]!.replace("ward-ed-patient-", "");
  await expectNoReloadSince(page, "raising the ED referral");

  // The coordinator offers a ward. Override offers the chosen ward directly, with a reason and a
  // second sign-off (D-30), which is the one path that offers a ward without a second referral.
  await goToDesk(page, (drawer) => drawer.getByTestId("workstation-open-coordinator"), "ward-coordinator");
  await expectAccessible(page, testInfo, "coordinator Home");
  // The phone queue shows the first twenty; a new tier 3 movement can sit below them.
  const queueRow = page.getByTestId(`ward-queue-row-${movementId}`);
  const showAll = page.getByRole("region", { name: "Priority queue" }).getByRole("button", { name: /^Show all/u });
  if (!(await queueRow.isVisible()) && (await showAll.isVisible())) await showAll.click();
  await queueRow.click();
  const shortlist = page.getByRole("complementary", { name: "Placement", exact: true });
  await expect(shortlist).toHaveAttribute("data-subject-movement", movementId);
  const candidatesToggle = shortlist.getByTestId("ward-shortlist-candidates-toggle");
  if ((await candidatesToggle.getAttribute("aria-expanded")) !== "true") await candidatesToggle.click();
  const candidate = shortlist.locator('[data-testid^="ward-shortlist-candidate-"][data-eligible="true"]').first();
  await expect(candidate, "the raised movement must have at least one eligible ward").toBeVisible();
  const unitId = ((await candidate.getAttribute("data-testid")) ?? "").replace("ward-shortlist-candidate-", "");
  expect(unitId).not.toBe("");
  await candidate.click();
  await expectAccessible(page, testInfo, "coordinator Placement with a ward chosen");
  await shortlist.getByTestId("ward-shortlist-override-toggle").click();
  await shortlist.getByLabel(/Reason for overriding/).selectOption("Clinical urgency outweighs the mismatch");
  await shortlist.getByTestId("ward-shortlist-override-second-sign-off").check();
  await shortlist.getByTestId("ward-shortlist-override-sign-off-name").fill("JS");
  await shortlist.getByRole("button", { name: "Record override" }).click();
  await expect(shortlist).toContainText("Parallel referral:");
  await expectNoReloadSince(page, "offering the ward");
  // On a phone Placement is a bottom sheet over the page and its header; close it, as a
  // coordinator would, before going to the ward.
  if (isPhoneLayout(page)) {
    await page.getByRole("button", { name: "Close shortlist and clear selection" }).click();
    await expect(shortlist).toHaveCount(0);
  }

  // The ward accepts and pulls the patient into a bed.
  const unitName = unitById(unitId)?.name;
  expect(unitName, `unit ${unitId} must resolve to a ward name`).toBeTruthy();
  await goToDesk(page, wardDesk(unitId, unitName!), "ward-unit-screen");
  await openWardFlow(page, "Referrals");
  await expectAccessible(page, testInfo, "ward Home with the offer waiting");
  // On a phone the Ward flow card is a sheet portalled outside the ward screen, so look up by page.
  const accept = page.getByTestId(`ward-accept-${movementId}`);
  await expect(accept).not.toHaveAttribute("aria-disabled", "true");
  await accept.click();
  await openWardList(page, "Admissions");
  const pull = page.getByTestId(`ward-pull-${movementId}`);
  await expect(pull).not.toHaveAttribute("aria-disabled", "true");
  await expectAccessible(page, testInfo, "ward arrivals with the accepted patient");
  await pull.click();
  await expect(pull).toHaveCount(0);
  await expectNoReloadSince(page, "the ward accepting and pulling");
});

test("Morning bed meeting: a ward confirms its numbers and the coordinator's capacity board moves", async ({
  page,
}, testInfo) => {
  const unitId = "rph-adult-secure";
  const unitName = unitById(unitId)!.name;

  await page.goto("/mockups/ward-flow/capacity", { waitUntil: "load" });
  await waitForScreen(page, "ward-capacity-page");
  await plantSentinel(page);
  const readyBefore = await capacityReady(page, unitId, unitName);
  expect(readyBefore, "fixture assumption: this ward starts with at least one ready bed").toBeGreaterThan(0);
  await expectAccessible(page, testInfo, "capacity board");

  await goToDesk(page, wardDesk(unitId, unitName), "ward-unit-screen");
  const wardScreen = page.getByTestId("ward-unit-screen");
  await expectAccessible(page, testInfo, "ward Home");
  await wardScreen.getByRole("button", { name: /Confirm (today.s )?numbers/ }).click();
  const confirmDialog = wardScreen.getByRole("dialog", { name: /Confirm capacity figures/ });
  await expect(confirmDialog).toBeVisible();
  await wardScreen.getByTestId("ward-capacity-input").fill("0");
  await expectAccessible(page, testInfo, "confirm capacity figures dialog");
  await wardScreen.getByTestId("ward-capacity-submit").click();
  await expect(wardScreen.getByText(/Currently confirmed 0 at/u)).toBeVisible();
  await confirmDialog.getByRole("button", { name: "Done" }).click();
  await expect.poll(() => wardFigure(page, "ready")).toBe(0);
  await expectNoReloadSince(page, "confirming the ward's numbers");

  await goViaNav(page, "/mockups/ward-flow/capacity", "ward-capacity-page");
  await expect.poll(() => capacityReady(page, unitId, unitName)).toBe(0);
  await expectNoReloadSince(page, "returning to the capacity board");
});

test("Transfer with transport: the officer runs a booked job to delivery and the ward confirms arrival", async ({
  page,
}, testInfo) => {
  // WF-005 is seeded with transport booked and accepted by the officer, bound for its accepted ward.
  const movementId = "WF-005";
  const unitId = wardMovements.find((movement) => movement.id === movementId)?.acceptedUnitId;
  expect(unitId, `fixture assumption: ${movementId} has an accepted ward`).toBeTruthy();
  const unitName = unitById(unitId!)!.name;

  await page.goto("/mockups/ward-flow/transport/officer", { waitUntil: "load" });
  await waitForScreen(page, "ward-officer-screen");
  await plantSentinel(page);
  await expectAccessible(page, testInfo, "officer job list");

  const select = page.getByTestId(`ward-officer-select-${movementId}`);
  await expect(async () => {
    await select.click();
    await expect(page.getByTestId("ward-officer-detail")).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  const detail = page.getByTestId("ward-officer-detail");
  await expectAccessible(page, testInfo, "officer job detail");

  for (const stage of ["enroute", "collect", "arrive"] as const) {
    const button = detail.getByTestId(`ward-officer-${stage}-${movementId}`);
    await expect(button).not.toHaveAttribute("aria-disabled", "true");
    await button.click();
    // Collected warns and asks for a recorded reason when Form 4A or fit to travel is missing.
    if (stage === "collect") {
      const check = page.getByTestId("ward-officer-collect-check");
      if (
        await check
          .waitFor({ state: "visible", timeout: 2_000 })
          .then(() => true)
          .catch(() => false)
      ) {
        await expectAccessible(page, testInfo, "officer collection check");
        await page.getByTestId("ward-officer-collect-check-reason").selectOption("paper_sighted");
        await check.getByRole("button", { name: "Collected, record reason" }).click();
      }
    }
  }
  await expectNoReloadSince(page, "the officer's transport steps");

  // The receiving ward closes the movement by confirming arrival, and its occupied count rises.
  await goToDesk(page, wardDesk(unitId!, unitName), "ward-unit-screen");
  const wardScreen = page.getByTestId("ward-unit-screen");
  const occupiedBefore = await wardFigure(page, "occupied");
  expect(Number.isNaN(occupiedBefore)).toBe(false);
  await openWardList(page, "Admissions");
  await expectAccessible(page, testInfo, "ward arrivals with the delivered patient");
  await wardScreen.getByTestId(`ward-confirm-arrival-${movementId}`).click();
  await expect(wardScreen.getByTestId(`ward-accepted-${movementId}`)).toHaveCount(0);
  await openWardHome(page);
  await expect.poll(() => wardFigure(page, "occupied")).toBe(occupiedBefore + 1);
  await expectNoReloadSince(page, "confirming arrival");
});

test("Discharge with bed release: a ward confirms a release, the person leaves, and the bed is ready on the board", async ({
  page,
}, testInfo) => {
  const unitId = "rph-adult-secure";
  const unitName = unitById(unitId)!.name;
  // The earliest-due unblocked expected release at this ward, chosen from the seed, never by position.
  const release = bedReleases
    .filter((candidate) => candidate.unitId === unitId && candidate.state === "expected" && candidate.blocker === null)
    .sort((a, b) => a.expectedAt - b.expectedAt || a.id.localeCompare(b.id))[0];
  expect(release, `fixture assumption: ${unitId} seeds an unblocked expected release`).toBeDefined();

  await page.goto("/mockups/ward-flow/capacity", { waitUntil: "load" });
  await waitForScreen(page, "ward-capacity-page");
  await plantSentinel(page);
  const readyBefore = await capacityReady(page, unitId, unitName);

  // The ward confirms the release from its Discharges list.
  await goToDesk(page, wardDesk(unitId, unitName), "ward-unit-screen");
  await openWardList(page, "Discharges");
  const releaseState = page.getByTestId(`ward-today-release-state-${release.id}`);
  await expect(releaseState).toHaveText("Expected");
  await expectAccessible(page, testInfo, "ward discharges list");
  await page.getByTestId(`ward-today-release-confirm-${release.id}`).click();
  await expect(releaseState).toHaveText("Confirmed");
  await expectNoReloadSince(page, "confirming the release");

  // The person leaves, recorded on the ward's bed board, opened from the Wards index: the ward's
  // profile on desktop, the ward's sheet on a phone.
  await goViaNav(page, "/mockups/ward-flow/wards", "ward-index");
  if (isPhoneLayout(page)) {
    await page
      .getByRole("region", { name: "Wards", exact: true })
      .getByRole("button", { name: new RegExp(`^${escapeForRegExp(unitName)}`, "u") })
      .first()
      .click();
    await page.getByTestId("ward-index-phone-sheet").getByRole("button", { name: "Bed board", exact: true }).click();
  } else {
    await page.getByRole("button", { name: `${unitName} profile`, exact: true }).click();
    await page.getByRole("link", { name: "Bed board", exact: true }).click();
  }
  await page.waitForURL(`**/mockups/ward-flow/board/${unitId}`);
  await waitForScreen(page, "ward-board");
  await expectAccessible(page, testInfo, "ward bed board");
  // The board's Needs you this shift list carries every discharge due or overdue, on desktop and
  // on the phone (where it replaces the bed grid). They have left records the departure.
  const workBand = page.getByTestId("ward-board-work-band-list");
  const shiftItem = workBand.getByTestId(`ward-board-shift-discharge-${release.admissionId}`);
  const showMore = page.getByTestId("ward-board-work-band").getByRole("button", { name: /^Show \d+ more$/u });
  if (!(await shiftItem.isVisible()) && (await showMore.isVisible())) await showMore.click();
  // The ward's confirmation reaches the board: one discharge, one answer.
  await expect(shiftItem).toBeVisible();
  await expect(shiftItem).toContainText("Confirmed discharge");
  await shiftItem.getByRole("button", { name: "They have left", exact: true }).click();
  const departure = page.getByRole("dialog", { name: "Confirm patient departure" });
  await expect(departure).toBeVisible();
  await expectAccessible(page, testInfo, "confirm patient departure dialog");
  await departure.getByRole("button", { name: "Record departure", exact: true }).click();
  await expect(departure).toHaveCount(0);
  await expectNoReloadSince(page, "recording the departure");

  // The coordinator's board shows one more ready bed.
  await goViaNav(page, "/mockups/ward-flow/capacity", "ward-capacity-page");
  await expect.poll(() => capacityReady(page, unitId, unitName)).toBe(readyBefore + 1);
  await expectNoReloadSince(page, "returning to the capacity board");
});
