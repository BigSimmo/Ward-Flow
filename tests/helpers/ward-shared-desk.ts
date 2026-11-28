import {
  expect,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Locator,
  type Page,
} from "playwright/test";
import {
  homeFlowCard,
  openPlacementFromWaiting,
  revealWaitingRow,
  showEveryoneWaitingOn,
  waitingRow,
} from "./ward-home-page";

const supabaseOrigin = process.env.WARD_E2E_SUPABASE_ORIGIN ?? "";
const authOrigin = process.env.WARD_E2E_AUTH_ORIGIN ?? "";
export const accounts: { email: string; password: string }[] = JSON.parse(process.env.WARD_E2E_ACCOUNTS ?? "[]");

/** The shared status line both desks show while connected and idle. */
export const READY = "Coordinator · shared synthetic workspace";
/** The client polls every SHARED_REFRESH_MS (3 s); allow a few polls before calling it missed. */
export const POLL = { timeout: 15_000 };
/**
 * A seeded accepted movement with transport booked, so it cannot be referred. Wait order (Audit 1,
 * D-71) can put it past Waiting's first rows, so `revealRow` opens its folded groups when needed.
 */
export const MOVEMENT = "WF-030";

export type Desk = { context: BrowserContext; page: Page };

/**
 * One signed-in desk. The browser may reach this app and the local backend only. The approved
 * Supabase origin is fixed in the client and its CSP, so its sign-in calls are answered by the
 * fake service the runner started; everything else is refused, so nothing leaves the machine.
 */
export async function openDesk(
  browser: Browser,
  account: { email: string; password: string },
  clock = false,
  options: BrowserContextOptions = {},
) {
  // The runner creates a self-signed certificate only for its loopback HTTPS backend.
  const context = await browser.newContext({ ...options, ignoreHTTPSErrors: true });
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
  await page.goto("/bedchart", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(sharedStatus(page)).toContainText(READY, { timeout: 30_000 });
  // Account Help memory can restore the tour marker after sign-in, revealing this first-visit
  // note later. Read it through its normal button once; leave repeat appearances observable.
  // A note underneath an open modal must wait until it is interactive again.
  const whatsNew = page.locator('[data-testid="ward-whats-new"]:not([inert], [inert] *)');
  const dismissWhatsNew = async () => {
    await whatsNew.getByRole("button", { name: "Got it", exact: true }).click();
    await expect(whatsNew).toBeHidden();
  };
  if (await whatsNew.isVisible()) await dismissWhatsNew();
  else await page.addLocatorHandler(whatsNew, dismissWhatsNew, { times: 1 });
  return { context, page } satisfies Desk;
}

export function sharedStatus(page: Page): Locator {
  // Recovery moves inside an open drawer's focus trap. Only that surface announces while
  // the global bar is aria-hidden; unrelated live freshness announcements are separate.
  return page.locator(
    '[data-testid="ward-shared-status-bar"]:not([aria-hidden="true"]), [data-testid="ward-shared-recovery"]',
  );
}

export function placement(page: Page): Locator {
  return page.getByRole("complementary", { name: "Placement", exact: true });
}

/**
 * Where this desk shows the movement's tier now: its Waiting row's tier mark when Waiting is showing,
 * or the tier tag in Placement's head when Placement is open for it on Home. r10 folded Home's Flow
 * card into Waiting (`delays-row-<id>`), and Placement opens from Waiting's drawer (Open on Home).
 * Both marks read "T<tier>" (the Waiting tile's spoken words, "Tier <n> · …", come first there).
 */
export function queueRow(page: Page, movement = MOVEMENT): Locator {
  return waitingRow(page, movement)
    .locator("td")
    .first()
    .or(page.locator(`[data-testid="ward-home-placement"][data-subject-movement="${movement}"] [data-tier]`).first());
}

/**
 * Placement is the patient drawer over Home on every screen size (H7, Josh 3 Nov 2026), so a drawer
 * left open by an earlier step covers the page. Close it, as a coordinator would, before choosing.
 */
export async function closePlacement(page: Page) {
  const close = page.getByRole("button", { name: "Close placement and clear selection" });
  if ((await close.count()) === 0) return;
  await close.click();
  await expect(placement(page)).toHaveCount(0);
}

/**
 * Show the movement's Waiting row (r10: Flow folded into Waiting), opening Waiting and any folded
 * group or "Show all N" when the row is past the first rows. Returns its tier mark.
 */
export async function revealRow(page: Page, movement = MOVEMENT): Promise<Locator> {
  await closePlacement(page);
  await revealWaitingRow(page, movement);
  return queueRow(page, movement);
}

/**
 * Open Placement about the movement, whatever is top of the list: its Waiting row, the person's
 * drawer, then the drawer foot's Open on Home (r10). A Placement already open for it is kept.
 */
export async function selectMovement(page: Page, movement = MOVEMENT): Promise<Locator> {
  const open = placement(page);
  if ((await open.count()) > 0 && (await open.getAttribute("data-subject-movement")) === movement) return open;
  await revealRow(page, movement);
  await openPlacementFromWaiting(page, movement);
  await expect(placement(page)).toHaveAttribute("data-subject-movement", movement);
  return placement(page);
}

/** Open Placement's Change urgency form for the movement; returns its tier picker. */
export async function openUrgencyForm(page: Page, movement = MOVEMENT): Promise<Locator> {
  const panel = await selectMovement(page, movement);
  // Both are toggles that keep their state across a save, so open them only when closed.
  const update = panel.locator("details", { has: page.locator("summary", { hasText: "Update record" }) });
  if (!(await update.evaluate((element) => (element as HTMLDetailsElement).open)))
    await update.locator("summary").click();
  const change = panel.getByRole("button", { name: "Change urgency" });
  if ((await change.getAttribute("aria-expanded")) !== "true") await change.click();
  return panel.getByRole("combobox", { name: /^Urgency tier for / });
}

/** The tier this desk shows for the movement ("1", "2" or "3"), from its Waiting row or Placement. */
export async function shownTier(page: Page, movement = MOVEMENT): Promise<string> {
  return /T(\d)(?!\d)/u.exec((await queueRow(page, movement).textContent()) ?? "")?.[1] ?? "";
}

/**
 * Choose, with a reason, a tier other than the one this desk shows (and other than `avoid`); returns
 * the tier's mark as both the Waiting row and Placement show it ("T2"). The picker's own value is
 * the form's state, not the record.
 */
export async function chooseOtherTier(page: Page, tier: Locator, avoid?: string, movement = MOVEMENT): Promise<string> {
  const current = await shownTier(page, movement);
  const options = await tier
    .locator("option")
    .evaluateAll((list) =>
      list.map((option) => ({ value: (option as HTMLOptionElement).value, label: option.textContent ?? "" })),
    );
  // "Urgent" heads the picker (finding 156) but raises the urgent flag, not a tier, and asks its own reason.
  const next = options.find(
    (option) => option.value !== "urgent" && option.value !== current && `T${option.value}` !== avoid,
  )!;
  await tier.selectOption(next.value);
  await placement(page).getByRole("combobox", { name: "Reason" }).selectOption({ label: "Reassessed" });
  return `T${next.value}`;
}

/** A waiting movement other than MOVEMENT, for a second record to change. */
export async function anotherMovement(page: Page): Promise<string> {
  await closePlacement(page);
  await showEveryoneWaitingOn(page);
  const rows = homeFlowCard(page).locator('[data-testid^="delays-row-"]');
  await expect(rows.first()).toBeVisible();
  const ids = await rows.evaluateAll((list) =>
    list
      .map((row) => row.getAttribute("data-testid")!)
      .filter((id) => !id.startsWith("delays-row-timeline-"))
      .map((id) => id.replace("delays-row-", "")),
  );
  const other = ids.find((id) => id !== MOVEMENT);
  expect(other, "Waiting needs a second movement").toBeTruthy();
  return other!;
}

/** The shared board's command request, and its revision, for one desk's next save. */
export function nextCommand(page: Page) {
  return page.waitForRequest(
    (request) => request.method() === "POST" && new URL(request.url()).pathname.endsWith("/v1/workspace/commands"),
  );
}

/** Whether Placement sits in the part of the board that goes inert while changes are disabled. */
export function placementInert(page: Page): Promise<boolean> {
  return placement(page).evaluate((panel) => panel.closest("[inert]") !== null);
}

// A full page load would reset the board and hide whether the desk caught up on its own, so the
// recovery test plants a value in the page and checks it survived (as the release-gate helpers do).
export const SENTINEL = "ward-shared-mode-no-reload";

export async function plantSentinel(page: Page) {
  await page.evaluate((value) => {
    (window as unknown as Record<string, string>).__wardSharedModeSentinel = value;
  }, SENTINEL);
}

export async function expectNoReloadSince(page: Page, step: string) {
  const survived = await page.evaluate(
    () => (window as unknown as Record<string, string | undefined>).__wardSharedModeSentinel,
  );
  expect(survived, `the page reloaded during "${step}"`).toBe(SENTINEL);
}
