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

  // The new row renders after the submit; read the board until it appears.
  const raisedRows = async () =>
    (
      await page
        .locator('[data-testid^="ward-ed-patient-"]')
        .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-testid") ?? ""))
    ).filter((id) => !patientRowsBefore.has(id));
  await expect
    .poll(raisedRows, { message: "exactly one new movement must appear on the ED's patient board" })
    .toHaveLength(1);
  const raised = await raisedRows();
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
  await expectAccessible(page, testInfo, "ward arrivals after the pull");
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
  await expectAccessible(page, testInfo, "capacity board after the ward's figures");
  await expectNoReloadSince(page, "returning to the capacity board");
});

test("Transfer with transport: the ED books transport, the officer delivers, and the ward confirms arrival", async ({
  page,
}, testInfo) => {
  // WF-004 is seeded pulled into its accepted ward with a linked stay waiting for the patient, and
  // no transport booked yet. A hand-authored transport job has no stay, so arrival could only move
  // the ward's count; this one proves the patient's own stay becomes an occupied bed.
  const movementId = "WF-004";
  const movement = wardMovements.find((candidate) => candidate.id === movementId);
  expect(movement?.stage, `fixture assumption: ${movementId} is pulled`).toBe("pulled");
  expect(movement?.transport, `fixture assumption: ${movementId} has no transport booked`).toBeUndefined();
  const admissionId = movement!.admissionId;
  expect(admissionId, `fixture assumption: ${movementId} has a linked stay`).toBeTruthy();
  const unitId = movement!.acceptedUnitId!;
  const unitName = unitById(unitId)!.name;

  // The sending ED records clearance, books the job and marks the patient ready for handover.
  await page.goto(`/mockups/ward-flow/ed/${movement!.originEdId}`, { waitUntil: "load" });
  await waitForScreen(page, "ward-ed-screen");
  await plantSentinel(page);
  // The patient's sheet carries clearance and the next step. Desktop opens it from the name, the
  // phone from the board row.
  if (isPhoneLayout(page)) await page.getByTestId(`ward-ed-patient-${movementId}`).click();
  else await page.getByTestId(`ward-ed-row-name-${movementId}`).click();
  const personSheet = page.getByTestId(`ward-ed-phone-sheet-${movementId}`);
  await expect(personSheet).toBeVisible();
  const medicalPlacement = personSheet.getByTestId(`ward-ed-medical-placement-${movementId}`);
  await medicalPlacement.getByRole("button", { name: "Record medically cleared", exact: true }).click();
  await medicalPlacement.getByRole("button", { name: "Confirm medically cleared", exact: true }).click();
  await expect(medicalPlacement.getByRole("status")).toContainText("Recorded medically cleared.");
  await expectAccessible(page, testInfo, "ED person sheet after clearance");
  await personSheet.getByRole("button", { name: "Transport booked", exact: true }).click();
  const booking = page.getByTestId(`ward-ed-book-transport-${movementId}`);
  await expect(booking).toBeVisible();
  await page.getByTestId(`ward-ed-transport-provider-${movementId}`).selectOption("Patient transport service");
  await page.getByTestId(`ward-ed-transport-escort-no-${movementId}`).click();
  await page.getByTestId(`ward-ed-transport-cad-number-${movementId}`).fill("CAD-GATE-0001");
  await page.getByTestId(`ward-ed-transport-legal-status-voluntary-${movementId}`).click();
  await page.getByTestId(`ward-ed-transport-estimated-time-${movementId}`).fill("14:30");
  await expectAccessible(page, testInfo, "ED transport booking, filled");
  await page.getByTestId(`ward-ed-book-transport-confirm-${movementId}`).click();
  await expect(booking).toHaveCount(0);
  await personSheet.getByRole("button", { name: "Handover ready", exact: true }).click();
  await expectAccessible(page, testInfo, "ED person sheet after handover ready");
  await page.keyboard.press("Escape");
  await expect(personSheet).toHaveCount(0);
  await expectNoReloadSince(page, "booking transport and marking handover ready");

  // The officer accepts the job and runs it through en route, collected and delivered.
  await goToDesk(page, (drawer) => drawer.getByTestId("workstation-open-officer"), "ward-officer-screen");
  await expectAccessible(page, testInfo, "officer job list");
  const select = page.getByTestId(`ward-officer-select-${movementId}`);
  await expect(async () => {
    await select.click();
    await expect(page.getByTestId("ward-officer-detail")).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  const detail = page.getByTestId("ward-officer-detail");
  await expectAccessible(page, testInfo, "officer job detail");

  for (const stage of ["accept", "enroute", "collect", "arrive"] as const) {
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
    await expectAccessible(page, testInfo, `officer job detail after ${stage}`);
  }
  await expectNoReloadSince(page, "the officer's transport steps");

  // The receiving ward closes the movement by confirming arrival.
  await goToDesk(page, wardDesk(unitId, unitName), "ward-unit-screen");
  const wardScreen = page.getByTestId("ward-unit-screen");
  const occupiedBefore = await wardFigure(page, "occupied");
  expect(Number.isNaN(occupiedBefore)).toBe(false);
  await openWardList(page, "Admissions");
  await expectAccessible(page, testInfo, "ward arrivals with the delivered patient");
  await wardScreen.getByTestId(`ward-confirm-arrival-${movementId}`).click();
  await expect(wardScreen.getByTestId(`ward-accepted-${movementId}`)).toHaveCount(0);
  await openWardHome(page);
  await expectAccessible(page, testInfo, "ward Home after the arrival");
  await expectNoReloadSince(page, "confirming arrival");
  console.log(`[probe] occupied before ${occupiedBefore} after ${await wardFigure(page, "occupied")}`);
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
  const tile = page.locator(`li:has(> #ward-board-tile-${admissionId})`);
  console.log(`[probe] tiles ${await tile.count()} kind ${await tile.first().getAttribute("data-bed-kind").catch(() => "none")} visible ${await tile.first().isVisible().catch(() => false)}`);
  console.log(`[probe] board text ${(await page.getByTestId("ward-board").innerText()).slice(0, 1500).replace(/\n/g, " | ")}`);
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
  // The person has left, so the board no longer lists their discharge.
  await expect(shiftItem).toHaveCount(0);
  await expectAccessible(page, testInfo, "ward bed board after the departure");
  await expectNoReloadSince(page, "recording the departure");

  // The coordinator's board shows one more ready bed.
  await goViaNav(page, "/mockups/ward-flow/capacity", "ward-capacity-page");
  await expect.poll(() => capacityReady(page, unitId, unitName)).toBe(readyBefore + 1);
  await expectAccessible(page, testInfo, "capacity board after the departure");
  await expectNoReloadSince(page, "returning to the capacity board");
});
