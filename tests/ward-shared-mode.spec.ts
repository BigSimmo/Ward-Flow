import { expect, test } from "playwright/test";
import {
  accounts,
  openDesk,
  READY,
  POLL,
  MOVEMENT,
  type Desk,
  sharedStatus,
  placement,
  queueRow,
  revealRow,
  selectMovement,
  openUrgencyForm,
  shownTier,
  chooseOtherTier,
  anotherMovement,
  nextCommand,
  placementInert,
  plantSentinel,
  expectNoReloadSince,
} from "./helpers/ward-shared-desk";
/**
 * Shared mode end to end (audit F-16): two coordinator desks, each signed in in its own browser
 * context, working on one shared workspace through the real local backend and PostgreSQL.
 *
 * Run it with `tests/support/ward-shared-mode-run.mjs`, which starts that stack and passes the
 * synthetic accounts and the fake sign-in service's address in the environment. The project
 * `ward-shared-mode` exists only inside that runner (playwright.config.ts).
 *
 * The workspace is one database for the whole run and these tests change it, so each test reads
 * the state it starts from instead of assuming the seed (`--repeat-each` must pass too). Synthetic
 * data only.
 */

test.describe.configure({ mode: "serial" });

let one: Desk;
let two: Desk;

test.beforeAll(async ({ browser }) => {
  expect(accounts, "run this spec through tests/support/ward-shared-mode-run.mjs").toHaveLength(2);
  one = await openDesk(browser, accounts[0]!);
  two = await openDesk(browser, accounts[1]!, true);
});

test.afterAll(async () => {
  await one?.context.close();
  await two?.context.close();
});

test("two signed-in desks share one workspace: a save on one reaches the other on its next poll", async () => {
  // Both desks are signed in as different coordinators and read the same queue.
  for (const desk of [one, two]) await revealRow(desk.page);

  const tier = await openUrgencyForm(one.page);
  const chosen = await chooseOtherTier(one.page, tier);
  await placement(one.page).getByRole("button", { name: "Record urgency change" }).click();
  await expect(sharedStatus(one.page)).toHaveText(new RegExp(`^${READY}`, "u"));
  await expect(queueRow(one.page)).toContainText(chosen);

  // Desk two did nothing: only its own poll can bring desk one's change.
  await expect(queueRow(two.page)).toContainText(chosen, POLL);
  await expect(sharedStatus(two.page)).toHaveText(new RegExp(`^${READY}`, "u"));
  // A new page load must read the saved record from the backend, rather than reducer state.
  await one.page.reload({ waitUntil: "domcontentloaded" });
  await expect(sharedStatus(one.page)).toHaveText(new RegExp(`^${READY}`, "u"));
  await expect(await revealRow(one.page)).toContainText(chosen);
});

test("a clash: two desks change the same record from the same revision, and the second is refused", async () => {
  // Both desks open the same form on the same revision.
  const tierOne = await openUrgencyForm(one.page);
  const tierTwo = await openUrgencyForm(two.page);
  await expect.poll(() => shownTier(two.page)).toBe(await shownTier(one.page));
  // Desk two stops polling (its clock is held) once nothing is in flight, so it keeps the revision
  // it has while desk one saves.
  await two.page.waitForLoadState("networkidle");
  await two.page.clock.pauseAt(Date.now() + 1_000);

  const first = await chooseOtherTier(one.page, tierOne);
  await placement(one.page).getByRole("button", { name: "Record urgency change" }).click();
  await expect(sharedStatus(one.page)).toHaveText(new RegExp(`^${READY}`, "u"));
  await expect(queueRow(two.page)).not.toContainText(first);

  await chooseOtherTier(two.page, tierTwo, first);
  await placement(two.page).getByRole("button", { name: "Record urgency change" }).click();
  await expect(sharedStatus(two.page)).toContainText(
    "Another desk changed this movement while you were looking. Your action was not applied. Check the latest details, then try again.",
  );
  // The refusal carried the latest board, so desk two now shows desk one's change, not its own.
  await expect(queueRow(two.page)).toContainText(first);
  await two.page.clock.resume();
});

test("a workflow refusal from the server's engine reaches the screen as the engine's own reason", async () => {
  // The movement is accepted with transport booked. Override is not stage-gated on screen, so
  // Record override reaches the server, whose engine refuses REFER_TO_UNITS at this stage.
  const panel = await selectMovement(one.page);
  const findAnother = panel.getByTestId("ward-shortlist-find-another-bed");
  if ((await findAnother.count()) > 0) await findAnother.click();
  const candidates = panel.getByTestId("ward-shortlist-candidates-toggle");
  if ((await candidates.getAttribute("aria-expanded")) !== "true") await candidates.click();
  await panel.locator('[data-testid^="ward-shortlist-candidate-"][data-eligible="true"]').first().click();
  await panel.getByTestId("ward-shortlist-override-toggle").click();
  await panel.getByLabel(/Reason for overriding/u).selectOption("The bed information is known to be out of date");
  await panel.getByRole("button", { name: "Record override" }).click();

  // The reducer's reason for this refusal, then the shared board's "Nothing was changed.", rather
  // than the old fixed "The action was not applied. Review the workflow requirements."
  await expect(sharedStatus(one.page)).toContainText(
    /[Cc]annot refer a movement at its current stage \([^)]+\)\. Nothing was changed\./u,
  );
  await expect(sharedStatus(one.page)).not.toContainText("Review the workflow requirements");
  await expect(panel).not.toContainText("Overridden by a human coordinator");
});

test("keyboard focus: after a shared save the activated control still has focus", async () => {
  const { page } = one;
  // Capacity redesign (31 Oct 2026): the old ward detail and its "Request ward update" are gone.
  // The "This shift" card's "Ask <ward> to confirm its beds" is the same shared save
  // (REQUEST_CAPACITY_REFRESH) and stays on screen afterwards: it is never disabled, and asking does
  // not confirm the ward, so the ward stays first in line. Focus therefore has somewhere to return.
  // (The ward panel's "Ask the ward" is disabled once asked, so it cannot hold focus.) The sign-in
  // lives in this tab's session storage, so a full navigation keeps it.
  await page.goto("/ward-flow/capacity", { waitUntil: "domcontentloaded" });
  await expect(sharedStatus(page)).toContainText(READY, { timeout: 30_000 });
  const shift = page.getByTestId("ward-capacity-screen").getByRole("region", { name: "Bed counts confirmed" });
  const request = shift.getByRole("button", { name: /^Ask .+ to confirm its beds$/u });
  await expect(request, "fixture assumption: at least one ward has not confirmed its beds this shift").toBeVisible();
  const asked = ((await request.getAttribute("aria-label")) ?? "").replace(/^Ask (.+) to confirm its beds$/u, "$1");
  await request.focus();
  // Note whether the part of the board holding the control goes inert while the save is out, as it
  // must (audit F-09); inert is what drops focus, so without it this test would prove nothing.
  await request.evaluate((control) => {
    const flag = window as unknown as { wardControlWentInert?: boolean };
    flag.wardControlWentInert = false;
    new MutationObserver((changes) => {
      if (changes.some((change) => (change.target as Element).hasAttribute("inert") && change.target.contains(control)))
        flag.wardControlWentInert = true;
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["inert"] });
  });
  await page.keyboard.press("Enter");

  await expect(page.getByText(`Asked ${asked} to confirm its beds.`, { exact: true }).first()).toBeVisible();
  await expect(sharedStatus(page)).toHaveText(new RegExp(`^${READY}`, "u"));
  expect(
    await page.evaluate(() => (window as unknown as { wardControlWentInert?: boolean }).wardControlWentInert),
  ).toBe(true);
  await expect.poll(() => request.evaluate((control) => control === document.activeElement)).toBe(true);

  // Leave the desk where the other tests expect it (--repeat-each runs them again).
  await page.goto("/ward-flow", { waitUntil: "domcontentloaded" });
  await expect(sharedStatus(page)).toContainText(READY, { timeout: 30_000 });
});

test("different records at once: two desks change different records from the same revision, and both saves land on both desks", async () => {
  const other = await anotherMovement(two.page);
  for (const desk of [one, two]) for (const movement of [MOVEMENT, other]) await revealRow(desk.page, movement);
  // Desk one changes the movement, desk two a different one, both from the board they hold now.
  const tierOne = await openUrgencyForm(one.page);
  const tierTwo = await openUrgencyForm(two.page, other);
  for (const movement of [MOVEMENT, other])
    await expect.poll(() => shownTier(two.page, movement)).toBe(await shownTier(one.page, movement));
  // Desk two holds its revision (its poll cannot fire) so it cannot pick up desk one's save first.
  await two.page.waitForLoadState("networkidle");
  await two.page.clock.pauseAt(Date.now() + 1_000);
  const first = await chooseOtherTier(one.page, tierOne);
  const second = await chooseOtherTier(two.page, tierTwo, undefined, other);

  // Both desks save at the same moment.
  const [sentOne, sentTwo] = await Promise.all([
    nextCommand(one.page),
    nextCommand(two.page),
    placement(one.page).getByRole("button", { name: "Record urgency change" }).click(),
    placement(two.page).getByRole("button", { name: "Record urgency change" }).click(),
  ]);
  // Both were sent against the same revision, so whichever landed second was checked as stale.
  expect(sentOne.postDataJSON().expectedRevision).toBe(sentTwo.postDataJSON().expectedRevision);
  expect((await sentOne.response())?.status()).toBe(200);
  expect((await sentTwo.response())?.status()).toBe(200);
  await two.page.clock.resume();

  // Neither desk was told its record changed under it, and both show both changes.
  for (const desk of [one, two]) {
    await expect(sharedStatus(desk.page)).toHaveText(new RegExp(`^${READY}`, "u"), POLL);
    await expect(queueRow(desk.page)).toContainText(first, POLL);
    await expect(queueRow(desk.page, other)).toContainText(second, POLL);
  }
  // And a new page load reads both from the backend.
  await one.page.reload({ waitUntil: "domcontentloaded" });
  await expect(sharedStatus(one.page)).toHaveText(new RegExp(`^${READY}`, "u"), { timeout: 30_000 });
  await expect(await revealRow(one.page)).toContainText(first);
  await expect(await revealRow(one.page, other)).toContainText(second);
});

test("a desk that loses its network says it is not connected, then catches up without a reload when it returns", async () => {
  for (const desk of [one, two]) {
    await expect(sharedStatus(desk.page)).toHaveText(new RegExp(`^${READY}`, "u"), POLL);
    // Home v7 (Josh, 22 Oct 2026): Placement opens only once a patient is chosen, so each desk
    // chooses the movement before the network drops.
    await selectMovement(desk.page);
  }
  await plantSentinel(one.page);

  // Desk one loses its network: its next poll fails, it says so and stops taking changes.
  await one.context.setOffline(true);
  await expect(sharedStatus(one.page)).toContainText("Connection unavailable", POLL);
  await expect(sharedStatus(one.page).getByRole("button", { name: "Retry" })).toBeVisible();
  // PR #675: while its access is still current, an outage keeps the board readable and its dated
  // reports printable, so the page is not inert. It still takes no changes: a save is refused in
  // the browser and nothing is sent.
  expect(await placementInert(one.page)).toBe(false);
  const sentWhileOffline: string[] = [];
  one.page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/v1/workspace/commands"))
      sentWhileOffline.push(request.url());
  });
  const offlineTier = await openUrgencyForm(one.page);
  await chooseOtherTier(one.page, offlineTier);
  await placement(one.page).getByRole("button", { name: "Record urgency change" }).click();

  // Meanwhile desk two saves a change.
  const tier = await openUrgencyForm(two.page);
  const chosen = await chooseOtherTier(two.page, tier);
  await placement(two.page).getByRole("button", { name: "Record urgency change" }).click();
  await expect(sharedStatus(two.page)).toHaveText(new RegExp(`^${READY}`, "u"));
  await expect(queueRow(two.page)).toContainText(chosen);
  await expect(queueRow(one.page)).not.toContainText(chosen);
  await expect(sharedStatus(one.page)).toContainText("Connection unavailable");
  // Desk one's refused save never left the browser.
  expect(sentWhileOffline).toEqual([]);

  // The network returns. Without Retry or a reload, desk one's own poll reconnects and catches up.
  await one.context.setOffline(false);
  await expect(sharedStatus(one.page)).toHaveText(new RegExp(`^${READY}`, "u"), POLL);
  await expect(queueRow(one.page)).toContainText(chosen, POLL);
  expect(await placementInert(one.page)).toBe(false);
  await expectNoReloadSince(one.page, "the network dropping and returning");
});
