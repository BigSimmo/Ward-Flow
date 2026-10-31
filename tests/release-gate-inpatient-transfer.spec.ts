import { expect, test, type Locator, type Page } from "playwright/test";

import { decodeRecordAddress } from "@/components/ward-management/shell/ward-record-address";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { allUnits, unitById } from "@/components/ward-management/ward-sites";

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
 * Release gate: an inpatient ward-to-ward transfer.
 *
 * Ward Flow moves a person who is already admitted on one ward to another ward through the return
 * (repatriation) path: the coordinator records a return on the Out of area page with the receiving
 * ward's agreement (`RECORD_REPATRIATION`), which opens a movement carrying the sending stay
 * (`Movement.sourceAdmissionId`). From there it is an ordinary movement: the coordinator refers it
 * to a ward, that ward accepts and holds a bed, transport runs, and the receiving ward confirms
 * arrival, which ends the sending stay as "transferred to another psychiatric ward" so one person
 * never holds two beds.
 *
 * Two other transfer shapes exist in the source and are not this journey: a ward-raised referral
 * (source `psychiatric_ward`) stops at acceptance, because acceptance creates no movement (spec D14)
 * and `RAISE_REFERRAL` only raises from an emergency department; and the care journey's "Ward
 * transfer" record moves a stay in one coordinator step, with no receiving ward answer or held bed.
 *
 * Desktop Chrome (1440px) and phone (390x844), one typed URL, then only the app's own links,
 * drawers and desks, with an axe WCAG 2.1 AA check at each key step. Synthetic data only.
 */

test.describe.configure({ timeout: 240_000 });

/** Open a ward's bed board from the Wards index: the ward's profile on desktop, its sheet on a phone. */
async function openBedBoardFromWards(page: Page, unitName: string, unitId: string): Promise<void> {
  // The Wards index belongs to the coordinator; a ward desk cannot navigate to it.
  await goToDesk(page, (drawer) => drawer.getByTestId("workstation-open-coordinator"), "ward-coordinator");
  await goViaNav(page, "/ward-flow/wards", "ward-index");
  if (isPhoneLayout(page)) {
    await page
      .getByRole("region", { name: "Wards", exact: true })
      .getByRole("button", { name: new RegExp(`^${escapeForRegExp(unitName)}`, "u") })
      .first()
      .click();
    await page
      .getByTestId("ward-index-phone-sheet")
      .getByRole("button", { name: "Stays and discharges", exact: true })
      .click();
  } else {
    await page.getByRole("button", { name: `${unitName} profile`, exact: true }).click();
    await page.getByRole("link", { name: "Stays and discharges", exact: true }).click();
  }
  await page.waitForURL(`**/ward-flow/board/${unitId}`);
  await waitForScreen(page, "ward-board");
}

/** As the coordinator: the Out of area page, this person's return plan, on either layout. */
async function openReturnPlan(page: Page, admissionId: string) {
  await goToDesk(page, (drawer) => drawer.getByTestId("workstation-open-coordinator"), "ward-coordinator");
  await goViaNav(page, "/ward-flow/out-of-area", "ward-out-of-area-board");
  if (isPhoneLayout(page)) {
    // The phone lists people as cards, opening on those who need the coordinator; Everyone lists
    // the whole register. A card opens a summary sheet, and the plan opens from it.
    const everyone = page.getByRole("radio", { name: /^Everyone/u });
    if ((await everyone.getAttribute("aria-checked")) !== "true") await everyone.click();
    await page.getByTestId(`ward-out-of-area-card-${admissionId}`).click();
    await page.getByRole("button", { name: /^(Plan return|Continue return plan|View recorded return)$/u }).click();
  } else {
    await page.getByTestId(`ward-out-of-area-row-${admissionId}`).click();
  }
  const plan = page.getByTestId("ward-out-of-area-subject");
  await expect(plan).toBeVisible();
  return plan;
}

/**
 * Follows a recorded return's own Open movement link to the movement's page and returns the
 * movement's id, read from the link by the app's own record-address decoder.
 */
async function followOpenMovement(page: Page, recorded: Locator): Promise<string> {
  await expect(recorded).toBeVisible();
  const link = recorded.getByRole("link", { name: "Open movement", exact: true });
  const href = (await link.getAttribute("href")) ?? "";
  const movementId = decodeRecordAddress(decodeURIComponent(href.split("/").at(-1) ?? ""));
  expect(movementId, `the Open movement link must address a movement: "${href}"`).toMatch(/^WF-/u);
  await link.click();
  await page.waitForURL((url) => url.pathname === href, { timeout: 15_000 });
  await waitForScreen(page, "ward-patient-destination-row");
  return movementId!;
}

/** The coordinator's capacity board, reached through the coordinator desk and its navigation. */
async function openCapacityBoard(page: Page) {
  await goToDesk(page, (drawer) => drawer.getByTestId("workstation-open-coordinator"), "ward-coordinator");
  await goViaNav(page, "/ward-flow/capacity", "ward-capacity-screen");
}

test("Inpatient transfer: a stay on one ward is referred, accepted and held at another, moved, and the sending bed frees", async ({
  page,
}, testInfo) => {
  // AD-RPHS-18 is an occupied adult stay far from home, linked to a person, with no return planned.
  const admissionId = "AD-RPHS-18";
  const stay = wardAdmissions.find((candidate) => candidate.id === admissionId);
  expect(stay?.state, `fixture assumption: ${admissionId} is an occupied stay`).toBe("occupied");
  expect(stay?.patientId, `fixture assumption: ${admissionId} is linked to a person`).toBeTruthy();
  const sendingUnitId = stay!.unitId;
  const sendingName = unitById(sendingUnitId)!.name;

  // The coordinator's capacity board before anything moves.
  await page.goto("/ward-flow/capacity", { waitUntil: "load" });
  await waitForScreen(page, "ward-capacity-screen");
  await plantSentinel(page);
  const sendingCapacityReadyBefore = await capacityReady(page, sendingUnitId, sendingName);
  await expectAccessible(page, testInfo, "capacity board");

  // The sending ward's bed board shows the stay as an occupied bed. The phone board leads with its
  // work list and keeps the bed grid in the page, so read the tile's state, not its visibility.
  await openBedBoardFromWards(page, sendingName, sendingUnitId);
  const sendingTile = page.locator(`li:has(> #ward-board-tile-${admissionId})`);
  await expect(sendingTile).toHaveAttribute("data-bed-kind", "occupied");
  await expectAccessible(page, testInfo, "sending ward bed board");

  // The sending ward's own figures before the transfer.
  await goToDesk(page, wardDesk(sendingUnitId, sendingName), "ward-unit-screen");
  const sendingOccupiedBefore = await wardFigure(page, "occupied");
  const sendingReadyBefore = await wardFigure(page, "ready");
  expect(sendingReadyBefore, "the sending ward's Home and the capacity board agree before").toBe(
    sendingCapacityReadyBefore,
  );
  await expectAccessible(page, testInfo, "sending ward Home");

  // 1. Request: the coordinator records the return with the receiving ward's agreement.
  const plan = await openReturnPlan(page, admissionId);
  await expectAccessible(page, testInfo, "return plan, empty");
  await plan.getByTestId("ward-out-of-area-repat-home-hospital").selectOption({ label: "Bunbury Hospital" });
  await plan.getByRole("group", { name: "Ward agreed" }).getByText("Agreed", { exact: true }).click();
  await plan.getByRole("group", { name: "Travel by" }).getByText("Road", { exact: true }).click();
  await plan.getByTestId("ward-out-of-area-repat-provider").selectOption("Patient transport service");
  await plan.getByRole("group", { name: "Legal status" }).getByText("Voluntary", { exact: true }).click();
  await plan.getByTestId("ward-out-of-area-repat-cad").fill("CAD-GATE-0003");
  await plan.getByTestId("ward-out-of-area-repat-estimated-time").fill("09:00");
  await plan.getByRole("group", { name: "Depart day" }).getByText("Tomorrow", { exact: true }).click();
  await expectAccessible(page, testInfo, "return plan, filled");
  await plan.getByTestId("ward-out-of-area-repat-submit").click();
  await expect(plan.getByTestId("ward-out-of-area-recorded")).toContainText("Movement opened");
  await expectNoReloadSince(page, "recording the return");

  // 2. Refer: from the movement's own page, the coordinator refers it to one eligible ward that is
  //    not the ward the person is on.
  const movementId = await followOpenMovement(page, plan.getByTestId("ward-out-of-area-recorded"));
  await expectAccessible(page, testInfo, "transfer movement page");
  // The Destination row opens the shortlist on both layouts (the phone pins Ask wards in its bar).
  await page.getByTestId("ward-patient-destination-row").click();
  const placement = page.getByRole("dialog", { name: "Destination and placement" });
  await expect(placement).toBeVisible();
  // The Ask wards list: a ward that can be asked has an enabled checkbox named by the ward.
  const names = await placement
    .getByRole("checkbox", { disabled: false })
    .evaluateAll((boxes) => boxes.map((box) => box.getAttribute("aria-label") ?? ""));
  const receivingName = names.find((name) => name !== sendingName);
  expect(receivingName, "the transfer must have an eligible ward other than the sending ward").toBeTruthy();
  const receivingUnitId = allUnits().find((unit) => unit.name === receivingName)?.id;
  expect(receivingUnitId, `${receivingName} must resolve to a unit`).toBeTruthy();
  await placement.getByRole("checkbox", { name: receivingName!, exact: true }).check();
  await expectAccessible(page, testInfo, "destination and placement with a ward chosen");
  await placement.getByRole("button", { name: /^Ask 1 ward/u }).click();
  await expect(
    placement.getByTestId(`ward-ask-ward-${receivingUnitId}`).getByText("Asked", { exact: true }),
  ).toBeVisible();
  await expectNoReloadSince(page, "referring the transfer");
  await page.keyboard.press("Escape");
  await expect(placement).toHaveCount(0);

  // The receiving ward's figures before it answers, on the capacity board and on its own Home.
  await openCapacityBoard(page);
  const receivingCapacityReadyBefore = await capacityReady(page, receivingUnitId!, receivingName!);
  await goToDesk(page, wardDesk(receivingUnitId!, receivingName!), "ward-unit-screen");
  const receivingReadyBefore = await wardFigure(page, "ready");
  const receivingOccupiedBefore = await wardFigure(page, "occupied");
  expect(receivingReadyBefore, "the receiving ward's Home and the capacity board agree before").toBe(
    receivingCapacityReadyBefore,
  );

  // 3. Accept and hold: the receiving ward accepts the referral and pulls a bed for the person.
  await openWardFlow(page, "Referrals");
  await expectAccessible(page, testInfo, "receiving ward with the transfer waiting");
  const accept = page.getByTestId(`ward-accept-${movementId}`);
  await expect(accept).not.toHaveAttribute("aria-disabled", "true");
  await accept.click();
  await openWardList(page, "Admissions");
  const pull = page.getByTestId(`ward-pull-${movementId}`);
  await expect(pull).not.toHaveAttribute("aria-disabled", "true");
  await expectAccessible(page, testInfo, "receiving ward arrivals with the accepted transfer");
  await pull.click();
  await expect(pull).toHaveCount(0);
  await openWardHome(page);
  // The held bed is no longer Ready; nobody occupies it yet.
  await expect.poll(() => wardFigure(page, "ready")).toBe(receivingReadyBefore - 1);
  expect(await wardFigure(page, "occupied")).toBe(receivingOccupiedBefore);
  await expectAccessible(page, testInfo, "receiving ward Home with the bed held");
  await expectNoReloadSince(page, "the receiving ward accepting and holding a bed");

  // 4. Move: the sending side books the transport and marks handover ready on the movement page.
  await followOpenMovement(page, (await openReturnPlan(page, admissionId)).getByTestId("ward-out-of-area-recorded"));
  await page.getByTestId("ward-patient-gate-transport").getByRole("button", { name: "Log booking" }).click();
  const booking = page.getByTestId("ward-patient-transport-form");
  await expect(booking).toBeVisible();
  await booking.getByTestId("ward-patient-input-cad").fill("CAD-GATE-0004");
  await booking.getByTestId("ward-patient-eta-presets").getByRole("button", { name: "+30m", exact: true }).click();
  await booking.getByTestId("ward-patient-select-provider").selectOption("Patient transport service");
  await booking.getByTestId("ward-patient-escort-no").check();
  // Josh, 31 Oct 2026: neither legal answer starts ticked. A status that differs from Legal now asks why.
  await booking.getByTestId("ward-patient-legal-involuntary").check();
  const legalReason = booking.getByTestId("ward-patient-legal-reason");
  if (await legalReason.isVisible()) await legalReason.selectOption("treating_team_confirmed");
  await expectAccessible(page, testInfo, "transfer transport booking, filled");
  await booking.getByTestId("ward-patient-confirm-transport-btn").click();
  await expect(page.getByTestId("ward-patient-cad-number")).toHaveText("CAD-GATE-0004");
  await expectAccessible(page, testInfo, "transfer movement with transport booked");
  await page.keyboard.press("Escape");
  await expect(booking).toHaveCount(0);
  // The sending team marks handover ready from the movement's placement and dispatch deck.
  await page.getByTestId("ward-patient-destination-row").click();
  const deck = page.getByRole("dialog", { name: "Destination and placement" });
  await expect(deck).toBeVisible();
  const handover = deck.getByRole("button", { name: "Mark handover ready · sending team", exact: true });
  await expect(handover).not.toHaveAttribute("aria-disabled", "true");
  await handover.click();
  await expect(handover).toHaveCount(0);
  await expectAccessible(page, testInfo, "transfer placement deck after handover ready");
  await page.keyboard.press("Escape");
  await expect(deck).toHaveCount(0);
  await expectNoReloadSince(page, "booking transport and marking handover ready");

  // The transport officer runs the job through to delivery.
  await goToDesk(page, (drawer) => drawer.getByTestId("workstation-open-officer"), "ward-officer-screen");
  const select = page.getByTestId(`ward-officer-select-${movementId}`);
  await expect(async () => {
    await select.click();
    await expect(page.getByTestId("ward-officer-detail")).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  const detail = page.getByTestId("ward-officer-detail");
  await expectAccessible(page, testInfo, "officer transfer job detail");
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
        await page.getByTestId("ward-officer-collect-check-reason").selectOption("paper_sighted");
        await check.getByRole("button", { name: "Collected, record reason" }).click();
      }
    }
  }
  await expectAccessible(page, testInfo, "officer transfer job delivered");
  await expectNoReloadSince(page, "the officer's transport steps");

  // 5. Arrive: the receiving ward confirms arrival, and the held bed becomes the person's.
  await goToDesk(page, wardDesk(receivingUnitId!, receivingName!), "ward-unit-screen");
  const receivingScreen = page.getByTestId("ward-unit-screen");
  await openWardList(page, "Admissions");
  await expectAccessible(page, testInfo, "receiving ward arrivals with the delivered transfer");
  await receivingScreen.getByTestId(`ward-confirm-arrival-${movementId}`).click();
  // Walk-through WT-11: the ward checks the name and UMRN before the arrival is recorded.
  await page.getByTestId("ward-arrival-identity").getByRole("button", { name: "Confirm arrival" }).click();
  await expect(receivingScreen.getByTestId(`ward-accepted-${movementId}`)).toHaveCount(0);
  await openWardHome(page);
  await expect.poll(() => wardFigure(page, "occupied")).toBe(receivingOccupiedBefore + 1);
  expect(await wardFigure(page, "ready")).toBe(receivingReadyBefore - 1);
  await expectAccessible(page, testInfo, "receiving ward Home after the arrival");
  await expectNoReloadSince(page, "confirming arrival");

  // 6. The sending bed frees: the stay has ended and the ward has one fewer occupied bed.
  await goToDesk(page, wardDesk(sendingUnitId, sendingName), "ward-unit-screen");
  await expect.poll(() => wardFigure(page, "occupied")).toBe(sendingOccupiedBefore - 1);
  expect(await wardFigure(page, "ready"), "the freed sending bed is Ready again").toBe(sendingReadyBefore + 1);
  await expectAccessible(page, testInfo, "sending ward Home after the transfer");
  await openBedBoardFromWards(page, sendingName, sendingUnitId);
  // The ended stay no longer holds a bed on the sending ward's board.
  await expect(sendingTile).toHaveCount(0);
  await expectAccessible(page, testInfo, "sending ward bed board after the transfer");
  await expectNoReloadSince(page, "checking the sending ward");

  // 7. The coordinator's capacity board agrees with both wards.
  await openCapacityBoard(page);
  await expect.poll(() => capacityReady(page, receivingUnitId!, receivingName!)).toBe(receivingReadyBefore - 1);
  await expect.poll(() => capacityReady(page, sendingUnitId, sendingName)).toBe(sendingReadyBefore + 1);
  await expectAccessible(page, testInfo, "capacity board after the transfer");
  await expectNoReloadSince(page, "returning to the capacity board");
});
