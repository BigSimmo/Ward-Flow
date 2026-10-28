import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "playwright/test";
import { showEveryoneWaitingOn } from "./helpers/ward-home-page";

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

const supabaseOrigin = process.env.WARD_E2E_SUPABASE_ORIGIN ?? "";
const authOrigin = process.env.WARD_E2E_AUTH_ORIGIN ?? "";
const accounts: { email: string; password: string }[] = JSON.parse(process.env.WARD_E2E_ACCOUNTS ?? "[]");

/** The shared status line both desks show while connected and idle. */
const READY = "Coordinator · shared synthetic workspace";
/** The client polls every SHARED_REFRESH_MS (3 s); allow a few polls before calling it missed. */
const POLL = { timeout: 15_000 };
/**
 * A seeded accepted movement with transport booked, so it cannot be referred. Wait order (Audit 1,
 * D-71) can put it past the queue's first rows, so `revealRow` opens "Show all" when needed.
 */
const MOVEMENT = "WF-030";
/** A seeded ward whose capacity detail the focus test asks for an update from. */
const WARD = "Graylands Adult Secure";

type Desk = { context: BrowserContext; page: Page };

/**
 * One signed-in desk. The browser may reach this app and the local backend only. The approved
 * Supabase origin is fixed in the client and its CSP, so its sign-in calls are answered by the
 * fake service the runner started; everything else is refused, so nothing leaves the machine.
 */
async function openDesk(browser: Browser, account: { email: string; password: string }, clock = false) {
  // The runner creates a self-signed certificate only for its loopback HTTPS backend.
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  await context.route(
    (url) => !["localhost", "127.0.0.1"].includes(url.hostname),
    (route) => route.abort("blockedbyclient"),
  );
  await context.route(`${supabaseOrigin}/**`, async (route) => {
    const response = await route.fetch({ url: route.request().url().replace(supabaseOrigin, authOrigin) });
    await route.fulfill({ response });
  });
  // A signed-in desk's tour starts on its own once, over the home screen. These journeys are about
  // the shared workspace, so every desk's tour is marked seen before the page loads.
  await context.addInitScript(() => {
    window.localStorage.setItem(
      "ward_flow_choice_tour_seen",
      "coordinator,ward,ed,community,officer,bed_manager,executive,admin",
    );
  });
  const page = await context.newPage();
  // A desk whose poll the clash test must hold back runs on Playwright's clock: it keeps real time
  // until paused, and while paused the 3 s poll timer cannot fire.
  if (clock) await page.clock.install();
  await page.goto("/ward-flow", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(sharedStatus(page)).toContainText(READY, { timeout: 30_000 });
  return { context, page } satisfies Desk;
}

function sharedStatus(page: Page): Locator {
  return page.getByRole("status").filter({ hasText: /shared synthetic workspace|Saving shared changes|unavailable/u });
}

function placement(page: Page): Locator {
  return page.getByRole("complementary", { name: "Placement", exact: true });
}

function queueRow(page: Page, movement = MOVEMENT): Locator {
  return page.getByRole("region", { name: "Priority queue" }).getByTestId(`ward-queue-row-${movement}`);
}

/** Show the movement's queue row, opening the queue's "Show all" when the row is past the first rows. */
async function revealRow(page: Page, movement = MOVEMENT): Promise<Locator> {
  await showEveryoneWaitingOn(page);
  const queue = page.getByRole("region", { name: "Priority queue" });
  const row = queueRow(page, movement);
  const showAll = queue.getByRole("button", { name: /^Show all/u });
  await expect(queue.locator('[data-testid^="ward-queue-row-"]').first()).toBeVisible();
  if (!(await row.isVisible()) && (await showAll.isVisible())) await showAll.click();
  await expect(row).toBeVisible();
  return row;
}

/** Select the movement on the queue, so Placement is about it whatever is now top of the queue. */
async function selectMovement(page: Page, movement = MOVEMENT): Promise<Locator> {
  const row = await revealRow(page, movement);
  await row.click();
  await expect(placement(page)).toHaveAttribute("data-subject-movement", movement);
  return placement(page);
}

/** Open Placement's Change urgency form for the movement; returns its tier picker. */
async function openUrgencyForm(page: Page, movement = MOVEMENT): Promise<Locator> {
  const panel = await selectMovement(page, movement);
  // Both are toggles that keep their state across a save, so open them only when closed.
  const update = panel.locator("details", { has: page.locator("summary", { hasText: "Update record" }) });
  if (!(await update.evaluate((element) => (element as HTMLDetailsElement).open)))
    await update.locator("summary").click();
  const change = panel.getByRole("button", { name: "Change urgency" });
  if ((await change.getAttribute("aria-expanded")) !== "true") await change.click();
  return panel.getByRole("combobox", { name: /^Urgency tier for / });
}

/** The tier the queue row shows for the movement ("1", "2" or "3"). */
async function shownTier(page: Page, movement = MOVEMENT): Promise<string> {
  return /^Tier (\d)/u.exec((await queueRow(page, movement).textContent()) ?? "")?.[1] ?? "";
}

/**
 * Choose, with a reason, a tier other than the one this desk's queue shows (and other than
 * `avoid`); returns the option's label. The picker's own value is the form's state, not the record.
 */
async function chooseOtherTier(page: Page, tier: Locator, avoid?: string, movement = MOVEMENT): Promise<string> {
  const current = await shownTier(page, movement);
  const options = await tier
    .locator("option")
    .evaluateAll((list) =>
      list.map((option) => ({ value: (option as HTMLOptionElement).value, label: option.textContent ?? "" })),
    );
  // "Urgent" heads the picker (finding 156) but raises the urgent flag, not a tier, and asks its own reason.
  const next = options.find(
    (option) => option.value !== "urgent" && option.value !== current && option.label !== avoid,
  )!;
  await tier.selectOption(next.value);
  await placement(page).getByRole("combobox", { name: "Reason" }).selectOption({ label: "Reassessed" });
  return next.label;
}

/** A queued movement other than MOVEMENT, for a second record to change. */
async function anotherMovement(page: Page): Promise<string> {
  await showEveryoneWaitingOn(page);
  const rows = page.getByRole("region", { name: "Priority queue" }).locator('[data-testid^="ward-queue-row-"]');
  await expect(rows.first()).toBeVisible();
  const ids = await rows.evaluateAll((list) =>
    list.map((row) => row.getAttribute("data-testid")!.replace("ward-queue-row-", "")),
  );
  const other = ids.find((id) => id !== MOVEMENT);
  expect(other, "the queue needs a second movement").toBeTruthy();
  return other!;
}

/** The shared board's command request, and its revision, for one desk's next save. */
function nextCommand(page: Page) {
  return page.waitForRequest(
    (request) => request.method() === "POST" && new URL(request.url()).pathname.endsWith("/v1/workspace/commands"),
  );
}

/** Whether Placement sits in the part of the board that goes inert while changes are disabled. */
function placementInert(page: Page): Promise<boolean> {
  return placement(page).evaluate((panel) => panel.closest("[inert]") !== null);
}

// A full page load would reset the board and hide whether the desk caught up on its own, so the
// recovery test plants a value in the page and checks it survived (as the release-gate helpers do).
const SENTINEL = "ward-shared-mode-no-reload";

async function plantSentinel(page: Page) {
  await page.evaluate((value) => {
    (window as unknown as Record<string, string>).__wardSharedModeSentinel = value;
  }, SENTINEL);
}

async function expectNoReloadSince(page: Page, step: string) {
  const survived = await page.evaluate(
    () => (window as unknown as Record<string, string | undefined>).__wardSharedModeSentinel,
  );
  expect(survived, `the page reloaded during "${step}"`).toBe(SENTINEL);
}

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
  // Capacity's ward detail: "Request ward update" saves to the shared workspace and stays on screen
  // afterwards (it is never disabled), so focus has somewhere to return. The sign-in lives in this
  // tab's session storage, so a full navigation keeps it.
  await page.goto("/ward-flow/capacity", { waitUntil: "domcontentloaded" });
  await expect(sharedStatus(page)).toContainText(READY, { timeout: 30_000 });
  const capacity = page.getByTestId("ward-capacity-page");
  await capacity.getByRole("button", { name: WARD, exact: true }).first().click();
  const detail = page.getByRole("complementary", { name: "Network summary and ward detail" });
  const request = detail.getByRole("button", { name: "Request ward update" });
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

  await expect(detail.getByText(/^Update requested /u)).toBeVisible();
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
