import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "playwright/test";

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
/** The seed's first queue row: an accepted movement with transport booked, so it cannot be referred. */
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
  const context = await browser.newContext();
  await context.route(
    (url) => !["localhost", "127.0.0.1"].includes(url.hostname),
    (route) => route.abort("blockedbyclient"),
  );
  await context.route(`${supabaseOrigin}/**`, async (route) => {
    const response = await route.fetch({ url: route.request().url().replace(supabaseOrigin, authOrigin) });
    await route.fulfill({ response });
  });
  const page = await context.newPage();
  // A desk whose poll the clash test must hold back runs on Playwright's clock: it keeps real time
  // until paused, and while paused the 3 s poll timer cannot fire.
  if (clock) await page.clock.install();
  await page.goto("/ward-flow", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Sign in with email" }).click();
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

function queueRow(page: Page): Locator {
  return page.getByRole("region", { name: "Priority queue" }).getByTestId(`ward-queue-row-${MOVEMENT}`);
}

/** Select the movement on the queue, so Placement is about it whatever is now top of the queue. */
async function selectMovement(page: Page): Promise<Locator> {
  const row = queueRow(page);
  const showAll = page.getByRole("region", { name: "Priority queue" }).getByRole("button", { name: /^Show all/u });
  if (!(await row.isVisible()) && (await showAll.isVisible())) await showAll.click();
  await row.click();
  await expect(placement(page)).toHaveAttribute("data-subject-movement", MOVEMENT);
  return placement(page);
}

/** Open Placement's Change urgency form for the movement; returns its tier picker. */
async function openUrgencyForm(page: Page): Promise<Locator> {
  const panel = await selectMovement(page);
  // Both are toggles that keep their state across a save, so open them only when closed.
  const update = panel.locator("details", { has: page.locator("summary", { hasText: "Update record" }) });
  if (!(await update.evaluate((element) => (element as HTMLDetailsElement).open)))
    await update.locator("summary").click();
  const change = panel.getByRole("button", { name: "Change urgency" });
  if ((await change.getAttribute("aria-expanded")) !== "true") await change.click();
  return panel.getByRole("combobox", { name: /^Urgency tier for / });
}

/** The tier the queue row shows for the movement ("1", "2" or "3"). */
async function shownTier(page: Page): Promise<string> {
  return /^Tier (\d)/u.exec((await queueRow(page).textContent()) ?? "")?.[1] ?? "";
}

/**
 * Choose, with a reason, a tier other than the one this desk's queue shows (and other than
 * `avoid`); returns the option's label. The picker's own value is the form's state, not the record.
 */
async function chooseOtherTier(page: Page, tier: Locator, avoid?: string): Promise<string> {
  const current = await shownTier(page);
  const options = await tier
    .locator("option")
    .evaluateAll((list) =>
      list.map((option) => ({ value: (option as HTMLOptionElement).value, label: option.textContent ?? "" })),
    );
  const next = options.find((option) => option.value !== current && option.label !== avoid)!;
  await tier.selectOption(next.value);
  await placement(page).getByRole("combobox", { name: "Reason" }).selectOption({ label: "Reassessed" });
  return next.label;
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
  for (const desk of [one, two]) await expect(queueRow(desk.page)).toBeVisible();

  const tier = await openUrgencyForm(one.page);
  const chosen = await chooseOtherTier(one.page, tier);
  await placement(one.page).getByRole("button", { name: "Record urgency change" }).click();
  await expect(sharedStatus(one.page)).toHaveText(new RegExp(`^${READY}`, "u"));
  await expect(queueRow(one.page)).toContainText(chosen);

  // Desk two did nothing: only its own poll can bring desk one's change.
  await expect(queueRow(two.page)).toContainText(chosen, POLL);
  await expect(sharedStatus(two.page)).toHaveText(new RegExp(`^${READY}`, "u"));
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
    "Someone else changed this first. Your action was not applied; review the latest state.",
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
  await panel.getByTestId("ward-shortlist-override-second-sign-off").check();
  await panel.getByTestId("ward-shortlist-override-sign-off-name").fill("JS");
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
